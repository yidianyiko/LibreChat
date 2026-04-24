# Recharge Entrypoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add direct recharge access, token-balance recharge prompting, and mobile-friendly recharge navigation.

**Architecture:** Introduce a focused client hook for recharge navigation, then use it in the left nav, Balance tab, and token-balance error UI. Keep structured error parsing in the existing `Error.tsx` component and pass sidebar close capability only where the sidebar owns that state.

**Tech Stack:** React, TypeScript, React Router, Jest, Testing Library, LibreChat client UI primitives.

---

## File Structure

- Modify `client/src/hooks/Nav/useNavigateToRecharge.ts`: new hook that navigates to `/recharge` and optionally closes the nav.
- Modify `client/src/hooks/Nav/index.ts`: export the new hook.
- Modify `client/src/components/Nav/AccountSettings.tsx`: render direct Add Credits above migrate/import and use shared recharge navigation.
- Modify `client/src/components/Nav/Nav.tsx`: pass `setNavVisible` into `AccountSettings`.
- Modify `client/src/components/Nav/SettingsTabs/Balance/Balance.tsx`: use shared recharge navigation.
- Modify `client/src/components/Messages/Content/Error.tsx`: render token-balance message, inline Add Credits, and auto dialog.
- Modify `client/src/locales/en/translation.json`: add token-balance dialog/action copy.
- Modify `client/src/components/Nav/__tests__/AccountSettings.spec.tsx`: cover direct button position and mobile nav closing.
- Modify `client/src/components/Nav/SettingsTabs/Balance/__tests__/Balance.spec.tsx`: cover shared navigation.
- Create `client/src/components/Messages/Content/__tests__/Error.spec.tsx`: cover token-balance CTA and dialog.

## Tasks

- [x] Create lightweight workspace symlinks for Jest in the worktree.
- [x] Write failing tests for direct sidebar recharge and Balance tab navigation.
- [x] Add the shared recharge navigation hook.
- [x] Implement the AccountSettings direct Add Credits entry and Nav prop pass-through.
- [x] Update Balance to use the shared hook.
- [x] Write failing tests for token-balance error CTA and dialog.
- [x] Implement token-balance CTA/dialog and English locale keys.
- [x] Run focused verification and inspect diff.
