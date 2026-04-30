import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { template, propertyId, roomId, language, phone, email, sendVia } = await req.json()

    if (!propertyId) return NextResponse.json({ error: 'Property is required.' }, { status: 400 })
    if (!roomId) return NextResponse.json({ error: 'Room is required.' }, { status: 400 })

    if (sendVia === 'email') {
      if (!email || !email.includes('@')) {
        return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
      }
    } else {
      if (!phone || phone.trim().length < 7) {
        return NextResponse.json({ error: 'A valid phone number is required.' }, { status: 400 })
      }
    }

    // Build guest page token and URL
    const pageToken = crypto.randomUUID()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.ivrly.com'
    const guestUrl = `${appUrl}/g/${pageToken}?lang=${language}`

    // Log to send_log
    await supabase.from('send_log').insert({
      property_id: propertyId,
      room_id: roomId,
      template_type: template,
      language,
      guest_phone: sendVia === 'sms' ? phone?.trim() : null,
      guest_email: sendVia === 'email' ? email?.trim() : null,
      page_token: pageToken,
      page_url: guestUrl,
      delivery_status: 'pending',
    })

    // ── Email send ─────────────────────────────────────────────────────────
    if (sendVia === 'email') {
      const isCheckin = template === 'checkin'
      const subject = isCheckin ? 'Your check-in instructions are ready' : 'Your room information is ready'
      const heading = subject

      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 18px; font-weight: 700; color: #111827;">Arrivio</span>
          </div>
          <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 12px;">${heading}</h1>
          <p style="font-size: 15px; color: #6B7280; margin: 0 0 28px; line-height: 1.6;">
            Your host has prepared everything you need. Click the button below to view your personalised guest page.
          </p>
          <a href="${guestUrl}" style="display: inline-block; background: #4F46E5; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600;">
            View your guest page →
          </a>
          <p style="font-size: 13px; color: #9CA3AF; margin-top: 32px;">
            Or copy this link: <a href="${guestUrl}" style="color: #4F46E5;">${guestUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0;" />
          <p style="font-size: 12px; color: #9CA3AF; margin: 0;">Sent via Arrivio by Ivrly</p>
        </div>
      `

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Arrivio <hello@mail.ivrly.com>',
          to: [email.trim()],
          subject,
          html: emailHtml,
        }),
      })

      if (!resendRes.ok) {
        const err = await resendRes.json()
        console.error('Resend error:', err)
        return NextResponse.json({ error: `Email failed: ${err.message || 'Unknown error'}` }, { status: 500 })
      }

      await supabase.from('send_log')
        .update({ delivery_status: 'sent' })
        .eq('page_token', pageToken)

      return NextResponse.json({ success: true, token: pageToken, guestUrl })
    }

    // ── SMS send ───────────────────────────────────────────────────────────
    let formattedPhone = phone.trim().replace(/[\s\-\(\)]/g, '')
    if (!formattedPhone.startsWith('+')) formattedPhone = '+' + formattedPhone

    const isCheckin = template === 'checkin'
    const templateLabel = isCheckin ? 'check-in instructions' : 'room information'
    const smsBody = [
      `Your ${templateLabel} are ready:`,
      ``,
      guestUrl,
      ``,
      `Reply STOP to opt out. Msg & data rates may apply.`,
    ].join('\n')

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

    await supabase.from('send_log')
      .update({ delivery_status: 'sent' })
      .eq('page_token', pageToken)

    return NextResponse.json({ success: true, token: pageToken, guestUrl })

  } catch (err) {
    console.error('Send error:', err)
    return NextResponse.json({ error: 'Unexpected error. Please try again.' }, { status: 500 })
  }
}
