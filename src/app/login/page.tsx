'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Step = 'phone' | 'code'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRequestOTP() {
    setError('')
    const trimmed = phone.trim()
    if (!trimmed.startsWith('+') || trimmed.replace(/\D/g, '').length < 7) {
      setError('Enter your phone number with country code — e.g. +48 123 456 789')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: trimmed }),
      })
      if (res.ok) {
        setStep('code')
      } else {
        const data = await res.json()
        setError(data.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Network error. Please check your connection.')
    }
    setLoading(false)
  }

  async function handleVerifyOTP() {
    setError('')
    if (code.length !== 6) {
      setError('Enter the 6-digit code from your SMS.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Invalid code. Please try again.')
        setLoading(false)
        return
      }

      // Exchange server-generated token for a client session
      const { error: sessionError } = await supabase.auth.verifyOtp({
        token_hash: data.hashed_token,
        type: 'magiclink',
      })

      if (sessionError) {
        setError('Failed to sign in. Please request a new code.')
        setLoading(false)
        return
      }

      router.replace('/')
    } catch {
      setError('Network error. Please check your connection.')
      setLoading(false)
    }
  }

  if (step === 'code') return (
    <div style={s.container}>
      <div style={s.card}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={s.logo}>A</div>
          <h1 style={s.title}>Check your messages</h1>
          <p style={s.subtitle}>
            We sent a 6-digit code to<br />
            <strong style={{ color: '#111827' }}>{phone}</strong>
          </p>
        </div>

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={code}
          onChange={e => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 6)
            setCode(val)
            setError('')
          }}
          onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
          placeholder="123456"
          autoComplete="one-time-code"
          autoFocus
          style={{ ...s.input, letterSpacing: '0.3em', textAlign: 'center', fontSize: 24, fontWeight: 700 }}
        />

        {error && <div style={s.error}>{error}</div>}

        <button
          onClick={handleVerifyOTP}
          disabled={loading || code.length !== 6}
          style={{ ...s.button, background: (loading || code.length !== 6) ? '#A5B4FC' : '#4F46E5', cursor: (loading || code.length !== 6) ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Verifying…' : 'Sign in →'}
        </button>

        <button
          onClick={() => { setStep('phone'); setCode(''); setError('') }}
          style={s.backBtn}
        >
          ← Use a different number
        </button>

        <p style={{ fontSize: 12, color: '#D1D5DB', textAlign: 'center', marginTop: 24, lineHeight: 1.5 }}>
          Code expires in 10 minutes. If it doesn't arrive, check that your number is registered with your account.
        </p>
      </div>
    </div>
  )

  return (
    <div style={s.container}>
      <div style={s.card}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={s.logo}>A</div>
          <h1 style={s.title}>Arrivio</h1>
          <p style={s.subtitle}>Enter your phone number to sign in</p>
        </div>

        <input
          type="tel"
          value={phone}
          onChange={e => { setPhone(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleRequestOTP()}
          placeholder="+48 123 456 789"
          autoComplete="tel"
          autoFocus
          style={s.input}
        />

        {error && <div style={s.error}>{error}</div>}

        <button
          onClick={handleRequestOTP}
          disabled={loading}
          style={{ ...s.button, background: loading ? '#A5B4FC' : '#4F46E5', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Sending…' : 'Send code →'}
        </button>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: '24px', background: '#F9FAFB',
  },
  card: {
    background: '#fff', borderRadius: 16, padding: '40px 32px',
    width: '100%', maxWidth: 380,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)',
  },
  logo: {
    width: 52, height: 52, borderRadius: 14, background: '#4F46E5',
    color: '#fff', fontSize: 24, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 16px',
  },
  title: { fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 8px', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6B7280', margin: '0 0 24px', textAlign: 'center', lineHeight: 1.5 },
  input: {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1.5px solid #E5E7EB', fontSize: 16, color: '#111827',
    background: '#fff', boxSizing: 'border-box' as const, marginBottom: 16, outline: 'none',
  },
  button: {
    width: '100%', padding: '14px', borderRadius: 10, border: 'none',
    color: '#fff', fontSize: 16, fontWeight: 600, transition: 'background 0.2s',
  },
  error: {
    background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
    padding: '10px 14px', color: '#DC2626', fontSize: 14, marginBottom: 16,
  },
  backBtn: {
    width: '100%', marginTop: 16, background: 'none', border: 'none',
    color: '#9CA3AF', fontSize: 14, cursor: 'pointer', padding: '8px',
  },
}
