import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { HubEvent } from './event-store';

export interface EventWithMetrics extends HubEvent {
  likes: number;
  shares: number;
  commentsCount: number;
  attendance: number;
}

export interface EventPayload {
  title: string;
  date: string;
  time: string;
  image: string;
  category: string;
  description: string;
  summary: string;
  location: string;
  organizer: string;
  department: string;
  capacity: number;
  status: 'active' | 'inactive' | 'draft';
}

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private readonly apiUrl = 'http://localhost:5000/api/events';

  constructor(private readonly http: HttpClient) {}

  getEvents(): Observable<EventWithMetrics[]> {
    return this.http.get<EventWithMetrics[]>(this.apiUrl);
  }

  createEvent(payload: EventPayload): Observable<EventWithMetrics> {
    return this.http.post<EventWithMetrics>(this.apiUrl, payload);
  }

  updateEvent(eventId: string, payload: EventPayload): Observable<EventWithMetrics> {
    return this.http.put<EventWithMetrics>(`${this.apiUrl}/${eventId}`, payload);
  }

  deleteEvent(eventId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${eventId}`);
  }
}
