# LibreChat WeChat Default Session Design

## Goal

Make the first post-bind WeChat experience feel ready immediately:

- every successful bind or rebind sends a welcome message in WeChat
- successful bind or rebind proactively creates the default current conversation
- if a bound user still has no current conversation during a later cold start, the first plain-text message lazily creates one and continues the turn without requiring `/new`

## Scope

### In Scope

- WeChat bridge behavior after successful bind confirmation
- Plain-text fallback when a bound user has no `currentConversation`
- Regression-safe preservation of existing `/new`, `/list`, `/switch`, and `/now` commands
- Focused Jest coverage for the new bind-success and lazy-create flows

### Out of Scope

- Changing slash-command syntax
- Changing website binding UI
- Introducing new persistence fields
- Changing current conversation semantics for `/switch`

## Design

### Bind Success Path

After `resolveBindSession` confirms the QR login and LibreChat accepts `/api/wechat/internal/bindings/complete`, the bridge should:

1. mark the bind session healthy as it does today
2. refresh active runtime bindings
3. best-effort call `/api/wechat/conversations/new` for the bound LibreChat user
4. best-effort send this welcome text to the bound WeChat peer:

`hi, 终于可以在微信上也和你聊天啦！如果你想创建一个新对话，可以试试在对话框输入 /new, 如果想找到之前的对话可以先输入 /list，再输入你想继续的某条对话，比如 /switch 1`

The new-conversation creation and welcome send are post-bind side effects, not part of bind correctness. If either side effect fails, the bind still remains healthy and later plain-text fallback still guarantees usability.

### Plain Text Cold-Start Fallback

When the bridge receives a non-command text message and `getCurrentConversation(userId)` returns `null`, it should:

1. call `/api/wechat/conversations/new`
2. immediately retry the same user message through `/api/wechat/messages`
3. return the model response normally

This makes the cold-start behavior equivalent to “default `/new` already happened” while preserving the existing explicit command controls for users who want them.

### Error Handling

- If lazy conversation creation fails, reply with the existing generic send failure message.
- If the welcome send fails, log it and keep the binding healthy.
- If post-bind conversation creation fails, log it and rely on the lazy-create fallback during the next inbound plain-text turn.

## Files

- `packages/api/src/wechat/bridge/bindStatus.ts`
  - add post-bind default-session and welcome side effects
- `packages/api/src/wechat/bridge/commands.ts`
  - centralize the welcome text constant/helper
- `packages/api/src/wechat/bridge/poller.ts`
  - auto-create a current conversation for plain text when missing
- `packages/api/src/wechat/bridge/__tests__/main.test.ts`
  - verify bind success triggers default conversation initialization and welcome send
- `packages/api/src/wechat/bridge/__tests__/poller.test.ts`
  - verify plain text can cold-start by auto-creating a current conversation

## Testing

- add a failing bind-success regression test first
- add a failing plain-text cold-start regression test first
- run focused bridge tests after each green step
