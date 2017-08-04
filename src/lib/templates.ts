import * as Path from 'path';
import * as FS from 'fs-extra';
import * as Debug from 'debug';

import * as Handlebars from '@/modules/handlebars';

const debug = Debug('dap');

export async function typedef(context: any) {
    return compileTemplate('typedef').then(template => template(context));
}

type CompiledTemplate = (context: any) => string;
const templatesRootPath = Path.resolve(__dirname, '../data/templates');
const compiledTemplateCache = new Map<string, CompiledTemplate>();
async function compileTemplate(templateName: string): Promise<CompiledTemplate> {
    let template = compiledTemplateCache.get(templateName);
    if (!template) {
        const templatePath = Path.resolve(templatesRootPath, `${templateName}.hbs`);

        debug(`Loading and compiling template from "${templatePath}"...`);
        const source = await FS.readFile(templatePath, 'utf8');
        template = Handlebars.compile(source);

        compiledTemplateCache.set(templateName, template);
    }

    return template;
}