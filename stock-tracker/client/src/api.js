async function request(url, options) {
  const res = await fetch(url, options);
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request to ${url} failed (${res.status})`);
  return body;
}

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const fetchHealth = () => request('/api/health');
export const fetchPortfolio = () => request('/api/portfolio');
export const fetchPortfolioHistory = (range) => request(`/api/portfolio/history?range=${range}`);
export const fetchTransactions = () => request('/api/transactions');
export const addTransaction = (tx) => request('/api/transactions', json('POST', tx));
export const deleteTransaction = (id) => request(`/api/transactions/${id}`, { method: 'DELETE' });
export const fetchWatchlist = () => request('/api/watchlist');
export const addToWatchlist = (symbol) => request('/api/watchlist', json('POST', { symbol }));
export const removeFromWatchlist = (symbol) =>
  request(`/api/watchlist/${encodeURIComponent(symbol)}`, { method: 'DELETE' });
export const fetchQuote = (symbol) => request(`/api/market/quote/${encodeURIComponent(symbol)}`);
export const fetchTickerHistory = (symbol, range) =>
  request(`/api/market/history/${encodeURIComponent(symbol)}?range=${range}`);
