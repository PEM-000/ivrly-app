import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parsePhoneNumber } from 'libphonenumber-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/sms-rate?phone=+48123456789
// Returns country name, dial prefix, and markup_rate_usd for the given phone number.
// Used by the PWA to show cost estimate before sending.

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone') ?? ''
  if (!phone || phone.trim().length < 4) {
    return NextResponse.json({ error: 'Phone number too short' }, { status: 400 })
  }

  // Parse country from E.164 phone number
  let countryCode: string | null = null
  try {
    const parsed = parsePhoneNumber(phone.trim())
    countryCode = parsed?.country ?? null
  } catch {
    return NextResponse.json({ error: 'Could not parse phone number' }, { status: 400 })
  }

  if (!countryCode) {
    return NextResponse.json({ error: 'Could not determine country' }, { status: 400 })
  }

  // Look up rate from twilio_rates
  const { data: rates, error } = await supabase
    .from('twilio_rates')
    .select('country_code, country_name, markup_rate_usd')
    .eq('is_active', true)
    .ilike('country_code', countryCode)
    .limit(1)

  if (error || !rates || rates.length === 0) {
    return NextResponse.json({ error: 'Rate not found for this country' }, { status: 404 })
  }

  const rate = rates[0]

  // Get dial prefix from countries table
  const { data: country } = await supabase
    .from('countries')
    .select('phone_prefix')
    .ilike('iso2', countryCode)
    .limit(1)
    .single()

  return NextResponse.json({
    country_code: rate.country_code.trim(),
    country_name: rate.country_name,
    markup_rate_usd: parseFloat(rate.markup_rate_usd),
    phone_prefix: country?.phone_prefix ?? null,
  })
}
