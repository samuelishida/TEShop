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
      this.db.prepare('UPDATE admin_users SET password_hash = ? WHERE username = ?').run(hash, 'admin');
      return { success: true, message: 'Senha do admin redefinida para: admin123' };
    } else {
      this.db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run('admin', hash);
      return { success: true, message: 'Usuário admin criado. Senha: admin123' };
    }
  }
}
