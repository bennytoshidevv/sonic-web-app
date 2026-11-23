import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { History, ReceiptText, Zap } from 'lucide-react'
import Button from '@shared/components/Button'
import EmptyState from '@shared/components/EmptyState'
import OrderCard from '@customer/components/OrderCard'
import Toast from '@shared/components/Toast'
import { useAuth } from '@shared/auth/AuthContext'
import { useCart } from '@customer/context/CartContext'
import { getCartItemDetails, getCustomerOrders } from '@mock/mock'
import { findProblem } from '@customer/hooks/useCartDetails'

// Delivered and cancelled orders are "past"; every other status is "active".
function isPast(entry) {
  return ['delivered', 'cancelled'].includes(entry.order.order_status)
}

export default function Orders() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addItems } = useCart()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('active') // 'active' | 'past'
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  useEffect(() => {
    getCustomerOrders(user.user_id).then((list) => {
      setOrders(list)
      setLoading(false)
    })
  }, [user.user_id])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  function showToast(message) {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3000)
  }

  // Puts the items of a past order back in the cart (only those that can still be ordered).
  async function handleReorder(entry) {
    const orderedItems = entry.stores.flatMap((store) => store.items)
    const current = await getCartItemDetails(orderedItems.map((i) => i.item_id))

    const toAdd = []
    for (const ordered of orderedItems) {
      const item = current.find((c) => c.item_id === ordered.item_id)
      if (item && !findProblem(item)) toAdd.push({ item, restaurant: item.restaurant, quantity: ordered.quantity })
    }

    if (toAdd.length === 0) {
      showToast('These items are not available right now.')
      return
    }
    addItems(toAdd)
    if (toAdd.length < orderedItems.length) {
      showToast('Added to cart. Some items are not available right now.')
    } else {
      navigate('/customer/cart')
    }
  }

  const activeOrders = orders.filter((entry) => !isPast(entry))
  const pastOrders = orders.filter(isPast)
  const shown = tab === 'active' ? activeOrders : pastOrders

  const tabs = [
    { key: 'active', label: 'Active', Icon: Zap, count: activeOrders.length },
    { key: 'past', label: 'Past', Icon: History, count: pastOrders.length },
  ]

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-h2 font-bold">My orders</h1>
        <p className="text-small text-sonic-muted">Track deliveries and see your past orders</p>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sonic-muted">Loading your orders…</p>
      ) : orders.length === 0 ? (
        <div className="mx-auto max-w-xl">
          <EmptyState
            icon={ReceiptText}
            title="No orders yet"
            text="Craving something delicious? Explore local restaurants in Sipocot and place your first order!"
          >
            <Button onClick={() => navigate('/customer')}>Browse restaurants</Button>
          </EmptyState>
        </div>
      ) : (
        <>
          {/* Active / Past tabs */}
          <div role="tablist" aria-label="Orders" className="flex rounded-full bg-white p-1 shadow-card md:max-w-md">
            {tabs.map(({ key, label, Icon, count }) => {
              const selected = tab === key
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`tab-${key}`}
                  aria-selected={selected}
                  aria-controls="orders-panel"
                  onClick={() => setTab(key)}
                  className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full font-display text-small font-semibold transition focus-visible:outline-2 focus-visible:outline-sonic-blue ${
                    selected ? 'bg-sonic-blue text-white shadow-card' : 'text-sonic-muted hover:text-sonic-ink'
                  }`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                  <span
                    className={`min-w-5 rounded-full px-1.5 text-caption font-bold ${
                      selected ? 'bg-sonic-bolt text-sonic-ink' : 'bg-sonic-bg text-sonic-muted'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Order cards: 1 column on phones, 2 on tablet, 3 on desktop */}
          <div id="orders-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-4">
            {shown.length === 0 ? (
              <div className="mx-auto max-w-xl">
                {tab === 'active' ? (
                  <EmptyState title="No active orders" text="Hungry? Your next order will show up here while it is on its way.">
                    <Button onClick={() => navigate('/customer')}>Browse restaurants</Button>
                  </EmptyState>
                ) : (
                  <EmptyState icon={History} title="No past orders yet" text="Delivered and cancelled orders will show up here." />
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
                {shown.map((entry) => (
                  <OrderCard key={entry.order.order_id} entry={entry} onReorder={handleReorder} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <Toast message={toast} />
    </div>
  )
}
