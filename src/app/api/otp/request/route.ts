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

    // Rate limit: max 3 OTP requests per 10 minutes per phone
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { count } = await supabaseAdmin
      .from('otp_codes')
      .select('id', { count: 'exact', head: true })
      .eq('phone_number', normalizedPhone)
      .gt('created_at', tenMinutesAgo)

    if ((count ?? 0) >= 3) {
      return Response.json({ error: 'Too many attempts. Please wait a few minutes before trying again.' }, { status: 429 })
    }

    // Look up user by phone — always return success to prevent phone enumeration
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('phone_number', normalizedPhone)
      .single()

    if (!user) {
      // Don't reveal that the number isn't registered
      return Response.json({ success: true })
    }

    // Generate and store OTP
    const code = generateCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    await supabaseAdmin.from('otp_codes').insert({
      user_id: user.id,
      phone_number: normalizedPhone,
      code,
      expires_at: expiresAt,
    })

    // Send SMS via Twilio (direct REST call — no SDK needed)
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
