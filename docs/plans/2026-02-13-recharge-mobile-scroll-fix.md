# Recharge Pages Mobile Scroll Fix

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 4 Recharge pages so they scroll correctly on mobile within Root.tsx's constrained layout.

**Architecture:** Root.tsx wraps all pages in a fixed-height container (`calc(100dvh - bannerHeight)`) with `overflow-hidden`. Working pages (Chat, Marketplace) use `h-full overflow-y-auto` on their root element. Recharge pages lack this pattern and also misuse `h-screen` (100vh) which overflows the parent. Fix by adopting the same scroll pattern used throughout the codebase.

**Tech Stack:** React, Tailwind CSS

---

## Problem Summary

Two issues across all 4 Recharge components:

1. **No scroll container:** RechargePage and RechargeHistoryPage content overflows on mobile but can't scroll because the parent has `overflow-hidden` and the pages don't create their own scroll context.
2. **`h-screen` misuse:** All 4 pages use `h-screen` (= `100vh`) in loading/error/success states, but they render inside Root which constrains height to `calc(100dvh - bannerHeight)`. This causes content to extend beyond the visible area by the banner height.

## Proven Pattern (from Marketplace.tsx)

```tsx
// Outer: fill parent, enable vertical scroll
<div className="relative flex h-full w-full grow overflow-hidden">
  <div className="h-full overflow-y-auto">
    {/* scrollable content */}
  </div>
</div>
```

The minimal version used across the project: wrap page content in a `h-full overflow-y-auto` container.

---

### Task 1: Fix RechargePage scroll and h-screen

**Files:**
- Modify: `client/src/components/Recharge/RechargePage.tsx`

**Step 1: Update loading state — replace `h-screen` with `h-full`**

Line 85: change `h-screen` → `h-full`

```tsx
// Before
<div className="flex h-screen items-center justify-center">

// After
<div className="flex h-full items-center justify-center">
```

**Step 2: Update error state — replace `h-screen` with `h-full`**

Line 95: change `h-screen` → `h-full`

```tsx
// Before
<div className="flex h-screen flex-col items-center justify-center gap-2 px-4">

// After
<div className="flex h-full flex-col items-center justify-center gap-2 px-4">
```

**Step 3: Wrap the main content return in a scroll container**

Line 127: wrap the existing outer div in a `h-full overflow-y-auto` container.

```tsx
// Before (line 127)
return (
  <div className="bg-[#fcfcf9] px-4 py-12 dark:bg-gray-900 sm:px-6 sm:py-16 md:px-10 md:py-24 lg:py-32">

// After
return (
  <div className="h-full overflow-y-auto">
    <div className="bg-[#fcfcf9] px-4 py-12 dark:bg-gray-900 sm:px-6 sm:py-16 md:px-10 md:py-24 lg:py-32">
```

And add matching closing `</div>` after line 163's closing `</div>`.

**Step 4: Verify visually**

Run: `npm run frontend:dev`
- On mobile viewport (Chrome DevTools, 375px width): all 3 pricing cards should be visible by scrolling down
- On desktop: layout should look identical to before (3-column grid)
- Loading spinner should be vertically centered within the page area (not pushed down by banner)

**Step 5: Commit**

```bash
git add client/src/components/Recharge/RechargePage.tsx
git commit -m "fix: enable mobile scrolling on RechargePage"
```

---

### Task 2: Fix RechargeHistoryPage scroll and h-screen

**Files:**
- Modify: `client/src/components/Recharge/RechargeHistoryPage.tsx`

**Step 1: Update loading state — replace `h-screen` with `h-full`**

Line 11: change `h-screen` → `h-full`

```tsx
// Before
<div className="flex h-screen items-center justify-center">

// After
<div className="flex h-full items-center justify-center">
```

**Step 2: Update error state — replace `h-screen` with `h-full`**

Line 19: change `h-screen` → `h-full`

```tsx
// Before
<div className="flex h-screen flex-col items-center justify-center">

// After
<div className="flex h-full flex-col items-center justify-center">
```

**Step 3: Wrap the main content return in a scroll container**

Line 34: wrap the existing outer div in a `h-full overflow-y-auto` container.

```tsx
// Before (line 34)
return (
  <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">

// After
return (
  <div className="h-full overflow-y-auto">
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
```

And add matching closing `</div>` after line 141's closing `</div>`.

**Step 4: Verify visually**

Run: `npm run frontend:dev`
- On mobile viewport: history cards should scroll vertically
- On desktop: table layout should look identical to before

**Step 5: Commit**

```bash
git add client/src/components/Recharge/RechargeHistoryPage.tsx
git commit -m "fix: enable mobile scrolling on RechargeHistoryPage"
```

---

### Task 3: Fix PaymentSuccessPage h-screen

**Files:**
- Modify: `client/src/components/Recharge/PaymentSuccessPage.tsx`

**Step 1: Replace all `h-screen` with `h-full`**

3 occurrences at lines 23, 34, 58. Replace all.

```tsx
// Before (all 3 locations)
<div className="flex h-screen items-center justify-center">

// After (all 3 locations)
<div className="flex h-full items-center justify-center">
```

**Step 2: Verify visually**

- Success content should be vertically centered within the page area, not pushed down by banner height

**Step 3: Commit**

```bash
git add client/src/components/Recharge/PaymentSuccessPage.tsx
git commit -m "fix: replace h-screen with h-full in PaymentSuccessPage"
```

---

### Task 4: Fix PaymentCancelPage h-screen

**Files:**
- Modify: `client/src/components/Recharge/PaymentCancelPage.tsx`

**Step 1: Replace `h-screen` with `h-full`**

Line 8: one occurrence.

```tsx
// Before
<div className="flex h-screen items-center justify-center">

// After
<div className="flex h-full items-center justify-center">
```

**Step 2: Verify visually**

- Cancel content should be vertically centered within the page area

**Step 3: Commit**

```bash
git add client/src/components/Recharge/PaymentCancelPage.tsx
git commit -m "fix: replace h-screen with h-full in PaymentCancelPage"
```

---

## Verification Checklist

After all tasks, verify on mobile viewport (375px):

- [ ] RechargePage: can scroll to see all 3 pricing cards
- [ ] RechargePage loading state: centered in page area
- [ ] RechargePage error state: centered in page area
- [ ] RechargeHistoryPage: can scroll through history entries
- [ ] PaymentSuccessPage: centered in page area, not overflowing
- [ ] PaymentCancelPage: centered in page area, not overflowing
- [ ] Desktop (1280px): all pages look unchanged
