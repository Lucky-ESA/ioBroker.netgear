"use strict";

/*
 * Created with @iobroker/create-adapter v2.6.3
 */

const utils = require("@iobroker/adapter-core");
const netgear_htm = require("./lib/netgear_htm");
const netgear_cgi = require("./lib/netgear_cgi");
const helper = require("./lib/helper");

class Netgear extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: "netgear",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
        this.createDataPoint = helper.createDataPoint;
        this.createDevice = helper.createDevice;
        this.createInfos = helper.createInfos;
        this.createStati = helper.createStati;
        this.double_call = {};
        this.client = {};
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        this.setState("info.connection", false, true);
        const isChange = await this.configcheck();
        if (isChange) {
            this.log.info(`Encrypt Passwords and restart Adapter!`);
            return;
        }
        this.subscribeStates("*");
        let check_name = {};
        const config_array = this.config.icons;
        if (Object.keys(config_array).length > 0) {
            for (const jsons of config_array) {
                if (check_name[jsons.iconname]) {
                    this.log.error(`Duplicate icon name - ${jsons.iconname}!!!`);
                }
                check_name[jsons.iconname] = jsons.iconname;
            }
        }
        let devices = [];
        try {
            devices = typeof this.config.netgear === "object" ? JSON.parse(JSON.stringify(this.config.netgear)) : [];
        } catch (e) {
            devices = [];
        }
        check_name = {};
        if (devices && Object.keys(devices).length === 0) {
            this.log.info(`No Netgear Switch created!`);
            return;
        }
        for (const dev of devices) {
            if (dev.interval == null || dev.interval < 1) {
                dev.interval = 60;
            }
            if (dev.activ != null && !dev.activ) {
                this.log.info(`Netgear ${dev.ip} is disabled!`);
                continue;
            }
            if (dev.ip == "") {
                this.log.warn(`Missing Netgear IP!`);
                continue;
            }
            if (dev.password != "" && dev.password.includes("<LUCKY-ESA>")) {
                try {
                    const decrypt_pw = dev.password.split("<LUCKY-ESA>")[1];
                    if (decrypt_pw != "") {
                        dev.password = this.decrypt(decrypt_pw);
                    } else {
                        this.log.warn(`Cannot found password!`);
                        continue;
                    }
                } catch (e) {
                    this.log.warn(`Missing User Password!`);
                    continue;
                }
            } else if (dev.password == "") {
                this.log.warn(`Missing User Password!`);
                continue;
            }
            if (check_name[dev.ip]) {
                this.log.error(`Duplicate IP ${dev.ip} is not allowed!!!`);
                continue;
            }
            check_name[dev.ip] = true;
            dev.dp = this.forbidden_ip(dev.ip);
            this.client[dev.dp] = {};
            if (dev.protocol === "htm") {
                this.client[dev.dp].event = new netgear_htm(dev, this);
            } else {
                this.client[dev.dp].event = new netgear_cgi(dev, this);
            }
            this.client[dev.dp].event.login(true);
            this.client[dev.dp].config = dev;
        }
        this.setState("info.connection", true, true);
    }

    /**
     * @param {string} ip
     */
    forbidden_ip(ip) {
        return ip.replace(/[.]/gu, "_").replace(this.FORBIDDEN_CHARS, "_");
    }

    /**
     *
     */
    async configcheck() {
        try {
            let isdecode = false;
            const adapterconfigs = await this.getForeignObjectAsync(`system.adapter.${this.namespace}`);
            if (adapterconfigs && adapterconfigs.native && adapterconfigs.native.netgear) {
                for (const pw of adapterconfigs.native.netgear) {
                    if (pw.password != "" && !pw.password.includes("<LUCKY-ESA>")) {
                        pw.password = `<LUCKY-ESA>${this.encrypt(pw.password)}`;
                        isdecode = true;
                    }
                }
            }
            if (isdecode) {
                await this.extendForeignObjectAsync(`system.adapter.${this.namespace}`, {
                    native: adapterconfigs ? adapterconfigs.native : [],
                });
                //this.updateConfig(adapterconfigs);
                return true;
            }
            return false;
        } catch (error) {
            this.log.warn(`Cannot encrypt all passwords!!!`);
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            for (const id in this.client) {
                this.client[id].event.destroy();
            }
            callback();
        } catch (e) {
            callback();
        }
    }

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  * @param {string} id
    //  * @param {ioBroker.Object | null | undefined} obj
    //  */
    // onObjectChange(id, obj) {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state && !state.ack) {
            const id_ack = id;
            const lastsplit = id.split(".").pop();
            const netgear = id.split(".")[2];
            if (!this.client[netgear]) return;
            switch (lastsplit) {
                case "name":
                    this.client[netgear].event.changeName(state.val);
                    this.setAckFlag(id_ack, { val: "" });
                    break;
                case "reboot":
                    this.client[netgear].event.reboot();
                    this.setAckFlag(id_ack, { val: false });
                    break;
                case "update":
                    this.client[netgear].event.startUpdate();
                    this.setAckFlag(id_ack, { val: false });
                    break;
                case "cable_testing":
                    this.client[netgear].event.cableCheck(state.val);
                    this.setAckFlag(id_ack);
                    break;
                case "flow_change":
                    this.client[netgear].event.changeSpeed();
                    this.setAckFlag(id_ack, { val: false });
                    break;
                case "flow_select_speed":
                case "flow_select_port":
                case "flow_select_status":
                    this.setAckFlag(id_ack);
                    break;
                default:
                    // nothing
                    break;
            }
        }
    }

    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    /**
     * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
     * Using this method requires "common.messagebox" property to be set to true in io-package.json
     * @param {ioBroker.Message} obj
     */
    onMessage(obj) {
        if (this.double_call[obj._id] != null) {
            return;
        }
        this.double_call[obj._id] = true;
        let adapterconfigs = {};
        try {
            // @ts-ignore
            adapterconfigs = this.adapterConfig;
        } catch (error) {
            this.sendTo(obj.from, obj.command, [], obj.callback);
            delete this.double_call[obj._id];
            return;
        }
        if (obj.command === "getIconList") {
            try {
                let icon_array = [];
                const icons = [];
                if (obj && obj.message && obj.message.icon && obj.message.icon.icons) {
                    icon_array = obj.message.icon.icons;
                } else if (adapterconfigs && adapterconfigs.native && adapterconfigs.native.icons) {
                    icon_array = adapterconfigs.native.icons;
                }
                if (icon_array && Object.keys(icon_array).length > 0) {
                    for (const icon of icon_array) {
                        const label = icon.iconname;
                        icons.push({ label: label, value: icon.picture });
                    }
                    icons.sort((a, b) => (a.label > b.label ? 1 : b.label > a.label ? -1 : 0));
                    this.sendTo(obj.from, obj.command, icons, obj.callback);
                } else {
                    this.sendTo(obj.from, obj.command, [], obj.callback);
                }
            } catch (error) {
                delete this.double_call[obj._id];
                this.sendTo(obj.from, obj.command, [], obj.callback);
            }
            delete this.double_call[obj._id];
            return;
        }
    }

    /**
     * @param {string} id
     * @param {object} [value=null]
     */
    async setAckFlag(id, value) {
        try {
            if (id) {
                this.setState(id, {
                    ack: true,
                    ...value,
                });
            }
        } catch (e) {
            this.log.error(`setAckFlag: ${e}`);
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Netgear(options);
} else {
    // otherwise start the instance directly
    new Netgear();
}
