import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  CirclePlus,
  Landmark,
  PiggyBank,
  RotateCcw,
  ShoppingBag,
  SlidersHorizontal,
  Wallet as WalletIcon,
  Zap,
} from 'lucide-react'
import { useAuth } from '@shared/auth/AuthContext'
import { getRiderWallet } from '@mock/mock'
import { pettyCashBreakdown, pettyCashOnHand, savingsBalance } from '@shared/utils/calc'
import { formatDate, formatMoney, formatTimestampTime } from '@shared/utils/format'

// Below this the petty cash float is "low" (DESIGN.md: warning color for low petty cash)
const LOW_PETTY_CASH = 200

// How each petty_cash_transactions type looks in the ledger
const TXN_STYLES = {
  cash_issued: { label: 'Cash issued', Icon: CirclePlus, sign: '+', color: 'text-green-700', tile: 'bg-green-600/10 text-green-700', tag: 'From operator' },
  gcash_topup: { label: 'GCash top-up', Icon: Landmark, sign: '+', color: 'text-green-700', tile: 'bg-sonic-blue-50 text-sonic-blue', tag: 'Top-up' },
  purchase: { label: 'Store advance', Icon: ShoppingBag, sign: '−', color: 'text-red-600', tile: 'bg-red-50 text-red-600', tag: 'Order advance' },
  cash_returned: { label: 'Cash returned', Icon: RotateCcw, sign: '−', color: 'text-sonic-ink', tile: 'bg-sonic-bg text-sonic-muted', tag: 'To operator' },
  adjustment: { label: 'Adjustment', Icon: SlidersHorizontal, sign: '+', color: 'text-sonic-ink', tile: 'bg-sonic-bg text-sonic-muted', tag: 'Adjustment' },
}

export default function Wallet() {
  const { user } = useAuth()
  const [data, setData] = useState(null)

  useEffect(() => {
    getRiderWallet(user.user_id).then(setData)
  }, [user.user_id])

  if (!data) return <p className="py-10 text-center text-sonic-muted">Loading your wallet…</p>

  const { shift, pettyCash, savings, savingsPerShift } = data
  const onHand = pettyCashOnHand(pettyCash)
  const breakdown = pettyCashBreakdown(pettyCash)
  const isLow = shift?.status === 'open' && onHand < LOW_PETTY_CASH
  const balance = savingsBalance(savings)
  const shiftDeposits = savings.filter((e) => e.shift_date).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h2 font-bold">Rider wallet</h1>
          <p className="text-small text-sonic-muted">Petty cash float, shift ledger and your savings</p>
        </div>
        {shift && (
          <span className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-caption shadow-card">
            <span className={`size-2 rounded-full ${shift.status === 'open' ? 'animate-pulse bg-green-600' : 'bg-sonic-border'}`} aria-hidden="true" />
            {shift.status === 'open' ? 'Shift' : 'Last shift'}: {formatDate(shift.started_at)}
            <span className="rounded-full bg-sonic-bg px-2 text-sonic-muted">View only</span>
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        {/* ---- Petty cash ---- */}
        <div className="flex flex-col gap-4">
          {isLow && (
            <div role="alert" className="flex items-start gap-3 rounded-xl bg-amber-500/15 p-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
              <div>
                <p className="flex items-center gap-2 font-display text-small font-bold text-amber-800">
                  Low petty cash
                  <span className="rounded-full bg-amber-500/20 px-2 text-caption">&lt; {formatMoney(LOW_PETTY_CASH)}</span>
                </p>
                <p className="text-small text-amber-800">Ask the operator for a top-up (cash or GCash) before taking pabili orders.</p>
              </div>
            </div>
          )}

          <section aria-labelledby="petty-title" className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card md:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 id="petty-title" className="flex items-center gap-2 font-display text-h3 font-bold">
                <span className="flex size-9 items-center justify-center rounded-full bg-sonic-blue-50 text-sonic-blue">
                  <WalletIcon className="size-5" aria-hidden="true" />
                </span>
                Petty cash float
              </h2>
              {shift && (
                <span
                  className={`rounded-full px-2.5 py-1 text-caption font-semibold ${
                    shift.status !== 'open' ? 'bg-sonic-bg text-sonic-muted' : isLow ? 'bg-amber-500/15 text-amber-700' : 'bg-green-600/10 text-green-700'
                  }`}
                >
                  {shift.status !== 'open' ? 'Shift closed' : isLow ? 'Low' : 'Enough float'}
                </span>
              )}
            </div>

            {!shift ? (
              <p className="text-small text-sonic-muted">Petty cash is issued by the operator when your shift starts.</p>
            ) : (
              <>
                <div>
                  <p className="text-small text-sonic-muted">Balance on hand</p>
                  <p className="flex flex-wrap items-baseline gap-2">
                    <span className="font-display text-h1 font-extrabold">{formatMoney(onHand)}</span>
                    {shift.status === 'open' && (
                      <span className={`text-small ${isLow ? 'text-amber-700' : 'text-green-700'}`}>
                        {isLow ? `Below ${formatMoney(LOW_PETTY_CASH)}` : `Above the ${formatMoney(LOW_PETTY_CASH)} minimum`}
                      </span>
                    )}
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="flex flex-col-reverse rounded-lg bg-sonic-bg px-2 py-2.5">
                    <dt className="text-caption text-sonic-muted">Issued</dt>
                    <dd className="font-display text-small font-bold">{formatMoney(breakdown.issued)}</dd>
                  </div>
                  <div className="flex flex-col-reverse rounded-lg bg-sonic-bg px-2 py-2.5">
                    <dt className="text-caption text-sonic-muted">Store advances</dt>
                    <dd className="font-display text-small font-bold text-red-600">−{formatMoney(breakdown.purchases)}</dd>
                  </div>
                  <div className="flex flex-col-reverse rounded-lg bg-sonic-bg px-2 py-2.5">
                    <dt className="text-caption text-sonic-muted">Top-ups</dt>
                    <dd className="font-display text-small font-bold text-green-700">+{formatMoney(breakdown.topups)}</dd>
                  </div>
                </dl>
                {breakdown.returned > 0 && (
                  <p className="text-caption text-sonic-muted">{formatMoney(breakdown.returned)} returned to the operator at the end of the shift.</p>
                )}
              </>
            )}
          </section>

          {shift && (
            <section aria-labelledby="ledger-title" className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2 px-1">
                <h2 id="ledger-title" className="font-display text-base font-bold">
                  {shift.status === 'open' ? "Today's float ledger" : 'Last shift ledger'}
                </h2>
                <span className="text-caption text-sonic-muted">
                  {pettyCash.length} {pettyCash.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>
              <ul className="flex flex-col divide-y divide-sonic-border overflow-hidden rounded-xl bg-white shadow-card">
                {pettyCash.length === 0 && <li className="p-4 text-small text-sonic-muted">No petty cash entries yet.</li>}
                {pettyCash.map((t) => {
                  const style = TXN_STYLES[t.txn_type]
                  return (
                    <li key={t.txn_id} className="flex items-center justify-between gap-3 p-3.5">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${style.tile}`}>
                          <style.Icon className="size-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-display text-small font-semibold">
                            {style.label}
                            {t.order_number && ` for ${t.order_number}`}
                          </span>
                          <span className="block truncate text-caption text-sonic-muted">
                            {formatTimestampTime(t.created_at)}
                            {t.gcash_reference_id && ` · Ref #${t.gcash_reference_id}`}
                            {t.note && ` · ${t.note}`}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={`block font-display text-small font-bold ${style.color}`}>
                          {style.sign}
                          {formatMoney(t.amount)}
                        </span>
                        <span className="block text-caption text-sonic-muted">{style.tag}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <div className="flex items-start gap-3 rounded-xl bg-sonic-bolt/20 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sonic-bolt">
              <Zap className="size-5 fill-sonic-ink text-sonic-ink" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-small font-bold text-sonic-ink">End-of-shift rule</h2>
              <p className="text-small text-sonic-ink">
                Return your unused petty cash and hand over your COD collections at the Sipocot hub before you end your shift.
              </p>
            </div>
          </div>
        </div>

        {/* ---- Savings ---- */}
        <section aria-labelledby="savings-title" className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card md:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 id="savings-title" className="flex items-center gap-2 font-display text-h3 font-bold">
              <span className="flex size-9 items-center justify-center rounded-full bg-green-600/10 text-green-700">
                <PiggyBank className="size-5" aria-hidden="true" />
              </span>
              Rider savings
            </h2>
            <span className="flex items-center gap-1.5 rounded-full bg-green-600/10 px-2.5 py-1 text-caption font-semibold text-green-700">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              Auto-save on
            </span>
          </div>

          <div>
            <p className="text-small text-sonic-muted">Total savings balance</p>
            <p className="flex flex-wrap items-baseline gap-2">
              <span className="font-display text-h1 font-extrabold text-green-700">{formatMoney(balance)}</span>
              <span className="text-small text-sonic-muted">
                from {shiftDeposits} {shiftDeposits === 1 ? 'shift' : 'shifts'}
              </span>
            </p>
            <p className="mt-1 text-small text-sonic-muted">
              {formatMoney(savingsPerShift)} is saved automatically from every shift. To withdraw, ask the operator at the hub.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-display text-small font-semibold">Savings history</h3>
            <ul className="flex flex-col divide-y divide-sonic-border rounded-lg bg-sonic-bg">
              {savings.length === 0 && <li className="p-3 text-small text-sonic-muted">No savings yet.</li>}
              {savings.map((e) => {
                const isDeposit = e.entry_type === 'deposit'
                return (
                  <li key={e.entry_id} className="flex items-center justify-between gap-3 p-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${isDeposit ? 'bg-green-600/10 text-green-700' : 'bg-red-50 text-red-600'}`}
                      >
                        {isDeposit ? <ArrowDownLeft className="size-4" aria-hidden="true" /> : <ArrowUpRight className="size-4" aria-hidden="true" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-display text-small font-semibold">
                          {isDeposit ? (e.shift_date ? 'Shift deposit' : 'Deposit') : 'Withdrawal'}
                        </span>
                        <span className="block truncate text-caption text-sonic-muted">
                          {formatDate(e.created_at)}
                          {e.shift_date ? ' · Automatic, from your shift' : e.note ? ` · ${e.note}` : ''}
                          {e.processed_by && !e.shift_date && ' · Processed by staff'}
                        </span>
                      </span>
                    </span>
                    <span className={`shrink-0 font-display text-small font-bold ${isDeposit ? 'text-green-700' : 'text-red-600'}`}>
                      {isDeposit ? '+' : '−'}
                      {formatMoney(e.amount)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      </div>
    </div>
  )
}
