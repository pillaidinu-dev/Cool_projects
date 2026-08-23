import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import PlanCard from '../components/PlanCard';

function JoinRequests({ plan, token, onChanged }) {
  const [joins, setJoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const hasHappened = new Date(plan.planTime) <= new Date();

  const load = () => {
    setLoading(true);
    api
      .planJoins(token, plan.id)
      .then(({ joins }) => setJoins(joins))
      .finally(() => setLoading(false));
  };

  useEffect(load, [plan.id, token]);

  const respond = async (joinId, accept) => {
    setBusyId(joinId);
    try {
      await api.respondToJoin(token, plan.id, joinId, accept);
      load();
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  };

  const confirm = async (userId) => {
    setBusyId(userId);
    try {
      await api.confirmAttendance(token, plan.id, userId);
      load();
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <p className="text-xs text-slate-400">Loading requests…</p>;
  if (joins.length === 0) return <p className="text-xs text-slate-400">No requests yet.</p>;

  return (
    <ul className="space-y-2">
      {joins.map((j) => (
        <li key={j.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
          <div>
            <p className="text-sm font-medium text-slate-800">{j.user.name}</p>
            {j.user.bio && <p className="text-xs text-slate-500">{j.user.bio}</p>}
          </div>
          {j.status === 'pending' && (
            <div className="flex gap-2">
              <button
                onClick={() => respond(j.id, true)}
                disabled={busyId === j.id}
                className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded-full"
              >
                Accept
              </button>
              <button
                onClick={() => respond(j.id, false)}
                disabled={busyId === j.id}
                className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1 rounded-full"
              >
                Decline
              </button>
            </div>
          )}
          {j.status === 'accepted' && !hasHappened && (
            <span className="text-xs text-emerald-600 font-medium">Confirmed</span>
          )}
          {j.status === 'accepted' && hasHappened && (
            <button
              onClick={() => confirm(j.user.id)}
              disabled={busyId === j.user.id}
              className="text-xs bg-rose-500 hover:bg-rose-600 text-white px-3 py-1 rounded-full"
            >
              We met — confirm
            </button>
          )}
          {j.status === 'declined' && <span className="text-xs text-slate-400">Declined</span>}
        </li>
      ))}
    </ul>
  );
}

export default function MyPlans() {
  const { token } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api
      .myPlans(token)
      .then(({ plans }) => setPlans(plans))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Plans you're hosting</h1>
      <p className="text-sm text-slate-500 mb-5">
        Accept who joins. Once the plan has happened, confirm attendance to unlock a match.
      </p>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}
      {!loading && plans.length === 0 && (
        <p className="text-sm text-slate-400">You haven't hosted anything yet.</p>
      )}

      <div className="space-y-4">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            footer={
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Join requests
                </p>
                <JoinRequests plan={plan} token={token} onChanged={load} />
              </div>
            }
          />
        ))}
      </div>
    </div>
  );
}
