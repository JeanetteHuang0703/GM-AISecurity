export function beijingDate(now = new Date()) {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function recentWindow(today) {
  const start = new Date(today + 'T00:00:00Z');
  start.setUTCDate(start.getUTCDate() - 3);
  const end = new Date(today + 'T00:00:00Z');
  end.setUTCDate(end.getUTCDate() - 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function pruneArchive(days, favorites, today) {
  const { start } = recentWindow(today);
  const all = new Map([...days.flatMap(day => day.items), ...favorites].map(item => [item.id, item]));
  const keptDays = structuredClone(days.filter(day => day.date >= start));
  const keptFavorites = structuredClone(favorites);
  const available = new Set([...keptDays.flatMap(day => day.items), ...keptFavorites].map(item => item.id));
  for (const item of [...keptDays.flatMap(day => day.items), ...keptFavorites]) {
    const records = new Map((item.previous.records || []).map(record => [record.id, record]));
    for (const id of item.previous.ids) if (!available.has(id) && all.has(id)) {
      const { title, date } = all.get(id);
      records.set(id, { id, title, date });
    }
    item.previous.ids = item.previous.ids.filter(id => available.has(id));
    if (records.size) item.previous.records = [...records.values()];
  }
  return { days: keptDays, favorites: keptFavorites, removed: days.filter(day => day.date < start).map(day => day.date) };
}
