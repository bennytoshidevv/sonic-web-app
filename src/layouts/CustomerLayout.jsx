import { useEffect, useState } from 'react'
import { NavLink, Outlet, useMatch } from 'react-router-dom'
import { ChevronDown, House, MapPin, ReceiptText, ShoppingBag, User } from 'lucide-react'
import logo from '../assets/logo.jpg'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { addCustomerAddress, getCustomerAddresses } from '../data/mock'
import { cartItemCount } from '../lib/calc'

const NAV_ITEMS = [
  { to: '/customer', label: 'Home', Icon: House, end: true },
  { to: '/customer/orders', label: 'Orders', Icon: ReceiptText },
  { to: '/customer/cart', label: 'Cart', Icon: ShoppingBag },
  { to: '/customer/profile', label: 'Profile', Icon: User },
]

// Nav icon with a small count bubble (used for the cart).
function NavIcon({ Icon, count, className }) {
  return (
    <span className="relative">
      <Icon className={className} aria-hidden="true" />
      {count > 0 && (
        <span className="absolute -top-1.5 -right-2.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-sonic-blue px-1 font-display text-[11px] leading-none font-bold text-white ring-2 ring-white">
          {count}
        </span>
      )}
    </span>
  )
}

// Shared layout for all customer pages. Handles the responsive behavior:
// - Phone + tablet: sticky top bar (logo + "Deliver to" address picker), bottom navigation.
// - Desktop (lg):   the navigation moves into the top bar and the bottom bar is hidden.
// Content is centered with a max width so it does not stretch on wide screens.
// The selected delivery address is passed to the pages with <Outlet context>.
// On a restaurant menu, the cart and checkout the bottom navigation is hidden: those pages show their own bottom bar.
export default function CustomerLayout() {
  const { user } = useAuth()
  const [addresses, setAddresses] = useState([])
  const [addressId, setAddressId] = useState(null)

  useEffect(() => {
    getCustomerAddresses(user.user_id).then((list) => {
      setAddresses(list)
      const defaultAddress = list.find((a) => a.is_default) || list[0]
      setAddressId(defaultAddress ? defaultAddress.address_id : null)
    })
  }, [user.user_id])

  const address = addresses.find((a) => a.address_id === addressId) || null

  // Saves a new address and makes it the selected one (used by Checkout)
  async function addAddress(newAddress) {
    const saved = await addCustomerAddress({ ...newAddress, user_id: user.user_id })
    setAddresses([...addresses, saved])
    setAddressId(saved.address_id)
  }

  // Reloads the saved addresses after the Profile page changes them. Keeps the selected
  // address if it still exists, otherwise picks the default one.
  async function reloadAddresses() {
    const list = await getCustomerAddresses(user.user_id)
    setAddresses(list)
    if (!list.some((a) => a.address_id === addressId)) {
      const defaultAddress = list.find((a) => a.is_default) || list[0]
      setAddressId(defaultAddress ? defaultAddress.address_id : null)
    }
  }
  const cartCount = cartItemCount(useCart().lines)
  // These pages show their own bottom bar (cart bar / checkout bar) instead of the navigation
  const onRestaurantPage = useMatch('/customer/restaurants/:restaurantId') !== null
  const onCartPage = useMatch('/customer/cart') !== null
  const onCheckoutPage = useMatch('/customer/checkout') !== null
  const onRatePage = useMatch('/customer/orders/:orderId/rate') !== null
  const hideBottomNav = onRestaurantPage || onCartPage || onCheckoutPage || onRatePage

  return (
    <div className="min-h-screen bg-sonic-bg">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/90 shadow-card backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-6 lg:px-8">
          <NavLink to="/customer" className="shrink-0">
            <img src={logo} alt="Super Sonic Delivery" className="aspect-[2/1] h-11 object-cover md:h-12" />
          </NavLink>

          {/* Desktop navigation */}
          <nav aria-label="Main" className="hidden flex-1 justify-center gap-1 lg:flex">
            {NAV_ITEMS.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-full px-4 font-display text-small font-semibold transition ${
                    isActive ? 'bg-sonic-blue-50 text-sonic-blue' : 'text-sonic-muted hover:text-sonic-ink'
                  }`
                }
              >
                <NavIcon Icon={Icon} count={label === 'Cart' ? cartCount : 0} className="size-5" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Delivery address picker (decides the delivery fee) */}
          {address ? (
            <label className="relative flex min-h-11 min-w-0 items-center gap-1.5 rounded-full bg-white pr-8 pl-3 shadow-card focus-within:ring-2 focus-within:ring-sonic-blue/40">
              <MapPin className="size-4 shrink-0 text-sonic-blue" aria-hidden="true" />
              <span className="shrink-0 text-small text-sonic-muted">Deliver to:</span>
              <select
                value={addressId}
                onChange={(e) => setAddressId(Number(e.target.value))}
                className="min-w-0 cursor-pointer appearance-none truncate bg-transparent text-small font-semibold text-sonic-ink outline-none"
              >
                {addresses.map((a) => (
                  <option key={a.address_id} value={a.address_id}>
                    {a.label} · {a.barangay_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 size-4 text-sonic-muted" aria-hidden="true" />
            </label>
          ) : (
            <span className="flex min-h-11 items-center gap-1.5 rounded-full bg-white px-3 text-small text-sonic-muted shadow-card">
              <MapPin className="size-4 shrink-0 text-sonic-blue" aria-hidden="true" />
              No saved address
            </span>
          )}
        </div>
      </header>

      {/* Page content. Extra bottom padding on phone/tablet so the bottom bar does not cover it. */}
      <main className="mx-auto max-w-6xl px-4 pt-4 pb-28 md:px-6 md:pt-6 lg:px-8 lg:pb-12">
        <Outlet context={{ address, addresses, setAddressId, addAddress, reloadAddresses }} />
      </main>

      {/* Bottom navigation (phone + tablet) */}
      <nav
        aria-label="Main"
        className={`fixed inset-x-0 bottom-0 z-40 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(11,16,51,0.06)] backdrop-blur-xl lg:hidden ${hideBottomNav ? 'hidden' : ''}`}
      >
        <div className="mx-auto flex h-16 max-w-md items-center justify-around px-1">
          {NAV_ITEMS.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 text-caption transition ${
                  isActive ? 'font-semibold text-sonic-blue' : 'text-sonic-muted'
                }`
              }
            >
              <NavIcon Icon={Icon} count={label === 'Cart' ? cartCount : 0} className="size-6" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
