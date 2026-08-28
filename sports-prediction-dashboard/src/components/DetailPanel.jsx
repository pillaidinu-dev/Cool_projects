import Sparkline from './Sparkline.jsx'

export default function DetailPanel({ contender }) {
  if (!contender) {
    return (
      <div className="flex h-full min-h-64 items-center justify-center rounded-2xl border border-neutral-900 p-8 text-center text-neutral-500">
        Select a contender to see contract details
      </div>
    )
  }

  const positive = contender.change >= 0

  return (
    <div className="rounded-2xl border border-neutral-900 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{contender.name}</h3>
          <p className="text-sm text-neutral-500">
            To win the title · Seed {contender.seed} · {contender.country}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-bold text-white">{contender.price.toFixed(1)}¢</div>
          <div className={`text-sm font-medium ${positive ? 'text-[#00c805]' : 'text-[#ff5000]'}`}>
            {positive ? '+' : ''}
            {contender.change.toFixed(1)}¢ ({contender.changePct}%)
          </div>
        </div>
      </div>

      <div className="my-5">
        <Sparkline data={contender.history} positive={positive} width={480} height={120} />
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg bg-neutral-900 p-3">
          <div className="text-neutral-500">Implied probability</div>
          <div className="font-mono text-white">{contender.price.toFixed(1)}%</div>
        </div>
        <div className="rounded-lg bg-neutral-900 p-3">
          <div className="text-neutral-500">24h volume</div>
          <div className="font-mono text-white">${(contender.volume / 1000).toFixed(0)}k</div>
        </div>
        <div className="rounded-lg bg-neutral-900 p-3">
          <div className="text-neutral-500">Payout if Yes</div>
          <div className="font-mono text-white">$1.00 / share</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          disabled
          className="cursor-not-allowed rounded-xl bg-[#00c805]/20 py-3 text-center font-semibold text-[#00c805] opacity-60"
          title="Demo dashboard — trading is disabled"
        >
          Buy Yes · {contender.price.toFixed(0)}¢
        </button>
        <button
          disabled
          className="cursor-not-allowed rounded-xl bg-[#ff5000]/20 py-3 text-center font-semibold text-[#ff5000] opacity-60"
          title="Demo dashboard — trading is disabled"
        >
          Buy No · {(100 - contender.price).toFixed(0)}¢
        </button>
      </div>
    </div>
  )
}
