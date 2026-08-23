const ACTIVITY_EMOJI = {
  climbing: '🧗',
  food: '🍣',
  fitness: '🏃',
  games: '🎲',
  music: '🎵',
  outdoors: '🌲',
  coffee: '☕',
  art: '🎨',
};

export function formatPlanTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function PlanCard({ plan, footer }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{ACTIVITY_EMOJI[plan.activityType] || '✨'}</span>
            <h3 className="font-semibold text-slate-900">{plan.title}</h3>
          </div>
          <p className="text-sm text-slate-500">
            {plan.location} · {formatPlanTime(plan.planTime)}
          </p>
        </div>
        {plan.host && (
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full whitespace-nowrap">
            hosted by {plan.host.name}
          </span>
        )}
      </div>
      {plan.description && <p className="text-sm text-slate-600 mt-3">{plan.description}</p>}
      <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
        <span>
          {plan.acceptedCount}/{plan.capacity} confirmed · {plan.spotsLeft} spot
          {plan.spotsLeft === 1 ? '' : 's'} left
        </span>
        {plan.myJoinStatus && (
          <span
            className={`px-2 py-0.5 rounded-full font-medium ${
              plan.myJoinStatus === 'accepted'
                ? 'bg-emerald-100 text-emerald-700'
                : plan.myJoinStatus === 'declined'
                ? 'bg-slate-100 text-slate-500'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {plan.myJoinStatus}
          </span>
        )}
      </div>
      {footer && <div className="mt-4">{footer}</div>}
    </div>
  );
}
