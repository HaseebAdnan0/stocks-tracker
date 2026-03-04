# PSX Shariah Portfolio Tracker

A web-based Pakistan Stock Exchange (PSX) portfolio tracker focused on Shariah-compliant indices, primarily KMI-30. Built with Next.js, the application features multi-user authentication, realized/unrealized P/L tracking, and live market data scraping from the PSX Data Portal.

![Tech Stack](https://img.shields.io/badge/Next.js-16.1-black) ![React](https://img.shields.io/badge/React-19.0-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue) ![Tailwind](https://img.shields.io/badge/TailwindCSS-3.4-cyan) ![SQLite](https://img.shields.io/badge/Database-SQLite-lightgrey)

## Features

### User Authentication
- **Secure Login/Registration**: Username/password authentication with bcrypt hashing
- **Session Management**: HTTP-only cookie-based sessions with 7-day expiration
- **Protected Routes**: Automatic redirection to login for unauthenticated users
- **User Isolation**: Complete data separation between user portfolios

### Portfolio Management
- **CRUD Operations**: Add, edit, and delete stock holdings
- **Buy/Sell Transactions**: Track individual purchase and sale transactions
- **Realized P/L**: Track profit/loss from closed positions (sold stocks)
- **Unrealized P/L**: Real-time P/L calculation for active holdings
- **Portfolio Summary**: Total investment, current value, best/worst performers
- **Transaction History**: Detailed buy/sell history for each stock

### Market Data & Tracking
- **Live KMI-30 Index Data**: Real-time market watch with auto-refresh every 3 minutes
- **Interactive Dashboard**: Sortable table displaying all KMI-30 stocks
- **Index Summary Bar**: Overall KMI-30 index value, daily change, and market volume
- **Shariah Compliance Badges**: Visual indicators for KMI-30 membership
- **Smart Caching**: Aggressive data caching to respect PSX server rate limits

### Stock Analysis
- **Detailed Stock Pages**: Comprehensive view for each stock with current market data
- **Interactive Price Charts**: Historical EOD data with multiple time periods (1M, 3M, 6M, 1Y, 3Y, 5Y)
- **Buy Price Indicator**: Your entry point shown as a dashed line on charts
- **Fundamental Data**: EPS, P/E ratio, book value, market cap, dividend yield, sector
- **Transaction History**: View all buy/sell transactions for a specific stock

### User Experience
- **Dark Theme UI**: Professional dark mode design with excellent contrast
- **Responsive Design**: Mobile-friendly interface that adapts to all screen sizes
- **Stale Data Indicators**: Visual warnings when data might be outdated
- **Market Hours Awareness**: Auto-refresh only during trading hours (Mon-Fri 9:30-15:30 PKT)

## Tech Stack

**Framework:**
- Next.js 16.1 (App Router with React Server Components)
- React 19.0
- TypeScript 5.8

**Backend:**
- Next.js API Routes
- better-sqlite3 for database
- bcryptjs for password hashing
- Cheerio for web scraping

**Frontend:**
- Tailwind CSS 3.4 for styling
- Recharts for interactive charts
- React Context API for state management

**Data Source:**
- PSX Data Portal (dps.psx.com.pk) - ~5 minute delayed market data

## Installation

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### 1. Clone the Repository

```bash
git clone <repository-url>
cd stocks-tracker
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Initialize Database

The database will be automatically initialized on first run. The SQLite database is created at `data/db.sqlite3`.

## Running the Application

### Development Mode

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Production Build

```bash
npm run build
npm start
```

### Access the Application

1. Open your browser and navigate to `http://localhost:3000`
2. Click "Register" to create a new account
3. Log in with your credentials
4. Start adding stocks to your portfolio!

## Authentication Flow

### Registration
1. Navigate to `/register`
2. Enter username (3-20 chars, alphanumeric) and password (min 6 chars)
3. Password is hashed using bcrypt (10 salt rounds) before storage
4. Session token created and stored as HTTP-only cookie
5. Automatically redirected to dashboard

### Login
1. Navigate to `/login`
2. Enter username and password
3. Credentials verified using bcrypt.compare()
4. New session token generated on successful login
5. Session valid for 7 days from creation

### Session Management
- Sessions stored in database with expiration timestamp
- Session token sent as HTTP-only cookie (secure flag in production)
- Middleware validates session on each protected route access
- Expired sessions automatically rejected
- Logout clears session from database and cookie

### Protected Routes
- All pages except `/login` and `/register` require authentication
- AuthGuard component wraps protected pages
- Unauthenticated users redirected to `/login`
- Auth state managed globally via AuthContext

## P/L Tracking Features

### Buy Transactions
- Record stock purchases with date, quantity, and price
- Automatically created when adding new holding
- Can be viewed in transaction history

### Sell Transactions
- Sell button available on each active holding
- Enter quantity (max = current holding), price, and date
- Automatically calculates realized P/L:
  - **Cost Basis**: Average buy price × quantity sold
  - **Sale Value**: Sale price × quantity sold
  - **Realized P/L**: Sale Value - Cost Basis
- Reduces holding quantity (partial sell) or marks as SOLD (full exit)
- Creates sell transaction record

### Realized P/L
- Profit/loss from closed positions (fully or partially sold)
- Displayed on sold holdings and in portfolio summary
- Color-coded: green for profit, red for loss
- Persists in holding record even after full exit

### Unrealized P/L
- Profit/loss from current holdings (not yet sold)
- Calculated using current market price vs average buy price
- Updates in real-time as market prices change
- Displayed for active holdings

### Portfolio Summary
- **Total Realized P/L**: Sum of all closed position profits/losses
- **Total Unrealized P/L**: Sum of all active holding P/L
- **Total P/L**: Realized + Unrealized (overall portfolio performance)
- Best/worst performing stocks

### Transaction History
- View all buy/sell transactions for any stock
- Sortable by date, type, quantity, and price
- Color-coded: green for buys, red for sells
- Filter by symbol or transaction type via API

## API Documentation

All API endpoints are prefixed with `/api/`

### Authentication Endpoints

#### `POST /api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "username": "john_doe",
  "password": "securepass123"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "john_doe"
  }
}
```

#### `POST /api/auth/login`
Login to existing account.

**Request Body:**
```json
{
  "username": "john_doe",
  "password": "securepass123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "john_doe"
  }
}
```

#### `POST /api/auth/logout`
Logout current user (invalidates session).

**Response (200 OK):**
```json
{
  "success": true
}
```

#### `GET /api/auth/me`
Get current authenticated user.

**Response (200 OK):**
```json
{
  "id": 1,
  "username": "john_doe",
  "created_at": "2024-03-01T10:00:00Z"
}
```

### Portfolio Endpoints

#### `GET /api/portfolio`
Fetch all holdings for authenticated user with current prices and P/L.

**Response:**
```json
[
  {
    "id": 1,
    "symbol": "LUCK",
    "quantity": 5,
    "buy_price": "394.00",
    "buy_date": "2024-01-15",
    "broker": "HMFS",
    "notes": "",
    "status": "active",
    "realized_pl": 0,
    "total_sold_quantity": 0,
    "current_price": 975.00,
    "investment": 1970.00,
    "current_value": 4875.00,
    "pnl": 2905.00,
    "pnl_percent": 147.46
  }
]
```

#### `POST /api/portfolio`
Add a new holding (requires authentication).

**Request Body:**
```json
{
  "symbol": "LUCK",
  "quantity": 5,
  "buy_price": "394.00",
  "buy_date": "2024-01-15",
  "broker": "HMFS",
  "notes": "Long term investment"
}
```

#### `PUT /api/portfolio/[id]`
Update existing holding (owner only).

#### `DELETE /api/portfolio/[id]`
Delete holding (owner only).

#### `POST /api/portfolio/[id]/sell`
Record a sell transaction for a holding.

**Request Body:**
```json
{
  "quantity": 2,
  "price": "1200.00",
  "date": "2024-03-01"
}
```

**Response:**
```json
{
  "success": true,
  "realized_pl": 1612.00,
  "remaining_quantity": 3,
  "status": "active"
}
```

#### `GET /api/portfolio/summary`
Fetch portfolio analytics and summary.

**Response:**
```json
{
  "total_investment": 5000.00,
  "total_current_value": 8500.00,
  "total_unrealized_pnl": 3500.00,
  "total_realized_pnl": 1200.00,
  "total_pnl": 4700.00,
  "total_pnl_percent": 94.00,
  "best_performer": {
    "symbol": "LUCK",
    "pnl_percent": 147.46
  },
  "worst_performer": {
    "symbol": "PSO",
    "pnl_percent": -5.23
  }
}
```

### Transaction Endpoints

#### `GET /api/transactions`
Fetch transaction history for authenticated user.

**Query Parameters:**
- `symbol` (optional): Filter by stock symbol
- `type` (optional): Filter by type ('buy' or 'sell')

**Response:**
```json
[
  {
    "id": 1,
    "symbol": "LUCK",
    "type": "buy",
    "quantity": 5,
    "price": "394.00",
    "date": "2024-01-15",
    "created_at": "2024-01-15T10:00:00Z"
  },
  {
    "id": 2,
    "symbol": "LUCK",
    "type": "sell",
    "quantity": 2,
    "price": "1200.00",
    "date": "2024-03-01",
    "created_at": "2024-03-01T14:30:00Z"
  }
]
```

### Market Data Endpoints

#### `GET /api/market-watch`
Fetch live market data for all stocks or filtered by index.

**Query Parameters:**
- `index` (optional): Filter by index (e.g., `kmi30`)

#### `GET /api/stock/[symbol]`
Fetch comprehensive details for a single stock.

#### `GET /api/stock/[symbol]/history`
Fetch EOD historical data for charting.

**Query Parameters:**
- `period` (optional): Time period (`1M`, `3M`, `6M`, `1Y`, `3Y`, `5Y`, default: `6M`)

### Utility Endpoints

#### `GET /api/indices`
List all tracked indices with their symbols.

#### `GET /api/tracked-symbols`
List all stocks being tracked.

#### `GET /api/cache-status`
View cache age for market data, EOD data, and fundamentals.

#### `POST /api/cache-clear`
Force clear all cached data and refresh from PSX.

## Project Structure

```
stocks-tracker/
├── app/                       # Next.js App Router
│   ├── api/                   # API Routes
│   │   ├── auth/              # Authentication endpoints
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   ├── me/route.ts
│   │   │   └── register/route.ts
│   │   ├── portfolio/         # Portfolio management
│   │   │   ├── route.ts       # GET/POST holdings
│   │   │   ├── summary/route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts   # PUT/DELETE holding
│   │   │       └── sell/route.ts
│   │   ├── transactions/route.ts
│   │   ├── market-watch/route.ts
│   │   └── stock/[symbol]/
│   ├── login/page.tsx         # Login page
│   ├── register/page.tsx      # Registration page
│   ├── portfolio/page.tsx     # Portfolio dashboard
│   ├── stock/[symbol]/page.tsx # Stock detail page
│   ├── settings/page.tsx      # Settings page
│   ├── layout.tsx             # Root layout with AuthProvider
│   └── page.tsx               # Home/dashboard page
├── components/                # React components
│   ├── Sidebar.tsx            # Navigation sidebar
│   ├── AuthGuard.tsx          # Route protection wrapper
│   ├── AddHoldingModal.tsx    # Add stock modal
│   ├── SellHoldingModal.tsx   # Sell stock modal
│   └── ...
├── contexts/                  # React Context providers
│   └── AuthContext.tsx        # Global auth state
├── lib/                       # Core utilities
│   ├── db.ts                  # SQLite database schema & queries
│   ├── auth.ts                # Password hashing & session management
│   └── middleware.ts          # Auth middleware for API routes
├── data/
│   └── db.sqlite3             # SQLite database file
├── scripts/
│   └── migrate-to-transactions.ts  # Data migration script
├── hooks/                     # Custom React hooks
├── utils/                     # Utility functions
├── next.config.js             # Next.js configuration
├── tailwind.config.js         # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
├── package.json               # Dependencies and scripts
├── PRD1.md                    # Product Requirements Document
└── README.md                  # This file
```

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run TypeScript type checking
npx tsc --noEmit

# Run migration script
npm run migrate
```

## Database Schema

### Users Table
- `id` (INTEGER PRIMARY KEY)
- `username` (TEXT UNIQUE)
- `password_hash` (TEXT)
- `created_at` (TIMESTAMP)

### Sessions Table
- `id` (INTEGER PRIMARY KEY)
- `user_id` (INTEGER FK → users)
- `token` (TEXT UNIQUE)
- `expires_at` (TIMESTAMP)
- `created_at` (TIMESTAMP)

### Holdings Table
- `id` (INTEGER PRIMARY KEY)
- `user_id` (INTEGER FK → users)
- `symbol` (TEXT)
- `quantity` (INTEGER)
- `buy_price` (DECIMAL)
- `buy_date` (DATE)
- `broker` (TEXT)
- `notes` (TEXT)
- `status` (TEXT: 'active' | 'sold')
- `realized_pl` (DECIMAL)
- `total_sold_quantity` (INTEGER)
- `total_sold_value` (DECIMAL)
- `created_at` (TIMESTAMP)

### Transactions Table
- `id` (INTEGER PRIMARY KEY)
- `user_id` (INTEGER FK → users)
- `holding_id` (INTEGER FK → holdings, nullable)
- `symbol` (TEXT)
- `type` (TEXT: 'buy' | 'sell')
- `quantity` (INTEGER)
- `price` (DECIMAL)
- `date` (DATE)
- `created_at` (TIMESTAMP)

### Tracked Symbols Table
- `id` (INTEGER PRIMARY KEY)
- `symbol` (TEXT UNIQUE)
- `name` (TEXT)
- `sector` (TEXT)
- `kmi30` (BOOLEAN)
- `last_updated` (TIMESTAMP)

### Cache Tables
- `market_data_cache`
- `eod_data_cache`
- `fundamentals_cache`

## Data Source & Rate Limiting

**Data Source:** Pakistan Stock Exchange Data Portal (https://dps.psx.com.pk/)

**Data Delay:** All market data is delayed by approximately 5 minutes.

**Rate Limiting Strategy:**
- **Market Watch Data**: Cached for 3 minutes (180 seconds)
- **EOD Historical Data**: Cached for 24 hours (86400 seconds)
- **Fundamentals Data**: Cached for 24 hours (86400 seconds)

**Important Notes:**
- Aggressive caching to minimize requests to PSX servers
- Auto-refresh only during market hours (Mon-Fri 9:30 AM - 3:30 PM PKT)
- Stale data indicators warn users when cached data is used
- Please be respectful of PSX server resources

## Configuration

### Environment Variables

Create a `.env.local` file for environment-specific configuration:

```env
# Node environment
NODE_ENV=development

# Session secret (generate a random string in production)
SESSION_SECRET=your-secret-key-here
```

### Cache Duration

Cache durations are configured in the API routes. Adjust as needed:
- Market watch: 180 seconds (3 minutes)
- EOD data: 86400 seconds (24 hours)
- Fundamentals: 86400 seconds (24 hours)

## Troubleshooting

### Database Issues

**Reset database:**
```bash
rm data/db.sqlite3
# Database will be recreated on next app start
```

### Port Already in Use

```bash
# Use a different port
PORT=3001 npm run dev
```

### TypeScript Errors

```bash
# Clear build cache
rm -rf .next tsconfig.tsbuildinfo
npm run dev
```

### Module Not Found Errors

```bash
rm -rf node_modules package-lock.json
npm install
```

## Security Considerations

- Passwords hashed with bcrypt (10 salt rounds)
- Session tokens are 256-bit random strings
- HTTP-only cookies prevent XSS attacks
- Sessions expire after 7 days
- User data completely isolated (user_id filtering on all queries)
- No password reset or email verification (MVP scope)

## Future Enhancements

- Email verification and password reset
- OAuth/social login support
- FIFO/LIFO cost basis methods for partial sells
- Dividend tracking in P/L calculations
- Tax reporting features
- Portfolio sharing between users
- Mobile app
- Real-time WebSocket updates
- Advanced charting with technical indicators

## Contributing

This is a personal portfolio tracker. Fork and modify as needed for your own use.

## License

This project is for educational and personal use. Market data is sourced from PSX Data Portal and remains their property.

## Version

**v2.0.0** - Complete rewrite with Next.js, user authentication, and P/L tracking

## Support

For issues or questions, please open an issue on the repository.

---

**Disclaimer:** This application provides delayed market data for informational purposes only. Always verify critical investment decisions with official sources.
