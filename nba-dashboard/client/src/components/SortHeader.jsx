// A table header that sorts by its column: click to sort, click again to
// flip the direction. The active column shows an arrow and sets aria-sort.
export default function SortHeader({ label, title, active, dir, onSort, align = 'right', className = '' }) {
  return (
    <th
      className={`font-medium px-2 py-2 whitespace-nowrap text-${align} ${className}`}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      title={title}
    >
      <button
        type="button"
        onClick={onSort}
        className={`inline-flex items-center gap-1 uppercase hover:text-slate-200 ${active ? 'text-slate-100' : ''}`}
      >
        {label}
        <span className={active ? '' : 'opacity-0'} aria-hidden="true">
          {dir === 'asc' ? '▲' : '▼'}
        </span>
      </button>
    </th>
  );
}
