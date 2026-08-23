const BASE = '/api';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  signup: (payload) => request('/auth/signup', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: (token) => request('/auth/me', { token }),
  updateMe: (token, payload) => request('/auth/me', { method: 'PATCH', body: payload, token }),

  createPlan: (token, payload) => request('/plans', { method: 'POST', body: payload, token }),
  browsePlans: (token, activityType) =>
    request(`/plans${activityType ? `?activityType=${encodeURIComponent(activityType)}` : ''}`, { token }),
  myPlans: (token) => request('/plans/mine', { token }),
  joinedPlans: (token) => request('/plans/joined', { token }),
  planDetail: (token, id) => request(`/plans/${id}`, { token }),
  joinPlan: (token, id) => request(`/plans/${id}/join`, { method: 'POST', token }),
  planJoins: (token, id) => request(`/plans/${id}/joins`, { token }),
  respondToJoin: (token, planId, joinId, accept) =>
    request(`/plans/${planId}/joins/${joinId}/respond`, { method: 'POST', body: { accept }, token }),
  confirmAttendance: (token, planId, withUserId) =>
    request(`/plans/${planId}/confirm-attendance`, { method: 'POST', body: { withUserId }, token }),

  matches: (token) => request('/matches', { token }),
  matchMessages: (token, matchId) => request(`/matches/${matchId}/messages`, { token }),
  sendMessage: (token, matchId, body) =>
    request(`/matches/${matchId}/messages`, { method: 'POST', body: { body }, token }),
};
