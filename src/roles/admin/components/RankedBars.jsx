// Ranked list with horizontal bars for ONE measure (e.g. orders per restaurant), in sonic-blue.
// The label and value are written next to each bar, so the bar only shows the size.
//   rows: [{ key, label, sublabel, value, valueText }] (already sorted, biggest first)
export default function RankedBars({ rows, emptyText = 'No data in this range.' }) {
  const max = Math.max(...rows.map((r) => r.value), 0)
  if (rows.length === 0) return <p className="py-6 text-center text-small text-sonic-muted">{emptyText}</p>

  return (
    <ol className="flex flex-col gap-3">
      {rows.map((r, index) => (
        <li key={r.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-small">
            <span className="min-w-0 truncate">
              <span className="text-sonic-muted">{index + 1}.</span> <span className="font-semibold">{r.label}</span>
              {r.sublabel && <span className="text-sonic-muted"> · {r.sublabel}</span>}
            </span>
            <span className="shrink-0 font-display font-semibold">{r.valueText}</span>
          </div>
          <span className="h-2 overflow-hidden rounded-full bg-sonic-bg" aria-hidden="true">
            <span className="block h-full rounded-r-[4px] bg-sonic-blue" style={{ width: `${max > 0 ? (r.value / max) * 100 : 0}%` }} />
          </span>
        </li>
      ))}
    </ol>
  )
}
