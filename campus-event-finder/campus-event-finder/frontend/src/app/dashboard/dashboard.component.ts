import { Component, OnInit, inject } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, User } from '../services/auth.service';
import { EventComment, EventEngagementService } from '../services/event-engagement.service';
import { HubEvent, sortEventsForDisplay } from '../services/event-store';
import { EventService, EventWithMetrics } from '../services/event.service';
import { NotificationService } from '../services/notification.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  imports: [NgFor, NgIf, FormsModule, DatePipe]
})
export class DashboardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly engagement = inject(EventEngagementService);
  private readonly eventService = inject(EventService);
  private readonly notifications = inject(NotificationService);

  readonly logoImage = 'assets/liceo-logo.png';
  readonly heroImage = 'assets/background log-in.png';
  readonly fallbackEventImage = 'assets/liceo-logo.png';

  menuOpen = false;
  selectedEvent: HubEvent | null = null;
  currentUser: User | null = null;
  statusMessage = '';
  statusMessageType: 'success' | 'error' | 'info' | null = null;

  private eventCatalog: EventWithMetrics[] = [];
  allEvents: HubEvent[] = [];
  events: HubEvent[] = [];
  featuredEvents: HubEvent[] = [];

  commentText = '';
  selectedEventComments: EventComment[] = [];
  commentReplyTargetId: string | null = null;
  commentReplyTargetAuthor: string | null = null;
  likedComments: Set<string> = new Set();

  likedEvents: Set<string> = new Set();

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadEvents();
  }

  private loadEvents(): void {
    this.eventService.getEvents().subscribe({
      next: events => {
        this.eventCatalog = events;
        this.engagement.primeMetrics(events);
        this.allEvents = sortEventsForDisplay(this.eventCatalog);
        this.events = this.allEvents.filter(event => (event.status ?? 'active') === 'active');
        this.featuredEvents = this.events.slice(0, 4);
        this.loadLikedEvents();
      },
      error: () => {
        this.eventCatalog = [];
        this.allEvents = [];
        this.events = [];
        this.featuredEvents = [];
      }
    });
  }

  private loadLikedEvents(): void {
    if (!this.currentUser) return;
    this.engagement.getUserLikes(this.currentUser.email).subscribe({
      next: likedEventIds => {
        this.likedEvents = new Set(likedEventIds);
      },
      error: () => {
        this.likedEvents = new Set();
      }
    });
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  openDetails(event: HubEvent): void {
    this.selectedEvent = event;
    this.clearStatusMessage();
    this.commentText = '';
    this.commentReplyTargetId = null;
    this.commentReplyTargetAuthor = null;
    this.selectedEventComments = [];
    this.likedComments.clear();

    this.engagement.fetchComments(event.id).subscribe({
      next: comments => {
        this.selectedEventComments = comments;
      },
      error: () => {
        this.selectedEventComments = [];
      }
    });

    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.engagement.fetchCommentLikes(event.id, currentUser.email).subscribe({
        next: likedCommentIds => {
          this.likedComments = new Set(likedCommentIds);
        },
        error: () => {
          this.likedComments.clear();
        }
      });
    }
  }

  closeDetails(): void {
    this.selectedEvent = null;
    this.commentText = '';
    this.selectedEventComments = [];
  }

  likeEvent(event: HubEvent): void {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const isCurrentlyLiked = this.likedEvents.has(event.id);
    if (isCurrentlyLiked) {
      this.engagement.unlike(event.id, user.email).subscribe(() => {
        this.likedEvents.delete(event.id);
      });
    } else {
      this.engagement.like(event.id, user.email).subscribe(() => {
        this.likedEvents.add(event.id);
      });
    }
  }

  isLiked(eventId: string): boolean {
    return this.likedEvents.has(eventId);

    // For simplicity, assume we check on demand, but to avoid multiple calls, perhaps cache or call once per event
    // For now, since it's toggle, we can track locally or call API each time
    // But to optimize, maybe add a map in component
    // For this implementation, let's call the API each time isLiked is called, but that's inefficient.
    // Better to load liked status when loading events.

    // For now, since the user wants toggle, and we have the logic, but to make it work, perhaps use a set for liked events in component.
    // Actually, let's modify to use the service's isLiked, but since it's observable, need to handle async.

    // To keep it simple, let's add a likedEvents set in the component, and update it on like/unlike.
    // But for initial load, need to check for each event.

    // For this task, let's assume we call isLiked once per event when needed, but since it's in template, better to have a property.

    // Let's add a likedEvents Map in the component.
  }

  navigateTo(route: string): void {
    this.menuOpen = false;
    this.router.navigate([route]);
  }

  private setStatusMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.statusMessage = message;
    this.statusMessageType = type;
  }

  private clearStatusMessage(): void {
    this.statusMessage = '';
    this.statusMessageType = null;
  }

  getLikes(eventId: string): number {
    return this.engagement.getLikes(eventId);
  }

  getComments(eventId: string): number {
    return this.engagement.getCommentCount(eventId);
  }

  formatCount(value: number): string {
    return this.engagement.formatCount(value);
  }

  shareEvent(event: HubEvent): void {
    if (navigator.share) {
      void navigator.share({
        title: event.title,
        text: event.description,
        url: window.location.href
      }).then(() => {
        this.engagement.trackShare(event.id).subscribe();
      }).catch(() => {
      });
    } else if (navigator.clipboard?.writeText) {
      const shareText = `${event.title}\n${event.description}\n${window.location.href}`;
      void navigator.clipboard.writeText(shareText).then(() => {
        this.engagement.trackShare(event.id).subscribe();
        this.setStatusMessage('Event details copied to clipboard!', 'success');
      }).catch(() => {
        this.setStatusMessage('Unable to copy the event link. Please try again.', 'error');
      });
    } else {
      this.setStatusMessage('Sharing is not available in this browser.', 'error');
    }
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) return;

    if (target.dataset['fallbackApplied'] === 'true') return;
    target.dataset['fallbackApplied'] = 'true';
    target.src = this.fallbackEventImage;
  }

  trackByEventId(index: number, event: HubEvent): string {
    return event.id;
  }

  trackByCommentId(index: number, comment: EventComment): string {
    return comment.id;
  }

  addComment(): void {
    if (!this.selectedEvent) return;

    const author = this.currentUser?.fullName ?? 'Anonymous';
    const role = this.currentUser?.role ?? 'student';
    const selectedEvent = this.selectedEvent;
    this.engagement
      .addComment(selectedEvent.id, {
        author,
        role,
        text: this.commentText,
        parentCommentId: this.commentReplyTargetId ?? undefined
      })
      .subscribe({
        next: comment => {
          this.commentText = '';
          this.commentReplyTargetId = null;
          this.commentReplyTargetAuthor = null;
          this.selectedEventComments = [comment, ...this.selectedEventComments];
          const adminRecipients = this.authService
            .getDepartmentAdmins(selectedEvent.department)
            .filter(user => user.id !== this.currentUser?.id);
          this.notifications.notifyUsers(adminRecipients, {
            title: 'New event comment',
            message: `${author} commented on ${selectedEvent.title}.`,
            category: 'comment',
            route: '/admin-events'
          });
        }
      });
  }

  replyToComment(comment: EventComment): void {
    this.commentReplyTargetId = comment.id;
    this.commentReplyTargetAuthor = comment.author;
    this.clearStatusMessage();
  }

  cancelReply(): void {
    this.commentReplyTargetId = null;
    this.commentReplyTargetAuthor = null;
  }

  isCommentLiked(commentId: string): boolean {
    return this.likedComments.has(commentId);
  }

  toggleCommentLike(comment: EventComment): void {
    const currentUser = this.authService.getCurrentUser();
    if (!this.selectedEvent || !currentUser) return;

    if (this.isCommentLiked(comment.id)) {
      this.engagement.unlikeComment(this.selectedEvent.id, comment.id, currentUser.email)
        .subscribe(likes => {
          this.likedComments.delete(comment.id);
          comment.likes = likes;
        });
    } else {
      this.engagement.likeComment(this.selectedEvent.id, comment.id, currentUser.email)
        .subscribe(likes => {
          this.likedComments.add(comment.id);
          comment.likes = likes;
        });
    }
  }

  getTopLevelComments(): EventComment[] {
    return this.selectedEventComments.filter(comment => !comment.parentCommentId);
  }

  getReplies(parentId: string): EventComment[] {
    return this.selectedEventComments
      .filter(comment => comment.parentCommentId === parentId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  registerForEvent(event: HubEvent): void {
    if (!this.currentUser) {
      this.setStatusMessage('Please log in to register for events.', 'error');
      return;
    }

    if (event.registrations >= event.capacity) {
      this.setStatusMessage('Event is at full capacity!', 'error');
      return;
    }

    this.engagement
      .registerForEvent(event.id, {
        userId: this.currentUser.id,
        name: this.currentUser.fullName,
        email: this.currentUser.email,
        department: this.currentUser.department,
        role: this.currentUser.role
      })
      .subscribe({
        next: () => {
          event.registrations += 1;
          const adminRecipients = this.authService
            .getDepartmentAdmins(event.department)
            .filter(user => user.id !== this.currentUser?.id);
          this.notifications.notifyUser(this.currentUser, {
            title: 'Registration confirmed',
            message: `You are registered for ${event.title} on ${event.date}.`,
            category: 'registration',
            route: '/notifications'
          });
          this.notifications.notifyUsers(adminRecipients, {
            title: 'New event registration',
            message: `${this.currentUser?.fullName} registered for ${event.title}.`,
            category: 'registration',
            route: '/admin-events'
          });
          this.setStatusMessage(`Successfully registered for ${event.title}!`, 'success');
        },
        error: (err) => {
          const message = err?.error?.message ?? 'Unable to register for this event.';
          this.setStatusMessage(message, 'error');
        }
      });
  }
}
