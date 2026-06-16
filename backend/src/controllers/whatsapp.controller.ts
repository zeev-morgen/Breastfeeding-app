import type { RequestHandler } from 'express';
import twilio from 'twilio';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { parseWhatsAppMessage } from '../services/claude.service';
import { buildGuidance } from '../services/guidance.service';
import { dynamicIntervalForUser } from '../services/interval.service';
import {
  HELP_MESSAGE,
  LOW_CONFIDENCE_MESSAGE,
  UNKNOWN_MESSAGE,
  formatLoggedConfirmation,
  formatStatusMessage,
} from '../services/whatsapp.service';

const MIN_LOG_CONFIDENCE = 0.5;

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

export const whatsappWebhook: RequestHandler = async (req, res) => {
  if (!verifyTwilioSignature(req)) {
    logger.warn('Rejected WhatsApp webhook: invalid signature');
    res.status(403).send('Forbidden');
    return;
  }

  const body = (req.body ?? {}) as Record<string, string>;
  const phone = normalizePhone(body.From);
  const text = (body.Body ?? '').toString();

  if (!phone) {
    sendTwiml(res, 'Could not identify your phone number.');
    return;
  }

  const user = await prisma.user.findUnique({ where: { phoneE164: phone } });
  if (!user) {
    sendTwiml(
      res,
      '👋 Welcome to LactaSync! Your number is not linked yet. Sign up in the app and link this phone in Settings.',
    );
    return;
  }

  const intervalHours = user.feedingIntervalHours ?? env.FEEDING_INTERVAL_HOURS;
  const parsed = await parseWhatsAppMessage(text);

  switch (parsed.intent) {
    case 'HELP':
      sendTwiml(res, HELP_MESSAGE);
      return;

    case 'STATUS': {
      const latest = await prisma.feedingLog.findFirst({
        where: { userId: user.id },
        orderBy: { startTime: 'desc' },
      });
      const interval = await dynamicIntervalForUser(user.id, intervalHours);
      sendTwiml(res, formatStatusMessage(latest, buildGuidance(latest, interval)));
      return;
    }

    case 'LOG_FEEDING': {
      // Need at least side + duration to record a usable session.
      if (parsed.side == null || parsed.durationMin == null || parsed.confidence < MIN_LOG_CONFIDENCE) {
        sendTwiml(res, LOW_CONFIDENCE_MESSAGE(parsed));
        return;
      }
      const startTime = new Date();
      const log = await prisma.feedingLog.create({
        data: {
          userId: user.id,
          side: parsed.side,
          durationMin: parsed.durationMin,
          qualityScore: parsed.qualityScore ?? 3,
          startTime,
          endTime: new Date(startTime.getTime() + parsed.durationMin * 60_000),
          notes: parsed.notes,
          source: 'WHATSAPP',
          rawMessage: text,
        },
      });
      // Count includes the feeding we just logged, so the next interval reflects it.
      const interval = await dynamicIntervalForUser(user.id, intervalHours);
      sendTwiml(res, formatLoggedConfirmation(log, buildGuidance(log, interval)));
      return;
    }

    case 'UNKNOWN':
    default:
      sendTwiml(res, UNKNOWN_MESSAGE);
      return;
  }
};
