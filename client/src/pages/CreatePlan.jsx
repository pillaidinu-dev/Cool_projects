import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api } from '../api';

const ACTIVITY_TYPES = ['climbing', 'food', 'fitness', 'games', 'music', 'outdoors', 'coffee', 'art'];

function defaultPlanTime() {
  const d = new Date(Date.now() + 2 * 86400000);
  d.setMinutes(0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export default function CreatePlan() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    activityType: ACTIVITY_TYPES[0],
    location: '',
    planTime: defaultPlanTime(),
    capacity: 1,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: key === 'capacity' ? Number(e.target.value) : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.createPlan(token, { ...form, planTime: new Date(form.planTime).toISOString() });
      navigate('/mine');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Host a plan</h1>
      <p className="text-sm text-slate-500 mb-5">
        Post something real you're doing. People request to join, you pick who comes.
      </p>

      <form onSubmit={submit} className="space-y-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div>
          <label className="text-sm font-medium text-slate-700">Title</label>
          <input
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
            value={form.title}
            onChange={update('title')}
            placeholder="Saturday morning bouldering"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-slate-700">Activity</label>
            <select
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              value={form.activityType}
              onChange={update('activityType')}
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Capacity</label>
            <input
              type="number"
              min={1}
              max={10}
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              value={form.capacity}
              onChange={update('capacity')}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Location</label>
          <input
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
            value={form.location}
            onChange={update('location')}
            placeholder="Brooklyn Boulders"
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">When</label>
          <input
            type="datetime-local"
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
            value={form.planTime}
            onChange={update('planTime')}
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Description</label>
          <textarea
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
            value={form.description}
            onChange={update('description')}
            rows={3}
            placeholder="Anything people should know before requesting to join."
          />
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white font-medium rounded-lg py-2 text-sm transition"
        >
          {busy ? 'Posting…' : 'Post plan'}
        </button>
      </form>
    </div>
  );
}
