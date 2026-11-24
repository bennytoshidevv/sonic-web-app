import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Bike, BadgeCheck, CreditCard, Lock, Mail, Phone, Search, ShieldAlert, User, UserPlus, Users as UsersIcon } from 'lucide-react'
import BottomSheet from '@shared/components/BottomSheet'
import Button from '@shared/components/Button'
import Input from '@shared/components/Input'
import Select from '@shared/components/Select'
import Toast from '@shared/components/Toast'
import { useAuth } from '@shared/auth/AuthContext'
import { createRiderAccount, getCustomersForStaff, getOperatorsForStaff, getRidersOverview, setAccountStatus } from '@mock/mock'
import { formatDate, formatMoney, formatPhoneNumber, formatTimestampTime } from '@shared/utils/format'
import { isValidEmail, isValidPhMobile } from '@shared/utils/validate'

const VEHICLE_TYPES = ['Motorcycle', 'Bicycle', 'E-bike']
const SUSPEND_REASONS = ['Policy violation / code of conduct', 'Repeated cancellations', 'Fraud or order manipulation', 'Verified customer complaint', 'Other reason']

function initials(name) {
  const words = name.trim().split(/\s+/)
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase()
}

// Small text button for row actions (red = Suspend, green = Reactivate / Approve)
function ActionButton({ label, onClick, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 rounded-full px-3 font-display text-caption font-semibold ${tone === 'red' ? 'text-red-600 hover:bg-red-50' : 'text-green-700 hover:bg-green-600/10'}`}
    >
      {label}
    </button>
  )
}

function AccountBadge({ status }) {
  const styles = { active: 'bg-green-600/10 text-green-700', suspended: 'bg-red-600/10 text-red-700', inactive: 'bg-sonic-bg text-sonic-muted' }
  return <span className={`rounded-full px-2.5 py-0.5 text-caption font-semibold ${styles[status]}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
}

// Staff create a rider account directly (active), with a temporary password
function AddRiderForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ full_name: '', email: '', contact_number: '', password: '', vehicle_type: '', plate_number: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function handleChange(e) {
    const { name } = e.target
    let { value } = e.target
    if (name === 'contact_number') value = value.replace(/\D/g, '').replace(/^0/, '').slice(0, 10)
    if (name === 'plate_number') value = value.toUpperCase()
    setForm({ ...form, [name]: value })
    setErrors({ ...errors, [name]: '' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const found = {}
    if (!form.full_name.trim()) found.full_name = 'Full name is required.'
    if (!form.email.trim()) found.email = 'Email is required.'
    else if (!isValidEmail(form.email)) found.email = 'Enter a valid email address.'
    if (!isValidPhMobile(form.contact_number)) found.contact_number = 'Enter a 10-digit mobile number starting with 9.'
    if (form.password.length < 8) found.password = 'Temporary password must be at least 8 characters.'
    if (!form.vehicle_type) found.vehicle_type = 'Choose a vehicle.'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    const result = await onSave({ ...form, contact_number: '0' + form.contact_number, plate_number: form.plate_number.trim() })
    setSaving(false)
    if (result.error === 'email_taken') setErrors({ email: 'This email is already registered.' })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Full name" id="full_name" icon={User} required value={form.full_name} onChange={handleChange} error={errors.full_name} />
        <Input label="Email address" id="email" type="email" icon={Mail} required value={form.email} onChange={handleChange} error={errors.email} />
        <Input label="Contact number" id="contact_number" type="tel" inputMode="numeric" icon={Phone} prefix="+63" placeholder="9171234567" required value={form.contact_number} onChange={handleChange} error={errors.contact_number} />
        <Input label="Temporary password" id="password" type="password" icon={Lock} required hint="Give it to the rider; they change it later." value={form.password} onChange={handleChange} error={errors.password} />
        <Select label="Vehicle" id="vehicle_type" icon={Bike} required value={form.vehicle_type} onChange={handleChange} error={errors.vehicle_type}>
          <option value="">Choose a vehicle</option>
          {VEHICLE_TYPES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
        <Input label="Plate number" id="plate_number" icon={CreditCard} placeholder="e.g. ABC 1234" hint="Optional for bicycles" value={form.plate_number} onChange={handleChange} />
      </div>
      <div className="flex flex-col gap-2 md:flex-row-reverse">
        <Button type="submit" fullWidth disabled={saving}>
          <UserPlus className="size-4" aria-hidden="true" />
          {saving ? 'Creating…' : 'Create rider account'}
        </Button>
        <Button variant="secondary" fullWidth onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export default function Users() {
  const { user } = useAuth()
  const isAdmin = user.role === 'admin'
  const [riders, setRiders] = useState(null)
  const [customers, setCustomers] = useState([])
  const [operators, setOperators] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [tab, setTab] = useState('riders')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [addingRider, setAddingRider] = useState(false)
  const [suspending, setSuspending] = useState(null) // user
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  useEffect(() => {
    Promise.all([getRidersOverview(), getCustomersForStaff(), getOperatorsForStaff()]).then(([riderList, customerList, operatorList]) => {
      setRiders(riderList)
      setCustomers(customerList)
      setOperators(operatorList)
    })
  }, [refreshKey])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  if (!riders) return <p className="py-10 text-center text-sonic-muted">Loading riders and customers…</p>

  function showToast(message) {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2800)
  }

  function reload() {
    setRefreshKey(refreshKey + 1)
  }

  async function changeStatus(target, status, why) {
    const result = await setAccountStatus(user.user_id, target.user_id, status, why)
    if (result.error) {
      showToast('You cannot change this account.')
      return
    }
    showToast(`${target.full_name} is now ${status === 'active' ? 'active' : status}`)
    reload()
  }

  async function confirmSuspend() {
    if (!reason) {
      setReasonError('Please choose a reason.')
      return
    }
    await changeStatus(suspending, 'suspended', reason)
    setSuspending(null)
  }

  async function handleCreateRider(data) {
    const result = await createRiderAccount(user.user_id, data)
    if (!result.error) {
      setAddingRider(false)
      showToast(`Rider account created for ${result.user.full_name}`)
      reload()
    }
    return result
  }

  // ---- Groups ----
  const registeredRiders = riders.filter((r) => r.user.account_status !== 'inactive')
  const applications = [
    ...riders.filter((r) => r.user.account_status === 'inactive').map((r) => ({ user: r.user, profile: r.profile })),
    ...(isAdmin ? operators.filter((o) => o.account_status === 'inactive').map((o) => ({ user: o, profile: null })) : []),
  ]
  const onShift = registeredRiders.filter((r) => r.openShift).length
  const ongoingTrips = riders.reduce((sum, r) => sum + r.jobs.filter((j) => j.response_status === 'accepted').length, 0)
  const suspendedRiders = riders.filter((r) => r.user.account_status === 'suspended').length
  const suspendedCustomers = customers.filter((c) => c.user.account_status === 'suspended').length

  const q = query.trim().toLowerCase()
  const matches = (u) => !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.contact_number.includes(q)
  const statusOk = (u) => statusFilter === 'all' || u.account_status === statusFilter
  const shownRiders = registeredRiders.filter((r) => matches(r.user) && statusOk(r.user))
  const shownCustomers = customers.filter((c) => matches(c.user) && statusOk(c.user))
  const shownApplications = applications.filter((a) => matches(a.user))

  const kpis = [
    { label: 'Riders on shift', value: `${onShift} / ${registeredRiders.length}`, note: `${registeredRiders.filter((r) => r.openShift && r.profile.availability_status === 'available').length} available now` },
    { label: 'Ongoing trips', value: ongoingTrips, note: 'Accepted deliveries' },
    { label: 'Customers', value: customers.length, note: `${customers.filter((c) => c.order_count > 0).length} have ordered` },
    { label: 'Account flags', value: suspendedRiders + suspendedCustomers, note: `${suspendedRiders} rider · ${suspendedCustomers} customer suspended` },
  ]

  const tabs = [
    { key: 'riders', label: 'Riders', count: registeredRiders.length, Icon: Bike },
    { key: 'customers', label: 'Customers', count: customers.length, Icon: UsersIcon },
    { key: 'applications', label: 'Applications', count: applications.length, Icon: BadgeCheck },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h1 font-bold">Riders &amp; customers</h1>
          <p className="text-small text-sonic-muted">Rider fleet, customer directory and account access</p>
        </div>
        <Button onClick={() => setAddingRider(true)}>
          <UserPlus className="size-5" aria-hidden="true" />
          Add rider
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="flex flex-col gap-1 rounded-xl bg-white p-4 shadow-card">
            <span className="text-small font-medium text-sonic-muted">{k.label}</span>
            <span className="font-display text-h1 font-bold">{k.value}</span>
            <span className="text-caption text-sonic-muted">{k.note}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Accounts" className="scrollbar-none flex max-w-full overflow-x-auto rounded-full bg-white p-1 shadow-card">
          {tabs.map(({ key, label, count, Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={tab === key}
              aria-controls="users-panel"
              onClick={() => {
                setTab(key)
                setStatusFilter('all')
              }}
              className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 font-display text-small font-semibold transition ${tab === key ? 'bg-sonic-blue text-white shadow-card' : 'text-sonic-muted hover:text-sonic-ink'}`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
              <span className={`min-w-5 rounded-full px-1.5 text-caption ${tab === key ? 'bg-sonic-bolt text-sonic-ink' : 'bg-sonic-bg'}`}>{count}</span>
            </button>
          ))}
        </div>
        {tab !== 'applications' && (
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-sonic-border bg-white px-3 text-small">
            <span className="text-sonic-muted">Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent font-semibold outline-none">
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
        )}
        <label className="ml-auto flex min-h-11 w-full items-center gap-2 rounded-xl border border-sonic-border bg-white px-3 focus-within:border-sonic-blue focus-within:ring-3 focus-within:ring-sonic-blue/25 md:w-72">
          <Search className="size-4 shrink-0 text-sonic-muted" aria-hidden="true" />
          <span className="sr-only">Search accounts</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or number" className="h-11 w-full bg-transparent outline-none" />
        </label>
      </div>

      <div id="users-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="overflow-hidden rounded-xl bg-white shadow-card">
        <div className="overflow-x-auto">
          {tab === 'riders' && (
            <table className="w-full min-w-[980px] text-left text-small">
              <thead className="bg-sonic-bg text-caption tracking-wide text-sonic-muted uppercase">
                <tr>
                  {['Rider', 'Contact', 'Vehicle', 'Availability', 'Shift today', 'Account', ''].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-sonic-border">
                {shownRiders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sonic-muted">
                      No riders found.
                    </td>
                  </tr>
                )}
                {shownRiders.map((r) => {
                  const availability = r.profile.availability_status
                  const job = r.jobs.find((j) => j.response_status === 'accepted')
                  return (
                    <tr key={r.user.user_id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sonic-blue-50 font-display text-small font-bold text-sonic-blue">{initials(r.user.full_name)}</span>
                          <div>
                            <p className="font-semibold">{r.user.full_name}</p>
                            <p className="text-caption text-sonic-muted">Rider #{r.user.user_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatPhoneNumber(r.user.contact_number)}</td>
                      <td className="px-4 py-3">
                        <p>{r.profile.vehicle_type}</p>
                        <p className="text-caption text-sonic-muted">{r.profile.plate_number || 'No plate'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-caption font-semibold ${
                            availability === 'available' ? 'bg-green-600/10 text-green-700' : availability === 'busy' ? 'bg-amber-500/15 text-amber-700' : 'bg-sonic-bg text-sonic-muted'
                          }`}
                        >
                          {availability === 'busy' && job ? `Busy (#${job.order_number})` : availability.charAt(0).toUpperCase() + availability.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.openShift ? (
                          <>
                            <p>Open since {formatTimestampTime(r.openShift.started_at)}</p>
                            <p className="text-caption text-sonic-muted">
                              {r.deliveriesThisShift} {r.deliveriesThisShift === 1 ? 'delivery' : 'deliveries'} done
                            </p>
                          </>
                        ) : (
                          <span className="text-sonic-muted">No open shift</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <AccountBadge status={r.user.account_status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.user.account_status === 'active'
                          ? <ActionButton label="Suspend" onClick={() => {
                              setReason('')
                              setReasonError('')
                              setSuspending(r.user)
                            }} tone="red" />
                          : <ActionButton label="Reactivate" onClick={() => changeStatus(r.user, 'active', 'Reactivated')} tone="green" />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {tab === 'customers' && (
            <table className="w-full min-w-[980px] text-left text-small">
              <thead className="bg-sonic-bg text-caption tracking-wide text-sonic-muted uppercase">
                <tr>
                  {['Customer', 'Email', 'Contact', 'Orders', 'Joined', 'Account', ''].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-sonic-border">
                {shownCustomers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sonic-muted">
                      No customers found.
                    </td>
                  </tr>
                )}
                {shownCustomers.map((c) => (
                  <tr key={c.user.user_id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sonic-blue-50 font-display text-small font-bold text-sonic-blue">{initials(c.user.full_name)}</span>
                        <div>
                          <p className="font-semibold">{c.user.full_name}</p>
                          <p className="text-caption text-sonic-muted">Customer #{c.user.user_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{c.user.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatPhoneNumber(c.user.contact_number)}</td>
                    <td className="px-4 py-3">
                      <p>
                        {c.order_count} {c.order_count === 1 ? 'order' : 'orders'}
                      </p>
                      <p className="text-caption text-sonic-muted">{formatMoney(c.total_spent)} delivered</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(c.user.created_at)}</td>
                    <td className="px-4 py-3">
                      <AccountBadge status={c.user.account_status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.user.account_status === 'active'
                        ? <ActionButton label="Suspend" onClick={() => {
                            setReason('')
                            setReasonError('')
                            setSuspending(c.user)
                          }} tone="red" />
                        : <ActionButton label="Reactivate" onClick={() => changeStatus(c.user, 'active', 'Reactivated')} tone="green" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'applications' && (
            <table className="w-full min-w-[860px] text-left text-small">
              <thead className="bg-sonic-bg text-caption tracking-wide text-sonic-muted uppercase">
                <tr>
                  {['Applicant', 'Role', 'Contact', 'Vehicle', 'Applied', ''].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-sonic-border">
                {shownApplications.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sonic-muted">
                      No accounts waiting for approval.
                    </td>
                  </tr>
                )}
                {shownApplications.map(({ user: applicant, profile }) => (
                  <tr key={applicant.user_id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{applicant.full_name}</p>
                      <p className="text-caption text-sonic-muted">{applicant.email}</p>
                    </td>
                    <td className="px-4 py-3 capitalize">{applicant.role}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatPhoneNumber(applicant.contact_number)}</td>
                    <td className="px-4 py-3">{profile ? `${profile.vehicle_type}${profile.plate_number ? ` · ${profile.plate_number}` : ''}` : '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(applicant.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <ActionButton label="Approve" onClick={() => changeStatus(applicant, 'active', 'Application approved')} tone="green" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {tab === 'applications' && (
          <p className="border-t border-sonic-border px-4 py-2.5 text-caption text-sonic-muted">
            Inactive accounts: new applications, or accounts that were deactivated. {isAdmin ? 'Operator applications are shown to you as admin.' : 'Operator applications are approved by the admin.'}
          </p>
        )}
      </div>

      <BottomSheet open={addingRider} onClose={() => setAddingRider(false)} icon={UserPlus} title="Add a rider" description="The account is active right away." wide>
        {addingRider && <AddRiderForm onSave={handleCreateRider} onCancel={() => setAddingRider(false)} />}
      </BottomSheet>

      <BottomSheet
        open={suspending !== null}
        onClose={() => setSuspending(null)}
        icon={ShieldAlert}
        title={suspending ? `Suspend ${suspending.full_name}?` : ''}
        description="They can no longer log in until the account is reactivated."
      >
        <div className="flex flex-col gap-4">
          <Select
            label="Reason"
            id="suspend_reason"
            required
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              setReasonError('')
            }}
            error={reasonError}
          >
            <option value="">Choose a reason</option>
            {SUSPEND_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <p className="flex items-start gap-2 text-caption text-sonic-muted">
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            The reason is saved in the audit log.
          </p>
          <div className="flex flex-col gap-2 md:flex-row-reverse">
            <Button variant="danger" fullWidth onClick={confirmSuspend}>
              Suspend account
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setSuspending(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </BottomSheet>

      <Toast message={toast} />
    </div>
  )
}
