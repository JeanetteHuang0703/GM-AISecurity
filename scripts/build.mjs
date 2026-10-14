import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadArchive, root } from './validate.mjs';
import { beijingDate, recentWindow } from '../src/archive.mjs';

const archive = await loadArchive();
const template = await readFile(path.join(root, 'src/template.html'), 'utf8');
const style = await readFile(path.join(root, 'src/style.css'), 'utf8');
const search = (await readFile(path.join(root, 'src/search.mjs'), 'utf8')).replaceAll('export function ', 'function ');
const app = await readFile(path.join(root, 'src/app.js'), 'utf8');
const helpers = (await readFile(path.join(root, 'src/archive.mjs'), 'utf8')).replaceAll('export function ', 'function ');
const today = beijingDate();
const window = recentWindow(today);
const sourceRevision = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const tagCounts = Object.fromEntries(Object.keys(archive.taxonomy).map(tag => [tag, archive.items.filter(item => item.tags.includes(tag)).length]));
const groups = new Map();
for (const item of archive.items) {
  const month = item.date.slice(0, 7);
  if (!groups.has(month)) groups.set(month, []);
  groups.get(month).push(item);
}
const months = [...groups].map(([month, items]) => ({ month, path: `data/months/${month}.json`, count: items.length, tags: [...new Set(items.flatMap(item => item.tags))] }));
const byId = new Map(archive.items.map(item => [item.id, item]));
const previousRecords = Object.fromEntries([...new Set(archive.items.flatMap(item => item.previous.ids))].map(id => {
  const { title, date } = byId.get(id); return [id, { id, title, date }];
}));
const manifest = {
  schemaVersion: 2, timezone: archive.timezone, latestDate: archive.latestDate,
  today, recentWindow: window, sourceRevision, favoriteIds: archive.favoriteIds,
  generatedAt: new Date().toISOString(), totalItems: archive.items.length,
  taxonomy: archive.taxonomy, tagCounts, months, previousRecords,
  days: archive.days.map(({ items, ...day }) => ({ ...day, count: items.length }))
};
const bootstrap = { ...manifest, initialItems: archive.items.filter(item => item.date >= window.start && item.date <= window.end || archive.favoriteIds.includes(item.id)) };
// The complete three-day feed and shared favorites work without a second request.
const json = JSON.stringify(bootstrap).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
const html = template.replace('/* STYLES */', () => style).replace('DATA_PLACEHOLDER', () => json).replace('/* APP */', () => `${helpers}\n${search}\n${app}`);
const output = path.resolve(root, 'site');
if (output !== path.join(path.resolve(root), 'site')) throw new Error('构建输出路径不安全');
// site/ is ignored generated output; clean it so removed shards cannot survive a rebuild.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await writeFile(path.join(root, 'site/index.html'), html);
await mkdir(path.join(root, 'site/data/months'), { recursive: true });
await writeFile(path.join(root, 'site/data/tags.json'), JSON.stringify(archive.taxonomy, null, 2) + '\n');
await writeFile(path.join(root, 'site/data/favorites.json'), JSON.stringify({ schemaVersion: 1, items: archive.items.filter(item => archive.favoriteIds.includes(item.id)) }, null, 2) + '\n');
for (const [month, items] of groups) await writeFile(path.join(root, `site/data/months/${month}.json`), JSON.stringify({ schemaVersion: 1, month, items }));
await writeFile(path.join(root, 'site/data/index.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(root, 'site/.nojekyll'), '');
console.log(`已生成 site/index.html：${archive.items.length} 条，最新 ${archive.latestDate}。`);
