# Demo Mode (Read-Only UI) Design

Date: 2026-02-05

## Summary
Introduce a front-end only Demo Mode that renders a full chat UI without calling any backend APIs. Demo Mode is intended for unauthenticated, read-only viewing. Any action that would normally write data (send message, create chat, upload, etc.) redirects directly to `/login` without a `redirect` parameter.

## Goals
- Allow unauthenticated users to view the full `/c/new` UI without backend availability.
- Avoid any API calls while in Demo Mode.
- Preserve a clear login boundary by redirecting on any write-capable action.

## Non-Goals
- No real conversation, storage, or model calls.
- No backend changes required for Demo Mode.
- No in-UI toast notifications for blocked actions.

## User Experience
- `/c/new` renders the full chat layout using static demo data.
- Input field and send button appear but any interaction redirects to `/login`.
- Other actions (model selection, new chat, import, save, upload, etc.) redirect to `/login`.
- No redirect parameter is added to the login URL.

## Configuration
- Demo Mode enabled via `VITE_DEMO_MODE=true`.
- Behavior is build-time and client-side only.

## Architecture
### Routing
- `ChatRoute` (and route guards) check `isDemoMode` to allow unauthenticated access to `/c/new`.
- In Demo Mode, other routes may optionally redirect back to `/c/new` to keep a single-entry experience.

### Data Layer (Queries/Providers)
- `useGetStartupConfig`, `useGetModelsQuery`, `useGetEndpointsQuery`, `useGetConvoIdQuery` short-circuit to local demo data.
- Network calls are not executed in Demo Mode.

### UI Interaction Handling
- Replace action handlers with `navigate('/login', { replace: true })`.
- Examples: send message, model switch, create new chat, import/export, upload.

## Error Handling
- Demo Mode must not surface network errors or 401s (no API calls).
- Any accidental network call in Demo Mode is treated as a bug.

## Testing
- Route test: unauthenticated `/c/new` stays on page in Demo Mode.
- Interaction tests: clicking send/model switch/new chat redirects to `/login`.
- Data tests: verify query hooks return demo data and do not issue network requests.

## Risks & Mitigations
- Risk: a future change triggers API calls in Demo Mode.
  - Mitigation: add tests and an optional dev-only warning if any network call occurs.
- Risk: inconsistent UI between demo data and real data.
  - Mitigation: keep demo fixtures updated with minimal, representative structures.

## Open Questions
- Whether non-`/c/new` routes should redirect to `/c/new` or `/login` in Demo Mode.
