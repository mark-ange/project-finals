import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, User } from '../services/auth.service';
import { NavigationComponent } from '../shared/navigation/navigation.component';
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
  parseEventStartDate,
  scopeEventsToDepartment,
  sortEventsForDisplay
} from '../services/event-store';
import { NotificationService } from '../services/notification.service';

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
  imageUrl: string;
  imageFileData: string;
  imageFileName: string;
  status: EventStatus;
  registrations?: number;
}

interface AdminEventAnalytics {
  id: string;
  title: string;
  department: string;
  date: string;
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
  imports: [NgFor, NgIf, NgClass, FormsModule, DatePipe, NavigationComponent]
})
export class AdminEventsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly engagement = inject(EventEngagementService);
  private readonly eventService = inject(EventService);
  private readonly notifications = inject(NotificationService);
  @ViewChild('commentsContainer') commentsContainer!: ElementRef;
  private readonly maxImageSourceBytes = 12_000_000;
  private readonly maxStoredImageLength = 3_000_000;
  private readonly maxOptimizedImageDimension = 1600;

  readonly logoImage = 'assets/liceo-logo.png';
  readonly fallbackEventImage = 'assets/liceo-logo.png';

  currentUser: User | null = null;
  likedEvents: Set<string> = new Set();
  statusMessage = '';
  statusMessageType: 'success' | 'error' | 'info' | null = null;
  generatedAdminCode: string | null = null;
  pendingDeleteEventId: string | null = null;
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

  readonly lineChartLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
  lineChartGridLines = [0, 20, 40, 60, 80, 100];
  lineChartSeries = [
    { label: 'Engagement', color: '#ff6f89', points: [0, 0, 0, 0, 0, 0, 0] },
    { label: 'Attendance', color: '#4aa8ff', points: [0, 0, 0, 0, 0, 0, 0] }
  ];
  lineChartMin = 0;
  lineChartMax = 100;
  readonly lineChartTop = 24;
  readonly lineChartHeight = 168;

  isEditing = false;
  editingEventId: string | null = null;
  commentsEvent: HubEvent | null = null;
  registrationsEvent: HubEvent | null = null;
  commentText = '';
  eventComments: EventComment[] = [];
  eventRegistrations: EventRegistration[] = [];
  imageUploadMessage = '';
  saveErrorMessage = '';
  isSaving = false;
  isProcessingImage = false;

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
    imageUrl: '',
    imageFileData: '',
    imageFileName: '',
    status: 'draft'
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
        this.loadLikedEvents();
      },
      error: () => {
        this.eventCatalog = [];
        this.events = [];
        this.analyticsEvents = [];
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

  private refreshDepartmentEvents(): void {
    const managedEvents = this.authService.isMainAdmin()
      ? this.eventCatalog.slice()
      : scopeEventsToDepartment(this.eventCatalog, this.currentUser?.department ?? '');
    this.events = sortEventsForDisplay(managedEvents);
    this.refreshAnalytics();
    this.ensurePageInRange();
  }

  private setStatusMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.statusMessage = message;
    this.statusMessageType = type;
  }

  private clearStatusMessage(): void {
    this.statusMessage = '';
    this.statusMessageType = null;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  get isMainAdmin(): boolean {
    return this.authService.isMainAdmin();
  }

  generateAdminCode(): void {
    if (!this.isMainAdmin) return;
    this.authService.generateAdminCode().subscribe({
      next: (response) => {
        this.generatedAdminCode = response.code;
        this.setStatusMessage('A new admin access code has been created. Share it with the new admin user.', 'success');
      },
      error: () => {
        this.setStatusMessage('Failed to generate admin access code.', 'error');
      }
    });
  }

  copyAdminCode(): void {
    if (!this.generatedAdminCode) return;

    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(this.generatedAdminCode).then(() => {
        this.setStatusMessage('Admin code copied to clipboard.', 'success');
      }).catch(() => {
        this.setStatusMessage('Unable to copy code. Please copy it manually.', 'error');
      });
    } else {
      this.setStatusMessage('Clipboard is unavailable. Please copy the code manually.', 'info');
    }
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
    this.clearStatusMessage();
    this.commentsOpen = false;
    this.commentsEvent = null;
    this.registrationsOpen = false;
    this.registrationsEvent = null;
    this.isEditing = false;
    this.editingEventId = null;
    this.resetForm();
    this.editorOpen = true;
  }

  startEdit(event: HubEvent): void {
    if (!this.authService.canManageDepartment(event.department)) return;

    this.clearStatusMessage();
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
      imageUrl: event.image?.startsWith('data:') ? '' : event.image || '',
      imageFileData: event.image?.startsWith('data:') ? event.image : '',
      imageFileName: event.image?.startsWith('data:') ? 'Uploaded image' : '',
      status: this.getEventStatus(event)
    };
    this.editorOpen = true;
  }

  closeEditor(): void {
    this.editorOpen = false;
    this.resetForm();
  }

  submitEditor(): void {
    if (!this.currentUser || this.isSaving || this.isProcessingImage) return;
    this.saveErrorMessage = '';

    if (this.isEditing) {
      this.updateEvent();
    } else {
      this.addEvent();
    }
  }

  private addEvent(): void {
    if (!this.currentUser) return;
    const department = this.getManagedDepartment();

    const isIncomplete = !this.formData.title?.trim() || !this.formData.date || !this.formData.time ||
      !this.formData.location || !this.formData.organizer || !this.formData.department;

    const payload: EventPayload = {
      title: this.formData.title?.trim() || 'Untitled Event',
      date: this.formData.date || new Date().toISOString().split('T')[0],
      time: this.formData.time || '12:00',
      category: this.formData.category || 'Technology',
      description: this.formData.description || '',
      summary: this.formData.summary || '',
      location: this.formData.location || 'TBA',
      organizer: this.formData.organizer || this.currentUser.fullName || 'Admin',
      department: department,
      capacity: this.formData.capacity || 0,
      image: this.formData.imageFileData || this.formData.imageUrl || '',
      status: isIncomplete ? 'draft' : this.formData.status || 'draft'
    };

    this.isSaving = true;
    this.eventService.createEvent(payload).subscribe({
      next: event => {
        this.eventCatalog.unshift(event);
        this.engagement.primeMetrics([event]);
        this.refreshDepartmentEvents();
        this.pageIndex = 1;
        if (this.getEventStatus(event) === 'active') {
          this.notifyDepartmentStudents(
            event.department,
            'New department event',
            `${event.title} is now available on the event hub.`,
            '/dashboard'
          );
        }
        this.isSaving = false;
        this.closeEditor();
      },
      error: err => {
        this.isSaving = false;
        this.saveErrorMessage = this.getSaveErrorMessage(err);
        console.error('Failed to create event:', err);
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

      // Safe fallbacks for updates
      const payload: EventPayload = {
        title: this.formData.title?.trim() || 'Untitled Event',
        date: this.formData.date || existing.date,
        time: this.formData.time || existing.time,
        category: this.formData.category || 'Technology',
        description: this.formData.description || '',
        summary: this.formData.summary || '',
        location: this.formData.location || 'TBA',
        organizer: this.formData.organizer || 'Admin',
        department: department,
        capacity: this.formData.capacity || 0,
        image: this.formData.imageFileData || this.formData.imageUrl || '',
        status: this.formData.status || 'draft'
      };

      this.isSaving = true;
      this.eventService.updateEvent(existing.id, payload).subscribe({
        next: event => {
          this.eventCatalog[index] = event;
          this.engagement.primeMetrics([event]);
          this.refreshDepartmentEvents();
          if (this.getEventStatus(event) === 'active') {
            this.notifyDepartmentStudents(
              event.department,
              'Event updated',
              `${event.title} has updated event details.`,
              '/dashboard'
            );
          }
          this.isSaving = false;
          this.closeEditor();
        },
        error: err => {
          this.isSaving = false;
          this.saveErrorMessage = this.getSaveErrorMessage(err);
          console.error('Failed to update event:', err);
        }
      });
    }
  }

  requestDeleteEvent(eventId: string): void {
    this.clearStatusMessage();
    this.pendingDeleteEventId = eventId;
  }

  cancelDeleteEvent(): void {
    this.pendingDeleteEventId = null;
  }

  deleteEvent(eventId: string): void {
    const target = this.eventCatalog.find(event => event.id === eventId);
    if (!target || !this.authService.canManageDepartment(target.department)) return;

    this.eventService.deleteEvent(eventId).subscribe({
      next: () => {
        this.pendingDeleteEventId = null;
        this.eventCatalog = this.eventCatalog.filter(event => event.id !== eventId);
        this.refreshDepartmentEvents();
        this.setStatusMessage('Event deleted successfully.', 'success');
        if (this.getEventStatus(target) !== 'draft') {
          this.notifyDepartmentStudents(
            target.department,
            'Event removed',
            `${target.title} has been removed from the event hub.`,
            '/dashboard'
          );
        }
      },
      error: () => {
        this.setStatusMessage('Could not delete the event right now.', 'error');
        this.pendingDeleteEventId = null;
      }
    });
  }

  async onImageFileSelected(event: Event): Promise<void> {
    this.imageUploadMessage = '';
    this.saveErrorMessage = '';

    const input = event.target as HTMLInputElement | null;
    if (!input) {
      this.imageUploadMessage = 'Could not read the selected image.';
      return;
    }

    const file = input.files?.[0] ?? null;
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.imageUploadMessage = 'Please choose an image file.';
      input.value = '';
      return;
    }

    if (file.size > this.maxImageSourceBytes) {
      this.imageUploadMessage = `Please choose an image under ${this.formatUploadLimit(this.maxImageSourceBytes)}.`;
      input.value = '';
      return;
    }

    this.isProcessingImage = true;
    this.imageUploadMessage = 'Preparing image...';

    try {
      const result = await this.prepareImageForUpload(file);
      this.formData.imageFileName = file.name;
      this.formData.imageFileData = result.dataUrl;
      this.formData.imageUrl = '';
      this.imageUploadMessage = result.message;
    } catch {
      this.formData.imageFileData = '';
      this.formData.imageFileName = '';
      this.imageUploadMessage = 'Could not prepare the selected image. Try a different file or use an image URL.';
    } finally {
      this.isProcessingImage = false;
      input.value = '';
    }
  }

  onImageUrlChanged(value: string): void {
    if (!value.trim()) {
      return;
    }

    this.formData.imageFileData = '';
    this.formData.imageFileName = '';
    this.imageUploadMessage = '';
  }

  async onImagePaste(event: ClipboardEvent): Promise<void> {
    const clipboardData = event.clipboardData;
    if (!clipboardData) {
      return;
    }

    const items = clipboardData.items;
    if (!items) {
      return;
    }

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (!file) {
          return;
        }

        this.imageUploadMessage = '';
        this.saveErrorMessage = '';
        this.formData.imageUrl = '';

        if (file.size > this.maxImageSourceBytes) {
          this.imageUploadMessage = `Image too large. Use images under ${this.formatUploadLimit(this.maxImageSourceBytes)}.`;
          return;
        }

        this.isProcessingImage = true;
        this.imageUploadMessage = 'Preparing pasted image...';

        try {
          const result = await this.prepareImageForUpload(file);
          this.formData.imageFileName = 'Pasted image';
          this.formData.imageFileData = result.dataUrl;
          this.imageUploadMessage = result.message;
        } catch {
          this.formData.imageFileData = '';
          this.formData.imageFileName = '';
          this.imageUploadMessage = 'Could not process pasted image. Try a different image or use a URL.';
        } finally {
          this.isProcessingImage = false;
        }
        return;
      }
    }
  }

  get imagePreview(): string {
    return this.formData.imageFileData || this.formData.imageUrl || '';
  }

  private resetForm(): void {
    const defaultDepartment = this.authService.isMainAdmin()
      ? this.departmentOptions[0]
      : this.currentUser?.department ?? '';

    this.isEditing = false;
    this.editingEventId = null;
    this.imageUploadMessage = '';
    this.saveErrorMessage = '';
    this.isSaving = false;
    this.isProcessingImage = false;
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
      imageUrl: '',
      imageFileData: '',
      imageFileName: '',
      status: 'draft'
    };
  }

  getLikes(eventId: string): number {
    return this.engagement.getLikes(eventId);
  }

  isLiked(eventId: string): boolean {
    return this.likedEvents.has(eventId);
  }

  getComments(eventId: string): number {
    return this.engagement.getCommentCount(eventId);
  }

  formatCount(value: number): string {
    return this.engagement.formatCount(value);
  }

  likeEvent(event: HubEvent): void {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const isCurrentlyLiked = this.likedEvents.has(event.id);
    if (isCurrentlyLiked) {
      this.engagement.unlike(event.id, user.email).subscribe({
        next: () => {
          this.likedEvents.delete(event.id);
          this.refreshAnalytics();
        }
      });
    } else {
      this.engagement.like(event.id, user.email).subscribe({
        next: () => {
          this.likedEvents.add(event.id);
          this.refreshAnalytics();
        }
      });
    }
  }

  openComments(event: HubEvent): void {
    if (!this.authService.canManageDepartment(event.department)) return;

    this.editorOpen = false;
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
    if (!this.attendanceAllowed) return;
    const registrationsEvent = this.registrationsEvent;
    const nextAttendance = !registration.attended;
    this.engagement
      .setAttendance(registrationsEvent.id, registration.id, nextAttendance)
      .subscribe({
        next: () => {
          this.authService.findUserById(registration.userId).subscribe(student => {
            if (student) {
              this.notifications.notifyUser(student, {
                title: 'Attendance updated',
                message: `Your attendance for ${registrationsEvent.title} was marked ${nextAttendance ? 'present' : 'absent'}.`,
                category: 'attendance',
                route: '/notifications'
              });
            }
          });
          this.engagement.fetchRegistrations(registrationsEvent.id).subscribe({
            next: registrations => {
              this.eventRegistrations = registrations;
              this.refreshAnalytics();
            }
          });
        }
      });
  }

  get attendanceAllowed(): boolean {
    if (!this.registrationsEvent) return false;
    // Attendance is only editable after the admin marks the event as "done"
    // (represented by status === 'inactive' in this project).
    return this.getEventStatus(this.registrationsEvent) === 'inactive';
  }

  getPresentCount(): number {
    return this.eventRegistrations.filter(registration => registration.attended).length;
  }

  getAbsentCount(): number {
    return Math.max(0, this.eventRegistrations.length - this.getPresentCount());
  }

  submitComment(): void {
    if (!this.commentsEvent || !this.authService.canManageDepartment(this.commentsEvent.department)) return;

    const commentsEvent = this.commentsEvent;
    const author = this.currentUser?.fullName ?? 'Anonymous';
    const role = this.currentUser?.role ?? 'admin';
    this.engagement
      .addComment(commentsEvent.id, {
        author,
        role,
        text: this.commentText
      })
      .subscribe({
        next: comment => {
          this.commentText = '';
          this.eventComments.push(comment);
          this.refreshAnalytics();
          setTimeout(() => {
            if (this.commentsContainer) {
              this.commentsContainer.nativeElement.scrollTop = this.commentsContainer.nativeElement.scrollHeight;
            }
          }, 50);
          this.notifyDepartmentStudents(
            commentsEvent.department,
            'New admin update',
            `${author} added a comment to ${commentsEvent.title}.`,
            '/dashboard'
          );
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
        if (nextStatus === 'active') {
          this.notifyDepartmentStudents(
            updated.department,
            'Event is now active',
            `${updated.title} is now active and available for students.`,
            '/dashboard'
          );
        } else {
          this.notifyDepartmentStudents(
            updated.department,
            'Event is inactive',
            `${updated.title} is currently unavailable.`,
            '/dashboard'
          );
        }
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
        this.setStatusMessage('Event details copied to clipboard!', 'success');
      }).catch(() => {
        this.setStatusMessage('Unable to copy the event link. Please try again.', 'error');
      });
    } else {
      this.setStatusMessage('Sharing is not available in this browser.', 'error');
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
    this.updateLineChartData(metrics);
  }

  private updateLineChartData(metrics: AdminEventAnalytics[]): void {
    const engagementPoints = new Array(this.lineChartLabels.length).fill(0);
    const attendancePoints = new Array(this.lineChartLabels.length).fill(0);

    for (const metric of metrics) {
      const monthIndex = this.getEventMonthIndex(metric.date);
      if (monthIndex === null || monthIndex < 0 || monthIndex >= this.lineChartLabels.length) {
        continue;
      }

      engagementPoints[monthIndex] += metric.comments + metric.likes + metric.shares;
      attendancePoints[monthIndex] += metric.attendance;
    }

    this.lineChartSeries[0].points = engagementPoints;
    this.lineChartSeries[1].points = attendancePoints;

    const maxValue = Math.max(10, ...engagementPoints, ...attendancePoints);
    const step = Math.max(10, Math.ceil(maxValue / 5 / 10) * 10);
    const topValue = step * 5;

    this.lineChartGridLines = [0, step, step * 2, step * 3, step * 4, topValue];
    this.lineChartMin = 0;
    this.lineChartMax = topValue;
  }

  private getEventMonthIndex(dateText: string): number | null {
    const timestamp = parseEventStartDate(dateText);
    if (timestamp === null) return null;

    return new Date(timestamp).getMonth();
  }

  private buildAnalytics(event: HubEvent): AdminEventAnalytics {
    return {
      id: event.id,
      title: event.title,
      department: event.department,
      date: event.date,
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

  getMonthX(index: number): number {
    return 50 + index * 90;
  }

  getLineChartY(value: number): number {
    if (this.lineChartMax <= this.lineChartMin) {
      return this.lineChartTop + this.lineChartHeight;
    }

    const ratio = (value - this.lineChartMin) / (this.lineChartMax - this.lineChartMin);
    return this.lineChartTop + this.lineChartHeight - ratio * this.lineChartHeight;
  }

  buildLinePath(points: number[]): string {
    return points
      .map((value, index) => `${index === 0 ? 'M' : 'L'} ${this.getMonthX(index)} ${this.getLineChartY(value)}`)
      .join(' ');
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
    if (status === 'draft') return 'Draft';
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

  private formatUploadLimit(bytes: number): string {
    const megabytes = bytes / 1_000_000;
    return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)}MB`;
  }

  private notifyDepartmentStudents(
    department: string,
    title: string,
    message: string,
    route: string
  ): void {
    this.authService.getDepartmentStudents(department).subscribe(users => {
      const recipients = users.filter(user => user.id !== this.currentUser?.id);
      this.notifications.notifyUsers(recipients, {
        title,
        message,
        category: 'event',
        route
      });
    });
  }

  private async prepareImageForUpload(file: File): Promise<{ dataUrl: string; message: string }> {
    const originalDataUrl = await this.readFileAsDataUrl(file);

    if (this.isVectorOrGif(file.type)) {
      if (originalDataUrl.length > this.maxStoredImageLength) {
        throw new Error('too-large');
      }

      return {
        dataUrl: originalDataUrl,
        message: `Selected: ${file.name}`
      };
    }

    const image = await this.loadImage(originalDataUrl);
    const scaledDimensions = this.scaleDimensions(image.naturalWidth, image.naturalHeight);

    let width = scaledDimensions.width;
    let height = scaledDimensions.height;
    let quality = 0.86;
    let dataUrl = '';

    for (let attempt = 0; attempt < 8; attempt += 1) {
      dataUrl = this.renderOptimizedImage(image, width, height, quality);
      if (dataUrl.length <= this.maxStoredImageLength) {
        break;
      }

      if (quality > 0.55) {
        quality -= 0.1;
        continue;
      }

      width = Math.max(1, Math.round(width * 0.85));
      height = Math.max(1, Math.round(height * 0.85));
    }

    if (!dataUrl || dataUrl.length > this.maxStoredImageLength) {
      throw new Error('too-large');
    }

    const optimized =
      dataUrl !== originalDataUrl ||
      width !== image.naturalWidth ||
      height !== image.naturalHeight;

    return {
      dataUrl,
      message: optimized ? `Selected: ${file.name} and optimized for upload.` : `Selected: ${file.name}`
    };
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (!result) {
          reject(new Error('empty'));
          return;
        }

        resolve(result);
      };

      reader.onerror = () => reject(new Error('read-failed'));
      reader.readAsDataURL(file);
    });
  }

  private loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('load-failed'));
      image.src = dataUrl;
    });
  }

  private scaleDimensions(width: number, height: number): { width: number; height: number } {
    const maxDimension = this.maxOptimizedImageDimension;
    const largestSide = Math.max(width, height);
    if (largestSide <= maxDimension) {
      return { width, height };
    }

    const scale = maxDimension / largestSide;
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale))
    };
  }

  private renderOptimizedImage(
    image: HTMLImageElement,
    width: number,
    height: number,
    quality: number
  ): string {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('canvas-unavailable');
    }

    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/webp', quality);
  }

  private isVectorOrGif(mimeType: string): boolean {
    return mimeType === 'image/svg+xml' || mimeType === 'image/gif';
  }

  private getSaveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 413) {
        return 'The selected image is still too large to save. Try a smaller image or use an image URL.';
      }

      const apiMessage =
        typeof error.error?.message === 'string'
          ? error.error.message
          : typeof error.error?.error === 'string'
            ? error.error.error
            : '';

      if (apiMessage) {
        return apiMessage;
      }
    }

    return 'Could not save the event. Please try again.';
  }
}
