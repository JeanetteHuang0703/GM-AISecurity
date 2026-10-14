import test from 'node:test';
import assert from 'node:assert/strict';
import { loadArchive, validateArchive } from '../scripts/validate.mjs';
import { filterNews, readFilters, filterParams } from '../src/search.mjs';

const archive = await loadArchive();
const base = { date: 'all', query: '', tags: [], mode: 'any', relevance: 'all' };
test('最新日报及同一事件的历史记录都能检索', () => {
  assert.equal(filterNews(archive.items, { ...base, date: '2026-10-13' }).length, 8);
  const ledger = filterNews(archive.items, { ...base, query: 'Ledger' });
  assert.deepEqual(ledger.map(item => item.date), ['2026-10-13', '2026-10-12', '2026-10-11']);
});
test('标签交集、并集和相关性组合', () => {
  const tags = ['cross-chain', 'supply-chain'];
  const any = filterNews(archive.items, { ...base, tags });
  const all = filterNews(archive.items, { ...base, tags, mode: 'all' });
  assert(any.length > all.length);
  assert.equal(all.length, 3);
  assert(filterNews(archive.items, { ...base, relevance: 'indirect' }).every(item => item.relevance.level === 'indirect'));
});
test('中文、来源和多个检索词均参与搜索', () => {
  assert(filterNews(archive.items, { ...base, query: '跨链' }, archive.taxonomy).length > 0);
  assert.equal(filterNews(archive.items, { ...base, query: 'Ledger 1210' }).length, 0);
  assert.equal(filterNews(archive.items, { ...base, query: '不存在的检索词' }).length, 0);
  assert(filterNews(archive.items, { ...base, query: 'Bitquery' }).length >= 1);
});
test('分享链接保留组合条件并拒绝未知参数值', () => {
  const dates = archive.days.map(day => day.date);
  const state = { ...base, query: '签名 钱包', tags: ['wallets', 'identity'], mode: 'all', relevance: 'direct', item: '2026-10-13-06' };
  assert.deepEqual(readFilters('?' + filterParams(state), dates, archive.taxonomy), state);
  assert.equal(readFilters('?tags=wallets,unknown&date=bad&relevance=bad', dates, archive.taxonomy).date, 'all');
  assert.deepEqual(readFilters('?tags=wallets,unknown', dates, archive.taxonomy).tags, ['wallets']);
});
test('拒绝危险来源链接和失效前序引用', () => {
  const days = structuredClone(archive.days);
  days[0].items[0].sources[0].url = 'javascript:alert(1)';
  assert.throws(() => validateArchive(days, archive.taxonomy), /HTTP/);
  const other = structuredClone(archive.days);
  other[1].items[0].previous.ids = ['missing-record'];
  assert.throws(() => validateArchive(other, archive.taxonomy), /前序/);
});
