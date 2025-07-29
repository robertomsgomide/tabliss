import browser from 'webextension-polyfill';
import { API } from "../../types";
import { Cache, Data, CalendarEvent, CalendarList } from "./types";
// This script was made having in mind a Firefox browser extension.
const CLIENT_ID     = REACT_APP_GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = REACT_APP_GOOGLE_OAUTH_CLIENT_SECRET; // Desktop‑app secret is public by design; see Google docs.
const TOKEN_URL     = 'https://oauth2.googleapis.com/token';

// Module‑level promise used as a mutex.
let refreshPromise: Promise<string> | null = null;

/**
 * Return a valid access‑token, refreshing exactly once even
 * if several callers ask at the same time.
 */
export async function getAccessToken(): Promise<string> {
  const stored = await browser.storage.local.get([
    'google_access_token',
    'google_refresh_token',
    'google_token_expires_at'
  ]);

  // Guard against “token missing but time‑stamp still present”
  const checkTime        = Date.now();
  const token      = stored.google_access_token as string | undefined;
  const expiresAt  = stored.google_token_expires_at as number | undefined;

  const expired = !token || !expiresAt || expiresAt < checkTime + 60_000;  // 60 s buffer
  if (!expired) return token;                                        // fast path

  // No refresh‑token → bail early
  if (!stored.google_refresh_token)
    throw new Error('Not authenticated. Please sign in.');

  // Deduplicate parallel refreshes
  if (refreshPromise) return refreshPromise;  // someone else is already renewing

  refreshPromise = (async () => {
    console.log('Refreshing Google access‑token…');

    const res = await fetch(TOKEN_URL, {
      method : 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body   : new URLSearchParams({
        client_id    : CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: stored.google_refresh_token,
        grant_type   : 'refresh_token'
      })
    });

    if (!res.ok) {
      await browser.storage.local.remove([
        'google_access_token',
        'google_refresh_token',
        'google_token_expires_at'
      ]);
      throw new Error('Failed to refresh token. Please sign in again.');
    }

    const payload  = await res.json() as {
      access_token : string;
      expires_in   : number;
      refresh_token?: string;
    };
    const newExpiresAt = Date.now() + payload.expires_in * 1_000;

    const toStore: Record<string, any> = {
      google_access_token     : payload.access_token,
      google_token_expires_at : newExpiresAt
    };
    if (payload.refresh_token) toStore.google_refresh_token = payload.refresh_token;

    await browser.storage.local.set(toStore);
    return payload.access_token;
  })()
  .finally(() => { refreshPromise = null; });   // release the lock

  return refreshPromise;
}

/**
 * Fetch events from Google Calendar API
 * Supports both public (API key) and private (OAuth) calendar access
 * Now supports multiple calendars
 */
export async function getCalendarEvents(
  data: Data,
  loader: API["loader"]
): Promise<Cache> {
  if (!data.calendarIds || data.calendarIds.length === 0) {
    return;
  }

  loader.push();

  try {
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + (data.timeRange * 24 * 60 * 60 * 1000)).toISOString();

    const baseUrl = 'https://www.googleapis.com/calendar/v3/calendars';
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      maxResults: data.maxResults.toString(),
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    let headers: HeadersInit = {};
    
    if (data.authMethod === 'oauth') {
      // Get a valid token, which will be automatically refreshed if needed.
      const accessToken = await getAccessToken();
      headers['Authorization'] = `Bearer ${accessToken}`;
    } else {
      const apiKey = REACT_APP_GOOGLE_CALENDAR_API_KEY || '';
      if (!apiKey) {
        throw new Error('Google Calendar API key not configured');
      }
      params.set('key', apiKey);
    }

    // Fetch events from all calendars in parallel
    const calendarPromises = data.calendarIds.map(async (calendarId) => {
      try {
        const url = `${baseUrl}/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
          if (response.status === 401) {
            await browser.storage.local.remove([
              'google_access_token',
              'google_refresh_token',
              'google_token_expires_at'
            ]);
            throw new Error('Authentication failed. Please sign in again.');
          }
          console.warn(`Calendar API error for calendar ${calendarId}: ${response.status} ${response.statusText}`);
          return { items: [] }; // Return empty items instead of throwing for individual calendar errors
        }

        const result = await response.json();
        return result;
      } catch (error) {
        console.warn(`Error fetching events from calendar ${calendarId}:`, error);
        return { items: [] }; // Return empty items for failed individual calendars
      }
    });

    // Wait for all calendar requests to complete
    const calendarResults = await Promise.all(calendarPromises);
    
    // Merge all events from all calendars
    const allEvents: CalendarEvent[] = [];
    
    calendarResults.forEach((result) => {
      const events = (result.items || []).map((item: any) => ({
        id: item.id,
        summary: item.summary || 'No title',
        description: item.description,
        start: item.start,
        end: item.end,
        location: item.location,
        htmlLink: item.htmlLink,
      }));
      allEvents.push(...events);
    });

    // Sort all events by start time
    allEvents.sort((a, b) => {
      const aStart = a.start.dateTime || a.start.date;
      const bStart = b.start.dateTime || b.start.date;
      if (!aStart || !bStart) return 0;
      return new Date(aStart).getTime() - new Date(bStart).getTime();
    });

    return {
      timestamp: Date.now(),
      events: allEvents,
    };

  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  } finally {
    loader.pop();
  }
}

/**
 * Format date for display
 */
export function formatEventDate(event: CalendarEvent): string {
  const startDate = event.start.dateTime || event.start.date;
  if (!startDate) return '';

  const date = new Date(startDate);
  const now = new Date();
  
  // Check if it's today
  const isToday = date.toDateString() === now.toDateString();
  
  // Check if it's an all-day event
  const isAllDay = !!event.start.date;
  
  if (isToday) {
    return isAllDay ? 'Today' : `Today at ${date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    })}`;
  }
  
  if (isAllDay) {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  }
  
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Check if an event is happening today
 */
export function isEventToday(event: CalendarEvent): boolean {
  const startDate = event.start.dateTime || event.start.date;
  if (!startDate) return false;
  
  const eventDate = new Date(startDate);
  const today = new Date();
  
  return eventDate.toDateString() === today.toDateString();
}

/**
 * Fetch user's calendar list (OAuth only)
 */
export async function getCalendarList(): Promise<CalendarList[]> {
  // Use the getAccessToken helper to ensure the token is valid.
  const accessToken = await getAccessToken();

  const url = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      await browser.storage.local.remove([
        'google_access_token',
        'google_refresh_token',
        'google_token_expires_at'
      ]);
      throw new Error('Authentication failed. Please sign in again.');
    }
    throw new Error(`Calendar list API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  
  return (result.items || []).map((item: any) => ({
    id: item.id,
    summary: item.summary,
    primary: item.primary,
    accessRole: item.accessRole,
  }));
}