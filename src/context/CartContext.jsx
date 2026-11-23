import { createContext, useContext, useState } from 'react'
import { useAuth } from './AuthContext'

// The customer's cart. Each line matches a cart_items row (item_id, quantity, added_at);
// restaurant_id, restaurant_name, name and price are kept for display (the real API will
// return them joined from menu_items). Saved in sessionStorage per user.
// A cart can hold items from several stores: the first store added is the main store.
const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { user } = useAuth()
  const storageKey = `sonic_cart_${user.user_id}`

  const [lines, setLines] = useState(() => {
    const saved = sessionStorage.getItem(storageKey)
    return saved ? JSON.parse(saved) : []
  })

  function save(nextLines) {
    sessionStorage.setItem(storageKey, JSON.stringify(nextLines))
    setLines(nextLines)
  }

  // Adds several items at once: entries = [{ item, restaurant, quantity }].
  // Sold-out items and closed restaurants are refused.
  function addItems(entries) {
    let next = [...lines]
    for (const { item, restaurant, quantity } of entries) {
      if (!item.is_available || restaurant.open_status !== 'open') continue

      const existing = next.find((line) => line.item_id === item.item_id)
      if (existing) {
        next = next.map((line) => (line.item_id === item.item_id ? { ...line, quantity: line.quantity + quantity } : line))
      } else {
        next.push({
          item_id: item.item_id,
          quantity,
          added_at: new Date().toISOString(),
          restaurant_id: restaurant.restaurant_id,
          restaurant_name: restaurant.name,
          name: item.name,
          price: item.price,
        })
      }
    }
    save(next)
  }

  // Adds one of the item (the "+" button on a menu).
  function addItem(item, restaurant) {
    addItems([{ item, restaurant, quantity: 1 }])
  }

  // change = +1 or -1. A line that reaches 0 is removed.
  function changeQuantity(item_id, change) {
    save(
      lines
        .map((line) => (line.item_id === item_id ? { ...line, quantity: line.quantity + change } : line))
        .filter((line) => line.quantity > 0),
    )
  }

  function removeItems(item_ids) {
    save(lines.filter((line) => !item_ids.includes(line.item_id)))
  }

  function clearCart() {
    save([])
  }

  function quantityOf(item_id) {
    const line = lines.find((l) => l.item_id === item_id)
    return line ? line.quantity : 0
  }

  // Stores in the cart, in the order they were added (first = main store).
  const stores = []
  for (const line of lines) {
    if (!stores.some((s) => s.restaurant_id === line.restaurant_id)) {
      stores.push({ restaurant_id: line.restaurant_id, name: line.restaurant_name })
    }
  }

  const value = { lines, stores, addItem, addItems, changeQuantity, removeItems, clearCart, quantityOf }
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  return useContext(CartContext)
}
