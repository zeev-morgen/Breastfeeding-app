import type { RequestHandler } from 'express';
import twilio from 'twilio';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { parseWhatsAppMessage } from '../services/claude.service';
import { buildGuidance } from '../services/guidance.service';
import { dynamicIntervalForUser } from '../services/interval.service';
import { isWhatsAppSenderConfigured, sendWhatsAppMessage } from '../services/whatsapp-sender.service';
import {
  classifyYesNo,
  clearPendingNightConsent,
  peekPendingNightConsent,
} from '../services/feeding-reminder.service';
import {
  HELP_MESSAGE,
  LOW_CONFIDENCE_MESSAGE,
  NIGHT_CONSENT_NO_MESSAGE,
  UNKNOWN_MESSAGE,
  formatFeedingReminder,
  formatLoggedConfirmation,
  formatStatusMessage,
} from '../services/whatsapp.service';

const MIN_LOG_CONFIDENCE = 0.5;

// Defaults used when a WhatsApp report omits duration / quality, mirroring the
// app's Quick Log defaults so a minimal message like "הנקתי שמאל" still logs.
const DEFAULT_DURATION_MIN = 15;
const DEFAULT_QUALITY_SCORE = 4;

function twiml(message: string): string {
  // Build TwiML manually — keeps the dependency surface tiny and avoids a side-effect import.
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

function sendTwiml(res: Parameters<RequestHandler>[1], message: string) {
  res.type('text/xml').status(200).send(twiml(message));
}

// Empty TwiML — acknowledges the webhook without sending an inline reply (we
// reply out-of-band via the REST API instead).
const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

/**
 * Twilio sends an `X-Twilio-Signature` header. We validate it against the full
 * request URL + raw form params to prevent webhook spoofing.
 */
function verifyTwilioSignature(req: Parameters<RequestHandler>[0]): boolean {
  if (!env.TWILIO_VALIDATE_SIGNATURE) return true;
  const authToken = env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;

  const signature = req.header('X-Twilio-Signature');
  if (!signature) return false;

  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const url = env.PUBLIC_BASE_URL
    ? `${env.PUBLIC_BASE_URL.replace(/\/$/, '')}${req.originalUrl}`
    : `${proto}://${host}${req.originalUrl}`;

  return twilio.validateRequest(authToken, signature, url, req.body as Record<string, string>);
}

function normalizePhone(from: string | undefined): string | null {
  if (!from) return null;
  // Twilio sends "whatsapp:+14155551234"
  const m = /^(?:whatsapp:)?(\+\d{7,15})$/.exec(from.trim());
  return m ? m[1]! : null;
}

/**
 * Compute the reply text for an inbound message. Pure of transport concerns so
 * it can be used both for the inline TwiML path and the async REST path.
 */
async function buildReply(phone: string | null, text: string): Promise<string> {
  if (!phone) return 'לא הצלחנו לזהות את מספר הטלפון שלך.';

  const user = await prisma.user.findUnique({ where: { phoneE164: phone } });
  if (!user) {
    return '👋 ברוכה הבאה ל-LactaSync! המספר שלך עדיין לא מקושר. הירשמי באפליקציה וקשרי את הטלפון הזה בהגדרות.';
  }

  // Answer to a pending night-time reminder consent prompt takes priority and
  // skips the LLM entirely (fast, deterministic).
  const pending = peekPendingNightConsent(phone);
  if (pending) {
    const answer = classifyYesNo(text);
    if (answer === 'yes') {
      clearPendingNightConsent(phone);
      return formatFeedingReminder(pending.side);
    }
    if (answer === 'no') {
      clearPendingNightConsent(phone);
      return NIGHT_CONSENT_NO_MESSAGE;
    }
    // Unrecognized reply → fall through to normal handling, leave prompt pending.
  }

  const intervalHours = user.feedingIntervalHours ?? env.FEEDING_INTERVAL_HOURS;
  const parsed = await parseWhatsAppMessage(text);

  switch (parsed.intent) {
    case 'HELP':
      return HELP_MESSAGE;

    case 'STATUS': {
      const latest = await prisma.feedingLog.findFirst({
        where: { userId: user.id },
        orderBy: { startTime: 'desc' },
      });
      const interval = await dynamicIntervalForUser(user.id, intervalHours);
      return formatStatusMessage(latest, buildGuidance(latest, interval));
    }

    case 'LOG_FEEDING': {
      // Side is the only thing we truly need; duration & quality fall back to
      // sensible defaults so a minimal report still records a session.
      if (parsed.side == null || parsed.confidence < MIN_LOG_CONFIDENCE) {
        return LOW_CONFIDENCE_MESSAGE(parsed);
      }
      const durationMin = parsed.durationMin ?? DEFAULT_DURATION_MIN;
      const qualityScore = parsed.qualityScore ?? DEFAULT_QUALITY_SCORE;
      // Honor a relative time like "לפני 15 דק"; default to now when unstated.
      const startedMinutesAgo = parsed.startedMinutesAgo ?? 0;
      const startTime = new Date(Date.now() - startedMinutesAgo * 60_000);
      const log = await prisma.feedingLog.create({
        data: {
          userId: user.id,
          side: parsed.side,
          durationMin,
          qualityScore,
          startTime,
          endTime: new Date(startTime.getTime() + durationMin * 60_000),
          notes: parsed.notes,
          source: 'WHATSAPP',
          rawMessage: text,
        },
      });
      // Count includes the feeding we just logged, so the next interval reflects it.
      const interval = await dynamicIntervalForUser(user.id, intervalHours);
      return formatLoggedConfirmation(log, buildGuidance(log, interval));
    }

    case 'UNKNOWN':
    default:
      return UNKNOWN_MESSAGE;
  }
}

export const whatsappWebhook: RequestHandler = async (req, res) => {
  if (!verifyTwilioSignature(req)) {
    logger.warn('Rejected WhatsApp webhook: invalid signature');
    res.status(403).send('Forbidden');
    return;
  }

  const body = (req.body ?? {}) as Record<string, string>;
  const phone = normalizePhone(body.From);
  const text = (body.Body ?? '').toString();

  // Preferred path: ACK Twilio instantly and reply out-of-band via REST. This
  // decouples the reply from the (slow) LLM call, so a long parse can never
  // exceed Twilio's webhook timeout and drop / delay the confirmation.
  if (isWhatsAppSenderConfigured() && phone) {
    res.type('text/xml').status(200).send(EMPTY_TWIML);
    void buildReply(phone, text)
      .then((reply) => sendWhatsAppMessage(phone, reply))
      .catch((err) => logger.error({ err, phone }, 'Async WhatsApp handling failed'));
    return;
  }

  // Fallback (no outbound credentials, e.g. local dev): reply inline via TwiML.
  sendTwiml(res, await buildReply(phone, text));
};
