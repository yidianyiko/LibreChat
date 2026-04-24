# Recharge Entrypoints Design

## Goal

Make token credit recharge discoverable from the left navigation, guide users to recharge when a chat fails because of insufficient token credits, and ensure mobile users see the recharge page immediately after tapping Add Credits.

## Current Behavior

Users can recharge from the account popover or from Settings > Balance. The account popover requires opening the avatar menu first. On mobile, navigating to `/recharge` from the open sidebar leaves the sidebar covering the page until the user taps outside it. Chat errors already recognize `token_balance`, but the message only renders text.

## User Experience

The left navigation account area gets a visible `+ Add Credits` button above the migrate/import conversations action. The existing account popover recharge button remains available.

When the chat renders a `token_balance` error, it shows the insufficient funds detail plus an inline Add Credits button. A small dialog also opens automatically for that rendered error so the user can immediately choose Add Credits or close the prompt. Closing the dialog leaves the inline button visible.

On mobile, any Add Credits action from the sidebar closes the sidebar before navigating to `/recharge`, so the recharge page is visible without requiring a second tap outside the navigation.

## Architecture

Create a small `useNavigateToRecharge` hook in the client that wraps `useNavigate`, accepts an optional `setNavVisible`, and handles `/recharge` navigation consistently. Use it from `AccountSettings`, `Balance`, and the token-balance error UI.

Pass `setNavVisible` from `Nav` to `AccountSettings`, preserving the current desktop behavior while giving mobile sidebar actions a way to close the nav. Keep the error handling local to `client/src/components/Messages/Content/Error.tsx` because that component already owns parsing and rendering structured chat errors.

## Localization

Use `useLocalize()` for all new user-facing strings and add English keys only in `client/src/locales/en/translation.json`:

- `com_error_token_balance_title`
- `com_error_token_balance_description`
- `com_error_token_balance_action`

The existing Add Credits keys are reused where possible.

## Testing

Update focused Jest tests:

- `AccountSettings.spec.tsx` verifies the visible Add Credits button appears above migrate/import and closes mobile nav before navigation.
- `Balance.spec.tsx` verifies the settings Balance button still navigates to recharge.
- Add `Error.spec.tsx` for `token_balance`, covering inline Add Credits and the automatic dialog.

Run the focused test files from `client` with `npx jest ... --runInBand`. Because this worktree does not have a full `npm install`, create local workspace symlinks for the packages Jest maps through `<rootDir>/../node_modules`.
