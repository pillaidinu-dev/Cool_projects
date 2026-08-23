import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import PlanCard from '../components/PlanCard';

export default function JoinedPlans() {
  const { token } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [confirmedIds, setConfirmedIds] = useState(new Set());

  const load = () => {
    setLoading(true);
    api
      .joinedPlans(token)
      .then(({ plans }) => setPlans(plans))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  const confirm = async (plan) => {
    setBusyId(plan.id);
    try {
      await api.confirmAttendance(token, plan.id, plan.host.id);
      setConfirmedIds((prev) => new Set(prev).add(plan.id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Plans you've joined</h1>
      <p className="text-sm text-slate-500 mb-5">
        After the plan happens, confirm you met the host to unlock a match.
      </p>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}
      {!loading && plans.length === 0 && (
        <p className="text-sm text-slate-400">Nothing here yet — go join a plan from the feed.</p>
      )}

      <div className="space-y-4">
        {plans.map((plan) => {
          const hasHappened = new Date(plan.planTime) <= new Date();
          const confirmed = confirmedIds.has(plan.id);
          return (
            <PlanCard
              key={plan.id}
              plan={plan}
              footer={
                hasHappened ? (
                  <button
                    onClick={() => confirm(plan)}
                    disabled={busyId === plan.id || confirmed}
                    className="text-sm font-medium bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition"
                  >
                    {confirmed ? 'Confirmed ✓' : busyId === plan.id ? 'Confirming…' : 'We met — confirm'}
                  </button>
                ) : (
                  <p className="text-xs text-slate-400">Confirmation opens once the plan has happened.</p>
                )
              }
            />
          );
        })}
      </div>
    </div>
  );
}
