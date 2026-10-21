async function request(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request to ${url} failed (${res.status})`);
  }
  return res.json();
}

function sendJson(method, url, body) {
  return request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function fetchPortfolio() {
  return request('/api/positions');
}

export function fetchHistory(range) {
  return request(`/api/history?range=${range}`);
}

export function fetchQuote(symbol) {
  return request(`/api/quote/${encodeURIComponent(symbol)}`);
}

export function addPosition(position) {
  return sendJson('POST', '/api/positions', position);
}

export function updatePosition(id, changes) {
  return sendJson('PUT', `/api/positions/${id}`, changes);
}

export function deletePosition(id) {
  return request(`/api/positions/${id}`, { method: 'DELETE' });
}
