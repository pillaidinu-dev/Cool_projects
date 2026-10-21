async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request to ${url} failed (${res.status})`);
  }
  return res.json();
}

export function fetchGames(date) {
  return getJson(`/api/games?date=${date}`);
}

export function fetchLeaders(date) {
  return getJson(`/api/leaders?date=${date}`);
}

export function fetchLatestProps() {
  return getJson('/api/props/latest');
}

export function fetchPropHistory() {
  return getJson('/api/props/history');
}

export function fetchSlateDates() {
  return getJson('/api/props/dates');
}

export function fetchSlate(date) {
  return getJson(`/api/props/date/${date}`);
}
