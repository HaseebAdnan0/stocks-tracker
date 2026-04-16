# PRD: PSX Shariah Portfolio Tracker

## Introduction

A web-based Pakistan Stock Exchange (PSX) portfolio tracker focused on Shariah-compliant indices, primarily KMI-30. The application scrapes live/delayed market data from the PSX Data Portal and provides personal investment tracking with advanced analytics including P&L calculations, "what-if" multiplier analysis, and dividend tracking.

**Tech Stack:** Django backend + React frontend with Tailwind CSS + SQLite database.

## Goals

- Display real-time KMI-30 index data with auto-refresh every 3 minutes
- Enable CRUD operations for personal stock holdings
- Calculate and display P&L metrics including "what-if" multiplier analysis (10x, 100x)
- Show interactive price charts with EOD historical data
- Display fundamental data and dividend history for each stock
- Provide dark theme UI with responsive design
- Cache data aggressively to respect PSX server rate limits

## User Stories

---

### US-001: Initialize Django project structure
**Description:** As a developer, I need the base Django project with proper structure so that I can build the application incrementally.

**Acceptance Criteria:**
- [x] Create Django project named `psx_tracker`
- [x] Create Django app named `core`
- [x] Configure SQLite database in settings
- [x] Add CORS headers configuration for React frontend
- [x] Create `requirements.txt` with Django, requests, beautifulsoup4, django-cors-headers
- [x] Verify `python manage.py runserver` starts without errors

---

### US-002: Initialize React frontend with Tailwind
**Description:** As a developer, I need the React frontend scaffold with Tailwind CSS configured so that I can build UI components.

**Acceptance Criteria:**
- [x] Create React app in `frontend/` directory using Vite
- [x] Install and configure Tailwind CSS with dark theme as default
- [x] Configure proxy to Django backend (localhost:8000)
- [x] Create base layout component with dark theme styles
- [x] Verify `npm run dev` starts without errors and shows dark-themed page

---

### US-003: Create database models for portfolio holdings
**Description:** As a developer, I need database models to store portfolio holdings so that user data persists.

**Acceptance Criteria:**
- [x] Create `Holding` model with fields: symbol (CharField), quantity (IntegerField), buy_price (DecimalField), buy_date (DateField), broker (CharField, default="HMFS"), notes (TextField, nullable)
- [x] Add created_at and updated_at timestamps
- [x] Generate and run migrations
- [x] Verify model works via Django shell

---

### US-004: Create database models for cached market data
**Description:** As a developer, I need models to cache scraped market data so that we minimize requests to PSX servers.

**Acceptance Criteria:**
- [x] Create `MarketDataCache` model with fields: cache_key (CharField, unique), data (JSONField), fetched_at (DateTimeField)
- [x] Create `EODDataCache` model with fields: symbol (CharField), data (JSONField), fetched_at (DateTimeField), with unique constraint on symbol
- [x] Create `FundamentalsCache` model with fields: symbol (CharField, unique), data (JSONField), fetched_at (DateTimeField)
- [x] Generate and run migrations

---

### US-005: Create KMI-30 configuration module
**Description:** As a developer, I need a configuration module for index symbols so that indices can be easily updated.

**Acceptance Criteria:**
- [x] Create `config.py` with KMI_30_SYMBOLS list containing all 30 symbols
- [x] Add CACHE_DURATION settings: market_watch=180 seconds, eod=86400 seconds, fundamentals=86400 seconds
- [x] Add PSX_MARKET_HOURS config (start: 9:30, end: 15:30, timezone: Asia/Karachi)
- [x] Add USER_AGENT string for scraping requests

---

### US-006: Implement market-watch scraper
**Description:** As a developer, I need to scrape live market data from PSX so that I can display current prices.

**Acceptance Criteria:**
- [x] Create `scraper.py` module
- [x] Implement `fetch_market_watch()` function that GETs `https://dps.psx.com.pk/market-watch`
- [x] Parse response (inspect actual format - JSON or HTML) and extract: symbol, name, ldcp, open, high, low, current, change, change_percent, volume
- [x] Return list of dictionaries with normalized field names
- [x] Handle request errors gracefully, return None on failure
- [x] Add logging for debugging

---

### US-007: Implement EOD historical data scraper
**Description:** As a developer, I need to fetch end-of-day historical data so that I can display price charts.

**Acceptance Criteria:**
- [x] Implement `fetch_eod_history(symbol)` function that GETs `https://dps.psx.com.pk/timeseries/eod/{SYMBOL}`
- [x] Parse response and extract: date, open, high, low, close, volume
- [x] Return list of dictionaries sorted by date ascending
- [x] Handle request errors gracefully, return None on failure

---

### US-008: Implement intraday data scraper
**Description:** As a developer, I need to fetch intraday time series so that users can see today's price movement.

**Acceptance Criteria:**
- [x] Implement `fetch_intraday(symbol)` function that GETs `https://dps.psx.com.pk/timeseries/int/{SYMBOL}`
- [x] Parse response and extract: timestamp, price, volume
- [x] Return list of dictionaries sorted by timestamp ascending
- [x] Handle request errors gracefully, return None on failure

---

### US-009: Implement caching layer for scraped data
**Description:** As a developer, I need a caching layer so that we don't hammer PSX servers.

**Acceptance Criteria:**
- [x] Implement `get_cached_or_fetch(cache_key, fetch_fn, max_age_seconds)` utility
- [x] Check `MarketDataCache` for valid cached data (fetched_at within max_age)
- [x] If cache miss or stale, call fetch_fn and update cache
- [x] Return tuple: (data, fetched_at, is_stale) where is_stale=True if using expired cache due to fetch failure
- [x] Apply caching to market-watch (3 min), EOD (24 hr), fundamentals (24 hr)

---

### US-010: Create market-watch API endpoint
**Description:** As a user, I want to fetch market data via API so that the frontend can display it.

**Acceptance Criteria:**
- [x] Create `/api/market-watch/` endpoint (GET)
- [x] Accept optional `?index=kmi30` query param to filter by index
- [x] Return JSON: `{ data: [...stocks], fetched_at: timestamp, is_stale: boolean }`
- [x] Calculate 52-week high/low from cached EOD data if available
- [x] Include company name from market-watch response

---

### US-011: Create stock detail API endpoint
**Description:** As a user, I want to fetch full details for a single stock so that I can view its detail page.

**Acceptance Criteria:**
- [x] Create `/api/stock/<symbol>/` endpoint (GET)
- [x] Return current market data for the symbol
- [x] Return EOD history (last 5 years)
- [x] Return fundamentals (if available in cache)
- [x] Return indices the stock belongs to (kmi30, etc.)
- [x] Return JSON with all data combined

---

### US-012: Create stock history API endpoint
**Description:** As a user, I want to fetch EOD history for charting so that I can see price trends.

**Acceptance Criteria:**
- [x] Create `/api/stock/<symbol>/history/` endpoint (GET)
- [x] Accept optional `?period=6M` param (1M, 3M, 6M, 1Y, 3Y, 5Y, default 6M)
- [x] Filter EOD data to requested period
- [x] Return JSON array of {date, open, high, low, close, volume}

---

### US-013: Create portfolio CRUD API endpoints
**Description:** As a user, I want to manage my holdings via API so that I can add, edit, and delete stocks.

**Acceptance Criteria:**
- [x] Create `/api/portfolio/` GET endpoint - returns all holdings with current prices and P&L
- [x] Create `/api/portfolio/` POST endpoint - adds new holding, validates symbol exists
- [x] Create `/api/portfolio/<id>/` PUT endpoint - updates holding
- [x] Create `/api/portfolio/<id>/` DELETE endpoint - removes holding
- [x] All endpoints return consistent JSON structure

---

### US-014: Create portfolio summary API endpoint
**Description:** As a user, I want portfolio totals and analytics so that I can see my overall performance.

**Acceptance Criteria:**
- [x] Create `/api/portfolio/summary/` endpoint (GET)
- [x] Calculate: total_investment, total_current_value, total_pnl, total_pnl_percent
- [x] Calculate: best_performer (symbol, percent), worst_performer (symbol, percent)
- [x] Calculate "what-if" multipliers (10x, 100x) for total portfolio
- [x] Return all metrics in JSON

---

### US-015: Seed database with initial holdings
**Description:** As a user, I want my existing holdings pre-populated so that I can start using the app immediately.

**Acceptance Criteria:**
- [x] Create Django management command `seed_holdings`
- [x] Insert holdings: LUCK(5, 394.00), HUBC(9, 203.30), MEBL(5, 424.90), SAZEW(1, 2017.00), PSO(6, 344.00)
- [x] Set buy_date to a reasonable past date
- [x] Set broker to "HMFS" for all
- [x] Command is idempotent (doesn't duplicate on re-run)

---

### US-016: Create React navigation and layout
**Description:** As a user, I want consistent navigation so that I can move between sections easily.

**Acceptance Criteria:**
- [x] Create sidebar navigation with links: Dashboard, My Portfolio, Settings
- [x] Highlight active route
- [x] Show "Last updated: X" timestamp in header (updates with data refresh)
- [x] Mobile-responsive: sidebar collapses to hamburger menu
- [x] Dark theme: dark gray background (#1a1a2e or similar), white text

---

### US-017: Create KMI-30 dashboard table component
**Description:** As a user, I want to see all KMI-30 stocks in a table so that I can monitor the index.

**Acceptance Criteria:**
- [x] Create Dashboard page component
- [x] Fetch data from `/api/market-watch/?index=kmi30`
- [x] Display table with columns: Symbol, Company, Price, Change, Change%, Volume, High, Low, LDCP
- [x] Color price green if > LDCP, red if < LDCP
- [x] Show loading spinner while fetching
- [x] Format numbers with PKR currency and commas

---

### US-018: Add sorting to dashboard table
**Description:** As a user, I want to sort the table by any column so that I can find stocks of interest.

**Acceptance Criteria:**
- [x] Click column header to sort ascending
- [x] Click again to sort descending
- [x] Show sort indicator arrow on active column
- [x] Default sort by symbol alphabetically
- [x] Sorting works for all numeric and text columns

---

### US-019: Add auto-refresh to dashboard
**Description:** As a user, I want data to refresh automatically so that I see current prices.

**Acceptance Criteria:**
- [x] Auto-refresh every 3 minutes during market hours (Mon-Fri 9:30-15:30 PKT)
- [x] Show countdown to next refresh in header
- [x] Outside market hours, show "Market Closed" and disable auto-refresh
- [x] Manual refresh button always available
- [x] Update "Last updated" timestamp after each refresh

---

### US-020: Add KMI-30 index summary bar
**Description:** As a user, I want to see the overall KMI-30 index value so that I know market direction.

**Acceptance Criteria:**
- [x] Display summary bar above the table
- [x] Show KMI-30 index value and daily change (scrape from /indices endpoint or calculate)
- [x] Color green if up, red if down
- [x] Show total market volume for KMI-30 stocks

---

### US-021: Add expandable row to dashboard table
**Description:** As a user, I want to expand a row to see quick details so that I don't have to navigate away.

**Acceptance Criteria:**
- [x] Click row to expand/collapse
- [x] Expanded section shows: 52-week high/low, day range bar, volume comparison to average
- [x] Show "View Full Details" button that links to stock detail page
- [x] Show "Add to Portfolio" button if stock not in portfolio
- [x] Collapse other expanded rows when expanding a new one

---

### US-022: Create portfolio holdings table
**Description:** As a user, I want to see my holdings with live P&L so that I know my positions.

**Acceptance Criteria:**
- [x] Create Portfolio page component
- [x] Fetch data from `/api/portfolio/`
- [x] Display table with columns: Symbol, Qty, Buy Price, Current Price, Change, Change%, Investment, Current Value, P&L
- [x] Color P&L green if positive, red if negative
- [x] Show loading spinner while fetching

---

### US-023: Add portfolio summary cards
**Description:** As a user, I want to see portfolio totals at a glance so that I know my overall performance.

**Acceptance Criteria:**
- [x] Display summary cards above holdings table
- [x] Show: Total Investment, Total Current Value, Total P&L (absolute + %)
- [x] Show: Best Performer (symbol + %), Worst Performer (symbol + %)
- [x] Cards use green/red coloring based on P&L direction

---

### US-024: Add "What If" multiplier analysis
**Description:** As a user, I want to see what-if scenarios so that I can visualize larger investments.

**Acceptance Criteria:**
- [x] Add "What If Analysis" section below holdings table
- [x] Show comparison table with columns: Metric, Actual, 10x, 100x
- [x] Rows: Total Shares, Total Invested, Current Value, Profit/Loss
- [x] Calculate based on current portfolio totals

---

### US-025: Create add holding modal
**Description:** As a user, I want to add new holdings so that I can track new purchases.

**Acceptance Criteria:**
- [x] "Add Holding" button opens modal
- [x] Form fields: Symbol (dropdown/autocomplete from KMI-30), Quantity, Buy Price, Buy Date, Broker (default "HMFS"), Notes
- [x] Validate symbol exists in market data
- [x] Submit POSTs to `/api/portfolio/`
- [x] Close modal and refresh table on success
- [x] Show validation errors inline

---

### US-026: Create edit holding modal
**Description:** As a user, I want to edit holdings so that I can correct mistakes.

**Acceptance Criteria:**
- [x] Edit button on each holding row opens modal
- [x] Pre-populate form with existing data
- [x] Submit PUTs to `/api/portfolio/<id>/`
- [x] Close modal and refresh table on success

---

### US-027: Create delete holding confirmation
**Description:** As a user, I want to delete holdings with confirmation so that I don't accidentally remove data.

**Acceptance Criteria:**
- [x] Delete button on each holding row
- [x] Show confirmation dialog: "Delete SYMBOL holding?"
- [x] Confirm DELETEs to `/api/portfolio/<id>/`
- [x] Refresh table on success

---

### US-028: Create stock detail page layout
**Description:** As a user, I want a dedicated page for stock details so that I can see comprehensive information.

**Acceptance Criteria:**
- [x] Create StockDetail page at route `/stock/:symbol`
- [x] Fetch data from `/api/stock/<symbol>/`
- [x] Show stock header: Symbol, Company Name, Current Price, Change, Change%
- [x] Show Shariah badge if in KMI-30
- [x] Show "Add to Portfolio" button if not already held
- [x] Back button returns to previous page

---

### US-029: Add price chart to stock detail page
**Description:** As a user, I want to see a price chart so that I can analyze trends.

**Acceptance Criteria:**
- [x] Integrate Chart.js or Recharts library
- [x] Display line chart of EOD close prices
- [x] Period selector buttons: 1M, 3M, 6M, 1Y, 3Y, 5Y
- [x] Default to 6M view
- [x] Fetch data from `/api/stock/<symbol>/history/?period=X`
- [x] Show loading state while fetching

---

### US-030: Add buy price line to chart
**Description:** As a user, I want my buy price shown on the chart so that I can see my entry point.

**Acceptance Criteria:**
- [x] If stock is in portfolio, draw horizontal dashed line at buy price
- [x] Label the line "Your Buy Price: PKR X"
- [x] Line color should contrast with price line (e.g., yellow dashed)
- [x] Hide line if stock not in portfolio

---

### US-031: Implement fundamentals scraper
**Description:** As a developer, I need to scrape fundamental data so that I can display company metrics.

**Acceptance Criteria:**
- [x] Implement `fetch_fundamentals(symbol)` function
- [x] Try primary source: `https://dps.psx.com.pk/company/{SYMBOL}`
- [x] Parse HTML for: EPS, P/E, Book Value, Market Cap, Sector, Dividend Yield
- [x] Fallback to alternative sources if primary fails
- [x] Return dictionary with available fields, None for missing
- [x] Cache results for 24 hours

---

### US-032: Add fundamentals panel to stock detail page
**Description:** As a user, I want to see company fundamentals so that I can evaluate the stock.

**Acceptance Criteria:**
- [x] Display fundamentals section on stock detail page
- [x] Show available metrics: EPS, P/E Ratio, Book Value, Market Cap, Dividend Yield, 52-Week Range, Sector
- [x] Show "Data unavailable" for missing fields
- [x] Format Market Cap with abbreviations (M, B)

---

### US-033: Implement dividend history scraper
**Description:** As a developer, I need to scrape dividend history so that I can display past dividends.

**Acceptance Criteria:**
- [x] Implement `fetch_dividend_history(symbol)` function
- [x] Scrape from `dps.psx.com.pk/company/{SYMBOL}` or fallback sources
- [x] Extract: announcement_date, type (Cash/Bonus/Right), amount
- [x] Return list sorted by date descending
- [x] Handle case where no dividend history exists

---

### US-034: Add dividend history to stock detail page
**Description:** As a user, I want to see dividend history so that I can understand income potential.

**Acceptance Criteria:**
- [x] Display dividend history table on stock detail page
- [x] Columns: Date, Type, Amount
- [x] Show total dividends in last 12 months
- [x] Show "No dividend history" if none available

---

### US-035: Create indices API endpoint
**Description:** As a user, I want to see which indices a stock belongs to so that I know its compliance status.

**Acceptance Criteria:**
- [x] Create `/api/indices/` endpoint (GET)
- [x] Return list of tracked indices with their symbols
- [x] Format: `{ indices: [{ name: "KMI-30", symbols: [...] }, ...] }`
- [x] Future-proof for adding more indices

---

### US-036: Add Shariah compliance badges
**Description:** As a user, I want to see Shariah compliance status so that I can filter compliant stocks.

**Acceptance Criteria:**
- [x] Show badge on each stock indicating: "KMI-30", "KMI All Share", or no badge
- [x] Badge appears in dashboard table, portfolio table, and stock detail page
- [x] Use distinct colors: KMI-30 (green badge), KMI All Share (blue badge)

---

### US-037: Create settings page
**Description:** As a user, I want a settings page so that I can configure the app.

**Acceptance Criteria:**
- [x] Create Settings page component
- [x] Show current KMI-30 symbols list (read-only display)
- [x] Show cache status: market data age, EOD data age
- [x] Add "Clear Cache" button to force refresh all data
- [x] Show app version

---

### US-038: Add PKR currency formatting utility
**Description:** As a developer, I need consistent currency formatting so that all money values look professional.

**Acceptance Criteria:**
- [x] Create `formatPKR(value)` utility function
- [x] Format with 2 decimal places and comma separators
- [x] Prefix with "PKR " (e.g., "PKR 1,970.00")
- [x] Handle negative values with minus sign before PKR
- [x] Handle null/undefined gracefully

---

### US-039: Add responsive mobile styles
**Description:** As a user, I want the app to work on mobile so that I can check stocks on my phone.

**Acceptance Criteria:**
- [x] Tables become horizontally scrollable on small screens
- [x] Navigation collapses to hamburger menu below 768px
- [x] Cards stack vertically on mobile
- [x] Touch-friendly tap targets (min 44px)
- [x] Chart is readable on mobile (min height 200px)

---

### US-040: Add error handling and stale data indicators
**Description:** As a user, I want to know when data might be outdated so that I can make informed decisions.

**Acceptance Criteria:**
- [x] If market-watch fetch fails, show cached data with warning icon
- [x] Tooltip on warning icon: "Data may be stale - last updated X"
- [x] If no cached data available, show friendly error message
- [x] Log all scrape errors to console for debugging
- [x] Never show a completely broken state to user

---

### US-041: Create Django management command for initial setup
**Description:** As a developer, I need a single command to initialize the database and seed data.

**Acceptance Criteria:**
- [x] Create `setup` management command
- [x] Run migrations
- [x] Seed initial holdings
- [x] Pre-fetch and cache market-watch data
- [x] Print success message with next steps

---

### US-042: Add comprehensive README
**Description:** As a developer, I need documentation so that the app can be easily set up and run.

**Acceptance Criteria:**
- [x] Create README.md with: Project description, Features list, Tech stack
- [x] Installation steps: clone, install Python deps, install npm deps
- [x] Running instructions: `python manage.py setup`, `python manage.py runserver`, `npm run dev`
- [x] API documentation summary
- [x] Note about PSX data source and rate limiting

---

## Non-Goals

- **No user authentication:** Single-user local app, no login system
- **No real-time WebSocket updates:** Polling every 3 minutes is sufficient
- **No mobile native app:** Web-only, responsive design covers mobile use
- **No push notifications:** No alerts for price thresholds in v1
- **No CSV/Excel export:** Not included in v1
- **No stock comparison view:** Not included in v1
- **No dividend income projections:** Not included in v1
- **No support for non-Shariah indices:** Focus on KMI-30 only in v1

## Technical Considerations

- **Rate Limiting:** Cache market-watch for 3 minutes, EOD/fundamentals for 24 hours
- **Scraper Fragility:** Fundamental data scrapers may break if PSX changes HTML layout; build modularly
- **Market Hours:** PSX trades Mon-Fri 9:30 AM - 3:30 PM PKT; reduce refresh frequency outside hours
- **Data Delay:** PSX data is ~5 minutes delayed; this is acceptable for portfolio tracking
- **CORS:** Django needs django-cors-headers to allow React dev server requests
- **Database:** SQLite is sufficient for single-user local app; keep schema simple

## Data Sources Reference

| Endpoint | Use | Cache Duration |
|----------|-----|----------------|
| `https://dps.psx.com.pk/market-watch` | Live market data | 3 minutes |
| `https://dps.psx.com.pk/timeseries/eod/{SYMBOL}` | Price history for charts | 24 hours |
| `https://dps.psx.com.pk/timeseries/int/{SYMBOL}` | Intraday data | 3 minutes |
| `https://dps.psx.com.pk/company/{SYMBOL}` | Fundamentals, dividends | 24 hours |
| `https://dps.psx.com.pk/indices` | Index values | 3 minutes |

## KMI-30 Symbols (Dec 2024)

```
LUCK, HUBC, MEBL, PSO, OGDC, PPL, MARI, SYS, ENGRO, FFC,
EFERT, BAHL, SAZEW, MTL, SEARL, CHCC, MLCF, PIOC, GWLC, COLG,
GADT, NESTLE, NETSOL, OCTOPUS, TOMCL, AVN, ISL, FHAM, ATRL, KOHC
```

## Initial Portfolio Holdings

| Symbol | Quantity | Buy Price | Broker |
|--------|----------|-----------|--------|
| LUCK | 5 | 394.00 | HMFS |
| HUBC | 9 | 203.30 | HMFS |
| MEBL | 5 | 424.90 | HMFS |
| SAZEW | 1 | 2017.00 | HMFS |
| PSO | 6 | 344.00 | HMFS |
