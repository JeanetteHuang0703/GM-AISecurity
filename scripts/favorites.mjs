import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const validId = id => /^\d{4}-\d{2}-\d{2}-\d{2,}$/.test(id);
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4 * 1024 * 1024 });

export function resolveSavedRecord(record, root) {
  if (record.schemaVersion !== 1 || !validId(record.id)) throw new Error('收藏标记格式错误');
  if (record.item) {
    if (record.item.id !== record.id) throw new Error('收藏正文ID不匹配');
    return record.item;
  }
  if (!/^[a-f0-9]{40}$/.test(record.sourceRevision)) throw new Error('收藏来源版本无效');
  // Only committed news from this branch's history can become a saved record.
  git(root, 'merge-base', '--is-ancestor', record.sourceRevision, 'HEAD');
  const day = JSON.parse(git(root, 'show', `${record.sourceRevision}:data/days/${record.id.slice(0, 10)}.json`));
  const item = day.items.find(item => item.id === record.id && item.date === record.id.slice(0, 10));
  if (!item) throw new Error('收藏来源版本没有这条新闻');
  const snapshot = structuredClone(item);
  const references = new Map((snapshot.previous.records || []).map(previous => [previous.id, previous]));
  for (const id of snapshot.previous.ids) {
    if (!validId(id)) throw new Error('收藏前序ID无效');
    const priorDay = JSON.parse(git(root, 'show', `${record.sourceRevision}:data/days/${id.slice(0, 10)}.json`));
    const prior = priorDay.items.find(item => item.id === id);
    if (!prior) throw new Error('收藏前序正文不存在');
    references.set(id, { id, title: prior.title, date: prior.date });
  }
  snapshot.previous.ids = [];
  if (references.size) snapshot.previous.records = [...references.values()];
  return snapshot;
}

export async function loadSavedRecords(root) {
  const dir = path.join(root, 'data/saved');
  let files;
  try { files = await readdir(dir); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const saved = [];
  for (const file of files.filter(file => file.endsWith('.json')).sort()) {
    const record = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    if (file !== record.id + '.json') throw new Error('收藏文件名与ID不匹配');
    saved.push({ file, record, item: resolveSavedRecord(record, root) });
  }
  return saved;
}

export async function materializeSavedRecords(root, saved) {
  const dir = path.join(root, 'data/saved');
  await mkdir(dir, { recursive: true });
  for (const { file, record, item } of saved) {
    // Save the full snapshot before old daily files are deleted; no history lookup is needed afterwards.
    if (!record.item) await writeFile(path.join(dir, file), JSON.stringify({ ...record, item }, null, 2) + '\n');
  }
}
