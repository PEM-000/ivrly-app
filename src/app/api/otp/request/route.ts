import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(req: Request) {
  try {
    const { phone } = await req.json()
    const normalizedPhone = phone.trim().replace(/[\s\-\(\)\.]/g, '')

    if (!normalizedPhone.startsWith('+') || normalizedPhone.length < 8) {
      return Response.json({ error: 'Invalid phone number.' }, { status: 400 })
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: attemptCount } = await supabaseAdmin.rpc('count_otp_attempts', {
      p_phone: normalizedPhone,
      p_since: tenMinutesAgo,
    })

    if ((attemptCount ?? 0) >= 3) {
      return Response.json({ error: 'Too many attempts. Please wait a few minutes before trying again.' }, { status: 429 })
    }

    const { data: userId } = await supabaseAdmin.rpc('find_owner_by_phone', {
      p_phone: normalizedPhone,
    })

    if (!userId) {
      return Response.json({ success: true })
    }

    const code = generateCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    await supabaseAdmin.rpc('insert_otp', {
      p_user_id: userId,
      p_phone: normalizedPhone,
      p_code: code,
      p_expires: expiresAt,
    })

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`
    const body = new URLSearchParams({
      Body: `Your Arrivio sign-in code is: ${code}. It expires in 10 minutes.`,
      From: process.env.TWILIO_PHONE_NUMBER!,
      To: normalizedPhone,
    })

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })

    if (!twilioRes.ok) {
      console.error('Twilio OTP error:', await twilioRes.text())
      return Response.json({ error: 'Failed to send SMS. Please try again.' }, { status: 500 })
    }

    return Response.json({ success: true })

  } catch (err) {
    console.error('OTP request error:', err)
    return Response.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}