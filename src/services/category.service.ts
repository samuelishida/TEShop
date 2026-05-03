import Database from 'better-sqlite3';
import { DatabaseManager } from '../database/connection';
import { Category } from '../types';

export class CategoryService {
  private db: Database.Database;

  constructor() {
    this.db = DatabaseManager.getInstance();
  }

  public findAll(): Category[] {
    const stmt = this.db.prepare('SELECT * FROM categories ORDER BY name');
    return stmt.all() as unknown as Category[];
  }

  public findById(id: number): Category | undefined {
    const stmt = this.db.prepare('SELECT * FROM categories WHERE id = ?');
    return stmt.get(id) as unknown as Category | undefined;
  }

  public create(category: Omit<Category, 'id' | 'created_at'>): Category {
    const stmt = this.db.prepare(`
      INSERT INTO categories (name, description, parent_id)
      VALUES (?, ?, ?)
    `);
    
    const info = stmt.run(category.name, category.description, category.parent_id);
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

    values.push(id);

    if (fields.length === 0) {
      return this.findById(id);
    }

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
