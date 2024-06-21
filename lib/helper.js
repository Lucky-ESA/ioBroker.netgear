module.exports = {
    /**
     * @param {object} id
     * @param {object} first
     */
    async createDevice(id, first) {
        let common = {};
        let icons;
        if (id.picture != null && id.picture != "") {
            icons = { icon: id.picture };
        }
        common = {
            name: id.ip_name,
            desc: id.ip_name,
            ...icons,
            statusStates: {
                onlineId: `${this.namespace}.${id.dp}.System.online`,
            },
        };
        await this.createDataPoint(id.dp, common, "device", null);
        common = {
            name: {
                en: "System",
                de: "System",
                ru: "Система",
                pt: "Sistema",
                nl: "Systeem",
                fr: "Système",
                it: "Sistema",
                es: "Sistema",
                pl: "System",
                uk: "Система",
                "zh-cn": "系统",
            },
            desc: "System",
            icon: "img/system.png",
        };
        await this.createDataPoint(`${id.dp}.System`, common, "folder", null);
        common = {
            name: {
                en: "Remote control",
                de: "Fernbedienung",
                ru: "Удаленный контроль",
                pt: "Controle remoto",
                nl: "Afstandsbediening",
                fr: "Télécommande",
                it: "Controllo remoto",
                es: "Control remoto",
                pl: "Zdalne sterowanie",
                uk: "Пульт дистанційного керування",
                "zh-cn": "遥控",
            },
            desc: "Remote control",
            icon: "img/remote.png",
        };
        await this.createDataPoint(`${id.dp}.Remote`, common, "folder", null);
        common = {
            name: {
                en: "Info statistics",
                de: "Infostatistik",
                ru: "Статистика информации",
                pt: "Estatísticas de informação",
                nl: "Informatiestatistieken",
                fr: "Info statistiques",
                it: "Statistiche dell'informazione",
                es: "Datos estadísticos",
                pl: "Statystyki informacyjne",
                uk: "Статистика новин",
                "zh-cn": "信息统计",
            },
            desc: "Info statistics",
            icon: "img/ports.png",
        };
        await this.createDataPoint(`${id.dp}.Ports`, common, "folder", null);
        if (first.length > 9) {
            common = {
                name: {
                    en: "Bootloader-Version",
                    de: "Bootloader-Version",
                    ru: "Bootloader-Version",
                    pt: "Bootloader-Version",
                    nl: "Bootloader-versie",
                    fr: "Bootloader-Version",
                    it: "Bootloader-Versione",
                    es: "Bootloader-Version",
                    pl: "Bootloader- Wersja",
                    uk: "Завантажувач-Version",
                    "zh-cn": "装弹机 - Version",
                },
                type: "string",
                role: "info.firmware",
                desc: "Bootloader-Version",
                read: true,
                write: false,
                def: "",
            };
            await this.createDataPoint(`${id.dp}.System.bootloader`, common, "state", first[9]);
        }
        common = {
            name: {
                en: "JSON",
                de: "JSON",
                ru: "JSON",
                pt: "JSON",
                nl: "JSON",
                fr: "JSON",
                it: "JSON",
                es: "JSON",
                pl: "JSON",
                uk: "СОНЦЕ",
                "zh-cn": "贾森",
            },
            type: "string",
            role: "json",
            desc: "state",
            read: true,
            write: false,
            def: "",
        };
        await this.createDataPoint(`${id.dp}.Ports.json`, common, "state", null);
        common = {
            name: {
                en: "Online",
                de: "Online",
                ru: "Онлайн",
                pt: "Online",
                nl: "Online",
                fr: "En ligne",
                it: "Online",
                es: "Online",
                pl: "Online",
                uk: "Інтернет",
                "zh-cn": "在线",
            },
            type: "boolean",
            role: "info.status",
            desc: "Online",
            read: true,
            write: false,
            def: false,
        };
        await this.createDataPoint(`${id.dp}.System.online`, common, "state", null);
        common = {
            name: {
                en: "Firmware",
                de: "Firmware",
                ru: "Фирма",
                pt: "Firmware",
                nl: "Firmware",
                fr: "Firmware",
                it: "Firmware",
                es: "Firmware",
                pl: "Oprogramowanie",
                uk: "Прошивка",
                "zh-cn": "固件",
            },
            type: "string",
            role: "info.firmware",
            desc: "Firmware",
            read: true,
            write: false,
            def: "",
        };
        await this.createDataPoint(`${id.dp}.System.firmware`, common, "state", first[3]);
        common = {
            name: {
                en: "Product name",
                de: "Produktname",
                ru: "Название продукта",
                pt: "Nome do produto",
                nl: "Productnaam",
                fr: "Nom du produit",
                it: "Nome del prodotto",
                es: "Nombre del producto",
                pl: "Nazwa produktu",
                uk: "Назва продукту",
                "zh-cn": "产品名称",
            },
            type: "string",
            role: "info.name",
            desc: "Product name",
            read: true,
            write: false,
            def: "",
        };
        await this.createDataPoint(`${id.dp}.System.productname`, common, "state", first[0]);
        common = {
            name: {
                en: "Name",
                de: "Name",
                ru: "Имя",
                pt: "Nome",
                nl: "Naam",
                fr: "Dénomination",
                it: "Nome",
                es: "Nombre",
                pl: "Nazwa",
                uk: "Ім'я",
                "zh-cn": "名称",
            },
            type: "string",
            role: "info.name",
            desc: "Name",
            read: true,
            write: false,
            def: "",
        };
        await this.createDataPoint(`${id.dp}.System.name`, common, "state", first[1]);
        common = {
            name: {
                en: "Serial number",
                de: "Seriennummer",
                ru: "Серийный номер",
                pt: "Número de série",
                nl: "Volgnummer",
                fr: "Numéro de série",
                it: "Numero di serie",
                es: "Número de serie",
                pl: "Numer seryjny",
                uk: "Серійний номер",
                "zh-cn": "序列号",
            },
            type: "string",
            role: "info.serial",
            desc: "Serial number",
            read: true,
            write: false,
            def: "",
        };
        await this.createDataPoint(`${id.dp}.System.serialnumber`, common, "state", first[8]);
        common = {
            name: {
                en: "MAC",
                de: "MAC",
                ru: "MAC",
                pt: "MAC",
                nl: "MAC",
                fr: "MAC",
                it: "MAC",
                es: "MAC",
                pl: "MAC",
                uk: "МАПА",
                "zh-cn": "邮件",
            },
            type: "string",
            role: "info.mac",
            desc: "MAC",
            read: true,
            write: false,
            def: "",
        };
        await this.createDataPoint(`${id.dp}.System.mac`, common, "state", first[2]);
        common = {
            name: {
                en: "IP",
                de: "IP",
                ru: "IP",
                pt: "IP",
                nl: "IP",
                fr: "IP",
                it: "IP",
                es: "IP",
                pl: "IP",
                uk: "ІМ'Я",
                "zh-cn": "执行伙伴",
            },
            type: "string",
            role: "info.ip",
            desc: "IP",
            read: true,
            write: false,
            def: "",
        };
        await this.createDataPoint(`${id.dp}.System.ip`, common, "state", first[5]);
        common = {
            name: {
                en: "Cookie",
                de: "Cookies",
                ru: "Cookie",
                pt: "Cookie",
                nl: "Cookie",
                fr: "Cookie",
                it: "Cookie",
                es: "Cookie",
                pl: "Cookie",
                uk: "Пиріг",
                "zh-cn": "饼干",
            },
            type: "string",
            role: "info",
            desc: "IP",
            read: true,
            write: false,
            def: "",
        };
        await this.createDataPoint(`${id.dp}.System.cookie`, common, "state", null);
        common = {
            name: {
                en: "Last update",
                de: "Letzte Aktualisierung",
                ru: "Последнее обновление",
                pt: "Última atualização",
                nl: "Laatste update",
                fr: "Dernière mise à jour",
                it: "Ultimo aggiornamento",
                es: "Última actualización",
                pl: "Ostatnia aktualizacja",
                uk: "Останнє оновлення",
                "zh-cn": "上次更新",
            },
            type: "number",
            role: "value.time",
            desc: "Last update",
            read: true,
            write: false,
            def: 0,
        };
        await this.createDataPoint(`${id.dp}.System.lastupdate`, common, "state", Date.now());
        common = {
            name: {
                en: "Reboot",
                de: "Neustart",
                ru: "Reboot",
                pt: "Reiniciar",
                nl: "Herstarten",
                fr: "Redémarrer",
                it: "Reboot",
                es: "Reboot",
                pl: "Restart",
                uk: "Перезавантаження",
                "zh-cn": "重新启动",
            },
            type: "boolean",
            role: "buttom",
            desc: "Reboot",
            read: true,
            write: true,
            def: false,
        };
        await this.createDataPoint(`${id.dp}.Remote.reboot`, common, "state", false);
        common = {
            name: {
                en: "Update data",
                de: "Daten aktualisieren",
                ru: "Данные обновления",
                pt: "Atualizar dados",
                nl: "Gegevens bijwerken",
                fr: "Mettre à jour les données",
                it: "Aggiornare i dati",
                es: "Datos de actualización",
                pl: "Aktualizacja danych",
                uk: "Оновлення даних",
                "zh-cn": "更新数据",
            },
            type: "boolean",
            role: "buttom",
            desc: "Reboot",
            read: true,
            write: true,
            def: false,
        };
        await this.createDataPoint(`${id.dp}.Remote.update`, common, "state", false);
        common = {
            name: {
                en: "Change name",
                de: "Name ändern",
                ru: "Изменить имя",
                pt: "Nome da mudança",
                nl: "Naam wijzigen",
                fr: "Modifier le nom",
                it: "Cambia nome",
                es: "Cambiar nombre",
                pl: "Zmień nazwę",
                uk: "Ім'я користувача",
                "zh-cn": "更改名称",
            },
            type: "string",
            role: "state",
            desc: "Change name",
            read: true,
            write: true,
            def: "",
        };
        await this.createDataPoint(`${id.dp}.Remote.name`, common, "state", "");
    },
    /**
     * @param {object} id
     * @param {object} first
     */
    async createStati(id, first) {
        let common = {};
        common = {
            name: {
                en: "Bytes received",
                de: "Empfangene Bytes",
                ru: "Полученные байты",
                pt: "Bytes recebidos",
                nl: "Ontvangen bytes",
                fr: "Bytes reçus",
                it: "Bytes ricevuto",
                es: "Bytes received",
                pl: "Otrzymane bajty",
                uk: "Надійшла",
                "zh-cn": "收到字节",
            },
            type: "number",
            role: "info",
            desc: "Bytes received",
            read: true,
            write: false,
            def: 0,
        };
        await this.createDataPoint(
            `${id.dp}.Ports.Port_${("0" + first[0]).slice(-2)}.bytes_receiced`,
            common,
            "state",
            typeof first[1] != "number" ? parseInt(first[1]) : first[1],
        );
        common = {
            name: {
                en: "Bytes sent",
                de: "Bytes gesendet",
                ru: "Байты",
                pt: "Bytes enviados",
                nl: "Verzonden bytes",
                fr: "Bytes envoyés",
                it: "Bytes inviato",
                es: "Bytes sent",
                pl: "Przesłane bajty",
                uk: "Відправлено",
                "zh-cn": "发送字节",
            },
            type: "number",
            role: "info",
            desc: "Bytes sent",
            read: true,
            write: false,
            def: 0,
        };
        await this.createDataPoint(
            `${id.dp}.Ports.Port_${("0" + first[0]).slice(-2)}.bytes_sent`,
            common,
            "state",
            typeof first[2] != "number" ? parseInt(first[2]) : first[2],
        );
        common = {
            name: {
                en: "CRC error packets",
                de: "CRC-Fehlerpakete",
                ru: "Пакеты ошибок CRC",
                pt: "Pacotes de erro CRC",
                nl: "CRC-foutpakketten",
                fr: "Paquets d'erreur CRC",
                it: "Pacchetti di errore CRC",
                es: "Paquetes de error de CRC",
                pl: "Pakiety błędów CRC",
                uk: "Пакети помилок CRC",
                "zh-cn": "CRC 错误包",
            },
            type: "number",
            role: "info",
            desc: "CRC error packets",
            read: true,
            write: false,
            def: 0,
        };
        await this.createDataPoint(
            `${id.dp}.Ports.Port_${("0" + first[0]).slice(-2)}.bytes_crc`,
            common,
            "state",
            typeof first[3] != "number" ? parseInt(first[3]) : first[3],
        );
    },
    /**
     * @param {object} id
     * @param {object} first
     */
    async createInfos(id, first) {
        let common = {};
        common = {
            name: {
                en: "Ethernet port statistics",
                de: "Statistik des Ethernet-Ports",
                ru: "Статистика портов Ethernet",
                pt: "Estatísticas da porta Ethernet",
                nl: "Ethernet-havenstatistieken",
                fr: "Statistiques des ports Ethernet",
                it: "Statistiche della porta Ethernet",
                es: "Estadísticas del puerto Ethernet",
                pl: "Statystyki portów Ethernet",
                uk: "Статистика портів Ethernet",
                "zh-cn": "以太网端口统计",
            },
            desc: "Ethernet port statistics",
            icon: "img/port.png",
        };
        await this.createDataPoint(`${id.dp}.Ports.Port_${("0" + first[0]).slice(-2)}`, common, "folder", null);
        common = {
            name: {
                en: "Status",
                de: "Status",
                ru: "Статус",
                pt: "Estado",
                nl: "Status",
                fr: "État",
                it: "Stato",
                es: "Situación",
                pl: "Status",
                uk: "Статус на сервери",
                "zh-cn": "状态",
            },
            type: "string",
            role: "info.status",
            desc: "Status",
            read: true,
            write: false,
            def: "",
        };
        await this.createDataPoint(
            `${id.dp}.Ports.Port_${("0" + first[0]).slice(-2)}.status`,
            common,
            "state",
            first[1],
        );
        common = {
            name: {
                en: "Speed",
                de: "Geschwindigkeit",
                ru: "Скорость",
                pt: "Velocidade",
                nl: "Snelheid",
                fr: "Vitesse",
                it: "Velocità",
                es: "Speed",
                pl: "Prędkość",
                uk: "Швидкість",
                "zh-cn": "速度",
            },
            type: "string",
            role: "info",
            desc: "Speed",
            read: true,
            write: false,
            def: "",
        };
        await this.createDataPoint(
            `${id.dp}.Ports.Port_${("0" + first[0]).slice(-2)}.speed`,
            common,
            "state",
            first[2],
        );
        common = {
            name: {
                en: "Connection speed",
                de: "Anschlussgeschwindigkeit",
                ru: "Скорость подключения",
                pt: "Velocidade de conexão",
                nl: "Verbindingssnelheid",
                fr: "Vitesse de connexion",
                it: "Velocità di connessione",
                es: "Velocidad de conexión",
                pl: "Prędkość połączenia",
                uk: "Швидкість підключення",
                "zh-cn": "连接速度",
            },
            type: "string",
            role: "info",
            desc: "Connection speed",
            read: true,
            write: false,
            def: "",
        };
        await this.createDataPoint(
            `${id.dp}.Ports.Port_${("0" + first[0]).slice(-2)}.speed_connection`,
            common,
            "state",
            first[3],
        );
        common = {
            name: {
                en: "Data flow control",
                de: "Datenflusskontrolle",
                ru: "Контроль потока данных",
                pt: "Controle de fluxo de dados",
                nl: "Gegevensstroomregeling",
                fr: "Contrôle du flux de données",
                it: "Controllo del flusso dati",
                es: "Control de flujo de datos",
                pl: "Kontrola przepływu danych",
                uk: "Контроль потоку даних",
                "zh-cn": "数据流控制",
            },
            type: "string",
            role: "info",
            desc: "Data flow control",
            read: true,
            write: false,
            def: "",
        };
        await this.createDataPoint(`${id.dp}.Ports.Port_${("0" + first[0]).slice(-2)}.flow`, common, "state", first[4]);
        common = {
            name: {
                en: "Max MTU",
                de: "Max MTU",
                ru: "Max MTU",
                pt: "Max MTU",
                nl: "Max MTU",
                fr: "Max MTU",
                it: "MTU massima",
                es: "Max MTU",
                pl: "Max MTU",
                uk: "Макс МТУ",
                "zh-cn": "马克斯MTU",
            },
            type: "number",
            role: "info",
            desc: "Max MTU",
            read: true,
            write: false,
            def: 0,
        };
        await this.createDataPoint(`${id.dp}.Ports.Port_${("0" + first[0]).slice(-2)}.mtu`, common, "state", first[5]);
    },
    /**
     * @param {string} ident
     * @param {object} common
     * @param {string} types
     * @param {string|number|boolean|null|undefined} types
     * @param {object|null|undefined} [native=null]
     */
    async createDataPoint(ident, common, types, value, native) {
        const nativvalue = !native ? { native: {} } : { native: native };
        const obj = await this.getObjectAsync(ident);
        if (!obj) {
            await this.setObjectNotExistsAsync(ident, {
                type: types,
                common: common,
                ...nativvalue,
            }).catch((error) => {
                this.log.warn(`createDataPoint: ${error}`);
            });
        } else {
            let ischange = false;
            if (obj.common && Object.keys(obj.common).length == Object.keys(common).length) {
                for (const key in common) {
                    if (obj.common[key] == null) {
                        ischange = true;
                        break;
                    } else if (JSON.stringify(obj.common[key]) != JSON.stringify(common[key])) {
                        ischange = true;
                        break;
                    }
                }
            } else {
                ischange = true;
            }
            if (JSON.stringify(obj.type) != JSON.stringify(types)) {
                ischange = true;
            }
            if (native) {
                if (Object.keys(obj.native).length == Object.keys(nativvalue.native).length) {
                    for (const key in obj.native) {
                        if (nativvalue.native[key] == null) {
                            ischange = true;
                            delete obj["native"];
                            obj["native"] = native;
                            break;
                        } else if (JSON.stringify(obj.native[key]) != JSON.stringify(nativvalue.native[key])) {
                            ischange = true;
                            obj.native[key] = nativvalue.native[key];
                            break;
                        }
                    }
                } else {
                    ischange = true;
                }
            }
            if (ischange) {
                this.log.debug(`INFORMATION - Change common: ${this.namespace}.${ident}`);
                delete obj["common"];
                obj["common"] = common;
                obj["type"] = types;
                await this.setObjectAsync(ident, obj);
            }
        }
        if (value != null) {
            await this.setStateAsync(ident, value, true);
        }
    },
};
