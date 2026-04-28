n# TrackWise Profit Tracker — Detailed Code Review

## Executive Summary
TrackWise is a functional Node.js/Express/Sequelize/EJS application for tracking business profits, expenses, and inventory. It has role-based access control, a polished dashboard UI, and inventory management. However, I found **critical functional bugs**, security gaps, and architectural issues that must be addressed before production use.

---

## What’s Working
- Server boots and serves requests correctly
- Authentication and role-based navigation rendering
- Business registration with auto-generated default categories
- Transaction CRUD, filtering, and pending-approval workflow
- Inventory item creation and CSV export
- Dashboard daily/monthly summaries
- Custom EJS layout wrapping system

---

## Critical Bugs

### 1. Inventory is never updated by transactions
`applyInventoryTransactionImpact()` is fully implemented in `models/index.js`, but it is **never called** in `routes/index.js` when creating or editing transactions. This means users can select an inventory item and quantity on the transaction form, but stock levels remain completely unchanged.

### 2. Inventory summary returns wrong data keys
`getInventorySummary()` returns `{ valuation, items, lowStockItems, lowStockCount, totalItems }`, but `views/inventory.ejs` expects `summary.totalValue` and `summary.totalQuantity`. The "Total Value" and "On Hand" stat cards will always show **$0.00** and **0**.

### 3. Edit transaction ignores inventory fields
The POST `/edit/:id` route updates `type`, `amount`, `category_id`, `description`, and `date`, but never assigns `inventory_item_id`, `quantity`, or `unit_cost` even when the user submits them.

### 4. Transaction quantity/unit_cost can store null
The add route passes `null` for quantity/unit_cost when undefined (`quantity !== undefined ? Number(quantity) : null`), but the `Transaction` model declares `allowNull: false` with `defaultValue: 1` / `0`. Depending on Sequelize strictness, this can cause silent failures or database errors.

---

## Security Issues

### 1. Hardcoded session secret fallback
`server.js` falls back to `'profit-tracker-secret-key-2024'` if `SECRET_KEY` is missing. If `.env` is absent in any environment, sessions are trivially forgeable.

### 2. No CSRF protection
`csurf` is listed in `package.json` but is never configured in `server.js`. All state-changing POST routes are vulnerable to cross-site request forgery.

### 3. GET requests for state mutations
`/delete/:id`, `/approve/:transaction_id`, and `/reject/:transaction_id` use GET instead of POST. These can be triggered accidentally by browser prefetch, email links, or third-party sites.

### 4. Missing rate limiting
Login and registration routes have no brute-force protection.

---

## Performance Issues

### 1. N+1 queries in reports
The `/reports` route runs 12 separate aggregate queries inside sequential `for` loops (6 daily + 6 monthly). This should be replaced with a single SQL aggregation query or Sequelize grouping.

### 2. In-memory filtering for low stock
`getLowStockItems()` fetches **all** inventory items into memory, then filters in JavaScript. This should be done in SQL with a proper WHERE clause.

### 3. No pagination on history
`/history` loads every matching transaction. As data grows, this route will become very slow.

---

## Architecture & Maintainability

### 1. Monolithic routes file
`routes/index.js` is ~800 lines and handles auth, transactions, inventory, users, settings, reports, and approvals. It should be split into focused route modules.

### 2. Duplicate `currentUser` construction
Nearly every route manually builds the same `currentUser` object. A shared middleware should attach this to `res.locals`.

### 3. Fragile flash message proxy
A custom Proxy wraps `req.flash` to support property-style access (`req.flash.success = '...'`). This is brittle and inconsistent with `connect-flash` documentation. Standard function-style usage should be used everywhere.

### 4. Destructive database sync
`initDatabase()` uses `sequelize.sync({ alter: true })` by default. In production, this can drop columns, rename fields, and corrupt data. Migrations should be used instead.

### 5. Outdated deployment docs
`DEPLOY.md` references `npm run migrations` and `npm run seed` scripts that do not exist in `package.json`. `profit tracker.txt` still describes a Python/Flask stack, which this codebase does not use.

---

## Recommendations by Priority

### Immediate (Fix before production)
- Call `applyInventoryTransactionImpact()` in POST `/add` and `/edit` handlers when `inventory_item_id` is present
- Fix inventory summary keys to match view expectations (or update `inventory.ejs`)
- Convert `/delete/:id`, `/approve/:id`, and `/reject/:id` to POST routes with CSRF tokens
- Configure `csurf` middleware and embed tokens in all forms
- Remove hardcoded `SECRET_KEY` fallback; fail on startup if it is missing
- Add `express-rate-limit` to the login route

### High Priority
- Split `routes/index.js` into modules (auth, transactions, inventory, users, settings, reports)
- Add pagination to `/history` and `/inventory`
- Replace sequential loop queries in `/reports` with SQL aggregates
- Move `getLowStockItems` filtering into the database query
- Wrap multi-step operations (registration, transaction + inventory) in Sequelize transactions

### Medium Priority
- Standardize `req.flash` usage and remove the Proxy wrapper
- Create a `res.locals.currentUser` middleware
- Use `express-validator` consistently on all forms
- Remove backup files (`server.js.backup`, `style.css.backup`) from version control
- Update or remove outdated docs (`DEPLOY.md`, `profit tracker.txt`)

### Low Priority
- Add automated tests (Jest + Supertest)
- Extract domain logic into a service layer
- Improve accessibility (ARIA labels, focus states)
- Modularize CSS into component files

---

## Conclusion
TrackWise is a solid MVP with good UI coverage and clean model design. The most critical issue is that the **inventory-transaction linkage is entirely non-functional** despite full UI and model support for it. Once the critical bugs and security gaps are resolved, the app will be significantly closer to production-ready.

**Overall Assessment:** Solid MVP with critical bugs and security gaps that need immediate attention.
