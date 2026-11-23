import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useCart } from '@customer/context/CartContext'
import { cartItemCount, cartSubtotal } from '@shared/utils/calc'
import { formatMoney } from '@shared/utils/format'

// Sonic-blue cart bar. Hidden while the cart is empty.
// Default: floats at the bottom of the screen on phone/tablet (hidden on desktop).
// inline:  a normal block, used in the desktop sidebar of the restaurant menu.
export default function CartBar({ inline = false }) {
  const { lines } = useCart()
  if (lines.length === 0) return null

  const count = cartItemCount(lines)

  const bar = (
    <Link
      to="/customer/cart"
      className="pointer-events-auto mx-auto flex h-14 max-w-xl items-center justify-between gap-3 rounded-full bg-sonic-blue px-4 text-white shadow-[0_4px_16px_rgba(24,60,240,0.35)] transition hover:bg-sonic-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sonic-blue active:scale-[0.99]"
    >
      <span className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-sonic-bolt font-display text-small font-bold text-sonic-ink">
          {count}
        </span>
        <span className="text-small font-medium">{count === 1 ? '1 item' : `${count} items`}</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="font-display text-h3 font-bold">{formatMoney(cartSubtotal(lines))}</span>
        <span className="flex items-center gap-1 font-display text-small font-semibold">
          View cart
          <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      </span>
      </Link>
  )

  if (inline) return bar

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      {bar}
    </div>
  )
}
