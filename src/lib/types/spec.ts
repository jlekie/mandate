export interface ISpec {
    readonly options: { [key: string]: ISpecOption };
    readonly commands: { [key: string]: ISpecCommand };
}
export interface ISpecOption {
    readonly flags: ReadonlyArray<string>;
    readonly description: string;
    readonly type: string;
}
export interface ISpecParam {
    readonly type: string;
}
export interface ISpecCommand {
    readonly handler: string;
    readonly options: { [key: string]: ISpecOption };
    readonly params: { [key: string]: ISpecParam };
    readonly commands: { [key: string]: ISpecCommand };
}

export class Spec implements ISpec {
    public readonly options: { [key: string]: ISpecOption };
    public readonly commands: { [key: string]: ISpecCommand };

    public static parse(hash: any) {
        return new this({
            options: hash.options,
            commands: hash.commands
        });
    }

    public constructor(options: Partial<Pick<Spec, 'options' | 'commands'>>) {
        this.options = options.options ? { ...options.options } : {};
        this.commands = options.commands ? { ...options.commands } : {};
    }
}

export class SpecOption implements ISpecOption {
    public readonly flags: ReadonlyArray<string>;
    public readonly description: string;
    public readonly type: string;

    public static parse(hash: any) {
        return new this({
            flags: hash.flags,
            description: hash.description,
            type: hash.type
        });
    }

    public constructor(options: Partial<Pick<SpecOption, 'flags' | 'description' | 'type'>>) {
        this.flags = options.flags ? options.flags.slice() : [];
        this.description = options.description || '';
        this.type = options.type || 'string';
    }
}

export class SpecParam implements ISpecParam {
    public readonly type: string;

    public static parse(hash: any) {
        return new this({
            type: hash.type
        });
    }

    public constructor(options: Partial<Pick<SpecParam, 'type'>>) {
        this.type = options.type || 'string';
    }
}

export class SpecCommand implements ISpecCommand {
    public readonly handler: string;
    public readonly options: { [key: string]: ISpecOption };
    public readonly params: { [key: string]: ISpecParam };
    public readonly commands: { [key: string]: ISpecCommand };

    public static parse(hash: any) {
        return new this({
            handler: hash.handler,
            options: hash.options,
            params: hash.params,
            commands: hash.commands
        });
    }

    public constructor(options: Partial<Pick<SpecCommand, 'handler' | 'options' | 'params' | 'commands'>>) {
        this.handler = options.handler || 'help';
        this.options = options.options ? { ...options.options } : {};
        this.params = options.params ? { ...options.params } : {};
        this.commands = options.commands ? { ...options.commands } : {};
    }
}