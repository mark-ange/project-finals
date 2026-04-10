import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { UserRole } from './department-directory';
import { HubEvent } from './event-store';

export interface EventComment {
  id: string;
  author: string;
  role: UserRole;
  text: string;
  createdAt: string;
}

export interface EventRegistration {
  id: string;
  userId: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
  registeredAt: string;
  attended: boolean;
}

interface EventMetricsSnapshot {
  id: string;
  likes?: number;
  shares?: number;
  commentsCount?: number;
  registrations?: number;
  attendance?: number;
}

interface CommentInput {
  author: string;
  role: UserRole;
  text: string;
}

interface RegistrationInput {
  userId: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
}

@Injectable({
  providedIn: 'root'
})
export class EventEngagementService {
  private readonly apiUrl = 'http://localhost:5000/api/events';

  private readonly likes = new Map<string, number>();
  private readonly shares = new Map<string, number>();
  private readonly comments = new Map<string, number>();
  private readonly registrations = new Map<string, number>();
  private readonly attendance = new Map<string, number>();

  constructor(private readonly http: HttpClient) {}

  primeMetrics(events: EventMetricsSnapshot[]): void {
    events.forEach(event => {
      if (typeof event.likes === 'number') {
        this.likes.set(event.id, event.likes);
      }
      if (typeof event.shares === 'number') {
        this.shares.set(event.id, event.shares);
      }
      if (typeof event.commentsCount === 'number') {
        this.comments.set(event.id, event.commentsCount);
      }
      if (typeof event.registrations === 'number') {
        this.registrations.set(event.id, event.registrations);
      }
      if (typeof event.attendance === 'number') {
        this.attendance.set(event.id, event.attendance);
      }
    });
  }

  getLikes(eventId: string): number {
    return this.likes.get(eventId) ?? 0;
  }

  getShares(eventId: string): number {
    return this.shares.get(eventId) ?? 0;
  }

  getCommentCount(eventId: string): number {
    return this.comments.get(eventId) ?? 0;
  }

  getRegistrationCount(eventId: string): number {
    return this.registrations.get(eventId) ?? 0;
  }

  getAttendance(event: Pick<HubEvent, 'id'>): number {
    return this.attendance.get(event.id) ?? 0;
  }

  like(eventId: string): Observable<number> {
    return this.http.post<{ likes: number }>(`${this.apiUrl}/${eventId}/likes`, {}).pipe(
      tap(response => {
        this.likes.set(eventId, response.likes);
      }),
      map(response => response.likes)
    );
  }

  trackShare(eventId: string): Observable<number> {
    return this.http.post<{ shares: number }>(`${this.apiUrl}/${eventId}/shares`, {}).pipe(
      tap(response => {
        this.shares.set(eventId, response.shares);
      }),
      map(response => response.shares)
    );
  }

  fetchComments(eventId: string): Observable<EventComment[]> {
    return this.http.get<EventComment[]>(`${this.apiUrl}/${eventId}/comments`).pipe(
      tap(comments => {
        this.comments.set(eventId, comments.length);
      })
    );
  }

  addComment(eventId: string, input: CommentInput): Observable<EventComment> {
    return this.http.post<EventComment>(`${this.apiUrl}/${eventId}/comments`, input).pipe(
      tap(() => {
        this.comments.set(eventId, this.getCommentCount(eventId) + 1);
      })
    );
  }

  deleteComment(eventId: string, commentId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/${eventId}/comments/${commentId}`
    ).pipe(
      tap(() => {
        this.comments.set(eventId, Math.max(0, this.getCommentCount(eventId) - 1));
      })
    );
  }

  fetchRegistrations(eventId: string): Observable<EventRegistration[]> {
    return this.http.get<EventRegistration[]>(`${this.apiUrl}/${eventId}/registrations`).pipe(
      tap(registrations => {
        this.registrations.set(eventId, registrations.length);
        const attendedCount = registrations.filter(registration => registration.attended).length;
        this.attendance.set(eventId, attendedCount);
      })
    );
  }

  registerForEvent(eventId: string, input: RegistrationInput): Observable<EventRegistration> {
    return this.http.post<EventRegistration>(`${this.apiUrl}/${eventId}/registrations`, input).pipe(
      tap(() => {
        this.registrations.set(eventId, this.getRegistrationCount(eventId) + 1);
      })
    );
  }

  setAttendance(
    eventId: string,
    registrationId: string,
    attended: boolean
  ): Observable<{ attended: boolean }> {
    return this.http.patch<{ attended: boolean }>(
      `${this.apiUrl}/${eventId}/registrations/${registrationId}`,
      { attended }
    );
  }

  formatCount(value: number): string {
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
    }

    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
    }

    return `${value}`;
  }

  getFeedbackScore(event: Pick<HubEvent, 'id' | 'registrations'>): number {
    const baseline = 3.2;
    const registered = event.registrations || 0;
    const attendanceRate = registered > 0 ? this.getAttendance(event) / registered : 0;
    const likeBoost = Math.min(0.45, this.getLikes(event.id) / 260);
    const commentBoost = Math.min(0.3, this.getCommentCount(event.id) / 24);
    const shareBoost = Math.min(0.2, this.getShares(event.id) / 90);
    const attendanceBoost = Math.min(0.4, attendanceRate * 0.45);
    const score = baseline + likeBoost + commentBoost + shareBoost + attendanceBoost;

    return Math.min(5, Math.round(score * 10) / 10);
  }
}
