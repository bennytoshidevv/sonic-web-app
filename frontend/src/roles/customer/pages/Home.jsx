import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Clock, Search, Zap } from 'lucide-react'
import Button from '@shared/components/Button'
import Chip from '@shared/components/Chip'
import EmptyState from '@shared/components/EmptyState'
import Input from '@shared/components/Input'
import RestaurantCard from '@customer/components/RestaurantCard'
import { getCuisineTypes, getRestaurants } from '@mock/mock'
import { formatMoney } from '@shared/utils/format'

const ALL = 'All'

export default function Home() {
  const { address } = useOutletContext() // selected delivery address from CustomerLayout

  const [restaurants, setRestaurants] = useState([])
  const [cuisines, setCuisines] = useState([])
  const [search, setSearch] = useState('')
  const [cuisine, setCuisine] = useState(ALL)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRestaurants().then((list) => {
      setRestaurants(list)
      setLoading(false)
    })
    getCuisineTypes().then(setCuisines)
  }, [])

  // Filter by search text (name or cuisine) and the selected cuisine chip. Open restaurants first.
  const query = search.trim().toLowerCase()
  const visible = restaurants
    .filter((r) => cuisine === ALL || r.cuisines.includes(cuisine))
    .filter(
      (r) =>
        !query || r.name.toLowerCase().includes(query) || r.cuisines.some((c) => c.toLowerCase().includes(query)),
    )
    .sort((a, b) => (a.open_status === 'open' ? 0 : 1) - (b.open_status === 'open' ? 0 : 1))
  const openCount = visible.filter((r) => r.open_status === 'open').length

  function clearFilters() {
    setSearch('')
    setCuisine(ALL)
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <Input
        label="Search restaurants or food"
        hideLabel
        id="search"
        icon={Search}
        placeholder="Search restaurants or food"
        autoComplete="off"
        enterKeyHint="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClear={() => setSearch('')}
      />

      {/* Hero banner: the page's only gradient */}
      <section className="relative overflow-hidden rounded-xl bg-linear-135 from-sonic-blue to-sonic-violet p-4 text-white shadow-card md:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-6 -bottom-8 size-28 rounded-full bg-white/10 blur-xl md:size-48" />
        <div className="relative flex flex-col items-start gap-2">
          <h1 className="flex items-center gap-1.5 font-display text-h3 font-bold md:text-h2">
            Hungry? We deliver fast.
            <Zap className="size-5 shrink-0 fill-sonic-bolt text-sonic-bolt" aria-hidden="true" />
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-caption font-medium">
            <Clock className="size-3.5" aria-hidden="true" />
            Open daily 7:30 AM – 8:30 PM
          </span>
        </div>
      </section>

      {/* Cuisine filter chips: scroll sideways on phones, wrap on tablet and up */}
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 py-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {[ALL, ...cuisines.map((c) => c.cuisine_name)].map((name) => (
          <Chip key={name} selected={cuisine === name} onClick={() => setCuisine(name)}>
            {name}
          </Chip>
        ))}
      </div>

      {/* Section header */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-h3 font-bold">Restaurants near you</h2>
          <span className="text-small font-medium text-sonic-muted">{openCount} open now</span>
        </div>
        {address && (
          <p className="text-small text-sonic-muted">
            Delivery to {address.barangay_name}:{' '}
            <span className="font-display font-bold text-sonic-blue">{formatMoney(address.delivery_fee)}</span>
          </p>
        )}
      </div>

      {/* Restaurant list: 1 column on phones, 2 on tablet, 3 on desktop */}
      {loading ? (
        <p className="py-10 text-center text-sonic-muted">Loading restaurants…</p>
      ) : visible.length > 0 ? (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {visible.map((restaurant) => (
            <RestaurantCard key={restaurant.restaurant_id} restaurant={restaurant} />
          ))}
        </div>
      ) : (
        <EmptyState title="No restaurants found" text='Try another search, like "Silog" or "Milk tea".'>
          <Button variant="secondary" onClick={clearFilters}>
            Clear search
          </Button>
        </EmptyState>
      )}
    </div>
  )
}
