import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  Bell,
  Bike,
  CheckCircle2,
  ChefHat,
  Eye,
  Package,
  RefreshCw,
  Search,
  Star,
  UserPlus,
  Zap,
} from 'lucide-react'
import Toast from '@shared/components/Toast'
import StatusBadge from '@shared/components/StatusBadge'
import { advanceOrderByStaff, getLiveOrders, getRidersOverview } from '@api'
import { errorText } from '@shared/utils/errors'
import { averageRating, minutesBetween, orderExtraStoreFees, orderItemsSubtotal, orderTotal, pettyCashOnHand } from '@shared/utils/calc'
import { formatMoney, formatPhoneNumber, formatTimestampTime, localDateKey } from '@shared/utils/format'
import { PAYMENT_METHOD_LABELS } from '@shared/utils/labels'
import AssignRiderSheet from '@operator/components/AssignRiderSheet'
import { useStaffPaths } from '@operator/hooks/useStaffPaths'

const ACTIVE = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way']
const ASSIGNABLE = ['confirmed', 'preparing', 'ready_for_pickup']
const URGENT_MINUTES = 10 // a pending order waiting longer than this is marked urgent

// Status filter chips: which order_status values each one shows
const FILTERS = [
  { key: 'active', label: 'Active', statuses: ACTIVE },
  { key: 'pending', label: 'Pending', statuses: ['pending'] },
  { key: 'preparing', label: 'Preparing', statuses: ['confirmed', 'preparing'] },
  { key: 'ready', label: 'Ready for pickup', statuses: ['ready_for_pickup'] },
  { key: 'transit', label: 'On the way', statuses: ['picked_up', 'on_the_way'] },
  { key: 'delivered', label: 'Delivered', statuses: ['delivered'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
  { key: 'all', label: 'All', statuses: null },
]

function totalOf(entry) {
  return orderTotal(orderItemsSubtotal(entry.stores.flatMap((s) => s.items)), entry.order.base_delivery_fee, orderExtraStoreFees(entry.stores))
}

function initials(name) {
  const words = name.trim().split(/\s+/)
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase()
}

export default function LiveOrders() {
  const paths = useStaffPaths()
  const [orders, setOrders] = useState(null)
  const [riders, setRiders] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const [filter, setFilter] = useState('active')
  const [payment, setPayment] = useState('all') // 'all' | 'cod' | 'online'
  const [sort, setSort] = useState('urgent')
  const [query, setQuery] = useState('')
  const [riderFilter, setRiderFilter] = useState('all')
  const [assigning, setAssigning] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  useEffect(() => {
    Promise.all([getLiveOrders(), getRidersOverview()]).then(([orderList, riderList]) => {
      setOrders(orderList)
      setRiders(riderList)
      setLastRefreshed(new Date().toISOString())
    })
  }, [refreshKey])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  if (!orders) return <p className="py-10 text-center text-sonic-muted">Loading live orders…</p>

  const now = lastRefreshed
  const today = localDateKey(new Date(now))

  function showToast(message) {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2800)
  }

  function reload() {
    setRefreshKey(refreshKey + 1)
  }

  async function confirmOrder(entry) {
    setBusyId(entry.order.order_id)
    const result = await advanceOrderByStaff(entry.order.order_id)
    setBusyId(null)
    showToast(result.error ? errorText(result, result.error === 'payment_required' ? 'Waiting for online payment.' : 'This order can no longer be confirmed.') : `#${entry.order.order_number} confirmed`)
    reload()
  }

  // ---- Counts (KPI cards) ----
  const count = (statuses) => orders.filter((e) => statuses.includes(e.order.order_status)).length
  const deliveredToday = orders.filter((e) => {
    const row = e.history.find((h) => h.status === 'delivered')
    return row && localDateKey(new Date(row.changed_at)) === today
  })
  const deliveredTodayTotal = deliveredToday.reduce((sum, e) => sum + totalOf(e), 0)
  const pendingCount = count(['pending'])
  const kpis = [
    { key: 'pending', label: 'Pending', value: pendingCount, note: 'Need confirmation', Icon: Bell, tone: 'text-amber-600 bg-amber-500/15' },
    { key: 'preparing', label: 'Preparing', value: count(['confirmed', 'preparing']), note: 'In the kitchen', Icon: ChefHat, tone: 'text-amber-600 bg-amber-500/15' },
    { key: 'ready', label: 'Ready for pickup', value: count(['ready_for_pickup']), note: 'Waiting for a rider', Icon: Package, tone: 'text-sky-700 bg-sonic-sky/15' },
    { key: 'transit', label: 'On the way', value: count(['picked_up', 'on_the_way']), note: 'With riders', Icon: Bike, tone: 'text-sonic-violet bg-sonic-violet/10' },
    { key: 'delivered', label: 'Delivered today', value: deliveredToday.length, note: `${formatMoney(deliveredTodayTotal)} total`, Icon: CheckCircle2, tone: 'text-green-700 bg-green-600/10' },
  ]

  // ---- Filter, search, sort ----
  const statuses = FILTERS.find((f) => f.key === filter).statuses
  const q = query.trim().toLowerCase()
  const shown = orders
    .filter((e) => !statuses || statuses.includes(e.order.order_status))
    .filter((e) => payment === 'all' || (payment === 'cod' ? e.payment?.payment_method === 'cod' : e.payment?.payment_method !== 'cod'))
    .filter(
      (e) =>
        !q ||
        e.order.order_number.toLowerCase().includes(q) ||
        e.customer.full_name.toLowerCase().includes(q) ||
        e.order.dropoff_barangay.toLowerCase().includes(q),
    )
    .sort((a, b) => {
      if (sort === 'newest') return new Date(b.order.placed_at) - new Date(a.order.placed_at)
      if (sort === 'oldest') return new Date(a.order.placed_at) - new Date(b.order.placed_at)
      if (sort === 'total') return totalOf(b) - totalOf(a)
      // urgent first: pending first, then oldest first
      const rank = (e) => (e.order.order_status === 'pending' ? 0 : ACTIVE.includes(e.order.order_status) ? 1 : 2)
      return rank(a) - rank(b) || new Date(a.order.placed_at) - new Date(b.order.placed_at)
    })

  const needsRider = orders.filter((e) => ASSIGNABLE.includes(e.order.order_status) && !e.currentAssignment).length

  // ---- Riders panel ----
  const ridersOnShift = riders.filter((r) => r.openShift && r.user.account_status === 'active')
  const riderCount = (status) => ridersOnShift.filter((r) => r.profile.availability_status === status).length
  const shownRiders = ridersOnShift.filter((r) => riderFilter === 'all' || r.profile.availability_status === riderFilter)

  const chip = (selected) =>
    `min-h-10 shrink-0 rounded-full px-4 font-display text-small font-semibold shadow-card transition ${
      selected ? 'bg-sonic-blue text-white' : 'bg-white text-sonic-ink hover:bg-sonic-blue-50'
    }`

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h1 font-bold">Live orders</h1>
          <p className="text-small text-sonic-muted">
            Sipocot dispatch · {count(ACTIVE)} active {count(ACTIVE) === 1 ? 'order' : 'orders'} · Last refreshed {formatTimestampTime(now)}
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          className="flex min-h-11 items-center gap-2 rounded-full bg-white px-4 font-display text-small font-semibold text-sonic-blue shadow-card transition hover:bg-sonic-blue-50"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Command banner: the page's only gradient */}
      <section className="relative overflow-hidden rounded-xl bg-linear-135 from-sonic-blue to-sonic-violet p-5 text-white shadow-card">
        <div aria-hidden="true" className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-sonic-bolt/15 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-display text-h3 font-bold">
              <Zap className="size-5 fill-sonic-bolt text-sonic-bolt" aria-hidden="true" />
              Sipocot dispatch
            </p>
            <p className="mt-1 text-small text-sonic-blue-50">
              {pendingCount > 0
                ? `${pendingCount} ${pendingCount === 1 ? 'order is' : 'orders are'} waiting for confirmation.`
                : 'No orders waiting for confirmation.'}{' '}
              {needsRider > 0 && `${needsRider} confirmed ${needsRider === 1 ? 'order needs' : 'orders need'} a rider.`}
            </p>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-caption font-semibold">Service hours 7:30 AM – 8:30 PM</span>
        </div>
      </section>

      {/* KPI cards (click to filter) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map(({ key, label, value, note, Icon, tone }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`flex flex-col gap-2 rounded-xl bg-white p-4 text-left shadow-card transition hover:ring-2 hover:ring-sonic-blue/30 ${filter === key ? 'ring-2 ring-sonic-blue' : ''}`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-small font-medium text-sonic-muted">{label}</span>
              <span className={`flex size-8 items-center justify-center rounded-full ${tone}`}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
            </span>
            <span className="font-display text-h1 font-bold">{value}</span>
            <span className="text-caption text-sonic-muted">{note}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-5 2xl:grid 2xl:grid-cols-[1fr_340px] 2xl:items-start">
        {/* ---- Orders table ---- */}
        <section aria-labelledby="queue-title" className="flex min-w-0 flex-col gap-3">
          <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)} className={chip(filter === f.key)}>
                {f.label} ({f.statuses ? count(f.statuses) : orders.length})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-sonic-border bg-white px-3 focus-within:border-sonic-blue focus-within:ring-3 focus-within:ring-sonic-blue/25">
              <Search className="size-4 shrink-0 text-sonic-muted" aria-hidden="true" />
              <span className="sr-only">Search orders</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search order no., customer or barangay"
                className="h-11 w-full min-w-0 bg-transparent text-body outline-none placeholder:text-sonic-muted/70"
              />
            </label>
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-sonic-border bg-white px-3 text-small">
              <span className="text-sonic-muted">Payment</span>
              <select value={payment} onChange={(e) => setPayment(e.target.value)} className="bg-transparent font-semibold outline-none">
                <option value="all">All</option>
                <option value="cod">COD</option>
                <option value="online">Online</option>
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-sonic-border bg-white px-3 text-small">
              <span className="text-sonic-muted">Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-transparent font-semibold outline-none">
                <option value="urgent">Urgent first</option>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="total">Total: high to low</option>
              </select>
            </label>
          </div>

          <div className="overflow-hidden rounded-xl bg-white shadow-card">
            <div className="flex items-center justify-between gap-2 border-b border-sonic-border px-4 py-3">
              <h2 id="queue-title" className="font-display text-base font-bold">
                Orders queue
              </h2>
              {needsRider > 0 && (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-caption font-semibold text-amber-700">{needsRider} need a rider</span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-small">
                <thead className="bg-sonic-bg text-caption tracking-wide text-sonic-muted uppercase">
                  <tr>
                    {['Order', 'Customer', 'Stores', 'Drop-off', 'Total', 'Payment', 'Status', 'Rider', ''].map((h) => (
                      <th key={h} scope="col" className="px-4 py-2.5 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-sonic-border">
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-sonic-muted">
                        No orders match these filters.
                      </td>
                    </tr>
                  )}
                  {shown.map((e) => {
                    const { order } = e
                    const minutes = minutesBetween(order.placed_at, now)
                    const urgent = order.order_status === 'pending' && minutes > URGENT_MINUTES
                    const assignment = e.currentAssignment
                    const canAssign = ASSIGNABLE.includes(order.order_status)
                    return (
                      <tr key={order.order_id} className={urgent ? 'bg-amber-500/5' : ''}>
                        <td className="px-4 py-3 align-top">
                          <Link to={paths.order(order.order_id)} className="font-display font-semibold whitespace-nowrap text-sonic-blue hover:underline">
                            #{order.order_number}
                          </Link>
                          <p className="text-caption text-sonic-muted">
                            {formatTimestampTime(order.placed_at)} · {minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`}
                          </p>
                          {urgent && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-caption font-semibold text-red-600">
                              <AlertCircle className="size-3" aria-hidden="true" />
                              Urgent
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="font-semibold">{e.customer.full_name}</p>
                          <p className="text-caption text-sonic-muted">{formatPhoneNumber(e.customer.contact_number)}</p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p>{e.stores[0].name}</p>
                          {e.stores.length > 1 && <p className="text-caption text-sonic-muted">+{e.stores.length - 1} more store</p>}
                        </td>
                        <td className="px-4 py-3 align-top">{order.dropoff_barangay}</td>
                        <td className="px-4 py-3 align-top font-display font-semibold">{formatMoney(totalOf(e))}</td>
                        <td className="px-4 py-3 align-top">
                          <p>{e.payment ? PAYMENT_METHOD_LABELS[e.payment.payment_method] : '—'}</p>
                          <p className={`text-caption ${e.payment?.payment_status === 'paid' ? 'text-green-700' : 'text-sonic-muted'}`}>
                            {e.payment ? e.payment.payment_status.charAt(0).toUpperCase() + e.payment.payment_status.slice(1) : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <StatusBadge status={order.order_status} />
                        </td>
                        <td className="px-4 py-3 align-top">
                          {assignment ? (
                            <>
                              <p className="font-semibold">{assignment.rider_name}</p>
                              <p className="text-caption text-sonic-muted">{assignment.response_status === 'pending' ? 'Waiting for reply' : 'Accepted'}</p>
                            </>
                          ) : ACTIVE.includes(order.order_status) ? (
                            <span className="text-caption font-semibold text-amber-700">Unassigned</span>
                          ) : (
                            <span className="text-caption text-sonic-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center justify-end gap-1.5">
                            {order.order_status === 'pending' && (
                              <button
                                type="button"
                                disabled={busyId === order.order_id}
                                onClick={() => confirmOrder(e)}
                                className="flex min-h-9 items-center gap-1 rounded-full bg-sonic-blue px-3 font-display text-caption font-semibold text-white transition hover:bg-sonic-blue-dark disabled:opacity-60"
                              >
                                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                                Confirm
                              </button>
                            )}
                            {canAssign && (
                              <button
                                type="button"
                                onClick={() => setAssigning(e)}
                                className="flex min-h-9 items-center gap-1 rounded-full border border-sonic-blue bg-white px-3 font-display text-caption font-semibold text-sonic-blue transition hover:bg-sonic-blue-50"
                              >
                                <UserPlus className="size-3.5" aria-hidden="true" />
                                {assignment ? 'Reassign' : 'Assign'}
                              </button>
                            )}
                            <Link
                              to={paths.order(order.order_id)}
                              aria-label={`View order ${order.order_number}`}
                              className="flex size-9 items-center justify-center rounded-full text-sonic-muted transition hover:bg-sonic-blue-50 hover:text-sonic-blue"
                            >
                              <Eye className="size-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t border-sonic-border px-4 py-2.5 text-caption text-sonic-muted">
              Showing {shown.length} of {orders.length} orders
            </p>
          </div>
        </section>

        {/* ---- Riders on shift ---- */}
        <aside aria-labelledby="riders-title" className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-card 2xl:sticky 2xl:top-24">
          <div className="flex items-center justify-between gap-2">
            <h2 id="riders-title" className="font-display text-base font-bold">
              Riders on shift
            </h2>
            <span className="rounded-full bg-green-600/10 px-2.5 py-0.5 text-caption font-semibold text-green-700">{riderCount('available')} available</span>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter riders">
            {[
              ['all', `All (${ridersOnShift.length})`],
              ['available', `Available (${riderCount('available')})`],
              ['busy', `Busy (${riderCount('busy')})`],
              ['offline', `Offline (${riderCount('offline')})`],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={riderFilter === key}
                onClick={() => setRiderFilter(key)}
                className={`min-h-8 rounded-full px-3 text-caption font-semibold transition ${riderFilter === key ? 'bg-sonic-ink text-white' : 'bg-sonic-bg text-sonic-muted hover:text-sonic-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <ul className="flex flex-col divide-y divide-sonic-border">
            {shownRiders.length === 0 && <li className="py-4 text-small text-sonic-muted">No riders here.</li>}
            {shownRiders.map((r) => {
              const rating = averageRating(r.reviews)
              const availability = r.profile.availability_status
              return (
                <li key={r.user.user_id} className="flex items-center gap-3 py-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sonic-blue-50 font-display text-small font-bold text-sonic-blue">
                    {initials(r.user.full_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-small">
                      <span className="truncate font-semibold">{r.user.full_name}</span>
                      {rating !== null && (
                        <span className="flex items-center gap-0.5 text-caption text-sonic-muted">
                          <Star className="size-3 fill-sonic-bolt text-sonic-bolt" aria-hidden="true" />
                          {rating.toFixed(1)}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-caption text-sonic-muted">
                      {r.jobs.length > 0 ? `On #${r.jobs[0].order_number}` : `Since ${formatTimestampTime(r.openShift.started_at)}`} · Petty cash{' '}
                      {formatMoney(pettyCashOnHand(r.pettyCash))}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold ${
                      availability === 'available' ? 'bg-green-600/10 text-green-700' : availability === 'busy' ? 'bg-amber-500/15 text-amber-700' : 'bg-sonic-bg text-sonic-muted'
                    }`}
                  >
                    {availability.charAt(0).toUpperCase() + availability.slice(1)}
                  </span>
                </li>
              )
            })}
          </ul>
          <Link to={paths.users} className="text-center font-display text-small font-semibold text-sonic-blue hover:underline">
            Manage riders &amp; customers
          </Link>
        </aside>
      </div>

      {assigning && (
        <AssignRiderSheet
          key={assigning.order.order_id}
          entry={assigning}
          riders={riders}
          onClose={() => setAssigning(null)}
          onAssigned={(name) => {
            setAssigning(null)
            showToast(`Sent to ${name}. Waiting for the rider to accept.`)
            reload()
          }}
        />
      )}
      <Toast message={toast} />
    </div>
  )
}
