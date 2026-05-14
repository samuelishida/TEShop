import Database from 'better-sqlite3';
import { DatabaseManager } from '../database/connection';
import { Category } from '../types';

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

function parseCategory(row: any): Category {
  const config = row.config ? JSON.parse(row.config) : null;
  return { ...row, config };
}

export class CategoryService {
  private db: Database.Database;

  constructor() {
    this.db = DatabaseManager.getInstance();
  }

  public findAll(options: PaginationOptions = {}): PaginatedResult<Category> {
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
    const offset = Math.max(options.offset ?? 0, 0);

    const total = (this.db.prepare('SELECT COUNT(*) as total FROM categories').get() as { total: number }).total;

    const stmt = this.db.prepare(`
      SELECT * FROM categories ORDER BY name LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(limit, offset) as any[];
    const items = rows.map(parseCategory);

    return { items, total, limit, offset, hasMore: offset + items.length < total };
  }

  public findById(id: number): Category | undefined {
    const stmt = this.db.prepare('SELECT * FROM categories WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? parseCategory(row) : undefined;
  }

  public create(category: Omit<Category, 'id' | 'created_at'>): Category {
    const stmt = this.db.prepare(`
      INSERT INTO categories (name, description, parent_id, config)
      VALUES (?, ?, ?, ?)
    `);

    const info = stmt.run(category.name, category.description, category.parent_id, JSON.stringify(category.config || {}));
    return this.findById(info.lastInsertRowid as number) as Category;
  }

  public update(id: number, updates: Partial<Omit<Category, 'id' | 'created_at'>>): Category | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.parent_id !== undefined) {
      fields.push('parent_id = ?');
      values.push(updates.parent_id);
    }
    if (updates.config !== undefined) {
      fields.push('config = ?');
      values.push(JSON.stringify(updates.config));
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const stmt = this.db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  public delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM categories WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}
