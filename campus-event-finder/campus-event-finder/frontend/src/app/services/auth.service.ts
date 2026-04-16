import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import {
  isKnownDepartment,
  normalizeDepartment,
  sameDepartment,
  UserRole
} from './department-directory';

export interface User {
  id: string;
  fullName: string;
  email: string;
  password?: string;
  department: string;
  role: UserRole;
  profileImage?: string;
  createdAt: Date | string;
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
  private readonly apiUrl = 'http://localhost:5000/api/users';
  private readonly currentUserStorageKey = 'currentUser';
  private readonly profileImageStorageKey = 'profileImage';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadCurrentUser();
  }

  private getThemeKey(userEmail: string): string {
    return `darkMode_${userEmail}`;
  }

  getDarkModePreference(): boolean {
    const user = this.currentUserSubject.value;
    if (!user) return false;
    return localStorage.getItem(this.getThemeKey(user.email)) === 'true';
  }

  setDarkModePreference(enabled: boolean): void {
    const user = this.currentUserSubject.value;
    if (!user) return;
    localStorage.setItem(this.getThemeKey(user.email), String(enabled));
  }

  private loadCurrentUser(): void {
    const storedCurrentUser = localStorage.getItem(this.currentUserStorageKey);
    if (!storedCurrentUser) return;

    try {
      const parsed = this.normalizeUser(JSON.parse(storedCurrentUser) as User);
      this.currentUserSubject.next(parsed);
      this.applyDarkModePreference();
    } catch {
      this.currentUserSubject.next(null);
      localStorage.removeItem(this.currentUserStorageKey);
    }
  }

  register(data: RegisterData): Observable<{ success: boolean; message: string }> {
    const department = normalizeDepartment(data.department);
    if (!isKnownDepartment(department)) {
      return of({ success: false, message: 'Please choose a valid department' });
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
            throw new Error('Invalid admin code');
          }
          return 'admin';
        }),
        catchError(() => {
          throw new Error('Invalid admin code or server error');
        })
      ).pipe(
        map(() => {
          // Send registration next
          this.http.post<User>(`${this.apiUrl}/register`, {
            name: data.fullName,
            email,
            password: data.password,
            department,
            role: 'admin'
          }).subscribe({
            next: () => {},
            error: () => {}
          });
          return { success: true, message: 'Registration successful' };
        }),
        catchError(err => of({ success: false, message: (err as Error).message }))
      );
    } else {
      return this.http.post<User>(`${this.apiUrl}/register`, {
        name: data.fullName,
        email,
        password: data.password,
        department,
        role
      }).pipe(
        map(() => ({ success: true, message: 'Registration successful' })),
        catchError((err: any) => {
          if (err.status === 409) return of({ success: false, message: 'Email already registered' });
          return of({ success: false, message: 'Registration failed' });
        })
      );
    }
  }

  login(credentials: LoginCredentials): Observable<{ success: boolean; message: string }> {
    if (!this.isLiceoEmail(credentials.email)) {
      return of({ success: false, message: 'Please use your official @liceo.edu.ph email to log in.' });
    }

    const normalizedEmail = this.normalizeEmail(credentials.email);
    
    return this.http.post<User>(`${this.apiUrl}/login`, {
      email: normalizedEmail,
      password: credentials.password
    }).pipe(
      tap(user => {
        const normalized = this.normalizeUser(user);
        const savedProfileImage = localStorage.getItem(this.profileImageStorageKey);
        if (savedProfileImage) {
          normalized.profileImage = savedProfileImage;
        }
        this.currentUserSubject.next(normalized);
        localStorage.setItem(this.currentUserStorageKey, JSON.stringify(normalized));
        this.applyDarkModePreference();
      }),
      map(() => ({ success: true, message: 'Login successful' })),
      catchError(() => of({ success: false, message: 'Invalid email or password' }))
    );
  }

  private applyDarkModePreference(): void {
    const isDarkMode = this.getDarkModePreference();
    document.documentElement.classList.toggle('dark-mode', isDarkMode);
  }

  private isLiceoEmail(email: string): boolean {
    return typeof email === 'string' && this.normalizeEmail(email).endsWith('@liceo.edu.ph');
  }

  private normalizeEmail(email: string): string {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
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

  logout(): void {
    const savedProfileImage = localStorage.getItem(this.profileImageStorageKey);
    this.currentUserSubject.next(null);
    localStorage.removeItem(this.currentUserStorageKey);
    document.documentElement.classList.remove('dark-mode');
    if (savedProfileImage) {
      localStorage.setItem(this.profileImageStorageKey, savedProfileImage);
    }
  }

  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  getDepartmentStudents(department: string): Observable<User[]> {
    return this.getAllUsers().pipe(
      map(users => users.filter(user => 
        sameDepartment(user.department, department) && (user.role === 'student' || user.role === 'admin')
      ))
    );
  }

  getDepartmentAdmins(department: string): Observable<User[]> {
    return this.getAllUsers().pipe(
      map(users => users.filter(user => 
        sameDepartment(user.department, department) && user.role === 'admin'
      ))
    );
  }

  findUserById(userId: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${userId}`);
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

  updateProfile(data: Partial<User>): Observable<User> {
    const currentUser = this.currentUserSubject.value;
    if (!currentUser) throw new Error('No current user to update');

    return this.http.put<User>(`${this.apiUrl}/${currentUser.id}`, data).pipe(
      tap(updatedUser => {
        const fullUser = { ...currentUser, ...updatedUser };
        this.currentUserSubject.next(fullUser);
        localStorage.setItem(this.currentUserStorageKey, JSON.stringify(fullUser));
        if (data.profileImage) {
          localStorage.setItem(this.profileImageStorageKey, data.profileImage);
        }
      })
    );
  }

  private normalizeUser(user: User): User {
    return {
      ...user,
      email: this.normalizeEmail(user.email),
      department: normalizeDepartment(user.department) || user.department || 'Unknown'
    };
  }
}
