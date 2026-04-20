import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthService, User } from './auth.service';
import { HttpClient } from '@angular/common/http';

export type NotificationCategory = 'event' | 'registration' | 'comment' | 'attendance' | 'system' | 'security';

export interface AppNotification {
  id: string;
  recipientUserId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  createdAt: string;
  read: boolean;
  route?: string;
}

interface NotificationDraft {
  title: string;
  message: string;
  category: NotificationCategory;
  route?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly storageKey = 'appNotifications';
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly notificationsSubject = new BehaviorSubject<AppNotification[]>([]);

  readonly notifications$ = this.notificationsSubject.asObservable();

  constructor() {
    // Force a one-time clear of old notifications to trigger the new intelligent seeding
    if (!localStorage.getItem('notif_v2_sync')) {
      localStorage.removeItem(this.storageKey);
      localStorage.setItem('notif_v2_sync', 'done');
    }

    this.seedInitialNotifications();
    this.refreshCurrentUserNotifications();
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        // Clear old mock seeding to force fresh data with names/times
        const all = this.loadAllNotifications();
        if (!all.some(n => n.title === 'System: Activity Sync')) {
          this.refreshSystemActivity(user);
          this.seedNotificationsFromDatabase(user);
          
          // Add a marker so we don't spam every refresh
          this.notifyUser(user, {
            title: 'System: Activity Sync',
            message: 'Your notification center has been updated with the latest engagement metrics and security logs.',
            category: 'system'
          });
        }
      }
      this.refreshCurrentUserNotifications();
    });
  }

  getCurrentNotifications(): AppNotification[] {
    return this.notificationsSubject.value;
  }

  getUnreadCount(): number {
    return this.notificationsSubject.value.filter(notification => !notification.read).length;
  }

  notifyUser(user: User | null | undefined, draft: NotificationDraft): void {
    if (!user) return;
    this.notifyUsers([user], draft);
  }

  notifyUsers(users: User[], draft: NotificationDraft): void {
    const recipients = Array.from(new Map(users.map(user => [user.id, user])).values());
    if (!recipients.length) return;

    const createdAt = new Date().toISOString();
    const allNotifications = this.loadAllNotifications();
    const nextNotifications = recipients.map<AppNotification>(user => ({
      id: this.generateId(),
      recipientUserId: user.id,
      title: draft.title,
      message: draft.message,
      category: draft.category,
      createdAt,
      read: false,
      route: draft.route
    }));

    this.saveAllNotifications([...nextNotifications, ...allNotifications].slice(0, 500));
  }

  markAsRead(notificationId: string): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;

    const nextNotifications = this.loadAllNotifications().map(notification =>
      notification.id === notificationId && notification.recipientUserId === currentUser.id
        ? { ...notification, read: true }
        : notification
    );

    this.saveAllNotifications(nextNotifications);
  }

  markAllAsRead(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;

    const nextNotifications = this.loadAllNotifications().map(notification =>
      notification.recipientUserId === currentUser.id ? { ...notification, read: true } : notification
    );

    this.saveAllNotifications(nextNotifications);
  }

  clearReadNotifications(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;

    const nextNotifications = this.loadAllNotifications().filter(
      notification => notification.recipientUserId !== currentUser.id || !notification.read
    );

    this.saveAllNotifications(nextNotifications);
  }

  private refreshCurrentUserNotifications(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.notificationsSubject.next([]);
      return;
    }

    const notifications = this.loadAllNotifications()
      .filter(notification => notification.recipientUserId === currentUser.id)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

    this.notificationsSubject.next(notifications);
  }

  private seedInitialNotifications(): void {
    // Initial welcome for all new browsers
    const existing = this.loadAllNotifications();
    if (existing.length > 0) return;

    this.authService.currentUser$.subscribe(user => {
      if (user) this.seedNotificationsFromDatabase(user);
    });
  }

  private seedNotificationsFromDatabase(user: User | null | undefined): void {
    if (!user) return;

    // Avoid double seeding
    const existing = this.loadAllNotifications();
    const hasAlreadySeeded = existing.some(n => n.category === 'comment' || n.category === 'registration');
    if (hasAlreadySeeded) return;

    // Fetch all users to generate department-specific activity
    this.authService.getAllUsers().subscribe((allUsers: User[]) => {
      const departmentAdmins = allUsers.filter(u => u.role === 'admin' && u.department === user.department);
      
      this.http.get<any[]>('http://localhost:5000/api/events').subscribe((events: any[]) => {
        const notifications: AppNotification[] = [];
        
        // Welcome notification
        notifications.push({
          id: this.generateId(),
          recipientUserId: user.id,
          title: 'Welcome to the Notification Center',
          message: 'Stay updated with event activity and system logs here.',
          category: 'system',
          createdAt: new Date().toISOString(),
          read: false,
          route: '/notifications'
        });

        // 1. Process Event Comments for Notifications (Who and When)
        events.forEach((event: any) => {
          // Students see activity in their department; Admins/Main Admin see their respective scopes
          const isRelevant = user.role === 'main-admin' || event.department === user.department;
          
          if (isRelevant) {
            this.http.get<any[]>(`http://localhost:5000/api/events/${event.id}/comments`).subscribe((comments: any[]) => {
              const newNotifs = comments.slice(0, 5).map((comment: any) => ({
                id: this.generateId(),
                recipientUserId: user.id,
                title: 'New Event Comment',
                message: `${comment.author} (${comment.role}) commented on "${event.title}": "${comment.text.substring(0, 40)}${comment.text.length > 40 ? '...' : ''}"`,
                category: 'comment' as NotificationCategory,
                createdAt: comment.createdAt,
                read: true,
                route: user.role === 'student' ? '/dashboard' : '/admin-events'
              }));
              this.saveAllNotifications([...newNotifs, ...this.loadAllNotifications()].slice(0, 500));
            });

            this.http.get<any[]>(`http://localhost:5000/api/events/${event.id}/registrations`).subscribe((regs: any[]) => {
              const newNotifs = regs.slice(0, 3).map((reg: any) => ({
                id: this.generateId(),
                recipientUserId: user.id,
                title: 'New Registration',
                message: `${reg.name} from ${reg.department} registered for "${event.title}".`,
                category: 'registration' as NotificationCategory,
                createdAt: reg.registeredAt,
                read: true,
                route: user.role === 'student' ? '/dashboard' : '/admin-events'
              }));
              this.saveAllNotifications([...newNotifs, ...this.loadAllNotifications()].slice(0, 500));
            });
          }
        });
      });
    });
  }

  private refreshSystemActivity(user: User | null | undefined): void {
    if (!user || user.role !== 'main-admin') return;

    this.http.get<any>('http://localhost:5000/api/users/system-activity').subscribe((activity: any) => {
      const existing = this.loadAllNotifications();
      const newNotifs: AppNotification[] = [];

      // Process Admin Code Usage
      activity.adminCodeUsage.forEach((usage: any) => {
        const msg = `Admin Code ${usage.code} was used to register a new administrator.`;
        if (!existing.some(n => n.message === msg)) {
          newNotifs.push({
            id: this.generateId(),
            recipientUserId: user.id,
            title: 'Admin Code Used',
            message: msg,
            category: 'system',
            createdAt: usage.created_at,
            read: false,
            route: '/users'
          });
        }
      });

      // Process Password Resets
      activity.passwordResets.forEach((reset: any) => {
        const msg = `Password reset requested for account: ${reset.email}. Status: ${reset.used ? 'Completed' : 'Pending'}`;
        if (!existing.some(n => n.message === msg)) {
          newNotifs.push({
            id: this.generateId(),
            recipientUserId: user.id,
            title: 'Security: Password Reset',
            message: msg,
            category: 'system',
            createdAt: reset.created_at,
            read: false,
            route: '/users'
          });
        }
      });

      if (newNotifs.length > 0) {
        this.saveAllNotifications([...newNotifs, ...existing].slice(0, 500));
      }
    });
  }

  private seedNotificationsForUser(user: User | null | undefined): void {
    if (!user) return;

    const existingNotifications = this.loadAllNotifications();
    if (existingNotifications.some(notification => notification.recipientUserId === user.id)) {
      return;
    }

    const now = Date.now();
    const drafts: NotificationDraft[] = [
      {
        title: 'Welcome to the notification center',
        message: 'Your notification panel is ready. Recent updates will appear here.',
        category: 'system',
        route: '/notifications'
      },
      {
        title: 'New event registration',
        message: 'A student has registered for one of your department events.',
        category: 'registration',
        route: '/notifications'
      },
      {
        title: 'New comment on your event',
        message: 'A student added feedback to your recent event post.',
        category: 'comment',
        route: '/notifications'
      }
    ];

    const notifications = drafts.map((draft, index) => ({
      id: this.generateId(),
      recipientUserId: user.id,
      title: draft.title,
      message: draft.message,
      category: draft.category,
      createdAt: new Date(now - index * 20 * 60 * 1000).toISOString(),
      read: index > 0,
      route: draft.route
    }));

    this.saveAllNotifications([...notifications, ...existingNotifications].slice(0, 500));
  }

  private loadAllNotifications(): AppNotification[] {
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) return [];

    try {
      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter(item => item && typeof item === 'object')
        .map(item => this.normalizeNotification(item as Partial<AppNotification>))
        .filter((notification): notification is AppNotification => notification !== null);
    } catch {
      return [];
    }
  }

  private saveAllNotifications(notifications: AppNotification[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(notifications));
    this.refreshCurrentUserNotifications();
  }

  private normalizeNotification(notification: Partial<AppNotification>): AppNotification | null {
    if (
      typeof notification.id !== 'string' ||
      typeof notification.recipientUserId !== 'string' ||
      typeof notification.title !== 'string' ||
      typeof notification.message !== 'string' ||
      typeof notification.category !== 'string' ||
      typeof notification.createdAt !== 'string'
    ) {
      return null;
    }

    return {
      id: notification.id,
      recipientUserId: notification.recipientUserId,
      title: notification.title,
      message: notification.message,
      category: this.normalizeCategory(notification.category),
      createdAt: notification.createdAt,
      read: Boolean(notification.read),
      route: typeof notification.route === 'string' ? notification.route : undefined
    };
  }

  private normalizeCategory(category: string): NotificationCategory {
    if (
      category === 'event' ||
      category === 'registration' ||
      category === 'comment' ||
      category === 'attendance'
    ) {
      return category;
    }

    return 'system';
  }

  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
