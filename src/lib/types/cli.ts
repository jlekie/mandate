import * as _ from 'lodash';
import { ISpec, ISpecCommand, ISpecOption, ISpecParam } from './spec';

export type Options<T, K extends keyof T> = Partial<Pick<T, K>>;

export type ConstructorOptionalProps<T, K extends keyof T> = Partial<Pick<T, K>>;
export type ConstructorRequiredProps<T, K extends keyof T> = Pick<T, K>;
export type ConstructorProps<T, RK extends keyof T, OK extends keyof T> = ConstructorRequiredProps<T, RK> & ConstructorOptionalProps<T, OK>;

export type CommandHandler<TOptions extends object, TParams extends object> = (options: TOptions, params: TParams, parentHandler: () => Promise<void> | void) => Promise<void> | void;
export type DefaultCommandHandler<TOptions extends object, TParams extends object> = (options: TOptions, params: TParams) => Promise<void> | void;

export interface ICommandHandlers {
    default: DefaultCommandHandler<any, any>;
    [key: string]: CommandHandler<any, any>;
}

function unwrapArray<T>(items: ReadonlyArray<T>): Array<T> {
    return items as Array<T>;
}

const commandAppMap = new WeakMap<ICommand<any>, IApp>();
const commandCommandMap = new WeakMap<ICommand<any>, ICommand<any>>();

type RegistrationContext<T> = {
    [P in keyof T]: T[P] | null;
};

function registerCommand(command: ICommand<any>, contexts: RegistrationContext<{ app: IApp, command?: ICommand<any> }>) {
    if (contexts.app)
        commandAppMap.set(command, contexts.app);
    if (contexts.command)
        commandCommandMap.set(command, contexts.command);

    for (const subCommand of command.commands)
        registerCommand(subCommand, { ...contexts, command });
}

export interface IPackageManifest {
    readonly name: string;
    readonly version: string;
}

export interface IApp {
    readonly name: string;
    readonly version: string;
    readonly handler: DefaultCommandHandler<any, any>;
    readonly options: ReadonlyArray<IOption>;
    readonly commands: ReadonlyArray<ICommand<any>>;

    handle(args: Array<string>): Promise<void>;

    registerOption(name: string, type: string, flags: ReadonlyArray<string>, description: string): IOption;
    registerCommand<TOptions extends object, TParams extends object>(name: string, handler?: CommandHandler<TOptions, TParams>): ICommand<any>;

    outputHelp(): void;
    outputVersion(): void;
}
export class App implements IApp {
    public readonly name: string;
    public readonly version: string;
    public readonly handler: DefaultCommandHandler<any, any>;
    public readonly options: ReadonlyArray<IOption>;
    public readonly commands: ReadonlyArray<ICommand<any>>;

    public static parse(packageManifest: IPackageManifest) {
        return new App(packageManifest.name, packageManifest.version);
    }
    public static fromSpec(name: string, version: string, spec: ISpec, handlers: ICommandHandlers): App {
        return new this(name, version, {
            handler: handlers.default,
            options: _.map(spec.options || {}, (value, key) => Option.fromSpec(key, value)),
            commands: _.map(spec.commands || {}, (value, key) => Command.fromSpec(key, value, handlers))
        });
    }

    public constructor(name: string, version: string, options: Options<App, 'handler' | 'options' | 'commands'> = {}) {
        this.name = name;
        this.version = version;

        this.handler = (async (options, args) => {
            if (options.help)
                this.outputHelp();
            else if (options.version)
                this.outputVersion();
            else if (options.handler)
                await options.handler(options, args);
            else
                this.outputHelp();
        });
        this.options = options.options ? [ Option.helpOption, Option.versionOption, ...options.options ] : [ Option.helpOption, Option.versionOption ];
        this.commands = options.commands ? options.commands.slice() : [];

        for (const command of this.commands)
            registerCommand(command, { app: this });
    }

    public async handle(args: Array<string>): Promise<void> {
        args = args.slice(2);

        const commands: Array<ICommand<any>> = [];
        const rawOptions: Array<{ flag: string, value: string }> = [];
        const rawParams: Array<string> = [];

        let arg = args.shift();
        while (arg) {
            if (arg.startsWith('-')) {
                const valueDelimiterIdx = arg.indexOf('=');

                let flag: string;
                let value: any;

                if (valueDelimiterIdx >= 0) {
                    flag = arg.substr(0, valueDelimiterIdx);
                    value = arg.substr(valueDelimiterIdx + 1);
                }
                else if (args.length > 0 && !args[0].startsWith('-')) {
                    flag = arg;
                    value = args.shift();
                }
                else {
                    flag = arg;
                    value = 'true';
                }

                rawOptions.push({ flag, value });
            }
            else {
                const command = (_.last(commands) || this).commands.find(c => c.name === arg);
                if (command) {
                    commands.push(command);
                }
                else {
                    rawParams.push(arg);
                }
            }

            arg = args.shift();
        }

        const options: any = {};
        for (const rawOption of rawOptions) {
            let option = this.options.find(o => !!o.flags.find(f => f === rawOption.flag));
            for (const command of commands)
                option = command.options.find(o => !!o.flags.find(f => f === rawOption.flag)) || option;
            if (!option)
                throw new Error(`Unknown option ${rawOption.flag}`);

            options[option.name] = rawOption.value;
        }

        const params: any = {};
        for (let a = 0; a < rawParams.length; a++) {
            params[commands[commands.length - 1].params[a].name] = rawParams[a];
        }

        if (commands.length > 0) {
            await commands[commands.length - 1].handle(options, params);
        }
        else {
            await this.handler(options, params);
        }
    }

    public registerOption(name: string, type: string, flags: ReadonlyArray<string>, description: string): IOption {
        const option = new Option(name, type, flags, { description });
        unwrapArray(this.options).push(option);

        return option;
    }
    public registerCommand<TOptions extends object, TParams extends object>(name: string, handler?: CommandHandler<TOptions, TParams>): ICommand<any> {
        const command = new Command(name, { handler });
        unwrapArray(this.commands).push(command);

        return command;
    }

    public outputHelp(): void {
        const options: Array<IOption> = [ ...this.options ];
        const maxLengthOption = _.max(options.map(option => option.flags.join(', ').length)) || 0;

        console.log();
        console.log(`  Usage: ${this.name} [options] <command>`);
        console.log();
        if (options.length > 0) {
            console.log('  Options:');
            console.log();
            for (const option of options)
                console.log(`    ${_.padEnd(option.flags.join(', '), maxLengthOption + 4)}${option.description}`);
            console.log();
        }
        if (this.commands.length > 0) {
            console.log('  Commands:');
            console.log();
            for (const command of this.commands)
                console.log(`    ${command.name}`);
            console.log();
        }
    }
    public outputVersion(): void {
        console.log();
        console.log(`  v${this.version}`);
        console.log();
    }
}

export interface ICommand<TResolvedCommands extends object> {
    readonly name: string;
    readonly handler: CommandHandler<any, any>;
    readonly options: ReadonlyArray<IOption>;
    readonly params: ReadonlyArray<IParam>;
    readonly commands: ReadonlyArray<ICommand<any>>;

    readonly app: IApp | null;
    readonly parentCommand: ICommand<any> | null;

    handle(options: any, params: any): Promise<void>;

    registerOption(name: string, type: string, flags: ReadonlyArray<string>, description: string): IOption;
    registerParam(name: string): IParam;
    registerCommand<TOptions extends object, TParams extends object>(name: string, handler?: CommandHandler<TOptions, TParams>): ICommand<any>;

    outputHelp(): void;
    outputVersion(): void;
}
export class Command<TResolvedCommands extends object> implements ICommand<TResolvedCommands> {
    public readonly name: string;
    public readonly handler: CommandHandler<any, any>;
    public readonly options: ReadonlyArray<IOption>;
    public readonly params: ReadonlyArray<IParam>;
    public readonly commands: ReadonlyArray<ICommand<any>>;

    public get app(): IApp | null {
        return commandAppMap.get(this) || null;
    }
    public get parentCommand(): ICommand<any> | null {
        return commandCommandMap.get(this) || null;
    }

    public static fromSpec(name: string, specCommand: ISpecCommand, handlers: ICommandHandlers): Command<any> {
        return new this(name, {
            handler: handlers[specCommand.handler],
            options: _.map(specCommand.options || {}, (value, key) => Option.fromSpec(key, value)),
            params: _.map(specCommand.params || {}, (value, key) => Param.fromSpec(key, value)),
            commands: _.map(specCommand.commands || {}, (value, key) => Command.fromSpec(key, value, handlers)),
        });
    }

    public constructor(name: string, props: ConstructorOptionalProps<Command<TResolvedCommands>, 'handler' | 'options' | 'params' | 'commands'> = {}) {
        this.name = name;

        this.handler = (async (options, args, handler) => {
            if (options.help)
                this.outputHelp();
            else if (options.version)
                this.outputVersion();
            else if (props.handler)
                await props.handler(options, args, handler);
            else
                this.outputHelp();
        });
        this.options = props.options ? props.options.slice() : [];
        this.params = props.params ? props.params.slice() : [];
        this.commands = props.commands ? props.commands.slice() : [];

        for (const command of this.commands)
            registerCommand(command, { app: this.app, command: this });
    }

    public async handle(options: any, params: any): Promise<void> {
        return this.handler(options, params, async () => {
            if (this.parentCommand)
                await this.parentCommand.handle(options, params);
            else if (this.app)
                await this.app.handler(options, params);
        });
    }

    public registerOption(name: string, type: string, flags: ReadonlyArray<string>, description: string): IOption {
        const option = new Option(name, type, flags, { description });
        unwrapArray(this.options).push(option);

        return option;
    }
    public registerParam(name: string): IParam {
        const param = new Param(name);
        unwrapArray(this.params).push(param);

        return param;
    }
    public registerCommand<TOptions extends object, TParams extends object>(name: string, handler?: CommandHandler<TOptions, TParams>): ICommand<any> {
        const command = new Command(name, { handler });
        unwrapArray(this.commands).push(command);

        return command;
    }

    public outputHelp(): void {
        const options: Array<IOption> = [ ...this.options, ...(this.app ? this.app.options : []) ];
        const maxLengthOption = _.max(options.map(option => option.flags.join(', ').length)) || 0;

        let parentCommands: Array<ICommand<any>> = [];

        let parentCommand = this.parentCommand;
        while (parentCommand) {
            parentCommands.push(parentCommand);
            parentCommand = parentCommand.parentCommand;
        }

        console.log();
        console.log(`  Usage: ${this.app && `${this.app.name} `}${parentCommands.map(c => `${c.name} `)}${this.name} [options]`);
        console.log();
        if (options.length > 0) {
            console.log('  Options:');
            console.log();
            for (const option of options)
                console.log(`    ${_.padEnd(option.flags.join(', '), maxLengthOption + 4)}${option.description}`);
            console.log();
        }
        if (this.commands.length > 0) {
            console.log('  Commands:');
            console.log();
            for (const command of this.commands)
                console.log(`    ${command.name}`);
            console.log();
        }
    }
    public outputVersion(): void {
        console.log();
        console.log(`  v${this.app ? this.app.version : '???'}`);
        console.log();
    }
}

export interface IOption {
    readonly name: string;
    readonly type: string;
    readonly flags: ReadonlyArray<string>;
    readonly description?: string;
}
export class Option implements IOption {
    public static readonly helpOption = new Option('help', 'flag', [ '-h', '--help' ], { description: 'Display help' });
    public static readonly versionOption = new Option('version', 'flag', [ '-v', '--version' ], { description: 'Display version' });

    public readonly name: string;
    public readonly type: string;
    public readonly flags: ReadonlyArray<string>;
    public readonly description?: string;

    public static fromSpec(name: string, specOption: ISpecOption): Option {
        return new this(name, specOption.type, specOption.flags, {
            description: specOption.description
        });
    }

    public constructor(name: string, type: string, flags: ReadonlyArray<string>, options: Options<Option, 'description'> = {}) {
        this.name = name;
        this.flags = flags.slice();

        this.description = options.description;
    }
}

export interface IParam {
    readonly name: string;
}
export class Param implements IParam {
    public readonly name: string;

    public static fromSpec(name: string, specParam: ISpecParam): Param {
        return new this(name);
    }

    public constructor(name: string) {
        this.name = name;
    }
}