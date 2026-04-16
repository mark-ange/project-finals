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
    this.seedInitialNotifications();
    this.refreshCurrentUserNotifications();
    this.authService.currentUser$.subscribe(user => {
      this.seedNotificationsForUser(user);
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
    const existing = this.loadAllNotifications();
    if (existing.length > 0) return;

    this.authService.getAllUsers().subscribe(users => {
      if (!users.length) return;

      const now = Date.now();
      const buildNotification = (
        user: User,
        title: string,
        message: string,
        category: NotificationCategory,
        minutesAgo: number,
        route: string
      ): AppNotification => ({
        id: this.generateId(),
        recipientUserId: user.id,
        title,
        message,
        category,
        createdAt: new Date(now - minutesAgo * 60 * 1000).toISOString(),
        read: minutesAgo > 60,
        route
      });

      const notifications: AppNotification[] = [];
      const admins = users.filter(user => user.role === 'admin' || user.role === 'main-admin');
      const students = users.filter(user => user.role === 'student').slice(0, 8);
      const systemUser = users.find(user => user.role === 'main-admin');

      if (systemUser) {
        notifications.push(
          buildNotification(
            systemUser,
            'Platform analytics are live',
            'Your admin dashboard now shows real-time engagement, attendance, and registration analytics.',
            'system',
            5,
            '/notifications'
          ),
          buildNotification(
            systemUser,
            'New event synchronization',
            'All department events have been synced successfully with the hub.',
            'system',
            18,
            '/notifications'
          ),
          buildNotification(
            systemUser,
            'User activity report available',
            'Open the notifications panel to review recent registration and attendance activity.',
            'system',
            35,
            '/notifications'
          )
        );
      }

      admins.slice(0, 6).forEach((admin, index) => {
        notifications.push(
          buildNotification(
            admin,
            'New registration received',
            `A student has registered for the latest department event.`,
            'registration',
            10 + index * 8,
            '/notifications'
          ),
          buildNotification(
            admin,
            'New comment on your event',
            `A student commented on the event announcement. Check the admin panel for details.`,
            'comment',
            22 + index * 6,
            '/notifications'
          ),
          buildNotification(
            admin,
            'Attendance updated',
            `Attendance records were updated for your department's active event.`,
            'attendance',
            40 + index * 5,
            '/notifications'
          )
        );
      });

      students.forEach((student, index) => {
        notifications.push(
          buildNotification(
            student,
            'Event registration confirmed',
            'You are now registered for the upcoming campus event. View details in your dashboard.',
            'event',
            12 + index * 4,
            '/dashboard'
          ),
          buildNotification(
            student,
            'Comment reply received',
            'An event organizer replied to your comment. Open the event page to read it.',
            'comment',
            50 + index * 3,
            '/notifications'
          )
        );
      });

      this.saveAllNotifications(notifications);
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
