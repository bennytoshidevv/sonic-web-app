// Vertical bar chart for ONE series (e.g. sales per day), in sonic-blue.
// - thin bars with 4px rounded tops, a 2px gap between bars, a faint middle grid line
// - the highest bar is labeled directly; every bar shows its value on hover
// - a hidden table gives screen readers the same numbers
//   data: [{ key, label, value }]   formatValue: (number) => string
export default function BarChart({ data, formatValue, title }) {
  const max = Math.max(...data.map((d) => d.value), 0)
  const peak = max > 0 ? data.find((d) => d.value === max) : null
  // With many bars, only label every few days so the labels never collide
  const labelEvery = data.length > 14 ? Math.ceil(data.length / 10) : 1

  return (
    <figure>
      <div aria-hidden="true" className="relative flex h-56 items-end gap-0.5 border-b border-sonic-border pt-8">
        <span className="pointer-events-none absolute inset-x-0 top-[calc(50%+1rem)] border-t border-dashed border-sonic-border" />
        {data.map((d, index) => {
          const height = max > 0 ? (d.value / max) * 100 : 0
          return (
            <div key={d.key} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              {/* Direct label on the peak; hover/focus label on every bar.
                  Labels open toward the middle of the chart so they never stick out of it. */}
              <span
                className={`pointer-events-none absolute z-10 ${index < data.length / 2 ? 'left-0' : 'right-0'} rounded-md bg-sonic-ink px-2 py-1 text-caption font-semibold whitespace-nowrap text-white transition ${
                  d === peak ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                style={{ bottom: `calc(${height}% + 6px)` }}
              >
                {d.label} · {formatValue(d.value)}
              </span>
              <span
                className="w-full max-w-10 rounded-t-[4px] bg-sonic-blue transition group-hover:bg-sonic-blue-dark"
                style={{ height: `${height}%`, minHeight: d.value > 0 ? 3 : 0 }}
              />
            </div>
          )
        })}
      </div>
      <div aria-hidden="true" className="mt-2 flex gap-0.5">
        {data.map((d, i) => (
          <span key={d.key} className="min-w-0 flex-1 truncate text-center text-caption text-sonic-muted">
            {i % labelEvery === 0 ? d.label : ''}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td>{formatValue(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
