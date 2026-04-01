'use client'
import { useState, useEffect } from 'react'
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
type Room = { id: string; internal_name: string; guest_facing_name: string | null; room_number: string | null }
type Template = 'showcase' | 'checkin'

export default function SendPage() {
  const router = useRouter()
  const [properties, setProperties] = useState<Property[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [template, setTemplate] = useState<Template>('showcase')
  const [propertyId, setPropertyId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [language, setLanguage] = useState('en')
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentPhone, setSentPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => { loadProperties() }, [])
  useEffect(() => { if (propertyId) loadRooms(propertyId) }, [propertyId])

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
      .select('id, internal_name, guest_facing_name, room_number')
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

  async function handleSend() {
    setError('')
    if (!propertyId) { setError('Select a property.'); return }
    if (!roomId) { setError('Select a room.'); return }
    if (!phone.trim()) { setError('Enter a phone number.'); return }
    setSending(true)
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template, propertyId, roomId, language, phone: phone.trim(), userId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Send failed')
      setSentPhone(phone.trim())
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
    setError('')
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
          Guest link delivered to<br /><strong style={{ color: '#111827' }}>{sentPhone}</strong>
        </p>
        <button onClick={handleReset} style={{ ...styles.primaryBtn, marginBottom: 0 }}>
          Send another →
        </button>
      </div>
    </div>
  )

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logoMark}>A</div>
        <button onClick={handleSignOut} style={styles.signOutBtn}>Sign out</button>
      </div>

      {/* Form */}
      <div style={styles.form}>

        {/* Message Type */}
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
          <select
            value={propertyId}
            onChange={e => handlePropertyChange(e.target.value)}
            style={styles.select}
          >
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
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.room_number ? `Room ${r.room_number} — ` : ''}{r.guest_facing_name || r.internal_name}
                  </option>
                ))}
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

        {/* Phone */}
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
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <button
          onClick={handleSend}
          disabled={sending}
          style={{ ...styles.primaryBtn, background: sending ? '#A5B4FC' : '#4F46E5', cursor: sending ? 'not-allowed' : 'pointer' }}
        >
          {sending ? 'Sending…' : 'Send guest link →'}
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#F9FAFB',
    paddingBottom: 40,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    background: '#fff',
    borderBottom: '1px solid #E5E7EB',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: '#4F46E5',
    color: '#fff',
    fontSize: 18,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutBtn: {
    background: 'none',
    border: 'none',
    color: '#9CA3AF',
    fontSize: 13,
    cursor: 'pointer',
    padding: '4px 8px',
  },
  form: {
    padding: '24px 20px',
    maxWidth: 480,
    margin: '0 auto',
  },
  field: {
    marginBottom: 22,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 8,
  },
  toggleRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  toggleBtn: {
    padding: '12px 8px',
    borderRadius: 10,
    border: 'none',
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  select: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1.5px solid #E5E7EB',
    fontSize: 15,
    color: '#111827',
    background: '#fff',
    boxSizing: 'border-box' as const,
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239CA3AF' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    paddingRight: 36,
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
    outline: 'none',
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    margin: '6px 0 0',
  },
  primaryBtn: {
    width: '100%',
    padding: '15px',
    borderRadius: 12,
    border: 'none',
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    transition: 'background 0.2s',
    marginBottom: 16,
  },
  errorBox: {
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 8,
    padding: '10px 14px',
    color: '#DC2626',
    fontSize: 14,
    marginBottom: 16,
  },
  centered: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #E5E7EB',
    borderTop: '3px solid #4F46E5',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
}
