import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { env } from '../lib/env';
import { logger } from '../lib/logger';

/**
 * Structured shape extracted from free-text WhatsApp messages.
 * `intent` lets us route status/help queries without a separate NLU pass.
 */
export const ParsedMessageSchema = z.object({
  intent: z.enum(['LOG_FEEDING', 'STATUS', 'HELP', 'UNKNOWN']),
  side: z.enum(['LEFT', 'RIGHT', 'BOTH']).nullable(),
  durationMin: z.number().int().min(0).max(180).nullable(),
  qualityScore: z.number().int().min(1).max(5).nullable(),
  notes: z.string().max(500).nullable(),
  // Confidence in the extraction (0-1). Below 0.5 we ask the user to confirm.
  confidence: z.number().min(0).max(1),
});

export type ParsedMessage = z.infer<typeof ParsedMessageSchema>;

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are LactaSync's message parser. You convert messy, multilingual breastfeeding messages into strict JSON.

OUTPUT CONTRACT — return ONLY a single JSON object, no prose, no markdown, no code fences:
{
  "intent": "LOG_FEEDING" | "STATUS" | "HELP" | "UNKNOWN",
  "side": "LEFT" | "RIGHT" | "BOTH" | null,
  "durationMin": integer 0..180 or null,
  "qualityScore": integer 1..5 or null,
  "notes": string up to 500 chars or null,
  "confidence": number 0..1
}

INTENT RULES
- LOG_FEEDING: user describes a finished/ongoing feeding session (mentions duration, side, latch, baby's behavior, etc.)
- STATUS: user asks for last session, next time, "status", "מה המצב", "next?", "when", "כמה זמן עבר"
- HELP: user asks how to use the bot, commands, "help", "עזרה"
- UNKNOWN: anything else (e.g. small talk, off-topic)

EXTRACTION RULES
- side: map "left/L/שמאל" → LEFT, "right/R/ימין" → RIGHT, "both/שניהם/two sides" → BOTH. Otherwise null.
- durationMin: parse "15 mins", "for an hour" (=60), "20m", "רבע שעה" (=15), "חצי שעה" (=30). Round to integer minutes. Cap at 180. Null if not stated.
- qualityScore (1=very poor, 5=excellent):
    * "fussy / cried / refused / painful / shallow latch / לא רגוע / כאב" → 2
    * "very fussy / kept pulling off / barely fed / bad" → 1
    * "ok / fine / סבבה" → 3
    * "good / nursed well / calm / טוב" → 4
    * "great / amazing / perfect / deep latch / מצוין" → 5
    * If the message is purely factual with no quality signal, return null.
- notes: a short factual snippet (<=120 chars) capturing anything not in the structured fields (e.g. "fell asleep at the end"). Otherwise null.
- confidence: your honest 0..1 confidence in the extraction. Use <0.5 when the message is ambiguous.

HARD RULES
- NEVER invent values. If unsure, use null and lower confidence.
- NEVER include keys other than the six above.
- NEVER wrap JSON in markdown or commentary.
- If the message is empty or pure greeting, return intent=UNKNOWN with all fields null and confidence<=0.3.

EXAMPLES
Input: "Just finished 15 mins on the left, she was very fussy"
Output: {"intent":"LOG_FEEDING","side":"LEFT","durationMin":15,"qualityScore":2,"notes":"baby was fussy","confidence":0.9}

Input: "status"
Output: {"intent":"STATUS","side":null,"durationMin":null,"qualityScore":null,"notes":null,"confidence":0.99}

Input: "האכלתי 20 דקות ימין, יניקה מצוינת"
Output: {"intent":"LOG_FEEDING","side":"RIGHT","durationMin":20,"qualityScore":5,"notes":null,"confidence":0.92}

Input: "hey"
Output: {"intent":"UNKNOWN","side":null,"durationMin":null,"qualityScore":null,"notes":null,"confidence":0.2}`;

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
