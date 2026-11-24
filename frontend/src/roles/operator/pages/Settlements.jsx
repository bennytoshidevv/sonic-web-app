import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, BadgeCheck, Banknote, ChevronLeft, ChevronRight, Clock, Coins, Plus, Printer, Receipt, Wallet } from 'lucide-react'
import Alert from '@shared/components/Alert'
import BottomSheet from '@shared/components/BottomSheet'
import Button from '@shared/components/Button'
import EmptyState from '@shared/components/EmptyState'
import Input from '@shared/components/Input'
import Select from '@shared/components/Select'
import Toast from '@shared/components/Toast'
import { useAuth } from '@shared/auth/AuthContext'
import { addPettyCashTransaction, getShiftsOnDate, getUserNames, recordSettlement } from '@mock/mock'
import {
  deliveryGross,
  minutesBetween,
  orderExtraStoreFees,
  orderItemsSubtotal,
  orderTotal,
  pettyCashBreakdown,
  pettyCashOnHand,
  riderShare,
  settlementAmounts,
  sumAmounts,
} from '@shared/utils/calc'
import { formatDate, formatDuration, formatMoney, formatPhoneNumber, formatTimestampTime, localDateKey } from '@shared/utils/format'
import { PAYMENT_METHOD_LABELS } from '@shared/utils/labels'

const TXN_LABELS = { cash_issued: 'Cash issued', gcash_topup: 'GCash top-up', purchase: 'Store advance', cash_returned: 'Cash returned', adjustment: 'Adjustment' }
const TXN_SIGNS = { cash_issued: '+', gcash_topup: '+', purchase: '−', cash_returned: '−', adjustment: '+' }

// Pay inputs of one delivery (calc.js)
function runPay(run) {
  const fee = run.order.base_delivery_fee
  const allowance = run.earning.gas_allowance_amount
  const pct = run.earning.rider_share_pct
  const extra = orderExtraStoreFees(run.stores)
  return { fee, allowance, share: riderShare(fee, allowance, pct), extra, gross: deliveryGross(fee, allowance, pct, extra) }
}

function runTotal(run) {
  return orderTotal(orderItemsSubtotal(run.stores.flatMap((s) => s.items)), run.order.base_delivery_fee, orderExtraStoreFees(run.stores))
}

function isCod(run) {
  return run.payment?.payment_method === 'cod' && run.payment.payment_status === 'paid'
}

function shiftState(view) {
  if (view.settlement) return { label: 'Settled', tone: 'bg-green-600/10 text-green-700' }
  if (view.shift.status === 'open') return { label: 'Open', tone: 'bg-sonic-blue-50 text-sonic-blue' }
  return { label: 'Needs settlement', tone: 'bg-amber-500/15 text-amber-700' }
}

// Money of a shift (calc.js)
function shiftMoney(view) {
  const gross = view.runs.reduce((sum, r) => sum + runPay(r).gross, 0)
  const deductions = sumAmounts(view.deductions)
  const net = gross - deductions
  const cod = view.runs.filter(isCod).reduce((sum, r) => sum + runTotal(r), 0)
  return { gross, deductions, net, cod, ...settlementAmounts(cod, net), pettyOnHand: pettyCashOnHand(view.pettyCash) }
}

// Record settlement form (closed shift, not settled yet)
function SettlementForm({ money, onSave }) {
  const [cash, setCash] = useState('')
  const [payoutMethod, setPayoutMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [returnPetty, setReturnPetty] = useState(money.pettyOnHand > 0)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const received = cash === '' ? null : Number(cash)
  const difference = received === null ? null : Math.round((received - money.toRemit) * 100) / 100

  async function handleSubmit(e) {
    e.preventDefault()
    if (money.toRemit > 0 && received === null) {
      setError('Enter the cash the rider handed over.')
      return
    }
    if (money.toPayRider > 0 && payoutMethod === 'gcash' && !reference.trim()) {
      setError('Enter the GCash reference number.')
      return
    }
    setSaving(true)
    await onSave({
      cash_received: money.toRemit > 0 ? received : 0,
      payout_amount: money.toPayRider,
      payout_method: payoutMethod,
      payout_reference: reference.trim(),
      notes: notes.trim(),
      return_petty_cash: returnPetty,
    })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {money.toRemit > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Cash handed over by the rider"
                id="cash_received"
                inputMode="decimal"
                prefix="₱"
                placeholder="0.00"
                value={cash}
                onChange={(e) => {
                  setCash(e.target.value.replace(/[^\d.]/g, ''))
                  setError('')
                }}
              />
            </div>
            <Button variant="secondary" size="sm" className="mb-1" onClick={() => setCash(String(money.toRemit))}>
              Exact amount
            </Button>
          </div>
          {difference !== null && difference !== 0 && (
            <p className={`text-small font-medium ${difference < 0 ? 'text-red-600' : 'text-amber-700'}`}>
              {difference < 0 ? `${formatMoney(-difference)} short` : `${formatMoney(difference)} over the expected amount`}
            </p>
          )}
        </div>
      )}

      {money.toPayRider > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-body font-medium">Pay the rider {formatMoney(money.toPayRider)} by</legend>
          <div className="flex gap-2">
            {['cash', 'gcash'].map((m) => (
              <label key={m} className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl text-small font-semibold ${payoutMethod === m ? 'bg-sonic-blue-50 ring-1 ring-sonic-blue' : 'bg-sonic-bg'}`}>
                <input type="radio" name="payout_method" checked={payoutMethod === m} onChange={() => setPayoutMethod(m)} className="size-4 accent-sonic-blue" />
                {m === 'cash' ? 'Cash' : 'GCash'}
              </label>
            ))}
          </div>
          {payoutMethod === 'gcash' && (
            <Input label="GCash reference number" id="payout_reference" value={reference} onChange={(e) => setReference(e.target.value)} />
          )}
        </fieldset>
      )}

      {money.pettyOnHand > 0 && (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-sonic-bg p-3 text-small">
          <input type="checkbox" checked={returnPetty} onChange={(e) => setReturnPetty(e.target.checked)} className="size-4 accent-sonic-blue" />
          Petty cash returned: <span className="font-semibold">{formatMoney(money.pettyOnHand)}</span>
        </label>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="settlement_notes" className="text-body font-medium">
          Notes <span className="text-sonic-muted">(optional)</span>
        </label>
        <textarea
          id="settlement_notes"
          rows={2}
          maxLength={200}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full resize-none rounded-xl border border-sonic-border p-3 text-base outline-none focus:border-sonic-blue focus:ring-3 focus:ring-sonic-blue/25 md:text-body"
        />
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-small font-medium text-red-600">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      <Button type="submit" fullWidth disabled={saving}>
        <BadgeCheck className="size-5" aria-hidden="true" />
        {saving ? 'Saving…' : 'Record settlement'}
      </Button>
    </form>
  )
}

export default function Settlements() {
  const { user } = useAuth()
  const [date, setDate] = useState(() => localDateKey())
  const [views, setViews] = useState(null)
  const [names, setNames] = useState({})
  const [shiftId, setShiftId] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [addingTxn, setAddingTxn] = useState(false)
  const [txn, setTxn] = useState({ txn_type: 'cash_issued', amount: '', gcash_reference_id: '', note: '' })
  const [txnError, setTxnError] = useState('')
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  useEffect(() => {
    getShiftsOnDate(date).then(async (list) => {
      const ids = [...new Set(list.flatMap((v) => [...v.pettyCash.map((t) => t.processed_by), ...(v.settlement ? [v.settlement.settled_by] : [])]))]
      setNames(await getUserNames(ids))
      setViews(list)
    })
  }, [date, refreshKey])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  function showToast(message) {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2800)
  }

  function shiftDate(days) {
    const d = new Date(`${date}T00:00:00`)
    d.setDate(d.getDate() + days)
    setDate(localDateKey(d))
    setShiftId(null)
  }

  if (!views) return <p className="py-10 text-center text-sonic-muted">Loading settlements…</p>

  const view = views.find((v) => v.shift.shift_id === shiftId) || views.find((v) => !v.settlement && v.shift.status === 'closed') || views[0] || null
  const money = view ? shiftMoney(view) : null
  const petty = view ? pettyCashBreakdown(view.pettyCash) : null

  async function handleSettle(data) {
    const result = await recordSettlement(user.user_id, { shift_id: view.shift.shift_id, ...data })
    if (result.error) {
      showToast('This shift cannot be settled now.')
      return
    }
    showToast(`Shift of ${view.rider.full_name} settled`)
    setRefreshKey(refreshKey + 1)
  }

  async function handleAddTxn(e) {
    e.preventDefault()
    const amount = Number(txn.amount)
    const result = await addPettyCashTransaction(user.user_id, {
      shift_id: view.shift.shift_id,
      txn_type: txn.txn_type,
      amount: Math.round(amount * 100) / 100,
      gcash_reference_id: txn.gcash_reference_id.trim(),
      note: txn.note.trim(),
    })
    if (result.error) {
      const messages = {
        invalid_amount: 'Enter an amount above ₱0.00.',
        reference_required: 'Enter the GCash reference number.',
        not_enough: `The rider only has ${formatMoney(money.pettyOnHand)} petty cash.`,
        already_settled: 'This shift is already settled.',
      }
      setTxnError(messages[result.error])
      return
    }
    setAddingTxn(false)
    showToast('Petty cash entry added')
    setRefreshKey(refreshKey + 1)
  }

  const card = 'rounded-xl bg-white p-4 shadow-card md:p-5'
  const state = view && shiftState(view)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h1 font-bold">Settlements</h1>
          <p className="text-small text-sonic-muted">End-of-shift COD remittance, rider payouts and petty cash</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button type="button" onClick={() => shiftDate(-1)} aria-label="Previous day" className="flex size-11 items-center justify-center rounded-full bg-white shadow-card hover:bg-sonic-blue-50">
            <ChevronLeft className="size-5" />
          </button>
          <input
            type="date"
            aria-label="Shift date"
            value={date}
            max={localDateKey()}
            onChange={(e) => {
              if (e.target.value) {
                setDate(e.target.value)
                setShiftId(null)
              }
            }}
            className="min-h-11 rounded-xl border border-sonic-border bg-white px-3 font-display text-small font-semibold"
          />
          <button type="button" onClick={() => shiftDate(1)} aria-label="Next day" disabled={date >= localDateKey()} className="flex size-11 items-center justify-center rounded-full bg-white shadow-card hover:bg-sonic-blue-50 disabled:opacity-40">
            <ChevronRight className="size-5" />
          </button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" />
            Print
          </Button>
        </div>
      </div>

      {views.length === 0 ? (
        <div className="mx-auto w-full max-w-xl">
          <EmptyState icon={Receipt} title="No shifts on this date" text={`No rider had a shift on ${formatDate(`${date}T00:00:00`)}.`} />
        </div>
      ) : (
        <>
          {/* Shifts of the day */}
          <div className="flex gap-3 overflow-x-auto pb-1 print:hidden" role="group" aria-label="Rider shifts">
            {views.map((v) => {
              const s = shiftState(v)
              const selected = v.shift.shift_id === view.shift.shift_id
              return (
                <button
                  key={v.shift.shift_id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setShiftId(v.shift.shift_id)}
                  className={`flex min-w-60 flex-col gap-1 rounded-xl bg-white p-3 text-left shadow-card transition ${selected ? 'ring-2 ring-sonic-blue' : 'hover:ring-2 hover:ring-sonic-blue/30'}`}
                >
                  <span className="font-display text-small font-semibold">{v.rider.full_name}</span>
                  <span className="text-caption text-sonic-muted">
                    {formatTimestampTime(v.shift.started_at)} – {v.shift.ended_at ? formatTimestampTime(v.shift.ended_at) : 'now'} · {v.runs.length}{' '}
                    {v.runs.length === 1 ? 'trip' : 'trips'}
                  </span>
                  <span className={`self-start rounded-full px-2 py-0.5 text-caption font-semibold ${s.tone}`}>{s.label}</span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-5 xl:grid xl:grid-cols-2 xl:items-start">
            {/* ---- Shift summary + cash balancing ---- */}
            <div className="flex flex-col gap-5">
              <section aria-labelledby="summary-title" className={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="summary-title" className="font-display text-h3 font-bold">
                      {view.rider.full_name}
                    </h2>
                    <p className="text-small text-sonic-muted">
                      {view.profile.vehicle_type}
                      {view.profile.plate_number && ` · ${view.profile.plate_number}`} · {formatPhoneNumber(view.rider.contact_number)}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-caption text-sonic-blue">
                      <Clock className="size-3.5" aria-hidden="true" />
                      {formatDate(view.shift.started_at)} · {formatTimestampTime(view.shift.started_at)} – {view.shift.ended_at ? formatTimestampTime(view.shift.ended_at) : 'now'}
                      {view.shift.ended_at && ` (${formatDuration(minutesBetween(view.shift.started_at, view.shift.ended_at))})`}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-caption font-semibold ${state.tone}`}>{state.label}</span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                  {[
                    ['Trips', view.runs.length, ''],
                    ['Gross pay', formatMoney(money.gross), ''],
                    ['Deductions', `−${formatMoney(money.deductions)}`, 'text-red-600'],
                    ['Net pay', formatMoney(money.net), 'text-sonic-blue'],
                  ].map(([label, value, color]) => (
                    <div key={label} className="flex flex-col-reverse rounded-lg bg-sonic-bg p-3">
                      <dt className="text-caption text-sonic-muted">{label}</dt>
                      <dd className={`font-display text-base font-bold ${color}`}>{value}</dd>
                    </div>
                  ))}
                </dl>
                <dl className="mt-4 flex flex-col gap-1.5 border-t border-sonic-border pt-3 text-small">
                  {Object.values(
                    view.deductions.reduce((groups, d) => {
                      groups[d.name] = groups[d.name] || { name: d.name, rows: [] }
                      groups[d.name].rows.push(d)
                      return groups
                    }, {}),
                  ).map((g) => (
                    <div key={g.name} className="flex justify-between gap-3">
                      <dt className="text-sonic-muted">
                        {g.name} ({g.rows.length} × {formatMoney(g.rows[0].amount)})
                      </dt>
                      <dd className="text-red-600">−{formatMoney(sumAmounts(g.rows))}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section aria-labelledby="cash-title" className={card}>
                <h2 id="cash-title" className="flex items-center gap-2 font-display text-base font-bold">
                  <Banknote className="size-5 text-sonic-blue" aria-hidden="true" />
                  End-of-shift cash balancing
                </h2>
                <dl className="mt-3 flex flex-col gap-2 text-small">
                  <div className="flex justify-between gap-3">
                    <dt className="text-sonic-muted">1. COD cash collected ({view.runs.filter(isCod).length} COD orders)</dt>
                    <dd className="font-semibold">{formatMoney(money.cod)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-sonic-muted">2. Less the rider&apos;s net pay (kept from the cash)</dt>
                    <dd className="font-semibold">−{formatMoney(money.net)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-sonic-blue-50 px-3 py-2">
                    <dt className="font-display font-semibold">{money.toPayRider > 0 ? 'Sonic pays the rider' : 'Rider hands over'}</dt>
                    <dd className="font-display text-h3 font-bold text-sonic-blue">{formatMoney(money.toPayRider > 0 ? money.toPayRider : money.toRemit)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-sonic-muted">Petty cash on hand (returned separately)</dt>
                    <dd>{formatMoney(money.pettyOnHand)}</dd>
                  </div>
                </dl>
              </section>

              <section aria-labelledby="settle-title" className={card}>
                <h2 id="settle-title" className="flex items-center gap-2 font-display text-base font-bold">
                  <BadgeCheck className="size-5 text-sonic-blue" aria-hidden="true" />
                  Settlement
                </h2>
                <div className="mt-3">
                  {view.settlement ? (
                    <dl className="flex flex-col gap-1.5 rounded-lg bg-green-600/10 p-3 text-small text-green-800">
                      <div className="flex justify-between gap-3">
                        <dt>Settlement #{view.settlement.settlement_id}</dt>
                        <dd>
                          {formatDate(view.settlement.settled_at)} · {formatTimestampTime(view.settlement.settled_at)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Received by</dt>
                        <dd>{names[view.settlement.settled_by] || '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Cash received from the rider</dt>
                        <dd className="font-semibold">{formatMoney(view.settlement.cash_received)}</dd>
                      </div>
                      {view.settlement.payout_amount > 0 && (
                        <div className="flex justify-between gap-3">
                          <dt>Paid to the rider ({view.settlement.payout_method === 'gcash' ? `GCash ${view.settlement.payout_reference}` : 'cash'})</dt>
                          <dd className="font-semibold">{formatMoney(view.settlement.payout_amount)}</dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-3">
                        <dt>Balance due</dt>
                        <dd className="font-semibold">{formatMoney(Math.max(money.toRemit - view.settlement.cash_received, 0))}</dd>
                      </div>
                      {view.settlement.notes && <p>“{view.settlement.notes}”</p>}
                    </dl>
                  ) : view.shift.status === 'open' ? (
                    <Alert variant="info" title="Shift still open.">
                      The rider ends the shift in the rider app first. Then you can record the settlement here.
                    </Alert>
                  ) : (
                    <SettlementForm key={view.shift.shift_id} money={money} onSave={handleSettle} />
                  )}
                </div>
              </section>
            </div>

            {/* ---- Petty cash ledger ---- */}
            <section aria-labelledby="petty-title" className={card}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="petty-title" className="flex items-center gap-2 font-display text-base font-bold">
                  <Coins className="size-5 text-sonic-blue" aria-hidden="true" />
                  Petty cash ledger
                </h2>
                {!view.settlement && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="print:hidden"
                    onClick={() => {
                      setTxn({ txn_type: 'cash_issued', amount: '', gcash_reference_id: '', note: '' })
                      setTxnError('')
                      setAddingTxn(true)
                    }}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Add entry
                  </Button>
                )}
              </div>
              <p className="mt-1 text-caption text-sonic-muted">
                Issued {formatMoney(petty.issued)} · Top-ups {formatMoney(petty.topups)} · Store advances {formatMoney(petty.purchases)} · Returned{' '}
                {formatMoney(petty.returned)}
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-small">
                  <thead className="text-caption tracking-wide text-sonic-muted uppercase">
                    <tr>
                      {['Time', 'Type', 'Amount', 'Note', 'By'].map((h) => (
                        <th key={h} scope="col" className="py-2 pr-3 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sonic-border">
                    {view.pettyCash.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-sonic-muted">
                          No petty cash entries.
                        </td>
                      </tr>
                    )}
                    {view.pettyCash.map((t) => (
                      <tr key={t.txn_id}>
                        <td className="py-2 pr-3 whitespace-nowrap">{formatTimestampTime(t.created_at)}</td>
                        <td className="py-2 pr-3">{TXN_LABELS[t.txn_type]}</td>
                        <td className={`py-2 pr-3 font-semibold whitespace-nowrap ${TXN_SIGNS[t.txn_type] === '+' ? 'text-green-700' : 'text-red-600'}`}>
                          {TXN_SIGNS[t.txn_type]}
                          {formatMoney(t.amount)}
                        </td>
                        <td className="py-2 pr-3 text-sonic-muted">
                          {t.note || '—'}
                          {t.gcash_reference_id && ` · Ref ${t.gcash_reference_id}`}
                        </td>
                        <td className="py-2 pr-3 text-sonic-muted">{names[t.processed_by] || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 flex items-center justify-between gap-2 border-t border-sonic-border pt-3 text-small">
                <span className="flex items-center gap-1.5 text-sonic-muted">
                  <Wallet className="size-4" aria-hidden="true" />
                  On hand now
                </span>
                <span className="font-display font-bold">{formatMoney(money.pettyOnHand)}</span>
              </p>
            </section>
          </div>

          {/* ---- Delivery audit ---- */}
          <section aria-labelledby="audit-title" className="overflow-hidden rounded-xl bg-white shadow-card">
            <h2 id="audit-title" className="border-b border-sonic-border px-4 py-3 font-display text-base font-bold">
              Delivery audit ({view.runs.length} completed {view.runs.length === 1 ? 'order' : 'orders'})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-small">
                <thead className="bg-sonic-bg text-caption tracking-wide text-sonic-muted uppercase">
                  <tr>
                    {['Order', 'Drop-off', 'Base fee', 'Gas allow.', 'Rider share', 'Extra stores', 'Rider earning', 'COD collected', 'Customer · stores', 'Payment'].map((h) => (
                      <th key={h} scope="col" className="px-4 py-2.5 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-sonic-border">
                  {view.runs.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-sonic-muted">
                        No completed deliveries in this shift yet.
                      </td>
                    </tr>
                  )}
                  {view.runs.map((run) => {
                    const pay = runPay(run)
                    return (
                      <tr key={run.earning.earning_id}>
                        <td className="px-4 py-3 font-display font-semibold">#{run.order.order_number}</td>
                        <td className="px-4 py-3">{run.order.dropoff_barangay}</td>
                        <td className="px-4 py-3">{formatMoney(pay.fee)}</td>
                        <td className="px-4 py-3">{formatMoney(pay.allowance)}</td>
                        <td className="px-4 py-3">{formatMoney(pay.share)}</td>
                        <td className="px-4 py-3">{pay.extra > 0 ? `+${formatMoney(pay.extra)}` : '—'}</td>
                        <td className="px-4 py-3 font-semibold text-sonic-blue">{formatMoney(pay.gross)}</td>
                        <td className="px-4 py-3">{isCod(run) ? formatMoney(runTotal(run)) : '—'}</td>
                        <td className="px-4 py-3">
                          <p>{run.customer_name}</p>
                          <p className="text-caption text-sonic-muted">{run.stores.map((s) => s.name).join(' + ')}</p>
                        </td>
                        <td className="px-4 py-3">{PAYMENT_METHOD_LABELS[run.payment.payment_method]}</td>
                      </tr>
                    )
                  })}
                </tbody>
                {view.runs.length > 0 && (
                  <tfoot className="bg-sonic-bg font-semibold">
                    <tr>
                      <td className="px-4 py-3" colSpan={2}>
                        Totals ({view.runs.length} trips)
                      </td>
                      <td className="px-4 py-3">{formatMoney(view.runs.reduce((s, r) => s + runPay(r).fee, 0))}</td>
                      <td className="px-4 py-3">{formatMoney(view.runs.reduce((s, r) => s + runPay(r).allowance, 0))}</td>
                      <td className="px-4 py-3">{formatMoney(view.runs.reduce((s, r) => s + runPay(r).share, 0))}</td>
                      <td className="px-4 py-3">{formatMoney(view.runs.reduce((s, r) => s + runPay(r).extra, 0))}</td>
                      <td className="px-4 py-3 text-sonic-blue">{formatMoney(money.gross)}</td>
                      <td className="px-4 py-3">{formatMoney(money.cod)}</td>
                      <td className="px-4 py-3" colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>
        </>
      )}

      <BottomSheet open={addingTxn} onClose={() => setAddingTxn(false)} icon={Coins} title="Add petty cash entry" description={view ? `${view.rider.full_name} · ${formatDate(view.shift.started_at)}` : ''}>
        <form onSubmit={handleAddTxn} noValidate className="flex flex-col gap-4">
          <Select
            label="Type"
            id="txn_type"
            value={txn.txn_type}
            onChange={(e) => {
              setTxn({ ...txn, txn_type: e.target.value })
              setTxnError('')
            }}
          >
            <option value="cash_issued">Cash issued to the rider</option>
            <option value="gcash_topup">GCash top-up</option>
            <option value="cash_returned">Cash returned by the rider</option>
            <option value="adjustment">Adjustment</option>
          </Select>
          <Input
            label="Amount"
            id="txn_amount"
            inputMode="decimal"
            prefix="₱"
            placeholder="0.00"
            value={txn.amount}
            onChange={(e) => {
              setTxn({ ...txn, amount: e.target.value.replace(/[^\d.]/g, '') })
              setTxnError('')
            }}
          />
          {txn.txn_type === 'gcash_topup' && (
            <Input label="GCash reference number" id="txn_reference" value={txn.gcash_reference_id} onChange={(e) => setTxn({ ...txn, gcash_reference_id: e.target.value })} />
          )}
          <Input label="Note" id="txn_note" hint="Optional" value={txn.note} onChange={(e) => setTxn({ ...txn, note: e.target.value })} />
          {txnError && (
            <p role="alert" className="flex items-center gap-1.5 text-small font-medium text-red-600">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              {txnError}
            </p>
          )}
          <div className="flex flex-col gap-2 md:flex-row-reverse">
            <Button type="submit" fullWidth>
              Add entry
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setAddingTxn(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </BottomSheet>

      <Toast message={toast} />
    </div>
  )
}
