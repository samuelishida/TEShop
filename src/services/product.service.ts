import Database from 'better-sqlite3';
import { DatabaseManager } from '../database/connection';
import { Product, ProductMetadata, Category, Sale, SaleItem, SaleReport } from '../types';

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

export class ProductService {
  private db: Database.Database;

  constructor() {
    this.db = DatabaseManager.getInstance();
  }

  private parseProduct(row: any): Product {
    return {
      ...row,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
    };
  }

  private parseProducts(rows: any[]): Product[] {
    return rows.map(row => this.parseProduct(row));
  }

  public findAll(options: PaginationOptions = {}): PaginatedResult<Product> {
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
    const offset = Math.max(options.offset ?? 0, 0);

    const countStmt = this.db.prepare('SELECT COUNT(*) as total FROM products');
    const total = (countStmt.get() as { total: number }).total;

    const stmt = this.db.prepare(`
      SELECT p.*, json(p.data) as data
      FROM products p
      ORDER BY p.name
      LIMIT ? OFFSET ?
    `);
    const items = this.parseProducts(stmt.all(limit, offset) as any[]);

    return { items, total, limit, offset, hasMore: offset + items.length < total };
  }

  public findById(id: number): Product | undefined {
    const stmt = this.db.prepare(`
      SELECT *, json(data) as data
      FROM products WHERE id = ?
    `);
    const product = stmt.get(id);
    return product ? this.parseProduct(product) : undefined;
  }

  public findBySku(sku: string): Product | undefined {
    const stmt = this.db.prepare(`
      SELECT *, json(data) as data
      FROM products WHERE sku = ?
    `);
    const product = stmt.get(sku);
    return product ? this.parseProduct(product) : undefined;
  }

  public findByCategory(categoryId: number, options: PaginationOptions = {}): PaginatedResult<Product> {
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
    const offset = Math.max(options.offset ?? 0, 0);

    const countStmt = this.db.prepare('SELECT COUNT(*) as total FROM products WHERE category_id = ?');
    const total = (countStmt.get(categoryId) as { total: number }).total;

    const stmt = this.db.prepare(`
      SELECT *, json(data) as data
      FROM products WHERE category_id = ?
      ORDER BY name
      LIMIT ? OFFSET ?
    `);
    const items = this.parseProducts(stmt.all(categoryId, limit, offset) as any[]);

    return { items, total, limit, offset, hasMore: offset + items.length < total };
  }

  public search(query: string, options: PaginationOptions = {}): PaginatedResult<Product> {
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
    const offset = Math.max(options.offset ?? 0, 0);
    const searchQuery = `%${query}%`;

    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as total FROM products WHERE name LIKE ? OR sku LIKE ?
    `);
    const total = (countStmt.get(searchQuery, searchQuery) as { total: number }).total;

    const stmt = this.db.prepare(`
      SELECT *, json(data) as data
      FROM products
      WHERE name LIKE ? OR sku LIKE ?
      ORDER BY name
      LIMIT ? OFFSET ?
    `);
    const items = this.parseProducts(stmt.all(searchQuery, searchQuery, limit, offset) as any[]);

    return { items, total, limit, offset, hasMore: offset + items.length < total };
  }

  public create(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Product {
    const stmt = this.db.prepare(`
      INSERT INTO products (sku, name, category_id, price, stock, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      product.sku,
      product.name,
      product.category_id,
      product.price,
      product.stock,
      JSON.stringify(product.data)
    );

    return this.findById(info.lastInsertRowid as number) as Product;
  }

  public update(id: number, updates: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>): Product | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.sku !== undefined) {
      fields.push('sku = ?');
      values.push(updates.sku);
    }
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.category_id !== undefined) {
      fields.push('category_id = ?');
      values.push(updates.category_id);
    }
    if (updates.price !== undefined) {
      fields.push('price = ?');
      values.push(updates.price);
    }
    if (updates.stock !== undefined) {
      fields.push('stock = ?');
      values.push(updates.stock);
    }
    if (updates.data !== undefined) {
      fields.push('data = ?');
      values.push(JSON.stringify(updates.data));
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    if (fields.length === 1) {
      return this.findById(id);
    }

    const stmt = this.db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  public delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM products WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  public updateStock(productId: number, quantityChange: number): boolean {
    const stmt = this.db.prepare(`
      UPDATE products
      SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND stock + ? >= 0
    `);
    const result = stmt.run(quantityChange, productId, quantityChange);
    return result.changes > 0;
  }

  public getLowStock(threshold: number = 10): Product[] {
    const stmt = this.db.prepare(`
      SELECT *, json(data) as data
      FROM products WHERE stock <= ? AND stock > 0
      ORDER BY stock ASC
    `);
    return this.parseProducts(stmt.all(threshold) as any[]);
  }

  public getOutOfStock(): Product[] {
    const stmt = this.db.prepare(`
      SELECT *, json(data) as data
      FROM products WHERE stock = 0
    `);
    return this.parseProducts(stmt.all() as any[]);
  }
}
