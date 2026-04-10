import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
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
  private readonly usersStorageKey = 'users';
  private readonly currentUserStorageKey = 'currentUser';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private users: User[] = [];

  constructor() {
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

  register(data: RegisterData): { success: boolean; message: string } {
    const department = normalizeDepartment(data.department);
    if (!isKnownDepartment(department)) {
      return { success: false, message: 'Please choose a valid department' };
    }

    const existingUser = this.users.find(u => u.email === data.email);

    if (existingUser) {
      return { success: false, message: 'Email already registered' };
    }

    if (!data.email.endsWith('@liceo.edu.ph')) {
      return { success: false, message: 'Use your official @liceo.edu.ph email' };
    }

    let role: UserRole = 'student';

    if (data.adminCode === 'ADMIN123') {
      role = 'admin';
    }

    if (data.adminCode && data.adminCode !== 'ADMIN123') {
      return { success: false, message: 'Invalid admin code' };
    }

    const newUser: User = {
      id: this.generateId(),
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      department,
      role,
      createdAt: new Date()
    };

    this.users.push(newUser);
    this.saveUsers();

    return { success: true, message: 'Registration successful' };
  }

  login(credentials: LoginCredentials): { success: boolean; message: string } {
    const user = this.users.find(
      candidate =>
        candidate.email === credentials.email && candidate.password === credentials.password
    );

    if (!user) {
      return { success: false, message: 'Invalid email or password' };
    }

    this.currentUserSubject.next(user);
    localStorage.setItem(this.currentUserStorageKey, JSON.stringify(user));

    return { success: true, message: 'Login successful' };
  }

  isEmailRegistered(email: string): boolean {
    return this.users.some(user => user.email === email);
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
