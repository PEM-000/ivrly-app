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

    const { data: rows } = await supabaseAdmin.rpc('verify_and_use_otp', {
      p_phone: normalizedPhone,
      p_code: normalizedCode,
    })

    if (!rows || rows.length === 0) {
      return Response.json({ error: 'Invalid or expired code. Please try again.' }, { status: 401 })
    }

    const { otp_user_id } = rows[0]

    const { data: email } = await supabaseAdmin.rpc('get_auth_user_email', {
      p_user_id: otp_user_id,
    })

    if (!email) {
      return Response.json({ error: 'Account not found.' }, { status: 404 })
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
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