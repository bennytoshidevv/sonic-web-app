import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, MapPin, Pencil, Phone, Plus, Power, Search, Store, UtensilsCrossed } from 'lucide-react'
import BottomSheet from '@shared/components/BottomSheet'
import Button from '@shared/components/Button'
import Chip from '@shared/components/Chip'
import Input from '@shared/components/Input'
import Toast from '@shared/components/Toast'
import { getCuisineTypes, getRestaurantsForStaff, saveRestaurant, setRestaurantActive, setRestaurantOpenStatus } from '@api'
import { errorText } from '@shared/utils/errors'
import { formatPhoneNumber, formatTodayHours } from '@shared/utils/format'
import { useStaffPaths } from '@operator/hooks/useStaffPaths'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Add/edit form: details, cuisines and weekly hours (one time range per day)
function RestaurantForm({ restaurant, cuisines, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: restaurant?.name || '',
    description: restaurant?.description || '',
    address: restaurant?.address || '',
    contact_number: restaurant?.contact_number || '',
    cuisine_ids: restaurant?.cuisine_ids || [],
  })
  const [hours, setHours] = useState(
    DAYS.map((_, day) => {
      const row = restaurant?.hours.find((h) => h.day_of_week === day)
      if (restaurant && !row) return { closed: true, open: '08:00', close: '20:00' }
      return { closed: false, open: row ? row.open_time.slice(0, 5) : '08:00', close: row ? row.close_time.slice(0, 5) : '20:00' }
    }),
  )
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function handleChange(e) {
    let { value } = e.target
    if (e.target.name === 'contact_number') value = value.replace(/\D/g, '').slice(0, 11)
    setForm({ ...form, [e.target.name]: value })
    setErrors({ ...errors, [e.target.name]: '' })
  }

  function toggleCuisine(id) {
    setForm({ ...form, cuisine_ids: form.cuisine_ids.includes(id) ? form.cuisine_ids.filter((c) => c !== id) : [...form.cuisine_ids, id] })
  }

  function updateDay(day, changes) {
    setHours(hours.map((h, i) => (i === day ? { ...h, ...changes } : h)))
    setErrors({ ...errors, hours: '' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const found = {}
    if (!form.name.trim()) found.name = 'Restaurant name is required.'
    if (!form.address.trim()) found.address = 'Pickup address is required.'
    if (form.contact_number && !/^09\d{9}$/.test(form.contact_number)) found.contact_number = 'Use an 11-digit mobile number, e.g. 09171234567.'
    if (hours.some((h) => !h.closed && h.close <= h.open)) found.hours = 'Closing time must be later than opening time.'
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    await onSave({
      restaurant_id: restaurant?.restaurant_id,
      ...form,
      hours: hours.flatMap((h, day) => (h.closed ? [] : [{ day_of_week: day, open_time: `${h.open}:00`, close_time: `${h.close}:00` }])),
    })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input label="Restaurant name" id="name" icon={Store} required value={form.name} onChange={handleChange} error={errors.name} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-body font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          maxLength={200}
          value={form.description}
          onChange={handleChange}
          placeholder="e.g. Home-style Filipino silog meals and iced tea"
          className="w-full resize-none rounded-xl border border-sonic-border p-3 text-base outline-none focus:border-sonic-blue focus:ring-3 focus:ring-sonic-blue/25 md:text-body"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Pickup address" id="address" icon={MapPin} required value={form.address} onChange={handleChange} error={errors.address} />
        <Input
          label="Contact number"
          id="contact_number"
          icon={Phone}
          inputMode="numeric"
          placeholder="09171234567"
          value={form.contact_number}
          onChange={handleChange}
          error={errors.contact_number}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-body font-medium" id="cuisines-label">
          Cuisines
        </span>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="cuisines-label">
          {cuisines.map((c) => (
            <Chip key={c.cuisine_id} selected={form.cuisine_ids.includes(c.cuisine_id)} onClick={() => toggleCuisine(c.cuisine_id)}>
              {c.cuisine_name}
            </Chip>
          ))}
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-body font-medium">Weekly opening hours</legend>
        {DAYS.map((name, day) => (
          <div key={name} className="flex flex-wrap items-center gap-3 rounded-lg bg-sonic-bg px-3 py-2">
            <span className="w-24 font-display text-small font-semibold">{name}</span>
            <label className="flex items-center gap-1.5 text-small">
              <input type="checkbox" checked={hours[day].closed} onChange={(e) => updateDay(day, { closed: e.target.checked })} className="size-4 accent-sonic-blue" />
              Closed
            </label>
            {!hours[day].closed && (
              <span className="flex items-center gap-2 text-small">
                <input
                  type="time"
                  aria-label={`${name} opens`}
                  value={hours[day].open}
                  onChange={(e) => updateDay(day, { open: e.target.value })}
                  className="min-h-10 rounded-lg border border-sonic-border bg-white px-2"
                />
                to
                <input
                  type="time"
                  aria-label={`${name} closes`}
                  value={hours[day].close}
                  onChange={(e) => updateDay(day, { close: e.target.value })}
                  className="min-h-10 rounded-lg border border-sonic-border bg-white px-2"
                />
              </span>
            )}
          </div>
        ))}
        {errors.hours && (
          <p className="flex items-center gap-1.5 text-small font-medium text-red-600">
            <AlertTriangle className="size-4" aria-hidden="true" />
            {errors.hours}
          </p>
        )}
      </fieldset>

      <p className="text-caption text-sonic-muted">Logo upload comes with the backend.</p>

      <div className="flex flex-col gap-2 md:flex-row-reverse">
        <Button type="submit" fullWidth disabled={saving}>
          {saving ? 'Saving…' : 'Save restaurant'}
        </Button>
        <Button variant="secondary" fullWidth onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export default function Restaurants() {
  const paths = useStaffPaths()
  const [list, setList] = useState(null)
  const [cuisines, setCuisines] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null) // restaurant, or 'new'
  const [disabling, setDisabling] = useState(null)
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  useEffect(() => {
    Promise.all([getRestaurantsForStaff(), getCuisineTypes()]).then(([restaurantList, cuisineList]) => {
      setList(restaurantList)
      setCuisines(cuisineList)
    })
  }, [refreshKey])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  if (!list) return <p className="py-10 text-center text-sonic-muted">Loading restaurants…</p>

  function showToast(message) {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2500)
  }

  function reload() {
    setRefreshKey(refreshKey + 1)
  }

  async function handleSave(data) {
    const result = await saveRestaurant(data)
    if (result.error) return showToast(errorText(result, result.message)) // the form stays open
    setEditing(null)
    showToast(data.restaurant_id ? 'Restaurant saved' : 'Restaurant added (closed until you open it)')
    reload()
  }

  async function toggleOpen(r) {
    const result = await setRestaurantOpenStatus(r.restaurant_id, r.open_status === 'open' ? 'closed' : 'open')
    if (result.error) showToast(errorText(result, result.message))
    reload()
  }

  async function setActive(r, isActive) {
    const result = await setRestaurantActive(r.restaurant_id, isActive)
    if (result.error) return showToast(errorText(result, result.message))
    setDisabling(null)
    showToast(isActive ? `${r.name} is enabled` : `${r.name} is disabled and hidden from customers`)
    reload()
  }

  const q = query.trim().toLowerCase()
  const activeCount = list.filter((r) => r.is_active).length
  const shown = list
    .filter((r) => filter === 'all' || (filter === 'active' ? r.is_active : !r.is_active))
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.address.toLowerCase().includes(q))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h1 font-bold">Restaurants</h1>
          <p className="text-small text-sonic-muted">
            Sipocot partner network · {list.length} registered · {activeCount} enabled
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus className="size-5" aria-hidden="true" />
          Add restaurant
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          ['all', `All (${list.length})`],
          ['active', `Enabled (${activeCount})`],
          ['disabled', `Disabled (${list.length - activeCount})`],
        ].map(([key, label]) => (
          <Chip key={key} selected={filter === key} onClick={() => setFilter(key)}>
            {label}
          </Chip>
        ))}
        <label className="ml-auto flex min-h-11 w-full items-center gap-2 rounded-xl border border-sonic-border bg-white px-3 focus-within:border-sonic-blue focus-within:ring-3 focus-within:ring-sonic-blue/25 md:w-72">
          <Search className="size-4 shrink-0 text-sonic-muted" aria-hidden="true" />
          <span className="sr-only">Search restaurants</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or address" className="h-11 w-full bg-transparent outline-none" />
        </label>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-small">
            <thead className="bg-sonic-bg text-caption tracking-wide text-sonic-muted uppercase">
              <tr>
                {['Restaurant', 'Cuisines', 'Address', 'Contact', 'Hours today', 'Open / Closed', 'Status', ''].map((h) => (
                  <th key={h} scope="col" className="px-4 py-2.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-sonic-border">
              {shown.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sonic-muted">
                    No restaurants found.
                  </td>
                </tr>
              )}
              {shown.map((r) => (
                <tr key={r.restaurant_id} className={r.is_active ? '' : 'bg-sonic-bg/60 text-sonic-muted'}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sonic-blue-50 font-display font-bold text-sonic-blue">
                        {r.name[0]}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-sonic-ink">{r.name}</p>
                        {r.description && <p className="max-w-56 truncate text-caption text-sonic-muted">{r.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.cuisines.map((c) => (
                        <span key={c} className="rounded-full bg-sonic-blue-50 px-2 py-0.5 text-caption text-sonic-blue">
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">{r.address}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.contact_number ? formatPhoneNumber(r.contact_number) : '—'}</td>
                  <td className="px-4 py-3 text-caption whitespace-nowrap">{formatTodayHours(r.hours).replace('Today: ', '')}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={r.open_status === 'open'}
                      aria-label={`${r.name} is ${r.open_status}`}
                      disabled={!r.is_active}
                      onClick={() => toggleOpen(r)}
                      className="flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className={`relative h-6 w-11 rounded-full transition ${r.open_status === 'open' ? 'bg-green-600' : 'bg-sonic-border'}`}>
                        <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-card transition ${r.open_status === 'open' ? 'translate-x-5' : ''}`} />
                      </span>
                      <span className={`text-caption font-semibold ${r.open_status === 'open' ? 'text-green-700' : 'text-red-600'}`}>
                        {r.open_status === 'open' ? 'Open' : 'Closed'}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-caption font-semibold ${r.is_active ? 'bg-green-600/10 text-green-700' : 'bg-sonic-bg text-sonic-muted'}`}>
                      {r.is_active ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditing(r)}
                        className="flex min-h-9 items-center gap-1 rounded-full px-3 font-display text-caption font-semibold text-sonic-blue hover:bg-sonic-blue-50"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Edit
                      </button>
                      <Link
                        to={paths.menus(r.restaurant_id)}
                        className="flex min-h-9 items-center gap-1 rounded-full px-3 font-display text-caption font-semibold text-sonic-blue hover:bg-sonic-blue-50"
                      >
                        <UtensilsCrossed className="size-3.5" aria-hidden="true" />
                        Menu
                      </Link>
                      {r.is_active ? (
                        <button
                          type="button"
                          onClick={() => setDisabling(r)}
                          className="flex min-h-9 items-center gap-1 rounded-full px-3 font-display text-caption font-semibold text-red-600 hover:bg-red-50"
                        >
                          <Power className="size-3.5" aria-hidden="true" />
                          Disable
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActive(r, true)}
                          className="flex min-h-9 items-center gap-1 rounded-full px-3 font-display text-caption font-semibold text-green-700 hover:bg-green-600/10"
                        >
                          <Power className="size-3.5" aria-hidden="true" />
                          Enable
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        icon={Store}
        title={editing === 'new' ? 'Add restaurant' : 'Edit restaurant'}
        description={editing && editing !== 'new' ? editing.name : 'New partner restaurants start as Closed.'}
        wide
      >
        {editing && (
          <RestaurantForm
            key={editing === 'new' ? 'new' : editing.restaurant_id}
            restaurant={editing === 'new' ? null : editing}
            cuisines={cuisines}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        )}
      </BottomSheet>

      <BottomSheet
        open={disabling !== null}
        onClose={() => setDisabling(null)}
        icon={AlertTriangle}
        title={disabling ? `Disable ${disabling.name}?` : ''}
        description="It is hidden from customers and closed. Past orders stay."
      >
        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <Button variant="danger" fullWidth autoFocus onClick={() => setActive(disabling, false)}>
            Disable restaurant
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setDisabling(null)}>
            Cancel
          </Button>
        </div>
      </BottomSheet>

      <Toast message={toast} />
    </div>
  )
}
