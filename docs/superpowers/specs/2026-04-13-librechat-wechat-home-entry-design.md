# LibreChat WeChat Home Entry Design

## Goal

Add a new WeChat entry that is visible from the main left-side account area, at the same hierarchy as the existing "迁移数据" action, so users can start or manage WeChat binding without opening Settings first.

The existing WeChat entry inside Settings must remain available.

## Context

The current frontend has two relevant surfaces:

- [`client/src/components/Nav/AccountSettings.tsx`](/data/projects/LibreChat/client/src/components/Nav/AccountSettings.tsx) renders the account-area quick actions that are visible from the main application shell, including the existing "迁移数据" trigger.
- [`client/src/components/Nav/SettingsTabs/Account/WeChatBinding.tsx`](/data/projects/LibreChat/client/src/components/Nav/SettingsTabs/Account/WeChatBinding.tsx) renders the current WeChat binding UI inside the Settings dialog.

Today, users must open Settings, switch to the Account tab, and then interact with the inline WeChat binding controls. That is one navigation layer deeper than the "迁移数据" flow and does not satisfy the requested "主页可见" access pattern.

This design is intentionally a frontend-only change. It reuses the existing WeChat status, bind-start, bind-status polling, and unbind APIs without any backend contract changes.

## Scope

### In Scope

- Add a new WeChat quick action in the left-side account area.
- Place it at the same visual level as the current "迁移数据" action.
- Open a dedicated WeChat binding dialog directly from that quick action.
- Keep the Settings -> Account WeChat entry in place.
- Refactor the current WeChat binding implementation so the dialog logic is shared instead of duplicated.
- Cover the new entry and shared flow with frontend tests.

### Out of Scope

- Removing or redesigning the Settings dialog structure.
- Introducing a new route or full page for WeChat binding.
- Changing any backend or data-provider API.
- Expanding the WeChat product scope beyond bind / rebind / unbind.

## Chosen Approach

We will extract the current WeChat binding flow into shared frontend building blocks and use them from two entry points:

1. A new quick action in [`client/src/components/Nav/AccountSettings.tsx`](/data/projects/LibreChat/client/src/components/Nav/AccountSettings.tsx)
2. The existing Settings Account item in [`client/src/components/Nav/SettingsTabs/Account/Account.tsx`](/data/projects/LibreChat/client/src/components/Nav/SettingsTabs/Account/Account.tsx)

This keeps behavior consistent across both surfaces while avoiding duplicated query, mutation, QR, polling, and toast logic.

## User Experience

### Main Account Area

The account-area quick actions currently render "迁移数据" as a standalone button above the account popover trigger. The new WeChat entry will be added in the same stack, directly adjacent to that action so both are visible from the main shell without opening Settings.

The button should:

- use the same visual treatment as the existing quick actions in `AccountSettings`
- use existing localization where possible, especially `com_nav_wechat_binding`
- open a WeChat dialog directly on click

### Dialog Behavior

The new dialog is the direct interaction target for the home-visible entry.

On open, the dialog reads the latest WeChat status and renders one of three states:

- `unbound`
  - automatically starts a bind session
  - shows loading UI until QR data is available
  - then shows the QR code and scan instructions
- `reauth_required`
  - behaves like `unbound`, but preserves the rebind status wording where appropriate
- `healthy`
  - shows the connected status
  - shows the connected account identifier when available
  - provides an unbind action

This keeps the home entry truly direct. An unbound user reaches the QR flow immediately. A bound user reaches management immediately.

### Settings Account Area

The Settings -> Account WeChat item remains present. Its visual placement in the Account tab does not change.

The settings surface continues to show inline status and actions, but it should reuse the same shared binding controller and QR / management dialog primitives so both surfaces stay behaviorally aligned.

## Component Design

### Shared Structure

Introduce a shared WeChat binding feature surface under `client/src/components/Nav/` so it can be imported by both the root nav area and Settings without awkward cross-imports from `SettingsTabs`.

The shared design should split responsibilities into:

- a controller hook
  - owns status query access
  - owns bind-start and unbind mutations
  - owns bind-session ID and bind-status polling
  - owns success toast and query invalidation
- a reusable dialog component
  - renders loading, QR, connected, and error states
  - receives state and actions from the controller
- thin surface-specific components
  - one for the new home-visible quick action
  - one for the existing Settings Account row

This preserves a single source of truth for WeChat binding behavior while allowing the two entry points to present different shells.

### AccountSettings Integration

[`client/src/components/Nav/AccountSettings.tsx`](/data/projects/LibreChat/client/src/components/Nav/AccountSettings.tsx) will gain a new quick-action button and local open/close state for the shared WeChat dialog.

The action should follow the existing `ImportConversations` trigger pattern:

- button in the top quick-action stack
- same width, padding, and hover treatment
- localized `aria-label`
- icon from the existing icon set already used in the nav

No route navigation is required.

### Settings Integration

[`client/src/components/Nav/SettingsTabs/Account/WeChatBinding.tsx`](/data/projects/LibreChat/client/src/components/Nav/SettingsTabs/Account/WeChatBinding.tsx) should be reduced from a self-contained flow component into a settings-specific presenter that consumes the shared controller and dialog.

It will continue to render:

- label
- current binding status
- connected account text when available
- bind CTA when unbound or reauth is required
- unbind CTA when already bound

The QR and terminal-state handling should no longer live only inside this file.

## Data Flow

### Opening from the Home Entry

1. User clicks the WeChat quick action in `AccountSettings`.
2. The shared dialog opens.
3. The controller reads current WeChat status from `useWeChatStatusQuery`.
4. If status is `unbound` or `reauth_required`, the controller starts a bind session once for that dialog-open cycle.
5. The dialog shows QR content from the bind-start response or subsequent bind-status polling updates.
6. The controller polls bind status while the dialog remains open.
7. When binding reaches `healthy`, the controller:
   - invalidates and refetches `QueryKeys.wechatStatus`
   - shows the success toast
   - closes or resets the bind-session QR state cleanly

### Opening from Settings

The settings row uses the same status source and bind / unbind actions. If the user starts a bind from Settings, it uses the same QR dialog and the same completion flow described above.

## Error Handling

The shared flow must handle failure states explicitly instead of silently closing:

- status query failure
  - show a retryable error state in the dialog
- bind-start failure
  - show an error state or toast and keep the dialog open for retry
- bind-status terminal failure such as expired or cancelled session
  - stop polling
  - clear stale session state
  - show retry affordance instead of leaving a dead QR visible
- unbind failure
  - surface a toast and leave current state intact

Closing the dialog must clear ephemeral bind-session state so a future open starts from a clean state.

## Localization

Reuse existing WeChat localization keys wherever possible:

- `com_nav_wechat_binding`
- `com_ui_wechat_bind`
- `com_ui_wechat_unbind`
- `com_ui_wechat_qr_title`
- `com_ui_wechat_qr_help`
- `com_ui_wechat_bound_healthy`
- `com_ui_wechat_reauth_required`
- `com_ui_wechat_unbound`
- `com_ui_wechat_connected_account`

If a new string is required for loading or retry states, add only the English source key in [`client/src/locales/en/translation.json`](/data/projects/LibreChat/client/src/locales/en/translation.json) and continue using `useLocalize()` for all user-facing text.

## Testing

### Existing Tests to Extend

- [`client/src/components/Nav/__tests__/AccountSettings.spec.tsx`](/data/projects/LibreChat/client/src/components/Nav/__tests__/AccountSettings.spec.tsx)
- [`client/src/components/Nav/SettingsTabs/Account/__tests__/WeChatBinding.spec.tsx`](/data/projects/LibreChat/client/src/components/Nav/SettingsTabs/Account/__tests__/WeChatBinding.spec.tsx)

### Required Coverage

- `AccountSettings` renders the new WeChat quick action alongside the existing migrate action.
- Clicking the new quick action opens the shared WeChat dialog.
- Opening from the quick action starts the bind flow for an unbound user.
- Opening from the quick action shows management state for a healthy binding.
- The Settings Account WeChat surface still renders the correct inline actions and still completes the bind-success refresh path.
- Closing the dialog resets transient QR session state so reopening does not reuse stale data.

## Risks and Mitigations

- Risk: shared logic extraction accidentally changes Settings behavior.
  - Mitigation: keep a thin settings presenter and preserve its existing test expectations.
- Risk: the quick action creates duplicate bind-start requests on repeated renders.
  - Mitigation: scope auto-start to dialog open state and current binding status, not to every render.
- Risk: dialog state leaks between the home entry and Settings entry.
  - Mitigation: keep ephemeral session state inside the shared controller instance owned by each surface, not in global module state.

## Implementation Notes

- Prefer a small refactor over a broad file move. The goal is shared behavior, not directory churn.
- Keep import order and typing aligned with repo rules.
- No backend or `packages/data-provider` edits are expected for this work.

## Acceptance Criteria

- A signed-in user can see a WeChat entry in the main left-side account area, at the same level as "迁移数据".
- Clicking that entry opens WeChat binding management directly, without opening Settings first.
- Unbound and reauth-required users can reach the QR flow directly from the new entry.
- Already bound users can view status and unbind from the new entry.
- The Settings -> Account WeChat entry still exists and still works.
- The implementation shares the WeChat binding flow rather than duplicating it in two separate components.
