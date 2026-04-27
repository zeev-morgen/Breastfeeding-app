# LactaSync

**Zero-friction breastfeeding tracker** — React Native mobile app + WhatsApp AI bot, both syncing to one PostgreSQL database in real time.

```
┌────────────────┐        ┌──────────────────────┐        ┌──────────────────┐
│ React Native   │  HTTPS │ Node.js / Express    │  SQL   │  PostgreSQL      │
│ (Expo) + RN-W  │ ─────▶ │ TypeScript + Prisma  │ ─────▶ │  feeding_logs    │
└────────────────┘        │                      │        └──────────────────┘
                          │  /api/auth/*         │
┌────────────────┐ Twilio │  /api/logs/*         │  Claude Sonnet (parser)
│ WhatsApp user  │ ─────▶ │  /webhook/whatsapp   │ ─────▶ structured JSON
└────────────────┘        └──────────────────────┘
```

## Repository layout

```
backend/   Node.js (TypeScript) + Express + Prisma + Anthropic + Twilio
mobile/    React Native (Expo) + NativeWind (Tailwind) + expo-router
```

## Backend

### Stack
- Node.js 20 + Express 4 (TypeScript, strict)
- Prisma ORM → PostgreSQL
- Anthropic SDK (`claude-sonnet-4-6` by default) for parsing free-text WhatsApp messages
- Twilio WhatsApp inbound webhook with signature validation
- JWT auth, bcrypt password hashing, Helmet, Zod validation

### Run
```bash
cd backend
cp .env.example .env          # fill in DATABASE_URL, JWT_SECRET (>=32 chars), ANTHROPIC_API_KEY, TWILIO_*
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

### REST API

| Method | Path                  | Auth | Description                             |
|--------|-----------------------|------|-----------------------------------------|
| POST   | `/api/auth/register`  | -    | Email + password (+ optional phone)     |
| POST   | `/api/auth/login`     | -    | Returns JWT                             |
| GET    | `/api/auth/me`        | JWT  | Current user                            |
| POST   | `/api/auth/link-phone`| JWT  | Link E.164 phone for WhatsApp matching  |
| POST   | `/api/logs`           | JWT  | Create a feeding log                    |
| GET    | `/api/logs`           | JWT  | List recent logs                        |
| GET    | `/api/logs/latest`    | JWT  | Latest log + guidance (next side/time/tip) |
| POST   | `/webhook/whatsapp`   | Twilio sig | Inbound WhatsApp message            |

### Database (Prisma)
Both tables live in `backend/prisma/schema.prisma`:

- `users (id, email, password_hash, phone_e164 unique, display_name, feeding_interval_hours)`
- `feeding_logs (id, user_id, side, quality_score, duration_min, start_time, end_time, notes, source, raw_message)`

Hot-path indexes:
- `idx_logs_user_starttime_desc` on `(user_id, start_time DESC)` — drives `/logs/latest` and the WhatsApp `status` command.
- `idx_logs_user_created_desc` on `(user_id, created_at DESC)` — fallback for audit views.

### Guidance logic (`src/services/guidance.service.ts`)
- **Next side**: alternate from last (`LEFT → RIGHT`, `RIGHT → LEFT`, `BOTH/none → LEFT`).
- **Next time**: `last.start_time + FEEDING_INTERVAL_HOURS` (default 3h, per-user override on `users.feeding_interval_hours`).
- **Dynamic tip**: surfaced only when last `quality_score < 3`, deterministically rotated by log id so retries don't show the same tip twice.

### Claude prompt (`src/services/claude.service.ts`)
Robust system prompt that constrains Claude to a **single JSON object** with six keys (`intent`, `side`, `durationMin`, `qualityScore`, `notes`, `confidence`) — including English and Hebrew examples. The service:
1. Short-circuits common deterministic commands (`status`, `help`, `סטטוס`, `עזרה`).
2. Calls Claude with `temperature: 0`, `max_tokens: 300`.
3. Strips accidental code fences, walks the response to extract the first balanced JSON object, and validates the shape with Zod.
4. Falls back to `intent: UNKNOWN` if anything is off, so the bot never crashes the user.

### WhatsApp webhook (`src/controllers/whatsapp.controller.ts`)
- Verifies `X-Twilio-Signature` against `PUBLIC_BASE_URL` + form params.
- Resolves the sender by `phone_e164` → user (rejects unlinked numbers with onboarding hint).
- Routes by parsed `intent`: `STATUS` → formatted last + next, `HELP` → command help, `LOG_FEEDING` → persists with `confidence ≥ 0.5` (otherwise asks user to confirm).
- Replies with TwiML so Twilio relays the message back over WhatsApp.

## Mobile (Expo)

### Stack
- Expo SDK 51 + expo-router
- NativeWind 4 (Tailwind for RN)
- Zustand for auth state
- AsyncStorage for the JWT
- Haptics on every input for "feels right" one-handed use

### Run
```bash
cd mobile
npm install
# point the app at your backend (default: http://localhost:4000)
# edit `mobile/app.json` → expo.extra.apiBaseUrl
npm run start
```

### One-handed Quick Log dashboard (`app/index.tsx`)
- Status + guidance card on top, dynamic tip beneath (only when quality < 3).
- Side / duration / quality stacked from middle to bottom.
- "Suggested" badge on the predicted side, pre-selected on load.
- Tall **Save session** pill anchored to the bottom — within thumb reach on large devices.
- Pull-to-refresh, optimistic state on success, error haptic on failure.

## Security checklist
- JWT (HS256), 32+ char secret enforced at boot via Zod
- bcrypt password hashing (12 rounds default)
- Helmet, CORS, JSON body limit 64 KB
- Input validation with Zod on every controller
- Twilio signature validation on the webhook (toggle via `TWILIO_VALIDATE_SIGNATURE`)
- Pino redaction for `Authorization`, `Cookie`, secrets, password fields
- Prisma parameterized queries everywhere
- Rate limiting + observability hooks ready to add (recommended next step before production)

## Tests
```bash
cd backend
npm test    # vitest — covers guidance prediction rules
```

## Branch
All development for this iteration lives on `claude/lactasync-ecosystem-design-Jf2AQ`.
