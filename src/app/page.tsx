'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const LANGUAGES = [
  { code: 'pl', label: 'Polish' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'it', label: 'Italian' },
  { code: 'es', label: 'Spanish' },
  { code: 'ru', label: 'Russian' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'cs', label: 'Czech' },
  { code: 'sk', label: 'Slovak' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ro', label: 'Romanian' },
  { code: 'hu', label: 'Hungarian' },
  { code: 'sv', label: 'Swedish' },
  { code: 'da', label: 'Danish' },
  { code: 'fi', label: 'Finnish' },
  { code: 'nb', label: 'Norwegian' },
]

type Property = { id: string; name: string; primary_language: string | null }
type Room = { id: string; internal_name: string; guest_facing_name: string | null; room_number: string | null; short_name: string | null }
type Template = 'showcase' | 'checkin'
type SendVia = 'sms' | 'email'

type SmsRateInfo = {
  country_name: string
  phone_prefix: string | null
  markup_rate_usd: number
} | null

export default function SendPage() {
  const router = useRouter()
  const [properties, setProperties] = useState<Property[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [template, setTemplate] = useState<Template>('showcase')
  const [propertyId, setPropertyId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [language, setLanguage] = useState('en')
  const [sendVia, setSendVia] = useState<SendVia>('sms')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [smsRate, setSmsRate] = useState<SmsRateInfo>(null)
  const [rateLoading, setRateLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [showSignOutModal, setShowSignOutModal] = useState(false)

  useEffect(() => { loadProperties() }, [])
  useEffect(() => { if (propertyId) loadRooms(propertyId) }, [propertyId])

  // Debounced SMS rate lookup
  const lookupRate = useCallback(async (phoneVal: string) => {
    const cleaned = phoneVal.trim().replace(/[\s\-\(\)]/g, '')
    if (!cleaned.startsWith('+') || cleaned.length < 6) {
      setSmsRate(null)
      return
    }
    setRateLoading(true)
    try {
      const res = await fetch(`/api/sms-rate?phone=${encodeURIComponent(cleaned)}`)
      if (res.ok) {
        const data = await res.json()
        setSmsRate(data)
      } else {
        setSmsRate(null)
      }
    } catch {
      setSmsRate(null)
    } finally {
      setRateLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sendVia !== 'sms') { setSmsRate(null); return }
    const timer = setTimeout(() => lookupRate(phone), 600)
    return () => clearTimeout(timer)
  }, [phone, sendVia, lookupRate])

  async function loadProperties() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUserId(session.user.id)
    const { data } = await supabase
      .from('properties')
      .select('id, name, primary_language')
      .eq('owner_id', session.user.id)
      .order('name')
    if (data && data.length > 0) {
      setProperties(data)
      setPropertyId(data[0].id)
      setLanguage(data[0].primary_language || 'en')
    }
    setLoading(false)
  }

  async function loadRooms(pid: string) {
    setRoomId('')
    const { data } = await supabase
      .from('rooms')
      .select('id, internal_name, guest_facing_name, room_number, short_name')
      .eq('property_id', pid)
      .order('room_number')
    setRooms(data || [])
    if (data && data.length > 0) setRoomId(data[0].id)
  }

  function handlePropertyChange(pid: string) {
    setPropertyId(pid)
    const prop = properties.find(p => p.id === pid)
    if (prop) setLanguage(prop.primary_language || 'en')
  }

  function roomLabel(r: Room) {
    const num = r.room_number ? `Rm ${r.room_number}` : null
    const name = r.short_name || r.guest_facing_name || r.internal_name
    return num ? `${num} · ${name}` : name
  }

  function switchSendVia(via: SendVia) {
    setSendVia(via)
    setError('')
    setSmsRate(null)
  }

  async function handleSend() {
    setError('')
    if (!propertyId) { setError('Select a property.'); return }
    if (!roomId) { setError('Select a room.'); return }
    if (!consent) { setError('Please confirm the guest requested this message.'); return }
    if (sendVia === 'sms' && !phone.trim()) { setError('Enter a phone number.'); return }
    if (sendVia === 'email' && !email.trim()) { setError('Enter an email address.'); return }

    setSending(true)
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template, propertyId, roomId, language,
          sendVia,
          phone: sendVia === 'sms' ? phone.trim() : undefined,
          email: sendVia === 'email' ? email.trim() : undefined,
          userId,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Send failed')
      setSentTo(sendVia === 'sms' ? phone.trim() : email.trim())
      setSent(true)
    } catch (e: any) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setSending(false)
    }
  }

  function handleReset() {
    setSent(false)
    setPhone('')
    setEmail('')
    setError('')
    setConsent(false)
    setSmsRate(null)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div style={styles.centered}>
      <div style={styles.spinner} />
    </div>
  )

  if (sent) return (
    <div style={styles.centered}>
      <div style={{ textAlign: 'center', padding: '0 32px' }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 10px' }}>Sent!</h2>
        <p style={{ color: '#6B7280', fontSize: 15, margin: '0 0 36px', lineHeight: 1.5 }}>
          Guest link delivered to<br />
          <strong style={{ color: '#111827' }}>{sentTo}</strong>
        </p>
        <button onClick={handleReset} style={{ ...styles.primaryBtn, marginBottom: 0 }}>
          Send another →
        </button>
      </div>
    </div>
  )

  return (
    <div style={styles.page}>

      {/* Sign out modal */}
      {showSignOutModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 10px' }}>Sign out?</h2>
            <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 24px', lineHeight: 1.5 }}>
              You will need to use your magic link email to sign back in.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSignOutModal(false)} style={styles.cancelBtn}>Cancel</button>
              <button onClick={handleSignOut} style={styles.signOutConfirmBtn}>Sign out</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logoMark}>A</div>
        <button onClick={() => setShowSignOutModal(true)} style={styles.signOutBtn}>Sign out</button>
      </div>

      {/* Form */}
      <div style={styles.form}>

        {/* Message type */}
        <div style={styles.field}>
          <label style={styles.label}>Message type</label>
          <div style={styles.toggleRow}>
            {(['showcase', 'checkin'] as Template[]).map(val => (
              <button
                key={val}
                onClick={() => setTemplate(val)}
                style={{
                  ...styles.toggleBtn,
                  background: template === val ? '#4F46E5' : '#F3F4F6',
                  color: template === val ? '#fff' : '#374151',
                  fontWeight: template === val ? 600 : 400,
                }}
              >
                {val === 'showcase' ? 'Room Showcase' : 'Self Check-In'}
              </button>
            ))}
          </div>
        </div>

        {/* Property */}
        <div style={styles.field}>
          <label style={styles.label}>Property</label>
          <select value={propertyId} onChange={e => handlePropertyChange(e.target.value)} style={styles.select}>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Room */}
        <div style={styles.field}>
          <label style={styles.label}>Room</label>
          {rooms.length === 0
            ? <p style={{ color: '#9CA3AF', fontSize: 14, margin: 0 }}>No rooms found.</p>
            : (
              <select value={roomId} onChange={e => setRoomId(e.target.value)} style={styles.select}>
                {rooms.map(r => <option key={r.id} value={r.id}>{roomLabel(r)}</option>)}
              </select>
            )}
        </div>

        {/* Language */}
        <div style={styles.field}>
          <label style={styles.label}>Language</label>
          <select value={language} onChange={e => setLanguage(e.target.value)} style={styles.select}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>

        {/* Delivery method */}
        <div style={styles.field}>
          <label style={styles.label}>Delivery method</label>
          <div style={styles.toggleRow}>
            <button
              onClick={() => switchSendVia('sms')}
              style={{
                ...styles.toggleBtn,
                background: sendVia === 'sms' ? '#4F46E5' : '#F3F4F6',
                color: sendVia === 'sms' ? '#fff' : '#374151',
                fontWeight: sendVia === 'sms' ? 600 : 400,
              }}
            >
              📱 SMS
            </button>
            <button
              onClick={() => switchSendVia('email')}
              style={{
                ...styles.toggleBtn,
                background: sendVia === 'email' ? '#059669' : '#F3F4F6',
                color: sendVia === 'email' ? '#fff' : '#374151',
                fontWeight: sendVia === 'email' ? 600 : 400,
              }}
            >
              ✉️ Email — free
            </button>
          </div>
        </div>

        {/* SMS: phone + rate display */}
        {sendVia === 'sms' && (
          <div style={styles.field}>
            <label style={styles.label}>Guest phone number</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+48 123 456 789"
              style={styles.input}
            />
            <p style={styles.hint}>Include country code — e.g. +1 US, +44 UK, +48 Poland</p>

            {/* Rate display */}
            {rateLoading && (
              <div style={styles.rateBox}>
                <span style={{ color: '#9CA3AF', fontSize: 13 }}>Looking up rate…</span>
              </div>
            )}
            {!rateLoading && smsRate && (
              <div style={styles.rateBox}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 14, color: '#111827', fontWeight: 600 }}>
                      📱 SMS to {smsRate.country_name}
                      {smsRate.phone_prefix ? ` (${smsRate.phone_prefix})` : ''}
                    </span>
                    <span style={{ fontSize: 14, color: '#374151' }}>
                      {' '}— <strong>${smsRate.markup_rate_usd.toFixed(3)}</strong> per message
                    </span>
                  </div>
                  <button
                    onClick={() => switchSendVia('email')}
                    style={styles.switchToEmailBtn}
                  >
                    ✉️ Send free via email instead
                  </button>
                </div>
              </div>
            )}
            {!rateLoading && !smsRate && phone.trim().length > 4 && (
              <div style={{ ...styles.rateBox, background: '#FEF3C7', borderColor: '#FCD34D' }}>
                <span style={{ fontSize: 13, color: '#92400E' }}>
                  Enter full number with country code to see rate
                </span>
              </div>
            )}
          </div>
        )}

        {/* Email: email input */}
        {sendVia === 'email' && (
          <div style={styles.field}>
            <label style={styles.label}>Guest email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="guest@example.com"
              style={styles.input}
            />
            <div style={{ ...styles.rateBox, background: '#ECFDF5', borderColor: '#6EE7B7', marginTop: 8 }}>
              <span style={{ fontSize: 13, color: '#065F46', fontWeight: 500 }}>
                ✉️ Email delivery is always free — no SMS charges apply.
              </span>
            </div>
          </div>
        )}

        {/* Consent */}
        <div style={styles.field}>
          <label style={styles.label}>Reason for sending</label>
          <div style={styles.consentBox}>
            <label style={styles.consentOption}>
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                style={styles.radio}
              />
              <div>
                <span style={styles.consentTitle}>Guest requested this message</span>
                <span style={styles.consentDesc}>The guest contacted the property and specifically asked to receive this information.</span>
              </div>
            </label>
          </div>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <button
          onClick={handleSend}
          disabled={sending || !consent}
          style={{
            ...styles.primaryBtn,
            background: sending
              ? '#A5B4FC'
              : !consent
                ? '#D1D5DB'
                : sendVia === 'email'
                  ? '#059669'
                  : '#4F46E5',
            cursor: (sending || !consent) ? 'not-allowed' : 'pointer',
          }}
        >
          {sending
            ? 'Sending…'
            : sendVia === 'email'
              ? 'Send via email →'
              : 'Send via SMS →'}
        </button>

      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#F9FAFB', paddingBottom: 40 },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', background: '#fff', borderBottom: '1px solid #E5E7EB',
    position: 'sticky', top: 0, zIndex: 10,
  },
  logoMark: {
    width: 36, height: 36, borderRadius: 10, background: '#4F46E5',
    color: '#fff', fontSize: 18, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  signOutBtn: { background: 'none', border: 'none', color: '#9CA3AF', fontSize: 13, cursor: 'pointer', padding: '4px 8px' },
  form: { padding: '24px 20px', maxWidth: 480, margin: '0 auto' },
  field: { marginBottom: 22 },
  label: {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#374151',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8,
  },
  toggleRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  toggleBtn: { padding: '12px 8px', borderRadius: 10, border: 'none', fontSize: 14, cursor: 'pointer', transition: 'all 0.15s' },
  select: {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1.5px solid #E5E7EB', fontSize: 15, color: '#111827',
    background: '#fff', boxSizing: 'border-box' as const, appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239CA3AF' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 36,
  },
  input: {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1.5px solid #E5E7EB', fontSize: 16, color: '#111827',
    background: '#fff', boxSizing: 'border-box' as const, outline: 'none',
  },
  hint: { fontSize: 12, color: '#9CA3AF', margin: '6px 0 0' },
  rateBox: {
    marginTop: 10, padding: '10px 14px',
    background: '#EEF2FF', border: '1px solid #C7D2FE',
    borderRadius: 8, fontSize: 13,
  },
  switchToEmailBtn: {
    background: 'none', border: '1px solid #059669', color: '#059669',
    fontSize: 12, fontWeight: 600, padding: '5px 10px',
    borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' as const,
  },
  consentBox: { border: '1.5px solid #E5E7EB', borderRadius: 10, background: '#fff', overflow: 'hidden' },
  consentOption: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', cursor: 'pointer' },
  consentTitle: { display: 'block', fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 3 },
  consentDesc: { display: 'block', fontSize: 12, color: '#6B7280', lineHeight: 1.5 },
  radio: { marginTop: 2, accentColor: '#4F46E5', flexShrink: 0 },
  primaryBtn: {
    width: '100%', padding: '15px', borderRadius: 12, border: 'none',
    color: '#fff', fontSize: 16, fontWeight: 600, transition: 'background 0.2s', marginBottom: 16,
  },
  errorBox: {
    background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
    padding: '10px 14px', color: '#DC2626', fontSize: 14, marginBottom: 16,
  },
  centered: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  spinner: {
    width: 32, height: 32, border: '3px solid #E5E7EB',
    borderTop: '3px solid #4F46E5', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: { background: '#fff', borderRadius: 16, padding: 32, maxWidth: 320, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
  cancelBtn: { padding: '10px 20px', fontSize: 14, color: '#6B7280', background: 'transparent', border: '1px solid #E5E7EB', borderRadius: 10, cursor: 'pointer' },
  signOutConfirmBtn: { padding: '10px 20px', fontSize: 14, fontWeight: 600, color: '#fff', background: '#DC2626', border: 'none', borderRadius: 10, cursor: 'pointer' },
}
