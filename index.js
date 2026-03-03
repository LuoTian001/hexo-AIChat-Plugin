// index.js
import { existsSync, readFileSync, createReadStream } from 'fs';
import { join } from 'path';

function deepMerge(target, source) {
    for (const key in source) {
        if (source[key] instanceof Object && key in target) {
            Object.assign(source[key], deepMerge(target[key], source[key]));
        }
    }
    return Object.assign(target || {}, source);
}

const defaultConfigPath = join(__dirname, 'assets', 'aichat-plugin.json');
let defaultConfig = {};
if (existsSync(defaultConfigPath)) {
    const rawData = readFileSync(defaultConfigPath, 'utf8');
    defaultConfig = JSON.parse(rawData);
}

const userConfig = hexo.config.aichat || {};

const finalConfig = deepMerge(defaultConfig, userConfig);

if (finalConfig.enable === false) return;

hexo.extend.generator.register('aichat_assets', () => {
    return [
        {
            path: 'aichat/aichat-plugin.js',
            data: () => createReadStream(join(__dirname, 'assets/aichat-plugin.js'))
        },
        {
            path: 'aichat/aichat-plugin.css',
            data: () => createReadStream(join(__dirname, 'assets/aichat-plugin.css'))
        }
    ];
});

hexo.extend.injector.register('body_end', `
    <link rel="stylesheet" href="/aichat/aichat-plugin.css">
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script>
        window.AIChatPluginConfig = ${JSON.stringify(finalConfig)};
    </script>
    <script src="/aichat/aichat-plugin.js"></script>
`);