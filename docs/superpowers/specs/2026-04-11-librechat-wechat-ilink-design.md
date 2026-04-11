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
- Plain text only
- Supported target conversations are limited to `OpenAI / gpt-4o`
- Persistent "current conversation" binding so the user can keep chatting after process restarts

### Out of Scope

- Group chats
- Images, files, voice, video, typing indicators, and rich cards
- Multiple WeChat accounts per LibreChat account
- Multiple active current conversations per user
- Fuzzy search, `/search`, or `/switch <keyword>`
- Support for non-OpenAI or non-`gpt-4o` conversations
- Agent-only remote workflow as the primary product model

## Design Principles

- LibreChat remains the source of truth for users, conversations, and messages.
- The WeChat integration should be an adapter, not a second chat system.
- Users should never accidentally send a normal message into the wrong conversation.
- The WeChat protocol lifecycle should stay isolated from the main web app runtime as much as possible.
- `v1` must follow existing repo boundaries: new backend logic in TypeScript under `/packages/api`; `/api` changes stay thin.

## Reference Interaction Model

The command style is intentionally inspired by Proma's remote IM bridge pattern: keep one current binding per chat identity, use slash commands for explicit session control, and route plain text into the currently selected session only. We reuse the interaction philosophy, but not Proma's session/workspace data model.

Proma-inspired choices we are keeping:

- Explicit slash commands instead of free-form routing
- A persisted "current conversation"
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
7. LibreChat persists the binding to the current signed-in user account.
8. The bridge begins long-polling for that bound WeChat account.

### First-Time Messaging Behavior

After binding succeeds, the user still has no current conversation selected. If they send plain text immediately in WeChat, the bridge must reply with guidance instead of auto-sending:

`当前还没有选中的对话，请先使用 /new 创建新对话，或使用 /list 查看最近对话后再 /switch <序号>`

### Slash Commands

#### `/new`

- Creates a new supported LibreChat conversation for the bound user
- Sets it as the current conversation
- Does not send any first user message
- Returns a short confirmation including the title and a short conversation identifier

#### `/list`

- Lists the bound user's recent supported conversations only
- Supported means:
  - owned by or accessible to the current LibreChat user
  - endpoint is OpenAI
  - selected model resolves to `gpt-4o`
- Each line shows:
  - index
  - title
  - updated time
- The current conversation is visually marked

#### `/switch <index>`

- Accepts only a numeric index from the most recent `/list` ordering
- Sets the selected conversation as the current conversation
- Returns a confirmation with title and short identifier

#### `/now`

- Returns the currently bound conversation:
  - title
  - updated time
  - short conversation identifier
- If none is selected, it returns the same guidance as the empty-state message

### Plain Text Messaging

- If a current conversation exists and is still valid, plain text is appended to that same LibreChat conversation
- If the current conversation is missing, deleted, inaccessible, or no longer eligible for `v1`, the bridge clears the current binding and returns the guidance message instead of sending

## System Architecture

### High-Level Split

The integration is split into two services:

- **LibreChat main application**
  - owns user identity
  - owns conversation and message persistence
  - validates which conversations are eligible for WeChat continuation
  - exposes admin/user APIs for bind, status, unbind, list conversations, current binding lookup, create conversation, switch conversation, and send message

- **WeChat bridge service**
  - owns iLink QR login, token lifecycle, long polling, slash-command parsing, and reply delivery
  - owns operational runtime state such as polling cursors and connection status
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
- `status`
- `boundAt`
- `unboundAt` when removed

Rules:

- one LibreChat account may bind only one WeChat account in `v1`
- one WeChat iLink account may belong to only one LibreChat account

### 2. Current Conversation Binding

Persisted per LibreChat user:

- `userId`
- `conversationId`
- `selectedAt`
- `source` with values `new` or `switch`

This state is small but essential. It is the only conversation-selection state needed in `v1`.

### 3. Bridge Runtime State

Persisted by the bridge:

- `get_updates_buf`
- current bridge connection status
- last successful connect time
- failure counters and last error

This state belongs to the transport layer, not business truth.

## Eligibility Rules For `/list` And `/switch`

`v1` must only expose conversations that satisfy all conditions:

- belong to the bound LibreChat user or are otherwise accessible to that same user through normal LibreChat access checks
- are normal website conversations, not remote bridge-local artifacts
- endpoint is OpenAI
- active model is `gpt-4o`
- the conversation is not deleted

Unsupported conversations are hidden from `/list`. This is intentional because the user explicitly chose the simplest behavior: only show switchable items.

## API Boundary

### LibreChat APIs Needed For The Bridge

These are internal product APIs, not public WeChat protocol APIs.

#### Binding APIs

- `POST /api/wechat/bind/start`
  - authenticated website user starts a one-time binding session
  - returns a short-lived bind session identifier and QR payload from the bridge

- `GET /api/wechat/bind/status/:bindSessionId`
  - authenticated website user polls binding completion state

- `GET /api/wechat/status`
  - returns whether the current LibreChat user has a bound WeChat account

- `DELETE /api/wechat/bind`
  - unbinds the current user's WeChat account and clears current conversation binding

#### Conversation Selection APIs

- `GET /api/wechat/conversations`
  - returns recent eligible conversations for the current bound user
  - response includes stable list ordering for `/switch <index>`

- `POST /api/wechat/conversations/new`
  - creates a new eligible OpenAI `gpt-4o` conversation for the current bound user
  - persists current conversation binding

- `POST /api/wechat/conversations/switch`
  - switches current conversation binding using a validated `conversationId`

- `GET /api/wechat/conversations/current`
  - returns the current bound conversation if still valid

#### Messaging API

- `POST /api/wechat/messages`
  - accepts:
    - bound LibreChat user
    - current conversation ID
    - plain text user message
    - optional transport metadata for observability
  - appends the message to the existing LibreChat conversation
  - returns the final assistant text reply for WeChat delivery

### Bridge APIs Needed For LibreChat

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
6. Bridge returns the successful scan result and WeChat credential payload to LibreChat over an internal trusted channel.
7. LibreChat encrypts and persists the user-level WeChat binding.
8. Bridge starts or resumes long polling using the persisted binding state.

### Command Flow

1. Bridge receives a WeChat text message through iLink long polling.
2. Bridge resolves the bound LibreChat user from the WeChat account.
3. Bridge checks whether the message is a supported slash command.
4. Bridge calls the matching LibreChat API.
5. Bridge formats the text response and sends it back via iLink with the current `context_token`.

### Plain Text Chat Flow

1. Bridge receives plain text.
2. Bridge resolves the bound LibreChat user.
3. Bridge looks up the current conversation binding.
4. If there is no valid current conversation, bridge replies with guidance and stops.
5. If the current conversation is valid, bridge calls LibreChat messaging API.
6. LibreChat appends the user message into the existing website conversation and generates the reply.
7. Bridge sends the assistant text back to WeChat.
8. The same conversation remains visible on the website because LibreChat stored both sides of the exchange.

## Error Handling

### No Current Conversation

- Return guidance only
- Do not create a conversation implicitly
- Do not cache the user message for replay

### Conversation No Longer Eligible

If the stored current conversation:

- was deleted
- no longer exists
- is no longer accessible
- is no longer `OpenAI / gpt-4o`

Then:

- clear current conversation binding
- respond with guidance to use `/new` or `/list`

### WeChat Session Expiry

If iLink credentials expire or long polling enters a terminal auth failure:

- mark bridge connection state as expired/error
- stop polling for that account
- LibreChat binding remains recorded but marked unhealthy
- website status page must show that rebind is required

### LibreChat Generation Failure

If LibreChat fails to produce a reply:

- return a short user-facing error in WeChat
- keep the current conversation binding unchanged
- log request correlation details for debugging

## Security And Privacy

- iLink `botToken` must be encrypted at rest
- bind sessions must be short-lived and single-use
- bridge-to-LibreChat calls must use an internal trusted auth mechanism, not end-user session cookies
- WeChat-originated requests must always be mapped back to one bound LibreChat user before any conversation lookup
- bridge logs must redact tokens and minimize raw conversation content
- unbind must clear:
  - encrypted WeChat credentials
  - current conversation binding
  - long-poll cursor

## Repository And Implementation Boundaries

To respect existing repo rules:

- new backend business logic belongs in `/packages/api`
- `/api` only gets thin JS route wrappers or minimal startup wiring
- shared request/response types belong in `/packages/data-provider` if they are consumed by both web UI and backend
- user binding persistence belongs with existing backend schema/model infrastructure, not in ad hoc bridge-only files

The bridge remains a separate runtime, but the authoritative business logic and persistence helpers should live in TypeScript under `/packages/api`.

## Testing Strategy

### Unit Tests

- command parsing and command routing
- conversation eligibility filter
- current conversation validation and clearing behavior
- bind-session lifecycle validation
- bridge response behavior for empty-state and invalid-state cases

### Integration Tests

- bind flow from website session to stored user binding
- `/new` creates a valid current conversation
- `/list` only returns eligible `OpenAI / gpt-4o` conversations
- `/switch <index>` updates persisted current binding
- plain text on a selected conversation appends to the same LibreChat conversation
- deleting or invalidating the current conversation clears the binding and returns guidance

### Manual Verification

- bind a fresh WeChat account from the website
- confirm bridge status displays healthy
- run `/new` from WeChat, then chat
- open the same conversation on the website and verify both new messages are present
- create multiple website conversations and verify `/list` ordering and `/switch` behavior
- delete the current conversation from the website and verify WeChat receives the expected recovery guidance

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
- `/list` shows only supported conversations
- `v1` supports only `OpenAI / gpt-4o` conversations

## Open Questions Deferred Out Of `v1`

These are intentionally deferred, not unresolved requirements:

- whether to support image and file input
- whether to support group chats
- whether to support more models and endpoints
- whether to add `/search`
- whether one LibreChat account can bind multiple WeChat accounts
