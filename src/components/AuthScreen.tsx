import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AuthScreen() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
      setError(signInError.message)
      return
    }
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
            <button className="secondary-btn" type="button" onClick={() => setSubmitted(false)}>
              Use a different email
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
            <button className="primary-btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send sign-in link'}
            </button>
            {error && <p className="auth-error" role="alert">{error}</p>}
          </form>
        )}
      </section>
    </main>
  )
}