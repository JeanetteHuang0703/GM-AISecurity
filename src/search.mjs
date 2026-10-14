export function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('zh-CN').trim();
}

export function filterNews(items, filters, taxonomy = {}) {
  const tokens = normalize(filters.query).split(/\s+/).filter(Boolean);
  const tags = filters.tags || [];
  return items.filter(item => {
    if (filters.date && filters.date !== 'all' && item.date !== filters.date) return false;
    if (filters.relevance && filters.relevance !== 'all' && item.relevance.level !== filters.relevance) return false;
    if (tags.length && !(filters.mode === 'all'
      ? tags.every(tag => item.tags.includes(tag))
      : tags.some(tag => item.tags.includes(tag)))) return false;
    const haystack = normalize(JSON.stringify(item) + item.tags.map(tag => taxonomy[tag]?.label || tag).join(' '));
    return tokens.every(token => haystack.includes(token));
  }).sort((a, b) => b.date.localeCompare(a.date) || a.rank - b.rank || a.id.localeCompare(b.id));
}

export function readFilters(search, dates, taxonomy) {
  const params = new URLSearchParams(search);
  const selectedTags = [...new Set((params.get('tags') || '').split(',').filter(tag => Object.hasOwn(taxonomy, tag)))];
  const date = params.get('date') || 'all';
  return {
    view: ['all', 'favorites'].includes(params.get('view')) ? params.get('view') : 'recent',
    date: dates.includes(date) || date === 'all' ? date : 'all',
    query: params.get('q') || '',
    tags: selectedTags,
    mode: params.get('mode') === 'all' ? 'all' : 'any',
    relevance: ['direct', 'indirect', 'none'].includes(params.get('relevance')) ? params.get('relevance') : 'all',
    item: params.get('item') || ''
  };
}

export function filterParams(filters) {
  const params = new URLSearchParams();
  if (filters.view && filters.view !== 'recent') params.set('view', filters.view);
  if (filters.date) params.set('date', filters.date);
  if (filters.query) params.set('q', filters.query);
  if (filters.tags.length) params.set('tags', filters.tags.join(','));
  if (filters.mode === 'all') params.set('mode', 'all');
  if (filters.relevance !== 'all') params.set('relevance', filters.relevance);
  if (filters.item) params.set('item', filters.item);
  return params.toString();
}
