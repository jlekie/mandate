import * as _ from 'lodash';
import * as FS from 'fs-extra';
import * as Yaml from 'js-yaml';
import { ISpec, IApp, IOption, Spec, App, Command, Option, IPackageManifest, CommandHandler, ICommandHandlers } from './types';

export async function loadSpec(path: string): Promise<ISpec> {
    const buffer = await FS.readFile(path, 'utf8');
    const hash = Yaml.safeLoad(buffer);

    return Spec.parse(hash);
}

export function createApp<THandlers extends ICommandHandlers>(spec: ISpec, packageManifest: IPackageManifest, handlers: THandlers): IApp {
    return App.fromSpec(spec, packageManifest, handlers);
}