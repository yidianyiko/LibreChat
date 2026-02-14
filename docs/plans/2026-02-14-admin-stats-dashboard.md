# Admin Statistics Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an admin-only statistics dashboard at `/d/stats` showing daily user registrations, registration methods, total users, and active users.

**Architecture:**
- Frontend: New route `/d/stats` with React components using Recharts for data visualization
- Backend: New API endpoint `/api/admin/stats` protected by `requireAdmin` middleware
- Data: MongoDB aggregation queries on `users` and `messages` collections

**Tech Stack:**
- Frontend: React, TypeScript, Recharts, Tailwind CSS, TanStack Query
- Backend: Express.js, Mongoose, MongoDB aggregation pipeline
- Auth: Existing `requireAdmin` middleware from `@librechat/api`

---

## Task 1: Create Backend API Route for Statistics

**Files:**
- Create: `api/server/routes/admin/stats.js`
- Modify: `api/server/routes/index.js` (add stats export)
- Modify: `api/server/index.js` (mount stats route)

### Step 1: Create admin stats route with MongoDB aggregations

Create `api/server/routes/admin/stats.js`:

```javascript
const express = require('express');
const { requireAdmin } = require('@librechat/api');
const { User, Message } = require('~/db/models');

const router = express.Router();

/**
 * GET /api/admin/stats
 * Returns admin statistics: total users, daily registrations, provider distribution, active users
 * Query params:
 *   - days: number of days to query (default: 30)
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // 1. Total users count
    const totalUsers = await User.countDocuments();

    // 2. Recent new users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const recentNewUsers = await User.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    // 3. Daily registrations with provider breakdown
    const dailyRegistrations = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
              },
            },
            provider: '$provider',
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          providers: {
            $push: {
              provider: '$_id.provider',
              count: '$count',
            },
          },
          totalCount: { $sum: '$count' },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Transform to frontend format
    const dailyRegistrationsFormatted = dailyRegistrations.map((day) => {
      const result = {
        date: day._id,
        count: day.totalCount,
      };

      // Add provider-specific counts
      day.providers.forEach((p) => {
        result[`${p.provider}Count`] = p.count;
      });

      return result;
    });

    // 4. Registration by provider (total)
    const registrationByProvider = await User.aggregate([
      {
        $group: {
          _id: '$provider',
          count: { $sum: 1 },
        },
      },
    ]);

    const providerDistribution = {};
    registrationByProvider.forEach((item) => {
      providerDistribution[item._id || 'unknown'] = item.count;
    });

    // 5. Active users (users who sent messages in time ranges)
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const activeUsersLast7Days = await Message.distinct('user', {
      createdAt: { $gte: last7Days },
    });

    const activeUsersLast30Days = await Message.distinct('user', {
      createdAt: { $gte: last30Days },
    });

    res.json({
      totalUsers,
      recentNewUsers,
      dailyRegistrations: dailyRegistrationsFormatted,
      registrationByProvider: providerDistribution,
      activeUsers: {
        last7Days: activeUsersLast7Days.length,
        last30Days: activeUsersLast30Days.length,
      },
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: error.message,
    });
  }
});

module.exports = router;
```

### Step 2: Export stats route from routes/index.js

Modify `api/server/routes/index.js` to add stats export:

```javascript
// Add after line 4 (after adminAuth require)
const adminStats = require('./admin/stats');

// Add in module.exports object (after adminAuth)
module.exports = {
  // ... existing exports
  adminAuth,
  adminStats,  // ADD THIS LINE
  // ... rest of exports
};
```

### Step 3: Mount stats route in server

Modify `api/server/index.js` around line 167 (where admin routes are mounted):

```javascript
// Add after app.use('/api/admin', routes.adminAuth);
app.use('/api/admin/stats', routes.adminStats);
```

### Step 4: Test the API endpoint manually

```bash
# Start the backend server
cd api && npm run dev

# In another terminal, test the endpoint (need valid admin JWT token)
# First login as admin to get token, then:
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3080/api/admin/stats?days=30
```

Expected output: JSON with totalUsers, recentNewUsers, dailyRegistrations array, registrationByProvider object, activeUsers object.

### Step 5: Commit backend changes

```bash
git add api/server/routes/admin/stats.js api/server/routes/index.js api/server/index.js
git commit -m "feat(api): add admin stats endpoint with user registration and activity metrics"
```

---

## Task 2: Create Frontend Stats Page Component

**Files:**
- Create: `client/src/routes/Stats/StatsPage.tsx`
- Create: `client/src/routes/Stats/index.ts`
- Create: `client/src/routes/Stats/components/StatCard.tsx`
- Create: `client/src/routes/Stats/components/DailyRegistrationChart.tsx`
- Create: `client/src/routes/Stats/components/ProviderPieChart.tsx`

### Step 1: Create StatCard component for metric display

Create `client/src/routes/Stats/components/StatCard.tsx`:

```typescript
import { ReactNode } from 'react';
import { cn } from '~/utils';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-border-light bg-surface-primary p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-text-secondary">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-text-primary">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-text-tertiary">{subtitle}</p>}
          {trend && trendValue && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={cn(
                  'text-xs font-medium',
                  trend === 'up' && 'text-green-600',
                  trend === 'down' && 'text-red-600',
                  trend === 'neutral' && 'text-text-tertiary',
                )}
              >
                {trend === 'up' && '↑'}
                {trend === 'down' && '↓'}
                {trend === 'neutral' && '→'}
                {trendValue}
              </span>
            </div>
          )}
        </div>
        {icon && <div className="text-text-tertiary">{icon}</div>}
      </div>
    </div>
  );
}
```

### Step 2: Create DailyRegistrationChart component

Create `client/src/routes/Stats/components/DailyRegistrationChart.tsx`:

```typescript
import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DailyRegistration {
  date: string;
  count: number;
  googleCount?: number;
  localCount?: number;
  [key: string]: number | string | undefined;
}

interface DailyRegistrationChartProps {
  data: DailyRegistration[];
}

export default function DailyRegistrationChart({ data }: DailyRegistrationChartProps) {
  const providers = useMemo(() => {
    const providerSet = new Set<string>();
    data.forEach((day) => {
      Object.keys(day).forEach((key) => {
        if (key.endsWith('Count') && key !== 'count') {
          const provider = key.replace('Count', '');
          providerSet.add(provider);
        }
      });
    });
    return Array.from(providerSet);
  }, [data]);

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
    <div className="rounded-xl border border-border-light bg-surface-primary p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-text-primary">Daily Registrations</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af' }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '0.5rem',
            }}
            labelStyle={{ color: '#f9fafb' }}
          />
          <Legend />
          {providers.map((provider, index) => (
            <Bar
              key={provider}
              dataKey={`${provider}Count`}
              stackId="a"
              fill={colors[index % colors.length]}
              name={provider.charAt(0).toUpperCase() + provider.slice(1)}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Step 3: Create ProviderPieChart component

Create `client/src/routes/Stats/components/ProviderPieChart.tsx`:

```typescript
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface ProviderPieChartProps {
  data: Record<string, number>;
}

export default function ProviderPieChart({ data }: ProviderPieChartProps) {
  const chartData = Object.entries(data).map(([provider, count]) => ({
    name: provider.charAt(0).toUpperCase() + provider.slice(1),
    value: count,
  }));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
    <div className="rounded-xl border border-border-light bg-surface-primary p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-text-primary">
        Registration by Provider
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '0.5rem',
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Step 4: Create main StatsPage component

Create `client/src/routes/Stats/StatsPage.tsx`:

```typescript
import { Users, UserPlus, Activity } from 'lucide-react';
import { useAuthContext } from '~/hooks/AuthContext';
import { SystemRoles } from 'librechat-data-provider';
import { useGetAdminStats } from '~/data-provider';
import StatCard from './components/StatCard';
import DailyRegistrationChart from './components/DailyRegistrationChart';
import ProviderPieChart from './components/ProviderPieChart';

export default function StatsPage() {
  const { user } = useAuthContext();
  const { data: stats, isLoading, error } = useGetAdminStats({ days: 30 });

  // Admin role check
  if (user?.role !== SystemRoles.ADMIN) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">Access Denied</h1>
          <p className="mt-2 text-text-secondary">
            You need administrator privileges to view this page.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-text-primary">Loading statistics...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500">Error</h1>
          <p className="mt-2 text-text-secondary">Failed to load statistics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-primary-alt p-6">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-6 text-3xl font-bold text-text-primary">Admin Statistics</h1>

        {/* Stats Cards Grid */}
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Users"
            value={stats.totalUsers.toLocaleString()}
            icon={<Users className="h-8 w-8" />}
          />
          <StatCard
            title="New Users (7 days)"
            value={stats.recentNewUsers.toLocaleString()}
            icon={<UserPlus className="h-8 w-8" />}
            trend="up"
            trendValue={`+${stats.recentNewUsers}`}
          />
          <StatCard
            title="Active Users (7 days)"
            value={stats.activeUsers.last7Days.toLocaleString()}
            subtitle={`${stats.activeUsers.last30Days} in last 30 days`}
            icon={<Activity className="h-8 w-8" />}
          />
          <StatCard
            title="Active Users (30 days)"
            value={stats.activeUsers.last30Days.toLocaleString()}
            icon={<Activity className="h-8 w-8" />}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DailyRegistrationChart data={stats.dailyRegistrations} />
          <ProviderPieChart data={stats.registrationByProvider} />
        </div>
      </div>
    </div>
  );
}
```

### Step 5: Create index export file

Create `client/src/routes/Stats/index.ts`:

```typescript
export { default } from './StatsPage';
```

### Step 6: Commit frontend stats page components

```bash
git add client/src/routes/Stats/
git commit -m "feat(client): add admin statistics page with charts and metrics"
```

---

## Task 3: Create Data Provider Hook for Admin Stats

**Files:**
- Create: `packages/data-provider/src/admin-stats.ts`
- Modify: `packages/data-provider/src/index.ts`

### Step 1: Create admin stats data provider hook

Create `packages/data-provider/src/admin-stats.ts`:

```typescript
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { QueryKeys } from './types';

export type AdminStats = {
  totalUsers: number;
  recentNewUsers: number;
  dailyRegistrations: Array<{
    date: string;
    count: number;
    [key: string]: number | string;
  }>;
  registrationByProvider: Record<string, number>;
  activeUsers: {
    last7Days: number;
    last30Days: number;
  };
};

export const useGetAdminStats = (
  params: { days?: number } = {},
  options?: Omit<UseQueryOptions<AdminStats>, 'queryKey' | 'queryFn'>,
) => {
  const days = params.days ?? 30;

  return useQuery<AdminStats>({
    queryKey: ['adminStats', days] as const,
    queryFn: async () => {
      const response = await fetch(`/api/admin/stats?days=${days}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch admin statistics');
      }

      return response.json();
    },
    ...options,
  });
};
```

### Step 2: Export from data-provider index

Modify `packages/data-provider/src/index.ts` to add export:

```typescript
// Add with other exports
export * from './admin-stats';
```

### Step 3: Build data-provider package

```bash
npm run build:data-provider
```

### Step 4: Commit data provider changes

```bash
git add packages/data-provider/src/admin-stats.ts packages/data-provider/src/index.ts
git commit -m "feat(data-provider): add useGetAdminStats hook for admin statistics"
```

---

## Task 4: Add Stats Route to Frontend Router

**Files:**
- Modify: `client/src/routes/Dashboard.tsx`

### Step 1: Import StatsPage component

Modify `client/src/routes/Dashboard.tsx` - add import at top:

```typescript
import StatsPage from './Stats';
```

### Step 2: Add stats route to dashboard children

Modify `client/src/routes/Dashboard.tsx` - add route in children array (before the wildcard route):

```typescript
{
  path: 'stats',
  element: <StatsPage />,
},
```

Full context - the children array should look like:

```typescript
children: [
  {
    path: 'prompts/*',
    element: <PromptsView />,
    children: [
      {
        index: true,
        element: <EmptyPromptPreview />,
      },
      {
        path: 'new',
        element: <CreatePromptForm />,
      },
      {
        path: ':promptId',
        element: <PromptForm />,
      },
    ],
  },
  {
    path: 'stats',      // ADD THIS
    element: <StatsPage />,  // ADD THIS
  },                    // ADD THIS
  {
    path: '*',
    element: <Navigate to="/d/files" replace={true} />,
  },
],
```

### Step 3: Test the route manually

```bash
# Start frontend dev server
npm run frontend:dev

# Navigate to http://localhost:3090/d/stats in browser
# Should see stats page if logged in as admin
# Should see 403 if not admin
```

### Step 4: Commit routing changes

```bash
git add client/src/routes/Dashboard.tsx
git commit -m "feat(routes): add /d/stats route for admin statistics dashboard"
```

---

## Task 5: Add Stats Navigation Link in Sidebar

**Files:**
- Modify: `client/src/components/Nav/AccountSettings.tsx`

### Step 1: Add stats link button for admins

Modify `client/src/components/Nav/AccountSettings.tsx` - add after the Import button (around line 50):

```typescript
import { BarChart3 } from 'lucide-react';  // Add to imports at top
import { SystemRoles } from 'librechat-data-provider';  // Add to imports

// ... existing code ...

return (
  <div className="mt-1 flex flex-col gap-1">
    {/* Migrate History: above user avatar in sidebar — opens import dialog */}
    <button
      type="button"
      onClick={() => setShowImportDialog(true)}
      disabled={isUploading}
      aria-label={localize('com_ui_import_conversation_info')}
      className="account-settings-migrate flex w-full items-center gap-2 rounded-xl p-2 text-sm text-text-primary transition-all duration-200 ease-in-out hover:bg-surface-active-alt disabled:opacity-50"
    >
      <Import className="icon-md flex-shrink-0" aria-hidden="true" />
      <span className="truncate">{localize('com_ui_import_conversation_info')}</span>
    </button>

    {/* ADD THIS: Admin Stats Link - only visible to admins */}
    {user?.role === SystemRoles.ADMIN && (
      <button
        type="button"
        onClick={() => navigate('/d/stats')}
        aria-label="Admin Statistics"
        className="account-settings-stats flex w-full items-center gap-2 rounded-xl p-2 text-sm text-text-primary transition-all duration-200 ease-in-out hover:bg-surface-active-alt"
      >
        <BarChart3 className="icon-md flex-shrink-0" aria-hidden="true" />
        <span className="truncate">Statistics</span>
      </button>
    )}
    {/* END ADD */}

    {/* User Avatar and Settings - existing code below... */}
```

### Step 2: Test the navigation link

```bash
# Frontend should already be running from Task 4
# Refresh browser at http://localhost:3090
# Login as admin user
# Check sidebar - should see "Statistics" button above user avatar
# Click it - should navigate to /d/stats
```

### Step 3: Commit navigation changes

```bash
git add client/src/components/Nav/AccountSettings.tsx
git commit -m "feat(nav): add admin statistics link in sidebar for ADMIN role users"
```

---

## Task 6: Integration Testing

**Files:**
- No new files

### Step 1: Test full flow as admin user

```bash
# 1. Start backend
cd api && npm run backend:dev

# 2. Start frontend (separate terminal)
npm run frontend:dev

# 3. Open browser to http://localhost:3090
# 4. Login as admin user (yidianyiko@foxmail.com)
# 5. Check sidebar - should see "Statistics" link
# 6. Click "Statistics" - should navigate to /d/stats
# 7. Verify all components render:
#    - Total Users card shows number
#    - New Users (7 days) card shows number
#    - Active Users cards show numbers
#    - Daily Registrations bar chart displays
#    - Provider Pie Chart displays
```

Expected behavior:
- ✅ Statistics link only visible to admin users
- ✅ Page accessible at `/d/stats`
- ✅ All stat cards display correct numbers
- ✅ Charts render with data
- ✅ Non-admin users see 403 error

### Step 2: Test non-admin access restriction

```bash
# 1. Logout from admin account
# 2. Login as regular user (non-admin)
# 3. Check sidebar - "Statistics" link should NOT be visible
# 4. Manually navigate to http://localhost:3090/d/stats
# 5. Should see "Access Denied" message
```

### Step 3: Test API directly

```bash
# Get admin JWT token from browser dev tools (Application > Cookies > token)
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  http://localhost:3080/api/admin/stats?days=30

# Should return JSON with all stats
```

### Step 4: Verify MongoDB queries are efficient

```bash
# Check API response time in browser Network tab
# Stats API call should complete in < 1 second even with thousands of users
```

---

## Task 7: Final Verification and Deployment Prep

**Files:**
- No new files

### Step 1: Build production frontend

```bash
npm run frontend
```

Expected: Build succeeds without errors, stats page included in bundle.

### Step 2: Run linter

```bash
npm run lint
```

Expected: No linting errors in new files.

### Step 3: Test production build locally

```bash
# Stop dev servers
# Start production API server
cd api && npm start

# Frontend already built in step 1
# Test at http://localhost:3080/d/stats
```

### Step 4: Create final commit if needed

```bash
# If any fixes were needed during verification
git add .
git commit -m "fix: address linting and build issues for stats dashboard"
```

### Step 5: Push to repository

```bash
git push origin vk/9d42-
```

---

## Post-Implementation Notes

**Security:**
- All API endpoints protected by `requireAdmin` middleware
- Frontend role checks prevent UI rendering for non-admins
- Direct URL access also blocked for non-admin users

**Performance:**
- MongoDB aggregation queries are indexed by `createdAt` (existing index on User model)
- Stats queries limited to last 30 days by default
- Frontend uses TanStack Query caching to avoid redundant API calls

**Future Enhancements:**
- Add date range picker to allow custom date ranges
- Add export to CSV functionality
- Add more detailed user activity metrics (messages per user, conversation counts)
- Add real-time updates with polling or WebSocket

**Testing:**
- Manual testing covered in Task 6
- Automated tests could be added using Jest/React Testing Library for components
- API endpoint could be tested with supertest

---

## Completion Checklist

- [ ] Task 1: Backend API route created and tested
- [ ] Task 2: Frontend stats page components created
- [ ] Task 3: Data provider hook created and built
- [ ] Task 4: Route added to frontend router
- [ ] Task 5: Navigation link added to sidebar
- [ ] Task 6: Integration testing completed
- [ ] Task 7: Production build verified and pushed

**Estimated time:** 2-3 hours for experienced developer familiar with the codebase.
