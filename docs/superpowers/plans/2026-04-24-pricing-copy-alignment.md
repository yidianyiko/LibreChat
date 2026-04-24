# Pricing Copy Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align recharge and landing-page package copy with the current credits-based implementation while keeping the package presentation and model-specific estimated usage messaging.

**Architecture:** Update the copy in the existing recharge translations and landing-page translation data without changing pricing logic or package IDs. Protect the new wording with focused tests that validate the credits framing and remove unsupported entitlement claims.

**Tech Stack:** React, TypeScript, Jest, Testing Library

---

### Task 1: Lock the approved copy in tests

**Files:**
- Modify: `client/src/components/Recharge/__tests__/RechargePage.spec.tsx`
- Create: `client/src/components/LandingPage/__tests__/LandingPage.spec.ts`

- [ ] **Step 1: Write the failing test**

```tsx
expect(screen.getByText(/500 万 token 额度/i)).toBeInTheDocument();
expect(screen.getByText(/一般使用情况下/i)).toBeInTheDocument();
expect(translations.en.pricing.elite.features).toContain(
  '一般使用情况下，约合 2,000 次 GPT-4o 对话，或约 35,000 次 GPT-4o-mini 对话',
);
expect(translations.en.pricing.elite.features).not.toContain('Unlimited Base 4o-mini msgs');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx jest src/components/Recharge/__tests__/RechargePage.spec.tsx src/components/LandingPage/__tests__/LandingPage.spec.ts --runInBand`
Expected: FAIL because the old pricing copy still references unsupported package claims.

### Task 2: Replace unsupported pricing claims with credits-first package copy

**Files:**
- Modify: `client/src/locales/en/translation.json`
- Modify: `client/src/locales/zh-Hans/translation.json`
- Modify: `client/src/components/LandingPage/LandingPage.tsx`

- [ ] **Step 1: Write minimal implementation**

```ts
"com_recharge_tier_explorer_f1": "适合偶尔使用 GPT-4o，或日常高频使用 GPT-4o-mini"
"com_recharge_tier_explorer_f2": "一次性充值 500 万 token 额度"
"com_recharge_tier_explorer_f3": "一般使用情况下，约合 150 次 GPT-4o 对话，或约 5,000 次 GPT-4o-mini 对话"
```

- [ ] **Step 2: Remove unsupported entitlement bullets**

```ts
["适合重度使用 GPT-4o，或长期高频使用 GPT-4o-mini",
 "一次性充值 3500 万 token 额度",
 "一般使用情况下，约合 2,000 次 GPT-4o 对话，或约 35,000 次 GPT-4o-mini 对话"]
```

- [ ] **Step 3: Update the shared explanatory footer copy**

```ts
"以上次数仅为一般使用情况下的预估值。实际可用次数会因提问长度、回复长度、上下文规模，以及是否使用文件、工具或多轮长对话而变化。"
```

### Task 3: Verify the copy end to end

**Files:**
- Test: `client/src/components/Recharge/__tests__/RechargePage.spec.tsx`
- Test: `client/src/components/LandingPage/__tests__/LandingPage.spec.ts`

- [ ] **Step 1: Run targeted tests**

Run: `cd client && npx jest src/components/Recharge/__tests__/RechargePage.spec.tsx src/components/LandingPage/__tests__/LandingPage.spec.ts --runInBand`
Expected: PASS

- [ ] **Step 2: Run a final grep check for removed unsupported claims**

Run: `rg -n "Unlimited Base 4o-mini msgs|Tier-5 Priority Lane|Project Folders|Token Context|Locked Model Guarantee|Snapshot Selection" client/src`
Expected: no results in the recharge or landing-page pricing copy paths
