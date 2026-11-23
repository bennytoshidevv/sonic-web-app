import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Bike, CheckCircle2, Heart, ReceiptText, Star, Store, Zap } from 'lucide-react'
import Alert from '../../components/Alert'
import Button from '../../components/Button'
import Chip from '../../components/Chip'
import EmptyState from '../../components/EmptyState'
import StarRating from '../../components/StarRating'
import { useAuth } from '../../context/AuthContext'
import { getOrderDetails, getOrderReviews, getRiderReviews, submitOrderReviews } from '../../data/mock'
import { averageRating, minutesBetween } from '../../lib/calc'
import { formatDate, formatTimestampTime } from '../../lib/format'

const RATING_WORDS = ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent!']
const STORE_CHIPS = ['Delicious food', 'Hot & fresh', 'Secure packaging', 'Generous portion']
const RIDER_CHIPS = ['Polite & friendly', 'Fast delivery', 'Handled with care', 'Followed notes']
const EMPTY_ENTRY = { rating: 0, chips: [], comment: '' }

// The chosen chips go first in the comment (the ERD has no column for them):
// "Delicious food, Hot & fresh. Loved the tapsilog!"
function buildComment(entry) {
  const parts = []
  if (entry.chips.length > 0) parts.push(`${entry.chips.join(', ')}.`)
  if (entry.comment.trim()) parts.push(entry.comment.trim())
  return parts.join(' ') || null
}

// Card header shared by the rating form and the submitted view
function CardHeader({ Icon, title, badge, subtitle }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sonic-blue-50 text-sonic-blue">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate font-display text-h3 font-semibold">{title}</h2>
          {badge && (
            <span className="shrink-0 rounded-full bg-sonic-bg px-2 py-0.5 text-caption font-medium text-sonic-muted">{badge}</span>
          )}
        </div>
        <p className="truncate text-small text-sonic-muted">{subtitle}</p>
      </div>
    </div>
  )
}

// One store (or the rider) to rate: stars, quick chips and an optional comment
function RatingCard({ id, Icon, title, badge, subtitle, question, chipLabel, chips, entry, onChange, error, commentLabel, placeholder }) {
  function toggleChip(chip) {
    const next = entry.chips.includes(chip) ? entry.chips.filter((c) => c !== chip) : [...entry.chips, chip]
    onChange({ chips: next })
  }

  return (
    <article aria-labelledby={`${id}-question`} className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card md:p-6">
      <CardHeader Icon={Icon} title={title} badge={badge} subtitle={subtitle} />

      <div className="flex flex-col items-center gap-1 rounded-xl bg-sonic-bg px-3 py-4 text-center">
        <span id={`${id}-question`} className="font-display text-small font-semibold text-sonic-ink">
          {question}
        </span>
        <StarRating value={entry.rating} onChange={(rating) => onChange({ rating })} label={question} />
        <span className={`min-h-5 text-small font-medium ${error ? 'text-red-600' : 'text-sonic-blue'}`} aria-live="polite">
          {error ? (
            <span className="flex items-center gap-1">
              <AlertCircle className="size-4" aria-hidden="true" />
              {error}
            </span>
          ) : (
            RATING_WORDS[entry.rating]
          )}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-small text-sonic-muted">{chipLabel}</span>
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Chip key={chip} selected={entry.chips.includes(chip)} onClick={() => toggleChip(chip)}>
              {chip}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-comment`} className="text-small font-medium text-sonic-ink">
          {commentLabel}
        </label>
        <textarea
          id={`${id}-comment`}
          rows={2}
          maxLength={300}
          value={entry.comment}
          onChange={(e) => onChange({ comment: e.target.value })}
          placeholder={placeholder}
          className="w-full resize-none rounded-xl border border-sonic-border bg-white p-3 text-base text-sonic-ink transition outline-none placeholder:text-sonic-muted/70 focus:border-sonic-blue focus:ring-3 focus:ring-sonic-blue/25 md:text-body"
        />
      </div>
    </article>
  )
}

// A review that was already submitted (read-only)
function SubmittedCard({ Icon, title, badge, subtitle, review }) {
  return (
    <article className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-card md:p-6">
      <CardHeader Icon={Icon} title={title} badge={badge} subtitle={subtitle} />
      <div className="flex flex-col gap-2 rounded-lg bg-sonic-bg p-3">
        <div className="flex items-center justify-between gap-2">
          <StarRating value={review.rating} size="sm" />
          <span className="text-small font-medium text-green-700">{review.rating.toFixed(1)} rating</span>
        </div>
        {review.comment && <p className="rounded-lg bg-white p-2.5 text-small text-sonic-ink">“{review.comment}”</p>}
      </div>
    </article>
  )
}

export default function RateOrder() {
  const navigate = useNavigate()
  const orderId = Number(useParams().orderId)
  const { user } = useAuth()

  const [data, setData] = useState(null) // { details, reviews, riderAverage }
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [form, setForm] = useState({}) // 'store-<id>' or 'rider' → { rating, chips, comment }
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [justSubmitted, setJustSubmitted] = useState(false)

  useEffect(() => {
    getOrderDetails(orderId, user.user_id).then(async (details) => {
      if (!details) {
        setData({ details: null })
      } else {
        const reviews = await getOrderReviews(orderId)
        const riderReviews = details.rider ? await getRiderReviews(details.rider.user_id) : []
        setData({ details, reviews, riderAverage: averageRating(riderReviews) })
      }
      setLoading(false)
    })
  }, [orderId, user.user_id, refreshKey])

  if (loading) return <p className="py-10 text-center text-sonic-muted">Loading your order…</p>

  if (!data.details) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState icon={ReceiptText} title="Order not found" text="We could not find this order in your account.">
          <Button onClick={() => navigate('/customer/orders')}>My orders</Button>
        </EmptyState>
      </div>
    )
  }

  const { order, stores, history, rider } = data.details
  const { reviews, riderAverage } = data

  // Customers can rate only after the order is delivered
  if (order.order_status !== 'delivered') {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState icon={Star} title="Not delivered yet" text="You can rate this order once it has been delivered.">
          <Button onClick={() => navigate(`/customer/orders/${order.order_id}`)}>Track order</Button>
        </EmptyState>
      </div>
    )
  }

  const deliveredRow = history.find((h) => h.status === 'delivered')
  const deliveryMinutes = deliveredRow ? minutesBetween(order.placed_at, deliveredRow.changed_at) : null
  const alreadyRated = reviews.restaurantReviews.length > 0 || reviews.riderReview !== null
  const firstReview = reviews.restaurantReviews[0] || reviews.riderReview

  const storeSubtitle = (store) => store.items.map((i) => `${i.item_name} ×${i.quantity}`).join(', ')
  const storeBadge = (index) => (stores.length > 1 ? `Store ${index + 1}` : null)
  const riderSubtitle = rider
    ? [rider.vehicle_type, rider.plate_number, deliveryMinutes !== null && `Delivered in ${deliveryMinutes} min`]
        .filter(Boolean)
        .join(' · ')
    : ''
  const riderBadge = riderAverage !== null ? `★ ${riderAverage.toFixed(1)}` : 'Rider'

  function entryFor(key) {
    return form[key] || EMPTY_ENTRY
  }

  function updateEntry(key, changes) {
    setForm({ ...form, [key]: { ...entryFor(key), ...changes } })
    if (changes.rating) setErrors({ ...errors, [key]: '' })
  }

  async function handleSubmit() {
    setSubmitError('')
    const found = {}
    for (const store of stores) {
      if (!entryFor(`store-${store.restaurant_id}`).rating) found[`store-${store.restaurant_id}`] = 'Please choose a star rating.'
    }
    if (rider && !entryFor('rider').rating) found.rider = 'Please choose a star rating.'
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setSubmitError('Please rate every store and the rider.')
      return
    }

    setSubmitting(true)
    const result = await submitOrderReviews({
      order_id: order.order_id,
      customer_id: user.user_id,
      restaurantRatings: stores.map((store) => {
        const entry = entryFor(`store-${store.restaurant_id}`)
        return { restaurant_id: store.restaurant_id, rating: entry.rating, comment: buildComment(entry) }
      }),
      riderRating: rider ? { rating: entryFor('rider').rating, comment: buildComment(entryFor('rider')) } : null,
    })
    setSubmitting(false)

    if (result.error) {
      setSubmitError(result.error === 'already_rated' ? 'This order was already rated.' : 'Something went wrong. Please try again.')
      if (result.error === 'already_rated') setRefreshKey(refreshKey + 1)
      return
    }
    setJustSubmitted(true)
    setRefreshKey(refreshKey + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Shown in the bottom bar (phone/tablet) and under the cards (desktop)
  const footerAction = alreadyRated ? (
    <Button fullWidth variant="secondary" onClick={() => navigate('/customer/orders')}>
      Back to my orders
    </Button>
  ) : (
    <>
      {submitError && (
        <p role="alert" className="mb-2 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-small text-red-700">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {submitError}
        </p>
      )}
      <Button fullWidth disabled={submitting} onClick={handleSubmit}>
        {submitting ? 'Submitting…' : 'Submit ratings'}
        {!submitting && <Zap className="size-4 fill-sonic-bolt text-sonic-bolt" aria-hidden="true" />}
      </Button>
      <p className="mt-1.5 text-center text-caption text-sonic-muted">You can rate each order once.</p>
    </>
  )

  return (
    <div className="mx-auto max-w-2xl pb-12 lg:pb-0">
      {/* Page header */}
      <div className="mb-4 flex items-center gap-1">
        <Link
          to={`/customer/orders/${order.order_id}`}
          aria-label="Back to order"
          className="-ml-2 flex size-11 items-center justify-center rounded-full text-sonic-ink transition hover:bg-sonic-blue-50 focus-visible:outline-2 focus-visible:outline-sonic-blue"
        >
          <ArrowLeft className="size-6" />
        </Link>
        <h1 className="font-display text-h2 font-bold">Rate your order</h1>
        <span className="ml-1 flex size-7 items-center justify-center rounded-full bg-sonic-bolt">
          <Zap className="size-4 fill-sonic-ink text-sonic-ink" aria-hidden="true" />
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {/* Order info */}
        <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-card md:p-6">
          <p className="text-small text-sonic-muted">
            Order <span className="font-display font-semibold text-sonic-ink">#{order.order_number}</span>
            {deliveredRow && ` · Delivered ${formatDate(deliveredRow.changed_at)} at ${formatTimestampTime(deliveredRow.changed_at)}`}
          </p>
          <p className="flex items-start gap-2 rounded-lg bg-sonic-blue-50 p-3 text-small text-sonic-ink">
            <Heart className="mt-0.5 size-4 shrink-0 fill-red-600 text-red-600" aria-hidden="true" />
            Your honest feedback helps our local stores and riders in Sipocot serve you better!
          </p>
        </section>

        {alreadyRated ? (
          <>
            {justSubmitted && (
              <Alert variant="info" title="Thank you!">
                Your ratings were sent to the stores and the rider.
              </Alert>
            )}
            <div className="flex items-center justify-between gap-2 rounded-xl bg-green-600/10 p-3">
              <span className="flex items-center gap-2 text-small font-semibold text-green-700">
                <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
                Rated on {formatDate(firstReview.created_at)} at {formatTimestampTime(firstReview.created_at)}
              </span>
            </div>

            {stores.map((store, index) => {
              const review = reviews.restaurantReviews.find((r) => r.restaurant_id === store.restaurant_id)
              return (
                review && (
                  <SubmittedCard
                    key={store.restaurant_id}
                    Icon={Store}
                    title={store.name}
                    badge={storeBadge(index)}
                    subtitle={storeSubtitle(store)}
                    review={review}
                  />
                )
              )
            })}
            {rider && reviews.riderReview && (
              <SubmittedCard Icon={Bike} title={rider.full_name} badge={riderBadge} subtitle={riderSubtitle} review={reviews.riderReview} />
            )}
          </>
        ) : (
          <>
            {stores.map((store, index) => {
              const key = `store-${store.restaurant_id}`
              return (
                <RatingCard
                  key={key}
                  id={key}
                  Icon={Store}
                  title={store.name}
                  badge={storeBadge(index)}
                  subtitle={storeSubtitle(store)}
                  question="How was the food and packaging?"
                  chipLabel="Quick impressions:"
                  chips={STORE_CHIPS}
                  entry={entryFor(key)}
                  onChange={(changes) => updateEntry(key, changes)}
                  error={errors[key]}
                  commentLabel="Comments (optional)"
                  placeholder={`Tell us what you loved about ${store.name}…`}
                />
              )
            })}
            {rider && (
              <RatingCard
                id="rider"
                Icon={Bike}
                title={rider.full_name}
                badge={riderBadge}
                subtitle={riderSubtitle}
                question="How was your delivery rider?"
                chipLabel={`Compliments for ${rider.full_name.split(' ')[0]}:`}
                chips={RIDER_CHIPS}
                entry={entryFor('rider')}
                onChange={(changes) => updateEntry('rider', changes)}
                error={errors.rider}
                commentLabel="Note for the rider (optional)"
                placeholder={`Send a compliment to ${rider.full_name.split(' ')[0]}…`}
              />
            )}
          </>
        )}

        {/* Desktop: action under the cards */}
        <div className="hidden lg:block">{footerAction}</div>
      </div>

      {/* Phone/tablet: action fixed at the bottom */}
      <div className="fixed inset-x-0 bottom-0 z-40 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(11,16,51,0.08)] backdrop-blur-md lg:hidden">
        <div className="mx-auto max-w-xl">{footerAction}</div>
      </div>
    </div>
  )
}
