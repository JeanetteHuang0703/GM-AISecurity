import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { loadArchive, root } from './validate.mjs';

const archive = await loadArchive();
const template = await readFile(path.join(root, 'src/template.html'), 'utf8');
const style = await readFile(path.join(root, 'src/style.css'), 'utf8');
const search = (await readFile(path.join(root, 'src/search.mjs'), 'utf8')).replaceAll('export function ', 'function ');
const app = await readFile(path.join(root, 'src/app.js'), 'utf8');
// JSON is embedded as inert text; escaping '<' prevents data from closing the script element.
const json = JSON.stringify(archive).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
const html = template.replace('/* STYLES */', () => style).replace('DATA_PLACEHOLDER', () => json).replace('/* APP */', () => `${search}\n${app}`);
await mkdir(path.join(root, 'site'), { recursive: true });
await writeFile(path.join(root, 'site/index.html'), html);
await cp(path.join(root, 'data'), path.join(root, 'site/data'), { recursive: true });
await writeFile(path.join(root, 'site/data/archive.json'), JSON.stringify(archive, null, 2) + '\n');
await writeFile(path.join(root, 'site/.nojekyll'), '');
console.log(`已生成 site/index.html：${archive.items.length} 条，最新 ${archive.latestDate}。`);
