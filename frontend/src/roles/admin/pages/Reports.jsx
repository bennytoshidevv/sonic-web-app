import { useEffect, useState } from 'react'
import { BadgeCheck, Ban, Bike, Download, Printer, ShoppingBag, Star, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import Button from '@shared/components/Button'
import Chip from '@shared/components/Chip'
import { getReportData } from '@api'
import {
  average,
  averageRating,
  deliveryGross,
  minutesBetween,
  orderExtraStoreFees,
  orderItemsSubtotal,
  orderTotal,
  percentChange,
  sonicShare,
  sumAmounts,
} from '@shared/utils/calc'
import { formatDate, formatMoney, localDateKey } from '@shared/utils/format'
import { PAYMENT_METHOD_LABELS } from '@shared/utils/labels'
import BarChart from '@admin/components/BarChart'
import RankedBars from '@admin/components/RankedBars'

const DAY = 86400000

function totalOf(e) {
  return orderTotal(orderItemsSubtotal(e.stores.flatMap((s) => s.items)), e.order.base_delivery_fee, orderExtraStoreFees(e.stores))
}

function dayKey(timestamp) {
  return localDateKey(new Date(timestamp))
}

function addDays(key, days) {
  return localDateKey(new Date(new Date(`${key}T00:00:00`).getTime() + days * DAY))
}

function daysBetween(from, to) {
  return Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / DAY) + 1
}

// Money and counts of the orders placed in [from, to] (calc.js)
function summarize(orders, deductions, from, to) {
  const inRange = orders.filter((e) => {
    const key = dayKey(e.order.placed_at)
    return key >= from && key <= to
  })
  const delivered = inRange.filter((e) => e.order.order_status === 'delivered')
  const cancelled = inRange.filter((e) => e.order.order_status === 'cancelled')
  const riderFees = sumAmounts(
    deductions.filter((d) => !d.type.is_rider_savings && dayKey(d.applied_at) >= from && dayKey(d.applied_at) <= to),
  )
  const feeShare = delivered
    .filter((e) => e.earning)
    .reduce((sum, e) => sum + sonicShare(e.order.base_delivery_fee, e.earning.gas_allowance_amount, e.earning.rider_share_pct), 0)
  return {
    inRange,
    delivered,
    cancelled,
    sales: delivered.reduce((sum, e) => sum + totalOf(e), 0),
    deliveryFees: delivered.reduce((sum, e) => sum + e.order.base_delivery_fee + orderExtraStoreFees(e.stores), 0),
    feeShare,
    riderFees,
  }
}

// CSV file of the orders in the range (opens in Excel / Google Sheets)
function downloadCsv(rows, from, to) {
  const header = ['Order number', 'Placed', 'Status', 'Customer', 'Barangay', 'Stores', 'Payment method', 'Payment status', 'Total']
  const lines = rows.map((e) => [
    e.order.order_number,
    e.order.placed_at.replace('T', ' ').slice(0, 16),
    e.order.order_status,
    e.customer.full_name,
    e.order.dropoff_barangay,
    e.stores.map((s) => s.name).join(' + '),
    e.payment?.payment_method || '',
    e.payment?.payment_status || '',
    totalOf(e).toFixed(2),
  ])
  const csv = [header, ...lines].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  link.download = `sonic-orders-${from}-to-${to}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

export default function Reports() {
  const [data, setData] = useState(null)
  const [today] = useState(() => localDateKey())
  const [preset, setPreset] = useState('week') // 'week' | 'month' | 'custom'
  const [custom, setCustom] = useState({ from: '', to: '' })

  useEffect(() => {
    getReportData().then(setData)
  }, [])

  if (!data) return <p className="py-10 text-center text-sonic-muted">Loading reports…</p>

  // ---- Date range ----
  let from = addDays(today, -6)
  let to = today
  if (preset === 'month') from = `${today.slice(0, 8)}01`
  if (preset === 'custom' && custom.from && custom.to && custom.from <= custom.to) {
    from = custom.from
    to = custom.to
  }
  const length = daysBetween(from, to)
  const previous = summarize(data.orders, data.deductions, addDays(from, -length), addDays(from, -1))
  const current = summarize(data.orders, data.deductions, from, to)
  const salesTrend = percentChange(current.sales, previous.sales)
  const cancelRate = current.inRange.length ? Math.round((current.cancelled.length / current.inRange.length) * 1000) / 10 : 0

  // ---- Sales per day ----
  const days = Array.from({ length }, (_, i) => addDays(from, i))
  const salesPerDay = days.map((key) => ({
    key,
    label: formatDate(`${key}T00:00:00`).replace(/, \d{4}$/, ''),
    value: current.delivered.filter((e) => dayKey(e.order.placed_at) === key).reduce((sum, e) => sum + totalOf(e), 0),
  }))
  const averagePerDay = current.sales / length

  // ---- Orders per restaurant (not cancelled) ----
  const perRestaurant = {}
  for (const e of current.inRange.filter((x) => x.order.order_status !== 'cancelled')) {
    for (const s of e.stores) perRestaurant[s.name] = (perRestaurant[s.name] || 0) + 1
  }
  const pickups = Object.values(perRestaurant).reduce((a, b) => a + b, 0)
  const restaurantRows = Object.entries(perRestaurant)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ key: name, label: name, value: count, valueText: `${count} (${Math.round((count / pickups) * 100)}%)` }))

  // ---- Top items (delivered orders) ----
  const items = {}
  for (const e of current.delivered) {
    for (const s of e.stores) {
      for (const i of s.items) {
        items[i.item_id] = items[i.item_id] || { name: i.item_name, store: s.name, quantity: 0, sales: 0 }
        items[i.item_id].quantity += i.quantity
        items[i.item_id].sales += orderItemsSubtotal([i])
      }
    }
  }
  const topItems = Object.values(items).sort((a, b) => b.sales - a.sales).slice(0, 8)

  // ---- Riders ----
  const riderRows = data.riders
    .filter((r) => r.user.account_status !== 'inactive')
    .map((r) => {
      const runs = current.delivered.filter((e) => e.earning && e.assignments.some((a) => a.rider_id === r.user.user_id && a.end_reason === 'completed'))
      const minutes = runs.map((e) => minutesBetween(e.order.placed_at, e.history.find((h) => h.status === 'delivered').changed_at))
      return {
        rider: r,
        count: runs.length,
        gross: runs.reduce((sum, e) => sum + deliveryGross(e.order.base_delivery_fee, e.earning.gas_allowance_amount, e.earning.rider_share_pct, orderExtraStoreFees(e.stores)), 0),
        rating: averageRating(r.reviews),
        avgMinutes: average(minutes),
      }
    })
    .sort((a, b) => b.count - a.count)

  // ---- Payment methods (delivered orders) ----
  const paymentRows = Object.keys(PAYMENT_METHOD_LABELS)
    .map((method) => {
      const orders = current.delivered.filter((e) => e.payment?.payment_method === method)
      const amount = orders.reduce((sum, e) => sum + totalOf(e), 0)
      return {
        key: method,
        label: PAYMENT_METHOD_LABELS[method],
        sublabel: `${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`,
        value: amount,
        valueText: `${formatMoney(amount)} (${current.sales ? Math.round((amount / current.sales) * 100) : 0}%)`,
      }
    })
    .sort((a, b) => b.value - a.value)

  const kpis = [
    {
      label: 'Total sales',
      value: formatMoney(current.sales),
      note: `${current.delivered.length} delivered orders`,
      trend: salesTrend,
      Icon: TrendingUp,
    },
    { label: 'Orders', value: current.inRange.length, note: `${current.delivered.length} delivered · ${current.inRange.length - current.delivered.length - current.cancelled.length} in progress`, Icon: ShoppingBag },
    { label: 'Delivery fees', value: formatMoney(current.deliveryFees), note: 'Barangay fees + extra-store fees', Icon: Bike },
    {
      label: 'Sonic income',
      value: formatMoney(current.feeShare + current.riderFees),
      note: `${formatMoney(current.feeShare)} fee share + ${formatMoney(current.riderFees)} operator & box fees`,
      Icon: Zap,
    },
    { label: 'Cancelled', value: current.cancelled.length, note: `${cancelRate}% of orders`, Icon: Ban },
  ]

  const card = 'rounded-xl bg-white p-4 shadow-card md:p-5'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h1 font-bold">Reports</h1>
          <p className="text-small text-sonic-muted">
            Sales, restaurants, riders and payments · {formatDate(`${from}T00:00:00`)} – {formatDate(`${to}T00:00:00`)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" />
            Print / PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={() => downloadCsv(current.inRange, from, to)}>
            <Download className="size-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Date range: one row above the charts */}
      <div className="flex flex-wrap items-center gap-2 print:hidden" role="group" aria-label="Date range">
        <Chip selected={preset === 'week'} onClick={() => setPreset('week')}>
          Last 7 days
        </Chip>
        <Chip selected={preset === 'month'} onClick={() => setPreset('month')}>
          This month
        </Chip>
        <Chip selected={preset === 'custom'} onClick={() => setPreset('custom')}>
          Custom
        </Chip>
        {preset === 'custom' && (
          <span className="flex flex-wrap items-center gap-2 text-small">
            <input type="date" aria-label="From" max={today} value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="min-h-10 rounded-lg border border-sonic-border bg-white px-2" />
            to
            <input type="date" aria-label="To" max={today} value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="min-h-10 rounded-lg border border-sonic-border bg-white px-2" />
            {(!custom.from || !custom.to || custom.from > custom.to) && <span className="text-sonic-muted">Pick a start and end date (showing the last 7 days)</span>}
          </span>
        )}
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map(({ label, value, note, trend, Icon }) => (
          <div key={label} className="flex flex-col gap-1.5 rounded-xl bg-white p-4 shadow-card">
            <span className="flex items-center justify-between gap-2 text-small font-medium text-sonic-muted">
              {label}
              <Icon className="size-4 text-sonic-blue" aria-hidden="true" />
            </span>
            <span className="font-display text-h2 font-bold">{value}</span>
            <span className="text-caption text-sonic-muted">{note}</span>
            {trend !== undefined && (
              <span className={`flex items-center gap-1 text-caption font-semibold ${trend === null ? 'text-sonic-muted' : trend >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {trend === null ? null : trend >= 0 ? <TrendingUp className="size-3.5" aria-hidden="true" /> : <TrendingDown className="size-3.5" aria-hidden="true" />}
                {trend === null ? 'No sales in the previous period' : `${trend >= 0 ? '+' : ''}${trend}% vs previous ${length} days`}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[1.4fr_1fr] xl:items-start">
        <section aria-labelledby="sales-day-title" className={card}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="sales-day-title" className="font-display text-base font-bold">
              Sales per day
            </h2>
            <span className="text-caption text-sonic-muted">Average {formatMoney(averagePerDay)} per day · delivered orders, by order date</span>
          </div>
          <div className="mt-4">
            <BarChart data={salesPerDay} formatValue={formatMoney} title="Sales per day" />
          </div>
        </section>

        <section aria-labelledby="per-restaurant-title" className={card}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="per-restaurant-title" className="font-display text-base font-bold">
              Orders per restaurant
            </h2>
            <span className="text-caption text-sonic-muted">{pickups} pickups</span>
          </div>
          <div className="mt-4">
            <RankedBars rows={restaurantRows} />
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-2 xl:items-start">
        <section aria-labelledby="items-title" className="overflow-hidden rounded-xl bg-white shadow-card">
          <h2 id="items-title" className="border-b border-sonic-border px-4 py-3 font-display text-base font-bold">
            Top items by sales
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-small">
              <thead className="bg-sonic-bg text-caption tracking-wide text-sonic-muted uppercase">
                <tr>
                  {['#', 'Item', 'Restaurant', 'Qty', 'Sales'].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-sonic-border">
                {topItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sonic-muted">
                      No delivered orders in this range.
                    </td>
                  </tr>
                )}
                {topItems.map((item, index) => (
                  <tr key={`${item.name}-${item.store}`}>
                    <td className="px-4 py-2.5 text-sonic-muted">{index + 1}</td>
                    <td className="px-4 py-2.5 font-semibold">{item.name}</td>
                    <td className="px-4 py-2.5 text-sonic-muted">{item.store}</td>
                    <td className="px-4 py-2.5">{item.quantity}</td>
                    <td className="px-4 py-2.5 font-display font-semibold">{formatMoney(item.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="riders-title" className="overflow-hidden rounded-xl bg-white shadow-card">
          <h2 id="riders-title" className="border-b border-sonic-border px-4 py-3 font-display text-base font-bold">
            Rider performance
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-small">
              <thead className="bg-sonic-bg text-caption tracking-wide text-sonic-muted uppercase">
                <tr>
                  {['Rider', 'Delivered', 'Rating', 'Gross pay', 'Avg time'].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-sonic-border">
                {riderRows.map((r) => (
                  <tr key={r.rider.user.user_id}>
                    <td className="px-4 py-2.5">
                      <p className="font-semibold">{r.rider.user.full_name}</p>
                      {r.rider.user.account_status === 'suspended' && <p className="text-caption font-semibold text-red-600">Suspended</p>}
                    </td>
                    <td className="px-4 py-2.5">{r.count}</td>
                    <td className="px-4 py-2.5">
                      {r.rating === null ? (
                        <span className="text-sonic-muted">—</span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Star className="size-3.5 fill-sonic-bolt text-sonic-bolt" aria-hidden="true" />
                          {r.rating.toFixed(1)} <span className="text-caption text-sonic-muted">({r.rider.reviews.length})</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-display font-semibold">{formatMoney(r.gross)}</td>
                    <td className="px-4 py-2.5">{r.avgMinutes === null ? '—' : `${Math.round(r.avgMinutes)} min`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-sonic-border px-4 py-2.5 text-caption text-sonic-muted">Avg time = from order placed to delivered. Ratings are all-time.</p>
        </section>
      </div>

      <section aria-labelledby="payments-title" className={card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="payments-title" className="flex items-center gap-2 font-display text-base font-bold">
            <BadgeCheck className="size-5 text-sonic-blue" aria-hidden="true" />
            Payment methods
          </h2>
          <span className="text-caption text-sonic-muted">
            Delivered orders · {formatMoney(current.sales)} total
          </span>
        </div>
        <div className="mt-4 max-w-3xl">
          <RankedBars rows={paymentRows} />
        </div>
      </section>
    </div>
  )
}
