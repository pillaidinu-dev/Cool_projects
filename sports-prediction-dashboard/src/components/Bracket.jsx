export default function Bracket({ matchups }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {matchups.map((m) => {
        const aFav = m.a.price >= m.b.price
        return (
          <div key={m.id} className="rounded-2xl border border-neutral-900 p-4">
            <div className="mb-3 text-xs font-medium tracking-wide text-neutral-500 uppercase">{m.round}</div>
            <Side name={m.a.name} seed={m.a.seed} price={m.a.price} favorite={aFav} />
            <div className="my-2 border-t border-neutral-900" />
            <Side name={m.b.name} seed={m.b.seed} price={m.b.price} favorite={!aFav} />
          </div>
        )
      })}
    </div>
  )
}

function Side({ name, seed, price, favorite }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${favorite ? 'font-semibold text-white' : 'text-neutral-400'}`}>
        {name} <span className="text-neutral-600">({seed})</span>
      </span>
      <span className={`font-mono text-sm font-semibold ${favorite ? 'text-[#00c805]' : 'text-neutral-500'}`}>
        {price.toFixed(1)}¢
      </span>
    </div>
  )
}
