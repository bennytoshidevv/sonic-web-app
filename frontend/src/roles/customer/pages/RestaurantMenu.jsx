import { useEffect, useRef, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft, Bike, ChevronDown, Clock, Heart, MapPin, Plus, Share2, Star, Store } from 'lucide-react'
import Alert from '@shared/components/Alert'
import BottomSheet from '@shared/components/BottomSheet'
import Button from '@shared/components/Button'
import CartBar from '@customer/components/CartBar'
import Chip from '@shared/components/Chip'
import EmptyState from '@shared/components/EmptyState'
import MenuItemRow from '@customer/components/MenuItemRow'
import StatusBadge from '@shared/components/StatusBadge'
import Toast from '@shared/components/Toast'
import { useAuth } from '@shared/auth/AuthContext'
import { useCart } from '@customer/context/CartContext'
import {
  getMenu,
  getRateSettings,
  getRestaurant,
  getRestaurantReviews,
  isFavoriteRestaurant,
  setFavoriteRestaurant,
} from '@api'
import { errorText } from '@shared/utils/errors'
import { averageRating } from '@shared/utils/calc'
import { formatHoursRange, formatMoney, formatTodayHours } from '@shared/utils/format'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEK = [1, 2, 3, 4, 5, 6, 0] // show Monday first

export default function RestaurantMenu() {
  const restaurantId = Number(useParams().restaurantId)
  const { address } = useOutletContext() // selected delivery address from CustomerLayout
  const { stores, addItem, quantityOf } = useCart()
  const { user } = useAuth()

  const [restaurant, setRestaurant] = useState(null)
  const [menu, setMenu] = useState([])
  const [reviews, setReviews] = useState([])
  const [rates, setRates] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showHours, setShowHours] = useState(false)
  const [activeCategory, setActiveCategory] = useState(null)
  const [pendingItem, setPendingItem] = useState(null) // item waiting for the "another store?" answer
  const [today] = useState(() => new Date().getDay()) // 0 = Sunday, read once when the page opens
  const [liked, setLiked] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  useEffect(() => {
    Promise.all([
      getRestaurant(restaurantId),
      getMenu(restaurantId),
      getRestaurantReviews(restaurantId),
      getRateSettings(),
      isFavoriteRestaurant(restaurantId),
    ]).then(([restaurantData, menuData, reviewData, rateData, likedData]) => {
      setRestaurant(restaurantData)
      setMenu(menuData)
      setReviews(reviewData)
      setRates(rateData)
      setLiked(likedData)
      setActiveCategory(menuData.length > 0 ? menuData[0].menu_category_id : null)
      setLoading(false)
    })
  }, [restaurantId, user.user_id])

  // Hide any toast timer when leaving the page
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  function showToast(message) {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2500)
  }

  if (loading) return <p className="py-10 text-center text-sonic-muted">Loading menu…</p>

  if (!restaurant) {
    return (
      <EmptyState title="Restaurant not found" text="It may have been removed or is no longer on Super Sonic.">
        <Link to="/customer" className="font-semibold text-sonic-blue hover:underline">
          Back to restaurants
        </Link>
      </EmptyState>
    )
  }

  const isOpen = restaurant.open_status === 'open'
  const rating = averageRating(reviews)
  // This store would be an extra store if the cart already has items from other stores.
  const isExtraStore = stores.length > 0 && !stores.some((s) => s.restaurant_id === restaurant.restaurant_id)

  function handleAdd(item) {
    if (isExtraStore) setPendingItem(item) // ask first: an extra store adds a fee
    else addItem(item, restaurant)
  }

  function confirmExtraStore() {
    addItem(pendingItem, restaurant)
    setPendingItem(null)
  }

  async function toggleLike() {
    const next = !liked
    setLiked(next)
    const result = await setFavoriteRestaurant(restaurant.restaurant_id, next)
    if (result.error) {
      setLiked(!next) // put the heart back
      showToast(errorText(result, 'Could not update your favorites.'))
      return
    }
    showToast(next ? 'Added to your favorites' : 'Removed from your favorites')
  }

  // Phones: open the share sheet (Messenger, SMS, ...). Otherwise: copy the link.
  async function share() {
    const shareData = {
      title: restaurant.name,
      text: `Order from ${restaurant.name} on Super Sonic Delivery`,
      url: window.location.href,
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        // the user closed the share sheet: nothing to do
      }
      return
    }
    try {
      await navigator.clipboard.writeText(shareData.url)
      showToast('Link copied')
    } catch {
      showToast('Could not copy the link')
    }
  }

  function goToCategory(categoryId) {
    setActiveCategory(categoryId)
    document.getElementById(`category-${categoryId}`).scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div>
      {/* Cover: the restaurant photo, or the brand gradient until a photo is added. Full width on phones. */}
      <div className="relative -mx-4 -mt-4 h-44 overflow-hidden md:mx-0 md:mt-0 md:h-56 md:rounded-xl lg:h-64">
        {restaurant.logo_url ? (
          <>
            <img src={restaurant.logo_url} alt="" className="size-full object-cover" />
            <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-sonic-ink/60 to-transparent" />
          </>
        ) : (
          <div className="relative flex size-full items-center justify-center bg-linear-135 from-sonic-blue to-sonic-violet">
            <div aria-hidden="true" className="absolute -top-10 -right-10 size-40 rounded-full bg-sonic-bolt/15 blur-2xl" />
            <div aria-hidden="true" className="absolute -bottom-12 left-1/4 size-40 rounded-full bg-white/10 blur-2xl" />
            <Store className="relative size-16 text-white/30" aria-hidden="true" />
          </div>
        )}
        <Link
          to="/customer"
          aria-label="Back to restaurants"
          className="absolute top-3 left-4 flex size-11 items-center justify-center rounded-full bg-white text-sonic-ink shadow-card transition hover:bg-sonic-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95"
        >
          <ArrowLeft className="size-5" />
        </Link>

        {/* Share and like */}
        <div className="absolute top-3 right-4 flex gap-2">
          <button
            type="button"
            onClick={share}
            aria-label={`Share ${restaurant.name}`}
            className="flex size-11 items-center justify-center rounded-full bg-white text-sonic-ink shadow-card transition hover:bg-sonic-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95"
          >
            <Share2 className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={toggleLike}
            aria-pressed={liked}
            aria-label={liked ? 'Remove from favorites' : 'Add to favorites'}
            className="flex size-11 items-center justify-center rounded-full bg-white shadow-card transition hover:bg-sonic-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95"
          >
            <Heart className={`size-5 ${liked ? 'fill-red-600 text-red-600' : 'text-sonic-ink'}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Desktop: info card on the left (sticky), menu on the right. Phone/tablet: stacked. */}
      <div className="lg:grid lg:grid-cols-[360px_1fr] lg:items-start lg:gap-8">
        {/* Restaurant info card, overlapping the bottom of the cover */}
        <aside className="relative z-10 -mt-6 md:mx-4 lg:sticky lg:top-24">
          <div className="rounded-xl bg-white p-4 shadow-card md:p-6">
            <div className="flex items-start gap-3">
              <div className="-mt-10 size-16 shrink-0 rounded-full bg-white p-1 shadow-card">
                {restaurant.logo_url ? (
                  <img src={restaurant.logo_url} alt="" className="size-full rounded-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center rounded-full bg-sonic-blue-50">
                    <Store className="size-7 text-sonic-blue" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-h2 font-bold text-sonic-ink">{restaurant.name}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-small">
                  <StatusBadge status={restaurant.open_status} variant="soft" />
                  {rating === null ? (
                    <span className="text-sonic-muted">No ratings yet</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Star className="size-4 fill-sonic-bolt text-sonic-bolt" aria-hidden="true" />
                      <span className="font-semibold text-sonic-ink">{rating.toFixed(1)}</span>
                      <span className="text-sonic-muted">
                        ({reviews.length} {reviews.length === 1 ? 'rating' : 'ratings'})
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {restaurant.cuisines.map((cuisine) => (
                <span key={cuisine} className="rounded-full bg-sonic-blue-50 px-2.5 py-1 text-caption font-medium text-sonic-blue">
                  {cuisine}
                </span>
              ))}
            </div>

            {restaurant.description && <p className="mt-3 text-body text-sonic-muted">{restaurant.description}</p>}

            <ul className="mt-3 flex flex-col gap-2 text-small text-sonic-muted">
              <li className="flex items-start gap-2">
                <MapPin className="mt-px size-4 shrink-0 text-sonic-blue" aria-hidden="true" />
                {restaurant.address}
              </li>
              {address && (
                <li className="flex items-start gap-2">
                  <Bike className="mt-px size-4 shrink-0 text-sonic-blue" aria-hidden="true" />
                  <span>
                    Delivery to {address.barangay_name}:{' '}
                    <span className="font-display font-bold text-sonic-blue">{formatMoney(address.delivery_fee)}</span>
                  </span>
                </li>
              )}
            </ul>

            {isOpen && isExtraStore && rates && (
              <p className="mt-3 rounded-lg bg-sonic-blue-50 px-3 py-2 text-small text-sonic-ink">
                Your cart has items from {stores[0].name}. Adding from this store adds a{' '}
                <span className="font-semibold">{formatMoney(rates.extra_store_fee)}</span> extra-store fee.
              </p>
            )}

            {/* Opening hours: today, with the full week behind a toggle */}
            <button
              type="button"
              onClick={() => setShowHours(!showHours)}
              aria-expanded={showHours}
              aria-controls="weekly-hours"
              className="mt-3 flex min-h-11 w-full items-center justify-between gap-2 rounded-lg bg-sonic-bg px-3 text-small font-medium text-sonic-ink transition hover:bg-sonic-blue-50"
            >
              <span className="flex items-center gap-2">
                <Clock className="size-4 text-sonic-muted" aria-hidden="true" />
                {formatTodayHours(restaurant.hours)}
              </span>
              <ChevronDown className={`size-4 text-sonic-muted transition ${showHours ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {showHours && (
              <ul id="weekly-hours" className="mt-2 flex flex-col gap-1.5 rounded-lg bg-sonic-bg p-3 text-small">
                {WEEK.map((day) => {
                  const row = restaurant.hours.find((h) => h.day_of_week === day)
                  return (
                    <li key={day} className={`flex justify-between gap-3 ${day === today ? 'font-semibold text-sonic-ink' : 'text-sonic-muted'}`}>
                      <span>{DAY_NAMES[day]}</span>
                      <span>{row ? formatHoursRange(row) : 'Closed'}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Desktop: cart summary under the info card (phones/tablets get the floating bar instead) */}
          <div className="mt-4 hidden lg:block">
            <CartBar inline />
          </div>
        </aside>

        {/* Menu */}
        <section className="mt-4 lg:mt-6" aria-label="Menu">
          {!isOpen && (
            <div className="mb-3">
              <Alert variant="error" title="Closed right now.">
                You can look at the menu, but you can order only while the restaurant is open.
              </Alert>
            </div>
          )}

          {menu.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="Menu coming soon" text="This restaurant has not added its menu yet." />
            </div>
          ) : (
            <>
              {/* Category tabs: stick below the top bar while scrolling */}
              <nav
                aria-label="Menu categories"
                className="scrollbar-none sticky top-16 z-30 -mx-4 flex gap-2 overflow-x-auto bg-white/95 px-4 py-3 shadow-card backdrop-blur-md md:mx-0 md:rounded-xl md:px-3"
              >
                {menu.map((category) => (
                  <Chip
                    key={category.menu_category_id}
                    selected={activeCategory === category.menu_category_id}
                    onClick={() => goToCategory(category.menu_category_id)}
                  >
                    {category.category_name}
                  </Chip>
                ))}
              </nav>

              <div className="mt-2 flex flex-col gap-6">
                {menu.map((category) => (
                  <section
                    key={category.menu_category_id}
                    id={`category-${category.menu_category_id}`}
                    aria-labelledby={`category-title-${category.menu_category_id}`}
                    className="scroll-mt-36"
                  >
                    <h2 id={`category-title-${category.menu_category_id}`} className="mb-3 font-display text-h3 font-semibold">
                      {category.category_name}
                    </h2>
                    {category.items.length === 0 ? (
                      <p className="text-small text-sonic-muted">No items in this category yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {category.items.map((item) => (
                          <MenuItemRow
                            key={item.item_id}
                            item={item}
                            quantity={quantityOf(item.item_id)}
                            canOrder={isOpen}
                            onAdd={() => handleAdd(item)}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {/* "Add from another store?" prompt (extra-store fee from rate_settings) */}
      <BottomSheet
        open={pendingItem !== null}
        onClose={() => setPendingItem(null)}
        icon={Store}
        title="Add from another store?"
        description={
          <>
            Your cart already has items from{' '}
            <span className="font-semibold text-sonic-ink">{stores.map((s) => s.name).join(', ')}</span>. Each extra
            store adds <span className="font-semibold text-sonic-blue">{rates && formatMoney(rates.extra_store_fee)}</span>{' '}
            to your delivery fee.
          </>
        }
      >
        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <Button fullWidth autoFocus onClick={confirmExtraStore}>
            Add anyway (+{rates && formatMoney(rates.extra_store_fee)})
            <Plus className="size-5" aria-hidden="true" />
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setPendingItem(null)}>
            Cancel
          </Button>
        </div>
      </BottomSheet>

      <CartBar />
      <Toast message={toast} />
    </div>
  )
}
