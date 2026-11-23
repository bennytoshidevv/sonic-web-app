import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Calculator, Fuel, MapPin, Percent, Pencil, Plus, Receipt, Save, Search, Trash2, Zap } from 'lucide-react'
import BottomSheet from '@shared/components/BottomSheet'
import Button from '@shared/components/Button'
import Input from '@shared/components/Input'
import Select from '@shared/components/Select'
import Toast from '@shared/components/Toast'
import { useAuth } from '@shared/auth/AuthContext'
import { addRateSetting, getSettingsData, saveBarangay, saveDeductionType, saveGasTiers } from '@mock/mock'
import { deliveryGross, gasAllowanceFor, riderShare, sonicShare } from '@shared/utils/calc'
import { formatDate, formatMoney, formatTimestampTime } from '@shared/utils/format'
import { tierRangeProblem } from '@shared/utils/validate'

const money = (value) => value.replace(/[^\d.]/g, '')

// ---------- Barangay fees ----------
function BarangayForm({ barangay, onSave, onCancel }) {
  const [form, setForm] = useState({
    barangay_name: barangay?.barangay_name || '',
    city_municipality: barangay?.city_municipality || 'Sipocot',
    delivery_fee: barangay ? String(barangay.delivery_fee) : '',
    is_active: barangay ? barangay.is_active : true,
  })
  const [errors, setErrors] = useState({})

  async function handleSubmit(e) {
    e.preventDefault()
    const found = {}
    if (!form.barangay_name.trim()) found.barangay_name = 'Barangay name is required.'
    if (!form.city_municipality.trim()) found.city_municipality = 'Municipality is required.'
    if (form.delivery_fee === '' || !(Number(form.delivery_fee) >= 0)) found.delivery_fee = 'Enter the delivery fee.'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    const result = await onSave({ barangay_id: barangay?.barangay_id, ...form })
    if (result.error === 'duplicate') setErrors({ barangay_name: 'This barangay is already listed.' })
  }

  const change = (name, value) => {
    setForm({ ...form, [name]: value })
    setErrors({ ...errors, [name]: '' })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Barangay" id="barangay_name" icon={MapPin} required value={form.barangay_name} onChange={(e) => change('barangay_name', e.target.value)} error={errors.barangay_name} />
        <Input label="Municipality" id="city_municipality" required value={form.city_municipality} onChange={(e) => change('city_municipality', e.target.value)} error={errors.city_municipality} />
        <Input label="Delivery fee" id="delivery_fee" inputMode="decimal" prefix="₱" required value={form.delivery_fee} onChange={(e) => change('delivery_fee', money(e.target.value))} error={errors.delivery_fee} />
        <label className="flex items-center gap-3 self-end rounded-xl bg-sonic-bg p-3 text-small">
          <input type="checkbox" checked={form.is_active} onChange={(e) => change('is_active', e.target.checked)} className="size-4 accent-sonic-blue" />
          Customers can choose this barangay
        </label>
      </div>
      <div className="flex flex-col gap-2 md:flex-row-reverse">
        <Button type="submit" fullWidth>
          Save barangay
        </Button>
        <Button variant="secondary" fullWidth onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function BarangaysTab({ barangays, onSaved }) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null) // barangay or 'new'
  const q = query.trim().toLowerCase()
  const shown = barangays.filter((b) => !q || b.barangay_name.toLowerCase().includes(q))

  async function handleSave(data) {
    const result = await saveBarangay(user.user_id, data)
    if (!result.error) {
      setEditing(null)
      onSaved(data.barangay_id ? 'Barangay saved' : 'Barangay added')
    }
    return result
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-sonic-border bg-white px-3 focus-within:border-sonic-blue focus-within:ring-3 focus-within:ring-sonic-blue/25 md:max-w-sm">
          <Search className="size-4 shrink-0 text-sonic-muted" aria-hidden="true" />
          <span className="sr-only">Search barangays</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search barangay" className="h-11 w-full bg-transparent outline-none" />
        </label>
        <Button size="sm" className="ml-auto" onClick={() => setEditing('new')}>
          <Plus className="size-4" aria-hidden="true" />
          Add barangay
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-small">
            <thead className="bg-sonic-bg text-caption tracking-wide text-sonic-muted uppercase">
              <tr>
                {['Barangay', 'Municipality', 'Delivery fee', 'Status', ''].map((h) => (
                  <th key={h} scope="col" className="px-4 py-2.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-sonic-border">
              {shown.map((b) => (
                <tr key={b.barangay_id} className={b.is_active ? '' : 'text-sonic-muted'}>
                  <td className="px-4 py-3 font-semibold">
                    <span className="flex items-center gap-2">
                      <MapPin className="size-4 text-sonic-blue" aria-hidden="true" />
                      {b.barangay_name}
                    </span>
                  </td>
                  <td className="px-4 py-3">{b.city_municipality}</td>
                  <td className="px-4 py-3 font-display font-bold text-sonic-blue">{formatMoney(b.delivery_fee)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-caption font-semibold ${b.is_active ? 'bg-green-600/10 text-green-700' : 'bg-sonic-bg text-sonic-muted'}`}>
                      {b.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setEditing(b)} className="inline-flex min-h-9 items-center gap-1 rounded-full px-3 font-display text-caption font-semibold text-sonic-blue hover:bg-sonic-blue-50">
                      <Pencil className="size-3.5" aria-hidden="true" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-sonic-border px-4 py-2.5 text-caption text-sonic-muted">
          {shown.length} of {barangays.length} barangays. Hidden barangays can&apos;t be chosen for new addresses.
        </p>
      </div>
      <BottomSheet open={editing !== null} onClose={() => setEditing(null)} icon={MapPin} title={editing === 'new' ? 'Add barangay' : 'Edit barangay'} wide>
        {editing && <BarangayForm key={editing === 'new' ? 'new' : editing.barangay_id} barangay={editing === 'new' ? null : editing} onSave={handleSave} onCancel={() => setEditing(null)} />}
      </BottomSheet>
    </section>
  )
}

// ---------- Gas allowance tiers ----------
function TiersTab({ tiers, rate, onSaved }) {
  const { user } = useAuth()
  const [rows, setRows] = useState(() =>
    tiers.map((t) => ({ min: String(t.min_delivery_fee), max: t.max_delivery_fee === null ? '' : String(t.max_delivery_fee), allowance: String(t.allowance_amount) })),
  )
  const [error, setError] = useState('')
  const [testFee, setTestFee] = useState('250')

  const parsed = rows.map((r) => ({
    min_delivery_fee: Number(r.min),
    max_delivery_fee: r.max === '' ? null : Number(r.max),
    allowance_amount: Number(r.allowance),
    is_active: true,
  }))

  function update(index, field, value) {
    setRows(rows.map((r, i) => (i === index ? { ...r, [field]: money(value) } : r)))
    setError('')
  }

  function addTier() {
    const last = parsed[parsed.length - 1]
    const start = last ? (last.max_delivery_fee === null ? '' : String(last.max_delivery_fee + 1)) : '0'
    setRows([...rows, { min: start, max: '', allowance: '' }])
  }

  async function handleSave() {
    if (rows.some((r) => r.min === '' || r.allowance === '')) {
      setError('Fill in every "from" fee and allowance.')
      return
    }
    const problem = tierRangeProblem(parsed)
    if (problem) {
      setError(problem)
      return
    }
    await saveGasTiers(user.user_id, parsed)
    onSaved('Gas allowance tiers saved')
  }

  // Simulator: what the rider and Sonic get for one fee with the tiers on screen (calc.js)
  const fee = Number(testFee) || 0
  const allowance = gasAllowanceFor(fee, parsed)
  const tier = parsed.find((t) => fee >= t.min_delivery_fee && (t.max_delivery_fee === null || fee <= t.max_delivery_fee))

  return (
    <section className="flex flex-col gap-5 xl:grid xl:grid-cols-[1fr_360px] xl:items-start">
      <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-card md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold">Gas allowance tiers</h2>
            <p className="text-small text-sonic-muted">Paid to the rider per delivery, based on the barangay delivery fee (extra-store fees not included).</p>
          </div>
          <Button variant="secondary" size="sm" onClick={addTier}>
            <Plus className="size-4" aria-hidden="true" />
            Add tier
          </Button>
        </div>
        <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-small text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Tiers must connect with no gaps or overlaps. Fees below the first tier get no allowance. Leave &quot;to&quot; empty on the last tier for &quot;and up&quot;.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-small">
            <thead className="text-caption tracking-wide text-sonic-muted uppercase">
              <tr>
                {['Fee from', 'Fee to', 'Allowance', ''].map((h) => (
                  <th key={h} scope="col" className="py-2 pr-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-sonic-border">
              {rows.map((r, i) => (
                <tr key={i}>
                  {['min', 'max', 'allowance'].map((field) => (
                    <td key={field} className="py-2 pr-3">
                      <span className="flex items-center gap-1 rounded-lg border border-sonic-border bg-white px-2 focus-within:border-sonic-blue">
                        ₱
                        <input
                          inputMode="decimal"
                          aria-label={`Tier ${i + 1} ${field === 'min' ? 'fee from' : field === 'max' ? 'fee to' : 'allowance'}`}
                          placeholder={field === 'max' ? 'and up' : '0'}
                          value={r[field]}
                          onChange={(e) => update(i, field, e.target.value)}
                          className="h-10 w-full min-w-0 bg-transparent outline-none"
                        />
                      </span>
                    </td>
                  ))}
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setRows(rows.filter((_, x) => x !== i))}
                      aria-label={`Remove tier ${i + 1}`}
                      className="flex size-9 items-center justify-center rounded-full text-sonic-muted hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-small font-medium text-red-600">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
        <Button onClick={handleSave} className="self-end">
          <Save className="size-4" aria-hidden="true" />
          Save tiers
        </Button>
      </div>

      <aside className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-card md:p-5 xl:sticky xl:top-24">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <Calculator className="size-5 text-sonic-blue" aria-hidden="true" />
          Try a delivery fee
        </h2>
        <Input label="Barangay delivery fee" id="test_fee" inputMode="decimal" prefix="₱" value={testFee} onChange={(e) => setTestFee(money(e.target.value))} />
        <dl className="flex flex-col gap-1.5 text-small">
          <div className="flex justify-between gap-3">
            <dt className="text-sonic-muted">Matching tier</dt>
            <dd>{tier ? `${formatMoney(tier.min_delivery_fee)} – ${tier.max_delivery_fee === null ? 'and up' : formatMoney(tier.max_delivery_fee)}` : 'None (no allowance)'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-sonic-muted">Gas allowance</dt>
            <dd>{formatMoney(allowance)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-sonic-muted">Rider share ({rate.rider_share_pct}%)</dt>
            <dd>{formatMoney(riderShare(fee, allowance, rate.rider_share_pct))}</dd>
          </div>
          <div className="flex justify-between gap-3 rounded-lg bg-sonic-blue-50 px-3 py-2 font-display font-semibold">
            <dt>Rider gets</dt>
            <dd className="text-sonic-blue">{formatMoney(deliveryGross(fee, allowance, rate.rider_share_pct, 0))}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-sonic-muted">Sonic keeps</dt>
            <dd>{formatMoney(sonicShare(fee, allowance, rate.rider_share_pct))}</dd>
          </div>
        </dl>
        <p className="text-caption text-sonic-muted">Uses the tiers on the left, even before you save them. Plus {formatMoney(rate.extra_store_fee)} for each extra store, all to the rider.</p>
      </aside>
    </section>
  )
}

// ---------- Deductions ----------
function DeductionForm({ deduction, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: deduction?.name || '',
    amount: deduction ? String(deduction.amount) : '',
    frequency: deduction?.frequency || 'per_shift',
    is_rider_savings: deduction?.is_rider_savings || false,
    is_active: deduction ? deduction.is_active : true,
  })
  const [errors, setErrors] = useState({})

  async function handleSubmit(e) {
    e.preventDefault()
    const found = {}
    if (!form.name.trim()) found.name = 'Name is required.'
    if (form.amount === '' || !(Number(form.amount) >= 0)) found.amount = 'Enter the amount.'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    const result = await onSave({ deduction_type_id: deduction?.deduction_type_id, ...form })
    if (result.error === 'duplicate') setErrors({ name: 'A deduction with this name already exists.' })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Name" id="deduction_name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
        <Input label="Amount" id="deduction_amount" inputMode="decimal" prefix="₱" required value={form.amount} onChange={(e) => setForm({ ...form, amount: money(e.target.value) })} error={errors.amount} />
        <Select label="Charged" id="frequency" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
          <option value="per_delivery">Per delivery</option>
          <option value="per_shift">Per shift</option>
        </Select>
        <div className="flex flex-col gap-2 self-end">
          <label className="flex items-center gap-3 rounded-xl bg-sonic-bg p-3 text-small">
            <input type="checkbox" checked={form.is_rider_savings} onChange={(e) => setForm({ ...form, is_rider_savings: e.target.checked })} className="size-4 accent-sonic-blue" />
            Goes to the rider&apos;s savings
          </label>
          <label className="flex items-center gap-3 rounded-xl bg-sonic-bg p-3 text-small">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="size-4 accent-sonic-blue" />
            Active
          </label>
        </div>
      </div>
      <div className="flex flex-col gap-2 md:flex-row-reverse">
        <Button type="submit" fullWidth>
          Save deduction
        </Button>
        <Button variant="secondary" fullWidth onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function DeductionsTab({ deductionTypes, onSaved }) {
  const { user } = useAuth()
  const [editing, setEditing] = useState(null)

  async function handleSave(data) {
    const result = await saveDeductionType(user.user_id, data)
    if (!result.error) {
      setEditing(null)
      onSaved('Deduction saved')
    }
    return result
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-small text-sonic-muted">Charged automatically: per-delivery ones when a delivery is completed, per-shift ones when a shift starts.</p>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="size-4" aria-hidden="true" />
          Add deduction
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {deductionTypes.map((d) => (
          <article key={d.deduction_type_id} className={`flex flex-col gap-2 rounded-xl bg-white p-4 shadow-card ${d.is_active ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-base font-bold">{d.name}</h3>
              <button type="button" onClick={() => setEditing(d)} aria-label={`Edit ${d.name}`} className="flex size-9 items-center justify-center rounded-full text-sonic-muted hover:bg-sonic-blue-50 hover:text-sonic-blue">
                <Pencil className="size-4" />
              </button>
            </div>
            <p className="font-display text-h2 font-bold text-sonic-blue">
              {formatMoney(d.amount)} <span className="font-sans text-small font-medium text-sonic-muted">{d.frequency === 'per_delivery' ? 'per delivery' : 'per shift'}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {d.is_rider_savings && <span className="rounded-full bg-green-600/10 px-2.5 py-0.5 text-caption font-semibold text-green-700">Goes to rider savings</span>}
              <span className={`rounded-full px-2.5 py-0.5 text-caption font-semibold ${d.is_active ? 'bg-sonic-blue-50 text-sonic-blue' : 'bg-sonic-bg text-sonic-muted'}`}>{d.is_active ? 'Active' : 'Off'}</span>
            </div>
          </article>
        ))}
      </div>
      <BottomSheet open={editing !== null} onClose={() => setEditing(null)} icon={Receipt} title={editing === 'new' ? 'Add deduction' : 'Edit deduction'} wide>
        {editing && <DeductionForm key={editing === 'new' ? 'new' : editing.deduction_type_id} deduction={editing === 'new' ? null : editing} onSave={handleSave} onCancel={() => setEditing(null)} />}
      </BottomSheet>
    </section>
  )
}

// ---------- Rates & split ----------
function RatesTab({ rates, current, onSaved }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ extra_store_fee: String(current.extra_store_fee), rider_share_pct: String(current.rider_share_pct), effective_from: '' })
  const [error, setError] = useState('')
  const pct = Number(form.rider_share_pct)

  async function handleSave(e) {
    e.preventDefault()
    if (form.extra_store_fee === '' || !(Number(form.extra_store_fee) >= 0)) return setError('Enter the extra-store fee.')
    if (!(pct > 0 && pct <= 100)) return setError('Rider share must be between 1 and 100%.')
    if (!form.effective_from) return setError('Choose when the new rates start.')
    await addRateSetting(user.user_id, { ...form, effective_from: `${form.effective_from}:00` })
    onSaved('New rates saved')
  }

  const stateStyles = { active: 'bg-green-600/10 text-green-700', upcoming: 'bg-sonic-blue-50 text-sonic-blue', superseded: 'bg-sonic-bg text-sonic-muted' }

  return (
    <section className="flex flex-col gap-5 xl:grid xl:grid-cols-[400px_1fr] xl:items-start">
      <form onSubmit={handleSave} noValidate className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card md:p-5">
        <h2 className="font-display text-base font-bold">New rates</h2>
        <Input label="Extra-store fee" id="extra_store_fee" inputMode="decimal" prefix="₱" hint="Added for each extra store in a multi-store order; goes 100% to the rider." value={form.extra_store_fee} onChange={(e) => setForm({ ...form, extra_store_fee: money(e.target.value) })} />
        <Input label="Rider share" id="rider_share_pct" inputMode="decimal" icon={Percent} hint="Of the barangay fee after the gas allowance." value={form.rider_share_pct} onChange={(e) => setForm({ ...form, rider_share_pct: money(e.target.value) })} />
        <p className="flex items-center justify-between rounded-lg bg-sonic-bg px-3 py-2 text-small">
          <span className="text-sonic-muted">Sonic share (100% − rider share)</span>
          <span className="font-display font-bold">{pct > 0 && pct <= 100 ? `${Math.round((100 - pct) * 100) / 100}%` : '—'}</span>
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="effective_from" className="text-body font-medium">
            Starts on<span className="ml-0.5 text-red-600">*</span>
          </label>
          <input id="effective_from" type="datetime-local" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} className="min-h-12 rounded-xl border border-sonic-border px-3" />
        </div>
        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-small font-medium text-red-600">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
        <Button type="submit">
          <Save className="size-4" aria-hidden="true" />
          Save new rates
        </Button>
      </form>

      <div className="overflow-hidden rounded-xl bg-white shadow-card">
        <h2 className="border-b border-sonic-border px-4 py-3 font-display text-base font-bold">Rate history</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-small">
            <thead className="bg-sonic-bg text-caption tracking-wide text-sonic-muted uppercase">
              <tr>
                {['Starts on', 'Rider / Sonic', 'Extra-store fee', 'Set by', 'Status'].map((h) => (
                  <th key={h} scope="col" className="px-4 py-2.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-sonic-border">
              {rates.map((r) => (
                <tr key={r.setting_id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDate(r.effective_from)} · {formatTimestampTime(r.effective_from)}
                  </td>
                  <td className="px-4 py-3">
                    {r.rider_share_pct}% / {Math.round((100 - r.rider_share_pct) * 100) / 100}%
                  </td>
                  <td className="px-4 py-3">{formatMoney(r.extra_store_fee)}</td>
                  <td className="px-4 py-3">{r.created_by_name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-caption font-semibold capitalize ${stateStyles[r.state]}`}>{r.state}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default function Settings() {
  const [data, setData] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [tab, setTab] = useState('barangays')
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  useEffect(() => {
    getSettingsData().then(setData)
  }, [refreshKey])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  if (!data) return <p className="py-10 text-center text-sonic-muted">Loading settings…</p>

  const current = data.rates.find((r) => r.state === 'active')
  function onSaved(message) {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2500)
    setRefreshKey(refreshKey + 1)
  }

  const tabs = [
    { key: 'barangays', label: 'Barangay fees', note: `${data.barangays.filter((b) => b.is_active).length} active`, Icon: MapPin },
    { key: 'tiers', label: 'Gas allowance', note: `${data.tiers.length} tiers`, Icon: Fuel },
    { key: 'deductions', label: 'Deductions', note: `${data.deductionTypes.filter((d) => d.is_active).length} active`, Icon: Receipt },
    { key: 'rates', label: 'Rates & split', note: `${current.rider_share_pct} / ${100 - current.rider_share_pct}`, Icon: Percent },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-h1 font-bold">Settings</h1>
        <p className="text-small text-sonic-muted">Delivery fees, rider pay rules and deductions</p>
      </div>

      <p className="flex items-start gap-2.5 rounded-xl bg-sonic-bolt/20 p-4 text-small text-sonic-ink">
        <Zap className="mt-0.5 size-4 shrink-0 fill-sonic-ink" aria-hidden="true" />
        Changes apply to new orders, deliveries and shifts only. Placed orders and recorded earnings keep the amounts saved with them. Every change is written to the audit log.
      </p>

      <div role="tablist" aria-label="Settings" className="scrollbar-none flex max-w-full gap-2 overflow-x-auto pb-1">
        {tabs.map(({ key, label, note, Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls="settings-panel"
            onClick={() => setTab(key)}
            className={`flex min-h-12 shrink-0 items-center gap-2 rounded-xl px-4 text-left shadow-card transition ${tab === key ? 'bg-sonic-blue text-white' : 'bg-white text-sonic-ink hover:bg-sonic-blue-50'}`}
          >
            <Icon className="size-5" aria-hidden="true" />
            <span>
              <span className="block font-display text-small font-semibold">{label}</span>
              <span className={`block text-caption ${tab === key ? 'text-white/80' : 'text-sonic-muted'}`}>{note}</span>
            </span>
          </button>
        ))}
      </div>

      <div id="settings-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'barangays' && <BarangaysTab barangays={data.barangays} onSaved={onSaved} />}
        {tab === 'tiers' && <TiersTab key={refreshKey} tiers={data.tiers} rate={current} onSaved={onSaved} />}
        {tab === 'deductions' && <DeductionsTab deductionTypes={data.deductionTypes} onSaved={onSaved} />}
        {tab === 'rates' && <RatesTab key={refreshKey} rates={data.rates} current={current} onSaved={onSaved} />}
      </div>

      <Toast message={toast} />
    </div>
  )
}
