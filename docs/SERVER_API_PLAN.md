# Titan Fitness — Server-Side API Plan

## Goals

1. **P0**: Server-side proxy so users without API keys get an out-of-the-box AI experience
2. **P1**: Subscription via App Store / Play Store in-app purchases
3. **P2**: Optional server-side user data storage (opt-in, device-only by default)

---

## Current AI Endpoints (10 total)

| Feature | Function | System prompt | Max output | Frequency/user |
|---|---|---|---|---|
| **Coach chat** | `sendMessage` | ~700 tokens (system + equipment + history) | 8192 | 5-20x/day |
| **In-workout chat** | `sendWorkoutChat` | ~140 tokens | 8192 | 0-5x/session |
| **Program generation** | `sendProgramMessage` | ~625 tokens | 8192 | 1x/week |
| **Nutrition estimate (text)** | `estimateNutrition` | ~170 tokens | 1024 | 2-5x/day |
| **Nutrition estimate (vision)** | `estimateNutritionWithImage` | ~230 tokens | 1024 | 1-3x/day |
| **Nutrition label scan** | `scanNutritionLabel` | ~180 tokens | 1024 | 1-3x/day |
| **Nutrition goals suggest** | `suggestGoals` | ~130 tokens | 1024 | 1x/month |
| **Nutrition coach chat** | `chatWithNutritionAI` | ~200 tokens | 4096 | 3-10x/day |

### Vision endpoints (image input)
- `estimateNutritionWithImage` — food photo
- `scanNutritionLabel` — nutrition facts label photo

---

## Token Cost Estimates (OpenAI gpt-4.1-mini)

**Model: `gpt-4.1-mini`** (recommended — best price/quality for this workload)
- Input: $0.40 / 1M tokens
- Output: $1.60 / 1M tokens
- Vision: supported

Note: Currently using `gpt-5-mini` ($1.50/$6.00), but it wastes budget on reasoning tokens that don't produce visible output. `gpt-4.1-mini` is 5-6x cheaper with excellent quality for coaching/nutrition tasks.

### Per-request estimates (gpt-4.1-mini)

| Feature | Input tokens | Output tokens | Cost/request |
|---|---|---|---|
| Coach chat (short) | ~1,200 | ~500 | $0.0013 |
| Coach chat (with history) | ~3,000 | ~800 | $0.0025 |
| Program generation | ~1,500 | ~4,000 | $0.0070 |
| Nutrition estimate (text) | ~300 | ~200 | $0.0004 |
| Nutrition vision | ~1,500* | ~300 | $0.0011 |
| Nutrition label scan | ~1,500* | ~200 | $0.0009 |
| Nutrition chat | ~600 | ~400 | $0.0009 |
| In-workout chat | ~500 | ~200 | $0.0005 |

*Vision requests include image tokens (~1,000-1,500 for a typical photo)

### Per-user monthly estimates

| Usage tier | Requests/month | Est. cost/month |
|---|---|---|
| Light (3x/week workouts) | ~200 | $0.35 - $0.65 |
| Moderate (5x/week) | ~500 | $0.75 - $1.30 |
| Heavy (daily + nutrition tracking) | ~1,000 | $1.50 - $2.50 |

### Subscription Tiers

| Tier | Price | Features | API cost/user/mo | Revenue after store cut (30%) | Margin |
|---|---|---|---|---|---|
| **Free** | $0 | 7-day trial of Titan Pro, then 1 program gen/week | ~$0.01 | — | — |
| **Workout Pro** | $6.99/mo | AI Coach chat (gpt-5-mini), in-workout chat, program gen (gpt-5-mini) | ~$1.50-3.00 | ~$4.89 | ~$1.89-3.39 |
| **Titan Pro** | $12.99/mo | Everything + nutrition tracking, vision, label scan (gpt-4.1-mini) | ~$2.00-4.00 | ~$9.09 | ~$5.09-7.09 |

Annual pricing options:
- Workout Pro Annual: $49.99/yr ($4.17/mo) — better retention, healthy margin
- Titan Pro Annual: $99.99/yr ($8.33/mo) — best value for heavy users

### Model alternatives considered

| Model | Input/Output per 1M | Monthly cost (moderate) | Notes |
|---|---|---|---|
| gpt-4.1-nano | $0.10 / $0.40 | $0.18-0.35 | Cheapest, quality may suffer for nuanced coaching |
| **gpt-4.1-mini** | **$0.40 / $1.60** | **$0.75-1.30** | **Best balance — recommended** |
| gpt-5-mini | $1.50 / $6.00 | $4.00-7.00 | Current model, reasoning token overhead |
| gpt-4.1 | $2.00 / $8.00 | $2.00-3.50 | Best quality, overkill for most requests |

### Model routing strategy

Use gpt-5-mini for endpoints that require reasoning about constraints (injuries, equipment, recovery, multi-day programming). Use gpt-4.1-mini for everything else.

| Endpoint | Model | Rationale |
|---|---|---|
| Coach chat | gpt-5-mini | Reasons about injuries, equipment, muscle recovery |
| Program generation | gpt-5-mini | Complex multi-day planning with constraints |
| In-workout chat | gpt-4.1-mini | Quick form tips, simple Q&A |
| Nutrition estimate (text) | gpt-4.1-mini | Straightforward estimation |
| Nutrition vision | gpt-4.1-mini | Read food from image |
| Nutrition label scan | gpt-4.1-mini | OCR + structured extraction |
| Nutrition goals | gpt-4.1-mini | Simple calculation from profile |
| Nutrition chat | gpt-4.1-mini | General nutrition Q&A |

### Revised per-user monthly estimates (mixed models)

| Usage tier | Requests/month | Est. cost/month |
|---|---|---|
| Light (3x/week workouts) | ~200 | $0.80 - $1.50 |
| Moderate (5x/week) | ~500 | $1.50 - $3.00 |
| Heavy (daily + nutrition tracking) | ~1,000 | $2.50 - $4.50 |

---

## Architecture Options

### Option A: Lightweight Proxy (Recommended for P0)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Titan App  │────▶│  API Proxy        │────▶│  Anthropic  │
│  (PWA/iOS/  │     │  (Hono on CF      │     │  API        │
│   Android)  │     │   Workers)        │     └─────────────┘
└─────────────┘     │                   │
                    │  - Auth (JWT)     │
                    │  - Rate limiting  │
                    │  - Usage tracking │
                    │  - Subscription   │
                    │    validation     │
                    └──────────────────┘
```

**Stack:**
- **Runtime**: Cloudflare Workers (Hono framework)
- **Auth**: JWT tokens, sign-up via email/magic link or Apple/Google sign-in
- **Database**: Cloudflare D1 (SQLite) for user accounts, usage tracking
- **Rate limiting**: Cloudflare rate limiting or in-worker with D1
- **Subscription validation**: Server-side receipt validation for App Store / Play Store
- **Cost**: ~$5/mo base (Workers paid plan) + D1 is essentially free at this scale

**Pros**: Minimal infrastructure, global edge deployment, very cheap, fast to build
**Cons**: Limited compute (no long-running tasks), vendor lock-in to CF

### Option B: Full Backend

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Titan App  │────▶│  API Server       │────▶│  Anthropic  │
│             │     │  (Hono on Fly.io) │     │  API        │
└─────────────┘     │                   │     └─────────────┘
                    │  - Auth           │
                    │  - Rate limiting  │     ┌─────────────┐
                    │  - Usage tracking │────▶│  PostgreSQL │
                    │  - Subscription   │     │  (Fly/Neon) │
                    │  - User data sync │     └─────────────┘
                    │  - Data backup    │
                    └──────────────────┘
```

**Stack:**
- **Runtime**: Fly.io (Hono on Node/Bun)
- **Auth**: JWT + Apple/Google sign-in
- **Database**: PostgreSQL (Neon serverless or Fly Postgres)
- **Cost**: ~$10-20/mo base

**Pros**: Full control, easy to add data sync later, no vendor lock-in
**Cons**: More ops, slightly higher cost, single-region unless you add replicas

### Option C: Serverless Functions

**Stack:** AWS Lambda + API Gateway + DynamoDB (or Vercel + Neon)

**Pros**: Scales to zero, pay-per-use
**Cons**: Cold starts, more complex deployment, AWS bill unpredictability

### Recommendation

**Start with Option A (CF Workers)** for P0. It's the fastest to ship, cheapest to run, and Hono works identically on CF Workers and Node — so you can migrate to Option B later if you need data sync (P2) without rewriting the API layer.

---

## API Design

### Endpoints

```
POST /api/v1/auth/signup          # Email + magic link or OAuth
POST /api/v1/auth/login           # Returns JWT
POST /api/v1/auth/refresh         # Refresh token

POST /api/v1/ai/chat              # Coach chat
POST /api/v1/ai/workout-chat      # In-workout chat
POST /api/v1/ai/program           # Program generation
POST /api/v1/ai/nutrition/estimate      # Text-based nutrition estimate
POST /api/v1/ai/nutrition/vision        # Photo-based nutrition estimate
POST /api/v1/ai/nutrition/label         # Nutrition label scan
POST /api/v1/ai/nutrition/goals         # Suggest nutrition goals
POST /api/v1/ai/nutrition/chat          # Nutrition coach chat

GET  /api/v1/usage                # Current period usage stats
GET  /api/v1/subscription         # Subscription status

POST /api/v1/subscription/validate      # Validate App Store / Play Store receipt
```

### Rate Limits (per user, per day)

| Endpoint | Free (post-trial) | Workout Pro | Titan Pro |
|---|---|---|---|
| Program generation | 1/week | 7/day | 10/day |
| Coach chat | — | 50/day | 75/day |
| In-workout chat | — | 30/day | 30/day |
| Nutrition estimate | — | — | 30/day |
| Nutrition vision/label | — | — | 20/day |
| Nutrition chat | — | — | 50/day |
| Nutrition goals | — | — | 5/day |

Enforced server-side via usage counters in D1, reset at midnight UTC. Response includes `X-RateLimit-Remaining` header so the app can show usage to users proactively.

### Auth Flow

```
1. User opens app → no account → "Sign in to use AI features"
2. User signs in via Apple Sign-In or Google Sign-In
   - Apple Sign-In required if offering any third-party login (App Store rule)
   - Capacitor plugins: @capacitor/google-auth, @capacitor-community/apple-sign-in
   - PWA: JS SDKs for both providers
3. Server creates account, returns JWT (short-lived) + refresh token
4. App stores tokens in secure storage (Keychain on iOS, Keystore on Android)
5. All /api/v1/ai/* requests include Authorization: Bearer <jwt>
6. Server validates JWT, checks subscription tier, checks rate limit
7. If free tier: allow program generation only (1x/week)
8. If Workout Pro: allow coach chat, in-workout chat, program gen
9. If Titan Pro: allow all features including nutrition
```

### Request/Response Pattern

The proxy is transparent — the app sends the same payload shape it currently sends to Anthropic/OpenAI, but to your server instead:

```ts
// App sends:
POST /api/v1/ai/chat
{
  "systemPrompt": "You are Titan...",
  "messages": [...],
  "maxTokens": 8192
}

// Server:
// 1. Validates JWT
// 2. Checks subscription tier (free/workout-pro/titan-pro)
// 3. Checks feature access (e.g. nutrition endpoints require titan-pro)
// 4. Forwards to OpenAI API (gpt-4.1-mini) with server-side API key
// 5. Streams response back to client
// 6. Logs usage (tokens in/out) to D1
```

### App-Side Changes

```ts
// src/native/platform.ts — add:
export const apiBase = isNative
  ? 'https://titan-api.fio.dev'
  : 'https://titan-api.fio.dev'; // same for PWA

// src/ai.ts — refactor getConfig():
function getConfig(): AIConfig {
  const serverToken = getAuthToken(); // JWT from server auth
  if (serverToken) {
    return { mode: 'server', token: serverToken };
  }
  // Fallback to BYOK (bring your own key)
  const key = localStorage.getItem('titan_ai_key');
  const provider = localStorage.getItem('titan_ai_provider');
  if (key) {
    return { mode: 'byok', apiKey: key, provider };
  }
  return null;
}
```

**BYOK (Bring Your Own Key)**: Available on the PWA at titan.fio.dev only. Users with their own API key bypass the server entirely (no cost to you). Native app users (iOS/Android) always go through the server proxy and require a subscription for AI features.

---

## In-App Purchase Integration

### iOS (StoreKit 2)

```swift
// ios/App/App/Plugins/StorePlugin.swift
// Capacitor plugin that exposes StoreKit 2 to JavaScript

@objc func getProducts(_ call: CAPPluginCall) {
    // Return available subscription products
}

@objc func purchase(_ call: CAPPluginCall) {
    // Initiate purchase flow
}

@objc func restorePurchases(_ call: CAPPluginCall) {
    // Restore previous purchases
}
```

### Android (Google Play Billing)

```kotlin
// android/app/src/main/java/.../BillingPlugin.kt
// Same interface as iOS, different implementation
```

### Server-Side Receipt Validation

```ts
// On your API server
app.post('/api/v1/subscription/validate', async (c) => {
  const { platform, receipt } = await c.req.json();

  if (platform === 'ios') {
    // Validate with Apple's App Store Server API (v2)
    // Uses signed JWTs, not the old verifyReceipt endpoint
  } else if (platform === 'android') {
    // Validate with Google Play Developer API
    // Uses service account credentials
  }

  // Update user's subscription status in DB
  // Return current status to app
});
```

---

## P2: Optional Server-Side Data Storage

When a user opts in, their IndexedDB data syncs to the server:

```
POST /api/v1/sync/push    # Upload local changes
GET  /api/v1/sync/pull    # Download server state
```

Data model on server mirrors the IndexedDB stores:
- Equipment, workout sessions, personal records
- Nutrition logs, goals, starred foods
- Profile, weight history, programs

Conflict resolution: last-write-wins with timestamps (simple, good enough for single-user data).

This enables:
- Cross-device sync (phone ↔ tablet)
- Data backup / restore without manual export
- Account recovery if device is lost

---

## Implementation Phases

### Phase 1 — API Proxy (P0) — ~1-2 weeks
- [ ] Set up Cloudflare Worker with Hono
- [ ] Auth endpoints (magic link email to start, add OAuth later)
- [ ] AI proxy endpoints (all 8 features)
- [ ] Usage tracking in D1
- [ ] Rate limiting (free tier: 5 requests/day)
- [ ] App-side: add server auth flow, refactor AI calls to support both BYOK and server modes
- [ ] Deploy to `titan-api.fio.dev`

### Phase 2 — Subscriptions — ~1-2 weeks
- [ ] Apple StoreKit 2 Capacitor plugin
- [ ] Google Play Billing Capacitor plugin
- [ ] Server-side receipt validation
- [ ] Subscription status check on AI endpoints
- [ ] Settings UI: subscription management, plan display

### Phase 3 — Data Sync (P2) — ~2-3 weeks
- [ ] Server-side data model + migrations
- [ ] Sync endpoints (push/pull)
- [ ] App-side sync engine (background sync, conflict resolution)
- [ ] Settings toggle: "Sync data to cloud"
- [ ] Account deletion / data export (GDPR compliance)

---

## Decisions Made

1. **Auth**: Apple Sign-In + Google Sign-In (Apple requires Apple Sign-In if any third-party login is offered)
2. **Tiers**: Free (1 program gen/week) → Workout Pro $6.99/mo (chat + workouts) → Titan Pro $12.99/mo (+ nutrition)
3. **Model**: gpt-5-mini for reasoning-heavy endpoints (coach chat, program gen), gpt-4.1-mini for everything else. 7-day free trial of Titan Pro for new signups.
4. **BYOK**: PWA only (titan.fio.dev). Native apps require subscription for AI features.
5. **Domain**: `titan-api.fio.dev`

## Open Questions

1. **gpt-4.1-nano for simple endpoints?** Could use nano for nutrition label scan and goal suggestions to cut costs further (~4x cheaper than mini). Test quality first.
2. **Free tier rate limiting**: 1 program gen per week — should it expire (regenerate allowed) or persist until next week?
3. **Trial → conversion flow**: After 7-day trial expires, what's the UX? Soft paywall (show features grayed out with upgrade prompt) or hard paywall (block AI features entirely)?
