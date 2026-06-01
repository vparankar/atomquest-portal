/**
 * Email notification service — calls the Vercel API route to send emails via Resend.
 * Fire-and-forget: failures are logged but never block the UI.
 */
export async function sendNotificationEmail(params: {
  title: string;
  message: string;
  recipientName: string;
  recipientRole: string;
  notificationType: string;
  actionUrl?: string;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('Email API error:', err);
      return false;
    }
    return true;
  } catch (err) {
    // Expected to fail in local dev (no API route). Silent in production.
    console.warn('Email notification skipped (non-blocking):', err);
    return false;
  }
}
