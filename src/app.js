(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('archive-data').textContent);
  const $ = id => document.getElementById(id);
  const dates = data.days.map(day => day.date).sort().reverse();
  const itemsById = new Map(Object.entries(data.previousRecords).map(([id, item]) => [id, item]));
  const cache = new Map(data.initialItems.map(item => [item.id, item]));
  const favoriteIds = new Set(data.favoriteIds);
  const recentRange = recentWindow(beijingDate());
  const monthRequests = new Map();
  let revision = 0;
  let pageNumber = 1;
  const pageSize = 40;
  const relevanceLabels = { direct: '直接相关', indirect: '间接相关', none: '暂无明显相关' };
  let filters = readFilters(location.search, dates, data.taxonomy);
  let visible = [];
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const link = (name, url) => {
    const a = element('a', name);
    try {
      if (!['https:', 'http:'].includes(new URL(url).protocol)) return element('span', name);
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    } catch { return element('span', name); }
    return a;
  };
  const counts = data.tagCounts;
  const usedTags = Object.keys(data.taxonomy).filter(tag => counts[tag]);
  async function setFilters(next) { filters = { ...filters, item: '', ...next }; pageNumber = 1; await render(true); }
  function chooseTag(tag) {
    setFilters({ view: filters.view === 'favorites' ? 'favorites' : 'all', date: 'all', tags: filters.tags.includes(tag) ? filters.tags.filter(value => value !== tag) : [...filters.tags, tag] });
  }
  async function openItem(item) {
    await setFilters({ view: 'all', date: item.date, tags: [], query: '', relevance: 'all', item: item.id });
    focusItem(item.id);
  }
  function focusItem(id) {
    const row = $('item-' + id);
    const wrap = document.querySelector('.table-wrap');
    if (row) wrap.scrollTo({ top: Math.max(0, row.offsetTop - wrap.clientHeight / 2), left: 0, behavior: 'smooth' });
  }
  function renderRow(item) {
    const row = element('tr'); row.id = 'item-' + item.id;
    if (filters.item === item.id) row.classList.add('highlight');
    const cells = Array.from({ length: 8 }, () => element('td'));
    const date = element('div', undefined, 'row-date');
    date.append(element('span', item.date), element('span', '#' + String(item.rank).padStart(2, '0'), 'rank'));
    cells[0].append(date, element('div', item.title, 'news-title'));
    const favorite = favoriteIds.has(item.id);
    const heart = element(favorite ? 'span' : 'a', favorite ? '♥ 已收藏 · 全站保留' : '♡ 收藏', 'heart' + (favorite ? ' saved' : ''));
    heart.title = favorite ? '任一作者／协作者保存后，全站共同保留完整记录。' : '仅仓库作者或有写权限的协作者能保存：在 GitHub 确认提交后生效。';
    if (!favorite) {
      heart.href = favoriteLink(item, data.sourceRevision); heart.target = '_blank'; heart.rel = 'noopener noreferrer';
    }
    cells[0].append(heart);
    const rowTags = element('div', undefined, 'row-tags');
    for (const tag of item.tags) {
      const button = element('button', data.taxonomy[tag].label, 'row-tag'); button.type = 'button';
      button.addEventListener('click', () => chooseTag(tag)); rowTags.append(button);
    }
    cells[0].append(rowTags);
    cells[1].append(element('div', item.keywords.join(' · '), 'keywords'), element('div', item.focus));
    cells[2].append(element('div', item.sourceNote));
    const sources = element('div', undefined, 'sources');
    item.sources.forEach(source => sources.append(link(source.name + ' ↗', source.url)));
    cells[2].append(sources);
    cells[3].textContent = item.summary;
    cells[4].textContent = item.impact;
    cells[5].textContent = item.researchApplications;
    cells[6].append(element('span', relevanceLabels[item.relevance.level], 'badge ' + item.relevance.level), element('div', item.relevance.reason));
    cells[7].append(element('div', item.previous.note));
    for (const id of item.previous.ids) {
      const previous = itemsById.get(id) || cache.get(id);
      if (!previous) continue;
      const a = element('a', previous.date + ' · ' + previous.title, 'previous-link');
      a.href = '?' + filterParams({ view: 'all', date: previous.date, query: '', tags: [], mode: 'any', relevance: 'all', item: id });
      a.addEventListener('click', event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); openItem(previous); } });
      cells[7].append(a);
    }
    for (const previous of item.previous.records || []) {
      if (cache.has(previous.id)) {
        const a = element('a', previous.date + ' · ' + previous.title, 'previous-link');
        a.href = '?' + filterParams({ view: 'all', date: previous.date, query: '', tags: [], mode: 'any', relevance: 'all', item: previous.id });
        a.addEventListener('click', event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); openItem(previous); } });
        cells[7].append(a);
      } else cells[7].append(element('div', previous.date + ' · ' + previous.title + '（未收藏，正文已清理）', 'previous-link'));
    }
    row.append(...cells); return row;
  }
  async function ensureHistory(state) {
    if (state.view === 'recent' || state.view === 'favorites' || data.totalItems === cache.size) return;
    if (state.date === data.latestDate) return;
    const required = data.months.filter(month => {
      if (state.date !== 'all' && state.date.slice(0, 7) !== month.month) return false;
      if (!state.tags.length) return true;
      return state.mode === 'all' ? state.tags.every(tag => month.tags.includes(tag)) : state.tags.some(tag => month.tags.includes(tag));
    });
    await Promise.all(required.map(month => {
      if (!monthRequests.has(month.month)) {
        const request = (async () => {
          const response = await fetch(month.path + '?v=' + encodeURIComponent(data.generatedAt));
          if (!response.ok) throw new Error('HTTP ' + response.status);
          const shard = await response.json();
          for (const item of shard.items) { cache.set(item.id, item); itemsById.set(item.id, item); }
        })().catch(error => { monthRequests.delete(month.month); throw error; });
        monthRequests.set(month.month, request);
      }
      return monthRequests.get(month.month);
    }));
  }
  function paintRows() {
    const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
    pageNumber = Math.min(pageNumber, totalPages);
    $('news').replaceChildren(...visible.slice((pageNumber - 1) * pageSize, pageNumber * pageSize).map(renderRow));
    $('pagination').hidden = totalPages <= 1;
    $('page-label').textContent = `第 ${pageNumber} / ${totalPages} 页 · 每页 ${pageSize} 条`;
    $('previous-page').disabled = pageNumber <= 1;
    $('next-page').disabled = pageNumber >= totalPages;
  }
  async function render(updateUrl = false) {
    const thisRevision = ++revision;
    const state = { ...filters, tags: [...filters.tags] };
    $('date').value = filters.date; $('query').value = filters.query;
    $('mode').value = filters.mode; $('relevance').value = filters.relevance;
    for (const [id, view] of [['latest', 'recent'], ['archive', 'all'], ['favorites', 'favorites']]) {
      $(id).classList.toggle('active', filters.view === view);
      $(id).setAttribute('aria-pressed', String(filters.view === view));
    }
    $('heading').textContent = filters.view === 'favorites' ? '爱心收藏 · 共同保留' : filters.view === 'recent' ? '早上 08:30，瞅一眼' : '保留的新闻与收藏';
    $('result-count').textContent = '正在读取所选历史月份…';
    $('load-error').hidden = true;
    $('download').disabled = true;
    for (const button of $('tags').children) button.setAttribute('aria-pressed', String(filters.tags.includes(button.dataset.tag)));
    if (updateUrl) {
      try { history.replaceState(null, '', '?' + filterParams(filters)); } catch { /* File previews still support latest-day filters. */ }
    }
    try { await ensureHistory(state); }
    catch {
      if (thisRevision !== revision) return;
      $('result-count').textContent = '历史数据尚未加载完成';
      $('load-error').hidden = false;
      $('load-error').textContent = '读取保留记录失败，请重试，或先查看最近三天。不会把加载失败显示为没有新闻。';
      $('news').replaceChildren(); $('empty').hidden = true; $('pagination').hidden = true;
      return;
    }
    if (thisRevision !== revision) return;
    const candidates = [...cache.values()].filter(item => state.view === 'favorites' ? favoriteIds.has(item.id) : state.view === 'recent' ? item.date >= recentRange.start && item.date <= recentRange.end : favoriteIds.has(item.id) || item.date >= recentRange.start && item.date <= recentRange.end);
    visible = filterNews(candidates, state, data.taxonomy);
    $('download').disabled = false;
    $('result-count').textContent = `找到 ${visible.length} 条新闻 · ${new Set(visible.map(item => item.date)).size} 天 · 横向滑动查看八列`;
    const selectedDay = data.days.find(day => day.date === filters.date);
    $('day-note').textContent = selectedDay?.note || (state.view === 'favorites' ? '任一作者／协作者收藏后，全站共同保留完整记录，不受三天清理影响。' : '日期从新到旧，每天按重要程度排列；超过三天只清理未收藏的新闻。');
    $('empty').querySelector('h3').textContent = state.view === 'favorites' && !data.favoriteIds.length ? '还没有共享收藏' : '没有匹配的新闻';
    const focusedIndex = filters.item ? visible.findIndex(item => item.id === filters.item) : -1;
    if (focusedIndex >= 0) pageNumber = Math.floor(focusedIndex / pageSize) + 1;
    paintRows();
    $('empty').hidden = visible.length !== 0;
    document.querySelector('.table-wrap').hidden = visible.length === 0;
    if (updateUrl) document.querySelector('.table-wrap').scrollTo({ top: 0, left: 0 });
    if (filters.item) focusItem(filters.item);
  }
  $('latest-date').textContent = data.latestDate || '暂无日报';
  const recentCount = data.initialItems.filter(item => item.date >= recentRange.start && item.date <= recentRange.end).length;
  $('overview').textContent = `${recentRange.start} — ${recentRange.end} · 最近三天 ${recentCount} 条 · 共享收藏 ${favoriteIds.size} 条`;
  $('generated-at').textContent = '本页版本生成于 ' + new Date(data.generatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  $('date').append(new Option('全部日期', 'all'), ...dates.map(date => new Option(date, date)));
  for (const tag of usedTags) {
    const button = element('button', undefined, 'tag'); button.type = 'button'; button.dataset.tag = tag;
    button.append(element('span', data.taxonomy[tag].label), element('span', String(counts[tag]), 'count'));
    button.title = data.taxonomy[tag].description; button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => chooseTag(tag)); $('tags').append(button);
  }
  $('latest').addEventListener('click', () => setFilters({ view: 'recent', date: 'all', tags: [], query: '', relevance: 'all' }));
  $('archive').addEventListener('click', () => setFilters({ view: 'all', date: 'all' }));
  $('favorites').addEventListener('click', () => setFilters({ view: 'favorites', date: 'all', query: '', tags: [], relevance: 'all' }));
  $('date').addEventListener('change', event => setFilters({ view: 'all', date: event.target.value }));
  let searchTimer;
  $('query').addEventListener('input', event => {
    clearTimeout(searchTimer);
    const query = event.target.value;
    searchTimer = setTimeout(() => setFilters({ query, date: 'all', view: filters.view === 'favorites' ? 'favorites' : 'all' }), 180);
  });
  $('mode').addEventListener('change', event => setFilters({ mode: event.target.value }));
  $('relevance').addEventListener('change', event => setFilters({ relevance: event.target.value }));
  const reset = () => setFilters({ view: 'all', date: 'all', tags: [], query: '', mode: 'any', relevance: 'all' });
  $('reset').addEventListener('click', reset); $('empty-reset').addEventListener('click', reset);
  $('previous-page').addEventListener('click', () => { pageNumber--; paintRows(); document.querySelector('.table-wrap').scrollTo(0, 0); });
  $('next-page').addEventListener('click', () => { pageNumber++; paintRows(); document.querySelector('.table-wrap').scrollTo(0, 0); });
  $('share').addEventListener('click', async () => {
    try {
      if (location.protocol === 'file:') throw new Error('local');
      await navigator.clipboard.writeText(location.href);
      $('share').textContent = '已复制链接 ✓';
    } catch { $('share').textContent = '请复制地址栏链接'; }
    setTimeout(() => { $('share').textContent = '复制检索链接 ↗'; }, 2500);
  });
  $('download').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, timezone: data.timezone, filters, items: visible }, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = element('a');
    a.href = url; a.download = `gm-ai-security-${filters.date}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  window.addEventListener('popstate', () => { filters = readFilters(location.search, dates, data.taxonomy); render(); });
  render();
  if (filters.item) focusItem(filters.item);
})();
