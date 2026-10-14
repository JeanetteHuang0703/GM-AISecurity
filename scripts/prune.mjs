import { readFile, readdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { root } from './validate.mjs';
import { beijingDate, pruneArchive } from '../src/archive.mjs';

const dir = path.resolve(root, 'data/days');
const files = (await readdir(dir)).filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name));
const days = await Promise.all(files.map(file => readFile(path.join(dir, file), 'utf8').then(JSON.parse)));
const favorites = JSON.parse(await readFile(path.join(root, 'data/favorites.json'), 'utf8'));
const result = pruneArchive(days, favorites.items, beijingDate());
for (const day of result.days) {
  const file = path.resolve(dir, day.date + '.json');
  if (path.dirname(file) !== dir) throw new Error('不安全的归档路径');
  await writeFile(file, JSON.stringify(day, null, 2) + '\n');
}
for (const date of result.removed) {
  const file = path.resolve(dir, date + '.json');
  if (path.dirname(file) !== dir) throw new Error('不安全的清理路径');
  await unlink(file);
}
await writeFile(path.join(root, 'data/favorites.json'), JSON.stringify({ schemaVersion: 1, items: result.favorites }, null, 2) + '\n');
console.log(`保留最近三天及 ${result.favorites.length} 条共享收藏；清理 ${result.removed.length} 个旧日期文件。`);
