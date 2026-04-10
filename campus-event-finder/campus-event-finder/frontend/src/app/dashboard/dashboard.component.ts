import { Component, OnInit, inject } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, User } from '../services/auth.service';
import { EventComment, EventEngagementService } from '../services/event-engagement.service';
import { HubEvent, sortEventsForDisplay } from '../services/event-store';
import { EventService, EventWithMetrics } from '../services/event.service';

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

  readonly logoImage = 'assets/liceo-logo.png';
  readonly heroImage = 'assets/background log-in.png';
  readonly fallbackEventImage = 'assets/liceo-logo.png';

  menuOpen = false;
  selectedEvent: HubEvent | null = null;
  currentUser: User | null = null;

  private eventCatalog: EventWithMetrics[] = [];
  allEvents: HubEvent[] = [];
  events: HubEvent[] = [];
  featuredEvents: HubEvent[] = [];

  commentText = '';
  selectedEventComments: EventComment[] = [];

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
      },
      error: () => {
        this.eventCatalog = [];
        this.allEvents = [];
        this.events = [];
        this.featuredEvents = [];
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
    this.commentText = '';
    this.selectedEventComments = [];
    this.engagement.fetchComments(event.id).subscribe({
      next: comments => {
        this.selectedEventComments = comments;
      },
      error: () => {
        this.selectedEventComments = [];
      }
    });
  }

  closeDetails(): void {
    this.selectedEvent = null;
    this.commentText = '';
    this.selectedEventComments = [];
  }

  likeEvent(event: HubEvent): void {
    this.engagement.like(event.id).subscribe();
  }

  navigateTo(route: string): void {
    this.menuOpen = false;
    this.router.navigate([route]);
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
        alert('Event details copied to clipboard!');
      }).catch(() => {
      });
    } else {
      alert('Sharing is not available in this browser.');
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
    this.engagement
      .addComment(this.selectedEvent.id, {
        author,
        role,
        text: this.commentText
      })
      .subscribe({
        next: comment => {
          this.commentText = '';
          this.selectedEventComments = [comment, ...this.selectedEventComments];
        }
      });
  }

  registerForEvent(event: HubEvent): void {
    if (!this.currentUser) {
      alert('Please log in to register for events.');
      return;
    }

    if (event.registrations >= event.capacity) {
      alert('Event is at full capacity!');
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
          alert(`Successfully registered for ${event.title}!`);
        },
        error: (err) => {
          const message = err?.error?.message ?? 'Unable to register for this event.';
          alert(message);
        }
      });
  }
}
