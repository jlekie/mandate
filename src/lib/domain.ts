import * as Debug from 'debug';
import * as _ from 'lodash';
import * as FS from 'fs-extra';
import * as Yaml from 'js-yaml';

import * as Templates from '@/lib/templates';

import { ISpec, IApp, IOption, Spec, App, Command, Option, IPackageManifest, CommandHandler, ICommandHandlers, ICommandHelpHandlers } from './types';

const debug = Debug('mandate');

export async function loadSpec(path: string): Promise<ISpec> {
    debug(`loading spec ${path}`);
    const buffer = await FS.readFile(path, 'utf8');
    const hash = Yaml.safeLoad(buffer);

    return Spec.parse(hash);
}

export function createApp<THandlers extends ICommandHandlers>(name: string, version: string, spec: ISpec, handlers: THandlers, helpHandlers?: ICommandHelpHandlers): IApp {
    return App.fromSpec(name, version, spec, handlers, helpHandlers);
}

export async function generateTypedef(spec: ISpec, destPath: string): Promise<void> {
    const buffer = await Templates.typedef(spec);

    await FS.outputFile(destPath, buffer);
}