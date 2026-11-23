import { Clock, Users, Zap } from 'lucide-react'
import logo from '../assets/logo.jpg'

// Default desktop panel content (used by Login). Pages can pass their own `panel`.
const DEFAULT_PANEL = {
  badge: null,
  heading: (
    <>
      Lightning-fast
      <br />
      local delivery
    </>
  ),
  text: 'Your lightning-fast delivery partner.',
  highlights: [
    { Icon: Zap, text: 'Fast delivery from partner restaurants across Sipocot' },
    { Icon: Users, text: 'One app for customers, riders and operators' },
    { Icon: Clock, text: 'Service hours: 7:30 AM – 8:30 PM' },
  ],
}

// One row in the desktop panel list. With a `title` it shows a bold title + description
// (Register design); without one it shows a single line (Login design).
function Highlight({ Icon, title, text }) {
  if (title) {
    return (
      <li className="flex items-start gap-4 rounded-xl bg-white/10 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sonic-bolt text-sonic-ink shadow-card">
          <Icon className="size-5 fill-sonic-ink" aria-hidden="true" />
        </span>
        <div>
          <p className="font-display text-base font-semibold">{title}</p>
          <p className="mt-0.5 text-small text-sonic-blue-50">{text}</p>
        </div>
      </li>
    )
  }

  return (
    <li className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sonic-bolt/20">
        <Icon className="size-4 text-sonic-bolt" aria-hidden="true" />
      </span>
      <span className="text-body">{text}</span>
    </li>
  )
}

// Shared layout for Login and Register. Handles all the responsive behavior:
// - Phone (base):  gradient header with logo + title, form card below, page scrolls.
// - Tablet (md):   same, card centered with max width 480px.
// - Desktop (lg):  split screen. Left = gradient panel with logo and `panel` content,
//                  right = form card (440px, or 560px when `wide`). Fills the screen height;
//                  only the right side scrolls if a long form needs it.
//
// Props:
//   title, subtitle         – shown in the phone/tablet header
//   cardTitle, cardSubtitle – shown inside the card on desktop (default: title, subtitle)
//   cardBadge               – optional small chip above the desktop card title
//   panel                   – { badge, heading, text, highlights } for the desktop left panel
//   wide                    – use the wider desktop card
export default function AuthLayout({
  title,
  subtitle,
  cardTitle = title,
  cardSubtitle = subtitle,
  cardBadge,
  panel = DEFAULT_PANEL,
  wide = false,
  children,
}) {
  return (
    <div className="min-h-screen bg-sonic-bg lg:grid lg:h-screen lg:grid-cols-2">
      {/* Brand panel: the page's only gradient. Header on phone/tablet, left half on desktop. */}
      <header className="relative overflow-hidden rounded-b-[2rem] bg-linear-135 from-sonic-blue to-sonic-violet px-4 pt-8 pb-16 text-white md:pt-12 md:pb-20 lg:flex lg:items-center lg:rounded-none lg:px-14 lg:py-12 xl:px-20">
        {/* Decorative glows */}
        <div aria-hidden="true" className="pointer-events-none absolute -top-12 -right-12 size-48 rounded-full bg-sonic-bolt/15 blur-2xl lg:size-80" />
        <div aria-hidden="true" className="pointer-events-none absolute top-1/3 -left-6 size-28 rounded-full bg-white/10 blur-xl lg:size-56" />

        <div className="relative mx-auto flex max-w-md flex-col items-center text-center lg:mx-0 lg:max-w-lg lg:items-start lg:text-left">
          <img
            src={logo}
            alt="Super Sonic Delivery"
            className="aspect-video w-40 rounded-xl bg-white object-cover shadow-card md:w-48 xl:w-64"
          />

          {/* Phone + tablet: page title in the header */}
          <div className="mt-5 lg:hidden">
            <h1 className="font-display text-h1 font-extrabold tracking-tight">{title}</h1>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-body text-sonic-blue-50">
              {subtitle}
              <Zap className="size-4 shrink-0 fill-sonic-bolt text-sonic-bolt" aria-hidden="true" />
            </p>
          </div>

          {/* Desktop: tagline and highlights */}
          <div className="hidden lg:block">
            {panel.badge && (
              <span className="mt-10 inline-flex items-center gap-1.5 rounded-full bg-sonic-bolt px-3 py-1 text-caption font-bold tracking-wide text-sonic-ink uppercase">
                <Zap className="size-4 fill-sonic-ink" aria-hidden="true" />
                {panel.badge}
              </span>
            )}
            <p className={`${panel.badge ? 'mt-5' : 'mt-10'} font-display text-[40px] leading-[48px] font-extrabold uppercase italic`}>
              {panel.heading}
            </p>
            <p className="mt-4 text-h3 text-sonic-blue-50">{panel.text}</p>
            <ul className="mt-8 space-y-3">
              {panel.highlights.map((item) => (
                <Highlight key={item.text} {...item} />
              ))}
            </ul>
          </div>
        </div>
      </header>

      {/* Form side. On phone/tablet the card overlaps the bottom of the header. */}
      <main className="relative z-10 -mt-10 px-4 pb-8 md:pb-12 lg:mt-0 lg:flex lg:flex-col lg:overflow-y-auto lg:px-12 lg:py-10">
        <div className={`mx-auto w-full md:max-w-[480px] lg:my-auto ${wide ? 'lg:max-w-[560px]' : 'lg:max-w-[440px]'}`}>
          <div className="rounded-xl bg-white p-4 shadow-card md:p-6">
            {/* Desktop: page title inside the card (the header title is hidden there) */}
            <div className="mb-6 hidden lg:block">
              {cardBadge}
              <h1 className="font-display text-h1 font-bold tracking-tight text-sonic-ink">{cardTitle}</h1>
              <p className="mt-1 text-body text-sonic-muted">{cardSubtitle}</p>
            </div>

            {children}
          </div>

          <footer className="mt-6 flex flex-col items-center gap-2 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-caption font-medium text-sonic-muted shadow-card lg:hidden">
              <span className="size-2 rounded-full bg-green-600" aria-hidden="true" />
              Service hours: 7:30 AM – 8:30 PM
            </span>
            <p className="text-small text-sonic-muted">Super Sonic Delivery • Sipocot, Camarines Sur</p>
          </footer>
        </div>
      </main>
    </div>
  )
}
