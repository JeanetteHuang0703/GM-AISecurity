import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, unlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadSavedRecords, materializeSavedRecords, resolveSavedRecord } from '../scripts/favorites.mjs';
import { favoriteLink, pruneArchive } from '../src/archive.mjs';
import { filterNews } from '../src/search.mjs';

test('收藏链接只预填主仓库中的单条JSON，不携带访问令牌', () => {
  const url = new URL(favoriteLink({ id: '2026-10-13-01' }, 'a'.repeat(40)));
  assert.equal(url.origin + url.pathname, 'https://github.com/JeanetteHuang0703/GM-AISecurity/new/main');
  assert.equal(url.searchParams.get('filename'), 'data/saved/2026-10-13-01.json');
  assert.deepEqual(JSON.parse(url.searchParams.get('value')), { schemaVersion: 1, id: '2026-10-13-01', sourceRevision: 'a'.repeat(40) });
  assert.deepEqual([...url.searchParams.keys()], ['filename', 'value']);
  assert.throws(() => favoriteLink({ id: '../../secrets' }, 'a'.repeat(40)), /无效/);
  assert.throws(() => favoriteLink({ id: '2026-10-13-01' }, 'main; echo bad'), /无效/);
});

test('共同收藏从Git版本恢复完整记录，清理前物化，源日文件删除后仍可检索', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gm-favorite-test-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    await mkdir(path.join(root, 'data/days'), { recursive: true });
    await mkdir(path.join(root, 'data/saved'), { recursive: true });
    const old = { id: '2026-10-10-01', date: '2026-10-10', title: '已过期的前序新闻', previous: { ids: [], note: '无' } };
    const news = { id: '2026-10-11-01', date: '2026-10-11', rank: 1, title: '完整共同收藏', summary: '清理后仍有完整的研究说明', keywords: ['特殊关键字', '共识'], tags: ['consensus'], relevance: { level: 'direct' }, previous: { ids: [old.id], note: '有前序' } };
    for (const item of [old, news]) await writeFile(path.join(root, `data/days/${item.date}.json`), JSON.stringify({ date: item.date, items: [item] }));
    git('init'); git('add', 'data');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture source');
    const sourceRevision = git('rev-parse', 'HEAD');
    const record = { schemaVersion: 1, id: news.id, sourceRevision };
    await writeFile(path.join(root, `data/saved/${news.id}.json`), JSON.stringify(record));
    const saved = await loadSavedRecords(root);
    assert.equal(saved[0].item.summary, news.summary);
    assert.equal(saved[0].item.previous.records[0].title, old.title);
    const pruned = pruneArchive([{ date: news.date, items: [news] }], saved.map(record => record.item), '2026-10-15');
    assert.equal(pruned.days.length, 0);
    assert.equal(pruned.favorites.length, 1);
    await materializeSavedRecords(root, saved);
    await unlink(path.join(root, `data/days/${news.date}.json`));
    const materialized = JSON.parse(await readFile(path.join(root, `data/saved/${news.id}.json`), 'utf8'));
    assert.equal(resolveSavedRecord(materialized, 'directory-without-git').summary, news.summary);
    assert.equal(filterNews([materialized.item], { date: 'all', query: '特殊关键字', tags: [], relevance: 'all' }).length, 1);
    assert.throws(() => resolveSavedRecord({ ...record, id: '../outside' }, root), /格式/);
    assert.throws(() => resolveSavedRecord({ ...record, sourceRevision: 'main:other' }, root), /版本/);
  } finally {
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert(path.basename(root).startsWith('gm-favorite-test-'));
    await rm(root, { recursive: true, force: true });
  }
});
