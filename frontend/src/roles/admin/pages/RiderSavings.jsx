import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, PiggyBank, Printer, Search, Users, Wallet } from 'lucide-react'
import Button from '@shared/components/Button'
import Chip from '@shared/components/Chip'
import Input from '@shared/components/Input'
import Toast from '@shared/components/Toast'
import { useAuth } from '@shared/auth/AuthContext'
import { getSavingsOverview, recordSavingsWithdrawal } from '@mock/mock'
import { savingsBalance, sumAmounts } from '@shared/utils/calc'
import { formatDate, formatMoney, formatPhoneNumber, formatTimestampTime } from '@shared/utils/format'

function initials(name) {
  const words = name.trim().split(/\s+/)
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase()
}

// Totals of one rider's passbook (calc.js)
function passbook(rider) {
  const deposits = rider.entries.filter((e) => e.entry_type === 'deposit')
  const withdrawals = rider.entries.filter((e) => e.entry_type === 'withdrawal')
  return {
    deposited: sumAmounts(deposits),
    shiftDeposits: deposits.filter((e) => e.shift_date).length,
    withdrawn: sumAmounts(withdrawals),
    withdrawalCount: withdrawals.length,
    balance: savingsBalance(rider.entries),
    last: rider.entries[0] || null,
  }
}

// Record a withdrawal for the selected rider (amount up to the balance + a reason)
function WithdrawalForm({ balance, onSave }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const value = Number(amount)
    if (!(value > 0)) return setError('Enter an amount above ₱0.00.')
    if (value > balance) return setError(`The most you can pay out is ${formatMoney(balance)}.`)
    if (!note.trim()) return setError('Write what the withdrawal is for.')
    setSaving(true)
    await onSave(value, note)
    setSaving(false)
  }

  const add = (extra) => setAmount(String(Math.min((Number(amount) || 0) + extra, balance)))

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <Input
        label="Withdrawal amount"
        id="withdraw_amount"
        inputMode="decimal"
        prefix="₱"
        placeholder="0.00"
        hint={`Up to ${formatMoney(balance)}`}
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value.replace(/[^\d.]/g, ''))
          setError('')
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => add(100)}>
          +₱100
        </Button>
        <Button variant="secondary" size="sm" onClick={() => add(200)}>
          +₱200
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setAmount(String(balance))}>
          All ({formatMoney(balance)})
        </Button>
      </div>
      <Input
        label="What is it for?"
        id="withdraw_note"
        placeholder="e.g. Motorcycle repair"
        value={note}
        onChange={(e) => {
          setNote(e.target.value)
          setError('')
        }}
      />
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-small font-medium text-red-600">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      <Button type="submit" disabled={saving || balance <= 0}>
        <ArrowUpRight className="size-4" aria-hidden="true" />
        {saving ? 'Saving…' : 'Record withdrawal'}
      </Button>
    </form>
  )
}

export default function RiderSavings() {
  const { user } = useAuth()
  const [riders, setRiders] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('balance_desc')
  const [historyFilter, setHistoryFilter] = useState('all')
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  useEffect(() => {
    getSavingsOverview().then(setRiders)
  }, [refreshKey])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  if (!riders) return <p className="py-10 text-center text-sonic-muted">Loading rider savings…</p>

  const withBook = riders.map((r) => ({ ...r, book: passbook(r) }))
  const totalBalance = withBook.reduce((sum, r) => sum + r.book.balance, 0)
  const totalDeposited = withBook.reduce((sum, r) => sum + r.book.deposited, 0)
  const totalWithdrawn = withBook.reduce((sum, r) => sum + r.book.withdrawn, 0)
  const withSavings = withBook.filter((r) => r.entries.length > 0).length

  const q = query.trim().toLowerCase()
  const shown = withBook
    .filter((r) => r.user.account_status !== 'inactive' || r.entries.length > 0)
    .filter((r) => status === 'all' || r.user.account_status === status)
    .filter((r) => !q || r.user.full_name.toLowerCase().includes(q))
    .sort((a, b) => {
      if (sort === 'balance_asc') return a.book.balance - b.book.balance
      if (sort === 'recent') return new Date(b.book.last?.created_at || 0) - new Date(a.book.last?.created_at || 0)
      return b.book.balance - a.book.balance
    })

  const selected = withBook.find((r) => r.user.user_id === selectedId) || shown[0] || null
  const history = selected ? selected.entries.filter((e) => historyFilter === 'all' || e.entry_type === historyFilter) : []

  async function handleWithdraw(amount, note) {
    const result = await recordSavingsWithdrawal(user.user_id, selected.user.user_id, amount, note)
    if (result.error) {
      setToast(result.error === 'not_enough' ? 'Not enough savings for that amount.' : 'Could not record the withdrawal.')
    } else {
      setToast(`${formatMoney(amount)} paid out to ${selected.user.full_name}`)
      setRefreshKey(refreshKey + 1)
    }
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2800)
  }

  const kpis = [
    { label: 'Total savings fund', value: formatMoney(totalBalance), note: 'What riders have saved now', Icon: PiggyBank },
    { label: 'Total deposited', value: formatMoney(totalDeposited), note: 'Shift deposits + opening balances', Icon: ArrowDownLeft },
    { label: 'Total withdrawn', value: formatMoney(totalWithdrawn), note: `${withBook.reduce((s, r) => s + r.book.withdrawalCount, 0)} withdrawals`, Icon: ArrowUpRight },
    { label: 'Riders with savings', value: withSavings, note: `of ${riders.length} rider accounts`, Icon: Users },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h1 font-bold">Rider savings</h1>
          <p className="text-small text-sonic-muted">The automatic savings deposit from every shift, and withdrawals paid out to riders</p>
        </div>
        <Button variant="secondary" size="sm" className="print:hidden" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden="true" />
          Print
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map(({ label, value, note, Icon }) => (
          <div key={label} className="flex flex-col gap-1 rounded-xl bg-white p-4 shadow-card">
            <span className="flex items-center justify-between gap-2 text-small font-medium text-sonic-muted">
              {label}
              <Icon className="size-4 text-sonic-blue" aria-hidden="true" />
            </span>
            <span className="font-display text-h2 font-bold">{value}</span>
            <span className="text-caption text-sonic-muted">{note}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[1fr_400px] xl:items-start">
        {/* ---- Riders ---- */}
        <section aria-labelledby="ledger-title" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="ledger-title" className="mr-auto font-display text-base font-bold">
              Rider passbooks
            </h2>
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-sonic-border bg-white px-3 focus-within:border-sonic-blue">
              <Search className="size-4 text-sonic-muted" aria-hidden="true" />
              <span className="sr-only">Search riders</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search rider" className="h-11 w-36 bg-transparent outline-none" />
            </label>
            <select aria-label="Account status" value={status} onChange={(e) => setStatus(e.target.value)} className="min-h-11 rounded-xl border border-sonic-border bg-white px-3 text-small font-semibold">
              <option value="all">All riders</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} className="min-h-11 rounded-xl border border-sonic-border bg-white px-3 text-small font-semibold">
              <option value="balance_desc">Balance: high to low</option>
              <option value="balance_asc">Balance: low to high</option>
              <option value="recent">Most recent activity</option>
            </select>
          </div>
          <div className="overflow-hidden rounded-xl bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-small">
                <thead className="bg-sonic-bg text-caption tracking-wide text-sonic-muted uppercase">
                  <tr>
                    {['Rider', 'Deposited', 'Withdrawn', 'Balance', 'Last activity'].map((h) => (
                      <th key={h} scope="col" className="px-4 py-2.5 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-sonic-border">
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sonic-muted">
                        No riders found.
                      </td>
                    </tr>
                  )}
                  {shown.map((r) => {
                    const isSelected = selected?.user.user_id === r.user.user_id
                    return (
                      <tr key={r.user.user_id} className={isSelected ? 'bg-sonic-blue-50' : ''}>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => setSelectedId(r.user.user_id)} aria-pressed={isSelected} className="flex items-center gap-3 text-left">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white font-display text-small font-bold text-sonic-blue shadow-card">{initials(r.user.full_name)}</span>
                            <span>
                              <span className="block font-semibold text-sonic-blue hover:underline">{r.user.full_name}</span>
                              <span className="block text-caption text-sonic-muted">
                                Rider #{r.user.user_id} · {r.profile.vehicle_type}
                                {r.user.account_status === 'suspended' && <span className="font-semibold text-red-600"> · Suspended</span>}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <p>{formatMoney(r.book.deposited)}</p>
                          <p className="text-caption text-sonic-muted">
                            {r.book.shiftDeposits} {r.book.shiftDeposits === 1 ? 'shift' : 'shifts'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p>{formatMoney(r.book.withdrawn)}</p>
                          <p className="text-caption text-sonic-muted">
                            {r.book.withdrawalCount} {r.book.withdrawalCount === 1 ? 'withdrawal' : 'withdrawals'}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-display font-bold text-green-700">{formatMoney(r.book.balance)}</td>
                        <td className="px-4 py-3">
                          {r.book.last ? (
                            <>
                              <p>{formatDate(r.book.last.created_at)}</p>
                              <p className="text-caption text-sonic-muted">
                                {r.book.last.entry_type === 'deposit' ? '+' : '−'}
                                {formatMoney(r.book.last.amount)} {r.book.last.entry_type}
                              </p>
                            </>
                          ) : (
                            <span className="text-sonic-muted">No savings yet</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ---- Selected passbook ---- */}
        {selected && (
          <aside aria-labelledby="passbook-title" className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card md:p-5 xl:sticky xl:top-24">
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sonic-blue font-display font-bold text-white">{initials(selected.user.full_name)}</span>
              <div className="min-w-0">
                <h2 id="passbook-title" className="truncate font-display text-h3 font-bold">
                  {selected.user.full_name}
                </h2>
                <p className="text-small text-sonic-muted">
                  {selected.profile.vehicle_type}
                  {selected.profile.plate_number && ` · ${selected.profile.plate_number}`} · {formatPhoneNumber(selected.user.contact_number)}
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-green-600/10 p-4">
              <p className="flex items-center gap-1.5 text-small font-medium text-green-800">
                <Wallet className="size-4" aria-hidden="true" />
                Savings balance
              </p>
              <p className="font-display text-h1 font-extrabold text-green-700">{formatMoney(selected.book.balance)}</p>
              <p className="text-caption text-green-800">
                Saved {formatMoney(selected.book.deposited)} · Withdrawn {formatMoney(selected.book.withdrawn)}
              </p>
            </div>

            <div className="border-t border-sonic-border pt-4">
              <h3 className="mb-3 font-display text-small font-semibold">Record a withdrawal</h3>
              {selected.user.account_status === 'suspended' && (
                <p className="mb-3 text-small text-amber-700">This rider is suspended. Check with the operator before paying out.</p>
              )}
              <WithdrawalForm key={`${selected.user.user_id}-${selected.book.balance}`} balance={selected.book.balance} onSave={handleWithdraw} />
              <p className="mt-2 text-caption text-sonic-muted">Paid out by you ({user.full_name}). The rider sees it in their wallet.</p>
            </div>

            <div className="border-t border-sonic-border pt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-small font-semibold">History</h3>
                <div className="flex gap-1.5">
                  {[
                    ['all', 'All'],
                    ['deposit', 'Deposits'],
                    ['withdrawal', 'Withdrawals'],
                  ].map(([key, label]) => (
                    <Chip key={key} selected={historyFilter === key} onClick={() => setHistoryFilter(key)}>
                      {label}
                    </Chip>
                  ))}
                </div>
              </div>
              <ul className="flex max-h-96 flex-col divide-y divide-sonic-border overflow-y-auto">
                {history.length === 0 && <li className="py-4 text-small text-sonic-muted">Nothing here yet.</li>}
                {history.map((e) => {
                  const isDeposit = e.entry_type === 'deposit'
                  return (
                    <li key={e.entry_id} className="flex items-start justify-between gap-3 py-2.5">
                      <span className="flex min-w-0 items-start gap-2.5">
                        <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${isDeposit ? 'bg-green-600/10 text-green-700' : 'bg-red-50 text-red-600'}`}>
                          {isDeposit ? <ArrowDownLeft className="size-4" aria-hidden="true" /> : <ArrowUpRight className="size-4" aria-hidden="true" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-small font-semibold">{isDeposit ? (e.shift_date ? 'Shift deposit' : 'Deposit') : 'Withdrawal'}</span>
                          <span className="block text-caption text-sonic-muted">
                            {formatDate(e.created_at)} · {formatTimestampTime(e.created_at)}
                            {e.note && ` · ${e.note}`}
                          </span>
                          <span className="block text-caption text-sonic-muted">By {e.processed_by_name}</span>
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
          </aside>
        )}
      </div>

      <Toast message={toast} />
    </div>
  )
}
