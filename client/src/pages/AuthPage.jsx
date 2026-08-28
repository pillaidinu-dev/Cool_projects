import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '', bio: '', inviteCode: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await signup(form);
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-amber-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🤝</div>
          <h1 className="text-2xl font-bold text-slate-900">PlanSync</h1>
          <p className="text-slate-500 text-sm mt-1">
            Match by doing things together, not by swiping.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex mb-5 rounded-lg bg-slate-100 p-1">
            <button
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${
                mode === 'login' ? 'bg-white shadow text-slate-900' : 'text-slate-500'
              }`}
              onClick={() => setMode('login')}
              type="button"
            >
              Log in
            </button>
            <button
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${
                mode === 'signup' ? 'bg-white shadow text-slate-900' : 'text-slate-500'
              }`}
              onClick={() => setMode('signup')}
              type="button"
            >
              Sign up
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                placeholder="Name"
                value={form.name}
                onChange={update('name')}
                required
              />
            )}
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={update('email')}
              required
            />
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={update('password')}
              required
            />
            {mode === 'signup' && (
              <textarea
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                placeholder="Short bio (optional)"
                value={form.bio}
                onChange={update('bio')}
                rows={2}
              />
            )}
            {mode === 'signup' && (
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                placeholder="Invite code (ask whoever invited you)"
                value={form.inviteCode}
                onChange={update('inviteCode')}
              />
            )}

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white font-medium rounded-lg py-2 text-sm transition"
            >
              {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Demo login: maya@example.com / password123
        </p>
      </div>
    </div>
  );
}
