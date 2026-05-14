# Admin Conversation Review Design

## Goal

Give the admin panel a way to browse user conversations for product requirement analysis, with user identities anonymized and access gated behind a per-feature password so that holding an admin role alone is not enough to read user chats.

## Non-Goals

- No bulk export endpoint (CSV/JSONL).
- No PII regex masking inside message bodies. Conversation titles and message text are returned as-is.
- No user-facing opt-out toggle and no privacy policy changes in this iteration.
- No audit log of admin reads. Access is gated up front; trail-after-the-fact is out of scope here.
- No full-text search across messages in v1. Keyword search via MeiliSearch is a planned follow-up, not part of this design.

## Current Behavior

`/api/admin/auth` and `/api/admin/stats` already exist under `api/server/routes/admin/`. Admin access goes through `requireJwtAuth + requireAdmin` (the latter from `@librechat/api`). The admin panel is a separate frontend deployed under `getAdminPanelUrl()` and talks to LibreChat via these `/api/admin/*` routes. Conversations and messages are stored in MongoDB with the schemas in `packages/data-schemas/src/schema/convo.ts` and `message.ts`. MeiliSearch already indexes `convo.title` and `message.text`/`message.content` for end-user search, scoped by `user`.

## Architecture

All new feature logic lives in TypeScript under `packages/api/src/admin/conversations/`. A thin JS wrapper at `api/server/routes/admin/conversations.js` applies the existing `requireJwtAuth + requireAdmin` middleware and mounts the TypeScript router, matching the convention used by `admin/stats.js`. Mount the wrapper at `app.use('/api/admin/conversations', routes.adminConversations)` in `api/server/index.js`.

```
admin panel (separate frontend)
   │  fetch with credentials
   ▼
/api/admin/conversations/*
   │  middleware chain:
   │    requireJwtAuth → requireAdmin → adminConvoLimiter → requireElevatedConvoAccess
   ▼
packages/api/src/admin/conversations/
   ├── config.ts           validates env (hash salt, password hash, session secret) at startup
   ├── anonymizer.ts       hmac_sha256(userId, ADMIN_HASH_SALT).slice(0, 12)
   ├── transformer.ts      Mongoose doc → public DTO (sole path; no res.json(doc) anywhere)
   ├── service.ts          list / detail; cursor pagination; filter assembly
   ├── unlock.ts           POST /unlock, POST /lock, elevated-token issuing/clearing
   ├── elevatedAuth.ts     requireElevatedConvoAccess middleware (cookie verify, scope check, pwVersion match)
   └── index.ts            router wiring
```

No document shape changes. No backfill. No new collections. Reads go straight to the existing `Conversation` and `Message` collections. Add only the query indexes needed for this read path:

- `Conversation`: `{ updatedAt: -1, _id: -1 }`
- `Conversation`: `{ endpoint: 1, model: 1, updatedAt: -1, _id: -1 }`
- `Conversation`: `{ agent_id: 1, updatedAt: -1, _id: -1 }`
- `Message`: `{ conversationId: 1, createdAt: 1, _id: 1 }`

## Security Model

The threat being mitigated is "any admin can casually open any user's chat history." The control is a separate credential ("function password") that an admin must enter after logging in, which issues a short-lived elevated session scoped only to this feature.

### Function password storage

Four new environment variables:

```
ADMIN_CONVERSATIONS_PASSWORD_HASH=$2b$12$...     # bcrypt hash, never plaintext
ADMIN_CONVERSATIONS_PASSWORD_VERSION=1           # integer, bump to invalidate all live elevated tokens
ADMIN_CONVO_SESSION_SECRET=...                   # JWT signing secret, distinct from main JWT secret
ADMIN_HASH_SALT=...                              # ≥32 bytes, HMAC key for anonymous IDs
```

`config.ts` validates all four at process startup. Any missing or malformed value (bad bcrypt prefix, short salt) terminates the process with a clear log line. There is no weak default.

Password rotation: operator runs `npm run admin:hash-convo-password`, which reads a password from stdin, prints a bcrypt hash to stdout, and exits without persisting anything. Operator writes the new hash to env, bumps `ADMIN_CONVERSATIONS_PASSWORD_VERSION`, restarts the service. All elevated tokens that carried the old `pwVersion` are rejected on the next request because the middleware compares the token's `pwVersion` against current env.

### Unlock flow

```
POST /api/admin/conversations/unlock
  body: { password: string }
  → 200 + Set-Cookie: lc_admin_convo=<jwt>;
                       HttpOnly; Secure; SameSite=Strict; Path=/api/admin/conversations
  → 401 { error: 'authentication_required' }   // wrong password or locked
```

The cookie is the only carrier. The token is never returned in the JSON body, so it cannot land in `localStorage`. The cookie's `Path` keeps it out of every other route. JWT payload:

```ts
{ scope: 'admin.conversations', adminId: string, pwVersion: number, exp: now + 15min }
```

A matching `POST /api/admin/conversations/lock` clears the cookie when the admin chooses to step down.

Cookie assumption: the admin panel and LibreChat API must be deployed as same-site origins under the browser cookie model (for example, sibling subdomains under the same registrable domain). `SameSite=Strict` will not work if the admin panel is hosted on a different site. Local HTTP development can override only the `Secure` flag through test/dev config; production always sets `Secure`.

### Brute-force defense

The `unlock` route is rate-limited at 5 attempts per 15 minutes, keyed by `adminId` (the logged-in admin user). After the threshold, the route returns the same generic `401 authentication_required` for the next 15 minutes regardless of whether the password is correct, so an attacker cannot distinguish "wrong password" from "locked." Lockout state lives in the existing cache layer (`getLogStores`), not on the user document, so it does not pollute the user schema and clears automatically.

### Elevated middleware

`requireElevatedConvoAccess` runs after `requireAdmin`. It reads the `lc_admin_convo` cookie, verifies the JWT signature against `ADMIN_CONVO_SESSION_SECRET`, checks `scope === 'admin.conversations'`, checks `pwVersion === current env value`, and confirms `adminId === req.user._id.toString()`. Any failure returns `401 authentication_required` with no detail. The middleware gates the data-reading routes (`GET /`, `GET /:conversationId`). It does not run on `/unlock` (which issues the cookie) or `/lock` (which clears the cookie on the caller's browser and is idempotent).

### Anonymous ID

Stable per user across all admin sessions: `hmac_sha256(userId, ADMIN_HASH_SALT).hex().slice(0, 12)`. Twelve hex characters give 48 bits of output, which is collision-resistant at the project's user scale. Salt rotation reshuffles every ID and is treated as a feature (rare, intentional, documented).

### DTO contract

Types live in `packages/data-provider/src/types/admin.ts` and are exported from `packages/data-provider/src/index.ts`. Reuse the existing feedback and message-content types instead of introducing `unknown` payloads:

```ts
import type { TMinimalFeedback } from '../feedback';
import type { TMessageContentParts } from './assistants';

export type AdminConvoListItem = {
  id: string;
  conversationId: string;
  anonUserId: string;
  title: string;
  endpoint?: string;
  model?: string;
  agent_id?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
};

export type AdminMessageItem = {
  id: string;
  messageId: string;
  conversationId: string;
  parentMessageId?: string;
  anonUserId: string;
  text?: string;
  content?: TMessageContentParts[]; // Text/think/error parts only; tool/media payloads are dropped.
  sender?: string;
  isCreatedByUser: boolean;
  model?: string;
  endpoint?: string;
  tokenCount?: number;
  summaryTokenCount?: number;
  finish_reason?: string;
  feedback?: TMinimalFeedback;
  error?: boolean;
  unfinished?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminConvoDetail = AdminConvoListItem & {
  messages: AdminMessageItem[];
  truncated: boolean;
};
```

Neither type has a `user`, `email`, `name`, `username`, `openidId`, `files`, `attachments`, `metadata`, `iconURL`, `conversationSignature`, `clientId`, `invocationId`, or `thread_id` field. The transformer is the only function that turns a Mongoose doc into one of these DTOs, and no handler may call `res.json(doc)` directly. A type-level test asserts the DTO keys stay on this whitelist; a runtime test feeds a fully populated mock doc and asserts the serialized response keys are a subset of the whitelist.

### Other guarantees

- Server-side hard cap of 50 on `limit`.
- Cursor pagination only (`updatedAt` + `_id` as compound cursor, sorted newest first). No `skip` parameter is accepted.
- A separate `adminConvoLimiter` (60 requests per minute per admin) applies to every route in this subtree.
- No export route is mounted.

## Anonymization Mapping

`Conversation` → `AdminConvoListItem`:

| Source                                                                  | Target           | Treatment                                                                                          |
| ----------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| `_id`                                                                   | `id`             | string                                                                                             |
| `conversationId`                                                        | `conversationId` | direct                                                                                             |
| `title`                                                                 | `title`          | direct (titles can contain user-typed text; risk is equivalent to message body, which is accepted) |
| `user`                                                                  | `anonUserId`     | HMAC, 12 hex                                                                                       |
| `endpoint`, `model`, `agent_id`, `tags`                                 | same             | direct                                                                                             |
| `createdAt`, `updatedAt`                                                | same             | ISO string                                                                                         |
| `files`, `expiredAt`, `importSourceId`, all `conversationPreset` fields | —                | dropped                                                                                            |

`Message` → `AdminMessageItem`:

| Source                                                           | Target       | Treatment                                                           |
| ---------------------------------------------------------------- | ------------ | ------------------------------------------------------------------- |
| `_id`, `messageId`, `parentMessageId`, `conversationId`          | same         | direct                                                              |
| `user`                                                           | `anonUserId` | HMAC, 12 hex                                                        |
| `text`, safe textual `content` parts                             | same         | direct for text/think/error only; tool/media payloads are dropped   |
| `sender`, `isCreatedByUser`, `model`, `endpoint`                 | same         | direct                                                              |
| `tokenCount`, `summaryTokenCount`, `finish_reason`               | same         | direct                                                              |
| `feedback`                                                       | same         | direct (rating + tag + text retained for product feedback analysis) |
| `error`, `unfinished`                                            | same         | direct                                                              |
| `createdAt`, `updatedAt`                                         | same         | ISO string                                                          |
| `files`, `attachments`                                           | —            | dropped (uploads are the highest-risk PII surface)                  |
| `iconURL`                                                        | —            | dropped (often user-uploaded avatars)                               |
| `metadata`                                                       | —            | dropped (Mixed type, no static guarantee on contents)               |
| `conversationSignature`, `clientId`, `invocationId`, `thread_id` | —            | dropped (no analysis value; useful as cross-session fingerprints)   |
| `_meiliIndex`, `expiredAt`, `addedConvo`                         | —            | dropped                                                             |

## API

All routes are mounted at `/api/admin/conversations`. The middleware chain on every route is `requireJwtAuth → requireAdmin → adminConvoLimiter`, plus `requireElevatedConvoAccess` on the data-reading routes (`GET /` and `GET /:conversationId`). `POST /unlock` issues the elevated cookie and runs without it. `POST /lock` only clears the cookie on the caller's browser and is idempotent, so it does not require an elevated session either.

### `POST /unlock`

Body: `{ password: string }`. Validates against `ADMIN_CONVERSATIONS_PASSWORD_HASH` with `bcrypt.compare`, then issues the elevated cookie. Failure mode is a single generic 401 regardless of cause.

### `POST /lock`

Clears the `lc_admin_convo` cookie. Returns 204.

### `GET /`

Lists conversations.

Query params:

- `cursor` (optional): opaque base64 of `{ updatedAt: ISO, id: string }` from the last item of the previous page.
- `limit` (optional, default 25, hard cap 50).
- `endpoint`, `model`, `agentId` (optional, repeatable): filter by exact match.
- `from`, `to` (optional ISO dates): clamps `updatedAt`.

Response: `{ items: AdminConvoListItem[], nextCursor: string | null }`.

### `GET /:conversationId`

Returns a single conversation with its messages, ordered by `createdAt` ascending. Response: `AdminConvoDetail`. Message list is capped at a server-side maximum of 1000; if a conversation has more messages, the service fetches the most recent 1000, reverses them into ascending order for rendering, and sets `truncated: true`. We never paginate inside a single conversation in v1.

### Anonymous-user drilldown

`anonUserId` is display-only in v1. The list endpoint does not accept `anonUserId` because the hash is not stored on documents, cannot be reversed, and should not be implemented by scanning all users or maintaining process-local reverse maps. If product analysis needs "all conversations from this anonymous user," add a follow-up endpoint that uses a selected conversation as the anchor (`conversationId` → raw `user` → same-user query) or materialize a hashed user field with an explicit migration and index.

### Error shapes

All errors use `{ error: string }`. The unlock route uses `authentication_required` for all failure modes. Other routes use `unauthorized`, `forbidden`, `not_found`, `rate_limited`, `invalid_request`. No internal details leak.

## Admin Panel UI Flow

The admin panel is a separate frontend, so this design specifies the protocol only.

1. Admin opens the "Conversations" page in the admin panel.
2. The page calls `GET /api/admin/conversations` with credentials. The first call comes back 401 because no elevated cookie is set.
3. The page shows an unlock dialog requesting the function password.
4. The page POSTs to `/unlock` and on 200 retries the list call, which now succeeds.
5. Admin browses the cursor-paginated list and applies filters (endpoint/model/agent/date).
6. Admin clicks an item; the detail view fetches `GET /:conversationId` and renders the message thread with each user message labeled by `anonUserId`.
7. A "Lock" button posts to `/lock` and returns the user to the unlock dialog state.
8. Inactivity for 15 minutes naturally expires the cookie; the next request 401s and the unlock dialog reappears.

The admin panel implementation lives in its own repository and is out of scope for this LibreChat-side spec.

## Configuration

New env variables, all required at startup:

| Variable                               | Purpose                                                        |
| -------------------------------------- | -------------------------------------------------------------- |
| `ADMIN_HASH_SALT`                      | HMAC key for anonymous IDs; ≥ 32 bytes                         |
| `ADMIN_CONVERSATIONS_PASSWORD_HASH`    | bcrypt hash of the function password                           |
| `ADMIN_CONVERSATIONS_PASSWORD_VERSION` | integer; bump to invalidate live elevated tokens               |
| `ADMIN_CONVO_SESSION_SECRET`           | signing secret for elevated JWT; distinct from main JWT secret |

A new npm script `admin:hash-convo-password` invokes a small Node script under `api/scripts/hash-admin-convo-password.js` that reads a password from stdin and prints the bcrypt hash.

## Testing

Jest tests in `packages/api/src/admin/conversations/__tests__/`:

- `anonymizer.spec.ts`: HMAC stability across calls; salt change reshuffles outputs; output is exactly 12 hex chars; throws if `ADMIN_HASH_SALT` is missing.
- `transformer.spec.ts`: feed a fully populated mock `Conversation` / `Message` doc (including `email`, `password`, `files`, `metadata`, `iconURL`, `clientId`); assert returned DTO keys are a subset of the whitelist; assert `user` field is replaced by `anonUserId` and that no original `user` value appears anywhere in the serialized output.
- `unlock.spec.ts`: correct password → 200 + cookie; wrong password → 401; 6th attempt within 15 minutes → 401 with no cookie issued, even with correct password; bumping `pwVersion` invalidates an outstanding token.
- `elevatedAuth.spec.ts`: missing cookie → 401; valid cookie → next handler runs; expired token → 401; wrong scope → 401; mismatched `adminId` → 401.
- `service.spec.ts`: list pagination cursor round-trip on `updatedAt + _id`; `limit` capped at 50; filters by endpoint/model/agent; no `skip` or `anonUserId` query param is accepted; detail responses return `truncated: true` when message count exceeds 1000.

Router tests in `packages/api/src/admin/conversations/__tests__/router.spec.ts`:

- Hit the TypeScript router as a locked admin and an unlocked admin; assert response status, payload shape, unsupported-query rejection, anonymous IDs, and dropped high-risk message fields.

Wrapper tests in `api/server/routes/admin/__tests__/`:

- Mock `@librechat/api` and `~/db/models`; assert the legacy JS wrapper applies JWT/admin middleware and passes the `Conversation` and `Message` models into the TypeScript router.

Per project conventions, run tests from the relevant workspace: `cd packages/api && npx jest src/admin/conversations --runInBand` and `cd api && npx jest server/routes/admin/__tests__/conversations.spec.js --runInBand`.

## Risks and Deferred Items

- **No audit trail.** Decision is explicit. If a misuse incident occurs, there is no record of which admin opened which conversation. The function password gate is the only control. Reconsider before this feature is used on production data.
- **`feedback.text` retained.** This field is a user-typed string and can contain PII. Retained because it is high-value for product analysis. Strip if a future review tightens scope.
- **Titles and message bodies retained verbatim.** A user may have pasted their email, phone, or API key into a chat. Acknowledged and accepted in this iteration.
- **Rich content is narrowed in v1.** Text, thinking, and error content parts are retained for analysis. Tool calls, image/audio/video payloads, and nested metadata are dropped because they can contain file handles or cross-session fingerprints.
- **MeiliSearch keyword search not exposed.** Follow-up: an admin-scoped Meili index path that ignores the per-user filter, keyed off the same elevated session.
- **No step-up TOTP option.** The function password is a shared secret; if a single admin leaks it, every admin's access is effectively compromised until rotation. Mitigation: short rotation cadence (operator policy).
- **No anonymous-user global drilldown in v1.** This is intentional. A process-local `anonUserId` reverse map would be unreliable across restarts and replicas, while scanning every user to reverse a hash would create a new sensitive enumeration path. Add an anchored or materialized-hash design only when that workflow is explicitly required.
