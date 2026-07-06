import twilio from 'twilio';

// Loaded from environment variables (set in .env or your hosting platform)
const {
  TWILIO_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
} = process.env;

const client = (TWILIO_SID && TWILIO_AUTH_TOKEN)
  ? twilio(TWILIO_SID, TWILIO_AUTH_TOKEN)
  : null;

if (!client) {
  console.warn('[notify] TWILIO credentials not set — running in mock mode. SMS will NOT be sent.');
}

/**
 * Send an SMS alert to one contact.
 * Falls back to console.log if Twilio is not configured.
 */
export async function notifyContact(contact, alert) {
  const mapsUrl = `https://www.google.com/maps?q=${alert.lat},${alert.lng}`;
  const triggeredAt = new Date(alert.time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const message =
    `RakshaLink ALERT: Someone in your trusted circle may need help.\n` +
    `Loc: ${mapsUrl}\n` +
    `Time: ${triggeredAt}\n` +
    `Reply SAFE once confirmed okay.`;

  if (client) {
    try {
      const result = await client.messages.create({
        to: contact.phone,
        from: TWILIO_FROM_NUMBER,
        body: message,
      });
      console.log(`[notify:sms] ✓ Sent to ${contact.name} (${contact.phone}) — SID: ${result.sid}`);
      return { contactId: contact.id, channel: 'sms', sid: result.sid, sentAt: new Date().toISOString(), status: 'sent' };
    } catch (err) {
      console.error(`[notify:sms] ✗ Failed for ${contact.name} (${contact.phone}):`, err.message);
      return { contactId: contact.id, channel: 'sms', sentAt: new Date().toISOString(), status: 'failed', error: err.message };
    }
  } else {
    // Mock mode — log what would be sent
    console.log(`[notify:mock] Would SMS ${contact.name} at ${contact.phone}:\n${message}\n`);
    return { contactId: contact.id, channel: 'mock', sentAt: new Date().toISOString(), status: 'mock' };
  }
}

/**
 * Dispatch an alert to ALL contacts in parallel.
 * Returns array of results (one per contact).
 */
export async function dispatchAlert(contacts, alert) {
  if (!contacts.length) {
    console.warn('[notify] No contacts to notify.');
    return [];
  }
  const results = await Promise.all(contacts.map((c) => notifyContact(c, alert)));
  const sent = results.filter((r) => r.status === 'sent').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  console.log(`[notify] Dispatch complete — ${sent} sent, ${failed} failed, ${results.length - sent - failed} mock`);
  return results;
}
