# Admin Analytics Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the admin analytics page using only existing persisted data so administrators can assess growth, usage, and quality without adding new tracking instrumentation.

**Architecture:** Keep the existing `/api/admin/stats` entrypoint, but extend its response from a registration-focused payload into a structured analytics payload with overview cards, daily trend series, and usage-quality breakdowns. Do all heavy aggregation on the backend once per request, expose the shape through `packages/data-provider`, and keep the frontend focused on presentation with small chart components.

**Tech Stack:** Express, MongoDB/Mongoose, TypeScript in `packages/data-provider`, React, React Query, Recharts, Jest

---

## File Map

**Modify**
- `api/server/routes/admin/stats.js`
  - Expand the aggregate response with overview metrics, daily usage series, endpoint distribution, model distribution, and quality metrics.
- `api/server/routes/admin/__tests__/stats.spec.js`
  - Cover the new payload shape, empty-state behavior, and null/unknown bucket handling.
- `packages/data-provider/src/admin-stats.ts`
  - Replace the loose index-signature response type with explicit admin analytics types.
- `packages/data-provider/src/data-service.ts`
  - Update `TAdminStatsResponse` to match the new shared type shape.
- `client/src/routes/Stats/StatsPage.tsx`
  - Rebuild the page layout around overview cards plus grouped charts.
- `client/src/routes/Stats/components/DailyRegistrationChart.tsx`
  - Either narrow responsibility to registration-only data or convert into a generic time-series bar/line chart wrapper, depending on the implementation chosen during Task 4.
- `client/src/routes/Stats/components/ProviderPieChart.tsx`
  - Reuse for registration provider distribution or generalize into a labeled distribution chart.
- `client/src/locales/en/translation.json`
  - Add English strings for new cards, chart titles, subtitles, and empty states.

**Create**
- `client/src/routes/Stats/components/ActivityTrendChart.tsx`
  - Daily active users, messages, and conversations trend chart.
- `client/src/routes/Stats/components/DistributionBarChart.tsx`
  - Endpoint and model distribution visualization.
- `client/src/routes/Stats/components/QualityMetricsCard.tsx`
  - Compact presentation for error rate and feedback rate.

**Optional Create If Reuse Gets Messy**
- `client/src/routes/Stats/components/StatsSection.tsx`
  - Small layout wrapper for grouped chart sections if `StatsPage.tsx` starts to bloat.

---

### Task 1: Lock the response contract before implementation

**Files:**
- Modify: `packages/data-provider/src/admin-stats.ts`
- Modify: `packages/data-provider/src/data-service.ts`

- [ ] **Step 1: Replace the loose response type with explicit nested types**

Define a stable response model in `packages/data-provider/src/admin-stats.ts`:

```ts
export type TTimeRangeCount = {
  last1Day: number;
  last7Days: number;
  last30Days: number;
};

export type TDailyRegistration = {
  date: string;
  total: number;
  providers: Array<{
    key: string;
    count: number;
  }>;
};

export type TDailyUsage = {
  date: string;
  activeUsers: number;
  messages: number;
  conversations: number;
  errors: number;
};

export type TDistributionBucket = {
  key: string;
  label: string;
  count: number;
};

export type TAdminStatsResponse = {
  overview: {
    totalUsers: number;
    newUsers: TTimeRangeCount;
    activeUsers: TTimeRangeCount;
    messages: TTimeRangeCount;
    conversations: TTimeRangeCount;
    activeRateLast7Days: number;
    messagesPerActiveUserLast7Days: number;
    errorRateLast7Days: number;
    negativeFeedbackRateLast7Days: number;
  };
  registration: {
    daily: TDailyRegistration[];
    byProvider: TDistributionBucket[];
  };
  usage: {
    daily: TDailyUsage[];
    byEndpoint: TDistributionBucket[];
    byModel: TDistributionBucket[];
  };
  quality: {
    errorsLast7Days: number;
    assistantMessagesLast7Days: number;
    feedbackCountLast7Days: number;
    negativeFeedbackCountLast7Days: number;
  };
};
```

- [ ] **Step 2: Point the fetch hook and data service to the shared type**

Make `packages/data-provider/src/admin-stats.ts` and `packages/data-provider/src/data-service.ts` use the same exported `TAdminStatsResponse` instead of maintaining parallel inline interfaces.

- [ ] **Step 3: Verify imports remain stable**

Run: `rg -n "TAdminStatsResponse|AdminStats" packages/data-provider client`

Expected: all admin stats typing references point to the updated shared type and there is no duplicated response interface left behind.

- [ ] **Step 4: Commit**

```bash
git add packages/data-provider/src/admin-stats.ts packages/data-provider/src/data-service.ts
git commit -m "refactor: define explicit admin analytics response types"
```

---

### Task 2: Expand backend analytics aggregation

**Files:**
- Modify: `api/server/routes/admin/stats.js`
- Test: `api/server/routes/admin/__tests__/stats.spec.js`

- [ ] **Step 1: Write the failing route test for the new response shape**

Extend `api/server/routes/admin/__tests__/stats.spec.js` to expect a payload shaped like:

```js
expect(response.body).toEqual({
  overview: {
    totalUsers: 100,
    newUsers: { last1Day: 2, last7Days: 15, last30Days: 40 },
    activeUsers: { last1Day: 4, last7Days: 8, last30Days: 20 },
    messages: { last1Day: 25, last7Days: 120, last30Days: 420 },
    conversations: { last1Day: 6, last7Days: 32, last30Days: 110 },
    activeRateLast7Days: 0.08,
    messagesPerActiveUserLast7Days: 15,
    errorRateLast7Days: 0.1,
    negativeFeedbackRateLast7Days: 0.25,
  },
  registration: {
    daily: expect.any(Array),
    byProvider: expect.any(Array),
  },
  usage: {
    daily: expect.any(Array),
    byEndpoint: expect.any(Array),
    byModel: expect.any(Array),
  },
  quality: {
    errorsLast7Days: 9,
    assistantMessagesLast7Days: 90,
    feedbackCountLast7Days: 12,
    negativeFeedbackCountLast7Days: 3,
  },
});
```

- [ ] **Step 2: Run the focused route test and verify it fails**

Run: `cd api && npx jest server/routes/admin/__tests__/stats.spec.js --runInBand`

Expected: FAIL because the route still returns the old flat response shape.

- [ ] **Step 3: Implement minimal backend helpers for reusable windows**

Inside `api/server/routes/admin/stats.js`, add small helpers such as:

```js
const clampDays = (value) => Math.min(Math.max(parseInt(value, 10) || 30, 1), 365);

const getStartOfDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
};

const toDistributionBuckets = (items, fallback = 'unknown') =>
  items.map(({ _id, count }) => ({
    key: _id || fallback,
    label: _id || fallback,
    count,
  }));
```

- [ ] **Step 4: Implement overview metrics using existing collections only**

Add queries for:

```js
const [totalUsers, newUsers1d, newUsers7d, newUsers30d] = await Promise.all([
  User.countDocuments(),
  User.countDocuments({ createdAt: { $gte: last1Day } }),
  User.countDocuments({ createdAt: { $gte: last7Days } }),
  User.countDocuments({ createdAt: { $gte: last30Days } }),
]);

const [activeUsers1d, activeUsers7d, activeUsers30d] = await Promise.all([
  Message.distinct('user', { createdAt: { $gte: last1Day } }),
  Message.distinct('user', { createdAt: { $gte: last7Days } }),
  Message.distinct('user', { createdAt: { $gte: last30Days } }),
]);
```

Also compute:
- message counts from `Message.countDocuments`
- conversation counts from `Conversation.countDocuments`
- assistant message counts using `{ isCreatedByUser: false }`
- error counts using `{ error: true }`
- feedback counts using `{ feedback: { $exists: true } }`
- negative feedback counts using `{ 'feedback.rating': 'thumbsDown' }`

- [ ] **Step 5: Implement daily usage aggregation**

Add one aggregate over `Message` for the selected `days` window:

```js
const dailyUsage = await Message.aggregate([
  { $match: { createdAt: { $gte: startDate } } },
  {
    $group: {
      _id: {
        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        user: '$user',
      },
      messages: { $sum: 1 },
      errors: {
        $sum: { $cond: [{ $eq: ['$error', true] }, 1, 0] },
      },
    },
  },
  {
    $group: {
      _id: '$_id.date',
      activeUsers: { $sum: 1 },
      messages: { $sum: '$messages' },
      errors: { $sum: '$errors' },
    },
  },
  { $sort: { _id: 1 } },
]);
```

Add a second aggregate over `Conversation` for daily conversation counts, then merge by date in JavaScript with a `Map` so the route does not do repeated `Array.find` scans.

- [ ] **Step 6: Implement endpoint/model distributions**

Aggregate `Message` over the last 7 days:

```js
const usageByEndpoint = await Message.aggregate([
  { $match: { createdAt: { $gte: last7Days } } },
  { $group: { _id: '$endpoint', count: { $sum: 1 } } },
  { $sort: { count: -1, _id: 1 } },
]);

const usageByModel = await Message.aggregate([
  { $match: { createdAt: { $gte: last7Days }, model: { $nin: [null, ''] } } },
  { $group: { _id: '$model', count: { $sum: 1 } } },
  { $sort: { count: -1, _id: 1 } },
  { $limit: 10 },
]);
```

- [ ] **Step 7: Return the new structured payload**

Use defensive rate calculations:

```js
const divide = (numerator, denominator) => (denominator > 0 ? numerator / denominator : 0);
```

Then return:

```js
res.json({
  overview: { ... },
  registration: { daily: dailyRegistrationsFormatted, byProvider: providerBuckets },
  usage: { daily: dailyUsageFormatted, byEndpoint: endpointBuckets, byModel: modelBuckets },
  quality: { ... },
});
```

- [ ] **Step 8: Update empty-state tests**

Add expectations that the route returns:
- zeroed time-range objects
- empty arrays for all chart series/distributions
- zero quality counters

- [ ] **Step 9: Run the route tests and make them pass**

Run: `cd api && npx jest server/routes/admin/__tests__/stats.spec.js --runInBand`

Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add api/server/routes/admin/stats.js api/server/routes/admin/__tests__/stats.spec.js
git commit -m "feat: expand admin analytics backend metrics"
```

---

### Task 3: Wire the shared query layer through the client

**Files:**
- Modify: `packages/data-provider/src/admin-stats.ts`
- Modify: `packages/data-provider/src/index.ts`
- Modify: `client/src/data-provider/queries.ts`

- [ ] **Step 1: Write the failing client-side type check mentally, then make the hook consistent**

Update the client hook return type to the new shared response:

```ts
export const useGetAdminStats = (
  params: { days?: number } = {},
  options?: Omit<UseQueryOptions<TAdminStatsResponse>, 'queryKey' | 'queryFn'>,
) => { ... };
```

- [ ] **Step 2: Ensure only one hook source is used by the page**

The repo currently exposes a `packages/data-provider` hook and a client-local query hook. Decide on one path and keep it consistent. Preferred direction: continue importing from `~/data-provider` only if that module already re-exports the client query hook; otherwise switch `StatsPage.tsx` to the client-local hook used elsewhere in the app.

- [ ] **Step 3: Verify query import paths**

Run: `rg -n "useGetAdminStats" client packages/data-provider`

Expected: one clear hook implementation and one clear import path used by the page.

- [ ] **Step 4: Commit**

```bash
git add packages/data-provider/src/admin-stats.ts packages/data-provider/src/index.ts client/src/data-provider/queries.ts
git commit -m "refactor: align admin analytics query typing"
```

---

### Task 4: Rebuild the stats page around grouped analytics sections

**Files:**
- Modify: `client/src/routes/Stats/StatsPage.tsx`
- Create: `client/src/routes/Stats/components/ActivityTrendChart.tsx`
- Create: `client/src/routes/Stats/components/DistributionBarChart.tsx`
- Create: `client/src/routes/Stats/components/QualityMetricsCard.tsx`
- Optional Create: `client/src/routes/Stats/components/StatsSection.tsx`

- [ ] **Step 1: Write or update component tests if the route already has them**

If there are no existing tests for `StatsPage`, create them before the implementation. Cover:
- loading state
- admin access denied state
- overview cards render with new metrics
- charts receive transformed data

If adding tests is too costly for the route in this pass, explicitly document the gap in the commit message and cover at least one rendering test for the new cards.

- [ ] **Step 2: Update `StatsPage.tsx` to consume the new response shape**

Restructure the page into sections:

```tsx
<div className="space-y-6">
  <OverviewCards ... />
  <section className="grid gap-6 lg:grid-cols-2">
    <DailyRegistrationChart data={stats.registration.daily} />
    <ActivityTrendChart data={stats.usage.daily} />
  </section>
  <section className="grid gap-6 lg:grid-cols-2">
    <ProviderPieChart data={stats.registration.byProvider} />
    <DistributionBarChart title={...} data={stats.usage.byEndpoint} />
  </section>
  <section className="grid gap-6 lg:grid-cols-2">
    <DistributionBarChart title={...} data={stats.usage.byModel} />
    <QualityMetricsCard quality={stats.quality} overview={stats.overview} />
  </section>
</div>
```

- [ ] **Step 3: Keep cards small and specific**

Drive the overview cards from explicit values:

```tsx
[
  { title: localize('com_ui_total_users'), value: stats.overview.totalUsers },
  { title: localize('com_ui_new_users_7d'), value: stats.overview.newUsers.last7Days },
  { title: localize('com_ui_active_users_7d'), value: stats.overview.activeUsers.last7Days },
  { title: localize('com_ui_messages_7d'), value: stats.overview.messages.last7Days },
  { title: localize('com_ui_conversations_7d'), value: stats.overview.conversations.last7Days },
  { title: localize('com_ui_active_rate_7d'), value: `${(stats.overview.activeRateLast7Days * 100).toFixed(1)}%` },
]
```

Do not hide formulas inside presentation components.

- [ ] **Step 4: Implement the missing chart components with simple, stable props**

Example `DistributionBarChart` prop:

```ts
type DistributionBarChartProps = {
  title: string;
  data: Array<{
    key: string;
    label: string;
    count: number;
  }>;
};
```

Example `ActivityTrendChart` prop:

```ts
type ActivityTrendChartProps = {
  data: Array<{
    date: string;
    activeUsers: number;
    messages: number;
    conversations: number;
    errors: number;
  }>;
};
```

- [ ] **Step 5: Keep existing chart components only if their props stay honest**

If `DailyRegistrationChart.tsx` still uses ad hoc `googleCount/localCount` fields, refactor it to consume:

```ts
type DailyRegistrationChartProps = {
  data: Array<{
    date: string;
    total: number;
    providers: Array<{ key: string; count: number }>;
  }>;
};
```

Transform to Recharts input inside the component with a single pass.

Similarly, if `ProviderPieChart.tsx` receives an array of distribution buckets, stop converting from a `Record<string, number>` in the parent.

- [ ] **Step 6: Run the relevant frontend test slice**

Run one of:
- `npm test -- StatsPage`
- `cd client && npx jest src/routes/Stats --runInBand`

Expected: PASS for the updated route/components.

- [ ] **Step 7: Commit**

```bash
git add client/src/routes/Stats
git commit -m "feat: redesign admin stats page for analytics overview"
```

---

### Task 5: Localize the new labels and section titles

**Files:**
- Modify: `client/src/locales/en/translation.json`

- [ ] **Step 1: Add only the English keys needed by the new UI**

Add keys such as:

```json
"com_ui_messages_7d": "Messages (7d)",
"com_ui_conversations_7d": "Conversations (7d)",
"com_ui_active_rate_7d": "Active Rate (7d)",
"com_ui_messages_per_active_user_7d": "Messages per Active User (7d)",
"com_ui_error_rate_7d": "Error Rate (7d)",
"com_ui_negative_feedback_rate_7d": "Negative Feedback Rate (7d)",
"com_ui_usage_trends": "Usage Trends",
"com_ui_usage_by_endpoint": "Usage by Endpoint",
"com_ui_usage_by_model": "Usage by Model",
"com_ui_quality_overview": "Quality Overview"
```

- [ ] **Step 2: Verify no hard-coded user-facing strings remain in stats components**

Run: `rg -n "\"[A-Za-z][^\"]*\"" client/src/routes/Stats`

Expected: remaining string literals are class names, data keys, or non-user-facing chart internals.

- [ ] **Step 3: Commit**

```bash
git add client/src/locales/en/translation.json client/src/routes/Stats
git commit -m "chore: localize expanded admin analytics labels"
```

---

### Task 6: Final verification and cleanup

**Files:**
- Modify as needed based on verification failures

- [ ] **Step 1: Run backend route tests**

Run: `cd api && npx jest server/routes/admin/__tests__/stats.spec.js --runInBand`

Expected: PASS

- [ ] **Step 2: Run frontend tests for the stats route/components**

Run: `cd client && npx jest src/routes/Stats --runInBand`

Expected: PASS

- [ ] **Step 3: Rebuild shared data-provider output if required by the repo workflow**

Run: `npm run build:data-provider`

Expected: successful build with no type errors.

- [ ] **Step 4: Sanity-check touched files for formatting and type drift**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only intended files modified.

- [ ] **Step 5: Commit the verification fixes**

```bash
git add api/server/routes/admin/stats.js api/server/routes/admin/__tests__/stats.spec.js packages/data-provider/src/admin-stats.ts packages/data-provider/src/data-service.ts client/src/routes/Stats client/src/locales/en/translation.json
git commit -m "test: verify expanded admin analytics flow"
```

---

## Implementation Notes

- Keep `/api/server/routes/admin/stats.js` as the only JS backend entrypoint touched unless a helper extraction becomes necessary. New backend logic should stay minimal and local because this repo explicitly prefers new backend work in TypeScript and minimal legacy JS changes.
- Avoid `Record<string, number | string>` response shapes. The frontend already has enough complexity; explicit arrays are easier to type, transform, and test.
- Limit repeated passes over series data. When merging daily aggregates, build a `Map<string, DailyUsageRow>` once and mutate that map before converting to the final sorted array.
- Normalize unknown/null values into explicit `"unknown"` buckets in the backend so charts do not branch on nullability.
- Keep model and endpoint distributions capped if the chart becomes unreadable. Top 10 models is a reasonable starting bound.
- If feedback volume is too low to be useful, still expose the counters; let the UI show `0%` rather than hiding the metric.

## Suggested Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
