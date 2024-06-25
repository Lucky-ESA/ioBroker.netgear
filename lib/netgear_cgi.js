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
        this.newLoginTimer = null;
        this.reloginTimer = null;
        this.headerRequest = {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
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
            timeout: 5000,
        });
        this.json_array = [];
        this.maxport = 0;
    }

    /**
     * @param {boolean} first
     */
    async login(first) {
        const cookie = await this.adapter.getStateAsync(`${this.config.dp}.System.cookie`);
        if (cookie && cookie.val != null && cookie.val != "") {
            this.headerRequest.Cookie = cookie.val;
        }
        const uri = `/login.htm`;
        const resp = await this.sendRequest("GET", uri, null);
        if (resp && resp.data) {
            this.adapter.log.debug(`start login header: ${resp.headers}`);
            this.adapter.log.debug(`start login data: ${resp.data}`);
            const root = HTMLParser.parse(resp.data.toString().replace(/\n/g, ""), this.options);
            const rand = root.querySelector(`#rand`)?.toString();
            if (rand) {
                const randkey = rand.match("value='(.*?)'");
                if (randkey != null && randkey[1] != null) {
                    this.adapter.log.debug(randkey[1]);
                    const merge = this.merge(this.config.password, randkey[1]);
                    const hash = crypto.createHash("md5").update(merge).digest("hex");
                    this.adapter.log.debug(hash);
                    const data = {
                        data: `password=${hash}`,
                    };
                    const uri_cgi = `/login.${this.config.protocol}`;
                    const res = await this.sendRequest("POST", uri_cgi, data);
                    let err_msg;
                    if (res && res.data) {
                        const root = HTMLParser.parse(res.data.toString().replace(/\n/g, ""), this.options);
                        const msg = root.querySelector("#err_msg");
                        if (msg) {
                            err_msg = msg.toString().match("value='(.*?)'");
                        } else {
                            err_msg = "";
                        }
                    }
                    if (
                        res &&
                        res.headers &&
                        res.data &&
                        (res.headers["set-cookie"] || res.data.indexOf("index.htm") != -1)
                    ) {
                        this.adapter.log.debug(`login header: ${res.headers}`);
                        this.adapter.log.debug(`login data: ${res.data}`);
                        if (res.headers && res.headers["set-cookie"]) {
                            this.headerRequest.Cookie = res.headers["set-cookie"].toString().split(";")[0];
                        }
                        this.adapter.log.info(`Login ${this.config.dp} successful!`);
                        const check = await this.loadSwitchInfo(first, null);
                        if (check) {
                            await this.loadPortStatus(first, null);
                            await this.loadMonStat(first);
                            await this.loadBitRate(first, null);
                            this.startInterval();
                        } else {
                            this.adapter.log.warn(`Cannot read infos!! - ${this.config.ip}`);
                        }
                    } else {
                        if (err_msg != "") {
                            this.adapter.log.debug(`Login invalid! ${err_msg} - ${this.config.ip}`);
                            this.relogin();
                        } else {
                            this.adapter.log.debug(`Login invalid! Wrong password! - ${this.config.ip}`);
                        }
                        res && this.adapter.log.debug(`Login invalid! Wrong password! ${res.data} - ${this.config.ip}`);
                        this.adapter.log.debug(`Login invalid! Wrong password! ${res.headers} - ${this.config.ip}`);
                    }
                } else {
                    this.adapter.log.warn(`Cannot find randkey!! - ${this.config.ip}`);
                }
            } else {
                this.adapter.log.warn(`Cannot read securerand!! - ${this.config.ip}`);
            }
        } else {
            this.adapter.log.warn(`Cannot read login page!! - ${this.config.ip}`);
        }
    }

    /**
     *
     */
    relogin() {
        this.reloginTimer && this.adapter.clearTimeout(this.reloginTimer);
        this.reloginTimer = null;
        this.adapter.log.info(`Relogin in 5 minutes!! - ${this.config.ip}`);
        this.reloginTimer = this.adapter.setTimeout(
            () => {
                this.login(true);
            },
            5 * 60 * 1000,
        );
    }

    /**
     *
     */
    async startUpdate() {
        const check = await this.loadSwitchInfo(false, null);
        if (check) {
            await this.loadPortStatus(false, null);
            await this.loadMonStat(false);
            await this.loadBitRate(false, null);
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
        this.adapter.log.info(`Start Interval for ${this.config.dp} with ${this.config.interval} minute(s)!`);
        this.updateInterval = this.adapter.setInterval(
            async () => {
                this.adapter.log.info(`Start Update for device ${this.config.ip}!`);
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
     * @param {string | null | undefined} value_status
     */
    async loadSwitchInfo(first, value_status) {
        let info;
        if (!value_status) {
            const uri = `/switch_info.htm`;
            info = await this.sendRequest("GET", uri, null);
        } else {
            info = value_status;
        }
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
                    this.adapter.log.info(`Cannot find dhcp! - ${this.config.ip}`);
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
                    this.adapter.log.warn(`loadSwitchInfo missmatch: ${info.data} - ${this.config.ip}`);
                    return false;
                }
            }
        } else {
            this.adapter.log.warn(`loadSwitchInfo no data: ${info} - ${this.config.ip}`);
            return false;
        }
    }

    /**
     * @param {boolean | null | undefined} first
     * @param {object | null | undefined} value_status
     */
    async loadPortStatus(first, value_status) {
        let port;
        if (!value_status || !value_status.data) {
            const uri = `/status.htm`;
            port = await this.sendRequest("GET", uri, null);
            port && port.data && this.adapter.log.debug(`loadPortStatus: ${port.data} - ${this.config.ip}`);
        } else {
            port = value_status;
        }
        if (port != null && port.data && typeof port.data === "string" && port.data.indexOf("portStatus") != -1) {
            this.json_array = [];
            const states_port = {};
            states_port["0"] = "";
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
                        arr_rows[5] = typeof arr_rows[5] === "string" ? parseInt(arr_rows[5]) : arr_rows[5];
                        states_port[arr_rows[0]] = `Port ${arr_rows[0]}`;
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
                            bit_rate_input: 0,
                            bit_rate_output: 0,
                        };
                        if (first) {
                            await this.adapter.createInfos(this.config, arr_rows);
                            ++this.maxport;
                        } else {
                            this.setStatesPort(arr_rows);
                        }
                        if (value_status) {
                            this.json_array[i].port = arr_rows[0];
                            this.json_array[i].status = arr_rows[1];
                            this.json_array[i].speed = arr_rows[2];
                            this.json_array[i].speed_connection = arr_rows[3];
                            this.json_array[i].flow = arr_rows[4];
                            this.json_array[i].mtu = arr_rows[5];
                        } else {
                            this.json_array.push(json);
                        }
                    } else {
                        this.adapter.log.warn(`Cannot read TD Tags!! - ${this.config.ip}`);
                        return false;
                    }
                }
                if (first) {
                    this.adapter.extendObject(`${this.config.dp}.Remote.flow_select_port`, {
                        common: { states: states_port },
                    });
                    this.adapter.extendObject(`${this.config.dp}.Remote.rate_select_port`, {
                        common: { states: states_port },
                    });
                }
                if (value_status) {
                    this.adapter.setState(`${this.config.dp}.Ports.json`, JSON.stringify(this.json_array), true);
                }
                return true;
            } else {
                this.adapter.log.warn(`Cannot split port infos!! - ${this.config.ip}`);
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
                        this.adapter.log.warn(`Cannot read INPUT Tags!! - ${this.config.ip}`);
                        return false;
                    }
                }
                return true;
            } else {
                this.adapter.log.warn(`Cannot split port infos!! - ${this.config.ip}`);
                return false;
            }
        } else {
            if (mon && mon.data) {
                this.adapter.log.warn(`loadMonStat no data: ${mon.data} - ${this.config.ip}`);
            } else {
                this.adapter.log.warn(`loadMonStat no data: ${JSON.stringify(mon)} - ${this.config.ip}`);
            }
            return false;
        }
    }

    /**
     * @param {boolean | null | undefined} first
     * @param {object | null | undefined} value_status
     */
    async loadBitRate(first, value_status) {
        let rate;
        if (!value_status || !value_status.data) {
            const uri = `/rateLimit.htm`;
            rate = await this.sendRequest("GET", uri, null);
        } else {
            rate = value_status;
        }
        rate && this.adapter.log.info(`rate: ${rate.data}`);
        if (rate != null && rate.data && typeof rate.data === "string" && rate.data.indexOf("IngressRate") != -1) {
            const td = rate.data.split(`<tr class="portID">`);
            td.shift();
            if (td.length > 0) {
                for (let i = 0; i < td.length; i++) {
                    const root = HTMLParser.parse(td[i].toString().replace(/\n/g, ""), this.options);
                    const rows = root.getElementsByTagName("input");
                    const arr_rows = [];
                    const arr_row = [];
                    arr_rows.push(i + 1);
                    if (rows.length > 3) {
                        for (let i = 2; i < 4; i++) {
                            const data = rows[i].toString().match("value='(.*?)'");
                            if (data != null && data[1] != null) {
                                arr_rows.push(parseInt(data[1], 16));
                            }
                        }
                        for (let i = 1; i < 4; i++) {
                            let td_val = root.getElementsByTagName("td")[i].innerHTML;
                            td_val = td_val.replace(/<input(.*?)\/>/g, "");
                            arr_row.push(td_val);
                        }
                        if (first) {
                            await this.adapter.createRate(this.config, arr_rows);
                        } else {
                            this.setStatesRate(arr_rows);
                        }
                        this.json_array[i].bit_rate_input = arr_row[1];
                        this.json_array[i].bit_rate_output = arr_row[2];
                    } else {
                        this.adapter.log.warn(`Cannot read INPUT Tags!! - ${this.config.ip}`);
                        return false;
                    }
                }
                this.adapter.setState(`${this.config.dp}.Ports.json`, JSON.stringify(this.json_array), true);
                return true;
            } else {
                this.adapter.log.warn(`Cannot split rate infos!! - ${this.config.ip}`);
                return false;
            }
        } else {
            if (rate && rate.data) {
                this.adapter.log.warn(`loadBitRate no data: ${rate.data} - ${this.config.ip}`);
            } else {
                this.adapter.log.warn(`loadBitRate no data: ${JSON.stringify(rate)} - ${this.config.ip}`);
            }
            return false;
        }
    }

    /**
     * @param {string} name
     */
    async changeName(name) {
        await this.loginCheck();
        const uri = `/switch_info.htm`;
        const info = await this.sendRequest("GET", uri, null);
        info && info.data && this.adapter.log.debug(`changeName: ${info.data}`);
        if (info && info.data) {
            const root = HTMLParser.parse(info.data.toString().replace(/\n/g, ""), this.options);
            const hash = root.querySelector(`#hash`);
            this.adapter.log.debug(`hash: ${hash}`);
            if (hash) {
                const val_hash = hash.toString().match("value='(.*?)'");
                if (val_hash != null && val_hash[1] != null) {
                    const dhcp = root.querySelector(`#dhcp_mode`);
                    if (dhcp) {
                        const val_dhcp = dhcp.toString().match("value='(.*?)'");
                        if (val_dhcp != null && val_dhcp[1] != null) {
                            const uri_cgi = `/switch_info.${this.config.protocol}`;
                            let request_string = `switch_name=${name}`;
                            request_string += `&dhcpmode=${val_dhcp[1]}`;
                            request_string += `&dhcpmode=${val_dhcp[1]}`;
                            request_string += `&hash=${val_hash[1]}`;
                            this.adapter.log.debug(`sent: ${request_string}`);
                            const sent = {
                                data: request_string,
                            };
                            const change = await this.sendRequest("POST", uri_cgi, sent);
                            change && this.adapter.log.debug(change.data);
                            if (change && change.data) {
                                this.loadSwitchInfo(false, change);
                            } else {
                                this.adapter.log.warn(`Cannot set name: ${name}} - ${this.config.ip}`);
                            }
                        } else {
                            this.adapter.log.warn(`Cannot found dhcp: ${val_dhcp} - ${this.config.ip}`);
                        }
                    } else {
                        this.adapter.log.warn(`Cannot found input dhcp: ${dhcp} - ${this.config.ip}`);
                    }
                } else {
                    this.adapter.log.warn(`Cannot found hash: ${hash} - ${this.config.ip}`);
                }
            } else {
                this.adapter.log.warn(`Cannot found input hash: ${hash} - ${this.config.ip}`);
            }
        } else {
            this.adapter.log.warn(`changeName no data: ${info} - ${this.config.ip}`);
        }
    }

    /**
     * @param {string} cables
     */
    async cableCheck(cables) {
        //await this.loginCheck();
        const uri = `/cableTester.htm`;
        const info = await this.sendRequest("GET", uri, null);
        info && info.data && this.adapter.log.debug(`cableCheck: ${info.data}`);
        if (info && info.data) {
            const root = HTMLParser.parse(info.data.toString().replace(/\n/g, ""), this.options);
            const hash = root.querySelector(`#hash`);
            this.adapter.log.debug(`hash: ${hash}`);
            if (hash) {
                let request_string = "";
                const val_hash = hash.toString().match("value='(.*?)'");
                if (val_hash != null && val_hash[1] != null) {
                    const uri_cgi = `/cableDiagnoses.${this.config.protocol}`;
                    if (typeof cables === "string") cables = JSON.parse(cables);
                    if (cables != null && Array.isArray(cables) && cables.length > 0) {
                        for (const ca of cables) {
                            if (ca > 0 && (ca < this.maxport || ca == this.maxport)) {
                                request_string += `port${ca}=checked&`;
                            } else {
                                this.adapter.log.warn(`Port ${ca} is to high!`);
                            }
                        }
                        request_string += `hash=${val_hash[1]}`;
                        this.adapter.log.debug(`sent: ${request_string}`);
                        const sent = {
                            data: request_string,
                        };
                        const change = await this.sendRequest("POST", uri_cgi, sent);
                        if (change && change.data) {
                            this.adapter.log.debug(change.data);
                            const td = change.data.split(`<tr class="portID">`);
                            td.shift();
                            const arr_json = [];
                            if (td.length > 0) {
                                for (const ca of cables) {
                                    const root = HTMLParser.parse(
                                        td[ca - 1].toString().replace(/\n/g, ""),
                                        this.options,
                                    );
                                    const rows = root.getElementsByTagName("td");
                                    const arr_rows = [];
                                    if (rows.length === 4) {
                                        for (let i = 1; i < rows.length; i++) {
                                            arr_rows.push(root.getElementsByTagName("td")[i].innerHTML);
                                        }
                                        const json = {
                                            port: arr_rows[0],
                                            status: arr_rows[1],
                                            meter: arr_rows[2],
                                        };
                                        arr_json.push(json);
                                    } else {
                                        this.adapter.log.warn(`Cannot read TD Tags!!`);
                                    }
                                }
                                this.adapter.setState(
                                    `${this.config.dp}.Remote.cable_testing_result`,
                                    JSON.stringify(arr_json),
                                    true,
                                );
                            } else {
                                this.adapter.log.warn(`Cannot split port infos!!`);
                            }
                        } else {
                            this.adapter.log.warn(`Cannot read response: ${change} - ${this.config.ip}`);
                        }
                    } else {
                        this.adapter.log.warn(`Cannot read cable value: ${cables} - ${this.config.ip}`);
                    }
                } else {
                    this.adapter.log.warn(`Cannot found hash: ${hash} - ${this.config.ip}`);
                }
            } else {
                this.adapter.log.warn(`Cannot found input hash: ${hash} - ${this.config.ip}`);
            }
        } else {
            this.adapter.log.warn(`cableCheck no data: ${info} - ${this.config.ip}`);
        }
    }

    /**
     *
     */
    async reboot() {
        //await this.loginCheck();
        const uri = `/device_reboot.htm`;
        const info = await this.sendRequest("GET", uri, null);
        if (info && info.data) {
            const root = HTMLParser.parse(info.data.toString().replace(/\n/g, ""), this.options);
            const hash = root.querySelector(`#hash`);
            this.adapter.log.debug(`hash: ${hash}`);
            if (hash) {
                const val_hash = hash.toString().match("value='(.*?)'");
                if (val_hash != null && val_hash[1] != null) {
                    const uri_cgi = `/device_reboot.${this.config.protocol}`;
                    const request_string = `CBox=on&hash=${val_hash[1]}`;
                    this.adapter.log.debug(`sent: ${request_string}`);
                    const sent = {
                        data: request_string,
                    };
                    await this.sendRequest("POST", uri_cgi, sent);
                    this.adapter.log.info(`Relogin in 15 sekundes!`);
                    this.newLoginTimer = this.adapter.setTimeout(() => {
                        this.login(false);
                    }, 15 * 1000);
                } else {
                    this.adapter.log.warn(`Cannot found hash: ${hash} - ${this.config.ip}`);
                }
            } else {
                this.adapter.log.warn(`Cannot found input hash: ${hash} - ${this.config.ip}`);
            }
        } else {
            this.adapter.log.warn(`reboot no data: ${info} - ${this.config.ip}`);
        }
    }

    /**
     *
     */
    async changeSpeed() {
        //await this.loginCheck();
        const speed = await this.adapter.getStateAsync(`${this.config.dp}.Remote.flow_select_speed`);
        if (!speed || speed.val == null) {
            this.adapter.log.warn(`Speed is empty!`);
            return;
        }
        speed.val = typeof speed.val != "number" ? parseInt(speed.val) : speed.val;
        if (speed.val > 6) {
            this.adapter.log.warn(`Wrong speed value - ${speed.val}!`);
            return;
        }
        const status = await this.adapter.getStateAsync(`${this.config.dp}.Remote.flow_select_status`);
        if (!status || status.val == null) {
            this.adapter.log.warn(`Status is empty!`);
            return;
        }
        status.val = typeof status.val != "number" ? parseInt(status.val) : status.val;
        if (status.val > 2) {
            this.adapter.log.warn(`Wrong status value - ${status.val}!`);
            return;
        }
        const port = await this.adapter.getStateAsync(`${this.config.dp}.Remote.flow_select_port`);
        if (!port || port.val == null) {
            this.adapter.log.warn(`Port is empty!`);
            return;
        }
        port.val = typeof port.val != "number" ? parseInt(port.val) : port.val;
        if (port.val > this.maxport) {
            this.adapter.log.warn(`Wrong port value - ${port.val}!`);
            return;
        }
        const uri = `/status.htm`;
        const ports = await this.sendRequest("GET", uri, null);
        ports && ports.data && this.adapter.log.debug(`changeSpeed: ${ports.data}`);
        if (ports != null && ports.data && typeof ports.data === "string") {
            const root = HTMLParser.parse(ports.data.toString().replace(/\n/g, ""), this.options);
            const hash = root.querySelector(`#hash`);
            this.adapter.log.debug(`hash: ${hash}`);
            if (hash) {
                const val_hash = hash.toString().match("value='(.*?)'");
                if (val_hash != null && val_hash[1] != null) {
                    const uri_cgi = `/status.${this.config.protocol}`;
                    let request_string = `SPEED=${speed.val}`;
                    request_string = `&FLOW_CONTROL=${status.val}`;
                    request_string = `&port${port.val}=checked`;
                    request_string = `&hash=${val_hash[1]}`;
                    this.adapter.log.debug(`sent: ${request_string}`);
                    const sent = {
                        data: request_string,
                    };
                    const change = await this.sendRequest("POST", uri_cgi, sent);
                    change && this.adapter.log.debug(change.data);
                    this.loadPortStatus(false, change);
                    return true;
                } else {
                    this.adapter.log.warn(`Cannot found hash: ${hash} - ${this.config.ip}`);
                    return false;
                }
            } else {
                this.adapter.log.warn(`Cannot found input hash: ${hash} - ${this.config.ip}`);
                return false;
            }
        } else {
            this.adapter.log.warn(`Cannot read port infos!! - ${this.config.ip}`);
            return false;
        }
    }

    /**
     *
     */
    async changeRate() {
        const input = await this.adapter.getStateAsync(`${this.config.dp}.Remote.rate_input`);
        if (!input || input.val == null) {
            this.adapter.log.warn(`Rate input is empty!`);
            return;
        }
        input.val = typeof input.val != "number" ? parseInt(input.val) : input.val;
        if (input.val > 12) {
            this.adapter.log.warn(`Wrong rate input value - ${input.val}!`);
            return;
        }
        const output = await this.adapter.getStateAsync(`${this.config.dp}.Remote.rate_output`);
        if (!output || output.val == null) {
            this.adapter.log.warn(`Rate output is empty!`);
            return;
        }
        output.val = typeof output.val != "number" ? parseInt(output.val) : output.val;
        if (output.val > 12) {
            this.adapter.log.warn(`Wrong rate output value - ${output.val}!`);
            return;
        }
        const port = await this.adapter.getStateAsync(`${this.config.dp}.Remote.rate_select_port`);
        if (!port || port.val == null) {
            this.adapter.log.warn(`Port is empty!`);
            return;
        }
        port.val = typeof port.val != "number" ? parseInt(port.val) : port.val;
        if (port.val > this.maxport) {
            this.adapter.log.warn(`Wrong port value - ${port.val}!`);
            return;
        }
        const uri = `/rateLimit.htm`;
        const rate = await this.sendRequest("GET", uri, null);
        rate && rate.data && this.adapter.log.debug(`changeRate: ${rate.data}`);
        if (rate != null && rate.data && typeof rate.data === "string") {
            const root = HTMLParser.parse(rate.data.toString().replace(/\n/g, ""), this.options);
            const hash = root.querySelector(`#hash`);
            this.adapter.log.debug(`hash: ${hash}`);
            if (hash) {
                const val_hash = hash.toString().match("value='(.*?)'");
                if (val_hash != null && val_hash[1] != null) {
                    const uri_cgi = `/rateLimit.${this.config.protocol}`;
                    let request_string = `IngressRate=${input.val}`;
                    request_string = `&EgressRate=${output.val}`;
                    request_string = `&port${port.val}=checked`;
                    request_string = `&hash=${val_hash[1]}`;
                    this.adapter.log.debug(`sent: ${request_string}`);
                    const sent = {
                        data: request_string,
                    };
                    const change = await this.sendRequest("POST", uri_cgi, sent);
                    change && this.adapter.log.debug(change.data);
                    this.loadBitRate(false, change);
                    return true;
                } else {
                    this.adapter.log.warn(`Cannot found hash: ${hash} - ${this.config.ip}`);
                    return false;
                }
            } else {
                this.adapter.log.warn(`Cannot found input hash: ${hash} - ${this.config.ip}`);
                return false;
            }
        } else {
            this.adapter.log.warn(`Cannot read rate infos!! - ${this.config.ip}`);
            return false;
        }
    }

    /**
     *
     */
    async loginCheck() {
        const uri = `/index.htm`;
        const port = await this.sendRequest("GET", uri, null);
        port && port.data && this.adapter.log.info(`loginCheck: ${port.data}`);
        if (port != null && port.data && typeof port.data === "string" && port.data.indexOf("portConfigEntry") != -1) {
            return true;
        } else {
            //await this.login(false);
            return true;
        }
    }

    /**
     *
     */
    destroy() {
        this.adapter.setState(`${this.config.dp}.System.online`, false, true);
        this.updateInterval && this.adapter.clearInterval(this.updateInterval);
        this.updateInterval = null;
        this.newLoginTimer && this.adapter.clearTimeout(this.newLoginTimer);
        this.newLoginTimer = null;
        this.reloginTimer && this.adapter.clearTimeout(this.reloginTimer);
        this.reloginTimer = null;
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
     * @param {object} infos
     */
    async setStatesRate(infos) {
        this.adapter.setState(
            `${this.config.dp}.Ports.Port_${("0" + infos[0]).slice(-2)}.bit_rate_input`,
            parseInt(infos[1]),
            true,
        );
        this.adapter.setState(
            `${this.config.dp}.Ports.Port_${("0" + infos[0]).slice(-2)}.bit_rate_output`,
            parseInt(infos[2]),
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
            headers: this.headerRequest,
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
