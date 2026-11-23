import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Lock, Mail } from 'lucide-react'
import AuthLayout from '../../layouts/AuthLayout'
import Alert from '../../components/Alert'
import Button from '../../components/Button'
import Input from '../../components/Input'
import { login } from '../../data/mock'
import { HOME_BY_ROLE, useAuth } from '../../context/AuthContext'
import { isValidEmail } from '../../lib/validate'

// Messages for accounts that exist but may not log in.
const BLOCKED_MESSAGES = {
  suspended: {
    title: 'Account suspended.',
    text: 'This account has been restricted. Please contact Super Sonic Delivery operations.',
  },
  inactive: {
    title: 'Account inactive.',
    text: 'This account is no longer active. Please contact Super Sonic Delivery operations.',
  },
}

export default function Login() {
  const navigate = useNavigate()
  const { signIn } = useAuth()

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
      signIn(result.user)
      navigate(HOME_BY_ROLE[result.user.role])
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to your Super Sonic account">
      {blocked && (
        <div className="mb-5">
          <Alert variant="error" title={BLOCKED_MESSAGES[blocked].title}>
            {BLOCKED_MESSAGES[blocked].text}
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

      <p className="mt-6 text-center text-body text-sonic-muted">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="font-semibold text-sonic-blue hover:text-sonic-blue-dark hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}
