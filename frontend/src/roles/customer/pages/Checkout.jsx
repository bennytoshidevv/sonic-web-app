import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useOutletContext } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  ChevronDown,
  CreditCard,
  Info,
  MapPin,
  MapPinPlus,
  Plus,
  QrCode,
  Wallet,
  WalletCards,
} from 'lucide-react'
import Alert from '@shared/components/Alert'
import AddressForm from '@customer/components/AddressForm'
import BottomSheet from '@shared/components/BottomSheet'
import Button from '@shared/components/Button'
import { useCart } from '@customer/context/CartContext'
import { getBarangays, placeOrder, startOnlinePayment } from '@api'
import { errorText } from '@shared/utils/errors'
import { cartItemCount, cartSubtotal, extraStoreFees, lineTotal, orderTotal } from '@shared/utils/calc'
import { formatMoney } from '@shared/utils/format'
import { PAYMENT_METHOD_LABELS } from '@shared/utils/labels'
import { useCartDetails } from '@customer/hooks/useCartDetails'

// payments.payment_method options, COD first (the default)
const PAYMENT_OPTIONS = [
  { value: 'cod', Icon: Banknote, note: 'Pay the rider in cash when your order arrives' },
  { value: 'gcash', Icon: Wallet, note: 'Pay securely via PayMongo' },
  { value: 'maya', Icon: WalletCards, note: 'Pay securely via PayMongo' },
  { value: 'qr_ph', Icon: QrCode, note: 'Pay securely via PayMongo' },
  { value: 'card', Icon: CreditCard, note: 'Pay securely via PayMongo' },
]

const NOTES_MAX = 300

export default function Checkout() {
  const navigate = useNavigate()
  const { address, addresses, setAddressId, addAddress } = useOutletContext() // from CustomerLayout
  const { lines, stores, clearCart } = useCart()
  const { loading, cartLines, rates } = useCartDetails(lines)

  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [notes, setNotes] = useState('')
  const [choosingAddress, setChoosingAddress] = useState(false)
  const [addingAddress, setAddingAddress] = useState(false)
  const [barangays, setBarangays] = useState([])
  const [placing, setPlacing] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [placedOrderId, setPlacedOrderId] = useState(null) // set once the order is placed
  const [payError, setPayError] = useState('') // the order is placed, but the payment page could not be opened

  useEffect(() => {
    getBarangays().then(setBarangays)
  }, [])

  // Nothing to check out: go back to the (empty) cart
  // Order placed: go to its tracking page (the cart is now empty, so this must come first)
  if (placedOrderId) return <Navigate to={`/customer/orders/${placedOrderId}`} replace state={{ payError }} />
  // Nothing to check out: go back to the (empty) cart
  if (lines.length === 0) return <Navigate to="/customer/cart" replace />
  if (loading) return <p className="py-10 text-center text-sonic-muted">Loading checkout…</p>

  const problemLines = cartLines.filter((line) => line.problem)

  // Totals (calc.js): subtotal + barangay delivery fee + extra-store fees
  const itemCount = cartItemCount(cartLines)
  const subtotal = cartSubtotal(cartLines)
  const deliveryFee = address ? address.delivery_fee : 0
  const extraFees = extraStoreFees(stores.length, rates.extra_store_fee)
  const total = orderTotal(subtotal, deliveryFee, extraFees)

  let blockMessage = null
  if (problemLines.length > 0) blockMessage = 'Some items are no longer available'
  else if (!address) blockMessage = 'Add a delivery address to place your order'
  const canPlaceOrder = blockMessage === null && !placing

  async function handleSaveAddress(newAddress) {
    const result = await addAddress(newAddress)
    if (result.error) return result // the form shows why
    setAddingAddress(false)
    setChoosingAddress(false)
    return result
  }

  async function handlePlaceOrder() {
    setOrderError('')
    setPlacing(true)
    const result = await placeOrder({
      address,
      lines: cartLines,
      stores,
      payment_method: paymentMethod,
      order_notes: notes.trim(),
      amount: total,
    })

    if (result.error) {
      setPlacing(false)
      setOrderError(errorText(result, 'Some items just became unavailable. Please check your cart and try again.'))
      return
    }
    // Online: continue on PayMongo's page. If that fails, the order still exists and its tracking page has "Pay now".
    const payment = paymentMethod === 'cod' ? null : await startOnlinePayment(result.order.order_id)
    if (payment?.error) setPayError(errorText(payment, payment.message))
    setPlacedOrderId(result.order.order_id)
    clearCart()
    if (payment?.checkout_url) window.location.assign(payment.checkout_url)
  }

  // Shown in the bottom bar (phone/tablet) and in the summary card (desktop)
  const placeOrderAction = (
    <>
      {blockMessage && (
        <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-small text-red-700">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {blockMessage}
        </p>
      )}
      <Button fullWidth disabled={!canPlaceOrder} onClick={handlePlaceOrder}>
        {placing ? (
          'Placing order…'
        ) : (
          <>
            Place order <span aria-hidden="true">·</span> {formatMoney(total)}
          </>
        )}
      </Button>
    </>
  )

  const cardClass = 'rounded-xl bg-white p-4 shadow-card md:p-6'

  return (
    <div className="pb-12 lg:pb-0">
      {/* Page header */}
      <div className="mb-4 flex items-center gap-1">
        <button
          type="button"
          onClick={() => navigate('/customer/cart')}
          aria-label="Back to cart"
          className="-ml-2 flex size-11 items-center justify-center rounded-full text-sonic-ink transition hover:bg-sonic-blue-50 focus-visible:outline-2 focus-visible:outline-sonic-blue"
        >
          <ArrowLeft className="size-6" />
        </button>
        <h1 className="font-display text-h2 font-bold">Checkout</h1>
      </div>

      {problemLines.length > 0 && (
        <div className="mb-4">
          <Alert variant="error" title="Some items are no longer available.">
            <Link to="/customer/cart" className="font-semibold underline">
              Go back to your cart
            </Link>{' '}
            to remove them before ordering.
          </Alert>
        </div>
      )}
      {orderError && (
        <div className="mb-4">
          <Alert variant="error">{orderError}</Alert>
        </div>
      )}

      {/* Desktop: details on the left, summary on the right (sticky). Phone/tablet: stacked. */}
      <div className="lg:grid lg:grid-cols-[1fr_400px] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-4">
          {/* Delivery address */}
          <section aria-labelledby="address-title" className={cardClass}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-sonic-blue-50">
                  <MapPin className="size-4 fill-sonic-blue text-sonic-blue-50" aria-hidden="true" />
                </span>
                <h2 id="address-title" className="font-display text-h3 font-semibold">
                  Delivery address
                </h2>
              </div>
              {address && (
                <button
                  type="button"
                  onClick={() => setChoosingAddress(!choosingAddress)}
                  aria-expanded={choosingAddress}
                  className="min-h-11 rounded-full px-3 font-display text-small font-semibold text-sonic-blue transition hover:bg-sonic-blue-50"
                >
                  {choosingAddress ? 'Done' : 'Change'}
                </button>
              )}
            </div>

            {!address && (
              <div className="mt-2 flex flex-col items-center gap-3 py-2 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-sonic-blue-50">
                  <MapPinPlus className="size-7 text-sonic-blue" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-display text-h3 font-semibold">No saved address yet</h3>
                  <p className="mx-auto mt-1 max-w-xs text-small text-sonic-muted">
                    Add your delivery address to calculate the barangay delivery fee and place your order.
                  </p>
                </div>
                <Button size="sm" onClick={() => setAddingAddress(true)}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add delivery address
                </Button>
              </div>
            )}

            {address && !choosingAddress && (
              <div className="mt-3 flex flex-col gap-1 rounded-xl bg-sonic-bg p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {address.label && (
                    <span className="rounded-full bg-sonic-blue-50 px-2.5 py-0.5 text-caption font-semibold text-sonic-blue">
                      {address.label}
                    </span>
                  )}
                  <span className="font-display text-small font-semibold">{address.street_address}</span>
                </div>
                <p className="text-body text-sonic-ink">
                  {address.barangay_name}, {address.city_municipality}
                </p>
                {address.landmark && <p className="text-small text-sonic-muted">{address.landmark}</p>}
              </div>
            )}

            {/* Choose another saved address, or add a new one */}
            {address && choosingAddress && (
              <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label="Saved addresses">
                {addresses.map((a) => (
                  <label
                    key={a.address_id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 transition ${
                      a.address_id === address.address_id ? 'bg-sonic-blue-50 ring-1 ring-sonic-blue' : 'bg-sonic-bg hover:bg-sonic-blue-50/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={a.address_id === address.address_id}
                      onChange={() => setAddressId(a.address_id)}
                      className="mt-1 size-4 shrink-0 accent-sonic-blue"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-small font-semibold">
                        {a.label ? `${a.label} · ` : ''}
                        {a.street_address}
                      </span>
                      <span className="block text-small text-sonic-muted">
                        {a.barangay_name}, {a.city_municipality}
                      </span>
                    </span>
                    <span className="shrink-0 font-display text-small font-bold text-sonic-blue">
                      {formatMoney(a.delivery_fee)}
                    </span>
                  </label>
                ))}
                <Button variant="secondary" size="sm" onClick={() => setAddingAddress(true)} className="self-start">
                  <Plus className="size-4" aria-hidden="true" />
                  Add new address
                </Button>
              </div>
            )}

            {address && (
              <p className="mt-3 flex items-center gap-1.5 text-small text-sonic-muted">
                <Info className="size-4 shrink-0" aria-hidden="true" />
                Delivery fee is based on your barangay.
              </p>
            )}
          </section>

          {/* Payment method */}
          <section aria-labelledby="payment-title" className={cardClass}>
            <h2 id="payment-title" className="font-display text-h3 font-semibold">
              Payment method
            </h2>
            <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-labelledby="payment-title">
              {PAYMENT_OPTIONS.map(({ value, Icon, note }) => {
                const selected = paymentMethod === value
                return (
                  <label
                    key={value}
                    className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl p-3 transition ${
                      selected ? 'bg-sonic-blue-50 ring-1 ring-sonic-blue' : 'bg-sonic-bg hover:bg-sonic-blue-50/60'
                    }`}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-sonic-blue shadow-card">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-small font-semibold">{PAYMENT_METHOD_LABELS[value]}</span>
                      <span className="block text-small text-sonic-muted">{note}</span>
                    </span>
                    <input
                      type="radio"
                      name="payment_method"
                      value={value}
                      checked={selected}
                      onChange={() => setPaymentMethod(value)}
                      className="size-5 shrink-0 accent-sonic-blue"
                    />
                  </label>
                )
              })}
            </div>
          </section>

          {/* Notes (customer_orders.order_notes) */}
          <section className={cardClass}>
            <label htmlFor="order_notes" className="font-display text-h3 font-semibold">
              Notes for the rider or store
            </label>
            <textarea
              id="order_notes"
              rows={3}
              maxLength={NOTES_MAX}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Extra rice, please call when outside."
              aria-describedby="order_notes-count"
              className="mt-3 w-full resize-none rounded-xl border border-sonic-border bg-white p-3 text-base text-sonic-ink transition outline-none placeholder:text-sonic-muted/70 focus:border-sonic-blue focus:ring-3 focus:ring-sonic-blue/25 md:text-body"
            />
            <p id="order_notes-count" className="mt-1 text-right text-caption text-sonic-muted">
              {notes.length}/{NOTES_MAX}
            </p>
          </section>
        </div>

        {/* Order summary */}
        <aside className="mt-4 lg:sticky lg:top-24 lg:mt-0">
          <section aria-labelledby="summary-title" className={cardClass}>
            <h2 id="summary-title" className="font-display text-h3 font-semibold">
              Order summary
            </h2>

            {/* One collapsible row per store */}
            <div className="mt-3 flex flex-col gap-2">
              {stores.map((store, index) => {
                const storeLines = cartLines.filter((line) => line.restaurant_id === store.restaurant_id)
                const storeCount = cartItemCount(storeLines)
                return (
                  <details key={store.restaurant_id} className="group rounded-xl bg-sonic-bg">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0">
                        <span className="block truncate font-display text-small font-semibold">
                          {store.name} ({storeCount} {storeCount === 1 ? 'item' : 'items'})
                        </span>
                        <span className="block text-caption text-sonic-muted">
                          {index === 0 ? 'Main store' : `Extra store +${formatMoney(rates.extra_store_fee)}`}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span className="font-display text-small font-semibold">{formatMoney(cartSubtotal(storeLines))}</span>
                        <ChevronDown className="size-4 text-sonic-muted transition group-open:rotate-180" aria-hidden="true" />
                      </span>
                    </summary>
                    <ul className="flex flex-col gap-1 px-3 pb-3 text-small text-sonic-muted">
                      {storeLines.map((line) => (
                        <li key={line.item_id} className="flex justify-between gap-3">
                          <span>
                            {line.quantity}× {line.name}
                          </span>
                          <span>{formatMoney(lineTotal(line))}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )
              })}
            </div>

            {/* Breakdown */}
            <dl className="mt-3 flex flex-col gap-2 rounded-xl bg-sonic-bg/60 p-3 text-body">
              <div className="flex justify-between gap-3">
                <dt className="text-sonic-muted">
                  Items subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})
                </dt>
                <dd className="font-display font-semibold">{formatMoney(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-sonic-muted">Delivery fee{address && ` (${address.barangay_name})`}</dt>
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
              <div className="mt-1 flex items-end justify-between gap-3 border-t border-sonic-border pt-2">
                <dt className="font-display text-h3 font-bold">Total</dt>
                <dd className="font-display text-h2 font-extrabold text-sonic-blue">{formatMoney(total)}</dd>
              </div>
            </dl>

            {paymentMethod === 'cod' && (
              <p className="mt-3 text-small text-sonic-muted">
                Please prepare {formatMoney(total)} in cash for the rider.
              </p>
            )}

            {/* Desktop: place order button inside the summary */}
            <div className="mt-5 hidden lg:block">{placeOrderAction}</div>
          </section>
        </aside>
      </div>

      {/* Phone/tablet: place order bar fixed at the bottom */}
      <div className="fixed inset-x-0 bottom-0 z-40 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(11,16,51,0.08)] backdrop-blur-md lg:hidden">
        <div className="mx-auto max-w-xl">{placeOrderAction}</div>
      </div>

      {/* Add a new delivery address */}
      <BottomSheet
        open={addingAddress}
        onClose={() => setAddingAddress(false)}
        icon={MapPinPlus}
        title="Add delivery address"
        description="Your barangay decides the delivery fee."
      >
        <AddressForm barangays={barangays} onSave={handleSaveAddress} onCancel={() => setAddingAddress(false)} />
      </BottomSheet>
    </div>
  )
}
