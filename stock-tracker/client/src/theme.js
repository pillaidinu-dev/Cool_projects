// Same values as the @theme tokens in index.css, for Recharts props that
// need literal colours.
export const CHART = {
  surface: '#1a1a19',
  ink: '#f0efec',
  ink2: '#c3c2b7',
  muted: '#898781',
  grid: '#2c2c2a',
  axis: '#383835',
  accent: '#3987e5',
  gain: '#0ca30c',
  loss: '#e66767',
  other: '#5f5e5a',
};

// Categorical slots in fixed order (validated for colour-vision deficiency
// on the dark surface). Past seven holdings the rest fold into "Other".
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'];

export const AXIS_TICK = { fill: CHART.muted, fontSize: 11 };

// Colour follows the ticker, not its rank: slots go to symbols in
// alphabetical order so a re-sort never repaints a holding.
export function makeColorFor(symbols) {
  const sorted = [...new Set(symbols)].sort();
  return (symbol) => {
    const i = sorted.indexOf(symbol);
    return i >= 0 && i < SERIES.length ? SERIES[i] : CHART.other;
  };
}

export const RANGES = ['1M', '3M', '6M', 'YTD', '1Y', '5Y', 'ALL'];
