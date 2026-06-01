export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const REDIRECT_EMAIL = process.env.REDIRECT_EMAIL;

  if (!RESEND_API_KEY) return res.status(500).json({ error: 'RESEND_API_KEY not set' });
  if (!REDIRECT_EMAIL) return res.status(500).json({ error: 'REDIRECT_EMAIL not set' });

  const { title, message, recipientName, recipientRole, notificationType, actionUrl } = req.body;

  const typeLabels = {
    goal_submitted: { emoji: '📋', label: 'Goal Submitted', color: '#3b82f6' },
    goal_approved: { emoji: '✅', label: 'Approved', color: '#22c55e' },
    goal_rejected: { emoji: '🔄', label: 'Returned for Rework', color: '#f59e0b' },
    checkin_reminder: { emoji: '⏰', label: 'Reminder', color: '#8b5cf6' },
    escalation: { emoji: '⚠️', label: 'Escalation', color: '#ef4444' },
    system: { emoji: 'ℹ️', label: 'System', color: '#6b7280' },
  };
  const t = typeLabels[notificationType] || typeLabels.system;
  const portalUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : (process.env.PORTAL_URL || 'http://localhost:5173');

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:24px 32px;text-align:center;">
      <h1 style="color:#fbbf24;font-size:22px;margin:0;letter-spacing:-0.5px;">⚛ AtomQuest</h1>
      <p style="color:#94a3b8;font-size:11px;margin:4px 0 0;text-transform:uppercase;letter-spacing:1px;">Performance Management Portal</p>
    </div>
    <div style="padding:28px 32px;">
      <div style="background:#f8fafc;border-left:4px solid #fbbf24;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:20px;">
        <p style="color:#64748b;font-size:11px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Intended Recipient</p>
        <p style="color:#1e293b;font-weight:600;font-size:15px;margin:0;">${recipientName || 'User'} <span style="color:#64748b;font-weight:400;font-size:12px;">(${recipientRole || 'employee'})</span></p>
      </div>
      <div style="margin-bottom:20px;">
        <span style="display:inline-block;background:${t.color}15;color:${t.color};font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;border:1px solid ${t.color}30;">${t.emoji} ${t.label}</span>
      </div>
      <h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;font-weight:700;">${title}</h2>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px;">${message}</p>
      ${actionUrl ? `<a href="${portalUrl}${actionUrl}" style="display:inline-block;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1a1a2e;font-weight:600;font-size:13px;padding:10px 24px;border-radius:6px;text-decoration:none;">View in Portal →</a>` : ''}
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="color:#94a3b8;font-size:11px;margin:0;">This is an automated notification from AtomQuest Portal.</p>
      <p style="color:#cbd5e1;font-size:10px;margin:4px 0 0;">All demo emails are redirected to a single inbox for demonstration purposes.</p>
    </div>
  </div>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'AtomQuest Portal <onboarding@resend.dev>',
        to: [REDIRECT_EMAIL],
        subject: `${t.emoji} [AtomQuest] ${title}`,
        html,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Resend API error');
    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(500).json({ error: err.message });
  }
}
