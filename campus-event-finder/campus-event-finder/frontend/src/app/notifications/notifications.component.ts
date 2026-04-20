import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NavigationComponent } from '../shared/navigation/navigation.component';
import { AppNotification, NotificationCategory, NotificationService } from '../services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css'],
  imports: [NgFor, NgIf, AsyncPipe, DatePipe, NavigationComponent]
})
export class NotificationsComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly notificationsService = inject(NotificationService);

  readonly logoImage = 'assets/liceo-logo.png';
  readonly backgroundImage = 'assets/background log-in.png';
  readonly currentUser = this.authService.getCurrentUser();
  readonly notifications$ = this.notificationsService.notifications$;

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }

  openSettings(): void {
    this.router.navigate(['/settings']);
  }

  get unreadCount(): number {
    return this.notificationsService.getUnreadCount();
  }

  get readCount(): number {
    return this.notificationsService.getCurrentNotifications().filter(notification => notification.read).length;
  }

  markAsRead(notificationId: string): void {
    this.notificationsService.markAsRead(notificationId);
  }

  markAllAsRead(): void {
    this.notificationsService.markAllAsRead();
  }

  clearRead(): void {
    this.notificationsService.clearReadNotifications();
  }

  openNotification(notification: AppNotification): void {
    this.notificationsService.markAsRead(notification.id);
    this.router.navigate([notification.route || '/dashboard']);
  }

  trackByNotificationId(index: number, notification: AppNotification): string {
    return notification.id;
  }

  getCategoryLabel(category: NotificationCategory): string {
    const type = category as any;
    if (type === 'registration') return '🎟️ Registration';
    if (type === 'comment') return '💬 Comment';
    if (type === 'attendance') return '✅ Attendance';
    if (type === 'system') return '⚙️ System';
    if (type === 'security') return '🛡️ Security';
    return '📅 Event';
  }

  selectedNotification: AppNotification | null = null;

  viewNotification(notification: AppNotification): void {
    if (!notification.read) {
      this.markAsRead(notification.id);
    }
    this.selectedNotification = notification;
  }

  closeNotificationDetails(): void {
    this.selectedNotification = null;
  }
}
