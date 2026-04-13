import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthService, User } from './auth.service';

export type NotificationCategory = 'event' | 'registration' | 'comment' | 'attendance' | 'system';

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
  private readonly notificationsSubject = new BehaviorSubject<AppNotification[]>([]);

  readonly notifications$ = this.notificationsSubject.asObservable();

  constructor() {
    this.refreshCurrentUserNotifications();
    this.authService.currentUser$.subscribe(() => {
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
