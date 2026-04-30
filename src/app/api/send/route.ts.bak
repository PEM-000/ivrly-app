import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { template, propertyId, roomId, language, phone } = await req.json()

    if (!phone || phone.trim().length < 7) {
      return NextResponse.json({ error: 'A valid phone number is required.' }, { status: 400 })
    }
    if (!propertyId) {
      return NextResponse.json({ error: 'Property is required.' }, { status: 400 })
    }
    if (!roomId) {
      return NextResponse.json({ error: 'Room is required.' }, { status: 400 })
    }

    // Look up existing token for this room/template
    const { data: tokenRow } = await supabase
      .from('send_log')
      .select('token')
      .eq('room_id', roomId)
      .eq('template', template)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let token: string
    if (!tokenRow) {
      token = crypto.randomUUID()
    } else {
      token = tokenRow.token
    }

    // Log this send
    await supabase.from('send_log').insert({
      property_id: propertyId,
      room_id: roomId,
      template,
      language,
      phone: phone.trim(),
      token,
    })

    // Format phone to E.164
    let formattedPhone = phone.trim().replace(/[\s\-\(\)]/g, '')
    if (!formattedPhone.startsWith('+')) formattedPhone = '+' + formattedPhone

    // Build guest page URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bnbinfo.vercel.app'
    const guestUrl = `${appUrl}/g/${token}?lang=${language}`

    // Build SMS body
    const templateLabel = template === 'checkin' ? 'check-in instructions' : 'room information'
    const smsBody = [
      `Your ${templateLabel} are ready:`,
      ``,
      guestUrl,
      ``,
      `Reply STOP to opt out.`,
    ].join('\n')

    // Send via Twilio
    const twilioSid   = process.env.TWILIO_ACCOUNT_SID!
    const twilioToken = process.env.TWILIO_AUTH_TOKEN!
    const twilioFrom  = process.env.TWILIO_PHONE_NUMBER!

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To:   formattedPhone,
          From: twilioFrom,
          Body: smsBody,
        }),
      }
    )

    const twilioData = await twilioRes.json()

    if (!twilioRes.ok || twilioData.error_code) {
      console.error('Twilio error:', twilioData)
      return NextResponse.json({
        error: `SMS failed: ${twilioData.message || 'Unknown error'}`,
      }, { status: 500 })
    }

    // Update send_log with Twilio SID
    await supabase.from('send_log')
      .update({ twilio_sid: twilioData.sid, sent_at: new Date().toISOString() })
      .eq('token', token)
      .order('created_at', { ascending: false })
      .limit(1)

    return NextResponse.json({ success: true, token, guestUrl })

  } catch (err) {
    console.error('Send error:', err)
    return NextResponse.json({ error: 'Unexpected error. Please try again.' }, { status: 500 })
  }
}
