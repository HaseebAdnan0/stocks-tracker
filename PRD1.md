# PRD: User Authentication & P/L Tracking

## Introduction

Add user authentication to the PSX Shariah Portfolio Tracker to support multiple users with isolated portfolios. Extend the portfolio system to track both realized P/L (sold positions) and unrealized P/L (current holdings), displaying sold stocks alongside active holdings with clear status indicators. Finally, consolidate the codebase by removing legacy Django+React code and moving the Next.js application to the root project directory.

## Goals

- Authenticate users with username/password stored in SQLite
- Isolate portfolio data per user (complete separation)
- Track buy transactions with date, quantity, and price
- Track sell transactions linked to holdings
- Calculate realized P/L (closed positions) and unrealized P/L (open positions)
- Display sold stocks alongside current holdings with "sold" status
- Remove legacy Django+React code from repository
- Move Next.js app from `psx-tracker/` to root `E:\projects\stocks-tracker\`

## User Stories

---

### US-001: Add users table to database
**Description:** As a developer, I need a users table to store authentication credentials.

**Acceptance Criteria:**
- [x] Create `users` table with columns: `id`, `username` (unique), `password_hash`, `created_at`
- [x] Add index on `username` for fast lookups
- [x] Typecheck passes

---

### US-002: Add sessions table to database
**Description:** As a developer, I need a sessions table to manage user login sessions.

**Acceptance Criteria:**
- [x] Create `sessions` table with columns: `id`, `user_id` (FK), `token` (unique), `expires_at`, `created_at`
- [x] Add index on `token` for fast lookups
- [x] Typecheck passes

---

### US-003: Add user_id to holdings table
**Description:** As a developer, I need to associate holdings with users for data isolation.

**Acceptance Criteria:**
- [x] Add `user_id` column to `holdings` table (nullable initially for migration)
- [x] Add foreign key constraint to `users` table
- [x] Add index on `user_id` for filtering
- [x] Typecheck passes

---

### US-004: Add transactions table for buy/sell tracking
**Description:** As a developer, I need to track individual buy and sell transactions for P/L calculation.

**Acceptance Criteria:**
- [x] Create `transactions` table with columns: `id`, `user_id` (FK), `holding_id` (FK, nullable for sells after full exit), `symbol`, `type` ('buy' | 'sell'), `quantity`, `price`, `date`, `created_at`
- [x] Add indexes on `user_id`, `symbol`, `type`
- [x] Typecheck passes

---

### US-005: Create password hashing utility
**Description:** As a developer, I need secure password hashing for user credentials.

**Acceptance Criteria:**
- [x] Create `lib/auth.ts` with `hashPassword(password)` and `verifyPassword(password, hash)` functions
- [x] Use bcrypt or built-in crypto with proper salt
- [x] Typecheck passes

---

### US-006: Create session management utilities
**Description:** As a developer, I need utilities to create, validate, and expire sessions.

**Acceptance Criteria:**
- [x] Add `createSession(userId)` returning session token
- [x] Add `validateSession(token)` returning user or null
- [x] Add `deleteSession(token)` for logout
- [x] Sessions expire after 7 days
- [x] Typecheck passes

---

### US-007: Create auth middleware
**Description:** As a developer, I need middleware to protect API routes and get current user.

**Acceptance Criteria:**
- [x] Create `lib/middleware.ts` with `getCurrentUser(request)` function
- [x] Reads session token from cookies
- [x] Returns user object or null
- [x] Typecheck passes

---

### US-008: Create registration API endpoint
**Description:** As a user, I want to create an account so I can track my portfolio.

**Acceptance Criteria:**
- [x] POST `/api/auth/register` accepts `{ username, password }`
- [x] Validates username (3-20 chars, alphanumeric)
- [x] Validates password (min 6 chars)
- [x] Returns 409 if username taken
- [x] Creates user and session, returns token in cookie
- [x] Typecheck passes

---

### US-009: Create login API endpoint
**Description:** As a user, I want to log in to access my portfolio.

**Acceptance Criteria:**
- [x] POST `/api/auth/login` accepts `{ username, password }`
- [x] Returns 401 for invalid credentials
- [x] Creates session and sets cookie on success
- [x] Returns user info (id, username)
- [x] Typecheck passes

---

### US-010: Create logout API endpoint
**Description:** As a user, I want to log out to secure my session.

**Acceptance Criteria:**
- [x] POST `/api/auth/logout` invalidates current session
- [x] Clears session cookie
- [x] Returns success even if not logged in
- [x] Typecheck passes

---

### US-011: Create current user API endpoint
**Description:** As a developer, I need an endpoint to check authentication status.

**Acceptance Criteria:**
- [x] GET `/api/auth/me` returns current user or 401
- [x] Returns `{ id, username, created_at }`
- [x] Typecheck passes

---

### US-012: Create login page UI
**Description:** As a user, I want a login form to access my account.

**Acceptance Criteria:**
- [x] Create `/login/page.tsx` with username/password form
- [x] Shows validation errors inline
- [x] Redirects to dashboard on success
- [x] Link to registration page
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### US-013: Create registration page UI
**Description:** As a user, I want a registration form to create an account.

**Acceptance Criteria:**
- [x] Create `/register/page.tsx` with username/password/confirm form
- [x] Client-side validation before submit
- [x] Shows server errors (username taken, etc.)
- [x] Redirects to dashboard on success
- [x] Link to login page
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### US-014: Add auth context provider
**Description:** As a developer, I need global auth state accessible across components.

**Acceptance Criteria:**
- [x] Create `contexts/AuthContext.tsx` with user state
- [x] Provides `user`, `login`, `logout`, `isLoading` values
- [x] Wrap app in provider in root layout
- [x] Typecheck passes

---

### US-015: Protect routes with auth check
**Description:** As a developer, I need to redirect unauthenticated users to login.

**Acceptance Criteria:**
- [x] Create `components/AuthGuard.tsx` wrapper component
- [x] Redirects to `/login` if not authenticated
- [x] Shows loading state while checking
- [x] Wrap protected pages (dashboard, portfolio, settings)
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### US-016: Add user navbar with logout
**Description:** As a user, I want to see my username and log out from the navigation.

**Acceptance Criteria:**
- [x] Show username in sidebar/header when logged in
- [x] Add logout button that clears session
- [x] Redirect to login after logout
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### US-017: Update portfolio API to filter by user
**Description:** As a developer, I need portfolio endpoints to return only current user's data.

**Acceptance Criteria:**
- [x] GET `/api/portfolio` filters by authenticated user's ID
- [x] POST `/api/portfolio` associates new holding with current user
- [x] PUT/DELETE verify ownership before modifying
- [x] Return 401 if not authenticated
- [x] Typecheck passes

---

### US-018: Update portfolio summary API for user isolation
**Description:** As a developer, I need portfolio summary to calculate for current user only.

**Acceptance Criteria:**
- [x] GET `/api/portfolio/summary` filters by user_id
- [x] All calculations scoped to user's holdings
- [x] Return 401 if not authenticated
- [x] Typecheck passes

---

### US-019: Create sell transaction API endpoint
**Description:** As a user, I want to record when I sell stock to track realized P/L.

**Acceptance Criteria:**
- [x] POST `/api/portfolio/[id]/sell` accepts `{ quantity, price, date }`
- [x] Validates quantity <= current holding quantity
- [x] Creates transaction record with type 'sell'
- [x] Updates holding quantity (reduces by sold amount)
- [x] If quantity becomes 0, marks holding as `status: 'sold'`
- [x] Calculates and stores realized P/L for this sale
- [x] Typecheck passes

---

### US-020: Add status and realized_pl to holdings
**Description:** As a developer, I need to track holding status and realized profit/loss.

**Acceptance Criteria:**
- [x] Add `status` column: 'active' | 'sold' (default 'active')
- [x] Add `realized_pl` column (decimal, default 0)
- [x] Add `total_sold_quantity` column (integer, default 0)
- [x] Add `total_sold_value` column (decimal, default 0)
- [x] Typecheck passes

---

### US-021: Update portfolio display to show sold status
**Description:** As a user, I want to see sold stocks alongside active holdings with clear status.

**Acceptance Criteria:**
- [x] Portfolio table shows all holdings (active and sold)
- [x] Sold holdings display "SOLD" badge/status indicator
- [x] Sold holdings show realized P/L instead of unrealized
- [x] Sold holdings grayed out or visually differentiated
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### US-022: Add sell button to holding row
**Description:** As a user, I want to record a sale directly from my portfolio view.

**Acceptance Criteria:**
- [x] Each active holding row has "Sell" button
- [x] Button hidden for sold holdings
- [x] Opens sell modal on click
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### US-023: Create sell holding modal
**Description:** As a user, I want a form to enter sale details (quantity, price, date).

**Acceptance Criteria:**
- [x] Modal shows holding symbol and current quantity
- [x] Input fields: quantity (max = current), price per share, date (default today)
- [x] Shows calculated sale value (qty * price)
- [x] Submit calls sell API and refreshes portfolio
- [x] Cancel closes modal
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### US-024: Display realized P/L in portfolio summary
**Description:** As a user, I want to see my total realized P/L from closed positions.

**Acceptance Criteria:**
- [x] Portfolio summary shows "Realized P/L" total
- [x] Shows "Unrealized P/L" for active holdings separately
- [x] Shows "Total P/L" (realized + unrealized)
- [x] Color coded: green for profit, red for loss
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### US-025: Create transaction history API
**Description:** As a developer, I need an endpoint to retrieve transaction history.

**Acceptance Criteria:**
- [x] GET `/api/transactions` returns user's transactions
- [x] Supports `?symbol=XXX` filter
- [x] Supports `?type=buy|sell` filter
- [x] Orders by date descending
- [x] Typecheck passes

---

### US-026: Add transaction history to stock detail page
**Description:** As a user, I want to see my buy/sell history for a specific stock.

**Acceptance Criteria:**
- [x] Stock detail page shows transaction table
- [x] Columns: Date, Type (Buy/Sell), Quantity, Price, Total
- [x] Buy transactions in green, Sell in red
- [x] Empty state if no transactions
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### US-027: Migrate existing holdings to transaction records
**Description:** As a developer, I need to create transaction records for existing holdings data.

**Acceptance Criteria:**
- [x] Create migration script `scripts/migrate-to-transactions.ts`
- [x] For each existing holding, create a 'buy' transaction
- [x] Set transaction date to holding's `created_at`
- [x] Typecheck passes

---

### US-028: Remove Django backend code
**Description:** As a developer, I want to remove legacy Django code to clean up the repository.

**Acceptance Criteria:**
- [x] Delete `core/` directory (Django app)
- [x] Delete `manage.py`
- [x] Delete `requirements.txt`
- [x] Delete `psx_shariah/` directory (Django project settings)
- [x] Delete any `.pyc`, `__pycache__`, `*.py` files
- [x] Delete `db.sqlite3` from Django root (NOT the Next.js one)
- [x] Verify Next.js app still runs

---

### US-029: Remove legacy React frontend code
**Description:** As a developer, I want to remove old Vite React code.

**Acceptance Criteria:**
- [x] Delete `frontend/` directory entirely
- [x] Verify Next.js app still runs

---

### US-030: Move Next.js app to project root
**Description:** As a developer, I want the Next.js app at repository root for cleaner structure.

**Acceptance Criteria:**
- [x] Move all contents of `psx-tracker/` to `E:\projects\stocks-tracker\`
- [x] Update any absolute paths in config files if needed
- [x] Delete empty `psx-tracker/` directory
- [x] Verify `npm run dev` works from new location
- [x] Verify `npm run build` succeeds
- [x] Typecheck passes

---

### US-031: Update documentation for new structure
**Description:** As a developer, I want documentation reflecting the consolidated codebase.

**Acceptance Criteria:**
- [x] Update or create README.md with setup instructions
- [x] Document authentication flow
- [x] Document P/L tracking features
- [x] Remove references to Django/old frontend
- [x] Typecheck passes

---

## Non-Goals

- No OAuth/social login (just username/password)
- No email verification or password reset (MVP)
- No portfolio sharing between users
- No partial sell tracking (FIFO/LIFO cost basis methods)
- No dividend tracking in P/L calculations
- No tax reporting features
- No mobile app (web only)

## Technical Considerations

- Use `bcryptjs` for password hashing (pure JS, no native dependencies)
- Session tokens stored as HTTP-only cookies for security
- Existing holdings need migration to include user_id (assign to first user or admin)
- Transaction table enables future features (cost basis methods, tax lots)
- Keep tracked_symbols table global (shared across users)
