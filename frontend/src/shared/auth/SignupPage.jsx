import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Bike, CheckCircle2, CreditCard, Lock, Mail, Phone, User, UserCheck, Zap } from 'lucide-react'
import AuthLayout from '@shared/auth/AuthLayout'
import Alert from '@shared/components/Alert'
import Button from '@shared/components/Button'
import Input from '@shared/components/Input'
import Select from '@shared/components/Select'
import { applyAsStaff, registerCustomer } from '@mock/mock'
import { HOME_BY_ROLE, LOGIN_BY_ROLE, useAuth } from '@shared/auth/AuthContext'
import { isValidEmail, isValidPhMobile } from '@shared/utils/validate'

// Desktop left panel content for customers (from stitch-exports/01-signup-desktop.html)
const SIGNUP_PANEL = {
  badge: 'Lightning local dispatch',
  heading: 'Join Super Sonic Delivery',
  text: 'Lightning-fast local delivery from your favorite Sipocot restaurants.',
  highlights: [
    { Icon: Zap, title: 'Easy order tracking', text: 'See your order status from the restaurant to your door.' },
    { Icon: Zap, title: 'Local restaurant access', text: 'Menus from partner restaurants, even several in one order.' },
    { Icon: Zap, title: 'Fast dispatch across barangays', text: 'Our riders bring your food to your barangay, hot and on time.' },
  ],
}

// Text of each role's sign-up page.
// customer: account is active right away. rider/operator: an application (inactive account) that
// staff approve first (rider → operator approves, operator → admin approves). Admin has no sign-up.
const SIGNUP_TEXT = {
  customer: {
    title: 'Create account',
    subtitle: 'Sign up as a Super Sonic customer',
    cardTitle: 'Create customer account',
    cardSubtitle: 'Sign up for quick ordering and order tracking',
    badge: 'Customer account registration',
    notice: 'Customer sign-up. Riders and operators apply from their own login page.',
    submit: 'Create account',
    submitting: 'Creating account…',
    panel: SIGNUP_PANEL,
  },
  rider: {
    title: 'Apply as a rider',
    subtitle: 'Deliver with Super Sonic in Sipocot',
    cardTitle: 'Rider application',
    cardSubtitle: 'An operator will review your application',
    badge: 'Rider application',
    notice: 'You can log in once an operator approves your application.',
    submit: 'Send application',
    submitting: 'Sending…',
    panel: undefined, // default panel
  },
  operator: {
    title: 'Apply as an operator',
    subtitle: 'Join the Super Sonic dispatch team',
    cardTitle: 'Operator application',
    cardSubtitle: 'The admin will review your application',
    badge: 'Operator application',
    notice: 'You can log in once the admin approves your application.',
    submit: 'Send application',
    submitting: 'Sending…',
    panel: undefined,
  },
}

// rider_profiles.vehicle_type options
const VEHICLE_TYPES = ['Motorcycle', 'Bicycle', 'E-bike']

const EMPTY_FORM = {
  full_name: '',
  email: '',
  contact_number: '', // digits typed after +63, e.g. 9171234567
  password: '',
  confirm_password: '',
  vehicle_type: '', // riders only
  plate_number: '', // riders only, optional
}

export default function SignupPage({ role }) {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const text = SIGNUP_TEXT[role]
  const isRider = role === 'rider'

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [applied, setApplied] = useState(false) // rider/operator: application sent

  function handleChange(e) {
    const { name } = e.target
    let { value } = e.target

    // Contact number: keep digits only, drop a leading 0 (0917 → 917), max 10 digits.
    if (name === 'contact_number') {
      value = value.replace(/\D/g, '').replace(/^0/, '').slice(0, 10)
    }
    if (name === 'plate_number') value = value.toUpperCase()

    setForm({ ...form, [name]: value })
    setErrors({ ...errors, [name]: '' })
  }

  function validate() {
    const found = {}
    if (!form.full_name.trim()) found.full_name = 'Full name is required.'

    if (!form.email.trim()) found.email = 'Email is required.'
    else if (!isValidEmail(form.email)) found.email = 'Enter a valid email address.'

    if (!form.contact_number) found.contact_number = 'Contact number is required.'
    else if (!isValidPhMobile(form.contact_number))
      found.contact_number = 'Enter a 10-digit mobile number starting with 9.'

    if (isRider && !form.vehicle_type) found.vehicle_type = 'Please choose your vehicle.'

    if (!form.password) found.password = 'Password is required.'
    else if (form.password.length < 8) found.password = 'Password must be at least 8 characters.'

    if (!form.confirm_password) found.confirm_password = 'Please confirm your password.'
    else if (form.confirm_password !== form.password) found.confirm_password = 'Passwords do not match.'

    return found
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    const details = {
      full_name: form.full_name,
      email: form.email,
      contact_number: '0' + form.contact_number, // saved as 09171234567
      password: form.password,
    }

    setSubmitting(true)
    const result =
      role === 'customer'
        ? await registerCustomer(details)
        : await applyAsStaff({
            ...details,
            role,
            vehicle_type: form.vehicle_type,
            plate_number: form.plate_number.trim() || null,
          })
    setSubmitting(false)

    if (result.error === 'email_taken') {
      setErrors({ email: 'This email is already registered. Try logging in.' })
      return
    }

    if (role === 'customer') {
      signIn(result.user)
      navigate(HOME_BY_ROLE.customer)
    } else {
      setApplied(true)
    }
  }

  // Rider/operator: application sent, waiting for approval
  if (applied) {
    return (
      <AuthLayout title="Application sent" subtitle="Thank you for applying!">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-green-600/10">
            <CheckCircle2 className="size-8 text-green-600" aria-hidden="true" />
          </span>
          <h2 className="font-display text-h3 font-semibold">Application sent</h2>
          <p className="text-body text-sonic-muted">
            You can log in once Sonic staff approve your account. We may contact you at the number you gave.
          </p>
          <Button fullWidth onClick={() => navigate(LOGIN_BY_ROLE[role])} className="mt-2">
            Go to login
            <ArrowRight className="size-5" aria-hidden="true" />
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={text.title}
      subtitle={text.subtitle}
      cardTitle={text.cardTitle}
      cardSubtitle={text.cardSubtitle}
      cardBadge={
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-sonic-blue-50 px-3 py-1 text-caption font-semibold text-sonic-blue">
          <UserCheck className="size-3.5" aria-hidden="true" />
          {text.badge}
        </span>
      }
      panel={text.panel}
      wide
    >
      {/* Phone + tablet only: on desktop the badge above the title says this instead */}
      <div className="mb-5 lg:hidden">
        <Alert variant="info">{text.notice}</Alert>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Full name"
          id="full_name"
          icon={User}
          placeholder="e.g. Juan Dela Cruz"
          autoComplete="name"
          required
          value={form.full_name}
          onChange={handleChange}
          error={errors.full_name}
        />
        <Input
          label="Email address"
          id="email"
          type="email"
          icon={Mail}
          placeholder="juan.delacruz@gmail.com"
          autoComplete="email"
          required
          value={form.email}
          onChange={handleChange}
          error={errors.email}
        />
        <Input
          label="Contact number"
          id="contact_number"
          type="tel"
          inputMode="numeric"
          icon={Phone}
          prefix="+63"
          placeholder="9171234567"
          autoComplete="tel-national"
          required
          value={form.contact_number}
          onChange={handleChange}
          error={errors.contact_number}
        />

        {/* Riders only: rider_profiles.vehicle_type and plate_number */}
        {isRider && (
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            <Select
              label="Vehicle"
              id="vehicle_type"
              icon={Bike}
              required
              value={form.vehicle_type}
              onChange={handleChange}
              error={errors.vehicle_type}
            >
              <option value="">Choose your vehicle</option>
              {VEHICLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
            <Input
              label="Plate number"
              id="plate_number"
              icon={CreditCard}
              placeholder="e.g. ABC 1234"
              hint="Optional for bicycles"
              value={form.plate_number}
              onChange={handleChange}
            />
          </div>
        )}

        {/* Password fields side by side on wide desktop screens (xl, 1280px+) */}
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          <Input
            label="Password"
            id="password"
            type="password"
            icon={Lock}
            placeholder="Create a password"
            autoComplete="new-password"
            required
            hint="At least 8 characters"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
          />
          <Input
            label="Confirm password"
            id="confirm_password"
            type="password"
            icon={Lock}
            placeholder="Re-enter password"
            autoComplete="new-password"
            required
            value={form.confirm_password}
            onChange={handleChange}
            error={errors.confirm_password}
          />
        </div>

        <Button type="submit" fullWidth disabled={submitting} className="mt-2">
          {submitting ? text.submitting : text.submit}
          {!submitting && <ArrowRight className="size-5" aria-hidden="true" />}
        </Button>
      </form>

      <p className="mt-6 text-center text-body text-sonic-muted">
        Already have an account?{' '}
        <Link to={LOGIN_BY_ROLE[role]} className="font-semibold text-sonic-blue hover:text-sonic-blue-dark hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  )
}
