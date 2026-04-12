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

## Token Cost Estimates (Claude Sonnet)

**Model: `claude-sonnet-4-20250514`**
- Input: $3.00 / 1M tokens
- Output: $15.00 / 1M tokens

### Per-request estimates

| Feature | Input tokens | Output tokens | Cost/request |
|---|---|---|---|
| Coach chat (short) | ~1,200 | ~500 | $0.0111 |
| Coach chat (with history) | ~3,000 | ~800 | $0.0210 |
| Program generation | ~1,500 | ~4,000 | $0.0645 |
| Nutrition estimate (text) | ~300 | ~200 | $0.0039 |
| Nutrition vision | ~1,500* | ~300 | $0.0090 |
| Nutrition label scan | ~1,500* | ~200 | $0.0075 |
| Nutrition chat | ~600 | ~400 | $0.0078 |
| In-workout chat | ~500 | ~200 | $0.0045 |

*Vision requests include image tokens (~1,000-1,500 for a typical photo)

### Per-user monthly estimates

| Usage tier | Requests/month | Est. cost/month |
|---|---|---|
| Light (3x/week workouts) | ~200 | $1.50 - $2.50 |
| Moderate (5x/week) | ~500 | $3.50 - $6.00 |
| Heavy (daily + nutrition tracking) | ~1,000 | $7.00 - $12.00 |

### Suggested pricing

| Plan | Price | Margin at moderate use |
|---|---|---|
| **Free tier** | $0 | 5 AI requests/day (coach chat only, no vision) |
| **Pro** | $9.99/mo | ~40-60% margin |
| **Pro Annual** | $79.99/yr ($6.67/mo) | ~15-30% margin |

Apple/Google take 30% (15% after year 1 for small business), so factor that in:
- $9.99 → you receive ~$7.00 → cost ~$4-6 → margin $1-3/user/month
- Annual gets better retention and you keep more per-month

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

### Auth Flow

```
1. User opens app → no account → "Sign in to use AI features"
2. User signs in (Apple Sign-In / Google Sign-In / email magic link)
3. Server creates account, returns JWT (short-lived) + refresh token
4. App stores tokens in secure storage (Keychain on iOS, Keystore on Android)
5. All /api/v1/ai/* requests include Authorization: Bearer <jwt>
6. Server validates JWT, checks subscription status, checks rate limit
7. If free tier: allow if under daily limit
8. If Pro: proxy to Anthropic, track usage
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
// 2. Checks subscription / rate limit
// 3. Forwards to Anthropic API with server-side API key
// 4. Streams response back to client
// 5. Logs usage (tokens in/out) to D1
```

### App-Side Changes

```ts
// src/native/platform.ts — add:
export const apiBase = isNative
  ? 'https://api.titanfitness.app'
  : 'https://api.titanfitness.app'; // same for PWA

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

Users with their own API key bypass the server entirely (no cost to you). Server-side users go through the proxy.

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
- [ ] Deploy to `api.titanfitness.app`

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

## Key Decisions Needed

1. **Auth provider**: Magic link email only? Or Apple/Google Sign-In from day 1? (Apple requires Apple Sign-In if you offer any other social login)
2. **Free tier limits**: 5 requests/day? Coach chat only? Include vision?
3. **Model choice**: Sonnet for all endpoints, or Haiku for simpler ones (nutrition estimate, label scan) to save cost?
4. **BYOK coexistence**: Keep BYOK as an option for power users, or sunset it once server proxy ships?
5. **Domain**: `api.titanfitness.app`?
