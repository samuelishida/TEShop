import Database from 'better-sqlite3';
import { join } from 'path';
import { app } from 'electron';
import bcrypt from 'bcryptjs';
import { applyMigrations, getCurrentVersion } from './migrations';
import { createLogger } from '../services/logger.service';

const log = createLogger('Database');

export class DatabaseManager {
  private static instance: Database.Database | null = null;

  public static getInstance(): Database.Database {
    if (!this.instance) {
      const dbPath = join(app.getPath('userData'), 'eshop.db');
      this.instance = new Database(dbPath);

      this.instance.pragma('journal_mode = WAL');
      this.instance.pragma('foreign_keys = ON');
    }
    return this.instance;
  }

  /**
   * Set a database instance directly — used for testing.
   * Call resetInstance() to clear it after tests.
   */
  public static setInstance(db: Database.Database): void {
    this.instance = db;
  }

  public static resetInstance(): void {
    if (this.instance) {
      try {
        this.instance.close();
      } catch {
        // May already be closed in tests
      }
      this.instance = null;
    }
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
  const beforeVersion = getCurrentVersion(db);
  applyMigrations(db);
  const afterVersion = getCurrentVersion(db);

  if (afterVersion > beforeVersion) {
    log.info('Database migrated', { from: beforeVersion, to: afterVersion });
  }

  // Seed default admin if no users exist
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM admin_users').get() as { count: number }).count;
  if (userCount === 0) {
    const salt = bcrypt.genSaltSync(12);
    const hash = bcrypt.hashSync('admin123', salt);
    db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
  }

  // Seed default categories if none exist
  const catCount = (db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number }).count;
  if (catCount === 0) {
    const categories = [
      { name: 'Geral', description: 'Produtos diversos' },
      { name: 'Alimentos', description: 'Alimentos e bebidas' },
      { name: 'Higiene', description: 'Produtos de higiene e limpeza' },
      { name: 'Acessórios', description: 'Acessórios e complementos' },
      { name: 'Serviços', description: 'Serviços e prestação' },
    ];
    const insert = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
    for (const cat of categories) {
      insert.run(cat.name, cat.description);
    }
  }
}
