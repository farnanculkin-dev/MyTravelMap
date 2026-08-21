import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

function friendlyAuthError(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('rate limit') || normalized.includes('too many') || normalized.includes('email rate')) {
    return 'Too many sign-in emails have been requested. Please wait a while before trying again.'
  }
  return message
}

function isRateLimitError(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('rate limit') || normalized.includes('too many') || normalized.includes('email rate')
}

export default function AuthScreen() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = window.setInterval(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooldownSeconds])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || cooldownSeconds > 0) return
    setError(null)
    setIsSubmitting(true)

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    setIsSubmitting(false)
    if (signInError) {
      setError(friendlyAuthError(signInError.message))
      if (isRateLimitError(signInError.message)) setCooldownSeconds(30)
      return
    }
    setCooldownSeconds(30)
    setSubmitted(true)
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel" aria-labelledby="auth-title">
        <p className="auth-eyebrow">Family Atlas</p>
        <h1 id="auth-title">Our Family Travel Map</h1>
        {submitted ? (
          <div className="auth-confirmation" role="status">
            <h2>Check your email</h2>
            <p>We sent a sign-in link to {email.trim()}.</p>
            <button className="secondary-btn" type="button" disabled={cooldownSeconds > 0} onClick={() => setSubmitted(false)}>
              {cooldownSeconds > 0 ? `Try another email in ${cooldownSeconds}s` : 'Use a different email'}
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <p>Sign in to continue to your private Family Atlas.</p>
            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
            <button className="primary-btn" type="submit" disabled={isSubmitting || cooldownSeconds > 0}>
              {isSubmitting ? 'Sending...' : cooldownSeconds > 0 ? `Please wait ${cooldownSeconds}s` : 'Send sign-in link'}
            </button>
            {error && <p className="auth-error" role="alert">{error}</p>}
          </form>
        )}
      </section>
    </main>
  )
}