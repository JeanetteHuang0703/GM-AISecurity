import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { beijingDate, pruneArchive } from '../src/archive.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
const requiredText = ['id', 'title', 'focus', 'sourceNote', 'summary', 'impact', 'researchApplications'];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0, 10) === value;

export function validateArchive(days, taxonomy) {
  const ids = new Map();
  const dates = new Set();
  assert(Object.keys(taxonomy).length > 0, '标签词表为空');
  for (const day of days) {
    assert(isDate(day.date), `无效日期: ${day.date}`);
    assert(!dates.has(day.date), `重复日期: ${day.date}`);
    dates.add(day.date);
    assert(day.schemaVersion === 1 && day.timezone === 'Asia/Shanghai', `${day.date}: 版本或时区错误`);
    assert(['daily', 'sample', 'backfill', 'favorite'].includes(day.kind), `${day.date}: 缺少日报类型`);
    assert(typeof day.note === 'string', `${day.date}: 缺少口径说明`);
    assert(Array.isArray(day.items), `${day.date}: items 必须是数组`);
    const ranks = new Set();
    for (const item of day.items) {
      for (const key of requiredText) assert(typeof item[key] === 'string' && item[key].trim(), `${day.date}: ${key} 为空`);
      assert(/^[a-z0-9-]+$/.test(item.id), `不安全的记录 ID: ${item.id}`);
      assert(!ids.has(item.id), `重复记录 ID: ${item.id}`);
      assert(item.date === day.date, `${item.id}: 日期不匹配`);
      assert(Number.isInteger(item.rank) && item.rank > 0 && !ranks.has(item.rank), `${item.id}: 排名重复或无效`);
      ranks.add(item.rank);
      assert(Array.isArray(item.tags) && item.tags.length && new Set(item.tags).size === item.tags.length, `${item.id}: 标签为空或重复`);
      for (const tag of item.tags) assert(Object.hasOwn(taxonomy, tag), `${item.id}: 未知标签 ${tag}`);
      assert(Array.isArray(item.keywords) && item.keywords.length >= 2 && item.keywords.length <= 4, `${item.id}: 关键词需要 2–4 个`);
      assert(Array.isArray(item.sources) && item.sources.length, `${item.id}: 缺少来源链接`);
      for (const source of item.sources) {
        assert(typeof source.name === 'string' && source.name.trim(), `${item.id}: 来源名称为空`);
        assert(/^https?:$/.test(new URL(source.url).protocol), `${item.id}: 来源链接只允许 HTTP(S)`);
      }
      assert(['direct', 'indirect', 'none'].includes(item.relevance?.level) && typeof item.relevance.reason === 'string' && item.relevance.reason.trim(), `${item.id}: 相关性不完整`);
      assert(Array.isArray(item.previous?.ids) && typeof item.previous?.note === 'string', `${item.id}: 前序信息不完整`);
      for (const previous of item.previous.records || []) assert(typeof previous.title === 'string' && isDate(previous.date) && previous.date < item.date, `${item.id}: 已清理前序摘要无效`);
      ids.set(item.id, item);
    }
  }
  for (const item of ids.values()) for (const previousId of item.previous.ids) {
    const previous = ids.get(previousId);
    assert(previous && previous.date < item.date, `${item.id}: 前序 ${previousId} 不存在或不是较早日期`);
  }
  return [...ids.values()];
}

export async function loadArchive() {
  const taxonomy = JSON.parse(await readFile(path.join(root, 'data/tags.json'), 'utf8'));
  const files = (await readdir(path.join(root, 'data/days'))).filter(file => file.endsWith('.json')).sort();
  const days = await Promise.all(files.map(async file => {
    const day = JSON.parse(await readFile(path.join(root, 'data/days', file), 'utf8'));
    assert(file === `${day.date}.json`, `文件名与日期不匹配: ${file}`);
    return day;
  }));
  const favorites = JSON.parse(await readFile(path.join(root, 'data/favorites.json'), 'utf8'));
  assert(favorites.schemaVersion === 1 && Array.isArray(favorites.items), '共享收藏格式错误');
  assert(new Set(favorites.items.map(item => item.id)).size === favorites.items.length, '共享收藏ID重复');
  const retained = pruneArchive(days, favorites.items, beijingDate());
  const all = new Map(retained.favorites.map(item => [item.id, item]));
  retained.days.flatMap(day => day.items).forEach(item => all.set(item.id, item));
  const groups = new Map(retained.days.map(day => [day.date, { ...day, items: [] }]));
  for (const item of all.values()) {
    if (!groups.has(item.date)) groups.set(item.date, { schemaVersion: 1, date: item.date, timezone: 'Asia/Shanghai', kind: 'favorite', note: '已超过三天，因加入共享爱心收藏而保留。', items: [] });
    groups.get(item.date).items.push(item);
  }
  const mergedDays = [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
  const items = validateArchive(mergedDays, taxonomy);
  return { schemaVersion: 1, timezone: 'Asia/Shanghai', latestDate: retained.days.at(-1)?.date || null, taxonomy, days: mergedDays, items, favoriteIds: favorites.items.map(item => item.id) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const archive = await loadArchive();
    console.log(`校验通过：${archive.days.length} 天，${archive.items.length} 条新闻。`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
