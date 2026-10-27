// Next sort state after clicking `key`: a new column starts descending
// (biggest first, the useful order for numbers) or ascending for text; the
// same column flips.
export function nextSort(current, key, textKeys = ['name']) {
  if (current.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  return { key, dir: textKeys.includes(key) ? 'asc' : 'desc' };
}

// Compare two rows by a value getter; rows whose value is missing (no prop,
// no result yet) always sink to the bottom, whichever way the sort runs.
export function compareBy(get, dir) {
  return (a, b) => {
    const va = get(a);
    const vb = get(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const order = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
    return dir === 'asc' ? order : -order;
  };
}
