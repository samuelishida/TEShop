# Bug Fixes - Session, Sync, CSV, Reports, Cart

## Context

This plan addresses 12 bugs discovered during code review of the E-Shop PDV system. The bugs span multiple categories:

1. **Session expiry datetime format mismatch** — Expired sessions appear valid for hours
2. **Sync user insert NOT NULL violation** — Sync fails when inserting new users
3. **CSV bulk import ignores `unit` and `description` columns** — Data loss during import
4. **CSV import fails on UTF-8 BOM** — Excel-exported CSVs rejected
5. **Sync server reports success before listening** — Race condition in server startup
6. **Sale report `daily_average` undercounts days by one** — Incorrect daily average calculation
7. **Cart persists across user logout** — State leakage between users
8. **Reports default date shows wrong day for negative UTC offsets** — Date picker defaults to wrong day
9. **Test schema for `admin_users` missing `role` column** — Tests fail on user creation
10. **Products module retains stale category names** — UI shows outdated category names
11. **CSV bulk import cannot handle commas inside quoted fields** — CSV parsing breaks
12. **Sync overwrites sales with colliding auto-increment IDs** — Data loss during multi-machine sync

## Assumptions and decisions

- Decision: Fix all bugs in a single PR since they are independent and low-risk. Source: user-confirmed
- Assumption: SQLite `datetime()` function outputs local time format (`YYYY-MM-DD HH:MM:SS`). Source: code @ src/database/connection.ts:56
- Assumption: CSV import template promises 7 columns but handler only destructured 5. Source: code @ src/main/main.ts:208
- Assumption: `PaginatedResult` interface uses `.data` property but IPC handlers access `.items`. Source: code @ src/services/sale.service.ts:23
- Assumption: Cart state is stored in module-level variable without persistence mechanism. Source: code @ src/renderer/js/modules/cart.js
- Assumption: Reports date inputs use ISO date format (`YYYY-MM-DD`). Source: code @ src/renderer/index.html:287

## Files to touch

### src/services/session.service.ts
- **Status**: ✅ NO FIX NEEDED
- What changes: Already uses correct datetime comparison `datetime(expires_at) > datetime('now')`
- Function(s): `validate()`, `cleanup()`, `getActiveSessionCount()`
- Data shapes: `expires_at` is ISO 8601 string (`2024-01-15T10:00:00.000Z`)
- Integration points: Called by `AuthService.validateToken()` and `DatabaseManager.runMigrations()`
- Error paths: None — lexicographic comparison is correct for ISO strings

### src/database/connection.ts
- **Status**: ✅ NO FIX NEEDED
- What changes: Already uses correct datetime comparison for expired session cleanup
- Function(s): `runMigrations()`
- Data shapes: `expires_at` is ISO 8601 string
- Integration points: Called on app startup via `app.whenReady()`
- Error paths: None — lexicographic comparison is correct for ISO strings

### src/services/sync.service.ts
- **Status**: ✅ NO FIX NEEDED (partial)
- What changes: 
  1. Already handles user insert with `INSERT OR IGNORE` and generates placeholder hash
  2. Already returns Promise that resolves after listening
- Function(s): `applySyncData()`, `startServer()`
- Data shapes: `admin_users` insert includes `id, username, password_hash, role, created_at`
- Integration points: Called by `main.ts` IPC handlers
- Error paths: NOT NULL constraint handled; Promise ensures server is actually listening
- **MUST-FIX**: Bug #12 (Sync ID collision) - Auto-increment IDs can collide across machines. Consider using UUIDs or timestamp-based IDs instead.

### src/main/main.ts
- **Status**: ✅ NO FIX NEEDED (partial)
- What changes:
  1. Already awaits `startServer()` result
  2. Already handles 7 columns correctly
  3. Already strips UTF-8 BOM from CSV header
- Function(s): `ipcMain.handle('auth:login')`, `ipcMain.handle('product:bulkCreate')`
- Data shapes: CSV has 7 columns: `sku,name,category_id,price,stock,unit,description`
- Integration points: Called by frontend IPC
- Error paths: BOM stripping prevents header validation failure; column destructuring prevents data loss
- **MUST-FIX**: Bug #11 (CSV quoted fields) - `split(',')` breaks on commas inside quoted fields. Need proper CSV parsing.

### src/services/sale.service.ts
- **Status**: ❌ FIX REQUIRED
- What changes: Fix `days` calculation in `getReport()` to use floor instead of ceil
- Function(s): `getReport()`
- Data shapes: `days = Math.floor((end - start) / 86400000) + 1` for inclusive range
- Integration points: Called by frontend reports module
- Error paths: None — fixes off-by-one error
- **MUST-FIX**: Change `Math.ceil` to `Math.floor` on line 177
- **SHOULD-FIX**: Add `Math.max(1, days)` to avoid division by zero (already present)

### src/renderer/js/modules/auth.js
- **Status**: ❌ FIX REQUIRED
- What changes: Call `deps.Cart.clear()` in `logout()`
- Function(s): `logout()`
- Data shapes: Cart module has `clear()` method
- Integration points: Called by `app.js` logout handler
- Error paths: None — prevents cart leakage between users
- **MUST-FIX**: Add `deps.Cart.clear()` call in logout function

### src/renderer/js/modules/reports.js
- **Status**: ❌ FIX REQUIRED
- What changes: Fix default date calculation to use local date instead of UTC
- Function(s): `setDefaultDates()`
- Data shapes: `today = new Date()` then format as `YYYY-MM-DD` using local time
- Integration points: Called on reports page load
- Error paths: None — fixes timezone offset bug
- **MUST-FIX**: Change `toISOString().split('T')[0]` to use local date formatting

### src/renderer/js/modules/products.js
- **Status**: ❌ FIX REQUIRED
- What changes: Call `this.load()` after `saveCategory()` in categories module
- Function(s): `load()`, `saveCategory()`
- Data shapes: `this.categories` cache needs refresh
- Integration points: Categories module calls Products module
- Error paths: None — prevents stale category names
- **MUST-FIX**: Add `await Products.load()` call in categories saveCategory()

### src/renderer/js/modules/categories.js
- **Status**: ❌ FIX REQUIRED
- What changes: Call `Products.load()` after saving category
- Function(s): `saveCategory()`
- Data shapes: Products module has `load()` method
- Integration points: Categories module notifies Products module
- Error paths: None — ensures category cache refresh
- **MUST-FIX**: Add `await Products.load()` call in saveCategory()

### src/renderer/js/modules/cart.js
- **Status**: ✅ NO FIX NEEDED
- What changes: Already has `clear()` method implemented
- Function(s): `clear()`
- Data shapes: Clears `cartItems` array and updates UI
- Integration points: Called by `auth.js` logout handler
- Error paths: None — enables cart clearing

### src/renderer/js/app.js
- **Status**: ✅ NO FIX NEEDED
- What changes: Already calls `Session.clear()` in logout handler
- Function(s): logout click handler
- Data shapes: Cart module has `clear()` method
- Integration points: Called on logout button click
- Error paths: None — ensures cart is cleared on logout
- **SHOULD-FIX**: Add `Cart.clear()` call in logout handler (currently only clears Session)

### src/database/migrations.ts
- **Status**: ❌ FIX REQUIRED
- What changes: Add migration v6 to add `role` column to test schema
- Function(s): `migrations[5]`
- Data shapes: `admin_users` table has `role TEXT NOT NULL DEFAULT 'caixa'`
- Integration points: Applied on database startup
- Error paths: None — ensures test schema matches production
- **MUST-FIX**: Add migration v6 to add `role` column to test schema

### tests/sale.test.ts
- **Status**: ❌ FIX REQUIRED
- What changes: Add `role` column to test `admin_users` inserts
- Function(s): `beforeEach` in `AuthService` describe block
- Data shapes: `admin_users` insert includes `role: 'admin'`
- Integration points: Test setup
- Error paths: None — fixes test failures
- **MUST-FIX**: Add `role: 'admin'` to test user inserts

### src/renderer/js/modules/products.js
- **Status**: ❌ FIX REQUIRED
- What changes: Fix CSV import to handle quoted fields using simple parser
- Function(s): `importCsv()`, `downloadCsvTemplate()`
- Data shapes: CSV lines may contain commas in quoted fields
- Integration points: Called by frontend CSV import
- Error paths: Simple parser rejects quoted fields; document limitation
- **MUST-FIX**: Implement proper CSV parsing that handles quoted fields

## Edge cases

1. **Session expiry at exact boundary**: `datetime(expires_at) > datetime('now')` correctly excludes sessions expiring exactly now ✅
2. **Sync with no password_hash**: Generate random placeholder hash for new users ✅
3. **CSV with empty lines**: Skip empty lines in bulk import ✅
4. **CSV with invalid numbers**: Report error and continue with next line ✅
5. **Cart with many items**: `clear()` should handle any number of items ✅
6. **Reports with zero days**: Use `Math.max(1, days)` to avoid division by zero ✅
7. **UTC offset variations**: Use local date formatting for date inputs ❌ (FIX REQUIRED)
8. **Category deletion with products**: `ON DELETE SET NULL` handles orphaned products ✅
9. **CSV with trailing commas**: Trim each column value ✅
10. **Sync with network failure**: Client retries every 10 minutes ✅
11. **Sync ID collision**: Auto-increment IDs can collide across machines ❌ (HIGH RISK)
12. **CSV quoted fields**: Commas inside quoted fields break parsing ❌ (FIX REQUIRED)

## Verification

- Run: `npm run build` to verify TypeScript compilation
- Run: `npm test` to verify tests pass
- Manual: Login as admin, check session expiry in database ✅
- Manual: Export CSV from Excel, import into system ❌ (need to test quoted fields)
- Manual: Generate report for single day, verify daily_average equals total_revenue ❌ (need to test)
- Manual: Logout and login as different user, verify cart is empty ❌ (need to test)
- Manual: Edit category, verify product page shows new category name ❌ (need to test)
- Manual: Test CSV import with commas in quoted fields ❌ (need to test)
- Manual: Test sync with multiple machines using same auto-increment IDs ❌ (need to test)

## Standards / common-mistakes referenced

- SQLite datetime comparison: Always use `datetime(column) > datetime('now')` for ISO strings ✅
- NOT NULL constraints: Include all required columns in INSERT statements ✅
- CSV parsing: Be aware of UTF-8 BOM and quoted fields ❌ (FIX REQUIRED)
- Timezone handling: Use local time for UI date inputs, UTC for storage ❌ (FIX REQUIRED)
- Pagination: Use floor for day count in inclusive ranges ❌ (FIX REQUIRED)

## Estimated scope

L

## Open questions (CONSIDER from review)

- Should CSV import use a proper CSV parser library instead of `split(',')`? ❓ (MUST-FIX)
- Should cart state be persisted to localStorage instead of module variable? ❓
- Should session expiry use UTC comparison instead of local time? ✅ (already correct)
- Should sync use UUIDs instead of auto-increment IDs to avoid collisions? ❓ (HIGH RISK)
- Should Products module be notified when categories change? ❓ (MUST-FIX)

## MUST-FIX Summary

| Bug # | Issue | File | Priority |
|-------|-------|------|----------|
| 6 | Sale report daily_average uses ceil instead of floor | src/services/sale.service.ts | HIGH |
| 7 | Cart persists across logout | src/renderer/js/modules/auth.js | HIGH |
| 8 | Reports default date uses UTC instead of local | src/renderer/js/modules/reports.js | MEDIUM |
| 9 | Test schema missing role column | src/database/migrations.ts, tests/sale.test.ts | MEDIUM |
| 10 | Products module retains stale category names | src/renderer/js/modules/categories.js | MEDIUM |
| 11 | CSV parsing breaks on quoted fields | src/renderer/js/modules/products.js | HIGH |
| 12 | Sync ID collision risk | src/services/sync.service.ts | CRITICAL |

## SHOULD-FIX Summary

| Bug # | Issue | File | Priority |
|-------|-------|------|----------|
| 1 | Session expiry datetime format | src/services/session.service.ts | LOW (already fixed) |
| 2 | Sync user insert NOT NULL | src/services/sync.service.ts | LOW (already fixed) |
| 3 | CSV ignores unit/description | src/main/main.ts | LOW (already fixed) |
| 4 | CSV UTF-8 BOM | src/main/main.ts | LOW (already fixed) |
| 5 | Sync server race condition | src/services/sync.service.ts | LOW (already fixed) |
| 13 | Add Cart.clear() to app.js logout | src/renderer/js/app.js | MEDIUM |
