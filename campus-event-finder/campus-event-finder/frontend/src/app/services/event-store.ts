import { isKnownDepartment, normalizeDepartment, sameDepartment } from './department-directory';

export interface HubEvent {
  id: string;
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
  registrations: number;
  status?: EventStatus;
}

export type EventStatus = 'active' | 'inactive' | 'draft';

export function normalizeEventDepartment(
  event: Pick<HubEvent, 'department' | 'organizer' | 'title' | 'category' | 'description'>
): string {
  return (
    normalizeDepartment(event.department) ||
    inferDepartmentFromText(event.organizer) ||
    inferDepartmentFromText(event.title) ||
    inferDepartmentFromText(event.category) ||
    inferDepartmentFromText(event.description)
  );
}

export function scopeEventsToDepartment(events: HubEvent[], department: string): HubEvent[] {
  return events.filter(event => sameDepartment(normalizeEventDepartment(event), department));
}

function inferDepartmentFromText(value: string | null | undefined): string {
  const normalized = normalizeDepartment(value);
  if (isKnownDepartment(normalized)) {
    return normalized;
  }

  const text = (value ?? '').toLowerCase();
  if (!text) return '';

  if (text.includes('engineer') || text.includes('bridge')) return 'Engineering Department';
  if (text.includes('health') || text.includes('medical') || text.includes('cpr')) {
    return 'Healthcare Department';
  }
  if (
    text.includes('computer science') ||
    text.includes('research') ||
    text.includes('hack') ||
    text.includes('code')
  ) {
    return 'Computer Science Department';
  }
  if (
    text.includes('information technology') ||
    /\bit\b/.test(text) ||
    text.includes('digital') ||
    text.includes('data')
  ) {
    return 'Information Technology Department';
  }
  if (
    text.includes('business') ||
    text.includes('career') ||
    text.includes('startup') ||
    text.includes('entrepreneur')
  ) {
    return 'Business Department';
  }
  if (text.includes('sports') || text.includes('intramural') || text.includes('gym')) {
    return 'Sports Department';
  }
  if (text.includes('arts') || text.includes('gallery') || text.includes('painting')) {
    return 'Fine Arts Department';
  }
  if (
    text.includes('student affairs') ||
    text.includes('orientation') ||
    text.includes('community')
  ) {
    return 'Student Affairs Department';
  }

  return '';
}

export function parseEventStartDate(dateText: string): number | null {
  const normalized = dateText.trim();

  const rangeMatch = /^([A-Za-z]+)\s+(\d{1,2})\s*-\s*(\d{1,2}),\s*(\d{4})$/.exec(normalized);
  if (rangeMatch) {
    const month = rangeMatch[1];
    const day = rangeMatch[2];
    const year = rangeMatch[4];
    const parsed = Date.parse(`${month} ${day}, ${year}`);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function sortEventsForDisplay(events: HubEvent[], now: Date = new Date()): HubEvent[] {
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const withSortKey = events.map(event => {
    const start = parseEventStartDate(event.date);
    const sortKey = start ?? -1;
    const isUpcoming = start !== null && start >= nowMidnight;
    return { event, sortKey, isUpcoming };
  });

  withSortKey.sort((a, b) => {
    if (a.isUpcoming !== b.isUpcoming) return a.isUpcoming ? -1 : 1;

    if (a.sortKey === -1 && b.sortKey === -1) return 0;
    if (a.sortKey === -1) return 1;
    if (b.sortKey === -1) return -1;

    if (a.isUpcoming) return a.sortKey - b.sortKey;
    return b.sortKey - a.sortKey;
  });

  return withSortKey.map(item => item.event);
}
