// ioBroker eslint template configuration file for js and ts files
// Please note that esm or react based modules need additional modules loaded.
import config from "@iobroker/eslint-config";

export default [
    ...config,

    {
        // specify files to exclude from linting here
        ignores: [
            ".dev-server/",
            ".vscode/",
            "*.test.js",
            "test/**/*.js",
            "*.config.mjs",
            "build",
            "admin/build",
            "admin/words.js",
            "admin/blockly.js",
            "admin/admin.d.ts",
            "**/adapter-config.d.ts",
        ],
    },

    {
        // you may disable some 'jsdoc' warnings - but using jsdoc is highly recommended
        // as this improves maintainability. jsdoc warnings will not block buiuld process.
        rules: {
            "jsdoc/no-types": "off",
            "jsdoc/require-param-description": "off",
            "jsdoc/no-defaults": "off",
            "jsdoc/require-jsdoc": "off",
        },
    },
];
