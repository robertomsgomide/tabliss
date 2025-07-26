import React, { FC, useState, useEffect } from "react";
import browser from 'webextension-polyfill';
import { useCachedEffect } from "../../../hooks";
import { HOURS } from "../../../utils";
import { Icon } from "../../../views/shared";
import { getCalendarEvents, formatEventDate, isEventToday } from "./api";
import { Props, defaultData } from "./types";
import "./GoogleCalendar.sass";

const GoogleCalendar: FC<Props> = ({ 
  cache, 
  data = defaultData, 
  loader, 
  setCache
}) => {
  // This new state will track if the user is authenticated for OAuth.
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // When the component loads or the auth method changes, check the actual auth status from storage.
  useEffect(() => {
    const checkAuthStatus = async () => {
      if (data.authMethod === 'oauth') {
        const storedData = await browser.storage.local.get('google_refresh_token');
        setIsAuthenticated(!!storedData.google_refresh_token);
      } else {
        // For API Key method, we don't need an authenticated state.
        setIsAuthenticated(false);
      }
    };
    checkAuthStatus();
  }, [data.authMethod]);

  // Cache events for 30 minutes.
  useCachedEffect(
    () => {
      // The condition is now simpler. If using OAuth, we rely on `isAuthenticated`.
      // The `getCalendarEvents` function will handle the rest.
      const shouldFetch = data.calendarId && (data.authMethod === 'apiKey' || (data.authMethod === 'oauth' && isAuthenticated));

      if (shouldFetch) {
        getCalendarEvents(data, loader)
          .then(setCache)
          .catch(console.error);
      }
    },
    cache ? cache.timestamp + 0.5 * HOURS : 0,
    // The dependency array is updated to remove accessToken and use isAuthenticated instead.
    [data.calendarId, data.maxResults, data.timeRange, data.authMethod, isAuthenticated]
  );

  // Filter events based on settings
  const filteredEvents = cache?.events?.filter(event => {
    if (!data.showToday && isEventToday(event)) {
      return false;
    }
    if (!data.showUpcoming && !isEventToday(event)) {
      return false;
    }
    return true;
  }) || [];

  // Show loading state
  if (!cache && data.calendarId) {
    return (
      <div className="GoogleCalendar loading">
        <div className="calendar-header">
          <Icon name="calendar" />
          <span>Calendar</span>
        </div>
        <div className="loading-text">Loading events...</div>
      </div>
    );
  }

  // Show setup message if no calendar is selected.
  if (!data.calendarId) {
    return (
      <div className="GoogleCalendar setup">
        <div className="calendar-header">
          <Icon name="calendar" />
          <span>Calendar</span>
        </div>
        <div className="setup-message">
          <p>Configure your calendar in settings</p>
        </div>
      </div>
    );
  }

  // Show authentication message for OAuth if we've determined the user is not signed in.
  if (data.authMethod === 'oauth' && !isAuthenticated) {
    return (
      <div className="GoogleCalendar auth-needed">
        <div className="calendar-header">
          <Icon name="calendar" />
          <span>Calendar</span>
        </div>
        <div className="auth-message">
          <p>Sign in required</p>
          <p className="sub-text">Go to settings to authenticate</p>
        </div>
      </div>
    );
  }

  // Show no events message
  if (filteredEvents.length === 0) {
    return (
      <div className="GoogleCalendar empty">
        <div className="calendar-header">
          <Icon name="calendar" />
          <span>Calendar</span>
        </div>
        <div className="no-events">
          <p>No upcoming events</p>
        </div>
      </div>
    );
  }

  return (
    <div className="GoogleCalendar">
      <div className="calendar-header">
        <Icon name="calendar" />
        <span>Calendar</span>
      </div>
      
      <div className="events-list">
        {filteredEvents.slice(0, data.maxResults).map((event) => (
          <div key={event.id} className="event-item">
            <div className="event-time">
              {formatEventDate(event)}
            </div>
            
            <div className="event-content">
              <div className="event-title">
                <a 
                  href={event.htmlLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  title="Open in Google Calendar"
                >
                  {event.summary}
                </a>
              </div>
              
              {data.showDescription && event.description && (
                <div className="event-description">
                  {event.description.length > 100 
                    ? `${event.description.substring(0, 100)}...`
                    : event.description
                  }
                </div>
              )}
              
              {data.showLocation && event.location && (
                <div className="event-location">
                  <Icon name="map-pin" />
                  <span>{event.location}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GoogleCalendar;