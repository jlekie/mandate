#!/usr/bin/env node
import 'source-map-support/register';

import * as Debug from 'debug';
import * as FS from 'fs-extra';
import * as Path from 'path';

import * as App from '@';

const debug = Debug('mandate');

(async function run() {
    const pack = await FS.readJson(Path.resolve(__dirname, '../package.json'));
    const app = new App.App('mandate', pack.version);

    const typedefCommand = app.registerCommand<any, any>('typedef', async (options, params) => {
        const spec = await App.loadSpec(params.specPath);

        await App.generateTypedef(spec, params.destPath);
    });
    typedefCommand.registerParam('specPath');
    typedefCommand.registerParam('destPath');

    await app.handle(process.argv);
})().then(() => {
    process.exit(0);
}).catch((err) => {
    debug(err.stack);
    console.error(err.message);

    process.exit(1);
});