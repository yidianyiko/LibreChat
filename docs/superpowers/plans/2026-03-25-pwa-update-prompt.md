# PWA Update Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve PWA/service worker support while switching update handling to an explicit user refresh prompt.

**Architecture:** Keep `vite-plugin-pwa` active, stop generating a self-destroying service worker, and move runtime update handling into a small client-side coordinator plus a lightweight global prompt component. Dynamic import failures will enter the same prompt flow instead of forcing an immediate page reload.

**Tech Stack:** React, Vite PWA, Jest, Testing Library

---

### Task 1: Restore prompt-based PWA configuration

**Files:**
- Modify: `client/vite.config.ts`
- Test: `client/src/__tests__/vitePwaConfig.spec.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run `cd client && npx jest src/__tests__/vitePwaConfig.spec.ts --runInBand` and verify it fails**
- [ ] **Step 3: Update the Vite PWA config to keep SW enabled and remove self-destroying behavior**
- [ ] **Step 4: Re-run `cd client && npx jest src/__tests__/vitePwaConfig.spec.ts --runInBand` and verify it passes**

### Task 2: Add prompt-based runtime update handling

**Files:**
- Create: `client/src/utils/pwaUpdate.ts`
- Create: `client/src/components/System/PWAUpdatePrompt.tsx`
- Modify: `client/src/main.jsx`
- Modify: `client/src/App.jsx`
- Modify: `client/src/locales/en/translation.json`
- Test: `client/src/utils/__tests__/pwaUpdate.spec.ts`
- Test: `client/src/components/System/__tests__/PWAUpdatePrompt.spec.tsx`

- [ ] **Step 1: Write failing tests for update notification and refresh action**
- [ ] **Step 2: Run the targeted Jest commands and verify they fail for the expected reason**
- [ ] **Step 3: Implement the minimal runtime coordinator and prompt UI**
- [ ] **Step 4: Re-run the targeted Jest commands and verify they pass**

### Task 3: Regression verification

**Files:**
- Modify: `client/src/main.jsx`
- Test: `client/src/utils/__tests__/pwaUpdate.spec.ts`

- [ ] **Step 1: Add a failing test proving dynamic import failures route into the prompt flow instead of immediate reload**
- [ ] **Step 2: Run the targeted Jest command and verify it fails**
- [ ] **Step 3: Implement the minimal regression fix**
- [ ] **Step 4: Run `cd client && npx jest src/__tests__/vitePwaConfig.spec.ts src/utils/__tests__/pwaUpdate.spec.ts src/components/System/__tests__/PWAUpdatePrompt.spec.tsx --runInBand` and `cd client && npm run build`**
