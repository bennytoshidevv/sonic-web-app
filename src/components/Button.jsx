// Pill button from DESIGN.md. Variants: primary (blue), secondary (white + blue border), danger (red),
// danger-outline (white + red border). Sizes: sm (40px), md (48px, the default), lg (56px, rider main actions).
const VARIANTS = {
  primary: 'bg-sonic-blue text-white shadow-card hover:bg-sonic-blue-dark',
  secondary: 'border border-sonic-blue bg-white text-sonic-blue hover:bg-sonic-blue-50',
  danger: 'bg-red-600 text-white shadow-card hover:bg-red-700',
  'danger-outline': 'border border-red-600 bg-white text-red-600 hover:bg-red-50',
}

const SIZES = {
  md: 'h-12 px-6 text-base',
  sm: 'h-10 px-4 text-small',
  lg: 'h-14 px-6 text-h3',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sonic-blue active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${fullWidth ? 'w-full' : ''} ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
