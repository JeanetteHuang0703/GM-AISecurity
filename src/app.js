(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('archive-data').textContent);
  const $ = id => document.getElementById(id);
  const dates = data.days.map(day => day.date).sort().reverse();
  const itemsById = new Map(data.items.map(item => [item.id, item]));
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
  const counts = Object.fromEntries(Object.keys(data.taxonomy).map(tag => [tag, data.items.filter(item => item.tags.includes(tag)).length]));
  const usedTags = Object.keys(data.taxonomy).filter(tag => counts[tag]);
  function setFilters(next) { filters = { ...filters, item: '', ...next }; render(true); }
  function chooseTag(tag) {
    setFilters({ date: 'all', tags: filters.tags.includes(tag) ? filters.tags.filter(value => value !== tag) : [...filters.tags, tag] });
  }
  function openItem(item) {
    setFilters({ date: item.date, tags: [], query: '', relevance: 'all', item: item.id });
    $('item-' + item.id)?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  }
  function renderRow(item) {
    const row = element('tr'); row.id = 'item-' + item.id;
    if (filters.item === item.id) row.classList.add('highlight');
    const cells = Array.from({ length: 8 }, () => element('td'));
    const date = element('div', undefined, 'row-date');
    date.append(element('span', item.date), element('span', '#' + String(item.rank).padStart(2, '0'), 'rank'));
    cells[0].append(date, element('div', item.title, 'news-title'));
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
      const previous = itemsById.get(id);
      const a = element('a', previous.date + ' · ' + previous.title, 'previous-link');
      a.href = '?' + filterParams({ date: previous.date, query: '', tags: [], mode: 'any', relevance: 'all', item: id });
      a.addEventListener('click', event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); openItem(previous); } });
      cells[7].append(a);
    }
    row.append(...cells); return row;
  }
  function render(updateUrl = false) {
    visible = filterNews(data.items, filters, data.taxonomy);
    $('date').value = filters.date; $('query').value = filters.query;
    $('mode').value = filters.mode; $('relevance').value = filters.relevance;
    $('latest').classList.toggle('active', filters.date === dates[0]);
    $('archive').classList.toggle('active', filters.date === 'all');
    $('latest').setAttribute('aria-pressed', String(filters.date === dates[0]));
    $('archive').setAttribute('aria-pressed', String(filters.date === 'all'));
    $('heading').textContent = filters.date === 'all' ? '历史新闻档案' : filters.date + ' 日报';
    $('result-count').textContent = `找到 ${visible.length} 条新闻 · ${new Set(visible.map(item => item.date)).size} 天 · 每日按重要程度排序`;
    const selectedDay = data.days.find(day => day.date === filters.date);
    $('day-note').textContent = selectedDay?.note || '日期从新到旧排列。选择标签会检索全部历史；可再限定日期。';
    $('news').replaceChildren(...visible.map(renderRow));
    $('empty').hidden = visible.length !== 0;
    document.querySelector('.table-wrap').hidden = visible.length === 0;
    for (const button of $('tags').children) button.setAttribute('aria-pressed', String(filters.tags.includes(button.dataset.tag)));
    if (updateUrl) {
      try { history.replaceState(null, '', '?' + filterParams(filters)); } catch { /* Local file previews still support filters. */ }
    }
  }
  $('latest-date').textContent = data.latestDate || '暂无日报';
  $('overview').textContent = `${data.days.length} 天档案 · ${data.items.length} 条新闻 · ${usedTags.length} 个标签`;
  $('date').append(new Option('全部历史', 'all'), ...dates.map(date => new Option(date, date)));
  for (const tag of usedTags) {
    const button = element('button', undefined, 'tag'); button.type = 'button'; button.dataset.tag = tag;
    button.append(element('span', data.taxonomy[tag].label), element('span', String(counts[tag]), 'count'));
    button.title = data.taxonomy[tag].description; button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => chooseTag(tag)); $('tags').append(button);
  }
  $('latest').addEventListener('click', () => setFilters({ date: dates[0] || 'all', tags: [], query: '', relevance: 'all' }));
  $('archive').addEventListener('click', () => setFilters({ date: 'all' }));
  $('date').addEventListener('change', event => setFilters({ date: event.target.value }));
  $('query').addEventListener('input', event => setFilters({ query: event.target.value }));
  $('mode').addEventListener('change', event => setFilters({ mode: event.target.value }));
  $('relevance').addEventListener('change', event => setFilters({ relevance: event.target.value }));
  const reset = () => setFilters({ date: 'all', tags: [], query: '', mode: 'any', relevance: 'all' });
  $('reset').addEventListener('click', reset); $('empty-reset').addEventListener('click', reset);
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
  if (filters.item) $('item-' + filters.item)?.scrollIntoView({ block: 'center', inline: 'nearest' });
})();
