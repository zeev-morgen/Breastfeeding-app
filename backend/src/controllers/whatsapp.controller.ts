import type { RequestHandler } from 'express';
import twilio from 'twilio';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { parseWhatsAppMessage } from '../services/claude.service';
import { buildGuidance } from '../services/guidance.service';
import {
  HELP_MESSAGE,
  LOW_CONFIDENCE_MESSAGE,
  UNKNOWN_MESSAGE,
  formatDeletedConfirmation,
  formatLoggedConfirmation,
  formatStatusMessage,
  formatUpdatedConfirmation,
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
      sendTwiml(res, formatStatusMessage(latest, buildGuidance(latest, intervalHours)));
      return;
    }

    case 'LOG_FEEDING': {
      // Duration is OPTIONAL — the app no longer surfaces it, so the bot
      // mirrors that behaviour: a log without duration is still valid and
      // simply stored as 0. We only refuse when the side or the intent
      // itself is uncertain.
      if (parsed.side == null || parsed.confidence < MIN_LOG_CONFIDENCE) {
        sendTwiml(res, LOW_CONFIDENCE_MESSAGE(parsed));
        return;
      }
      const startTime = new Date();
      const durationMin = parsed.durationMin ?? 0;
      const log = await prisma.feedingLog.create({
        data: {
          userId: user.id,
          side: parsed.side,
          durationMin,
          qualityScore: parsed.qualityScore ?? 4,
          startTime,
          endTime: durationMin > 0 ? new Date(startTime.getTime() + durationMin * 60_000) : null,
          notes: parsed.notes,
          source: 'WHATSAPP',
          rawMessage: text,
        },
      });
      sendTwiml(res, formatLoggedConfirmation(log, buildGuidance(log, intervalHours)));
      return;
    }

    case 'UPDATE_LAST': {
      const latest = await prisma.feedingLog.findFirst({
        where: { userId: user.id },
        orderBy: { startTime: 'desc' },
      });
      if (!latest) {
        sendTwiml(res, 'אין הנקה לעדכן עדיין.');
        return;
      }
      // Only touch fields the user actually mentioned; everything else
      // stays as-is so a quick "תשני לימין" doesn't reset the quality.
      const updated = await prisma.feedingLog.update({
        where: { id: latest.id },
        data: {
          ...(parsed.side != null ? { side: parsed.side } : {}),
          ...(parsed.qualityScore != null ? { qualityScore: parsed.qualityScore } : {}),
          ...(parsed.durationMin != null
            ? {
                durationMin: parsed.durationMin,
                endTime:
                  parsed.durationMin > 0
                    ? new Date(latest.startTime.getTime() + parsed.durationMin * 60_000)
                    : null,
              }
            : {}),
          ...(parsed.notes != null ? { notes: parsed.notes } : {}),
        },
      });
      sendTwiml(res, formatUpdatedConfirmation(updated));
      return;
    }

    case 'DELETE_LAST': {
      const latest = await prisma.feedingLog.findFirst({
        where: { userId: user.id },
        orderBy: { startTime: 'desc' },
      });
      if (!latest) {
        sendTwiml(res, 'אין הנקה למחיקה.');
        return;
      }
      await prisma.feedingLog.delete({ where: { id: latest.id } });
      sendTwiml(res, formatDeletedConfirmation(latest));
      return;
    }

    case 'UNKNOWN':
    default:
      // Prefer a Claude-authored, contextual reply when available; fall back
      // to the static template only if the model didn't supply one.
      sendTwiml(res, parsed.reply && parsed.reply.length > 0 ? parsed.reply : UNKNOWN_MESSAGE);
      return;
  }
};
