import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import PlanCard from '../components/PlanCard';

export default function Feed() {
  const { token } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joiningId, setJoiningId] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .browsePlans(token)
      .then(({ plans }) => setPlans(plans))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  const join = async (planId) => {
    setJoiningId(planId);
    setError('');
    try {
      await api.joinPlan(token, planId);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Plans near you</h1>
      <p className="text-sm text-slate-500 mb-5">
        Ask to join something real. You only match with people after you've actually met up.
      </p>

      {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}
      {loading && <p className="text-sm text-slate-400">Loading…</p>}
      {!loading && plans.length === 0 && (
        <p className="text-sm text-slate-400">No open plans right now — check back soon, or host your own.</p>
      )}

      <div className="space-y-4">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            footer={
              plan.myJoinStatus ? null : (
                <button
                  onClick={() => join(plan.id)}
                  disabled={joiningId === plan.id || plan.spotsLeft === 0}
                  className="text-sm font-medium bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition"
                >
                  {plan.spotsLeft === 0
                    ? 'Full'
                    : joiningId === plan.id
                    ? 'Requesting…'
                    : 'Ask to join'}
                </button>
              )
            }
          />
        ))}
      </div>
    </div>
  );
}
