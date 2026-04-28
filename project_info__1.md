# profit-tracker-v2 — Codebase Overview (DB activation + “unable to connect”)

## Summary
This codebase is a Node.js + Express web app (server-side rendered with EJS) for tracking profits and expenses (and also inventory stock movements). It uses **Sequelize** as the ORM and expects a database URL in `process.env.DATABASE_URL` (SQLite for local/dev, PostgreSQL for production). The HTTP server boots in `server.js`, then runs `sequelize.sync()` (with retries) to initialize tables and seeds a default admin user.

## Architecture
- **Primary pattern**: Express “routes as controllers” + Sequelize models as the persistence layer (no separate service layer).
- **Major subsystems**
  - `server.js`: Express app, session/flash middleware, route mounting, and DB initialization (`sequelize.sync()` + admin seed).
  - `models/`: Sequelize model definitions and shared DB query helpers.
  - `routes/index.js`: All route handlers for login/register, transactions, history, inventory, reports, settings, etc.
  - `config/database.js`: Sequelize instance creation from `DATABASE_URL`.
- **Technology stack**
  - Node.js
  - Express 4.x + EJS templates
  - Sequelize 6.x
  - DB drivers: `sqlite3` and `pg`
  - Sessions: `express-session`, flash: `connect-flash`, optional Postgres-backed sessions: `connect-pg-simple`
- **Execution start**
  1. `server.js` loads `.env` via `dotenv`.
  2. Express middleware and routes are registered.
  3. `app.listen(...)` starts listening.
  4. The `initDatabase()` function runs after the server starts and attempts `sequelize.sync()` up to 5 times.
     - On success: logs `Database synchronized` and creates a default `User` (superadmin) if none exists.
     - On repeated failure: logs a warning and the server continues running anyway.

## Directory Structure
```
project-root/
├── config/
│   └── database.js            — Sequelize instance + dialect selection
├── models/
│   └── index.js              — Model definitions + helper query functions
├── routes/
│   └── index.js              — Express routes (login, transactions, inventory, reports, settings)
├── views/                    — EJS templates
├── static/                   — Client assets served by Express
├── server.js                 — Express bootstrap + initDatabase() + sequelize.sync()
├── .env                      — Environment variables (SQLite by default in dev)
├── database.sqlite          — SQLite file used locally
└── render.yaml              — Deployment configuration (if using Render)
```

## Key Abstractions

### Sequelize instance (`sequelize`)
- **File**: `config/database.js`
- **Responsibility**: Creates the Sequelize client using `process.env.DATABASE_URL` (SQLite default).
- **Interface** (practical usage):
  - `sequelize.sync(syncOptions)` — schema sync/migration behavior.
- **Lifecycle**: Created on module load and reused by all models.
- **Used by**: `models/index.js`, `server.js` (`initDatabase()`).

### `initDatabase()` startup initializer
- **File**: `server.js` (inside the file; see `async function initDatabase()`)
- **Responsibility**:
  - Calls `sequelize.sync()` with options controlled by `DB_SYNC_FORCE`.
  - Seeds a default admin user (`role: super_admin`) when the `User` table is empty.
- **Behavior**:
  - Retries up to 5 times with 3s delay between attempts.
  - If it cannot connect after retries: warns **but still starts the server**.
- **Used by**: `app.listen(PORT, ..., async () => { await initDatabase(); })`.

### Sequelize Models: `Business`, `Category`, `User`, `Transaction`, `InventoryItem`, `InventoryMovement`
- **File**: `models/index.js`
- **Responsibility**: Defines DB schema (tables/columns) and relationships.
- **Notable relationships**
  - `Business.hasMany(User|Category|Transaction|InventoryItem|InventoryMovement)`
  - `User.belongsTo(Business)`
  - `Category.hasMany(Transaction)`
  - `Transaction.belongsTo(Category)`
  - `Transaction.belongsTo(User)` via `created_by`
  - Inventory linkage between `Transaction` and `InventoryItem`, then to `InventoryMovement`.
- **Lifecycle**: Defined at import-time; the tables are created/altered by `sequelize.sync()`.

### Query/helper functions (inventory + reporting)
- **File**: `models/index.js`
- **Responsibility**: Encapsulates domain queries used by route handlers.
- **Key functions**:
  - `getSumByTypeAndDate(transType, targetDate, businessId)`
  - `getSumByTypeAndDateRange(transType, startDate, endDate, businessId)`
  - `getLowStockItems(businessId)`
  - `getInventoryValuation(businessId)`
  - `getInventorySummary(businessId)`
  - `applyInventoryTransactionImpact(transaction, options)`

### Express Route Handlers (controllers)
- **File**: `routes/index.js`
- **Responsibility**: Handles HTTP requests and calls Sequelize models/helpers.
- **Used by**: mounted as `app.use('/', routes)` in `server.js`.

## Data Flow (primary DB-related path)

1. **Startup**
   - `server.js` loads environment (`dotenv`).
   - `app.listen(...)` triggers `initDatabase()`.
2. **Schema initialization**
   - `initDatabase()` builds `syncOptions`:
     - `DB_SYNC_FORCE=true` ⇒ `{ force: true }`
     - otherwise ⇒ `{ alter: true }`
   - Then it calls `await sequelize.sync(syncOptions)`.
3. **Admin seed**
   - After sync, it imports `User` and runs `User.count()`.
   - If `count === 0`, it hashes password for `admin123` and creates:
     - username: `superadmin`
     - email: `superadmin@profittracker.local`
     - role: `super_admin`
4. **Request-time queries**
   - Route handlers call model methods (e.g. `User.findOne`, `Transaction.create`, `InventoryItem.findAll`)
   - All DB access goes through the same Sequelize instance created in `config/database.js`.

## Non-Obvious Behaviors & Design Decisions

### 1) “Unable to connect” is sometimes non-fatal
Even if the DB connection fails, `initDatabase()` will:
- retry 5 times,
- then log: `Warning: Could not connect to database. Server will start anyway.`
This means the app process may appear “running” even while DB operations will subsequently fail per-request.

### 2) `DB_SYNC_FORCE=true` is dangerous on restarts
Your `.env` includes:
- `DB_SYNC_FORCE=true`

In `server.js`, this means Sequelize uses **`force: true`**, which will drop/recreate tables on sync. In production, that can destroy data if the DB is reachable. In dev, it may look like “database reset” behavior.

### 3) SQLite URL path resolution is relative to the process working directory
Your `.env` uses:
- `DATABASE_URL=sqlite:./database.sqlite`

For SQLite, `./database.sqlite` is resolved relative to the Node process **working directory**, not relative to `config/` or project root. On a local machine this usually matches the repo root; on platforms (Render, PM2, Docker, different startup scripts) it may not. The most common failure mode here is:
- **“unable to open database file”** / permission issues / DB file created in the wrong directory.

### 4) Sequelize dialect selection depends purely on the substring “postgres”
In `config/database.js`:
- `dialect: databaseUrl.includes('postgres') ? 'postgres' : 'sqlite'`

So a malformed `DATABASE_URL` can silently select the wrong dialect (SQLite instead of Postgres), resulting in confusing connection errors.

### 5) Express session storage depends on `NODE_ENV` + “postgres” in DATABASE_URL
Session store is only configured to use Postgres when:
- `DATABASE_URL` includes `postgres`
- AND `NODE_ENV === 'production'`

This does **not** control Sequelize’s DB connection (Sequelize always uses `DATABASE_URL`), but it can affect app behavior in production (auth/session persistence).

## Answer: Why the database can’t connect
Based on the code, the database “can’t connect” scenario occurs specifically when `sequelize.sync()` fails inside `initDatabase()`.

The most likely causes to check (in order):

1. **SQLite path/permissions (most common locally/deployed)**
   - `DATABASE_URL=sqlite:./database.sqlite` is relative.
   - If the server starts with a different working directory or in an environment with no write permission, SQLite cannot open/create the file.
   - Fix approach: use an absolute SQLite path for deployments or ensure the working directory is the repo root and the directory is writable.

2. **Wrong dialect selected**
   - Because dialect is selected by `DATABASE_URL.includes('postgres')`.
   - If `DATABASE_URL` is misconfigured (e.g., missing `postgresql://...` prefix), Sequelize may attempt SQLite against a Postgres URL or vice versa.

3. **Postgres credentials/network failure (if using Postgres in production)**
   - If `DATABASE_URL` points to Postgres but host/port/db/user/password are wrong or networking is blocked, retries will fail and `initDatabase()` will print the DB error message.

4. **DB_SYNC_FORCE / schema issues masking the real connection error**
   - If the connection works but sync fails due to schema/locking issues, you’ll still see “connection attempt failed” because the error is caught broadly.
   - However the message printed is `error.message`, so logs will reveal whether it’s connectivity vs. schema.

## Suggested Reading Order
1. `server.js` — how startup initializes DB and seeds admin; where retry logic lives.
2. `config/database.js` — how Sequelize is created and how dialect is chosen.
3. `models/index.js` — schema definitions; what tables Sequelize expects.
4. `routes/index.js` — how runtime DB operations depend on successful initialization.

## Module Reference
| File | Purpose |
|---|---|
| `server.js` | Express bootstrap + `initDatabase()` retry + `sequelize.sync()` + admin seeding |
| `config/database.js` | Sequelize client creation from `DATABASE_URL` |
| `models/index.js` | Model definitions + relationships + helper functions |
| `routes/index.js` | Route handlers using models/helpers |
