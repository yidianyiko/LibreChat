# LibreChat WeChat iLink Bridge Design

## Goal

Provide a WeChat private-chat entrypoint for LibreChat so a signed-in LibreChat user can bind their own WeChat account, choose a conversation from WeChat with slash commands, and continue the same `OpenAI / gpt-4o` conversation they already use on the website.

`v1` prioritizes correctness and low operational risk over feature breadth. The product should feel like "LibreChat in WeChat" for supported conversations, not like a separate assistant product.

## Product Scope

### In Scope

- Personal WeChat private chat only
- One LibreChat account binds to one WeChat account
- Web-based binding flow: user starts binding from LibreChat settings, scans a QR code with WeChat, and completes binding to the current signed-in LibreChat account
- Slash-command interaction in WeChat:
  - `/new`
  - `/list`
  - `/switch <index>`
  - `/now`
- Shared conversation continuity between website and WeChat for supported conversations
- Text input and text output only
- Supported target conversations are limited to resolved OpenAI conversations on model `gpt-4o`
- Persistent current-conversation binding so the user can keep chatting after process restarts

### Out of Scope

- Group chats
- Images, files, voice, video, typing indicators, and rich cards
- Multiple WeChat accounts per LibreChat account
- Multiple active current conversations per user
- Fuzzy search, `/search`, or `/switch <keyword>`
- Support for non-OpenAI or non-`gpt-4o` conversations
- Agent-only remote workflow as the primary product model

## Design Principles

- LibreChat remains the source of truth for users, conversations, messages, and encrypted WeChat credentials at rest.
- The WeChat integration is an adapter, not a second chat system.
- Users should never accidentally send a normal message into the wrong conversation.
- The WeChat protocol lifecycle should stay isolated from the main web app runtime as much as possible.
- `v1` must follow existing repo boundaries: new backend logic in TypeScript under `/packages/api`; `/api` changes stay thin.
- Every continuation must be branch-safe. A WeChat binding is not just a `conversationId`; it is a `conversationId + parentMessageId` head pointer.

## Reference Interaction Model

The command style is intentionally inspired by Proma's remote IM bridge pattern: keep one current binding per chat identity, use slash commands for explicit session control, and route plain text into the currently selected session only. We reuse the interaction philosophy, but not Proma's session/workspace data model.

Proma-inspired choices we are keeping:

- Explicit slash commands instead of free-form routing
- A persisted current conversation
- `/list -> /switch -> continue chatting` as the primary control flow
- No automatic send when no current conversation is selected

Choices we are not copying:

- Proma's workspace abstraction
- Agent/chat dual mode
- Group-thread behavior
- Proma-local session storage as the source of truth

## User Experience

### Binding Flow

1. The user signs in to LibreChat on the website.
2. The user opens a new WeChat settings section and clicks "Bind WeChat".
3. LibreChat requests a one-time binding session from the bridge.
4. The bridge returns a QR code for WeChat scanning.
5. The user scans and confirms from WeChat.
6. The bridge receives WeChat iLink credentials and reports the successful scan to LibreChat.
7. LibreChat encrypts and persists the binding to the current signed-in user account.
8. The bridge starts long-polling for that bound WeChat account.

### First-Time Messaging Behavior

After binding succeeds, the user still has no current conversation selected. If they send plain text immediately in WeChat, the bridge must reply with guidance instead of auto-sending:

`当前还没有选中的对话，请先使用 /new 创建新对话，或使用 /list 查看最近对话后再 /switch <序号>`

### Slash Commands

#### `/new`

- Creates a new supported LibreChat conversation for the bound user
- Sets it as the current conversation
- Does not send any first user message
- Returns a short confirmation including the title and a short conversation identifier

Conversation creation rule:

- First resolve the user's current default preset
- If that preset resolves to provider `openAI` and model `gpt-4o`, use it
- If not, fall back to LibreChat's built-in global GPT-4o preset from `config/default-preset.js`
- The new current binding stores the new `conversationId` and the repo's new-conversation sentinel head, not a real message ID yet

#### `/list`

- Lists the bound user's recent supported conversations only
- Each line shows:
  - index
  - title
  - updated time
- The current conversation is visually marked
- The command also creates a short-lived server-side list snapshot used by `/switch <index>`

#### `/switch <index>`

- Accepts only a numeric index
- The index is valid only against the most recent unexpired `/list` snapshot
- If no valid snapshot exists, the command must fail with:
  - `请先执行 /list`
- On success, LibreChat resolves the selected conversation and computes a deterministic branch head:
  - if the conversation has one or more leaf messages, bind to the most recently created leaf message
  - if multiple leaves share the same timestamp, prefer an assistant leaf over a user leaf
  - if the conversation has no messages, bind to the new-conversation sentinel head
- Persists the resulting `conversationId + parentMessageId` as the new current binding
- Returns a confirmation with title and short identifier

#### `/now`

- Returns the currently bound conversation:
  - title
  - updated time
  - short conversation identifier
- If none is selected, it returns the same guidance as the empty-state message

### Plain Text Messaging

- If a current conversation binding exists and is still valid, plain text is appended to that same LibreChat branch using the stored `conversationId + parentMessageId`
- If the current conversation is missing, deleted, archived, expired, not owned by the user, or no longer eligible for `v1`, the bridge clears the current binding and returns the guidance message instead of sending
- After a successful WeChat turn, the current binding advances to the saved assistant response message ID for that same branch

## System Architecture

### High-Level Split

The integration is split into two services:

- **LibreChat main application**
  - owns user identity
  - owns conversation and message persistence
  - owns encrypted WeChat credential storage at rest
  - owns conversation eligibility checks
  - owns current branch-head binding state
  - exposes bind, status, unbind, conversation selection, and message orchestration APIs

- **WeChat bridge service**
  - owns iLink QR login, live credential use, long polling, slash-command parsing, and reply delivery
  - owns operational runtime state such as poller leases, cursors, and recent inbound message dedupe keys
  - keeps decrypted credentials only in memory for active pollers
  - never becomes the source of truth for conversation content

### Why Sidecar Instead of Main-App Embed

- The iLink runtime has its own failure modes: QR login, session expiry, long polling, and protocol-specific headers.
- The public ecosystem around iLink currently trends toward separate runtimes and newer Node versions.
- Isolating the bridge reduces blast radius if WeChat connectivity degrades.
- LibreChat web requests should not be coupled to a continuously polling protocol worker.

## Core Data Model

### 1. WeChat Account Binding

Persisted against the LibreChat user:

- `userId`
- `ilinkBotId`
- encrypted `botToken`
- `baseUrl`
- `ilinkUserId`
- `status` with values `healthy`, `reauth_required`, or `unbound`
- `boundAt`
- `unhealthyAt` when the bridge detects credential expiry or terminal auth failure
- `unboundAt` when removed

Rules:

- one LibreChat account may bind only one WeChat account in `v1`
- one WeChat iLink account may belong to only one LibreChat account
- LibreChat is the only source of truth for this record at rest

### 2. Current Conversation Binding

Persisted per LibreChat user:

- `userId`
- `conversationId`
- `parentMessageId`
- `selectedAt`
- `lastAdvancedAt`
- `source` with values `new` or `switch`

This state is the durable WeChat branch head.

Head-advance rules:

- `/new` stores the new conversation ID plus the new-conversation sentinel head
- `/switch` stores the selected conversation ID plus the deterministic leaf head computed at switch time
- a successful WeChat message updates `parentMessageId` to the saved assistant response message ID
- a successful website message updates the WeChat binding only if the website request started from the same currently bound head; this preserves the same branch while allowing website and WeChat to stay in sync
- a website message started from any other head leaves the WeChat binding unchanged

### 3. List Snapshot

Persisted as short-lived server state for `/switch`:

- `snapshotId`
- `userId`
- ordered `conversationIds`
- `createdAt`
- `expiresAt`

Rules:

- lifetime is 15 minutes
- only the most recent snapshot per user is valid
- `/switch <index>` resolves the index through this snapshot, never through a global permanent ordering

### 4. Bridge Runtime State

Persisted by the bridge:

- one active poller lease per bound WeChat account
- `get_updates_buf`
- current bridge connection status
- last successful connect time
- failure counters and last error
- recent inbound WeChat message IDs for dedupe

This state belongs to the transport layer, not business truth.

## Eligibility Rules For `/list` And `/switch`

`v1` must only expose conversations that satisfy all conditions:

- are owned by the bound LibreChat user
- resolve to provider `openAI`
  - use `endpointType` when present
  - otherwise fall back to the stored `endpoint`
- use model `gpt-4o`
- are not archived
- are not expired
- still exist

Unsupported conversations are hidden from `/list`. This is intentional because the user explicitly chose the simplest behavior: only show switchable items.

## API Boundary

### Website-Exposed LibreChat APIs

- `POST /api/wechat/bind/start`
  - authenticated website user starts a one-time binding session
  - returns a short-lived bind session identifier and QR payload from the bridge

- `GET /api/wechat/bind/status/:bindSessionId`
  - authenticated website user polls binding completion state

- `GET /api/wechat/status`
  - returns whether the current LibreChat user has a bound WeChat account and whether it is healthy or needs rebind

- `DELETE /api/wechat/bind`
  - unbinds the current user's WeChat account
  - clears current conversation binding

### Bridge Command APIs Exposed By LibreChat

These are internal product APIs for the bridge, protected with service-to-service auth.

- `GET /api/wechat/conversations`
  - returns recent eligible conversations for the bound user
  - returns display rows and a `snapshotId`

- `POST /api/wechat/conversations/new`
  - creates a new eligible conversation using the preset resolution rules above
  - persists current conversation binding with the new-conversation sentinel head

- `POST /api/wechat/conversations/switch`
  - accepts `snapshotId` and `index`
  - resolves the selected conversation from the server-side snapshot
  - computes the deterministic leaf head
  - persists current conversation binding

- `GET /api/wechat/conversations/current`
  - returns the current bound conversation and `parentMessageId` if still valid

- `POST /api/wechat/messages`
  - accepts:
    - bound LibreChat user
    - current `conversationId`
    - current `parentMessageId`
    - plain text user message
    - optional transport metadata for observability
  - starts generation using LibreChat's existing conversation pipeline
  - internally waits on the generation job until terminal success, terminal failure, or timeout
  - on success returns:
    - `conversationId`
    - flattened visible assistant text
    - next `parentMessageId` for future continuation

Timeout rule:

- the orchestration layer waits up to 90 seconds for terminal completion
- if the timeout is hit, it must abort the in-flight generation job before replying to WeChat
- after abort, it reconciles the current binding to the latest persisted leaf produced by that timed-out request, if any
- the WeChat-facing error message is short and explicit:
  - `本次回复超时，请稍后重试`

### Bridge Runtime Sync APIs Exposed By LibreChat

These APIs resolve the credential-ownership gap between the two services.

- `POST /api/wechat/internal/bindings/complete`
  - bridge sends bind-session completion plus plaintext iLink credential payload over a trusted internal channel
  - LibreChat encrypts and persists the credential record

- `GET /api/wechat/internal/bindings/active`
  - bridge asks LibreChat for currently active healthy bindings during startup or recovery
  - LibreChat returns the decrypted credential payload only over trusted internal auth

- `POST /api/wechat/internal/bindings/health`
  - bridge reports runtime health changes such as auth expiry, reconnect failure, or recovery
  - LibreChat updates binding status to `healthy` or `reauth_required`

### Bridge APIs Needed By LibreChat

- start QR login for a bind session
- poll bind session state
- cancel bind session

LibreChat should never need to know iLink protocol details beyond the binding result payload.

## Message Flow

### Bind Flow

1. Website calls LibreChat bind-start API.
2. LibreChat creates a short-lived bind session tied to the authenticated user.
3. LibreChat asks the bridge to start QR login for that bind session.
4. Bridge returns QR code payload.
5. User scans and confirms.
6. Bridge sends the successful scan result and plaintext WeChat credential payload to LibreChat over the trusted internal bind-complete API.
7. LibreChat encrypts and persists the user-level WeChat binding as `healthy`.
8. Bridge starts long polling for that account.

### Bridge Startup Recovery Flow

1. Bridge starts or restarts.
2. Bridge fetches active healthy bindings from LibreChat through the internal runtime API.
3. Bridge reconstructs one poller per bound WeChat account.
4. Bridge resumes long polling from the stored transport cursor when available.

### Command Flow

1. Bridge receives a WeChat text message through iLink long polling.
2. Bridge deduplicates the inbound WeChat message ID.
3. Bridge resolves the bound LibreChat user from the WeChat account.
4. Bridge checks whether the message is a supported slash command.
5. Bridge calls the matching LibreChat API.
6. Bridge formats the text response and sends it back via iLink with the current `context_token`.

### Plain Text Chat Flow

1. Bridge receives plain text.
2. Bridge deduplicates the inbound WeChat message ID.
3. Bridge resolves the bound LibreChat user.
4. Bridge loads the current `conversationId + parentMessageId` binding.
5. If there is no valid current binding, bridge replies with guidance and stops.
6. If the current binding is valid, bridge calls LibreChat messaging API.
7. LibreChat starts generation through the existing conversation pipeline and waits for terminal completion.
8. On success, LibreChat flattens the visible assistant output into WeChat-safe plain text.
9. LibreChat updates the current binding to the returned assistant response message ID.
10. Bridge sends the assistant text back to WeChat.
11. The same conversation remains visible on the website because LibreChat stored both sides of the exchange.

### Website-To-WeChat Continuity Flow

1. User continues the same conversation on the website.
2. LibreChat compares the website request's starting `parentMessageId` with the current WeChat binding for that user.
3. If they match and the website request completes successfully, LibreChat advances the WeChat binding to the new assistant response message ID.
4. If they do not match, LibreChat leaves the WeChat binding unchanged because the website request branched elsewhere.

## Output Normalization For WeChat

- WeChat input is plain user text only
- WeChat output contains only visible assistant text
- reasoning, thinking summaries, tool traces, run steps, attachments, images, and other structured content are dropped from the WeChat response
- if a response contains multiple visible text parts, join them with blank lines
- if a completed response contains no visible text, return:
  - `本次回复包含暂不支持的内容类型，请到网页端查看`
- if the final text exceeds iLink send limits, the bridge splits it into ordered chunks before delivery

## Error Handling

### No Current Conversation

- Return guidance only
- Do not create a conversation implicitly
- Do not cache the user message for replay

### Conversation No Longer Eligible

If the stored current binding points to a conversation that:

- was deleted
- no longer exists
- is no longer owned by the user
- is archived
- is expired
- is no longer provider `openAI`
- is no longer model `gpt-4o`

Then:

- clear current conversation binding
- respond with guidance to use `/new` or `/list`

### Invalid `/switch`

- if `snapshotId` is missing or expired, return `请先执行 /list`
- if the provided index is out of range, return `请先执行 /list`
- if the selected conversation became ineligible after `/list`, return `请先执行 /list`

### WeChat Session Expiry

If iLink credentials expire or long polling enters a terminal auth failure:

- bridge marks the binding as `reauth_required`
- bridge stops polling for that account
- encrypted credentials remain stored until the user rebinds or unbinds
- website status page must show that rebind is required

### LibreChat Generation Failure

If LibreChat fails to produce a reply:

- return a short user-facing error in WeChat
- keep the current conversation binding unchanged
- log request correlation details for debugging

### LibreChat Generation Timeout

If LibreChat does not complete within 90 seconds:

- abort the in-flight generation job
- reconcile the current binding to the latest persisted leaf produced by that timed-out request, if any
- return `本次回复超时，请稍后重试`
- otherwise keep the current conversation binding unchanged

## Security And Privacy

- iLink `botToken` must be encrypted at rest in LibreChat
- bind sessions must be short-lived and single-use
- bridge-to-LibreChat calls must use an internal trusted auth mechanism, not end-user session cookies
- plaintext WeChat credentials may travel only over trusted internal service auth and should never be logged
- bridge keeps decrypted credentials only in memory for active pollers
- WeChat-originated requests must always be mapped back to one bound LibreChat user before any conversation lookup
- bridge logs must redact tokens and minimize raw conversation content
- unbind must clear:
  - encrypted WeChat credentials
  - current conversation binding
  - active poller
  - long-poll cursor

## Operational Safety

- at most one active poller may exist for each bound WeChat account
- inbound WeChat messages must be deduplicated by transport message ID before command or chat handling
- late duplicate deliveries must not create duplicate LibreChat user messages
- bridge restarts must rebuild pollers from LibreChat's active binding list instead of from ad hoc local files

## Repository And Implementation Boundaries

To respect existing repo rules:

- new backend business logic belongs in `/packages/api`
- `/api` only gets thin JS route wrappers or minimal startup wiring
- shared request and response types belong in `/packages/data-provider` if they are consumed by both web UI and backend
- user binding persistence belongs with existing backend schema and model infrastructure, not in bridge-only files

The bridge remains a separate runtime, but the authoritative business logic and persistence helpers should live in TypeScript under `/packages/api`.

## Testing Strategy

### Unit Tests

- command parsing and command routing
- conversation eligibility filter
- default-preset resolution and fallback to the global GPT-4o preset
- deterministic leaf-head selection for `/switch`
- current conversation validation and clearing behavior
- bind-session lifecycle validation
- output flattening for text-only WeChat replies
- bridge response behavior for empty-state and invalid-state cases

### Integration Tests

- bind flow from website session to stored user binding
- bridge startup recovery from active LibreChat bindings
- `/new` creates a valid current conversation with the new-conversation sentinel head
- `/list` only returns eligible `OpenAI / gpt-4o` conversations
- `/switch <index>` requires a valid snapshot and updates persisted current binding
- plain text on a selected conversation appends to the same LibreChat branch
- a website reply on the same bound branch auto-advances the WeChat binding
- a website reply on a different branch does not change the WeChat binding
- deleting or invalidating the current conversation clears the binding and returns guidance
- duplicate inbound WeChat deliveries do not double-send into LibreChat

### Manual Verification

- bind a fresh WeChat account from the website
- confirm bridge status displays healthy
- run `/new` from WeChat, then chat
- open the same conversation on the website and verify both new messages are present
- continue that same branch on the website and verify `/now` still tracks the updated conversation head
- create multiple website conversations and verify `/list` ordering and `/switch` behavior
- delete or archive the current conversation from the website and verify WeChat receives the expected recovery guidance
- force a credential expiry and verify the website shows rebind required

## Rollout

`v1` should be hidden behind a server-side feature flag so the bridge and website settings UI can be deployed safely before user exposure.

Recommended release order:

1. ship persistence and internal APIs behind a flag
2. ship bridge runtime and bind flow for internal testing
3. verify one-user private-chat workflow end to end
4. expose the settings UI to a small allowlist
5. expand after stability is confirmed

## Accepted `v1` Decisions

- Sidecar bridge, not main-app embedded polling
- Website and WeChat share the same LibreChat conversation
- Personal private chat only
- Text only
- Slash commands only
- Supported commands are `/new`, `/list`, `/switch <index>`, `/now`
- One LibreChat account binds one WeChat account
- No auto-send when no current conversation is selected
- `/new` creates only; it does not send a first message
- `/new` first tries the user's default preset and otherwise falls back to LibreChat's built-in GPT-4o default preset
- `/list` shows only supported conversations
- `v1` supports only resolved OpenAI conversations on model `gpt-4o`
- `/switch <index>` is valid only after `/list`
- Current binding is a persisted `conversationId + parentMessageId` branch head
- Website messages auto-advance the WeChat binding only when they continue the same currently bound branch
- Archived conversations are not shown in `/list`
- Conversation access is owner-only for this feature

## Future Extensions Beyond `v1`

- support image and file input
- support group chats
- support more models and endpoints
- add `/search`
- allow one LibreChat account to bind multiple WeChat accounts
