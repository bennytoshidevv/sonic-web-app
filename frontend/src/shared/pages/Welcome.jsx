import { Link } from 'react-router-dom'
import { ArrowRight, Bike, Briefcase, ShieldCheck, ShoppingBag, Zap } from 'lucide-react'
import logo from '@shared/assets/logo.jpg'
import { HOME_BY_ROLE, useAuth } from '@shared/auth/AuthContext'

const ROLE_NAMES = { customer: 'customer', rider: 'rider', operator: 'operator', admin: 'admin' }

// The page at "/": choose how to continue. Customers get the big button; riders and staff
// have smaller entries. Each one opens that role's section (its login page if not logged in).
export default function Welcome() {
  const { user } = useAuth()

  const cardLink =
    'flex min-h-16 items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-card transition hover:bg-sonic-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sonic-blue'

  return (
    <div className="flex min-h-screen flex-col bg-sonic-bg">
      {/* Hero: the page's only gradient */}
      <header className="relative overflow-hidden rounded-b-[2rem] bg-linear-135 from-sonic-blue to-sonic-violet px-4 pt-10 pb-16 text-center text-white md:pt-14 md:pb-20">
        <div aria-hidden="true" className="pointer-events-none absolute -top-12 -right-12 size-48 rounded-full bg-sonic-bolt/15 blur-2xl md:size-72" />
        <div aria-hidden="true" className="pointer-events-none absolute top-1/3 -left-6 size-28 rounded-full bg-white/10 blur-xl md:size-48" />
        <div className="relative mx-auto flex max-w-xl flex-col items-center">
          <img src={logo} alt="Super Sonic Delivery" className="aspect-video w-44 rounded-xl bg-white object-cover shadow-card md:w-56" />
          <h1 className="mt-5 font-display text-h1 font-extrabold tracking-tight">Lightning-fast local delivery</h1>
          <p className="mt-1 flex items-center gap-1.5 text-body text-sonic-blue-50">
            Food from your favorite Sipocot restaurants
            <Zap className="size-4 shrink-0 fill-sonic-bolt text-sonic-bolt" aria-hidden="true" />
          </p>
        </div>
      </header>

      <main className="relative z-10 -mt-10 flex-1 px-4 pb-10">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          {/* Already logged in: go straight to your own section */}
          {user && (
            <Link to={HOME_BY_ROLE[user.role]} className={`${cardLink} ring-2 ring-sonic-blue`}>
              <span>
                <span className="block font-display text-base font-semibold">Continue as {user.full_name.split(' ')[0]}</span>
                <span className="block text-small text-sonic-muted">You are logged in as a {ROLE_NAMES[user.role]}</span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-sonic-blue" aria-hidden="true" />
            </Link>
          )}

          {/* Customers */}
          <section aria-labelledby="customer-title" className="rounded-xl bg-white p-5 shadow-card">
            <h2 id="customer-title" className="font-display text-h3 font-bold">
              Hungry?
            </h2>
            <p className="mt-1 text-body text-sonic-muted">Order from partner restaurants and get it delivered to your barangay.</p>
            <Link
              to="/customer"
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-sonic-blue font-display font-semibold text-white shadow-card transition hover:bg-sonic-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sonic-blue"
            >
              <ShoppingBag className="size-5" aria-hidden="true" />
              Order food
            </Link>
            <p className="mt-3 text-center text-small text-sonic-muted">
              New here?{' '}
              <Link to="/customer/register" className="font-semibold text-sonic-blue hover:underline">
                Create an account
              </Link>
            </p>
          </section>

          {/* Riders */}
          <Link to="/rider" className={cardLink}>
            <span className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sonic-blue-50 text-sonic-blue">
                <Bike className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block font-display text-base font-semibold">I&apos;m a rider</span>
                <span className="block text-small text-sonic-muted">Log in, or apply to deliver with Sonic</span>
              </span>
            </span>
            <ArrowRight className="size-5 shrink-0 text-sonic-muted" aria-hidden="true" />
          </Link>

          {/* Staff */}
          <section aria-labelledby="staff-title" className="rounded-xl bg-white p-4 shadow-card">
            <h2 id="staff-title" className="text-small font-semibold text-sonic-muted">
              Staff login
            </h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link
                to="/operator"
                className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-sonic-bg font-display text-small font-semibold transition hover:bg-sonic-blue-50 focus-visible:outline-2 focus-visible:outline-sonic-blue"
              >
                <Briefcase className="size-4" aria-hidden="true" />
                Operator
              </Link>
              <Link
                to="/admin"
                className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-sonic-bg font-display text-small font-semibold transition hover:bg-sonic-blue-50 focus-visible:outline-2 focus-visible:outline-sonic-blue"
              >
                <ShieldCheck className="size-4" aria-hidden="true" />
                Admin
              </Link>
            </div>
          </section>

          <p className="flex items-center justify-center gap-2 text-center text-small text-sonic-muted">
            <span className="size-2 rounded-full bg-green-600" aria-hidden="true" />
            Service hours: 7:30 AM – 8:30 PM · Sipocot, Camarines Sur
          </p>
        </div>
      </main>
    </div>
  )
}
