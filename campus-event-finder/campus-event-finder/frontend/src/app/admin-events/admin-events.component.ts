import { Component, OnInit, inject } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, User } from '../services/auth.service';
import { DEPARTMENT_OPTIONS } from '../services/department-directory';
import {
  EventComment,
  EventEngagementService,
  EventRegistration
} from '../services/event-engagement.service';
import { EventPayload, EventService, EventWithMetrics } from '../services/event.service';
import {
  EventStatus,
  HubEvent,
  scopeEventsToDepartment,
  sortEventsForDisplay
} from '../services/event-store';

interface EventFormData {
  title: string;
  date: string;
  time: string;
  category: string;
  description: string;
  summary: string;
  location: string;
  organizer: string;
  department: string;
  capacity: number;
  image: string;
  status: EventStatus;
  registrations?: number;
}

interface AdminEventAnalytics {
  id: string;
  title: string;
  department: string;
  comments: number;
  likes: number;
  shares: number;
  attendance: number;
  registered: number;
  feedback: number;
}

@Component({
  selector: 'app-admin-events',
  standalone: true,
  templateUrl: './admin-events.component.html',
  styleUrls: ['./admin-events.component.css'],
  imports: [NgFor, NgIf, FormsModule, DatePipe]
})
export class AdminEventsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly engagement = inject(EventEngagementService);
  private readonly eventService = inject(EventService);

  readonly logoImage = 'assets/liceo-logo.png';
  readonly fallbackEventImage = 'assets/liceo-logo.png';

  currentUser: User | null = null;
  menuOpen = false;
  editorOpen = false;
  commentsOpen = false;
  registrationsOpen = false;

  pageIndex = 1;
  private readonly pageSize = 2;

  private eventCatalog: EventWithMetrics[] = [];
  events: HubEvent[] = [];
  analyticsEvents: AdminEventAnalytics[] = [];
  analyticsComments = 0;
  analyticsLikes = 0;
  analyticsShares = 0;
  analyticsAttendance = 0;
  analyticsRegistered = 0;
  analyticsFeedbackAverage = 0;
  analyticsEngagementMax = 1;
  analyticsAttendanceMax = 1;
  isEditing = false;
  editingEventId: string | null = null;
  commentsEvent: HubEvent | null = null;
  registrationsEvent: HubEvent | null = null;
  commentText = '';
  eventComments: EventComment[] = [];
  eventRegistrations: EventRegistration[] = [];

  formData: EventFormData = {
    title: '',
    date: '',
    time: '',
    category: 'Technology',
    description: '',
    summary: '',
    location: '',
    organizer: '',
    department: '',
    capacity: 50,
    image: '',
    status: 'active'
  };

  categories = [
    'Technology',
    'Engineering',
    'Healthcare',
    'Business',
    'Arts',
    'Sports',
    'Academic',
    'Social',
    'Workshop',
    'Seminar'
  ];
  readonly departmentOptions = DEPARTMENT_OPTIONS;

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadEvents();
    this.ensurePageInRange();
  }

  private loadEvents(): void {
    this.eventService.getEvents().subscribe({
      next: events => {
        this.eventCatalog = events;
        this.engagement.primeMetrics(events);
        this.refreshDepartmentEvents();
      },
      error: () => {
        this.eventCatalog = [];
        this.events = [];
        this.analyticsEvents = [];
      }
    });
  }

  private refreshDepartmentEvents(): void {
    const managedEvents = this.authService.isMainAdmin()
      ? this.eventCatalog.slice()
      : scopeEventsToDepartment(this.eventCatalog, this.currentUser?.department ?? '');
    this.events = sortEventsForDisplay(managedEvents);
    this.refreshAnalytics();
    this.ensurePageInRange();
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  goHome(): void {
    this.menuOpen = false;
    this.router.navigate(['/dashboard']);
  }

  openMessages(): void {
    this.menuOpen = false;
    this.router.navigate(['/messages']);
  }

  openNotifications(): void {
    this.menuOpen = false;
    this.router.navigate(['/notifications']);
  }

  openSettings(): void {
    this.menuOpen = false;
    this.router.navigate(['/settings']);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.events.length / this.pageSize));
  }

  get pagedEvents(): HubEvent[] {
    const start = (this.pageIndex - 1) * this.pageSize;
    return this.events.slice(start, start + this.pageSize);
  }

  prevPage(): void {
    this.pageIndex = Math.max(1, this.pageIndex - 1);
  }

  nextPage(): void {
    this.pageIndex = Math.min(this.totalPages, this.pageIndex + 1);
  }

  private ensurePageInRange(): void {
    this.pageIndex = Math.min(Math.max(1, this.pageIndex), this.totalPages);
  }

  openCreate(): void {
    this.commentsOpen = false;
    this.commentsEvent = null;
    this.registrationsOpen = false;
    this.registrationsEvent = null;
    this.isEditing = false;
    this.editingEventId = null;
    this.resetForm();
    this.menuOpen = false;
    this.editorOpen = true;
  }

  startEdit(event: HubEvent): void {
    if (!this.authService.canManageDepartment(event.department)) return;

    this.commentsOpen = false;
    this.commentsEvent = null;
    this.registrationsOpen = false;
    this.registrationsEvent = null;
    this.isEditing = true;
    this.editingEventId = event.id;
    this.formData = {
      title: event.title,
      date: event.date,
      time: event.time,
      category: event.category,
      description: event.description,
      summary: event.summary,
      location: event.location,
      organizer: event.organizer,
      department: event.department,
      capacity: event.capacity,
      image: event.image,
      status: this.getEventStatus(event)
    };
    this.menuOpen = false;
    this.editorOpen = true;
  }

  closeEditor(): void {
    this.editorOpen = false;
    this.resetForm();
  }

  submitEditor(): void {
    if (!this.currentUser) return;

    if (this.isEditing) {
      this.updateEvent();
    } else {
      this.addEvent();
    }

    this.closeEditor();
  }

  private addEvent(): void {
    if (!this.currentUser) return;
    const department = this.getManagedDepartment();

    const payload: EventPayload = {
      title: this.formData.title,
      date: this.formData.date,
      time: this.formData.time,
      category: this.formData.category,
      description: this.formData.description,
      summary: this.formData.summary,
      location: this.formData.location,
      organizer: this.formData.organizer,
      department,
      capacity: this.formData.capacity,
      image: this.formData.image,
      status: this.formData.status
    };

    this.eventService.createEvent(payload).subscribe({
      next: event => {
        this.eventCatalog.unshift(event);
        this.engagement.primeMetrics([event]);
        this.refreshDepartmentEvents();
      }
    });
  }

  private updateEvent(): void {
    if (!this.currentUser) return;

    const index = this.eventCatalog.findIndex(e => e.id === this.editingEventId);
    if (index !== -1) {
      const existing = this.eventCatalog[index];
      if (!this.authService.canManageDepartment(existing.department)) return;
      const department = this.getManagedDepartment(existing.department);

      const payload: EventPayload = {
        title: this.formData.title,
        date: this.formData.date,
        time: this.formData.time,
        category: this.formData.category,
        description: this.formData.description,
        summary: this.formData.summary,
        location: this.formData.location,
        organizer: this.formData.organizer,
        department,
        capacity: this.formData.capacity,
        image: this.formData.image,
        status: this.formData.status
      };

      this.eventService.updateEvent(existing.id, payload).subscribe({
        next: event => {
          this.eventCatalog[index] = event;
          this.engagement.primeMetrics([event]);
          this.refreshDepartmentEvents();
        }
      });
    }
  }

  deleteEvent(eventId: string): void {
    const target = this.eventCatalog.find(event => event.id === eventId);
    if (!target || !this.authService.canManageDepartment(target.department)) return;

    if (confirm('Are you sure you want to delete this event?')) {
      this.eventService.deleteEvent(eventId).subscribe({
        next: () => {
          this.eventCatalog = this.eventCatalog.filter(event => event.id !== eventId);
          this.refreshDepartmentEvents();
        }
      });
    }
  }

  private resetForm(): void {
    const defaultDepartment = this.authService.isMainAdmin()
      ? this.departmentOptions[0]
      : this.currentUser?.department ?? '';

    this.isEditing = false;
    this.editingEventId = null;
    this.formData = {
      title: '',
      date: '',
      time: '',
      category: 'Technology',
      description: '',
      summary: '',
      location: '',
      organizer: defaultDepartment,
      department: defaultDepartment,
      capacity: 50,
      image: '',
      status: 'active'
    };
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

  likeEvent(event: HubEvent): void {
    this.engagement.like(event.id).subscribe({
      next: () => this.refreshAnalytics()
    });
  }

  openComments(event: HubEvent): void {
    if (!this.authService.canManageDepartment(event.department)) return;

    this.editorOpen = false;
    this.menuOpen = false;
    this.registrationsOpen = false;
    this.registrationsEvent = null;
    this.commentsEvent = event;
    this.commentText = '';
    this.eventComments = [];
    this.engagement.fetchComments(event.id).subscribe({
      next: comments => {
        this.eventComments = comments;
        this.commentsOpen = true;
      },
      error: () => {
        this.eventComments = [];
        this.commentsOpen = true;
      }
    });
  }

  closeComments(): void {
    this.commentsOpen = false;
    this.commentsEvent = null;
    this.commentText = '';
    this.eventComments = [];
  }

  openRegistrations(event: HubEvent): void {
    if (!this.authService.canManageDepartment(event.department)) return;

    this.editorOpen = false;
    this.menuOpen = false;
    this.commentsOpen = false;
    this.commentsEvent = null;
    this.registrationsEvent = event;
    this.eventRegistrations = [];
    this.engagement.fetchRegistrations(event.id).subscribe({
      next: registrations => {
        this.eventRegistrations = registrations;
        this.registrationsOpen = true;
      },
      error: () => {
        this.eventRegistrations = [];
        this.registrationsOpen = true;
      }
    });
  }

  closeRegistrations(): void {
    this.registrationsOpen = false;
    this.registrationsEvent = null;
    this.eventRegistrations = [];
  }

  toggleAttendance(registration: EventRegistration): void {
    if (!this.registrationsEvent) return;
    this.engagement
      .setAttendance(this.registrationsEvent.id, registration.id, !registration.attended)
      .subscribe({
        next: () => {
          this.engagement.fetchRegistrations(this.registrationsEvent!.id).subscribe({
            next: registrations => {
              this.eventRegistrations = registrations;
              this.refreshAnalytics();
            }
          });
        }
      });
  }

  getPresentCount(): number {
    return this.eventRegistrations.filter(registration => registration.attended).length;
  }

  getAbsentCount(): number {
    return Math.max(0, this.eventRegistrations.length - this.getPresentCount());
  }

  submitComment(): void {
    if (!this.commentsEvent || !this.authService.canManageDepartment(this.commentsEvent.department)) return;

    const author = this.currentUser?.fullName ?? 'Anonymous';
    const role = this.currentUser?.role ?? 'admin';
    this.engagement
      .addComment(this.commentsEvent.id, {
        author,
        role,
        text: this.commentText
      })
      .subscribe({
        next: comment => {
          this.commentText = '';
          this.eventComments = [comment, ...this.eventComments];
          this.refreshAnalytics();
        }
      });
  }

  deleteComment(commentId: string): void {
    if (!this.commentsEvent || !this.authService.canManageDepartment(this.commentsEvent.department)) return;
    this.engagement.deleteComment(this.commentsEvent.id, commentId).subscribe({
      next: () => {
        this.eventComments = this.eventComments.filter(comment => comment.id !== commentId);
        this.refreshAnalytics();
      }
    });
  }

  toggleAvailability(event: HubEvent): void {
    if (!this.authService.canManageDepartment(event.department)) return;
    const status = this.getEventStatus(event);
    const nextStatus = status === 'inactive' ? 'active' : 'inactive';
    const payload: EventPayload = {
      title: event.title,
      date: event.date,
      time: event.time,
      category: event.category,
      description: event.description,
      summary: event.summary,
      location: event.location,
      organizer: event.organizer,
      department: event.department,
      capacity: event.capacity,
      image: event.image,
      status: nextStatus
    };

    this.eventService.updateEvent(event.id, payload).subscribe({
      next: updated => {
        const index = this.eventCatalog.findIndex(item => item.id === updated.id);
        if (index !== -1) {
          this.eventCatalog[index] = updated;
        }
        this.engagement.primeMetrics([updated]);
        this.refreshDepartmentEvents();
      }
    });
  }

  shareEvent(event: HubEvent): void {
    if (navigator.share) {
      void navigator.share({
        title: event.title,
        text: event.summary || event.description,
        url: window.location.href
      }).then(() => {
        this.engagement.trackShare(event.id).subscribe({
          next: () => this.refreshAnalytics()
        });
      }).catch(() => {
      });
    } else if (navigator.clipboard?.writeText) {
      const shareText = `${event.title}\n${event.summary || event.description}\n${window.location.href}`;
      void navigator.clipboard.writeText(shareText).then(() => {
        this.engagement.trackShare(event.id).subscribe({
          next: () => this.refreshAnalytics()
        });
        alert('Event details copied to clipboard!');
      }).catch(() => {
      });
    } else {
      alert('Sharing is not available in this browser.');
    }
  }

  getShareCount(eventId: string): number {
    return this.engagement.getShares(eventId);
  }

  getAnalyticsBarWidth(value: number): number {
    return this.scalePercent(value, this.analyticsEngagementMax);
  }

  getAttendanceBarWidth(value: number): number {
    return this.scalePercent(value, this.analyticsAttendanceMax);
  }

  getFeedbackBarWidth(value: number): number {
    if (value <= 0) return 0;
    return Math.max(12, (value / 5) * 100);
  }

  formatFeedback(value: number): string {
    return value.toFixed(1);
  }

  get analyticsSummary(): string {
    return this.authService.isMainAdmin()
      ? 'Monitoring engagement across every department event in the hub.'
      : `Monitoring engagement for ${this.currentUser?.department || 'your department'} events.`;
  }

  private refreshAnalytics(): void {
    const metrics = this.events.map(event => this.buildAnalytics(event));
    this.analyticsEvents = metrics.slice(0, 6);
    this.analyticsComments = metrics.reduce((sum, metric) => sum + metric.comments, 0);
    this.analyticsLikes = metrics.reduce((sum, metric) => sum + metric.likes, 0);
    this.analyticsShares = metrics.reduce((sum, metric) => sum + metric.shares, 0);
    this.analyticsAttendance = metrics.reduce((sum, metric) => sum + metric.attendance, 0);
    this.analyticsRegistered = metrics.reduce((sum, metric) => sum + metric.registered, 0);

    const feedbackTotal = metrics.reduce((sum, metric) => sum + metric.feedback, 0);
    this.analyticsFeedbackAverage = metrics.length > 0 ? feedbackTotal / metrics.length : 0;
    this.analyticsEngagementMax = Math.max(
      1,
      ...this.analyticsEvents.flatMap(metric => [metric.comments, metric.likes, metric.shares])
    );
    this.analyticsAttendanceMax = Math.max(
      1,
      ...this.analyticsEvents.flatMap(metric => [metric.attendance, metric.registered])
    );
  }

  private buildAnalytics(event: HubEvent): AdminEventAnalytics {
    return {
      id: event.id,
      title: event.title,
      department: event.department,
      comments: this.engagement.getCommentCount(event.id),
      likes: this.engagement.getLikes(event.id),
      shares: this.engagement.getShares(event.id),
      attendance: this.engagement.getAttendance(event),
      registered: event.registrations,
      feedback: this.engagement.getFeedbackScore(event)
    };
  }

  private scalePercent(value: number, max: number): number {
    if (value <= 0 || max <= 0) {
      return 0;
    }

    return Math.max(8, (value / max) * 100);
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

  getEventStatus(event: HubEvent): EventStatus {
    if (event.status === 'inactive') return 'inactive';
    if (event.status === 'draft') return 'draft';
    return 'active';
  }

  getStatusLabel(event: HubEvent): string {
    const status = this.getEventStatus(event);
    if (status === 'draft') return 'draft';
    if (status === 'inactive') return 'Inactive';
    return 'Active';
  }

  get eventsHeading(): string {
    return this.authService.isMainAdmin() ? 'All Department Events' : 'Your Department Events';
  }

  get canChooseDepartment(): boolean {
    return this.authService.isMainAdmin();
  }

  private getManagedDepartment(fallbackDepartment?: string): string {
    if (this.authService.isMainAdmin()) {
      return this.formData.department || fallbackDepartment || this.departmentOptions[0];
    }

    return this.currentUser?.department || fallbackDepartment || '';
  }
}
