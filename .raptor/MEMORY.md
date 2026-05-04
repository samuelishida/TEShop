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
