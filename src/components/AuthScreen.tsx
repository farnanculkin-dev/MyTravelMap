import { FormEvent, useEffect, useMemo, useState } from 'react'
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
  const [reviewCode, setReviewCode] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  const isDevelopReview = useMemo(() => {
    return window.location.hostname === 'my-travel-map-git-develop-farnanculkin-devs-projects.vercel.app'
  }, [])

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

  async function handleReviewLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isDevelopReview || reviewSubmitting || !reviewCode.trim()) return
    setReviewError(null)
    setReviewSubmitting(true)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
      if (!supabaseUrl) throw new Error('Supabase is not configured for this deployment.')

      const response = await fetch(`${supabaseUrl}/functions/v1/dev-review-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewCode: reviewCode.trim() }),
      })
      const payload = await response.json() as { actionLink?: string; error?: string }
      if (!response.ok || !payload.actionLink) throw new Error(payload.error || 'Could not start the review session.')
      window.location.assign(payload.actionLink)
    } catch (reviewLoginError) {
      setReviewError(reviewLoginError instanceof Error ? reviewLoginError.message : 'Could not start the review session.')
      setReviewSubmitting(false)
    }
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

        {isDevelopReview && (
          <div className="dev-review-login" aria-label="Development review login">
            <div className="dev-review-divider"><span>Development review</span></div>
            <form className="auth-form" onSubmit={handleReviewLogin}>
              <p>Use the review code to sign in without sending another email.</p>
              <label htmlFor="review-code">Review code</label>
              <input
                id="review-code"
                type="password"
                autoComplete="off"
                value={reviewCode}
                onChange={(event) => setReviewCode(event.target.value)}
                placeholder="Enter review code"
                required
              />
              <button className="secondary-btn" type="submit" disabled={reviewSubmitting}>
                {reviewSubmitting ? 'Opening review session...' : 'Open review session'}
              </button>
              {reviewError && <p className="auth-error" role="alert">{reviewError}</p>}
            </form>
          </div>
        )}
      </section>
    </main>
  )
}
