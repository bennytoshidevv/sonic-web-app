import { useState } from 'react'
import { Home, Landmark, MapPin, Save } from 'lucide-react'
import Button from '@shared/components/Button'
import Chip from '@shared/components/Chip'
import Input from '@shared/components/Input'
import Select from '@shared/components/Select'
import { errorText } from '@shared/utils/errors'
import { formatMoney } from '@shared/utils/format'

const LABELS = ['Home', 'Work', 'Other']

// Form for adding or editing a customer_addresses row. The barangay decides the delivery fee,
// so it is shown as soon as one is picked.
//   initial:     values of the address being edited (leave out to add a new one)
//   showDefault: show the "Set as default address" switch
// onSave receives { label, barangay_id, street_address, landmark, is_default }, and returns { error } when it was not saved.
export default function AddressForm({ barangays, initial, showDefault = false, onSave, onCancel }) {
  const [form, setForm] = useState({
    label: initial?.label || 'Home',
    barangay_id: initial ? String(initial.barangay_id) : '',
    street_address: initial?.street_address || '',
    landmark: initial?.landmark || '',
    is_default: initial?.is_default || false,
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const barangay = barangays.find((b) => b.barangay_id === Number(form.barangay_id))

  function handleChange(e) {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
    setErrors({ ...errors, [name]: '' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const found = {}
    if (!form.barangay_id) found.barangay_id = 'Please choose your barangay.'
    if (!form.street_address.trim()) found.street_address = 'Street address is required.'
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    const result = await onSave({
      label: form.label,
      barangay_id: Number(form.barangay_id),
      street_address: form.street_address.trim(),
      landmark: form.landmark.trim() || null,
      is_default: form.is_default,
    })
    setSaving(false)
    if (result?.error) setErrors({ form: errorText(result, result.message) })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-body font-medium text-sonic-ink" id="address-label-title">
          Save as
        </span>
        <div className="flex gap-2" role="group" aria-labelledby="address-label-title">
          {LABELS.map((label) => (
            <Chip key={label} selected={form.label === label} onClick={() => setForm({ ...form, label })}>
              {label}
            </Chip>
          ))}
        </div>
      </div>

      <Select
        label="Barangay"
        id="barangay_id"
        icon={MapPin}
        required
        value={form.barangay_id}
        onChange={handleChange}
        error={errors.barangay_id}
      >
        <option value="">Choose your barangay</option>
        {barangays.map((b) => (
          <option key={b.barangay_id} value={b.barangay_id}>
            {b.barangay_name}, {b.city_municipality} — {formatMoney(b.delivery_fee)} fee
          </option>
        ))}
      </Select>
      {barangay && (
        <p className="-mt-2 text-small text-sonic-muted">
          Delivery fee to {barangay.barangay_name}:{' '}
          <span className="font-display font-bold text-sonic-blue">{formatMoney(barangay.delivery_fee)}</span>
        </p>
      )}

      <Input
        label="Street address"
        id="street_address"
        icon={Home}
        placeholder="e.g. Purok 3, Rizal St."
        autoComplete="street-address"
        required
        value={form.street_address}
        onChange={handleChange}
        error={errors.street_address}
      />
      <Input
        label="Landmark"
        id="landmark"
        icon={Landmark}
        placeholder="e.g. Beside the blue sari-sari store"
        hint="Optional, but it helps the rider find you."
        value={form.landmark}
        onChange={handleChange}
      />

      {showDefault && (
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-sonic-bg p-3">
          <span>
            <span className="block text-body font-medium text-sonic-ink">Set as default address</span>
            <span className="block text-small text-sonic-muted">Used first at checkout</span>
          </span>
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
            className="peer sr-only"
          />
          {/* Switch drawn with the peer-checked state of the hidden checkbox */}
          <span
            aria-hidden="true"
            className="relative h-6 w-11 shrink-0 rounded-full bg-sonic-border transition peer-checked:bg-sonic-blue peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sonic-blue after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow-card after:transition peer-checked:after:translate-x-5"
          />
        </label>
      )}

      {errors.form && (
        <p role="alert" className="text-small font-medium text-red-600">
          {errors.form}
        </p>
      )}

      <div className="mt-1 flex flex-col gap-2 md:flex-row-reverse">
        <Button type="submit" fullWidth disabled={saving}>
          <Save className="size-4" aria-hidden="true" />
          {saving ? 'Saving…' : barangay ? `Save address · ${formatMoney(barangay.delivery_fee)} fee` : 'Save address'}
        </Button>
        <Button variant="secondary" fullWidth onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
