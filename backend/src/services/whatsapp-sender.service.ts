import twilio from 'twilio';
import { env } from '../lib/env';
import { logger } from '../lib/logger';

let client: twilio.Twilio | null = null;

function getClient(): twilio.Twilio | null {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) {
    return null;
  }
  if (!client) {
    client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

/** True when outbound WhatsApp is configured (credentials + from number). */
export function isWhatsAppSenderConfigured(): boolean {
  return getClient() !== null;
}

/**
 * Send a proactive (business-initiated) WhatsApp message. `toE164` is a bare
 * E.164 number (e.g. "+14155551234"); the `whatsapp:` prefix is added here.
 */
export async function sendWhatsAppMessage(toE164: string, body: string): Promise<boolean> {
  const c = getClient();
  if (!c) {
    logger.warn('Skipping WhatsApp send: Twilio is not configured');
    return false;
  }
  try {
    await c.messages.create({
      from: `whatsapp:${env.TWILIO_WHATSAPP_FROM!.replace(/^whatsapp:/, '')}`,
      to: `whatsapp:${toE164}`,
      body,
    });
    return true;
  } catch (err) {
    logger.error({ err, to: toE164 }, 'Failed to send WhatsApp message');
    return false;
  }
}
