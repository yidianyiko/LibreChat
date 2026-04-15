# LibreChat WeChat Home Button Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a decorative WeChat icon to the home-visible WeChat quick action without changing its existing behavior or accessible name.

**Architecture:** Keep the change inside the existing frontend WeChat quick-action component. Lock the behavior with a failing component test first, then add the minimal inline SVG needed to render the icon next to the localized label.

**Tech Stack:** React, TypeScript, Jest, Testing Library

---

### Task 1: Render The WeChat Quick-Action Icon

**Files:**
- Modify: `client/src/components/Nav/WeChat/__tests__/WeChatQuickAction.spec.tsx`
- Modify: `client/src/components/Nav/WeChat/WeChatQuickAction.tsx`

- [ ] **Step 1: Write the failing test**

```ts
  it('renders a decorative WeChat icon in the quick action button', () => {
    render(<WeChatQuickAction />);

    const wechatButton = screen.getByRole('button', { name: 'WeChat' });

    expect(wechatButton.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx jest src/components/Nav/WeChat/__tests__/WeChatQuickAction.spec.tsx --runInBand`
Expected: FAIL because the current quick action renders text only and does not include an SVG icon.

- [ ] **Step 3: Write minimal implementation**

```tsx
function WeChatIcon() {
  return (
    <svg
      aria-hidden="true"
      className="icon-md flex-shrink-0 text-[#07C160]"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="..." />
    </svg>
  );
}

<Button aria-label={localize('com_nav_wechat_binding')} onClick={openDialog}>
  <WeChatIcon />
  <span>{localize('com_nav_wechat_binding')}</span>
</Button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx jest src/components/Nav/WeChat/__tests__/WeChatQuickAction.spec.tsx --runInBand`
Expected: PASS with the button now containing a decorative SVG icon and all existing WeChat quick-action assertions still green.

- [ ] **Step 5: Review final diff**

Run: `git diff -- client/src/components/Nav/WeChat/WeChatQuickAction.tsx client/src/components/Nav/WeChat/__tests__/WeChatQuickAction.spec.tsx`
Expected: Only the quick-action SVG rendering and the new icon assertion appear.
