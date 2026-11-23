import { useEffect, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  Bike,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  House,
  KeyRound,
  Landmark,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MapPinPlus,
  Pencil,
  Phone,
  Plus,
  Trash2,
  User,
  UserRound,
  Zap,
} from 'lucide-react'
import AddressForm from '../../components/AddressForm'
import BottomSheet from '../../components/BottomSheet'
import Button from '../../components/Button'
import Input from '../../components/Input'
import Toast from '../../components/Toast'
import { useAuth } from '../../context/AuthContext'
import {
  addCustomerAddress,
  changePassword,
  deleteCustomerAddress,
  getBarangays,
  getCustomerOrders,
  setDefaultAddress,
  updateCustomerAddress,
  updateUserProfile,
} from '../../data/mock'
import { average, minutesBetween } from '../../lib/calc'
import { formatMoney, formatPhoneNumber } from '../../lib/format'
import { isValidEmail, isValidPhMobile } from '../../lib/validate'

const LABEL_ICONS = { Home: House, Work: Briefcase }

// "Maria Santos" → "MS"
function initials(name) {
  const words = name.trim().split(/\s+/)
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase()
}

// Edit name, email and contact number (users table)
function ProfileForm({ user, onSave, onCancel }) {
  const [form, setForm] = useState({
    full_name: user.full_name,
    email: user.email,
    contact_number: user.contact_number.replace(/^0/, ''), // digits after +63
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function handleChange(e) {
    const { name } = e.target
    let { value } = e.target
    if (name === 'contact_number') value = value.replace(/\D/g, '').replace(/^0/, '').slice(0, 10)
    setForm({ ...form, [name]: value })
    setErrors({ ...errors, [name]: '' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const found = {}
    if (!form.full_name.trim()) found.full_name = 'Full name is required.'
    if (!form.email.trim()) found.email = 'Email is required.'
    else if (!isValidEmail(form.email)) found.email = 'Enter a valid email address.'
    if (!form.contact_number) found.contact_number = 'Contact number is required.'
    else if (!isValidPhMobile(form.contact_number)) found.contact_number = 'Enter a 10-digit mobile number starting with 9.'
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    const result = await onSave({ ...form, contact_number: '0' + form.contact_number })
    setSaving(false)
    if (result.error === 'email_taken') setErrors({ email: 'This email is already used by another account.' })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input label="Full name" id="full_name" icon={User} autoComplete="name" required value={form.full_name} onChange={handleChange} error={errors.full_name} />
      <Input label="Email address" id="email" type="email" icon={Mail} autoComplete="email" required value={form.email} onChange={handleChange} error={errors.email} />
      <Input
        label="Contact number"
        id="contact_number"
        type="tel"
        inputMode="numeric"
        icon={Phone}
        prefix="+63"
        autoComplete="tel-national"
        required
        value={form.contact_number}
        onChange={handleChange}
        error={errors.contact_number}
      />
      <div className="mt-1 flex flex-col gap-2 md:flex-row-reverse">
        <Button type="submit" fullWidth disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button variant="secondary" fullWidth onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

// Change password: current password, new password (min 8), confirm
function PasswordForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
    setErrors({ ...errors, [e.target.name]: '' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const found = {}
    if (!form.current_password) found.current_password = 'Please enter your current password.'
    if (!form.new_password) found.new_password = 'Please enter a new password.'
    else if (form.new_password.length < 8) found.new_password = 'Password must be at least 8 characters.'
    else if (form.new_password === form.current_password) found.new_password = 'Use a different password from your current one.'
    if (!form.confirm_password) found.confirm_password = 'Please confirm your new password.'
    else if (form.confirm_password !== form.new_password) found.confirm_password = 'Passwords do not match.'
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    const result = await onSave(form.current_password, form.new_password)
    setSaving(false)
    if (result.error === 'wrong_password') setErrors({ current_password: 'Your current password is incorrect.' })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input label="Current password" id="current_password" type="password" icon={Lock} autoComplete="current-password" required value={form.current_password} onChange={handleChange} error={errors.current_password} />
      <Input label="New password" id="new_password" type="password" icon={Lock} autoComplete="new-password" required hint="At least 8 characters" value={form.new_password} onChange={handleChange} error={errors.new_password} />
      <Input label="Confirm new password" id="confirm_password" type="password" icon={Lock} autoComplete="new-password" required value={form.confirm_password} onChange={handleChange} error={errors.confirm_password} />
      <div className="mt-1 flex flex-col gap-2 md:flex-row-reverse">
        <Button type="submit" fullWidth disabled={saving}>
          {saving ? 'Saving…' : 'Change password'}
        </Button>
        <Button variant="secondary" fullWidth onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const { user, signIn, signOut } = useAuth()
  const { addresses, reloadAddresses } = useOutletContext() // from CustomerLayout

  const [orders, setOrders] = useState(null)
  const [barangays, setBarangays] = useState([])
  const [sheet, setSheet] = useState(null) // 'profile' | 'password' | 'address' | 'delete' | 'logout'
  const [selectedAddress, setSelectedAddress] = useState(null) // address being edited or deleted
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  useEffect(() => {
    getCustomerOrders(user.user_id).then(setOrders)
    getBarangays().then(setBarangays)
  }, [user.user_id])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  function showToast(message) {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2500)
  }

  function openSheet(name, address = null) {
    setSelectedAddress(address)
    setSheet(name)
  }

  function closeSheet() {
    setSheet(null)
  }

  // ---- Stats (calc.js) ----
  const allOrders = orders || []
  const delivered = allOrders.filter((entry) => entry.order.order_status === 'delivered')
  const deliveryMinutes = delivered
    .map((entry) => {
      const row = entry.history.find((h) => h.status === 'delivered')
      return row ? minutesBetween(entry.order.placed_at, row.changed_at) : null
    })
    .filter((minutes) => minutes !== null)
  const averageMinutes = average(deliveryMinutes)
  const ratedCount = allOrders.filter((entry) => entry.reviews.length > 0).length

  const customerSince = new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  const sortedAddresses = [...addresses].sort((a, b) => Number(b.is_default) - Number(a.is_default))

  // ---- Actions ----
  async function saveProfile(values) {
    const result = await updateUserProfile(user.user_id, values)
    if (!result.error) {
      signIn(result.user) // keep the logged-in user up to date
      closeSheet()
      showToast('Profile saved')
    }
    return result
  }

  async function savePassword(current, next) {
    const result = await changePassword(user.user_id, current, next)
    if (!result.error) {
      closeSheet()
      showToast('Password changed')
    }
    return result
  }

  async function saveAddress(values) {
    if (selectedAddress) await updateCustomerAddress(user.user_id, selectedAddress.address_id, values)
    else await addCustomerAddress({ ...values, user_id: user.user_id })
    await reloadAddresses()
    closeSheet()
    showToast(selectedAddress ? 'Address updated' : 'Address saved')
  }

  async function makeDefault(address) {
    await setDefaultAddress(user.user_id, address.address_id)
    await reloadAddresses()
    showToast(`${address.label || 'Address'} is now your default address`)
  }

  async function confirmDelete() {
    await deleteCustomerAddress(user.user_id, selectedAddress.address_id)
    await reloadAddresses()
    closeSheet()
    showToast('Address deleted')
  }

  function handleLogout() {
    signOut()
    navigate('/login')
  }

  const iconButton =
    'flex size-10 items-center justify-center rounded-full text-sonic-muted transition focus-visible:outline-2 focus-visible:outline-sonic-blue'

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[400px_1fr] lg:items-start lg:gap-x-8 lg:gap-y-4">
      {/* 1. Profile card */}
      <section aria-labelledby="profile-name" className="rounded-xl bg-white p-4 shadow-card md:p-6 lg:col-start-1 lg:row-start-1">
        <div className="flex items-center gap-4">
          {/* Avatar: the page's only gradient */}
          <span
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-linear-135 from-sonic-blue to-sonic-violet font-display text-h3 font-bold text-white shadow-card"
          >
            {initials(user.full_name)}
          </span>
          <div className="min-w-0">
            <h1 id="profile-name" className="truncate font-display text-h2 font-bold">
              {user.full_name}
            </h1>
            <p className="truncate text-small text-sonic-muted">{user.email}</p>
            <p className="text-small text-sonic-muted">{formatPhoneNumber(user.contact_number)}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-sonic-blue-50 px-3 py-1 text-caption font-semibold text-sonic-ink">
            <span className="flex size-5 items-center justify-center rounded-full bg-sonic-bolt">
              <Zap className="size-3 fill-sonic-ink text-sonic-ink" aria-hidden="true" />
            </span>
            Customer since {customerSince}
          </span>
          <Button variant="secondary" size="sm" onClick={() => openSheet('profile')}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit profile
          </Button>
        </div>

        {/* Stats */}
        <dl className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: 'Orders delivered', value: orders ? delivered.length : '…' },
            { label: 'Avg delivery', value: averageMinutes === null ? '—' : `${Math.round(averageMinutes)} min` },
            { label: 'Ratings given', value: orders ? ratedCount : '…' },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse items-center rounded-lg bg-sonic-bg px-2 py-3 text-center">
              <dt className="text-caption text-sonic-muted">{stat.label}</dt>
              <dd className="font-display text-h3 font-bold text-sonic-blue">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 2. Saved addresses */}
      <section aria-labelledby="addresses-title" className="flex flex-col gap-3 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h2 id="addresses-title" className="font-display text-h3 font-bold">
              Saved addresses
            </h2>
            <span className="text-small text-sonic-muted">{addresses.length} saved</span>
          </div>
          <span className="text-caption text-sonic-muted">Sipocot delivery area</span>
        </div>

        {sortedAddresses.length === 0 && (
          <p className="rounded-xl bg-white p-4 text-small text-sonic-muted shadow-card">
            No saved addresses yet. Add one so you can check out faster.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {sortedAddresses.map((address) => {
            const LabelIcon = LABEL_ICONS[address.label] || MapPin
            return (
              <article
                key={address.address_id}
                className={`flex flex-col gap-3 rounded-xl bg-white p-4 shadow-card ${address.is_default ? 'ring-1 ring-sonic-blue/40' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 rounded-full bg-sonic-blue-50 px-2.5 py-1 text-caption font-semibold text-sonic-blue">
                      <LabelIcon className="size-3.5" aria-hidden="true" />
                      {address.label || 'Address'}
                    </span>
                    {address.is_default && (
                      <span className="flex items-center gap-1 rounded-full bg-green-600/10 px-2.5 py-1 text-caption font-semibold text-green-700">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        Default
                      </span>
                    )}
                  </div>
                  <div className="-mt-1 -mr-1 flex shrink-0 items-center">
                    {!address.is_default && (
                      <button
                        type="button"
                        onClick={() => makeDefault(address)}
                        className="min-h-10 rounded-full px-2.5 font-display text-caption font-semibold text-sonic-blue transition hover:bg-sonic-blue-50 focus-visible:outline-2 focus-visible:outline-sonic-blue"
                      >
                        Set as default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openSheet('address', address)}
                      aria-label={`Edit ${address.label || 'address'}: ${address.street_address}`}
                      className={`${iconButton} hover:bg-sonic-blue-50 hover:text-sonic-blue`}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openSheet('delete', address)}
                      aria-label={`Delete ${address.label || 'address'}: ${address.street_address}`}
                      className={`${iconButton} hover:bg-red-50 hover:text-red-600`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <p className="font-display text-small font-semibold">{address.street_address}</p>
                  <p className="text-small text-sonic-ink">
                    {address.barangay_name}, {address.city_municipality}, Camarines Sur
                  </p>
                  {address.landmark && (
                    <p className="mt-1 flex items-center gap-1.5 text-small text-sonic-muted">
                      <Landmark className="size-4 shrink-0" aria-hidden="true" />
                      {address.landmark}
                    </p>
                  )}
                </div>

                <p className="flex items-center gap-1.5 border-t border-sonic-border pt-2 text-small text-sonic-muted">
                  <Bike className="size-4 shrink-0 text-sonic-blue" aria-hidden="true" />
                  Delivery fee: <span className="font-display font-bold text-sonic-blue">{formatMoney(address.delivery_fee)}</span>
                </p>
              </article>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => openSheet('address')}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sonic-blue/40 bg-white font-display text-small font-semibold text-sonic-blue transition hover:bg-sonic-blue-50 focus-visible:outline-2 focus-visible:outline-sonic-blue"
        >
          <Plus className="size-5" aria-hidden="true" />
          Add delivery address
        </button>
      </section>

      {/* 3. Settings + log out */}
      <section aria-labelledby="settings-title" className="flex flex-col gap-3 lg:col-start-1 lg:row-start-2">
        <h2 id="settings-title" className="font-display text-h3 font-bold">
          Settings
        </h2>
        <div className="overflow-hidden rounded-xl bg-white shadow-card">
          <button
            type="button"
            onClick={() => openSheet('password')}
            className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-sonic-bg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sonic-blue"
          >
            <span className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-sonic-blue-50 text-sonic-blue">
                <KeyRound className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block font-display text-small font-semibold">Change password</span>
                <span className="block text-small text-sonic-muted">Keep your account secure</span>
              </span>
            </span>
            <ChevronRight className="size-5 text-sonic-muted" aria-hidden="true" />
          </button>
          <div className="flex min-h-16 items-center gap-3 border-t border-sonic-border px-4 py-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-sonic-blue-50 text-sonic-blue">
              <Clock className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-display text-small font-semibold">Service hours</span>
              <span className="block text-small text-sonic-muted">Daily, 7:30 AM – 8:30 PM</span>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openSheet('logout')}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-red-600 bg-white font-display font-semibold text-red-600 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        >
          <LogOut className="size-5" aria-hidden="true" />
          Log out
        </button>

        <p className="flex items-center justify-center gap-1.5 text-caption text-sonic-muted">
          <Zap className="size-3.5 fill-sonic-bolt text-amber-500" aria-hidden="true" />
          Super Sonic Delivery · Sipocot, Camarines Sur
        </p>
      </section>

      {/* ---- Sheets ---- */}
      <BottomSheet open={sheet === 'profile'} onClose={closeSheet} icon={UserRound} title="Edit profile">
        <ProfileForm user={user} onSave={saveProfile} onCancel={closeSheet} />
      </BottomSheet>

      <BottomSheet open={sheet === 'password'} onClose={closeSheet} icon={KeyRound} title="Change password">
        <PasswordForm onSave={savePassword} onCancel={closeSheet} />
      </BottomSheet>

      <BottomSheet
        open={sheet === 'address'}
        onClose={closeSheet}
        icon={MapPinPlus}
        title={selectedAddress ? 'Edit address' : 'Add delivery address'}
        description="Your barangay decides the delivery fee."
      >
        <AddressForm
          key={selectedAddress ? selectedAddress.address_id : 'new'}
          barangays={barangays}
          initial={selectedAddress}
          showDefault
          onSave={saveAddress}
          onCancel={closeSheet}
        />
      </BottomSheet>

      <BottomSheet
        open={sheet === 'delete'}
        onClose={closeSheet}
        icon={Trash2}
        title="Delete this address?"
        description={selectedAddress && `${selectedAddress.label || 'Address'} · ${selectedAddress.street_address}, ${selectedAddress.barangay_name}. Past orders are not affected.`}
      >
        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <Button variant="danger" fullWidth autoFocus onClick={confirmDelete}>
            Delete address
          </Button>
          <Button variant="secondary" fullWidth onClick={closeSheet}>
            Keep it
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'logout'} onClose={closeSheet} icon={LogOut} title="Log out?" description="You will need to log in again to place an order.">
        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <Button variant="danger" fullWidth autoFocus onClick={handleLogout}>
            Log out
          </Button>
          <Button variant="secondary" fullWidth onClick={closeSheet}>
            Stay logged in
          </Button>
        </div>
      </BottomSheet>

      <Toast message={toast} />
    </div>
  )
}
