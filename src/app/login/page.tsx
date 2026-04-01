'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    setError('')
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setSent(true)
    }
  }

  if (sent) return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ fontSize: 40, marginBottom: 16, textAlign: 'center' }}>📬</div>
        <h1 style={styles.title}>Check your email</h1>
        <p style={styles.subtitle}>We sent a link to <strong>{email}</strong>. Tap it to sign in.</p>
        <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 24 }}>
          You can close this tab and tap the link in your email.
        </p>
      </div>
    </div>
  )

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={styles.logo}>A</div>
          <h1 style={styles.title}>Arrivio</h1>
          <p style={styles.subtitle}>Enter your email to sign in</p>
        </div>

        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          style={styles.input}
        />

        {error && (
          <div style={styles.error}>{error}</div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{ ...styles.button, background: loading ? '#A5B4FC' : '#4F46E5' }}
        >
          {loading ? 'Sending…' : 'Send sign-in link →'}
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: '#F9FAFB',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '40px 32px',
    width: '100%',
    maxWidth: 380,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)',
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: '#4F46E5',
    color: '#fff',
    fontSize: 24,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 8px',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    margin: '0 0 24px',
    textAlign: 'center',
    lineHeight: 1.5,
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1.5px solid #E5E7EB',
    fontSize: 16,
    color: '#111827',
    background: '#fff',
    boxSizing: 'border-box' as const,
    marginBottom: 16,
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '14px',
    borderRadius: 10,
    border: 'none',
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  error: {
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 8,
    padding: '10px 14px',
    color: '#DC2626',
    fontSize: 14,
    marginBottom: 16,
  },
}
