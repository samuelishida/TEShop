import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';

export interface Session {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  created_at: string;
}

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class SessionManager {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)
    `);
  }

  /**
   * Create a new session for a user.
   * Returns the token.
   */
  public create(userId: number): string {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

    this.db.prepare(`
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES (?, ?, ?)
    `).run(userId, token, expiresAt);

    return token;
  }

  /**
   * Validate a token and return session info if valid.
   */
  public validate(token: string): { valid: boolean; userId?: number; sessionId?: number } {
    if (!token || typeof token !== 'string') {
      return { valid: false };
    }

    const session = this.db.prepare(`
      SELECT * FROM sessions
      WHERE token = ? AND datetime(expires_at) > datetime('now')
    `).get(token) as Session | undefined;

    if (!session) {
      return { valid: false };
    }

    return { valid: true, userId: session.user_id, sessionId: session.id };
  }

  /**
   * Invalidate a specific session.
   */
  public revoke(token: string): boolean {
    const result = this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return result.changes > 0;
  }

  /**
   * Invalidate all sessions for a user.
   */
  public revokeAllForUser(userId: number): number {
    const result = this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    return result.changes;
  }

  /**
   * Clean up expired sessions.
   */
  public cleanup(): number {
    const result = this.db.prepare(`
      DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')
    `).run();
    return result.changes;
  }

  /**
   * Get active session count for a user.
   */
  public getActiveSessionCount(userId: number): number {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM sessions
      WHERE user_id = ? AND datetime(expires_at) > datetime('now')
    `).get(userId) as { count: number };
    return result.count;
  }
}
