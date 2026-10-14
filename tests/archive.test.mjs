import test from 'node:test';
import assert from 'node:assert/strict';
import { loadArchive, validateArchive } from '../scripts/validate.mjs';
import { filterNews, readFilters, filterParams } from '../src/search.mjs';
import { beijingDate, recentWindow, pruneArchive } from '../src/archive.mjs';

const archive = await loadArchive();
const base = { view: 'recent', date: 'all', query: '', tags: [], mode: 'any', relevance: 'all', item: '' };
// Keep search fixtures independent of the growing daily archive.
const items = [
  { id: 'older', date: '2026-01-01', rank: 1, title: 'Ledger 跨链追踪', sourceNote: 'Bitquery', tags: ['cross-chain', 'supply-chain'], relevance: { level: 'direct' } },
  { id: 'newer', date: '2026-01-02', rank: 2, title: 'Ledger 钱包', sourceNote: 'Bitquery', tags: ['supply-chain'], relevance: { level: 'indirect' } },
  { id: 'latest-first', date: '2026-01-02', rank: 1, title: '跨链桥', sourceNote: '原始报告', tags: ['cross-chain'], relevance: { level: 'direct' } }
];
test('最新日报及同一事件的历史记录都能检索', () => {
  assert.deepEqual(filterNews(items, { ...base, date: '2026-01-02' }).map(item => item.id), ['latest-first', 'newer']);
  const ledger = filterNews(items, { ...base, query: 'Ledger' });
  assert.deepEqual(ledger.map(item => item.date), ['2026-01-02', '2026-01-01']);
});
test('标签交集、并集和相关性组合', () => {
  const tags = ['cross-chain', 'supply-chain'];
  const any = filterNews(items, { ...base, tags });
  const all = filterNews(items, { ...base, tags, mode: 'all' });
  assert(any.length > all.length);
  assert.equal(all.length, 1);
  assert.deepEqual(filterNews(items, { ...base, relevance: 'indirect' }).map(item => item.id), ['newer']);
});
test('中文、来源和多个检索词均参与搜索', () => {
  assert.equal(filterNews(items, { ...base, query: '跨链' }, archive.taxonomy).length, 2);
  assert.deepEqual(filterNews(items, { ...base, query: 'ＬＥＤＧＥＲ 跨链' }).map(item => item.id), ['older']);
  assert.equal(filterNews(items, { ...base, query: '不存在的检索词' }).length, 0);
  assert.equal(filterNews(items, { ...base, query: 'Bitquery' }).length, 2);
});
test('分享链接保留组合条件并拒绝未知参数值', () => {
  const dates = archive.days.map(day => day.date);
  const state = { ...base, query: '签名 钱包', tags: ['wallets', 'identity'], mode: 'all', relevance: 'direct', item: '2026-10-13-06' };
  assert.deepEqual(readFilters('?' + filterParams(state), dates, archive.taxonomy), state);
  assert.equal(readFilters('?tags=wallets,unknown&date=bad&relevance=bad', dates, archive.taxonomy).date, 'all');
  assert.deepEqual(readFilters('?tags=wallets,unknown', dates, archive.taxonomy).tags, ['wallets']);
});
test('拒绝危险来源链接和失效前序引用', () => {
  const fixture = [1, 2].map(n => ({ schemaVersion: 1, date: `2026-01-0${n}`, timezone: 'Asia/Shanghai', kind: 'daily', note: '测试', items: [{ id: `2026-01-0${n}-01`, date: `2026-01-0${n}`, rank: 1, title: '测试新闻', focus: '重点', sourceNote: '原始资料', summary: '完整摘要', impact: '影响', researchApplications: '研究点', tags: ['cross-chain'], keywords: ['跨链', '安全'], sources: [{ name: '来源', url: 'https://example.com/' }], relevance: { level: 'direct', reason: '相关' }, previous: { ids: [], note: '无' } }] }));
  const days = structuredClone(fixture);
  days[0].items[0].sources[0].url = 'javascript:alert(1)';
  assert.throws(() => validateArchive(days, archive.taxonomy), /HTTP/);
  const other = structuredClone(fixture);
  other[1].items[0].previous.ids = ['missing-record'];
  assert.throws(() => validateArchive(other, archive.taxonomy), /前序/);
});

test('北京时间14日默认窗口是11至13日，跨年也正确', () => {
  assert.deepEqual(recentWindow('2026-10-14'), { start: '2026-10-11', end: '2026-10-13' });
  assert.deepEqual(recentWindow('2027-01-02'), { start: '2026-12-30', end: '2027-01-01' });
  assert.equal(beijingDate(new Date('2026-10-13T16:00:00Z')), '2026-10-14');
  assert.equal(readFilters('', ['2026-10-13'], archive.taxonomy).date, 'all');
  const state = { ...base, view: 'favorites', query: '合约' };
  assert.deepEqual(readFilters('?' + filterParams(state), [], archive.taxonomy), state);
});

test('三天清理保留完整收藏，并为已删除前序保留说明', () => {
  const older = { id: '2026-10-10-01', date: '2026-10-10', title: '旧新闻完整内容', summary: '原始完整摘要', previous: { ids: [], note: '无' } };
  const newer = { id: '2026-10-11-01', date: '2026-10-11', title: '跟进', previous: { ids: [older.id], note: '前序' } };
  const days = [{ date: older.date, items: [older] }, { date: newer.date, items: [newer] }];
  const retained = pruneArchive(days, [older], '2026-10-14');
  assert.deepEqual(retained.removed, ['2026-10-10']);
  assert.equal(retained.favorites[0].summary, '原始完整摘要');
  assert.deepEqual(retained.days[0].items[0].previous.ids, [older.id]);
  const expired = pruneArchive(days, [], '2026-10-14');
  assert.deepEqual(expired.days[0].items[0].previous.ids, []);
  assert.equal(expired.days[0].items[0].previous.records[0].title, older.title);
  assert.deepEqual(newer.previous.ids, [older.id]);
});

test('仅在关键词与正文中的词也参与检索', () => {
  const news = [{ ...items[0], keywords: ['动作前授权', '连接器'], summary: '先授权再执行' }];
  assert.equal(filterNews(news, { ...base, query: '动作前授权' }).length, 1);
  assert.equal(filterNews(news, { ...base, query: '先授权再执行' }).length, 1);
});
