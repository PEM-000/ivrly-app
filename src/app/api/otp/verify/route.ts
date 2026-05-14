import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  try {
    const { phone, code } = await req.json()
    const normalizedPhone = phone.trim().replace(/[\s\-\(\)\.]/g, '')
    const normalizedCode = code.trim()

    if (!normalizedPhone || !normalizedCode || normalizedCode.length !== 6) {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    // Find valid, unused, non-expired OTP
    const { data: otp } = await supabaseAdmin
      .from('otp_codes')
      .select('id, user_id')
      .eq('phone_number', normalizedPhone)
      .eq('code', normalizedCode)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!otp) {
      return Response.json({ error: 'Invalid or expired code. Please try again.' }, { status: 401 })
    }

    // Mark OTP as used immediately
    await supabaseAdmin
      .from('otp_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', otp.id)

    // Get user email (needed for generateLink)
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', otp.user_id)
      .single()

    if (!user?.email) {
      return Response.json({ error: 'Account not found.' }, { status: 404 })
    }

    // Generate a server-side magic link token — client exchanges it for a session
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
    })

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('generateLink error:', linkError)
      return Response.json({ error: 'Failed to create session. Please try again.' }, { status: 500 })
    }

    return Response.json({ hashed_token: linkData.properties.hashed_token })

  } catch (err) {
    console.error('OTP verify error:', err)
    return Response.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
