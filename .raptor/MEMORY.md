## session-facts (2026-05-03)
- The project is a modular Point of Sale (PDV) and Inventory Management system initially configured for a Pet Shop.
- The architecture is designed to be generic for any retail environment.
- The project uses Electron as a cross-platform desktop framework.
- **CORRECTION**: WRONG: The assistant suggested a factory pattern with dependency injection (DI) which created unnecessary complexity. RIGHT: Refactor the modules to be simple exports that reference each other through global scope.

## session-facts (2026-05-03)
- The project uses versioned migrations for database changes.
- The project requires non-destructive synchronization methods (upsert/merge).
- The project includes pagination in listing methods.
- **CORRECTION**: WRONG: The assistant did not mention the need to update the `app_state` table for sync functionality. RIGHT: Always include necessary database schema updates in migration tasks.

## session-facts (2026-05-04)
- The project uses Electron, SQLite, and TypeScript with strict settings.
- The CSP configuration was blocking ES modules, causing frontend buttons to malfunction.
- **CORRECTION**: WRONG: The assistant did not initially identify the CSP issue as the root cause. RIGHT: Always check CSP settings when frontend functionality is impaired.

## session-facts (2026-05-04)
- The project uses a Content Security Policy (CSP) that initially blocked ES modules, causing functionality issues with buttons.
- The project includes specific files like `src/renderer/index.html` and `src/main/main.ts` that are critical for the functionality being discussed.
- **CORRECTION**: WRONG: The assistant incorrectly stated that `'module'` is a valid CSP keyword. RIGHT: `'module'` is not valid; the correct approach is to use `script-src 'self'` to allow `<script type="module">`.

## session-facts (2026-05-04)
- The project uses `better-sqlite3` as a dependency, which requires recompilation for compatibility with Electron.
- The project has a specific Node.js version requirement that must match the Electron version.
- **CORRECTION**: WRONG: The assistant did not clarify the need to ensure compatibility between Node.js and Electron versions. RIGHT: Always check and match the Node.js version with the Electron version when working with native modules.

## session-facts (2026-05-04)
- The property for `PaginatedResult` is defined as `.data`, but handlers IPC incorrectly access it as `.items`.
- **CORRECTION**: WRONG: The assistant suggested checking how modules are loaded and event listeners are attached without addressing the specific issue with `PaginatedResult`. RIGHT: Focus on correcting the access of `.items` to `.data` in all IPC handlers as identified by the user.

## session-facts (2026-05-04)
- Handlers IPC using `PaginatedResult` incorrectly access `.items` instead of `.data`.
- **CORRECTION**: WRONG: The assistant suggested tracing the data flow without addressing the specific property access issue. RIGHT: Focus on correcting the property access from `.items` to `.data` in the handlers.

## session-facts (2026-05-04)
- The `app.js` file is responsible for initializing the application and calling `Navigation.init()`.
- Other modules (Products, POS, Categories, Users, Reports) have an `init()` function that needs to be called for event listeners to work.
- **CORRECTION**: WRONG: The assistant did not initially identify the need to call `init()` in other modules. RIGHT: Ensure that all necessary `init()` functions are called in the main application file.

## session-facts (2026-05-04)
- The `init()` function is called twice in `app.js`, leading to potential issues.
- Handlers in `main.ts` return inconsistent data formats, causing errors in the frontend.
- The `tsconfig.json` has a deprecated warning for `moduleResolution=node10`.
- **CORRECTION**: WRONG: The assistant suggested a complete analysis without addressing specific issues first. RIGHT: Focus on identifying and correcting specific problems before a full analysis.

## session-facts (2026-05-04)
- The project uses `better-sqlite3` as a dependency.
- The project is built with Electron.
- **CORRECTION**: WRONG: The assistant suggested recompiling for Node.js instead of Electron. RIGHT: Always ensure to recompile modules specifically for Electron when working in that environment.

## session-facts (2026-05-04)
- The project uses a `package.json` file to manage scripts for testing and building.
- The workflow includes commands for recompiling to Node.js for tests and to Electron for development.
- The `posttest` script in `package.json` automatically recompiles to Electron after tests are completed.
- **CORRECTION**: WRONG: The assistant did not specify the need for separate recompilation for Node.js and Electron. RIGHT: Clearly define the workflow for recompiling for tests and development builds.

## session-facts (2026-05-04)
- The project uses Vite for building JS/CSS/HTML and does not touch native modules during the build.
- The `rebuild.js` script is designed to detect Electron automatically.
- The `package.json` includes a `predev` script to ensure Electron is rebuilt before each development run.
- **CORRECTION**: WRONG: The assistant suggested executing a script with shebang via `cat`. RIGHT: Use the appropriate command to execute the script directly instead.

## session-facts (2026-05-04)
- The project uses TypeScript with a `tsconfig.json` file for configuration.
- The build command for the project is `npm run build`.
- The user has a specific workflow that includes recompiling dependencies for Electron.
- **CORRECTION**: WRONG: The assistant did not clarify the user's request for recompiling. RIGHT: Confirm the specific action the user wants to take regarding recompilation.

## session-facts (2026-05-04)
- The project involves creating a product panel with options for adding a single product and bulk importing via CSV.
- The existing HTML structure lacks buttons for adding products and modals for product creation and CSV import.
- The implementation will include CSS for modals and backend handling for CSV import.
- **CORRECTION**: WRONG: The assistant did not mention the need for a CSV template download. RIGHT: Ensure to provide a template for CSV import along with user instructions.
