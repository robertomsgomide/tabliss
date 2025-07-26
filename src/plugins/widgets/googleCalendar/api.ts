import browser from 'webextension-polyfill';
import { API } from "../../types";
import { Cache, Data, CalendarEvent, CalendarList } from "./types";

const CLIENT_ID = REACT_APP_GOOGLE_OAUTH_CLIENT_ID;

/**
 * Retrieves a valid access token, refreshing it if it's expired.
 * This function is the single source of truth for getting an auth token.
 * @returns A promise that resolves to a valid access token.
 */
async function getAccessToken(): Promise<string> {
  const storedData = await browser.storage.local.get([
    'google_access_token',
    'google_refresh_token',
    'google_token_expires_at'
  ]);

  if (!storedData.google_refresh_token) {
    throw new Error('Not authenticated. Please sign in.');
  }

  // Check if the token is expired or will expire in the next 60 seconds.
  const isExpired = !storedData.google_token_expires_at || storedData.google_token_expires_at < (Date.now() + 60000);

  if (isExpired) {
    console.log('Google access token is expired, refreshing...');
  
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        refresh_token: storedData.google_refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      // If the refresh fails, the refresh token might be revoked.
      // Clear the stored tokens to force a full re-authentication.
      await browser.storage.local.remove(['google_access_token', 'google_refresh_token', 'google_token_expires_at']);
      throw new Error('Failed to refresh token. Please sign in again.');
    }

    const newTokens = await response.json();
    const newExpirationTime = Date.now() + (newTokens.expires_in * 1000);

    await browser.storage.local.set({
      google_access_token: newTokens.access_token,
      google_token_expires_at: newExpirationTime,
    });

    return newTokens.access_token;
  }

  return storedData.google_access_token;
}


/**
 * Fetch events from Google Calendar API
 * Supports both public (API key) and private (OAuth) calendar access
 */
export async function getCalendarEvents(
  data: Data,
  loader: API["loader"]
): Promise<Cache> {
  if (!data.calendarId) {
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

    const url = `${baseUrl}/${encodeURIComponent(data.calendarId)}/events?${params.toString()}`;
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication failed. Please sign in again.');
      }
      throw new Error(`Calendar API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    const events: CalendarEvent[] = (result.items || []).map((item: any) => ({
      id: item.id,
      summary: item.summary || 'No title',
      description: item.description,
      start: item.start,
      end: item.end,
      location: item.location,
      htmlLink: item.htmlLink,
    }));

    return {
      timestamp: Date.now(),
      events,
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