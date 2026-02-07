# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LibreChat v0.8.2 - A self-hosted AI chat platform that unifies all major AI providers in a single interface. Features include multi-model support (OpenAI, Anthropic, Google, Azure, AWS Bedrock, custom endpoints), AI Agents with MCP support, code interpreter, web search, artifacts, multimodal interactions, and enterprise-ready authentication.

## Repository Structure

```
agents-c49e0371b6/
├── api/                      # Node.js/Express backend
│   ├── server/               # Express server entry point and routes
│   │   ├── controllers/      # Request handlers
│   │   ├── services/         # Business logic layer
│   │   ├── routes/           # API route definitions
│   │   ├── middleware/       # Express middleware
│   │   └── scripts/          # Utility scripts (preset creation, verification)
│   ├── models/               # Mongoose schemas and models
│   ├── app/                  # Application-level utilities
│   ├── strategies/           # Passport authentication strategies
│   └── utils/                # Shared utilities
├── client/                   # React/Vite frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── store/            # Recoil state management
│   │   ├── routes/           # React Router pages
│   │   └── data-provider/    # API client layer
│   └── dist/                 # Production build output
├── packages/                 # NPM workspaces
│   ├── data-provider/        # API client with TanStack Query hooks
│   ├── data-schemas/         # Mongoose schemas & TypeScript types
│   ├── api/                  # Backend utilities & helpers
│   └── client/               # Shared UI component library
├── config/                   # CLI scripts (user mgmt, migrations, balance)
├── e2e/                      # Playwright E2E tests
│   └── specs/                # Test specifications
├── librechat.yaml            # AI endpoint & model configuration
├── docker-compose.yml        # Production Docker setup
├── docker-compose.dev.yml    # Development Docker setup (MongoDB, Meilisearch)
└── deploy-compose.yml        # Production Docker deployment
```

## Common Commands

All commands run from the repository root unless specified.

### Development

```bash
npm install                    # Install all workspace dependencies

# Frontend development
npm run frontend:dev           # Start Vite dev server with HMR (port 3090)

# Backend development
npm run backend:dev            # Start API server with nodemon (port 3080)

# Build packages (required after schema changes)
npm run build:packages         # Build all shared packages
npm run build:data-schemas     # Build schemas only
npm run build:data-provider    # Build data provider only
npm run build:api              # Build API package only
npm run build:client-package   # Build client package only

# Full production build
npm run frontend               # Build packages + client for production
```

### Testing

```bash
# Unit tests
npm run test:client                      # Jest tests for React components
npm run test:api                         # Backend API tests
npm run test:packages:api                # Test packages/api
npm run test:packages:data-provider      # Test data-provider
npm run test:packages:data-schemas       # Test data-schemas
npm run test:all                         # All unit tests

# E2E tests (Playwright)
npm run e2e                              # Run E2E tests (headless)
npm run e2e:headed                       # Run with visible browser
npm run e2e:debug                        # Interactive debug mode (PWDEBUG=1)
npm run e2e:codegen                      # Generate test code interactively
npm run e2e:report                       # View test results

# Run specific test file
cd api && npm test -- path/to/test.spec.js
cd client && npm test -- ComponentName
```

### Linting & Formatting

```bash
npm run lint                   # ESLint check
npm run lint:fix               # Auto-fix lint issues
npm run format                 # Prettier formatting
```

### User Management (CLI)

```bash
npm run create-user            # Create new user account
npm run list-users             # List all users
npm run reset-password         # Reset user password
npm run ban-user               # Ban user account
npm run delete-user            # Delete user account
npm run add-balance            # Add token balance to user
npm run set-balance            # Set user balance to specific amount
npm run list-balances          # View all user balances
npm run user-stats             # View user statistics
```

### Docker Deployment

```bash
# Development (docker-compose.dev.yml - only databases)
docker compose -f docker-compose.dev.yml up -d     # Start MongoDB & Meilisearch
docker compose -f docker-compose.dev.yml down      # Stop services
docker compose -f docker-compose.dev.yml down -v   # Stop and remove volumes

# Production (docker-compose.yml - full stack)
docker compose up -d           # Start all services
docker compose logs -f api     # Follow API logs
docker compose logs -f mongodb # Follow MongoDB logs
docker compose down            # Stop all services

# Production (deploy-compose.yml)
npm run start:deployed         # Start production deployment
npm run stop:deployed          # Stop production deployment
npm run update:deployed        # Update deployed instance
```

### Maintenance

```bash
npm run flush-cache                       # Clear Redis cache
npm run reset-meili-sync                  # Reset Meilisearch sync
npm run migrate:agent-permissions         # Migrate agent permissions
npm run migrate:prompt-permissions        # Migrate prompt permissions
npm run create-default-presets            # Create default presets
```

## Architecture

### Backend (`api/`)

**Stack:** Express.js v5, Mongoose, MongoDB, Passport.js, Redis (optional)

**Patterns:**
- **Module aliasing:** `~` alias maps to `api/server/` (e.g., `require('~/models')`)
- **Service layer:** Routes → Controllers → Services → Models
- **Middleware stack:** Authentication (`requireJwtAuth`) → Validation → Authorization → Handler
- **Error handling:** Centralized via `ErrorController` with Winston logging
- **Streaming:** Server-Sent Events (SSE) for real-time AI responses

**Key directories:**
- `server/routes/` - API endpoint definitions
- `server/controllers/` - Request/response handling
- `server/services/` - Business logic (Auth, Files, AI integrations, Stripe)
- `server/middleware/` - Express middleware (auth, validation, rate limiting)
- `models/` - Mongoose schemas (User, Conversation, Message, Agent, Transaction, etc.)
- `strategies/` - Passport authentication (JWT, Local, LDAP, OAuth)

**Authentication:** JWT-based with refresh tokens. Supports OAuth2 (Google, GitHub, Discord, etc.), LDAP, SAML, and local authentication.

### Frontend (`client/src/`)

**Stack:** React 18, TypeScript, Vite, Tailwind CSS, Recoil, TanStack Query, React Router

**State management:**
- **Recoil** - Global UI state
- **TanStack Query** - Server state & caching (via librechat-data-provider)
- **React Context** - Theme, localization (i18next)

**Key directories:**
- `components/` - React components organized by feature
- `hooks/` - Custom React hooks
- `store/` - Recoil atoms and selectors
- `routes/` - React Router page components
- `data-provider/` - API client hooks (wraps librechat-data-provider)
- `utils/` - Frontend utilities

**UI Components:** Radix UI primitives + custom components, styled with Tailwind CSS

**Internationalization:** i18next with 30+ languages

### Shared Packages (`packages/`)

**Workspace architecture** - Packages are built before client/API and consumed as dependencies.

- `@librechat/data-schemas` - Mongoose schemas, TypeScript types, Zod validators
- `librechat-data-provider` - API client, TanStack Query hooks, request utilities
- `@librechat/api` - Backend utilities (file handling, streaming, error handling)
- `@librechat/client` - Shared UI component library

**Important:** After modifying schemas or types, rebuild packages:
```bash
npm run build:data-schemas && npm run build:data-provider
```

### Configuration Files

**`.env`** - Environment variables (API keys, database URIs, feature flags)
- See `.env.example` for all available options
- Required: `MONGO_URI`, `PORT`, `HOST`, `DOMAIN_CLIENT`, `DOMAIN_SERVER`

**`librechat.yaml`** - AI endpoints, model specs, interface configuration
- Defines custom endpoints, model lists, default settings
- Controls UI features (agents, file search, web search, etc.)
- See `librechat.example.yaml` for full documentation

## Development Workflow

### Hot Module Replacement (HMR)

Frontend changes are reflected immediately with Vite HMR. Backend uses nodemon for auto-restart on file changes.

### Working with Packages

1. Make changes to package code (e.g., `packages/data-schemas/`)
2. Rebuild the package: `npm run build:data-schemas`
3. Changes automatically reflected in dependent workspaces

### Adding New API Endpoints

1. Create route file in `api/server/routes/`
2. Define controller in `api/server/controllers/`
3. Implement service logic in `api/server/services/`
4. Register route in `api/server/routes/index.js`
5. Add authentication middleware if needed

### Adding New Models

1. Define schema in `packages/data-schemas/src/`
2. Create model file in `api/models/`
3. Export from `api/models/index.js`
4. Rebuild schemas: `npm run build:data-schemas`

## Stripe Payment Integration

Environment variables required in `.env`:
```bash
STRIPE_SECRET_KEY=sk_test_...              # Stripe test/live secret key
STRIPE_WEBHOOK_SECRET=whsec_...            # Webhook signing secret
```

Backend integration:
- **Service**: `api/server/services/StripeService.js` - Stripe API wrapper
- **Routes**: `api/server/routes/recharge.js` - Recharge endpoints
- **Webhook**: `POST /api/recharge/webhook` - Handles `checkout.session.completed` events

Frontend components:
- **Recharge Page**: `client/src/components/Recharge/RechargePage.tsx`
- **Payment Success**: `client/src/components/Recharge/PaymentSuccessPage.tsx`
- **Payment Cancel**: `client/src/components/Recharge/PaymentCancelPage.tsx`
- **History**: `client/src/components/Recharge/RechargeHistoryPage.tsx`

Pricing tiers (configured in `StripeService.js`):
- $5 -> 5M credits (0% discount)
- $10 -> 10M credits (1% discount)
- $25 -> 25M credits (4% discount)
- $50 -> 50M credits (6% discount)
- $100 -> 100M credits (10% discount)

The payment flow:
1. User selects tier -> Frontend calls `POST /api/recharge/create-checkout-session`
2. Backend creates Stripe Checkout Session -> Returns session URL
3. Frontend redirects to Stripe Checkout
4. User completes payment
5. Stripe sends webhook to `POST /api/recharge/webhook`
6. Backend verifies signature -> Adds credits via `createTransaction()`
7. User redirected to success page at `/recharge/success?session_id=xxx`

Testing locally:
```bash
# Install Stripe CLI (for webhook forwarding)
brew install stripe/stripe-cli/stripe
stripe login
stripe listen --forward-to localhost:3080/api/recharge/webhook

# Use test card: 4242 4242 4242 4242 (any future date, any CVC)
```

Setup guide: See `docs/STRIPE-SETUP.md`

## Balance System

LibreChat has a built-in credit balance system for tracking usage and implementing billing.

**Configuration** (`librechat.yaml`):
```yaml
balance:
  enabled: true               # Enable balance system
  startBalance: 1000000       # Initial credits ($1.00)
  autoRefillEnabled: true     # Auto-refill enabled
  refillIntervalValue: 30     # Refill every 30 days
  refillIntervalUnit: 'days'
  refillAmount: 500000        # Refill $0.50

transactions:
  enabled: true               # Enable transaction logging
```

**Credit conversion:** 1,000,000 credits = $1.00

**Key files:**
- **Routes**: `api/server/routes/balance.js` - Balance and transaction endpoints
- **Model**: `api/models/Transaction.js` - Transaction schema
- **CLI scripts**: `config/add-balance.js`, `config/set-balance.js`, `config/list-balances.js`

## Docker Architecture

**Development setup** (`docker-compose.dev.yml`):
- `mongodb` - MongoDB 8.0 (port 27017)
- `meilisearch` - Search engine (port 7700)

Run API and client locally with `npm run backend:dev` and `npm run frontend:dev`.

**Production setup** (`docker-compose.yml`):
- `api` - LibreChat API server (port 3080)
- `mongodb` - MongoDB 8.0 (port 27017)
- `meilisearch` - Search engine (port 7700)
- `rag_api` - RAG API for vector search
- `vectordb` - PostgreSQL with pgvector

**Production setup** (`deploy-compose.yml`):
- Adds `client` - Nginx reverse proxy (ports 80/443)
- Optimized for production deployment

**Volumes:**
- `./data-node` - MongoDB data persistence
- `./uploads` - User uploaded files
- `./logs` - Application logs
- `./images` - Public image assets
- `./meili_data_v1.12` - Meilisearch index

## Testing

### Unit Tests

- Frontend: Jest + React Testing Library
- Backend: Jest + Supertest for API testing
- Run specific test: `cd api && npm test -- path/to/test.spec.js`

### E2E Tests

Playwright tests in `e2e/specs/`:
- `landing.spec.ts` - Landing page
- `messages.spec.ts` - Message interactions
- `settings.spec.ts` - Settings UI
- `a11y.spec.ts` - Accessibility checks

Configuration files:
- `e2e/playwright.config.ts` - CI configuration
- `e2e/playwright.config.local.ts` - Local development

## Common Patterns

### API Request Flow

```
Client (TanStack Query)
  ↓
librechat-data-provider hooks
  ↓
Express route
  ↓
Middleware (auth, validation)
  ↓
Controller (request handling)
  ↓
Service (business logic)
  ↓
Mongoose Model (database)
```

### Authentication Middleware

Standard auth stack for protected routes:
```javascript
router.use(requireJwtAuth);  // Verify JWT token
router.use(checkBan);        // Check if user is banned
// ... route handlers
```

### Streaming Responses

AI responses use Server-Sent Events (SSE) for real-time streaming. Services in `api/server/services/Endpoints/` implement streaming logic.

### File Storage

Configurable via environment variables:
- Local filesystem (default)
- AWS S3
- Azure Blob Storage
- Firebase Storage

## Debugging

### View Logs

```bash
# Docker logs
docker compose logs -f api
docker compose logs --tail=100 api

# Local development
# Backend logs appear in terminal running npm run backend:dev
# Check ./logs/ directory for persistent logs
```

### Database Access

```bash
# Connect to MongoDB container
docker exec -it chat-mongodb mongosh
use LibreChat
db.users.find().pretty()
db.conversations.find().limit(5)
db.transactions.find().sort({createdAt: -1}).limit(10)
```

### Clear Build Cache

```bash
# If hot-reload isn't working or seeing stale code
rm -rf client/dist packages-built api-built
npm run build:packages
```

### Inspect Container

```bash
docker compose ps                    # List all services
docker exec -it LibreChat sh         # Shell into API container
docker stats                         # View resource usage
```

## Environment Variables

Critical environment variables (see `.env.example` for complete list):

**Server:**
- `HOST`, `PORT` - Server host/port
- `MONGO_URI` - MongoDB connection string
- `DOMAIN_CLIENT`, `DOMAIN_SERVER` - Client/server URLs

**Authentication:**
- `JWT_SECRET`, `JWT_REFRESH_SECRET` - JWT signing keys
- `SESSION_EXPIRY`, `REFRESH_TOKEN_EXPIRY` - Token lifetimes

**AI Providers:**
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc. - API keys
- Or configure via `librechat.yaml` for custom endpoints

**Features:**
- `DEBUG_LOGGING` - Enable debug logs
- `MEILI_MASTER_KEY` - Meilisearch security
- `RAG_PORT` - RAG API port

**Stripe:**
- `STRIPE_SECRET_KEY` - Stripe API key
- `STRIPE_WEBHOOK_SECRET` - Webhook signature verification

## Bun Support

LibreChat supports Bun as an alternative runtime:

```bash
# Run backend with Bun
npm run b:api
npm run b:api:dev  # With watch mode

# Build with Bun
npm run b:client   # Build entire frontend
npm run b:data     # Build data-provider only

# Test with Bun
npm run b:test:client
npm run b:test:api
```
