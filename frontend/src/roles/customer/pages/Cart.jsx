import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, Bike, ChevronDown, MapPin, ShoppingBag, Store, Trash2, Zap } from 'lucide-react'
import BottomSheet from '@shared/components/BottomSheet'
import Button from '@shared/components/Button'
import CartItemRow from '@customer/components/CartItemRow'
import EmptyState from '@shared/components/EmptyState'
import { useCart } from '@customer/context/CartContext'
import { cartItemCount, cartSubtotal, extraStoreFees, orderTotal } from '@shared/utils/calc'
import { formatMoney } from '@shared/utils/format'
import { useCartDetails } from '@customer/hooks/useCartDetails'

export default function Cart() {
  const navigate = useNavigate()
  const { address, addresses, setAddressId } = useOutletContext() // from CustomerLayout
  const { lines, stores, changeQuantity, removeItems, clearCart } = useCart()

  // Cart lines with the current price and any problem (sold out, closed, removed)
  const { loading, cartLines, details, rates } = useCartDetails(lines)
  const [confirmClear, setConfirmClear] = useState(false)

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          text="Explore restaurants around Sipocot and add your favorites for lightning-fast delivery!"
        >
          <Button onClick={() => navigate('/customer')}>Browse restaurants</Button>
        </EmptyState>
      </div>
    )
  }

  if (loading) return <p className="py-10 text-center text-sonic-muted">Loading cart…</p>

  const problemLines = cartLines.filter((line) => line.problem)

  // Totals (calc.js): subtotal + barangay delivery fee + extra-store fees
  const itemCount = cartItemCount(cartLines)
  const subtotal = cartSubtotal(cartLines)
  const deliveryFee = address ? address.delivery_fee : 0
  const extraFees = extraStoreFees(stores.length, rates.extra_store_fee)
  const total = orderTotal(subtotal, deliveryFee, extraFees)

  // Checkout is blocked by unavailable items or a missing address
  let blockMessage = null
  if (problemLines.length === 1) blockMessage = `Remove ${problemLines[0].name} to check out`
  else if (problemLines.length > 1) blockMessage = `Remove ${problemLines.length} unavailable items to check out`
  else if (!address) blockMessage = 'Add a delivery address to check out'
  const canCheckout = blockMessage === null

  function removeProblems() {
    removeItems(problemLines.map((line) => line.item_id))
  }

  function handleClearCart() {
    clearCart()
    setConfirmClear(false)
  }

  // Shown in the bottom bar (phone/tablet) and in the summary card (desktop)
  const checkoutAction = (
    <>
      {blockMessage && (
        <div role="alert" className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-small text-red-700">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {blockMessage}
          </span>
          {problemLines.length > 0 && (
            <button type="button" onClick={removeProblems} className="shrink-0 font-semibold underline">
              Fix now
            </button>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => navigate('/customer/checkout')}
        disabled={!canCheckout}
        className="flex h-12 w-full items-center justify-between gap-3 rounded-full bg-sonic-blue px-4 font-display font-semibold text-white shadow-[0_4px_14px_rgba(24,60,240,0.3)] transition hover:bg-sonic-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sonic-blue active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-sonic-muted disabled:opacity-60 disabled:shadow-none"
      >
        <span className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-sonic-bolt">
            <Zap className="size-4 fill-sonic-ink text-sonic-ink" aria-hidden="true" />
          </span>
          Checkout
        </span>
        <span className="flex items-center gap-1 font-bold">
          {formatMoney(total)}
          <ArrowRight className="size-5" aria-hidden="true" />
        </span>
      </button>
    </>
  )

  return (
    <div className="pb-12 lg:pb-0">
      {/* Page header */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="-ml-2 flex size-11 items-center justify-center rounded-full text-sonic-ink transition hover:bg-sonic-blue-50 focus-visible:outline-2 focus-visible:outline-sonic-blue"
          >
            <ArrowLeft className="size-6" />
          </button>
          <h1 className="font-display text-h2 font-bold">My cart</h1>
        </div>
        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-small font-semibold text-sonic-muted transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-sonic-blue"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Clear cart
        </button>
      </div>

      {/* Desktop: items on the left, summary on the right (sticky). Phone/tablet: stacked. */}
      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-4">
          {/* Delivery address (decides the delivery fee) */}
          {address ? (
            <label className="relative flex min-h-12 items-center gap-2 rounded-xl bg-white py-2 pr-10 pl-4 shadow-card focus-within:ring-2 focus-within:ring-sonic-blue/40">
              <MapPin className="size-5 shrink-0 fill-sonic-blue-50 text-sonic-blue" aria-hidden="true" />
              <span className="shrink-0 text-small text-sonic-muted">Deliver to:</span>
              <select
                value={address.address_id}
                onChange={(e) => setAddressId(Number(e.target.value))}
                className="min-w-0 flex-1 cursor-pointer appearance-none truncate bg-transparent font-display text-small font-semibold text-sonic-ink outline-none"
              >
                {addresses.map((a) => (
                  <option key={a.address_id} value={a.address_id}>
                    {a.label} · {a.street_address}, {a.barangay_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 size-4 text-sonic-blue" aria-hidden="true" />
            </label>
          ) : (
            <p className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-small text-sonic-muted shadow-card">
              <MapPin className="size-5 shrink-0 text-sonic-blue" aria-hidden="true" />
              No saved delivery address yet.
            </p>
          )}

          {/* Multi-store notice */}
          {stores.length > 1 && (
            <div className="flex items-center gap-3 rounded-xl bg-sonic-blue-50 p-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sonic-bolt">
                <Zap className="size-4 fill-sonic-ink text-sonic-ink" aria-hidden="true" />
              </span>
              <p className="text-small text-sonic-ink">
                <span className="font-semibold text-sonic-blue">Multi-store order:</span> one rider picks up from all{' '}
                {stores.length} stores in one trip. Each extra store adds {formatMoney(rates.extra_store_fee)}.
              </p>
            </div>
          )}

          {/* One card per store. The first store added is the main store. */}
          {stores.map((store, index) => {
            const storeLines = cartLines.filter((line) => line.restaurant_id === store.restaurant_id)
            const restaurant = details[storeLines[0].item_id]?.restaurant
            return (
              <section
                key={store.restaurant_id}
                aria-labelledby={`store-${store.restaurant_id}`}
                className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-card md:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sonic-blue-50">
                      <Store className="size-5 text-sonic-blue" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h2 id={`store-${store.restaurant_id}`} className="truncate font-display text-h3 font-bold">
                        {store.name}
                      </h2>
                      {restaurant?.description && (
                        <p className="truncate text-small text-sonic-muted">{restaurant.description}</p>
                      )}
                    </div>
                  </div>
                  {index === 0 ? (
                    <span className="shrink-0 rounded-full bg-sonic-blue-50 px-2.5 py-1 text-caption font-semibold text-sonic-blue">
                      Main store
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-sonic-violet/10 px-2.5 py-1 text-caption font-semibold text-sonic-violet">
                      Extra store +{formatMoney(rates.extra_store_fee)}
                    </span>
                  )}
                </div>

                {storeLines.map((line) => (
                  <CartItemRow
                    key={line.item_id}
                    line={line}
                    onIncrease={() => changeQuantity(line.item_id, 1)}
                    onDecrease={() => changeQuantity(line.item_id, -1)}
                    onRemove={() => removeItems([line.item_id])}
                  />
                ))}
              </section>
            )
          })}
        </div>

        {/* Order summary */}
        <aside className="mt-4 lg:sticky lg:top-24 lg:mt-0">
          <section aria-labelledby="summary-title" className="rounded-xl bg-white p-4 shadow-card md:p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 id="summary-title" className="font-display text-h3 font-bold">
                Order summary
              </h2>
              <span className="rounded-full bg-sonic-bg px-2.5 py-0.5 text-caption font-medium text-sonic-muted">
                {stores.length} {stores.length === 1 ? 'store' : 'stores'}
              </span>
            </div>

            <dl className="mt-3 flex flex-col gap-2 text-body">
              <div className="flex justify-between gap-3">
                <dt className="text-sonic-muted">
                  Items subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})
                </dt>
                <dd className="font-display font-semibold">{formatMoney(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-sonic-muted">
                  Delivery fee{address && ` (${address.barangay_name})`}
                  <Bike className="size-4" aria-hidden="true" />
                </dt>
                <dd className="font-display font-semibold">{address ? formatMoney(deliveryFee) : '—'}</dd>
              </div>
              {extraFees > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-sonic-muted">
                    Extra-store fee ({stores.length - 1} extra {stores.length - 1 === 1 ? 'store' : 'stores'})
                  </dt>
                  <dd className="font-display font-semibold text-sonic-violet">+{formatMoney(extraFees)}</dd>
                </div>
              )}
            </dl>

            <div className="my-3 h-px bg-sonic-border" />

            <div className="flex items-end justify-between gap-3">
              <span className="font-display text-h2 font-bold">Total</span>
              <span className="font-display text-h1 font-extrabold text-sonic-blue">{formatMoney(total)}</span>
            </div>

            {/* Desktop: checkout button inside the summary */}
            <div className="mt-5 hidden lg:block">{checkoutAction}</div>
          </section>
        </aside>
      </div>

      {/* Phone/tablet: checkout bar fixed at the bottom */}
      <div className="fixed inset-x-0 bottom-0 z-40 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(11,16,51,0.08)] backdrop-blur-md lg:hidden">
        <div className="mx-auto max-w-xl">{checkoutAction}</div>
      </div>

      {/* Clear cart confirmation */}
      <BottomSheet
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        icon={Trash2}
        title="Clear your cart?"
        description={`This removes all ${itemCount} ${itemCount === 1 ? 'item' : 'items'} from ${stores.length} ${stores.length === 1 ? 'store' : 'stores'}.`}
      >
        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <Button variant="danger" fullWidth autoFocus onClick={handleClearCart}>
            Clear cart
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setConfirmClear(false)}>
            Keep items
          </Button>
        </div>
      </BottomSheet>
    </div>
  )
}
