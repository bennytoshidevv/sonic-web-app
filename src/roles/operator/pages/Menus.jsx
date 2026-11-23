import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Archive, ArrowDown, ArrowUp, FolderPlus, Info, Pencil, Plus, Search, Tag, UtensilsCrossed } from 'lucide-react'
import BottomSheet from '@shared/components/BottomSheet'
import Button from '@shared/components/Button'
import Chip from '@shared/components/Chip'
import EmptyState from '@shared/components/EmptyState'
import Input from '@shared/components/Input'
import Select from '@shared/components/Select'
import StatusBadge from '@shared/components/StatusBadge'
import Toast from '@shared/components/Toast'
import { useAuth } from '@shared/auth/AuthContext'
import {
  archiveMenuItem,
  getMenuForStaff,
  getRestaurantsForStaff,
  moveMenuCategory,
  saveMenuCategory,
  saveMenuItem,
  setMenuItemAvailable,
} from '@mock/mock'
import { formatMoney } from '@shared/utils/format'

// Small on/off switch for "available" (is_available = false means sold out)
function AvailabilitySwitch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="flex items-center gap-2">
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-green-600' : 'bg-sonic-border'}`}>
        <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-card transition ${checked ? 'translate-x-5' : ''}`} />
      </span>
      <span className={`text-caption font-semibold ${checked ? 'text-green-700' : 'text-red-600'}`}>{checked ? 'Available' : 'Sold out'}</span>
    </button>
  )
}

// Add/edit a menu item
function ItemForm({ item, categories, defaultCategoryId, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: item?.name || '',
    menu_category_id: String(item?.menu_category_id || defaultCategoryId || ''),
    price: item ? String(item.price) : '',
    description: item?.description || '',
    is_available: item ? item.is_available : true,
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function handleChange(e) {
    let { value } = e.target
    if (e.target.name === 'price') value = value.replace(/[^\d.]/g, '')
    setForm({ ...form, [e.target.name]: value })
    setErrors({ ...errors, [e.target.name]: '' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const found = {}
    if (!form.name.trim()) found.name = 'Item name is required.'
    if (!form.menu_category_id) found.menu_category_id = 'Choose a category.'
    if (!(Number(form.price) > 0)) found.price = 'Enter a price above ₱0.00.'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    await onSave({ item_id: item?.item_id, ...form, menu_category_id: Number(form.menu_category_id), price: Number(form.price) })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input label="Item name" id="name" icon={UtensilsCrossed} required value={form.name} onChange={handleChange} error={errors.name} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select label="Category" id="menu_category_id" icon={Tag} required value={form.menu_category_id} onChange={handleChange} error={errors.menu_category_id}>
          <option value="">Choose a category</option>
          {categories.map((c) => (
            <option key={c.menu_category_id} value={c.menu_category_id}>
              {c.category_name}
            </option>
          ))}
        </Select>
        <Input label="Price" id="price" inputMode="decimal" prefix="₱" placeholder="0.00" required value={form.price} onChange={handleChange} error={errors.price} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-body font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={200}
          value={form.description}
          onChange={handleChange}
          className="w-full resize-none rounded-xl border border-sonic-border p-3 text-base outline-none focus:border-sonic-blue focus:ring-3 focus:ring-sonic-blue/25 md:text-body"
        />
        <p className="text-right text-caption text-sonic-muted">{form.description.length}/200</p>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-sonic-bg p-3">
        <span>
          <span className="block text-body font-medium">Available for ordering</span>
          <span className="block text-small text-sonic-muted">Switch off when it runs out (shows as Sold out)</span>
        </span>
        <AvailabilitySwitch checked={form.is_available} onChange={(value) => setForm({ ...form, is_available: value })} label="Available for ordering" />
      </div>
      <p className="flex items-start gap-2 rounded-lg bg-sonic-blue-50 p-3 text-small">
        <Info className="mt-0.5 size-4 shrink-0 text-sonic-blue" aria-hidden="true" />
        Price changes apply to new carts. Orders already placed keep the price they were placed with.
      </p>
      <div className="flex flex-col gap-2 md:flex-row-reverse">
        <Button type="submit" fullWidth disabled={saving}>
          {saving ? 'Saving…' : 'Save item'}
        </Button>
        <Button variant="secondary" fullWidth onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export default function Menus() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [restaurants, setRestaurants] = useState(null)
  const [menu, setMenu] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [categoryId, setCategoryId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [editingItem, setEditingItem] = useState(null) // item or 'new'
  const [editingCategory, setEditingCategory] = useState(null) // category or 'new'
  const [categoryName, setCategoryName] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [archiving, setArchiving] = useState(null)
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  const restaurantId = Number(searchParams.get('restaurant')) || null

  useEffect(() => {
    getRestaurantsForStaff().then(setRestaurants)
  }, [])

  // Load the chosen restaurant's menu (the first restaurant if none is chosen)
  const effectiveRestaurantId = restaurantId || restaurants?.[0]?.restaurant_id || null
  useEffect(() => {
    if (!effectiveRestaurantId) return
    getMenuForStaff(effectiveRestaurantId).then(setMenu)
  }, [effectiveRestaurantId, refreshKey])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  if (!restaurants) return <p className="py-10 text-center text-sonic-muted">Loading menus…</p>

  const restaurant = restaurants.find((r) => r.restaurant_id === effectiveRestaurantId)
  const category = menu.find((c) => c.menu_category_id === categoryId) || menu[0] || null
  const allItems = menu.flatMap((c) => c.items)
  const availableCount = allItems.filter((i) => i.is_available).length

  function showToast(message) {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2500)
  }

  function reload() {
    setRefreshKey(refreshKey + 1)
  }

  function chooseRestaurant(id) {
    setSearchParams({ restaurant: String(id) })
    setCategoryId(null)
  }

  async function handleSaveItem(data) {
    await saveMenuItem(user.user_id, data)
    setEditingItem(null)
    setCategoryId(data.menu_category_id)
    showToast(data.item_id ? 'Item saved' : 'Item added')
    reload()
  }

  async function toggleAvailable(item) {
    await setMenuItemAvailable(user.user_id, item.item_id, !item.is_available)
    reload()
  }

  async function handleArchive() {
    await archiveMenuItem(user.user_id, archiving.item_id)
    showToast(`${archiving.name} archived`)
    setArchiving(null)
    reload()
  }

  async function handleSaveCategory(e) {
    e.preventDefault()
    if (!categoryName.trim()) {
      setCategoryError('Category name is required.')
      return
    }
    const result = await saveMenuCategory(user.user_id, restaurant.restaurant_id, {
      menu_category_id: editingCategory === 'new' ? null : editingCategory.menu_category_id,
      category_name: categoryName,
    })
    setEditingCategory(null)
    setCategoryId(result.category.menu_category_id)
    showToast('Category saved')
    reload()
  }

  async function move(c, direction) {
    await moveMenuCategory(user.user_id, c.menu_category_id, direction)
    reload()
  }

  const q = query.trim().toLowerCase()
  const items = (category?.items || [])
    .filter((i) => filter === 'all' || (filter === 'available' ? i.is_available : !i.is_available))
    .filter((i) => !q || i.name.toLowerCase().includes(q))

  return (
    <div className="flex flex-col gap-5">
      {/* Header: choose a restaurant */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-h1 font-bold">Menus</h1>
          <label className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-sonic-border bg-white px-3 shadow-card focus-within:border-sonic-blue focus-within:ring-3 focus-within:ring-sonic-blue/25">
            <span className="text-small text-sonic-muted">Restaurant</span>
            <select
              value={effectiveRestaurantId || ''}
              onChange={(e) => chooseRestaurant(Number(e.target.value))}
              className="min-w-0 bg-transparent font-display font-semibold outline-none"
            >
              {restaurants.map((r) => (
                <option key={r.restaurant_id} value={r.restaurant_id}>
                  {r.name}
                  {r.is_active ? '' : ' (disabled)'}
                </option>
              ))}
            </select>
          </label>
          {restaurant && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-small text-sonic-muted">
              {restaurant.cuisines.join(' · ')}
              <StatusBadge status={restaurant.open_status} variant="soft" />
            </p>
          )}
        </div>
        <Button onClick={() => setEditingItem('new')} disabled={menu.length === 0}>
          <Plus className="size-5" aria-hidden="true" />
          Add item
        </Button>
      </div>

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[300px_1fr] lg:items-start">
        {/* ---- Categories ---- */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <section aria-labelledby="categories-title" className="rounded-xl bg-white p-4 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h2 id="categories-title" className="font-display text-base font-bold">
                Categories ({menu.length})
              </h2>
              <button
                type="button"
                onClick={() => {
                  setCategoryName('')
                  setCategoryError('')
                  setEditingCategory('new')
                }}
                aria-label="Add category"
                className="flex size-9 items-center justify-center rounded-full text-sonic-blue hover:bg-sonic-blue-50"
              >
                <FolderPlus className="size-5" />
              </button>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {menu.length === 0 && <li className="text-small text-sonic-muted">No categories yet. Add one to start the menu.</li>}
              {menu.map((c, index) => (
                <li key={c.menu_category_id} className={`flex items-center gap-1 rounded-lg ${category?.menu_category_id === c.menu_category_id ? 'bg-sonic-blue-50 ring-1 ring-sonic-blue' : 'bg-sonic-bg'}`}>
                  <button type="button" onClick={() => setCategoryId(c.menu_category_id)} className="min-h-12 min-w-0 flex-1 px-3 text-left">
                    <span className="block truncate font-display text-small font-semibold">{c.category_name}</span>
                    <span className="block text-caption text-sonic-muted">
                      {c.items.length} {c.items.length === 1 ? 'item' : 'items'}
                    </span>
                  </button>
                  <button type="button" disabled={index === 0} onClick={() => move(c, -1)} aria-label={`Move ${c.category_name} up`} className="flex size-8 items-center justify-center rounded-full text-sonic-muted hover:bg-white disabled:opacity-30">
                    <ArrowUp className="size-4" />
                  </button>
                  <button type="button" disabled={index === menu.length - 1} onClick={() => move(c, 1)} aria-label={`Move ${c.category_name} down`} className="flex size-8 items-center justify-center rounded-full text-sonic-muted hover:bg-white disabled:opacity-30">
                    <ArrowDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryName(c.category_name)
                      setCategoryError('')
                      setEditingCategory(c)
                    }}
                    aria-label={`Rename ${c.category_name}`}
                    className="mr-1 flex size-8 items-center justify-center rounded-full text-sonic-muted hover:bg-white hover:text-sonic-blue"
                  >
                    <Pencil className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-caption text-sonic-muted">Use the arrows to change the order customers see.</p>
          </section>

          <section className="rounded-xl bg-white p-4 shadow-card">
            <h2 className="font-display text-small font-semibold">Menu availability</h2>
            <p className="mt-1 text-small">
              <span className="font-semibold text-green-700">{availableCount} available</span> ·{' '}
              <span className="font-semibold text-red-600">{allItems.length - availableCount} sold out</span>
            </p>
          </section>
        </div>

        {/* ---- Items ---- */}
        <section aria-labelledby="items-title" className="flex min-w-0 flex-col gap-3">
          {!category ? (
            <EmptyState icon={UtensilsCrossed} title="No menu yet" text="Add a category, then add the restaurant's items." />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="items-title" className="mr-auto font-display text-h3 font-bold">
                  {category.category_name}
                </h2>
                {[
                  ['all', `All (${category.items.length})`],
                  ['available', `Available (${category.items.filter((i) => i.is_available).length})`],
                  ['soldout', `Sold out (${category.items.filter((i) => !i.is_available).length})`],
                ].map(([key, label]) => (
                  <Chip key={key} selected={filter === key} onClick={() => setFilter(key)}>
                    {label}
                  </Chip>
                ))}
              </div>
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-sonic-border bg-white px-3 focus-within:border-sonic-blue focus-within:ring-3 focus-within:ring-sonic-blue/25">
                <Search className="size-4 shrink-0 text-sonic-muted" aria-hidden="true" />
                <span className="sr-only">Search items</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items in this category" className="h-11 w-full bg-transparent outline-none" />
              </label>

              <div className="overflow-hidden rounded-xl bg-white shadow-card">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-small">
                    <thead className="bg-sonic-bg text-caption tracking-wide text-sonic-muted uppercase">
                      <tr>
                        {['Item', 'Price', 'Availability', ''].map((h) => (
                          <th key={h} scope="col" className="px-4 py-2.5 font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sonic-border">
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-10 text-center text-sonic-muted">
                            No items here yet.
                          </td>
                        </tr>
                      )}
                      {items.map((item) => (
                        <tr key={item.item_id} className={item.is_available ? '' : 'bg-red-50/40'}>
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-sonic-blue-50">
                                <UtensilsCrossed className="size-5 text-sonic-blue/50" aria-hidden="true" />
                              </span>
                              <div className="min-w-0">
                                <p className="font-semibold">{item.name}</p>
                                {item.description && <p className="line-clamp-2 max-w-md text-caption text-sonic-muted">{item.description}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-display font-bold text-sonic-blue">{formatMoney(item.price)}</td>
                          <td className="px-4 py-3">
                            <AvailabilitySwitch checked={item.is_available} onChange={() => toggleAvailable(item)} label={`${item.name} available`} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingItem(item)}
                                className="flex min-h-9 items-center gap-1 rounded-full px-3 font-display text-caption font-semibold text-sonic-blue hover:bg-sonic-blue-50"
                              >
                                <Pencil className="size-3.5" aria-hidden="true" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setArchiving(item)}
                                className="flex min-h-9 items-center gap-1 rounded-full px-3 font-display text-caption font-semibold text-red-600 hover:bg-red-50"
                              >
                                <Archive className="size-3.5" aria-hidden="true" />
                                Archive
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <BottomSheet open={editingItem !== null} onClose={() => setEditingItem(null)} icon={UtensilsCrossed} title={editingItem === 'new' ? 'Add menu item' : 'Edit menu item'} description={restaurant?.name} wide>
        {editingItem && (
          <ItemForm
            key={editingItem === 'new' ? 'new' : editingItem.item_id}
            item={editingItem === 'new' ? null : editingItem}
            categories={menu}
            defaultCategoryId={category?.menu_category_id}
            onSave={handleSaveItem}
            onCancel={() => setEditingItem(null)}
          />
        )}
      </BottomSheet>

      <BottomSheet open={editingCategory !== null} onClose={() => setEditingCategory(null)} icon={FolderPlus} title={editingCategory === 'new' ? 'Add category' : 'Rename category'}>
        <form onSubmit={handleSaveCategory} noValidate className="flex flex-col gap-4">
          <Input
            label="Category name"
            id="category_name"
            required
            placeholder="e.g. Rice Bowls"
            value={categoryName}
            onChange={(e) => {
              setCategoryName(e.target.value)
              setCategoryError('')
            }}
            error={categoryError}
          />
          <div className="flex flex-col gap-2 md:flex-row-reverse">
            <Button type="submit" fullWidth>
              Save category
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setEditingCategory(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </BottomSheet>

      <BottomSheet open={archiving !== null} onClose={() => setArchiving(null)} icon={Archive} title={archiving ? `Archive ${archiving.name}?` : ''} description="It disappears from the menu. Past orders keep their copy of the name and price.">
        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <Button variant="danger" fullWidth autoFocus onClick={handleArchive}>
            Archive item
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setArchiving(null)}>
            Cancel
          </Button>
        </div>
      </BottomSheet>

      <Toast message={toast} />
    </div>
  )
}
