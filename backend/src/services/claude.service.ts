import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { env } from '../lib/env';
import { logger } from '../lib/logger';

/**
 * Structured shape extracted from free-text WhatsApp messages.
 * `intent` lets us route status/help/update/delete queries without a
 * separate NLU pass. `reply` is an optional natural-language response the
 * model may suggest (used when the intent is conversational/unknown so the
 * bot doesn't fall back to a generic "didn't understand" template).
 */
export const ParsedMessageSchema = z.object({
  intent: z.enum([
    'LOG_FEEDING',
    'UPDATE_LAST',
    'DELETE_LAST',
    'STATUS',
    'HELP',
    'UNKNOWN',
  ]),
  side: z.enum(['LEFT', 'RIGHT', 'BOTH']).nullable(),
  durationMin: z.number().int().min(0).max(180).nullable(),
  qualityScore: z.number().int().min(1).max(5).nullable(),
  notes: z.string().max(500).nullable(),
  // Confidence in the extraction (0-1). Below 0.5 we ask the user to confirm.
  confidence: z.number().min(0).max(1),
  // Optional natural-language reply the model writes when the intent is
  // UNKNOWN / conversational and a friendly contextual response is helpful.
  reply: z.string().max(400).nullable().optional(),
});

export type ParsedMessage = z.infer<typeof ParsedMessageSchema>;

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are LactaSync's message parser. You convert messy, multilingual breastfeeding messages into strict JSON. The primary language is Hebrew; users may also write in English.

OUTPUT CONTRACT — return ONLY a single JSON object, no prose, no markdown, no code fences:
{
  "intent": "LOG_FEEDING" | "UPDATE_LAST" | "DELETE_LAST" | "STATUS" | "HELP" | "UNKNOWN",
  "side": "LEFT" | "RIGHT" | "BOTH" | null,
  "durationMin": integer 0..180 or null,
  "qualityScore": integer 1..5 or null,
  "notes": string up to 500 chars or null,
  "confidence": number 0..1,
  "reply": string up to 400 chars or null
}

INTENT RULES
- LOG_FEEDING: user describes a NEW feeding session (e.g. "הנקתי 20 דקות שמאל", "15 min on the right").
- UPDATE_LAST: user wants to correct or amend the MOST RECENT feeding ("תעדכן את האחרונה ל-25 דקות", "תשני את הצד של ההנקה הקודמת", "actually the last one was right side, not left", "תקני איכות 5"). Use this intent whenever the message references "האחרונה / האחרון / הקודמת / the last / change / update / actually" together with feeding fields.
- DELETE_LAST: user wants to remove the most recent feeding ("תמחק את האחרונה", "ביטול ההנקה", "delete last", "תוריד את הרישום").
- STATUS: user asks for last session, next time, "status", "מה המצב", "next?", "when", "כמה זמן עבר".
- HELP: user explicitly asks how to use the bot ("עזרה", "help", "מה אפשר לעשות").
- UNKNOWN: anything else (small talk, off-topic, unrelated questions). In this case populate "reply" with a SHORT (≤80 chars) friendly Hebrew response that gently steers the user toward the bot's actual capabilities. Do not invent extra fields.

EXTRACTION RULES
- side: map "left/L/שמאל/שמאלי" → LEFT, "right/R/ימין/ימני" → RIGHT, "both/שניהם/שני הצדדים" → BOTH. Otherwise null.
- durationMin: parse "15 mins", "for an hour" (=60), "20m", "רבע שעה" (=15), "חצי שעה" (=30). Round to integer minutes. Cap at 180. Null if not stated — duration is OPTIONAL and the system accepts logs without it, so do NOT lower confidence just because duration is missing.
- qualityScore (1=very poor, 5=excellent):
    * "fussy / cried / refused / painful / shallow latch / לא רגוע / כאב" → 2
    * "very fussy / barely fed / awful" → 1
    * "ok / fine / סבבה" → 3
    * "good / nursed well / calm / טוב / רגוע" → 4
    * "great / amazing / perfect / deep latch / מצוין / מושלם" → 5
    * If the message is purely factual with no quality signal, return null.
- notes: a short factual snippet (<=120 chars) capturing anything not in the structured fields (e.g. "נרדמה בסוף", "spit up after"). Otherwise null.
- confidence: your honest 0..1 confidence in the EXTRACTION (not in the intent). Missing-but-optional duration should NOT reduce confidence. Use <0.5 only when the side, action, or intent itself is genuinely ambiguous.
- reply: only populated for UNKNOWN intent. Keep it warm and short in Hebrew, e.g. "אני עוזר עם תיעוד הנקות. אפשר לכתוב משהו כמו '20 דקות שמאל'."

HARD RULES
- NEVER invent values. If unsure, use null and lower confidence.
- For UPDATE_LAST / DELETE_LAST: still extract any fields the user mentioned (side/duration/quality/notes) so the server knows WHAT to change.
- NEVER include keys other than the seven above.
- NEVER wrap JSON in markdown or commentary.
- If the message is empty or pure greeting, intent=UNKNOWN, reply="היי 🌸 אני בוט הנקה. ספרי לי על הנקה ואני ארשום (לדוגמה: 'הנקתי 20 דקות שמאל').", everything else null, confidence<=0.3.

EXAMPLES
Input: "הנקתי שמאל אחיזה רגועה"
Output: {"intent":"LOG_FEEDING","side":"LEFT","durationMin":null,"qualityScore":4,"notes":null,"confidence":0.9,"reply":null}

Input: "Just finished 15 mins on the left, she was very fussy"
Output: {"intent":"LOG_FEEDING","side":"LEFT","durationMin":15,"qualityScore":2,"notes":"baby was fussy","confidence":0.9,"reply":null}

Input: "תעדכן את האחרונה ל-30 דקות"
Output: {"intent":"UPDATE_LAST","side":null,"durationMin":30,"qualityScore":null,"notes":null,"confidence":0.95,"reply":null}

Input: "actually the last one was right, not left"
Output: {"intent":"UPDATE_LAST","side":"RIGHT","durationMin":null,"qualityScore":null,"notes":null,"confidence":0.92,"reply":null}

Input: "תמחק את ההנקה האחרונה"
Output: {"intent":"DELETE_LAST","side":null,"durationMin":null,"qualityScore":null,"notes":null,"confidence":0.98,"reply":null}

Input: "status"
Output: {"intent":"STATUS","side":null,"durationMin":null,"qualityScore":null,"notes":null,"confidence":0.99,"reply":null}

Input: "האכלתי 20 דקות ימין, יניקה מצוינת"
Output: {"intent":"LOG_FEEDING","side":"RIGHT","durationMin":20,"qualityScore":5,"notes":null,"confidence":0.92,"reply":null}

Input: "hey"
Output: {"intent":"UNKNOWN","side":null,"durationMin":null,"qualityScore":null,"notes":null,"confidence":0.2,"reply":"היי 🌸 אני בוט הנקה. כתבי לי משהו כמו '20 דקות שמאל' או 'סטטוס'."}`;

/**
 * Extracts the first JSON object from a string. Tolerates accidental fences
 * or stray text even though the system prompt forbids them.
 */
function extractFirstJsonObject(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, '').trim();
  const start = stripped.indexOf('{');
  if (start === -1) throw new Error('No JSON object found');
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i]!;
    if (inStr) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return JSON.parse(stripped.slice(start, i + 1));
    }
  }
  throw new Error('Unbalanced JSON in model output');
}

const FALLBACK: ParsedMessage = {
  intent: 'UNKNOWN',
  side: null,
  durationMin: null,
  qualityScore: null,
  notes: null,
  confidence: 0,
};

export async function parseWhatsAppMessage(text: string): Promise<ParsedMessage> {
  const trimmed = text.trim();
  if (!trimmed) return FALLBACK;

  // Cheap deterministic shortcuts before paying for an LLM call.
  const lc = trimmed.toLowerCase();
  if (/^(status|סטטוס|מצב|next\??)$/.test(lc)) {
    return { ...FALLBACK, intent: 'STATUS', confidence: 1 };
  }
  if (/^(help|עזרה|\/help|\?)$/.test(lc)) {
    return { ...FALLBACK, intent: 'HELP', confidence: 1 };
  }

  try {
    const response = await anthropic.messages.create({
      model: env.CLAUDE_MODEL,
      max_tokens: 300,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: trimmed }],
    });

    // Type-narrow loosely so we don't depend on a specific Anthropic SDK type export.
    const textBlock = response.content.find(
      (b): b is { type: 'text'; text: string } =>
        (b as { type?: string }).type === 'text' && typeof (b as { text?: unknown }).text === 'string',
    );
    if (!textBlock) throw new Error('No text block in Claude response');

    const raw = extractFirstJsonObject(textBlock.text);
    const parsed = ParsedMessageSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn({ raw, issues: parsed.error.flatten() }, 'Claude returned invalid shape');
      return FALLBACK;
    }
    return parsed.data;
  } catch (err) {
    logger.error({ err }, 'Claude parsing failed');
    return FALLBACK;
  }
}
