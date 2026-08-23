import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api } from '../api';

export default function Matches() {
  const { token } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .matches(token)
      .then(({ matches }) => setMatches(matches))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Matches</h1>
      <p className="text-sm text-slate-500 mb-5">People you've actually met up with.</p>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}
      {!loading && matches.length === 0 && (
        <p className="text-sm text-slate-400">
          No matches yet — join or host a plan, then confirm attendance afterward.
        </p>
      )}

      <div className="space-y-3">
        {matches.map((m) => (
          <Link
            key={m.id}
            to={`/matches/${m.id}`}
            className="block bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">{m.otherUser?.name}</p>
                <p className="text-xs text-slate-500">
                  matched from "{m.plan?.title}" · {m.plan?.location}
                </p>
              </div>
              <span className="text-2xl">💬</span>
            </div>
            {m.lastMessage && (
              <p className="text-sm text-slate-600 mt-2 truncate">{m.lastMessage.body}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
