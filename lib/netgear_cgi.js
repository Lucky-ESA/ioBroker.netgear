const EventEmitter = require("events");
const axios = require("axios");
const http = require("http");
const https = require("https");
const crypto = require("crypto");
const HTMLParser = require("node-html-parser");

/**
 *
 * @extends EventEmitter
 */
class NeatGear extends EventEmitter {
    constructor(config, adapter) {
        super();
        this.adapter = adapter;
        this.config = config;
        this.updateInterval = null;
        this.headerLogin = {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept-Endcoding": "gzip,deflate",
            Connection: "keep-alive",
            "user-agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
        };
        this.headerRequest = {};
        this.options = {
            lowerCaseTagName: false,
            comment: false,
            voidTag: {
                tags: [
                    "area",
                    "base",
                    "br",
                    "col",
                    "embed",
                    "hr",
                    "img",
                    "input",
                    "link",
                    "meta",
                    "param",
                    "source",
                    "track",
                    "wbr",
                ],
                closingSlash: true,
            },
            blockTextElements: {
                script: true,
                noscript: true,
                style: true,
                pre: true,
            },
        };
        const httpAgent = new http.Agent({ keepAlive: true, maxSockets: Infinity });
        const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: Infinity });
        this.requestClient = axios.create({
            withCredentials: true,
            baseURL: `http://${config.ip}`,
            httpAgent,
            httpsAgent,
            timeout: 3000,
        });
        this.json_array = [];
    }

    /**
     * @param {boolean} first
     */
    async login(first) {
        const uri = `/login.${this.config.protocol}`;
        const resp = await this.sendRequest("POST", uri, null);
        if (resp && resp.data) {
            const root = HTMLParser.parse(resp.data.toString().replace(/\n/g, ""), this.options);
            const rand = root.querySelector(`#rand`)?.toString();
            if (rand) {
                const randkey = rand.match("value='(.*?)'");
                if (randkey != null && randkey[1] != null) {
                    this.adapter.log.info(randkey[1]);
                    const merge = this.merge(this.config.password, randkey[1]);
                    const hash = crypto.createHash("md5").update(merge).digest("hex");
                    this.adapter.log.info(hash);
                    const data = {
                        data: {
                            password: hash,
                        },
                    };
                    this.headerRequest = {
                        Accepted:
                            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                        "Accept-Endcoding": "gzip,deflate",
                        Connection: "keep-alive",
                        "user-agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
                    };
                    const res = await this.sendRequest("POST", uri, data);
                    if (res && res.headers && res.headers["set-cookie"]) {
                        this.adapter.log.debug(res.headers["set-cookie"]);
                        this.headerRequest.Cookie = res.headers["set-cookie"].toString().split(";")[0];
                        this.adapter.log.info(`Login ${this.config.dp} successful!`);
                        const check = await this.loadSwitchInfo(first);
                        if (check) {
                            await this.loadPortStatus(first);
                            await this.loadMonStat(first);
                            this.startInterval();
                        } else {
                            this.adapter.log.warn(`Cannot read infos!!`);
                        }
                    } else {
                        this.adapter.log.warn(`Login invalid! Wrong password!`);
                    }
                } else {
                    this.adapter.log.warn(`Cannot find randkey!!`);
                }
            } else {
                this.adapter.log.warn(`Cannot read securerand!!`);
            }
        } else {
            this.adapter.log.warn(`Cannot read login page!!`);
        }
    }

    /**
     *
     */
    async startUpdate() {
        const check = await this.loadSwitchInfo(false);
        if (check) {
            await this.loadPortStatus(false);
            await this.loadMonStat(false);
        } else {
            this.adapter.log.debug(`Start refresh cookie`);
            delete this.headerRequest.Cookie;
            this.login(false);
        }
    }

    /**
     *
     */
    startInterval() {
        if (this.updateInterval) return;
        this.adapter.log.info(`Start Interval for ${this.config.dp} with ${this.config.interval}!`);
        this.checkInterval = this.adapter.setInterval(
            async () => {
                this.startUpdate();
            },
            1000 * 60 * this.config.interval,
        );
    }

    /**
     * @param {string} str1
     * @param {string} str2
     */
    merge(str1, str2) {
        const arr1 = str1.split("");
        const arr2 = str2.split("");
        let result = "";
        let index1 = 0;
        let index2 = 0;
        while (index1 < arr1.length || index2 < arr2.length) {
            if (index1 < arr1.length) {
                result += arr1[index1];
                index1++;
            }
            if (index2 < arr2.length) {
                result += arr2[index2];
                index2++;
            }
        }
        return result;
    }

    /**
     * @param {boolean | null | undefined} first
     */
    async loadSwitchInfo(first) {
        const uri = `/switch_info.htm`;
        const info = await this.sendRequest("GET", uri, null);
        if (info && info.data) {
            const root = HTMLParser.parse(info.data.toString().replace(/\n/g, ""), this.options);
            const dhcp = root.querySelector("#dhcp_mode");
            const all_data = info.data.match(/center(.*?)>(.*?)<\/td>/gu);
            const arr_all = [];
            const sort_arr = [0, 1, 3, 5, 9, 6, 7, 8, 2, 4];
            const new_arr = [];
            if (all_data != null && Array.isArray(all_data) && all_data.length > 1) {
                for (let i = 0; i < all_data.length; i++) {
                    const val = all_data[i].replace(/center'>/g, "").replace(/<\/td>/g, "");
                    if (val.indexOf("value") != -1) {
                        const value = val.match("value='(.*?)'");
                        if (value != null && value[1] != null) {
                            arr_all.push(value[1]);
                        }
                    } else {
                        arr_all.push(val);
                    }
                }
                if (dhcp != null) {
                    const option = dhcp.toString().match("value='(.*?)'");
                    if (option != null && option[1] != null) {
                        const sel = info.data.match(option[1] + "'>(.*?)</option>");
                        if (sel != null && sel[1] != null) {
                            arr_all.push(sel[1]);
                        }
                    }
                } else {
                    this.adapter.log.info(`Cannot find dhcp!`);
                    arr_all.push("UNKNOWN");
                }
                if (arr_all.length === 10) {
                    for (const arr of sort_arr) {
                        new_arr.push(arr_all[arr]);
                    }
                    if (first) {
                        await this.adapter.createDevice(this.config, new_arr);
                    } else {
                        this.setStatesInfo(new_arr);
                    }
                    this.adapter.setState(`${this.config.dp}.System.online`, true, true);
                    this.adapter.setState(
                        `${this.config.dp}.System.cookie`,
                        this.headerRequest.Cookie ? this.headerRequest.Cookie : null,
                        true,
                    );
                    return true;
                } else {
                    this.adapter.log.warn(`loadSwitchInfo missmatch: ${info.data}`);
                    return false;
                }
            }
        } else {
            this.adapter.log.warn(`loadSwitchInfo no data: ${info}`);
            return false;
        }
    }

    /**
     * @param {boolean | null | undefined} first
     */
    async loadPortStatus(first) {
        const uri = `/status.htm`;
        const port = await this.sendRequest("GET", uri, null);
        port && port.data && this.adapter.log.debug(`loadPortStatus: ${port.data}`);
        if (port != null && port.data && typeof port.data === "string" && port.data.indexOf("portStatus") != -1) {
            this.json_array = [];
            const td = port.data.split(`<tr class="portID">`);
            td.shift();
            if (td.length > 0) {
                for (let i = 0; i < td.length; i++) {
                    td[i] = td[i].replace(/<input.*?>(.*?)<\/td>/g, "");
                    const root = HTMLParser.parse(td[i].toString().replace(/\n/g, ""), this.options);
                    const rows = root.getElementsByTagName("td");
                    const arr_rows = [];
                    if (rows.length === 7) {
                        for (let i = 1; i < rows.length; i++) {
                            arr_rows.push(root.getElementsByTagName("td")[i].innerHTML);
                        }
                        const json = {
                            port: arr_rows[0],
                            status: arr_rows[1],
                            speed: arr_rows[2],
                            speed_connection: arr_rows[3],
                            flow: arr_rows[4],
                            mtu: arr_rows[5],
                            bytes_receiced: 0,
                            bytes_sent: 0,
                            bytes_crc: 0,
                        };
                        if (first) {
                            await this.adapter.createInfos(this.config, arr_rows);
                        } else {
                            this.setStatesPort(arr_rows);
                        }
                        this.json_array.push(json);
                    } else {
                        this.adapter.log.warn(`Cannot read TD Tags!!`);
                        return false;
                    }
                }
            } else {
                this.adapter.log.warn(`Cannot split port infos!!`);
                return false;
            }
        } else {
            this.adapter.log.warn(`Cannot read port infos!!`);
            return false;
        }
    }

    /**
     * @param {boolean | null | undefined} first
     */
    async loadMonStat(first) {
        const uri = `/port_statistics.htm`;
        const mon = await this.sendRequest("GET", uri, null);
        mon && mon.data && this.adapter.log.debug(`loadMonStat: ${mon.data}`);
        if (mon != null && mon.data && typeof mon.data === "string" && mon.data.indexOf("portStatistics") != -1) {
            const td = mon.data.split(`<tr class="portID" name="portID">`);
            td.shift();
            if (td.length > 0) {
                for (let i = 0; i < td.length; i++) {
                    const root = HTMLParser.parse(td[i].toString().replace(/\n/g, ""), this.options);
                    const rows = root.getElementsByTagName("input");
                    const arr_rows = [];
                    arr_rows.push(i + 1);
                    if (rows.length === 3) {
                        for (let i = 0; i < rows.length; i++) {
                            const data = rows[i].toString().match("value='(.*?)'");
                            if (data != null && data[1] != null) {
                                arr_rows.push(parseInt(data[1], 16));
                            }
                        }
                        if (first) {
                            await this.adapter.createStati(this.config, arr_rows);
                        } else {
                            this.setStatesStati(arr_rows);
                        }
                        this.json_array[i].bytes_receiced = arr_rows[1];
                        this.json_array[i].bytes_sent = arr_rows[2];
                        this.json_array[i].bytes_crc = arr_rows[3];
                    } else {
                        this.adapter.log.warn(`Cannot read INPUT Tags!!`);
                        return false;
                    }
                }
                this.adapter.setState(`${this.config.dp}.Ports.json`, JSON.stringify(this.json_array), true);
                return true;
            } else {
                this.adapter.log.warn(`Cannot split port infos!!`);
                return false;
            }
        } else {
            this.adapter.log.warn(`loadMonStat no data: ${mon}`);
            return false;
        }
    }

    /**
     *
     */
    destroy() {
        this.adapter.setState(`${this.config.dp}.System.online`, false, true);
        this.updateInterval && this.adapter.clearInterval(this.updateInterval);
        this.updateInterval = null;
    }

    /**
     * @param {object} infos
     */
    async setStatesInfo(infos) {
        this.adapter.setState(`${this.config.dp}.System.firmware`, infos[3], true);
        this.adapter.setState(`${this.config.dp}.System.bootloader`, infos[9], true);
        this.adapter.setState(`${this.config.dp}.System.productname`, infos[0], true);
        this.adapter.setState(`${this.config.dp}.System.name`, infos[1], true);
        this.adapter.setState(`${this.config.dp}.System.serialnumber`, infos[8], true);
        this.adapter.setState(`${this.config.dp}.System.mac`, infos[2], true);
        this.adapter.setState(`${this.config.dp}.System.ip`, infos[5], true);
        this.adapter.setState(`${this.config.dp}.System.lastupdate`, Date.now(), true);
    }

    /**
     * @param {object} infos
     */
    async setStatesPort(infos) {
        this.adapter.setState(`${this.config.dp}.Ports.Port_${("0" + infos[0]).slice(-2)}.mtu`, infos[5], true);
        this.adapter.setState(`${this.config.dp}.Ports.Port_${("0" + infos[0]).slice(-2)}.flow`, infos[4], true);
        this.adapter.setState(
            `${this.config.dp}.Ports.Port_${("0" + infos[0]).slice(-2)}.speed_connection`,
            infos[3],
            true,
        );
        this.adapter.setState(`${this.config.dp}.Ports.Port_${("0" + infos[0]).slice(-2)}.speed`, infos[2], true);
        this.adapter.setState(`${this.config.dp}.Ports.Port_${("0" + infos[0]).slice(-2)}.status`, infos[1], true);
    }

    /**
     * @param {object} infos
     */
    async setStatesStati(infos) {
        this.adapter.setState(
            `${this.config.dp}.Ports.Port_${("0" + infos[0]).slice(-2)}.bytes_receiced`,
            parseInt(infos[1]),
            true,
        );
        this.adapter.setState(
            `${this.config.dp}.Ports.Port_${("0" + infos[0]).slice(-2)}.bytes_sent`,
            parseInt(infos[2]),
            true,
        );
        this.adapter.setState(
            `${this.config.dp}.Ports.Port_${("0" + infos[0]).slice(-2)}.bytes_crc`,
            parseInt(infos[3]),
            true,
        );
    }

    /**
     * @param {string} methode
     * @param {string} url
     * @param {object|null|undefined} data
     */
    async sendRequest(methode, url, data) {
        if (data == null) {
            data = "";
        }
        return await this.requestClient({
            method: methode,
            url: url,
            headers: this.headerRequest.Cookie != null ? this.headerRequest : this.headerLogin,
            ...data,
        })
            .then(async (res) => {
                this.adapter.log.debug(res.headers);
                return res;
            })
            .catch((error) => {
                return error;
            });
    }
}

module.exports = NeatGear;
