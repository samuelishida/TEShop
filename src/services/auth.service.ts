import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { DatabaseManager } from '../database/connection';
import { AdminUser, LoginRequest } from '../types';
import { SessionManager } from './session.service';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface LoginAttempt {
  count: number;
  lockedUntil: number | null;
}

// In-memory store: username -> attempt info
const loginAttempts = new Map<string, LoginAttempt>();

function getAttempt(username: string): LoginAttempt {
  return loginAttempts.get(username) ?? { count: 0, lockedUntil: null };
}

function recordFailure(username: string): LoginAttempt {
  const attempt = getAttempt(username);
  attempt.count++;
  if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
    attempt.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  loginAttempts.set(username, attempt);
  return attempt;
}

function resetAttempts(username: string): void {
  loginAttempts.delete(username);
}

export class AuthService {
  private db: Database.Database;
  private sessions: SessionManager;

  constructor() {
    this.db = DatabaseManager.getInstance();
    this.sessions = new SessionManager(this.db);
  }

  public login(credentials: LoginRequest): { success: boolean; user?: Omit<AdminUser, 'password_hash'>; token?: string; message?: string } {
    const username = credentials.username;
    const attempt = getAttempt(username);

    if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
      const minutesLeft = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
      return { success: false, message: `Conta bloqueada. Tente novamente em ${minutesLeft} minuto(s).` };
    }

    // Reset stale lockout
    if (attempt.lockedUntil && Date.now() >= attempt.lockedUntil) {
      resetAttempts(username);
    }

    const user = this.db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username) as AdminUser | undefined;

    if (!user) {
      recordFailure(username);
      return { success: false, message: 'Usuário ou senha inválidos' };
    }

    const isValid = bcrypt.compareSync(credentials.password, user.password_hash);

    if (!isValid) {
      const updated = recordFailure(username);
      const remaining = MAX_LOGIN_ATTEMPTS - updated.count;
      if (remaining > 0) {
        return { success: false, message: `Usuário ou senha inválidos. ${remaining} tentativa(s) restante(s).` };
      }
      return { success: false, message: `Conta bloqueada por 15 minutos após ${MAX_LOGIN_ATTEMPTS} tentativas.` };
    }

    resetAttempts(username);
    const token = this.sessions.create(user.id);
    const { password_hash, ...userWithoutPassword } = user;
    return { success: true, user: userWithoutPassword, token };
  }

  public logout(token: string): { success: boolean } {
    this.sessions.revoke(token);
    return { success: true };
  }

  public validateToken(token: string): { valid: boolean; userId?: number } {
    const result = this.sessions.validate(token);
    return { valid: result.valid, userId: result.userId };
  }

  public changePassword(userId: number, oldPassword: string, newPassword: string): { success: boolean; message?: string } {
    const user = this.db.prepare('SELECT * FROM admin_users WHERE id = ?').get(userId) as AdminUser | undefined;
    
    if (!user) {
      return { success: false, message: 'Usuário não encontrado' };
    }

    const isValid = bcrypt.compareSync(oldPassword, user.password_hash);
    
    if (!isValid) {
      return { success: false, message: 'Senha atual incorreta' };
    }

    const salt = bcrypt.genSaltSync(12);
    const hash = bcrypt.hashSync(newPassword, salt);

    this.db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hash, userId);
    
    return { success: true };
  }

  public resetAdminUser(): { success: boolean; message: string } {
    const salt = bcrypt.genSaltSync(12);
    const hash = bcrypt.hashSync('admin123', salt);

    const existing = this.db.prepare('SELECT id FROM admin_users WHERE username = ?').get('admin');
    if (existing) {
      this.db.prepare('UPDATE admin_users SET password_hash = ?, role = ? WHERE username = ?').run(hash, 'admin', 'admin');
      return { success: true, message: 'Senha do admin redefinida para: admin123' };
    } else {
      this.db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
      return { success: true, message: 'Usuário admin criado. Senha: admin123' };
    }
  }

  public createCashierUser(username: string, password: string): { success: boolean; message: string } {
    return this.createUser(username, password, 'caixa');
  }

  public createUser(username: string, password: string, role: 'admin' | 'caixa'): { success: boolean; message: string } {
    const existing = this.db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username);
    if (existing) {
      return { success: false, message: 'Nome de usuário já existe' };
    }

    const salt = bcrypt.genSaltSync(12);
    const hash = bcrypt.hashSync(password, salt);
    this.db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, role);
    const roleLabel = role === 'admin' ? 'Administrador' : 'Caixa';
    return { success: true, message: `Usuário '${username}' (${roleLabel}) criado com sucesso` };
  }

  public listUsers(): Omit<AdminUser, 'password_hash'>[] {
    const users = this.db.prepare('SELECT id, username, role, created_at FROM admin_users ORDER BY role, username').all() as Omit<AdminUser, 'password_hash'>[];
    return users;
  }

  public deleteUser(userId: number): { success: boolean; message: string } {
    const user = this.db.prepare('SELECT * FROM admin_users WHERE id = ?').get(userId) as AdminUser | undefined;
    if (!user) {
      return { success: false, message: 'Usuário não encontrado' };
    }
    if (user.role === 'admin') {
      const adminCount = this.db.prepare('SELECT COUNT(*) as count FROM admin_users WHERE role = ?').get('admin') as { count: number };
      if (adminCount.count <= 1) {
        return { success: false, message: 'Não é possível remover o último administrador' };
      }
    }
    this.db.prepare('DELETE FROM admin_users WHERE id = ?').run(userId);
    return { success: true, message: 'Usuário removido com sucesso' };
  }
}
