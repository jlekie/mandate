import * as _ from 'lodash';
import * as Bluebird from 'bluebird';
import * as Chalk from 'chalk';
import * as Glob from 'glob';
import * as Process from 'child_process';
import * as TS from 'typescript';
import * as Path from 'path';
import * as FS from 'fs-extra';
import * as Debug from 'debug';

const debug = Debug('build');

const tsconfig = TS.convertCompilerOptionsFromJson(require(Path.resolve('tsconfig.json')).compilerOptions, process.cwd());

async function globAsync(pattern: string, options: Glob.IOptions = {}) {
    return new Promise<Array<string>>((resolve, reject) => {
        Glob(pattern, options, (err, matches) => {
            if (err)
                reject(err);
            else
                resolve(matches);
        });
    });
}

async function relativity() {
    debug('Acquiring source files');
    const sourceFiles = await globAsync('src/**/*.ts');

    const distPath = Path.resolve('.obj');
    debug(`Purging directory ${distPath}`);
    await FS.emptyDir(distPath);

    await Bluebird.map(sourceFiles, async (sourceFile) => {
        const fileDirPath = Path.dirname(sourceFile);
        const objPath = sourceFile.replace('src/', '.obj/');

        let buffer = await FS.readFile(sourceFile, 'utf8');
        const paths = tsconfig.options.paths || {};
        for (const srcPath in paths) {
            const destPath = paths[srcPath];

            let replacePath = Path.relative(
                Path.resolve(fileDirPath),
                Path.resolve(tsconfig.options.baseUrl, destPath[0].replace('*', ''))
            );
            if (replacePath)
                replacePath = './' + replacePath;
            else
                replacePath = '.';
            if (Path.sep === '\\')
                replacePath = replacePath.replace(/\\/g, '/');

            buffer = buffer.replace(new RegExp(`(require\\(['"])(${srcPath})(${_.endsWith(srcPath, '*') ? '.*' : ''}['"]\\))`, 'g'), function (match, p1, p2, p3, offset) {
                return p1 + replacePath + '/' + p3;
            });
            buffer = buffer.replace(new RegExp(`(import.*['"])(${srcPath})(${_.endsWith(srcPath, '*') ? '.*' : ''}['"])`, 'g'), function (match, p1, p2, p3, offset) {
                return p1 + replacePath + '/' + p3;
            });
            buffer = buffer.replace(new RegExp(`(from.*['"])(${srcPath})(${_.endsWith(srcPath, '*') ? '.*' : ''}['"])`, 'g'), function (match, p1, p2, p3, offset) {
                return p1 + replacePath + '/' + p3;
            });
        }

        await FS.outputFile(objPath, buffer);
    });
}

async function buildTypescript(options: TS.CompilerOptions) {
    debug('Acquiring source files');
    const sourceFiles = [ ...(await globAsync('.obj/**/*.ts')), ...(await globAsync('defs/**/*.d.ts')) ];

    const program = TS.createProgram(sourceFiles, options);

    debug('Compiling source files');
    const emitResults = program.emit();

    const diagnostics = TS.getPreEmitDiagnostics(program).concat(emitResults.diagnostics);
    for (const diagnostic of diagnostics) {
        if (diagnostic.file && diagnostic.start) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            const message = TS.flattenDiagnosticMessageText(diagnostic.messageText, '\n');

            console.log(Chalk.cyan(`[Tsc] ${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`));
        }
    }

    if (emitResults.emitSkipped || diagnostics.length > 0)
        throw new Error('Typescript compiled failed');
}

async function copyManifests() {
    await FS.copy('package.json', 'dist/package.json');
    await FS.copy('yarn.lock', 'dist/yarn.lock');

    await FS.outputFile('dist/timestamp', new Date().getTime().toString());
}

async function copyData() {
    const files = await globAsync('src/data/**/*');

    await Bluebird.map(files, async (file) => {
        const stats = await FS.statSync(file);
        if (!stats.isFile()) return;

        const targetPath = file.replace('src/', 'dist/');

        debug(`Copying ${file} to ${targetPath}`);
        await FS.copy(file, targetPath);
    });
}

async function cleanup() {
    await FS.remove(Path.resolve('.obj'));
}

console.log(`--- ${Chalk.dim('BUILD STARTING')} ---`);
(async function () {
    console.log(Chalk.blue('Resolving aliased paths...'));
    await relativity();

    const distPath = Path.resolve('dist');
    debug(`Purging directory ${distPath}`);
    await FS.emptyDir(distPath);

    if (tsconfig.errors.length > 0)
        throw new Error(`Invalid tsconfig`);

    console.log(Chalk.blue('Compiling typescript...'));
    await buildTypescript({ ...tsconfig.options, outDir: distPath, sourceMap: true });

    console.log(Chalk.blue('Copying manifests...'));
    await copyManifests();

    console.log(Chalk.blue('Copying data...'));
    await copyData();
})().then(() => {
    console.log(`--- ${Chalk.green('BUILD FINISHED')} ---`);
}).catch((err) => {
    console.error(Chalk.yellow(err.stack));

    console.error(`--- ${Chalk.red('BUILD FAILED')} ---`);
}).then(async () => {
    await cleanup();
});