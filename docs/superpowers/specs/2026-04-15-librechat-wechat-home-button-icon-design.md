# LibreChat WeChat Home Button Icon Design

## Goal

Add a recognizable WeChat icon to the home-visible WeChat quick action so the button matches the icon-led quick actions already shown in the left-side account area.

## Context

- [`client/src/components/Nav/AccountSettings.tsx`](/data/projects/LibreChat/client/src/components/Nav/AccountSettings.tsx) renders the quick-action stack that is visible from the main shell.
- [`client/src/components/Nav/WeChat/WeChatQuickAction.tsx`](/data/projects/LibreChat/client/src/components/Nav/WeChat/WeChatQuickAction.tsx) currently renders the WeChat quick action as text only.

The existing migrate-history entry already includes an icon, so the WeChat entry looks visually incomplete in the same stack.

## Scope

### In Scope

- Add a decorative WeChat icon to the home-visible WeChat quick action.
- Keep the current localized label and `aria-label`.
- Preserve the existing click behavior and dialog flow.
- Add focused frontend test coverage for icon rendering.

### Out of Scope

- Changing WeChat bind / unbind behavior.
- Changing any backend or data-provider code.
- Redesigning the account-area layout.
- Adding new localization keys.

## Chosen Approach

Render a small inline SVG WeChat icon directly inside [`client/src/components/Nav/WeChat/WeChatQuickAction.tsx`](/data/projects/LibreChat/client/src/components/Nav/WeChat/WeChatQuickAction.tsx), ahead of the existing localized label.

This is the smallest change that:

- keeps the current button structure intact
- avoids introducing a new icon dependency
- preserves accessibility by keeping the icon decorative with `aria-hidden="true"`

## Interaction And Accessibility

- The button will continue to expose the same accessible name from `com_nav_wechat_binding`.
- The icon will be decorative only and must not add extra spoken output.
- The button must continue to open the shared WeChat dialog exactly as before.

## Visual Treatment

- Reuse the existing quick-action spacing already applied by `AccountSettings`.
- Size the icon consistently with neighboring quick-action icons.
- Use a WeChat-like inline SVG mark so the button is immediately identifiable.

## Testing

Extend [`client/src/components/Nav/WeChat/__tests__/WeChatQuickAction.spec.tsx`](/data/projects/LibreChat/client/src/components/Nav/WeChat/__tests__/WeChatQuickAction.spec.tsx) with a focused assertion that the rendered WeChat button includes a decorative SVG icon.

The existing interaction tests should remain unchanged and continue to verify dialog opening and binding behavior.

## Risks And Mitigations

- Risk: icon markup changes the button's accessible name.
  - Mitigation: keep `aria-label` unchanged and mark the SVG as `aria-hidden`.
- Risk: styling drifts from adjacent quick actions.
  - Mitigation: rely on the existing quick-action wrapper classes instead of adding custom layout wrappers.

## Acceptance Criteria

- The home-visible WeChat quick action renders a WeChat icon to the left of its label.
- The button still has the same accessible name and still opens the WeChat dialog.
- The focused WeChat quick-action Jest suite passes with icon coverage included.
