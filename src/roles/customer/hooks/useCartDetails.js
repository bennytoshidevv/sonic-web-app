import { useEffect, useState } from 'react'
import { getCartItemDetails, getRateSettings } from '@mock/mock'

// Checks a cart item against the current menu data. Returns null when it can be ordered,
// or the reason it cannot: 'removed', 'closed' (restaurant closed) or 'sold_out'.
export function findProblem(current) {
  if (!current || !current.is_active || !current.restaurant.is_active) return 'removed'
  if (current.restaurant.open_status !== 'open') return 'closed'
  if (!current.is_available) return 'sold_out'
  return null
}

// Used by the Cart and Checkout pages. Loads the current data for the items in the cart and
// the rate settings, and returns the cart lines with the current price, photo, description
// and any `problem` (sold out, closed, removed).
export function useCartDetails(lines) {
  const [details, setDetails] = useState(null) // item_id → current menu item + restaurant status
  const [rates, setRates] = useState(null)

  // Reload only when items are added or removed (not when a quantity changes)
  const itemIdsKey = lines.map((line) => line.item_id).join(',')
  useEffect(() => {
    const itemIds = itemIdsKey ? itemIdsKey.split(',').map(Number) : []
    Promise.all([getCartItemDetails(itemIds), getRateSettings()]).then(([items, rateData]) => {
      setDetails(Object.fromEntries(items.map((item) => [item.item_id, item])))
      setRates(rateData)
    })
  }, [itemIdsKey])

  if (details === null || rates === null) return { loading: true, cartLines: [], details: {}, rates: null }

  const cartLines = lines.map((line) => {
    const current = details[line.item_id]
    return {
      ...line,
      price: current ? current.price : line.price,
      description: current ? current.description : null,
      photo_url: current ? current.photo_url : null,
      problem: findProblem(current),
    }
  })

  return { loading: false, cartLines, details, rates }
}
