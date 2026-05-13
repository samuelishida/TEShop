/**
 * Versioned database migrations.
 * Each migration has an `up()` that applies and a `down()` that reverts.
 * Migrations are applied in order via a version tracking table.
 */

export interface Migration {
  version: number;
  name: string;
  up(db: Database.Database): void;
  down(db: Database.Database): void;
}

import Database from 'better-sqlite3';

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'create_initial_tables',
    up(db) {
      // Products
      db.exec(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sku TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          category_id INTEGER,
          price REAL NOT NULL DEFAULT 0,
          stock INTEGER NOT NULL DEFAULT 0,
          data TEXT NOT NULL DEFAULT '{}',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES categories(id)
        )
      `);

      // Categories
      db.exec(`
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          parent_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (parent_id) REFERENCES categories(id)
        )
      `);

      // Sales
      db.exec(`
        CREATE TABLE IF NOT EXISTS sales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          items TEXT NOT NULL,
          total REAL NOT NULL,
          payment_method TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Sale items
      db.exec(`
        CREATE TABLE IF NOT EXISTS sale_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price REAL NOT NULL,
          total REAL NOT NULL
        )
      `);

      // Admin users
      db.exec(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'caixa',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Indexes on products
      db.exec('CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_products_id ON products(id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)');

      // Indexes on sale_items for reports
      db.exec('CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id)');
    },
    down(_db: Database.Database): void {
      // Reversing is destructive, so this is a no-op for safety
    },
  },
  {
    version: 2,
    name: 'create_sessions_table',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token TEXT UNIQUE NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
        )
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)');
    },
    down(db) {
      db.exec('DROP INDEX IF EXISTS idx_sessions_token');
      db.exec('DROP TABLE IF EXISTS sessions');
    },
  },
  {
    version: 3,
    name: 'create_sync_state_table',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS app_state (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    },
    down(db) {
      db.exec('DROP TABLE IF EXISTS app_state');
    },
  },
  {
    version: 4,
    name: 'add_foreign_keys_and_remove_redundant_items',
    up(db) {
      // Add status column to sales for cancellation support (must happen before sale_items_new FK)
      db.exec(`
        CREATE TABLE IF NOT EXISTS sales_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          total REAL NOT NULL,
          payment_method TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'completed',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.exec('INSERT INTO sales_new (id, total, payment_method, status, created_at) SELECT id, total, payment_method, \'completed\', created_at FROM sales');
      db.exec('DROP TABLE sales');
      db.exec('ALTER TABLE sales_new RENAME TO sales');

      // Add ON DELETE CASCADE to sale_items → sales
      db.exec(`
        CREATE TABLE IF NOT EXISTS sale_items_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price REAL NOT NULL,
          total REAL NOT NULL,
          FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
        )
      `);
      db.exec('INSERT INTO sale_items_new (id, sale_id, product_id, quantity, unit_price, total) SELECT id, sale_id, product_id, quantity, unit_price, total FROM sale_items');
      db.exec('DROP TABLE sale_items');
      db.exec('ALTER TABLE sale_items_new RENAME TO sale_items');
      db.exec('CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id)');

      // Add ON DELETE SET NULL to products → categories
      db.exec(`
        CREATE TABLE IF NOT EXISTS products_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sku TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          category_id INTEGER,
          price REAL NOT NULL DEFAULT 0,
          stock INTEGER NOT NULL DEFAULT 0,
          data TEXT NOT NULL DEFAULT '{}',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        )
      `);
      db.exec('INSERT INTO products_new (id, sku, name, category_id, price, stock, data, created_at, updated_at) SELECT id, sku, name, category_id, price, stock, data, created_at, updated_at FROM products');
      db.exec('DROP TABLE products');
      db.exec('ALTER TABLE products_new RENAME TO products');
      db.exec('CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_products_id ON products(id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)');

      // Add ON DELETE CASCADE to sessions → admin_users
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token TEXT UNIQUE NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
        )
      `);
      db.exec('INSERT INTO sessions_new (id, user_id, token, expires_at, created_at) SELECT id, user_id, token, expires_at, created_at FROM sessions');
      db.exec('DROP TABLE sessions');
      db.exec('ALTER TABLE sessions_new RENAME TO sessions');
      db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)');
    },
    down(_db) {
      // Reversal is not supported for safety
    },
  },
  {
    version: 5,
    name: 'add_category_config',
    up(db) {
      // Add config JSON column to categories for dynamic field definitions
      db.exec(`
        CREATE TABLE IF NOT EXISTS categories_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          parent_id INTEGER,
          config TEXT NOT NULL DEFAULT '{}',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (parent_id) REFERENCES categories(id)
        )
      `);
      db.exec(`
        INSERT INTO categories_new (id, name, description, parent_id, created_at)
        SELECT id, name, description, parent_id, created_at FROM categories
      `);
      db.exec('DROP TABLE categories');
      db.exec('ALTER TABLE categories_new RENAME TO categories');
    },
    down(_db) {
      // Reversal is not supported for safety
    },
  },
];

export function getCurrentVersion(db: Database.Database): number {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const row = db.prepare('SELECT MAX(version) as version FROM _migrations').get() as { version: number | null } | undefined;
  return row?.version ?? 0;
}

export function applyMigrations(db: Database.Database): void {
  const currentVersion = getCurrentVersion(db);

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      console.log(`[Migrations] Applying #${migration.version}: ${migration.name}`);
      db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT INTO _migrations (version, name) VALUES (?, ?)').run(migration.version, migration.name);
      })();
      console.log(`[Migrations] Applied #${migration.version}`);
    }
  }
}
