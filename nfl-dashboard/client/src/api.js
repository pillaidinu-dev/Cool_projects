async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request to ${url} failed (${res.status})`);
  }
  return res.json();
}

export function fetchGames() {
  return getJson('/api/games');
}

export function fetchLeaders() {
  return getJson('/api/leaders');
}

export function fetchPredictions() {
  return getJson('/api/predictions');
}
