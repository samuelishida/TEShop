import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { DatabaseManager } from '../database/connection';
import { AdminUser, LoginRequest } from '../types';

export class AuthService {
  private db: Database.Database;

  constructor() {
    this.db = DatabaseManager.getInstance();
  }

  public login(credentials: LoginRequest): { success: boolean; user?: Omit<AdminUser, 'password_hash'>; message?: string } {
    const user = this.db.prepare('SELECT * FROM admin_users WHERE username = ?').get(credentials.username) as AdminUser | undefined;
    
    if (!user) {
      return { success: false, message: 'Usuário ou senha inválidos' };
    }

    const isValid = bcrypt.compareSync(credentials.password, user.password_hash);
    
    if (!isValid) {
      return { success: false, message: 'Usuário ou senha inválidos' };
    }

    const { password_hash, ...userWithoutPassword } = user;
    return { success: true, user: userWithoutPassword };
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

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(newPassword, salt);
    
    this.db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hash, userId);
    
    return { success: true };
  }

  public resetAdminUser(): { success: boolean; message: string } {
    const salt = bcrypt.genSaltSync(10);
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
    const existing = this.db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username);
    if (existing) {
      return { success: false, message: 'Nome de usuário já existe' };
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    this.db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, 'caixa');
    return { success: true, message: `Usuário caixa '${username}' criado com sucesso` };
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
