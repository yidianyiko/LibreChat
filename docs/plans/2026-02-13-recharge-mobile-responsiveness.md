# Recharge Pages Mobile Responsiveness Fix

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all mobile responsiveness issues across the 5 Recharge page components so they match the responsive patterns used throughout the rest of LibreChat.

**Architecture:** Pure CSS/Tailwind changes. No new components, no new dependencies. The RechargeHistoryPage table gets a mobile card layout (hidden on desktop) alongside the existing table (hidden on mobile), following the `hidden md:block` / `md:hidden` pattern used by DataTable and Nav components. All other pages get progressive responsive Tailwind classes for font sizes, padding, and spacing.

**Tech Stack:** Tailwind CSS responsive utilities, existing `useMediaQuery` hook (only for RechargeHistoryPage mobile card layout)

---

### Task 1: PricingCard — Fix scale overflow and mobile padding

**Files:**
- Modify: `client/src/components/Recharge/PricingCard.tsx:62-68` (card container)
- Modify: `client/src/components/Recharge/PricingCard.tsx:85-87` (price display)

**Step 1: Fix the card container classes**

In `PricingCard.tsx`, line 64, change the card's className. The `scale-105` must only apply on `lg:` breakpoint (when cards are side-by-side in 3-col grid). Padding must scale progressively.

Replace:
```tsx
      className={`p-8 md:p-10 rounded-[3rem] border transition-all duration-500 flex flex-col shadow-sm ${
        recommended
          ? 'bg-black text-white border-black shadow-2xl scale-105 z-10'
          : 'bg-white border-gray-100 text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white'
      }`}
```

With:
```tsx
      className={`p-5 sm:p-6 md:p-8 lg:p-10 rounded-[2rem] sm:rounded-[3rem] border transition-all duration-500 flex flex-col shadow-sm ${
        recommended
          ? 'bg-black text-white border-black shadow-2xl lg:scale-105 z-10'
          : 'bg-white border-gray-100 text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white'
      }`}
```

**Step 2: Fix price font size**

In `PricingCard.tsx`, line 86, change the price display:

Replace:
```tsx
          <span className="text-5xl font-black tracking-tight">${formattedPrice}</span>
```

With:
```tsx
          <span className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight">${formattedPrice}</span>
```

**Step 3: Fix section spacing**

In `PricingCard.tsx`, line 70, change the top section margin:

Replace:
```tsx
      <div className="mb-8 md:mb-10 text-left">
```

With:
```tsx
      <div className="mb-6 sm:mb-8 md:mb-10 text-left">
```

**Step 4: Fix button bottom margin**

In `PricingCard.tsx`, line 95, the button's className — find `mb-8 md:mb-10`:

Replace:
```tsx
        className={`w-full py-4 mb-8 md:mb-10 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
```

With:
```tsx
        className={`w-full py-3 sm:py-4 mb-6 sm:mb-8 md:mb-10 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
```

**Step 5: Run existing test to verify no regression**

Run: `cd client && npm test -- --testPathPattern="Recharge" --no-coverage`
Expected: PASS — existing RechargePage test still passes (it checks text content, not CSS classes)

**Step 6: Commit**

```bash
git add client/src/components/Recharge/PricingCard.tsx
git commit -m "fix: improve PricingCard mobile responsiveness

- Progressive padding (p-5 → sm:p-6 → md:p-8 → lg:p-10)
- scale-105 only on lg: to prevent horizontal overflow on mobile
- Progressive price font size (text-3xl → sm:4xl → md:5xl)
- Responsive spacing and button padding"
```

---

### Task 2: RechargePage — Fix heading, subtitle, and layout spacing

**Files:**
- Modify: `client/src/components/Recharge/RechargePage.tsx:141` (container padding)
- Modify: `client/src/components/Recharge/RechargePage.tsx:148-157` (heading section)
- Modify: `client/src/components/Recharge/RechargePage.tsx:160` (grid gap)

**Step 1: Fix container padding and vertical spacing**

In `RechargePage.tsx`, line 141:

Replace:
```tsx
    <div className="bg-[#fcfcf9] dark:bg-gray-900 py-24 md:py-32 px-6 md:px-10">
```

With:
```tsx
    <div className="bg-[#fcfcf9] dark:bg-gray-900 py-12 sm:py-16 md:py-24 lg:py-32 px-4 sm:px-6 md:px-10">
```

**Step 2: Fix heading section bottom margin**

In `RechargePage.tsx`, line 148:

Replace:
```tsx
        <div className="mb-16 md:mb-24 text-center">
```

With:
```tsx
        <div className="mb-8 sm:mb-12 md:mb-16 lg:mb-24 text-center">
```

**Step 3: Fix h1 heading font size**

In `RechargePage.tsx`, line 150:

Replace:
```tsx
            className="text-4xl md:text-6xl font-black mb-6 text-gray-900 dark:text-white"
```

With:
```tsx
            className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-black mb-4 sm:mb-6 text-gray-900 dark:text-white"
```

**Step 4: Fix subtitle font size**

In `RechargePage.tsx`, line 155:

Replace:
```tsx
          <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
```

With:
```tsx
          <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg font-medium">
```

**Step 5: Fix grid gap for mobile**

In `RechargePage.tsx`, line 160:

Replace:
```tsx
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left items-stretch">
```

With:
```tsx
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 text-left items-stretch">
```

**Step 6: Run test**

Run: `cd client && npm test -- --testPathPattern="Recharge" --no-coverage`
Expected: PASS

**Step 7: Commit**

```bash
git add client/src/components/Recharge/RechargePage.tsx
git commit -m "fix: improve RechargePage mobile responsiveness

- Progressive container padding (px-4 → sm:px-6 → md:px-10)
- Progressive vertical spacing (py-12 → sm:py-16 → md:py-24 → lg:py-32)
- Progressive heading size (text-2xl → sm:3xl → md:4xl → lg:6xl)
- Responsive subtitle, grid gap, and section margins"
```

---

### Task 3: RechargeHistoryPage — Mobile card layout for table

This is the most complex task. The existing `<table>` overflows on mobile. We add a mobile card layout that shows on small screens and hide the table on mobile.

**Files:**
- Modify: `client/src/components/Recharge/RechargeHistoryPage.tsx`

**Step 1: Fix heading responsive size**

In `RechargeHistoryPage.tsx`, line 40:

Replace:
```tsx
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
```

With:
```tsx
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
```

**Step 2: Add mobile card layout and hide table on mobile**

In `RechargeHistoryPage.tsx`, replace the entire table section (lines 62-105). The current code:

```tsx
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  Credits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  Session ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {history.map((item) => {
                const formattedCredits = (item.credits / 1000000).toFixed(1);
                const formattedAmount = (item.amount / 100).toFixed(2);
                const date = new Date(item.createdAt).toLocaleDateString();

                return (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {date}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {formattedCredits}M
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      ${formattedAmount}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-500 dark:text-gray-400">
                      {item.sessionId.slice(0, 20)}...
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
```

Replace with:

```tsx
        {/* Mobile card layout */}
        <div className="space-y-3 md:hidden">
          {history.map((item) => {
            const formattedCredits = (item.credits / 1000000).toFixed(1);
            const formattedAmount = (item.amount / 100).toFixed(2);
            const date = new Date(item.createdAt).toLocaleDateString();

            return (
              <div
                key={item.id}
                className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formattedCredits}M Credits
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    ${formattedAmount}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{date}</span>
                  <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                    {item.sessionId.slice(0, 12)}...
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop table layout */}
        <div className="hidden md:block overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  Credits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  Session ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {history.map((item) => {
                const formattedCredits = (item.credits / 1000000).toFixed(1);
                const formattedAmount = (item.amount / 100).toFixed(2);
                const date = new Date(item.createdAt).toLocaleDateString();

                return (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {date}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {formattedCredits}M
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      ${formattedAmount}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-500 dark:text-gray-400">
                      {item.sessionId.slice(0, 20)}...
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
```

**Step 3: Fix empty state emoji size**

In `RechargeHistoryPage.tsx`, line 50:

Replace:
```tsx
          <div className="mb-4 text-5xl">📭</div>
```

With:
```tsx
          <div className="mb-4 text-4xl sm:text-5xl">📭</div>
```

**Step 4: Fix bottom button to be full-width on mobile**

In `RechargeHistoryPage.tsx`, line 110-111:

Replace:
```tsx
          <button
            onClick={() => navigate('/recharge')}
            className="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
```

With:
```tsx
          <button
            onClick={() => navigate('/recharge')}
            className="w-full sm:w-auto rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
```

**Step 5: Run test**

Run: `cd client && npm test -- --testPathPattern="Recharge" --no-coverage`
Expected: PASS

**Step 6: Commit**

```bash
git add client/src/components/Recharge/RechargeHistoryPage.tsx
git commit -m "fix: add mobile card layout for RechargeHistoryPage

- Add card-based layout for mobile (md:hidden) to replace table
- Hide table on mobile (hidden md:block) to prevent horizontal overflow
- Responsive heading size and emoji size
- Full-width button on mobile"
```

---

### Task 4: PaymentSuccessPage — Fix spacing and font sizes

**Files:**
- Modify: `client/src/components/Recharge/PaymentSuccessPage.tsx:59-95`

**Step 1: Fix the success content wrapper — add horizontal padding**

In `PaymentSuccessPage.tsx`, line 61:

Replace:
```tsx
      <div className="max-w-md text-center">
```

With:
```tsx
      <div className="max-w-md px-4 sm:px-6 text-center">
```

**Step 2: Fix emoji size**

In `PaymentSuccessPage.tsx`, line 62:

Replace:
```tsx
        <div className="mb-6 text-6xl">✅</div>
```

With:
```tsx
        <div className="mb-4 sm:mb-6 text-5xl sm:text-6xl">✅</div>
```

**Step 3: Fix heading size**

In `PaymentSuccessPage.tsx`, line 63:

Replace:
```tsx
        <h1 className="text-3xl font-bold text-green-600 dark:text-green-400">
```

With:
```tsx
        <h1 className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">
```

**Step 4: Fix info box padding**

In `PaymentSuccessPage.tsx`, line 70:

Replace:
```tsx
        <div className="mt-8 rounded-lg bg-gray-100 p-6 dark:bg-gray-800">
```

With:
```tsx
        <div className="mt-6 sm:mt-8 rounded-lg bg-gray-100 p-4 sm:p-6 dark:bg-gray-800">
```

**Step 5: Fix credits number size**

In `PaymentSuccessPage.tsx`, line 74:

Replace:
```tsx
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
```

With:
```tsx
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
```

**Step 6: Fix button top margin**

In `PaymentSuccessPage.tsx`, line 84:

Replace:
```tsx
          className="mt-8 w-full rounded-lg bg-green-600 px-6 py-3 text-white hover:bg-green-700"
```

With:
```tsx
          className="mt-6 sm:mt-8 w-full rounded-lg bg-green-600 px-6 py-3 text-white hover:bg-green-700"
```

**Step 7: Apply the same fixes to the error state (lines 36-53)**

In `PaymentSuccessPage.tsx`, line 38:

Replace:
```tsx
          <div className="mb-4 text-6xl">❌</div>
```

With:
```tsx
          <div className="mb-4 text-5xl sm:text-6xl">❌</div>
```

**Step 8: Run test**

Run: `cd client && npm test -- --testPathPattern="Recharge" --no-coverage`
Expected: PASS

**Step 9: Commit**

```bash
git add client/src/components/Recharge/PaymentSuccessPage.tsx
git commit -m "fix: improve PaymentSuccessPage mobile responsiveness

- Add horizontal padding to content wrapper
- Progressive emoji, heading, and credits number sizes
- Responsive info box padding and button margins"
```

---

### Task 5: PaymentCancelPage — Fix spacing and font sizes

**Files:**
- Modify: `client/src/components/Recharge/PaymentCancelPage.tsx:8-33`

**Step 1: Fix content wrapper — add horizontal padding**

In `PaymentCancelPage.tsx`, line 9:

Replace:
```tsx
      <div className="max-w-md text-center">
```

With:
```tsx
      <div className="max-w-md px-4 sm:px-6 text-center">
```

**Step 2: Fix emoji size**

In `PaymentCancelPage.tsx`, line 10:

Replace:
```tsx
        <div className="mb-6 text-6xl">❌</div>
```

With:
```tsx
        <div className="mb-4 sm:mb-6 text-5xl sm:text-6xl">❌</div>
```

**Step 3: Fix heading size**

In `PaymentCancelPage.tsx`, line 11:

Replace:
```tsx
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
```

With:
```tsx
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
```

**Step 4: Fix button top margin**

In `PaymentCancelPage.tsx`, line 20:

Replace:
```tsx
          className="mt-8 w-full rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
```

With:
```tsx
          className="mt-6 sm:mt-8 w-full rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
```

**Step 5: Run test**

Run: `cd client && npm test -- --testPathPattern="Recharge" --no-coverage`
Expected: PASS

**Step 6: Commit**

```bash
git add client/src/components/Recharge/PaymentCancelPage.tsx
git commit -m "fix: improve PaymentCancelPage mobile responsiveness

- Add horizontal padding to content wrapper
- Progressive emoji and heading sizes
- Responsive button margin"
```

---

### Task 6: Run full test suite and lint check

**Files:** None (verification only)

**Step 1: Run all Recharge-related tests**

Run: `cd client && npm test -- --testPathPattern="Recharge" --no-coverage`
Expected: All tests PASS

**Step 2: Run lint check on modified files**

Run: `npx eslint client/src/components/Recharge/PricingCard.tsx client/src/components/Recharge/RechargePage.tsx client/src/components/Recharge/RechargeHistoryPage.tsx client/src/components/Recharge/PaymentSuccessPage.tsx client/src/components/Recharge/PaymentCancelPage.tsx`
Expected: No errors

**Step 3: Verify build succeeds**

Run: `npm run frontend`
Expected: Build completes without errors
