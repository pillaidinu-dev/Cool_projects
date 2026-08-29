import Sparkline from './Sparkline.jsx'

const flags = {
  ESP: '🇪🇸', SRB: '🇷🇸', GER: '🇩🇪', USA: '🇺🇸', RUS: '🇷🇺',
  BLR: '🇧🇾', POL: '🇵🇱', KAZ: '🇰🇿', FRA: '🇫🇷', CAN: '🇨🇦',
  CZE: '🇨🇿', JPN: '🇯🇵',
}

export default function MarketRow({ contender, selected, onSelect }) {
  const positive = contender.change >= 0

  return (
    <button
      onClick={() => onSelect(contender.id)}
      className={`grid w-full grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 border-b border-neutral-900 px-4 py-3 text-left transition-colors hover:bg-neutral-900/60 ${
        selected ? 'bg-neutral-900' : ''
      }`}
    >
      <span className="text-xl leading-none">{flags[contender.country] ?? '🎾'}</span>

      <span className="min-w-0">
        <span className="block truncate font-medium text-white">{contender.name}</span>
        <span className="block text-xs text-neutral-500">
          Seed {contender.seed} · Vol ${(contender.volume / 1000).toFixed(0)}k
        </span>
      </span>

      <span className="hidden sm:block">
        <Sparkline data={contender.history} positive={positive} />
      </span>

      <span className={`text-sm font-medium tabular-nums ${positive ? 'text-[#00c805]' : 'text-[#ff5000]'}`}>
        {positive ? '+' : ''}
        {contender.change.toFixed(1)}¢
      </span>

      <span className="w-16 text-right font-mono text-base font-semibold tabular-nums text-white">
        {contender.price.toFixed(1)}¢
      </span>
    </button>
  )
}
