import Database from 'better-sqlite3';
import { join } from 'path';
import { app } from 'electron';
import bcrypt from 'bcryptjs';

export class DatabaseManager {
  private static instance: Database.Database | null = null;

  public static getInstance(): Database.Database {
    if (!this.instance) {
      const dbPath = join(app.getPath('userData'), 'eshop.db');
      this.instance = new Database(dbPath);
      
      // Enable WAL mode for better performance
      this.instance.pragma('journal_mode = WAL');
      this.instance.pragma('foreign_keys = ON');
    }
    return this.instance;
  }

  public static close(): void {
    if (this.instance) {
      this.instance.close();
      this.instance = null;
    }
  }
}

export async function runMigrations(): Promise<void> {
  const db = DatabaseManager.getInstance();

  // Create products table with JSONB column
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

  // Create categories table
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

  // Create sales table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      items TEXT NOT NULL,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create sale_items table for detailed reporting
  db.exec(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // Create admin_users table with role
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'caixa',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migrate existing users: add role column if missing
  try {
    db.exec(`ALTER TABLE admin_users ADD COLUMN role TEXT NOT NULL DEFAULT 'caixa'`);
  } catch (e) {
    // Column already exists
  }

  // Binary indexes for critical fields (high performance)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_products_id ON products(id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id)`);

  // Seed default admin user if not exists
  const adminExists = db.prepare('SELECT COUNT(*) as count FROM admin_users').get() as { count: number };
  if (adminExists.count === 0) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('admin123', salt);
    db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
  }

  // Seed default categories for Pet Shop
  const categoriesExist = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
  if (categoriesExist.count === 0) {
    const categories = [
      { name: 'Alimentos', description: 'Rações e alimentos para pets' },
      { name: 'Brinquedos', description: 'Brinquedos para animais' },
      { name: 'Higiene', description: 'Produtos de higiene e limpeza' },
      { name: 'Acessórios', description: 'Coleiras, guias, caminhas, etc.' },
      { name: 'Farmácia', description: 'Medicamentos e suplementos' },
    ];
    const insert = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
    for (const cat of categories) {
      insert.run(cat.name, cat.description);
    }
  }
}
