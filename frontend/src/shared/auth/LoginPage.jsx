import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Lock, Mail } from 'lucide-react'
import AuthLayout from '@shared/auth/AuthLayout'
import Alert from '@shared/components/Alert'
import Button from '@shared/components/Button'
import Input from '@shared/components/Input'
import { login } from '@api'
import { HOME_BY_ROLE, useAuth } from '@shared/auth/AuthContext'
import { isValidEmail } from '@shared/utils/validate'

// Title and sign-up link of each role's login page (/customer/login, /rider/login, ...)
const LOGIN_TEXT = {
  customer: {
    title: 'Welcome back',
    subtitle: 'Log in to your Super Sonic account',
    signup: { question: "Don't have an account?", link: 'Create an account', to: '/customer/register' },
  },
  rider: {
    title: 'Rider login',
    subtitle: 'Log in to start your shift',
    signup: { question: 'Want to deliver with Sonic?', link: 'Apply as a rider', to: '/rider/apply' },
  },
  operator: {
    title: 'Operator login',
    subtitle: 'Log in to the dispatch console',
    signup: { question: 'New to the dispatch team?', link: 'Apply as an operator', to: '/operator/apply' },
  },
  admin: {
    title: 'Admin login',
    subtitle: 'Log in to manage Super Sonic Delivery',
    signup: null, // no public sign-up for admin
  },
}

// Messages for accounts that exist but may not log in.
// "inactive" covers both a deactivated account and an application that is not approved yet.
const BLOCKED_MESSAGES = {
  suspended: {
    title: 'Account suspended.',
    text: 'This account has been restricted. Please contact Super Sonic Delivery operations.',
  },
  network: {
    title: "Can't reach the server.",
    text: 'Check your connection, then try again.',
  },
  inactive: {
    title: 'Account not active yet.',
    text: 'If you just applied, please wait for Sonic staff to approve your account. Otherwise, contact Super Sonic Delivery operations.',
  },
}

// Any other answer (e.g. the server crashed).
const OTHER_ERROR = { title: 'Something went wrong.', text: 'Please try again in a moment.' }

// One login form for every role. Any account can log in here; after login the user goes to
// their own role's home page (a rider who logs in on /customer/login goes to /rider).
export default function LoginPage({ role }) {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const text = LOGIN_TEXT[role]

  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [blocked, setBlocked] = useState(null) // 'suspended' | 'inactive' | null
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
    setErrors({ ...errors, [name]: '' }) // clear the error while the user fixes the field
  }

  function validate() {
    const found = {}
    if (!form.email.trim()) found.email = 'Email is required.'
    else if (!isValidEmail(form.email)) found.email = 'Enter a valid email address.'
    if (!form.password) found.password = 'Password is required.'
    return found
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBlocked(null)

    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    const result = await login(form.email, form.password)
    setSubmitting(false)

    if (result.error === 'invalid') {
      setErrors({ password: 'Incorrect email or password.' })
    } else if (result.error) {
      setBlocked(result.error)
    } else {
      signIn(result.user, result.token)
      navigate(HOME_BY_ROLE[result.user.role])
    }
  }

  return (
    <AuthLayout title={text.title} subtitle={text.subtitle}>
      {blocked && (
        <div className="mb-5">
          <Alert variant="error" title={(BLOCKED_MESSAGES[blocked] || OTHER_ERROR).title}>
            {(BLOCKED_MESSAGES[blocked] || OTHER_ERROR).text}
          </Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Input
          label="Email address"
          id="email"
          type="email"
          icon={Mail}
          placeholder="name@example.com"
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          error={errors.email}
        />
        <Input
          label="Password"
          id="password"
          type="password"
          icon={Lock}
          placeholder="Enter your password"
          autoComplete="current-password"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
        />

        <Button type="submit" fullWidth disabled={submitting} className="mt-1">
          {submitting ? 'Logging in…' : 'Log in'}
          {!submitting && <ArrowRight className="size-5" aria-hidden="true" />}
        </Button>
      </form>

      {text.signup && (
        <p className="mt-6 text-center text-body text-sonic-muted">
          {text.signup.question}{' '}
          <Link to={text.signup.to} className="font-semibold text-sonic-blue hover:text-sonic-blue-dark hover:underline">
            {text.signup.link}
          </Link>
        </p>
      )}

      <p className="mt-4 text-center">
        <Link to="/" className="inline-flex items-center gap-1 text-small text-sonic-muted hover:text-sonic-ink hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to start
        </Link>
      </p>
    </AuthLayout>
  )
}
