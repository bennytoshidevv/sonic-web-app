import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Lock, Mail, Phone, User, UserCheck, Zap } from 'lucide-react'
import AuthLayout from '../../layouts/AuthLayout'
import Alert from '../../components/Alert'
import Button from '../../components/Button'
import Input from '../../components/Input'
import { registerCustomer } from '../../data/mock'
import { HOME_BY_ROLE, useAuth } from '../../context/AuthContext'
import { isValidEmail, isValidPhMobile } from '../../lib/validate'

// Desktop left panel content (from stitch-exports/01-signup-desktop.html)
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

const EMPTY_FORM = {
  full_name: '',
  email: '',
  contact_number: '', // digits typed after +63, e.g. 9171234567
  password: '',
  confirm_password: '',
}

export default function Register() {
  const navigate = useNavigate()
  const { signIn } = useAuth()

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name } = e.target
    let { value } = e.target

    // Contact number: keep digits only, drop a leading 0 (0917 → 917), max 10 digits.
    if (name === 'contact_number') {
      value = value.replace(/\D/g, '').replace(/^0/, '').slice(0, 10)
    }

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

    setSubmitting(true)
    const result = await registerCustomer({
      full_name: form.full_name,
      email: form.email,
      contact_number: '0' + form.contact_number, // saved as 09171234567
      password: form.password,
    })
    setSubmitting(false)

    if (result.error === 'email_taken') {
      setErrors({ email: 'This email is already registered. Try logging in.' })
      return
    }

    signIn(result.user)
    navigate(HOME_BY_ROLE.customer)
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="Sign up as a Super Sonic customer"
      cardTitle="Create customer account"
      cardSubtitle="Sign up for quick ordering and order tracking"
      cardBadge={
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-sonic-blue-50 px-3 py-1 text-caption font-semibold text-sonic-blue">
          <UserCheck className="size-3.5" aria-hidden="true" />
          Customer account registration
        </span>
      }
      panel={SIGNUP_PANEL}
      wide
    >
      {/* Phone + tablet only: on desktop the badge above the title says this instead */}
      <div className="mb-5 lg:hidden">
        <Alert variant="info">
          Customer sign-up only. Riders and operators get their accounts from Sonic staff.
        </Alert>
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
          {submitting ? 'Creating account…' : 'Create account'}
          {!submitting && <ArrowRight className="size-5" aria-hidden="true" />}
        </Button>
      </form>

      <p className="mt-6 text-center text-body text-sonic-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-sonic-blue hover:text-sonic-blue-dark hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  )
}
