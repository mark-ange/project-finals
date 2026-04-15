import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import {
  DEMO_DEPARTMENT_ACCOUNTS,
  isKnownDepartment,
  normalizeDepartment,
  sameDepartment,
  UserRole
} from './department-directory';

export interface User {
  id: string;
  fullName: string;
  email: string;
  password: string;
  department: string;
  role: UserRole;
  profileImage?: string;
  createdAt: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  fullName: string;
  email: string;
  password: string;
  department: string;
  adminCode?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = 'http://localhost:3000/api/users';
  private readonly usersStorageKey = 'users';
  private readonly currentUserStorageKey = 'currentUser';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private users: User[] = [];

  constructor(private http: HttpClient) {
    this.loadUsers();
    this.loadCurrentUser();
  }

  private loadUsers(): void {
    const storedUsers = localStorage.getItem(this.usersStorageKey);
    if (storedUsers) {
      try {
        const parsed = JSON.parse(storedUsers) as unknown;
        if (Array.isArray(parsed)) {
          this.users = parsed
            .filter(user => user && typeof user === 'object')
            .map(user => this.normalizeUser(user as User));
        }
      } catch {
        this.users = [];
      }
    }

    const merged = this.mergeDemoUsers(this.users);
    this.users = merged.users;
    if (merged.changed) {
      this.saveUsers();
    }
  }

  private loadAdminCodes(): void {
    const storedCodes = localStorage.getItem(this.adminCodesStorageKey);
    if (storedCodes) {
      try {
        const parsed = JSON.parse(storedCodes) as unknown;
        if (Array.isArray(parsed)) {
          this.adminCodes = parsed.filter(code => typeof code === 'string');
        }
      } catch {
        this.adminCodes = [];
      }
    }

    if (!this.adminCodes.length) {
      this.adminCodes = ['ADMIN123'];
      this.saveAdminCodes();
    }
  }

  private loadResetTokens(): void {
    const storedTokens = localStorage.getItem(this.resetTokensStorageKey);
    if (storedTokens) {
      try {
        const parsed = JSON.parse(storedTokens) as unknown;
        if (Array.isArray(parsed)) {
          this.resetTokens = parsed.filter(
            token => token && typeof token === 'object'
          ) as Array<{ email: string; token: string; createdAt: string }>;
        }
      } catch {
        this.resetTokens = [];
      }
    }
  }

  private saveResetTokens(): void {
    localStorage.setItem(this.resetTokensStorageKey, JSON.stringify(this.resetTokens));
  }

  private loadCurrentUser(): void {
    const storedCurrentUser = localStorage.getItem(this.currentUserStorageKey);
    if (!storedCurrentUser) return;

    try {
      const parsed = this.normalizeUser(JSON.parse(storedCurrentUser) as User);
      const latest = this.users.find(user => user.email === parsed.email) ?? parsed;
      this.currentUserSubject.next(latest);
      localStorage.setItem(this.currentUserStorageKey, JSON.stringify(latest));
    } catch {
      this.currentUserSubject.next(null);
      localStorage.removeItem(this.currentUserStorageKey);
    }
  }

  private saveUsers(): void {
    localStorage.setItem(this.usersStorageKey, JSON.stringify(this.users));
  }

  private saveAdminCodes(): void {
    localStorage.setItem(this.adminCodesStorageKey, JSON.stringify(this.adminCodes));
  }

  register(data: RegisterData): Observable<{ success: boolean; message: string }> {
    const department = normalizeDepartment(data.department);
    if (!isKnownDepartment(department)) {
      return of({ success: false, message: 'Please choose a valid department' });
    }

    const normalizedEmail = this.normalizeEmail(data.email);
    const existingUser = this.users.find(u => u.email === normalizedEmail);

    if (existingUser) {
      return of({ success: false, message: 'Email already registered' });
    }

    if (!this.isLiceoEmail(data.email)) {
      return of({ success: false, message: 'Use your official @liceo.edu.ph email' });
    }

    const email = this.normalizeEmail(data.email);

    let role: UserRole = 'student';

    if (data.adminCode) {
      return this.http.post<{ valid: boolean }>(`${this.apiUrl}/validate-admin-code`, { code: data.adminCode }).pipe(
        map(response => {
          if (!response.valid) {
            return { success: false, message: 'Invalid admin code' };
          }
          role = 'admin';
          const newUser: User = {
            id: this.generateId(),
            fullName: data.fullName,
            email,
            password: data.password,
            department,
            role,
            createdAt: new Date()
          };
          this.users.push(newUser);
          this.saveUsers();
          return { success: true, message: 'Registration successful' };
        }),
        catchError(() => of({ success: false, message: 'Failed to validate admin code' }))
      );
    } else {
      const newUser: User = {
        id: this.generateId(),
        fullName: data.fullName,
        email,
        password: data.password,
        department,
        role,
        createdAt: new Date()
      };
      this.users.push(newUser);
      this.saveUsers();
      return of({ success: true, message: 'Registration successful' });
    }
  }

  login(credentials: LoginCredentials): { success: boolean; message: string } {
    if (!this.isLiceoEmail(credentials.email)) {
      return { success: false, message: 'Please use your official @liceo.edu.ph email to log in.' };
    }

    const normalizedEmail = this.normalizeEmail(credentials.email);
    const user = this.users.find(
      candidate =>
        candidate.email === normalizedEmail && candidate.password === credentials.password
    );

    if (!user) {
      return { success: false, message: 'Invalid email or password' };
    }

    this.currentUserSubject.next(user);
    localStorage.setItem(this.currentUserStorageKey, JSON.stringify(user));

    return { success: true, message: 'Login successful' };
  }

  private isLiceoEmail(email: string): boolean {
    return typeof email === 'string' && this.normalizeEmail(email).endsWith('@liceo.edu.ph');
  }

  private normalizeAdminCode(code: string): string {
    return typeof code === 'string' ? code.trim().toUpperCase() : '';
  }

  private normalizeEmail(email: string): string {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
  }

  private isValidAdminCode(code: string): boolean {
    return this.adminCodes.includes(this.normalizeAdminCode(code));
  }

  private consumeAdminCode(code: string): boolean {
    const normalizedCode = this.normalizeAdminCode(code);
    const index = this.adminCodes.indexOf(normalizedCode);
    if (index === -1) {
      return false;
    }

    this.adminCodes.splice(index, 1);
    this.saveAdminCodes();
    return true;
  }

  generateAdminCode(): Observable<{ code: string }> {
    const currentUser = this.currentUserSubject.value;
    if (!currentUser) throw new Error('No current user');

    return this.http.post<{ code: string }>(`${this.apiUrl}/admin-codes`, { created_by: currentUser.email });
  }

  getAdminCodes(): Observable<{ codes: Array<{ code: string; created_by: string; created_at: string }> }> {
    return this.http.get<{ codes: Array<{ code: string; created_by: string; created_at: string }> }>(`${this.apiUrl}/admin-codes`);
  }

  requestPasswordReset(email: string): Observable<{ success: boolean; message: string; link?: string }> {
    return this.http.post<{ token: string; link: string }>(`${this.apiUrl}/reset-tokens`, { email }).pipe(
      map(response => ({
        success: true,
        message: `Password reset link generated successfully. Share this with the user: ${response.link}`,
        link: response.link
      })),
      catchError(() => of({
        success: false,
        message: 'Failed to generate reset link.'
      }))
    );
  }

  private generateResetToken(email: string): string {
    const token = `RESET-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    this.resetTokens.push({
      email,
      token,
      createdAt: new Date().toISOString()
    });
    this.saveResetTokens();
    return token;
  }

  isEmailRegistered(email: string): boolean {
    const normalizedEmail = this.normalizeEmail(email);
    return this.users.some(user => user.email === normalizedEmail);
  }

  logout(): void {
    this.currentUserSubject.next(null);
    localStorage.removeItem(this.currentUserStorageKey);
  }

  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getAllUsers(): User[] {
    return this.users.slice();
  }

  findUserById(userId: string): User | undefined {
    return this.users.find(user => user.id === userId);
  }

  getDepartmentStudents(department: string): User[] {
    return this.users.filter(
      user => user.role === 'student' && sameDepartment(user.department, department)
    );
  }

  getDepartmentAdmins(department: string): User[] {
    return this.users.filter(
      user =>
        user.role === 'main-admin' || (user.role === 'admin' && sameDepartment(user.department, department))
    );
  }

  isAdmin(): boolean {
    const user = this.currentUserSubject.value;
    return user?.role === 'admin' || user?.role === 'main-admin';
  }

  isMainAdmin(): boolean {
    return this.currentUserSubject.value?.role === 'main-admin';
  }

  isSameDepartment(otherDepartment: string | null | undefined): boolean {
    return sameDepartment(this.currentUserSubject.value?.department, otherDepartment);
  }

  canManageDepartment(otherDepartment: string | null | undefined): boolean {
    const currentUser = this.currentUserSubject.value;
    if (!currentUser) return false;
    if (currentUser.role === 'main-admin') return true;
    return currentUser.role === 'admin' && sameDepartment(currentUser.department, otherDepartment);
  }

  updateProfile(data: Partial<User>): void {
    const currentUser = this.currentUserSubject.value;

    if (!currentUser) return;

    const updatedUser: User = {
      ...currentUser,
      ...data,
      department: currentUser.department
    };

    this.currentUserSubject.next(updatedUser);

    const index = this.users.findIndex(u => u.id === currentUser.id);

    if (index !== -1) {
      this.users[index] = updatedUser;
    }

    this.saveUsers();
    localStorage.setItem(this.currentUserStorageKey, JSON.stringify(updatedUser));
  }

  private generateId(): string {
    return 'user_' + Math.random().toString(36).substring(2, 9);
  }

  private normalizeUser(user: User): User {
    return {
      ...user,
      email: this.normalizeEmail(user.email),
      department: normalizeDepartment(user.department) || user.department || 'Unknown'
    };
  }

  private mergeDemoUsers(existingUsers: User[]): { users: User[]; changed: boolean } {
    const users = existingUsers.slice();
    let changed = false;

    for (const demo of DEMO_DEPARTMENT_ACCOUNTS) {
      const existing = users.find(user => user.email === demo.email);
      if (existing) continue;

      users.push({
        id: this.generateId(),
        fullName: demo.fullName,
        email: demo.email,
        password: demo.password,
        department: demo.department,
        role: demo.role,
        createdAt: new Date()
      });
      changed = true;
    }

    return { users, changed };
  }
}
