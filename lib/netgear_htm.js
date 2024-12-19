const EventEmitter = require("events");
const axios = require("axios");
const http = require("http");
const bitrate = {
    "No Limit": 1,
    "512 Kbit/s": 2,
    "1 Mbit/s": 3,
    "2 Mbit/s": 4,
    "4 Mbit/s": 5,
    "8 Mbit/s": 6,
    "16 Mbit/s": 7,
    "32 Mbit/s": 8,
    "64 Mbit/s": 9,
    "128 Mbit/s": 10,
    "256 Mbit/s": 11,
    "512 Mbit/s": 12,
    1: 4194305,
    2: 512,
    3: 1024,
    4: 2048,
    5: 4096,
    6: 8192,
    7: 16384,
    8: 32768,
    9: 65536,
    10: 131072,
    11: 262144,
    12: 524288,
};

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
        this.requestClient = axios.create({
            withCredentials: true,
            baseURL: `http://${config.ip}`,
            httpAgent: new http.Agent({ keepAlive: true }),
            timeout: 5000,
        });
        this.json_array = [];
        this.maxport = 0;
    }

    /**
     * @param {boolean} first
     */
    async login(first) {
        const uri = `/login.${this.config.protocol}`;
        const data = {
            data: `submitId=pwdLogin&password=${this.config.password}&submitEnd=`,
        };
        const resp = await this.sendRequest("POST", uri, data);
        if (resp && resp.headers && resp.headers["set-cookie"]) {
            this.adapter.log.debug(`login header: ${resp.headers}`);
            resp.data && this.adapter.log.debug(`login data: ${resp.data}`);
            this.headerRequest.Cookie = resp.headers["set-cookie"].toString().split(" ")[0];
            this.adapter.log.info(`Login ${this.config.dp} successful!`);
            const check = await this.loadSwitchInfo(first);
            if (check) {
                await this.loadPortStatus(first, null);
                await this.loadMonStat(first);
                await this.loadBitRate(first, null);
                this.startInterval();
            } else {
                this.adapter.log.warn(`Cannot read infos!! - ${this.config.ip}`);
            }
        } else {
            this.adapter.log.warn(`Login invalid! Wrong password! - ${this.config.ip}`);
            delete this.headerRequest.Cookie;
        }
    }

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

    async startUpdate() {
        const check = await this.loadSwitchInfo(false);
        if (check) {
            await this.loadPortStatus(false, null);
            await this.loadMonStat(false);
            await this.loadBitRate(false, null);
        } else {
            this.adapter.log.debug(`Start refresh cookie - ${this.config.ip}`);
            delete this.headerRequest.Cookie;
            this.login(false);
        }
    }

    startInterval() {
        if (this.updateInterval) {
            return;
        }
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
     * @param {boolean | null | undefined} first
     */
    async loadSwitchInfo(first) {
        const uri = `/config/status_switch_info.${this.config.protocol}`;
        const info = await this.sendRequest("GET", uri, null);
        if (info && info.data) {
            this.adapter.log.debug(`loadSwitchInfo: ${info.data}`);
            const rand = info.data.match("secureRand = '(.*?)';");
            const data = info.data.match("sysInfo = '(.*?)';");
            rand != null &&
                rand[1] != null &&
                this.adapter.log.debug(`loadSwitchInfo rand: ${rand[1]} - ${this.config.ip}`);
            if (data != null && data[1] != null) {
                this.adapter.log.debug(`loadSwitchInfo data: ${data[1]}`);
                const infos = data[1].split("?");
                if (infos.length > 0) {
                    if (first) {
                        await this.adapter.createDevice(this.config, infos);
                    } else {
                        this.setStatesInfo(infos);
                    }
                    await this.adapter.setState(`${this.config.dp}.System.online`, { val: true, ack: true });
                    await this.adapter.setState(`${this.config.dp}.System.cookie`, {
                        val: this.headerRequest.Cookie ? this.headerRequest.Cookie : null,
                        ack: true,
                    });
                    return true;
                }
                return false;
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
            const uri = `/config/status_status.${this.config.protocol}`;
            port = await this.sendRequest("GET", uri, null);
        } else {
            port = value_status;
        }
        this.json_array = [];
        const states_port = {};
        states_port["0"] = "";
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
                const data = port.data.match(`portConfigEntry${i} = '(.*?)';`);
                this.adapter.log.debug(`loadPortStatus mtu1: ${data}`);
                if (data != null && data[1] != null) {
                    this.adapter.log.debug(`loadPortStatus mtu: ${data[1]}`);
                    const infos = data[1].split("?");
                    if (infos.length > 0) {
                        infos.push(mtu);
                        states_port[infos[0]] = `Port ${infos[0]}`;
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
                            bit_rate_input: 0,
                            bit_rate_output: 0,
                        };
                        if (first) {
                            await this.adapter.createInfos(this.config, infos);
                            ++this.maxport;
                        } else {
                            this.setStatesPort(infos);
                        }
                        if (value_status) {
                            this.json_array[i].port = infos[0];
                            this.json_array[i].status = infos[1];
                            this.json_array[i].speed = infos[2];
                            this.json_array[i].speed_connection = infos[3];
                            this.json_array[i].flow = infos[4];
                            this.json_array[i].mtu = infos[5];
                        } else {
                            this.json_array.push(json);
                        }
                    }
                } else {
                    break;
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
                this.adapter.setState(`${this.config.dp}.Ports.json`, {
                    val: JSON.stringify(this.json_array),
                    ack: true,
                });
            }
            return true;
        }
        this.adapter.log.warn(`Cannot read port infos!! - ${this.config.ip}`);
        return false;
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
            rand != null &&
                rand[1] != null &&
                this.adapter.log.debug(`loadMonStat rand: ${rand[1]} - ${this.config.ip}`);
            mon.data = mon.data.replace(/\[/gi, "").replace(/]/gi, "");
            for (let i = 0; i < 50; i++) {
                const data = mon.data.match(`StatisticsEntry${i} = '(.*?)';`);
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
            return true;
        }
        if (mon && mon.data) {
            this.adapter.log.warn(`loadMonStat no data: ${mon.data} - ${this.config.ip}`);
        } else {
            this.adapter.log.warn(`loadMonStat no data: ${JSON.stringify(mon)} - ${this.config.ip}`);
        }
        return false;
    }

    /**
     * @param {boolean | null | undefined} first
     * @param {object | null | undefined} value_status
     */
    async loadBitRate(first, value_status) {
        let rate;
        if (!value_status || !value_status.data) {
            const uri = `/config/ratelimit_rate_limit.${this.config.protocol}`;
            rate = await this.sendRequest("GET", uri, null);
        } else {
            rate = value_status;
        }
        rate && rate.data && this.adapter.log.debug(`loadBitRate: ${rate.data}`);
        if (rate != null && rate.data && typeof rate.data === "string" && rate.data.indexOf("portRateEntry") != -1) {
            const rand = rate.data.match("secureRand = '(.*?)';");
            rand != null &&
                rand[1] != null &&
                this.adapter.log.debug(`loadBitRate rand: ${rand[1]} - ${this.config.ip}`);
            rate.data = rate.data.replace(/\[/gi, "").replace(/]/gi, "");
            for (let i = 0; i < 50; i++) {
                const state = [];
                const data = rate.data.match(`portRateEntry${i} = '(.*?)';`);
                if (data != null && data[1] != null) {
                    const infos = data[1].split("?");
                    if (infos.length > 0) {
                        state.push(infos[0]);
                        state.push(bitrate[infos[1]] ? bitrate[infos[1]] : 1);
                        state.push(bitrate[infos[2]] ? bitrate[infos[2]] : 1);
                        if (first) {
                            await this.adapter.createRate(this.config, state);
                        } else {
                            this.setStatesRate(state);
                        }
                        this.json_array[i].bit_rate_input = infos[1];
                        this.json_array[i].bit_rate_output = infos[2];
                    }
                } else {
                    break;
                }
            }
            this.adapter.setState(`${this.config.dp}.Ports.json`, { val: JSON.stringify(this.json_array), ack: true });
            return true;
        }
        if (rate && rate.data) {
            this.adapter.log.warn(`loadBitRate no data: ${rate.data} - ${this.config.ip}`);
        } else {
            this.adapter.log.warn(`loadBitRate no data: ${JSON.stringify(rate)} - ${this.config.ip}`);
        }
        return false;
    }

    /**
     * @param {string} name
     */
    async changeName(name) {
        //await this.loginCheck();
        const uri = `/config/status_switch_info.${this.config.protocol}`;
        const info = await this.sendRequest("GET", uri, null);
        info && info.data && this.adapter.log.debug(`info: ${info.data}`);
        if (info && info.data) {
            const rand = info.data.match("secureRand = '(.*?)';");
            const data = info.data.match("sysInfo = '(.*?)';");
            if (data != null && data[1] != null && rand != null && rand[1] != null) {
                const infos = data[1].split("?");
                if (infos.length > 0) {
                    const dhcp = infos[4] === "Enable" ? 2 : 1;
                    const val = {
                        data:
                            `submitId=sysIp` +
                            `&secureRand=${rand[1]}&swName=${name}&dhcp=${dhcp}&ip=${infos[5]}&subnet=${
                                infos[6]
                            }&gateway=${infos[7]}&submitEnd=`,
                    };
                    const change = await this.sendRequest("POST", uri, val);
                    if (
                        change != null &&
                        change.data &&
                        typeof change.data === "string" &&
                        change.data.indexOf("location.href") != -1
                    ) {
                        const new_uri = change.data.match("href='(.*?)'");
                        if (new_uri != null && new_uri[1] != null) {
                            const uri2 = `/config/${new_uri[1]}`;
                            const load_info = await this.sendRequest("GET", uri2, null);
                            load_info && this.adapter.log.debug(load_info.data);
                            const sys = load_info.match("sysInfo = '(.*?)';");
                            if (sys != null && sys[1] != null) {
                                this.adapter.log.debug(`loadSwitchInfo data: ${sys[1]} - ${this.config.ip}`);
                                const sys_info = sys[1].split("?");
                                if (sys_info.length > 0) {
                                    this.setStatesInfo(sys_info);
                                } else {
                                    this.adapter.log.warn(`Missing system info for ${this.config.ip}`);
                                }
                            } else {
                                this.adapter.log.warn(`Cannot found system info for ${this.config.ip}`);
                            }
                        } else {
                            this.adapter.log.warn(`Missing uri for ${this.config.ip}`);
                        }
                    } else {
                        this.adapter.log.warn(`Request invalid for ${name} - ${this.config.ip}`);
                    }
                } else {
                    this.adapter.log.warn(`changeName no value: ${data[1]} - ${this.config.ip}`);
                    this.adapter.log.warn(`changeName no secure: ${rand} - ${this.config.ip}`);
                }
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
        const uri = `/config/monitoring_cable_tester.${this.config.protocol}`;
        const info = await this.sendRequest("GET", uri, null);
        info && info.data && this.adapter.log.debug(`info: ${info.data}`);
        if (info && info.data) {
            const rand = info.data.match("secureRand = '(.*?)';");
            this.adapter.log.debug(`secureRand: ${rand}`);
            if (rand != null && rand[1] != null) {
                let request_string = `submitId=cableTest&secureRand=${rand[1]}`;
                if (typeof cables === "string") {
                    cables = JSON.parse(cables);
                }
                if (cables != null && Array.isArray(cables) && cables.length > 0) {
                    for (const ca of cables) {
                        if (ca > 0 && (ca < this.maxport || ca == this.maxport)) {
                            request_string += `&port=${ca}`;
                        } else {
                            this.adapter.log.warn(`Port ${ca} is to high!`);
                        }
                    }
                    request_string += "&submitEnd=";
                    this.adapter.log.debug(`sent: ${request_string}`);
                    const sent = {
                        data: request_string,
                    };
                    const change = await this.sendRequest("POST", uri, sent);
                    if (
                        change != null &&
                        change.data &&
                        typeof change.data === "string" &&
                        change.data.indexOf("location.href") != -1
                    ) {
                        const new_uri = change.data.match("href='(.*?)'");
                        if (new_uri != null && new_uri[1] != null) {
                            const uri2 = `/config/${new_uri[1]}`;
                            const load_info = await this.sendRequest("GET", uri2, null);
                            load_info && this.adapter.log.debug(load_info.data);
                            if (
                                load_info != null &&
                                load_info.data &&
                                typeof load_info.data === "string" &&
                                load_info.data.indexOf("TesterEntry") != -1
                            ) {
                                const resp = [];
                                load_info.data = load_info.data.replace(/\[/gi, "").replace(/]/gi, "");
                                for (const ca of cables) {
                                    const port = load_info.data.match(`TesterEntry${(ca - 1).toString()}='(.*?)';`);
                                    if (port != null && port[1] != null) {
                                        const status = port[1].split("?");
                                        const val = {
                                            port: status[0],
                                            status: status[1],
                                        };
                                        resp.push(val);
                                    }
                                }
                                this.adapter.setState(`${this.config.dp}.Remote.cable_testing_result`, {
                                    val: JSON.stringify(resp),
                                    ack: true,
                                });
                            } else {
                                this.adapter.log.warn(`Response incorrect`);
                            }
                        } else {
                            this.adapter.log.warn(`Missing uri for ${this.config.ip}`);
                        }
                    } else {
                        this.adapter.log.warn(`Request invalid for ${this.config.ip}`);
                    }
                } else {
                    this.adapter.log.warn(`Cannot read cable value: ${cables} - ${this.config.ip}`);
                }
            } else {
                this.adapter.log.warn(`Missing secure key: ${info.data} - ${this.config.ip}`);
            }
        } else {
            this.adapter.log.warn(`changeName no data: ${info} - ${this.config.ip}`);
        }
    }

    async reboot() {
        //await this.loginCheck();
        const uri = `/config/maintenance_device_reboot.${this.config.protocol}`;
        const info = await this.sendRequest("GET", uri, null);
        info && info.data && this.adapter.log.debug(`info: ${info.data}`);
        this.adapter.log.info(`info: ${info.data}`);
        if (info && info.data) {
            const rand = info.data.match("secureRand = '(.*?)';");
            this.adapter.log.debug(`secureRand: ${rand}`);
            if (rand != null && rand[1] != null) {
                const request_string = `submitId=sysReset&secureRand=${rand[1]}&reboot=1&submitEnd=`;
                this.adapter.log.debug(`sent: ${request_string}`);
                const sent = {
                    data: request_string,
                };
                await this.sendRequest("POST", uri, sent);
                this.adapter.log.info(`Relogin in 15 sekundes!`);
                this.newLoginTimer = this.adapter.setTimeout(() => {
                    this.login(false);
                }, 15 * 1000);
            } else {
                this.adapter.log.warn(`Missing secure key: ${info} - ${this.config.ip}`);
            }
        } else {
            this.adapter.log.warn(`changeName no data: ${info} - ${this.config.ip}`);
        }
    }

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
        const uri = `/config/status_status.${this.config.protocol}`;
        const ports = await this.sendRequest("GET", uri, null);
        ports && ports.data && this.adapter.log.debug(`changeSpeed: ${ports.data}`);
        if (
            ports != null &&
            ports.data &&
            typeof ports.data === "string" &&
            ports.data.indexOf("portConfigEntry") != -1
        ) {
            const rand = ports.data.match("secureRand = '(.*?)';");
            this.adapter.log.debug(`secureRand: ${rand}`);
            if (rand != null && rand[1] != null) {
                let request_string = `submitId=sysStatus&secureRand=${rand[1]}`;
                request_string += `&speed=${speed.val}`;
                request_string += `&flow=${status.val}`;
                request_string += `&port=${port.val}`;
                request_string += `&submitEnd=`;
                this.adapter.log.debug(`sent: ${request_string}`);
                const sent = {
                    data: request_string,
                };
                const change = await this.sendRequest("POST", uri, sent);
                change && this.adapter.log.debug(change.data);
                this.loadPortStatus(false, change);
            } else {
                this.adapter.log.warn(`Missing secure key: ${ports.data} - ${this.config.ip}`);
            }
        } else {
            this.adapter.log.warn(`Cannot read port infos!! - ${this.config.ip}`);
            return false;
        }
    }

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
        const uri = `/config/ratelimit_rate_limit.${this.config.protocol}`;
        const rate = await this.sendRequest("GET", uri, null);
        rate && rate.data && this.adapter.log.debug(`changeRate: ${rate.data}`);
        if (rate != null && rate.data && typeof rate.data === "string") {
            const rand = rate.data.match("secureRand = '(.*?)';");
            this.adapter.log.debug(`secureRand: ${rand}`);
            if (rand != null && rand[1] != null) {
                const irate = bitrate[input.val] ? bitrate[input.val] : 0;
                const erate = bitrate[output.val] ? bitrate[output.val] : 0;
                let request_string = `submitId=rateLimitCfg&secureRand=${rand[1]}`;
                request_string += `&iRate=${bitrate[irate]}`;
                request_string += `&eRate=${erate}`;
                request_string += `&port=${port.val}`;
                request_string += `&submitEnd=`;
                if (erate === 0 || irate === 0) {
                    this.adapter.log.warn(`Missing infos: ${input.val} - ${output.val}`);
                    return false;
                }
                this.adapter.log.debug(`sent: ${request_string}`);
                const sent = {
                    data: request_string,
                };
                const change = await this.sendRequest("POST", uri, sent);
                change && this.adapter.log.debug(change.data);
                this.loadBitRate(false, change);
            } else {
                this.adapter.log.warn(`Missing secure key: ${rate.data} - ${this.config.ip}`);
            }
        } else {
            this.adapter.log.warn(`Cannot read rate infos!! - ${this.config.ip}`);
            return false;
        }
    }

    async loginCheck() {
        const uri = `/config/status_status.${this.config.protocol}`;
        const port = await this.sendRequest("GET", uri, null);
        port && port.data && this.adapter.log.debug(`loginCheck: ${port.data}`);
        if (port != null && port.data && typeof port.data === "string" && port.data.indexOf("portConfigEntry") != -1) {
            return true;
        }
        //await this.login(false);
        return true;
    }

    destroy() {
        this.adapter.setState(`${this.config.dp}.System.online`, { val: false, ack: true });
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
        const dp = `${this.config.dp}.System`;
        await this.adapter.setState(`${dp}.firmware`, { val: infos[3], ack: true });
        await this.adapter.setState(`${dp}.productname`, { val: infos[0], ack: true });
        await this.adapter.setState(`${dp}.name`, { val: infos[1], ack: true });
        await this.adapter.setState(`${dp}.serialnumber`, { val: infos[8], ack: true });
        await this.adapter.setState(`${dp}.mac`, { val: infos[2], ack: true });
        await this.adapter.setState(`${dp}.ip`, { val: infos[5], ack: true });
        await this.adapter.setState(`${dp}.lastupdate`, { val: Date.now(), ack: true });
    }

    /**
     * @param {object} infos
     */
    async setStatesPort(infos) {
        const dp = `${this.config.dp}.Ports.Port_${`0${infos[0]}`.slice(-2)}`;
        await this.adapter.setState(`${dp}.mtu`, { val: infos[5], ack: true });
        await this.adapter.setState(`${dp}.flow`, { val: infos[4], ack: true });
        await this.adapter.setState(`${dp}.speed_connection`, { val: infos[3], ack: true });
        await this.adapter.setState(`${dp}.speed`, { val: infos[2], ack: true });
        await this.adapter.setState(`${dp}.status`, { val: infos[1], ack: true });
    }

    /**
     * @param {object} infos
     */
    async setStatesStati(infos) {
        const dp = `${this.config.dp}.Ports.Port_${`0${infos[0]}`.slice(-2)}`;
        if (dp) {
            await this.adapter.setState(`${dp}.bytes_receiced`, { val: parseInt(infos[1]), ack: true });
            await this.adapter.setState(`${dp}.bytes_sent`, { val: parseInt(infos[2]), ack: true });
            await this.adapter.setState(`${dp}.bytes_crc`, { val: parseInt(infos[3]), ack: true });
        }
    }

    /**
     * @param {object} infos
     */
    async setStatesRate(infos) {
        const dp = `${this.config.dp}.Ports.Port_${`0${infos[0]}`.slice(-2)}`;
        await this.adapter.setState(`${dp}.bit_rate_input`, { val: parseInt(infos[1]), ack: true });
        await this.adapter.setState(`${dp}.bit_rate_output`, { val: parseInt(infos[2]), ack: true });
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
            .then(async res => {
                this.adapter.log.debug(res.headers);
                return res;
            })
            .catch(error => {
                return error;
            });
    }

    /**
     * @param {string} methode
     * @param {string} url
     */
    async own_Request(methode, url) {
        let data;
        if (methode === "POST") {
            const val = await this.adapter.getStateAsync(`${this.config.dp}.Remote.request_post_data`);
            data = {
                data: val != null && val.val != null ? val.val : null,
            };
        }
        const resp = await this.requestClient({
            method: methode,
            url: url,
            headers: this.headerRequest,
            ...data,
        })
            .then(async res => {
                const value = {
                    header: res.headers,
                    data: res.data,
                    statusText: res.statusText,
                    status: res.status,
                };
                return value;
            })
            .catch(error => {
                return error;
            });
        await this.adapter.setState(`${this.config.dp}.Remote.request_response`, {
            val: JSON.stringify(resp),
            ack: true,
        });
    }
}

module.exports = NeatGear;
