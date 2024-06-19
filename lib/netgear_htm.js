const EventEmitter = require("events");
const axios = require("axios");
const http = require("http");

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
            "user-agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
        };
        this.headerRequest = {};
        this.requestClient = axios.create({
            withCredentials: true,
            baseURL: `http://${config.ip}`,
            httpAgent: new http.Agent({ keepAlive: true }),
            timeout: 3000,
        });
        this.json_array = [];
    }

    /**
     * @param {boolean} first
     */
    async login(first) {
        const uri = `/login.${this.config.protocol}`;
        const data = {
            data: {
                submitId: "pwdLogin",
                password: this.config.password,
                submitEnd: "",
            },
        };
        this.headerRequest = {
            Accepted: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
            "Accept-Endcoding": "gzip,deflate",
            "user-agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
        };
        const resp = await this.sendRequest("POST", uri, data);
        if (resp && resp.headers && resp.headers["set-cookie"]) {
            this.adapter.log.debug(resp.headers["set-cookie"]);
            this.headerRequest.Cookie = resp.headers["set-cookie"].toString().split(" ")[0];
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
            delete this.headerRequest.Cookie;
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
                this.adapter.log.info(`Start Update for device ${this.config.ip}!`);
                this.startUpdate();
            },
            1000 * 60 * this.config.interval,
        );
    }

    /**
     * @param {boolean | null | undefined} first
     */
    async loadSwitchInfo(first) {
        const uri = `/config/status_switch_info.${this.config.protocol}`;
        const info = await this.sendRequest("GET", uri, null);
        if (info && info.data) {
            this.adapter.log.debug(`loadSwitchInfo: ${info.data}`);
            const rand = info.data.match("secureRand = '(.*?)';");
            const data = info.data.match("sysInfo = '(.*?)';");
            rand != null && rand[1] != null && this.adapter.log.debug(`loadSwitchInfo rand: ${rand[1]}`);
            if (data != null && data[1] != null) {
                this.adapter.log.debug(`loadSwitchInfo data: ${data[1]}`);
                const infos = data[1].split("?");
                if (infos.length > 0) {
                    if (first) {
                        await this.adapter.createDevice(this.config, infos);
                    } else {
                        this.setStatesInfo(infos);
                    }
                    this.adapter.setState(`${this.config.dp}.System.online`, true, true);
                    this.adapter.setState(
                        `${this.config.dp}.System.cookie`,
                        this.headerRequest.Cookie ? this.headerRequest.Cookie : null,
                        true,
                    );
                    return true;
                } else {
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
        const uri = `/config/status_status.${this.config.protocol}`;
        const port = await this.sendRequest("GET", uri, null);
        this.json_array = [];
        port && port.data && this.adapter.log.debug(`loadPortStatus: ${port.data}`);
        if (port != null && port.data && typeof port.data === "string" && port.data.indexOf("portConfigEntry") != -1) {
            const rand = port.data.match("secureRand = '(.*?)';");
            rand != null && rand[1] != null && this.adapter.log.debug(`loadPortStatus rand: ${rand[1]}`);
            port.data = port.data.replace(/\(/gi, "").replace(/\)/gi, "").replace(/\+/gi, "");
            let mtu = port.data.match("maxmtu' + i1, '(.*?)',");
            if (mtu != null && mtu[1] != null) {
                mtu = parseInt(mtu[1]);
            } else {
                mtu = 0;
            }
            this.adapter.log.debug(`loadPortStatus mtu: ${mtu}`);
            port.data = port.data.replace(/\[/gi, "").replace(/]/gi, "");
            for (let i = 0; i < 50; i++) {
                const data = port.data.match("portConfigEntry" + i + " = '(.*?)';");
                this.adapter.log.debug(`loadPortStatus mtu1: ${data}`);
                if (data != null && data[1] != null) {
                    this.adapter.log.debug(`loadPortStatus mtu: ${data[1]}`);
                    const infos = data[1].split("?");
                    if (infos.length > 0) {
                        infos.push(mtu);
                        const json = {
                            port: infos[0],
                            status: infos[1],
                            speed: infos[2],
                            speed_connection: infos[3],
                            flow: infos[4],
                            mtu: infos[5],
                            bytes_receiced: 0,
                            bytes_sent: 0,
                            bytes_crc: 0,
                        };
                        if (first) {
                            await this.adapter.createInfos(this.config, infos);
                        } else {
                            this.setStatesPort(infos);
                        }
                        this.json_array.push(json);
                    }
                } else {
                    break;
                }
            }
            return true;
        } else {
            this.adapter.log.warn(`Cannot read port infos!!`);
            return false;
        }
    }

    /**
     * @param {boolean | null | undefined} first
     */
    async loadMonStat(first) {
        const uri = `/config/monitoring_port_statistics.${this.config.protocol}`;
        const mon = await this.sendRequest("GET", uri, null);
        mon && mon.data && this.adapter.log.debug(`loadMonStat: ${mon.data}`);
        if (mon != null && mon.data && typeof mon.data === "string" && mon.data.indexOf("StatisticsEntry") != -1) {
            const rand = mon.data.match("secureRand = '(.*?)';");
            rand != null && rand[1] != null && this.adapter.log.debug(`loadMonStat rand: ${rand[1]}`);
            mon.data = mon.data.replace(/\[/gi, "").replace(/]/gi, "");
            for (let i = 0; i < 50; i++) {
                const data = mon.data.match("StatisticsEntry" + i + " = '(.*?)';");
                if (data != null && data[1] != null) {
                    const infos = data[1].split("?");
                    if (infos.length > 0) {
                        if (first) {
                            await this.adapter.createStati(this.config, infos);
                        } else {
                            this.setStatesStati(infos);
                        }
                        this.json_array[i].bytes_receiced = parseInt(infos[1]);
                        this.json_array[i].bytes_sent = parseInt(infos[2]);
                        this.json_array[i].bytes_crc = parseInt(infos[3]);
                    }
                } else {
                    break;
                }
            }
            this.adapter.setState(`${this.config.dp}.Ports.json`, JSON.stringify(this.json_array), true);
            return true;
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
