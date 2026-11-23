import { useEffect, useState } from 'react'
import {
  BadgeCheck,
  Banknote,
  CalendarDays,
  Calculator,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Printer,
  Receipt,
  Store,
  Wallet,
} from 'lucide-react'
import Button from '../../components/Button'
import EmptyState from '../../components/EmptyState'
import { useAuth } from '../../context/AuthContext'
import { getRiderHistory } from '../../data/mock'
import {
  deliveryGross,
  minutesBetween,
  orderExtraStoreFees,
  orderItemsSubtotal,
  orderTotal,
  riderShare,
  settlementAmounts,
  sumAmounts,
} from '../../lib/calc'
import { formatDate, formatDuration, formatMoney, formatTimestampTime, localDateKey } from '../../lib/format'
import { PAYMENT_METHOD_LABELS } from '../../lib/labels'

// Pay of one delivery from its frozen inputs (calc.js)
function runPay(run) {
  const fee = run.order.base_delivery_fee
  const allowance = run.earning.gas_allowance_amount
  const pct = run.earning.rider_share_pct
  const extra = orderExtraStoreFees(run.stores)
  return { fee, allowance, pct, extra, share: riderShare(fee, allowance, pct), gross: deliveryGross(fee, allowance, pct, extra) }
}

function runTotal(run) {
  return orderTotal(orderItemsSubtotal(run.stores.flatMap((s) => s.items)), run.order.base_delivery_fee, orderExtraStoreFees(run.stores))
}

function isCodCollected(run) {
  return run.payment?.payment_method === 'cod' && run.payment.payment_status === 'paid'
}

// One completed delivery: summary row that opens the pay breakdown
function RunItem({ run }) {
  const pay = runPay(run)
  const rows = [
    ['Barangay delivery fee', formatMoney(pay.fee)],
    ['Gas allowance', formatMoney(pay.allowance)],
    [`Rider share (${pay.pct}% of ${formatMoney(pay.fee - pay.allowance)})`, formatMoney(pay.share)],
  ]
  if (pay.extra > 0) rows.push(['Extra-store fees', `+${formatMoney(pay.extra)}`])

  return (
    <details className="group rounded-xl bg-white shadow-card">
      <summary className="flex cursor-pointer list-none flex-col gap-2 p-4 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-display text-small font-bold">#{run.order.order_number}</p>
            <p className="text-small text-sonic-ink">
              {run.order.dropoff_barangay}, {run.order.dropoff_city}
            </p>
            <p className="text-caption text-sonic-muted">Delivered {formatTimestampTime(run.delivered_at)}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="font-display text-h3 font-bold text-sonic-blue">{formatMoney(pay.gross)}</span>
            <span className="flex items-center gap-1 rounded-full bg-green-600/10 px-2 py-0.5 text-caption font-semibold text-green-700">
              <Check className="size-3" aria-hidden="true" />
              Delivered
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-sonic-bg px-2.5 py-1 text-caption text-sonic-muted">
            <Store className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {run.stores.length} {run.stores.length === 1 ? 'store' : 'stores'} ({run.stores.map((s) => s.name).join(' + ')})
            </span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-sonic-muted transition group-open:rotate-180" aria-hidden="true" />
        </div>
      </summary>

      <div className="flex flex-col gap-3 border-t border-sonic-border p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-display text-small font-semibold">
            <Calculator className="size-4 text-sonic-blue" aria-hidden="true" />
            Pay breakdown
          </span>
          <span className="rounded-full bg-sonic-blue-50 px-2 py-0.5 text-caption font-semibold text-sonic-blue">{pay.pct}% rider share</span>
        </div>
        <dl className="flex flex-col gap-1.5 rounded-lg bg-sonic-bg p-3 text-small">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-sonic-muted">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          <div className="mt-1 flex justify-between gap-3 border-t border-sonic-border pt-1.5 font-display font-bold">
            <dt>Your earning (allowance + share + extra)</dt>
            <dd className="text-sonic-blue">{formatMoney(pay.gross)}</dd>
          </div>
        </dl>
        <p className="flex items-center gap-2 text-small">
          <Banknote className={`size-4 shrink-0 ${isCodCollected(run) ? 'text-green-600' : 'text-sonic-muted'}`} aria-hidden="true" />
          {isCodCollected(run)
            ? `Cash on Delivery: ${formatMoney(runTotal(run))} collected`
            : `Paid via ${PAYMENT_METHOD_LABELS[run.payment.payment_method]}: nothing collected`}
        </p>
        <p className="text-caption text-sonic-muted">
          Customer: {run.customer_name} · {minutesBetween(run.order.placed_at, run.delivered_at)} min from order to door
        </p>
      </div>
    </details>
  )
}

export default function History() {
  const { user } = useAuth()
  const [shifts, setShifts] = useState(null)
  const [range, setRange] = useState('today') // 'today' | 'week' | 'date'
  const [pickedDate, setPickedDate] = useState('')
  const [today] = useState(() => localDateKey())
  const [now] = useState(() => new Date().toISOString())

  useEffect(() => {
    getRiderHistory(user.user_id).then(setShifts)
  }, [user.user_id])

  if (!shifts) return <p className="py-10 text-center text-sonic-muted">Loading your history…</p>

  // ---- Which shifts to show ----
  const weekStart = localDateKey(new Date(new Date(`${today}T00:00:00`).getTime() - 6 * 86400000))
  const selected = shifts.filter(({ shift }) => {
    if (range === 'today') return shift.shift_date === today
    if (range === 'week') return shift.shift_date >= weekStart && shift.shift_date <= today
    return shift.shift_date === pickedDate
  })

  // ---- Totals of the selected shifts (calc.js) ----
  const runs = selected.flatMap((s) => s.runs)
  const deductions = selected.flatMap((s) => s.deductions)
  const gross = runs.reduce((sum, run) => sum + runPay(run).gross, 0)
  const totalDeductions = sumAmounts(deductions)
  const netPay = gross - totalDeductions
  const codCollected = runs.filter(isCodCollected).reduce((sum, run) => sum + runTotal(run), 0)
  const minutesOnDuty = selected.reduce((sum, { shift }) => sum + minutesBetween(shift.started_at, shift.ended_at || now), 0)

  // Deductions grouped by name: "Operator fee (3 × ₱10.00)"
  const deductionGroups = []
  for (const d of deductions) {
    const group = deductionGroups.find((g) => g.name === d.name)
    if (group) group.rows.push(d)
    else deductionGroups.push({ name: d.name, rows: [d] })
  }

  // Settlement is shown when exactly one shift is selected
  const single = selected.length === 1 ? selected[0] : null
  const { toRemit, toPayRider } = settlementAmounts(codCollected, netPay)

  const filters = [
    { key: 'today', label: `Today (${formatDate(`${today}T00:00:00`).replace(/, \d{4}$/, '')})` },
    { key: 'week', label: 'This week' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-h2 font-bold">Deliveries &amp; earnings</h1>
        <p className="text-small text-sonic-muted">Past runs, deductions and COD settlement</p>
      </div>

      {/* Range filter */}
      <div className="flex flex-wrap items-center gap-2 print:hidden" role="group" aria-label="Show shifts from">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={range === key}
            onClick={() => setRange(key)}
            className={`min-h-10 rounded-full px-4 font-display text-small font-semibold shadow-card transition ${
              range === key ? 'bg-sonic-blue text-white' : 'bg-white text-sonic-ink hover:bg-sonic-blue-50'
            }`}
          >
            {label}
          </button>
        ))}
        <label
          className={`flex min-h-10 items-center gap-2 rounded-full px-4 shadow-card transition focus-within:ring-2 focus-within:ring-sonic-blue/40 ${
            range === 'date' ? 'bg-sonic-blue text-white' : 'bg-white text-sonic-ink'
          }`}
        >
          <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">Pick a date</span>
          <input
            type="date"
            max={today}
            value={pickedDate}
            onChange={(e) => {
              setPickedDate(e.target.value)
              setRange('date')
            }}
            className="bg-transparent font-display text-small font-semibold outline-none [color-scheme:light]"
          />
        </label>
        {shifts.length > 0 && (
          <span className="text-caption text-sonic-muted">
            Shifts on: {shifts.slice(0, 4).map(({ shift }) => formatDate(`${shift.shift_date}T00:00:00`)).join(', ')}
          </span>
        )}
      </div>

      {selected.length === 0 ? (
        <div className="mx-auto w-full max-w-xl">
          <EmptyState
            icon={ClipboardCheck}
            title={range === 'today' ? 'No shift today yet' : 'No shifts in this range'}
            text="Pick another date, or choose This week."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[400px_1fr] lg:items-start lg:gap-6">
          {/* ---- Summary ---- */}
          <section aria-labelledby="summary-title" className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card md:p-5 lg:sticky lg:top-24">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="summary-title" className="flex items-center gap-2 font-display text-h3 font-bold">
                  <ClipboardCheck className="size-5 text-sonic-blue" aria-hidden="true" />
                  {single ? 'Shift summary' : `${selected.length} shifts`}
                </h2>
                {single ? (
                  <p className="text-small text-sonic-muted">
                    {formatDate(single.shift.started_at)} · {formatTimestampTime(single.shift.started_at)} –{' '}
                    {single.shift.ended_at ? formatTimestampTime(single.shift.ended_at) : 'now'}
                  </p>
                ) : (
                  <p className="text-small text-sonic-muted">
                    {formatDate(`${selected[selected.length - 1].shift.shift_date}T00:00:00`)} – {formatDate(`${selected[0].shift.shift_date}T00:00:00`)}
                  </p>
                )}
                <p className="mt-0.5 flex items-center gap-1 text-caption text-sonic-blue">
                  <Clock className="size-3.5" aria-hidden="true" />
                  {formatDuration(minutesOnDuty)} on duty
                </p>
              </div>
              {single && (
                <span
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-caption font-semibold ${
                    single.settlement
                      ? 'bg-green-600/10 text-green-700'
                      : single.shift.status === 'open'
                        ? 'bg-sonic-blue-50 text-sonic-blue'
                        : 'bg-amber-500/15 text-amber-700'
                  }`}
                >
                  {single.settlement ? 'Settled' : single.shift.status === 'open' ? 'Shift open' : 'Not settled yet'}
                </span>
              )}
            </div>

            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Runs', runs.length, 'text-sonic-ink'],
                ['Gross', formatMoney(gross), 'text-sonic-ink'],
                ['Deductions', `−${formatMoney(totalDeductions)}`, 'text-red-600'],
              ].map(([label, value, color]) => (
                <div key={label} className="flex flex-col-reverse rounded-lg bg-sonic-bg px-2 py-3">
                  <dt className="text-caption text-sonic-muted">{label}</dt>
                  <dd className={`font-display text-base font-bold ${color}`}>{value}</dd>
                </div>
              ))}
            </dl>

            <div className="flex items-center gap-3 rounded-lg bg-sonic-blue-50 p-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sonic-blue text-white">
                <Wallet className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-small font-semibold text-sonic-blue">Net take-home pay</span>
                <span className="block font-display text-h2 font-extrabold text-sonic-blue">{formatMoney(netPay)}</span>
              </span>
            </div>

            {/* Deductions breakdown */}
            <details className="group rounded-lg bg-sonic-bg">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2 text-small font-semibold">
                  <Receipt className="size-4 text-sonic-muted" aria-hidden="true" />
                  Deductions breakdown
                </span>
                <span className="flex items-center gap-1.5 text-small font-semibold text-red-600">
                  −{formatMoney(totalDeductions)}
                  <ChevronDown className="size-4 text-sonic-muted transition group-open:rotate-180" aria-hidden="true" />
                </span>
              </summary>
              <dl className="flex flex-col gap-1.5 px-3 pb-3 text-small">
                {deductionGroups.map((g) => (
                  <div key={g.name} className="flex justify-between gap-3">
                    <dt className="text-sonic-muted">
                      {g.name} ({g.rows.length} × {formatMoney(g.rows[0].amount)})
                    </dt>
                    <dd className="text-red-600">−{formatMoney(sumAmounts(g.rows))}</dd>
                  </div>
                ))}
              </dl>
            </details>

            {/* COD settlement (one shift only) */}
            {single && (
              <div className="flex flex-col gap-2 rounded-lg border border-sonic-border p-3">
                <p className="flex items-center justify-between gap-2 text-small font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Banknote className="size-4 text-sonic-blue" aria-hidden="true" />
                    COD settlement
                  </span>
                </p>
                <dl className="flex flex-col gap-1.5 text-small">
                  <div className="flex justify-between gap-3">
                    <dt className="text-sonic-muted">COD cash collected</dt>
                    <dd className="font-semibold">{formatMoney(codCollected)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-sonic-muted">Your net pay (kept from the cash)</dt>
                    <dd className="font-semibold">{formatMoney(netPay)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-sonic-border pt-1.5">
                    <dt className="font-semibold">{toPayRider > 0 ? 'Sonic pays you' : 'To hand over at the hub'}</dt>
                    <dd className="font-display font-bold text-sonic-blue">{formatMoney(toPayRider > 0 ? toPayRider : toRemit)}</dd>
                  </div>
                </dl>
                {single.settlement && (
                  <p className="flex items-start gap-2 rounded-lg bg-green-600/10 p-2.5 text-caption text-green-700">
                    <BadgeCheck className="mt-px size-4 shrink-0" aria-hidden="true" />
                    <span>
                      Settlement #{single.settlement.settlement_id} · {formatTimestampTime(single.settlement.settled_at)} ·{' '}
                      {single.settlement.payout_amount > 0
                        ? `${formatMoney(single.settlement.payout_amount)} paid to you`
                        : `${formatMoney(single.settlement.cash_received)} received`}{' '}
                      · {formatMoney(Math.max(toRemit - single.settlement.cash_received, 0))} balance due
                    </span>
                  </p>
                )}
              </div>
            )}

            <Button variant="secondary" size="sm" onClick={() => window.print()} className="print:hidden">
              <Printer className="size-4" aria-hidden="true" />
              Print / save as PDF
            </Button>
          </section>

          {/* ---- Completed deliveries ---- */}
          <section aria-labelledby="runs-title" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="runs-title" className="flex items-center gap-2 font-display text-h3 font-bold">
                Completed deliveries
                <span className="rounded-full bg-sonic-blue-50 px-2 py-0.5 text-caption text-sonic-blue">{runs.length}</span>
              </h2>
              <span className="text-caption text-sonic-muted print:hidden">Tap a delivery for its pay breakdown</span>
            </div>
            {runs.length === 0 ? (
              <p className="rounded-xl bg-white p-4 text-small text-sonic-muted shadow-card">No completed deliveries in this range yet.</p>
            ) : (
              runs.map((run) => <RunItem key={run.earning.earning_id} run={run} />)
            )}
          </section>
        </div>
      )}
    </div>
  )
}
