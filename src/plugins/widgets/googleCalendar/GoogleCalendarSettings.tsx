import React, { FC, useState, useEffect } from "react";
import browser from 'webextension-polyfill';
import { DebounceInput } from "../../shared";
import { Props, defaultData, CalendarList } from "./types";
import { startOAuthFlow } from "./oauth";
import { getCalendarList } from "./api";

const GoogleCalendarSettings: FC<Props> = ({ data = defaultData, setData }) => {
  const [calendars, setCalendars] = useState<CalendarList[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  // Tracks if we have a valid refresh token.
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // On component mount, check if we are already authenticated.
  useEffect(() => {
    const checkAuthStatus = async () => {
      const storedData = await browser.storage.local.get('google_refresh_token');
      if (storedData.google_refresh_token) {
        setIsAuthenticated(true);
      }
    };
    checkAuthStatus();
  }, []);

  // Load user's calendars when the auth method is 'oauth' and we are authenticated.
  useEffect(() => {
    if (data.authMethod === 'oauth' && isAuthenticated) {
      setLoadingCalendars(true);
      // getCalendarList no longer needs an accessToken passed to it.
      getCalendarList()
        .then(setCalendars)
        .catch(error => {
            console.error(error);
            // If fetching fails, it's likely an auth issue, so sign the user out.
            handleSignOut();
        })
        .finally(() => setLoadingCalendars(false));
    }
  }, [data.authMethod, isAuthenticated]);

  const handleOAuthSignIn = async () => {
    try {
      // startOAuthFlow now handles storing the tokens itself and doesn't return anything.
      await startOAuthFlow();
      setIsAuthenticated(true); // Set authenticated state to true to re-render the UI.
      setData({
        ...data,
        authMethod: 'oauth',
      });
    } catch (error) {
      console.error('OAuth sign-in failed:', error);
      alert('Sign-in failed. Please try again.'); // Using alert as a placeholder
    }
  };

  const handleSignOut = async () => {
    // Clear all tokens from storage to properly sign out.
    await browser.storage.local.remove([
        'google_access_token',
        'google_refresh_token',
        'google_token_expires_at'
    ]);
    setIsAuthenticated(false);
    setCalendars([]);
    setData({
      ...data,
      // We no longer store tokens in the widget's data object.
      calendarIds: [],
    });
  };

  const handleCalendarToggle = (calendarId: string) => {
    const isSelected = data.calendarIds.includes(calendarId);
    const newCalendarIds = isSelected
      ? data.calendarIds.filter(id => id !== calendarId)
      : [...data.calendarIds, calendarId];
    
    setData({ ...data, calendarIds: newCalendarIds });
  };

  return (
    <div className="GoogleCalendarSettings">
      <h5>Authentication Method</h5>
      
      <label>
        <input
          type="radio"
          name="authMethod"
          value="apiKey"
          checked={data.authMethod === 'apiKey'}
          onChange={() => setData({ ...data, authMethod: 'apiKey', calendarIds: [] })}
        />
        Public Calendar (API Key)
      </label>
      
      <label>
        <input
          type="radio"
          name="authMethod"
          value="oauth"
          checked={data.authMethod === 'oauth'}
          onChange={() => setData({ ...data, authMethod: 'oauth', calendarIds: [] })}
        />
        Private Calendar (OAuth)
      </label>

      {data.authMethod === 'oauth' && (
        <div className="oauth-section">
          {/* UI is now controlled by the `isAuthenticated` state variable */}
          {!isAuthenticated ? (
            <div className="oauth-signin">
              <p>Sign in to access your private calendars:</p>
              <button type="button" onClick={handleOAuthSignIn} className="oauth-button">
                Sign in with Google
              </button>
            </div>
          ) : (
            <div className="oauth-authenticated">
              <p className="auth-status">✅ Signed in to Google Calendar</p>
              <button type="button" onClick={handleSignOut} className="signout-button">
                Sign Out
              </button>
            </div>
          )}
        </div>
      )}

      <h5>Calendar Selection</h5>
      
      {data.authMethod === 'apiKey' ? (
        <label>
          Calendar ID
          <DebounceInput
            type="text"
            value={data.calendarIds[0] || ''}
            onChange={(calendarId) => setData({ ...data, calendarIds: calendarId ? [calendarId] : [] })}
            placeholder="example@gmail.com or calendar-id@group.calendar.google.com"
          />
          <small>
            Enter the Calendar ID of a public Google Calendar.
          </small>
        </label>
      ) : data.authMethod === 'oauth' && isAuthenticated ? (
        <div>
          {loadingCalendars ? (
            <div className="loading-calendars">Loading your calendars...</div>
          ) : (
            <div className="calendar-checkboxes">
              {calendars.map((calendar) => (
                <label key={calendar.id} className="calendar-checkbox">
                  <input
                    type="checkbox"
                    checked={data.calendarIds.includes(calendar.id)}
                    onChange={() => handleCalendarToggle(calendar.id)}
                  />
                  {calendar.summary} {calendar.primary ? '(Primary)' : ''}
                </label>
              ))}
            </div>
          )}
          {calendars.length > 0 && (
            <small>
              Selected: {data.calendarIds.length} calendar{data.calendarIds.length !== 1 ? 's' : ''}
            </small>
          )}
        </div>
      ) : data.authMethod === 'oauth' ? (
        <p className="calendar-note">Sign in to see your available calendars</p>
      ) : null}

      <label>
        Maximum Events
        <input
          type="number"
          value={data.maxResults}
          onChange={(event) =>
            setData({ ...data, maxResults: Math.max(1, Math.min(20, Number(event.target.value))) })
          }
          min={1}
          max={20}
        />
      </label>

      <label>
        Time Range (Days)
        <input
          type="number"
          value={data.timeRange}
          onChange={(event) =>
            setData({ ...data, timeRange: Math.max(1, Math.min(365, Number(event.target.value))) })
          }
          min={1}
          max={365}
        />
        <small>How many days ahead to show events</small>
      </label>

      <h5>Display Options</h5>

      <label>
        <input
          type="checkbox"
          checked={data.showToday}
          onChange={() => setData({ ...data, showToday: !data.showToday })}
        />
        Show today's events
      </label>

      <label>
        <input
          type="checkbox"
          checked={data.showUpcoming}
          onChange={() => setData({ ...data, showUpcoming: !data.showUpcoming })}
        />
        Show upcoming events
      </label>

      <label>
        <input
          type="checkbox"
          checked={data.showDescription}
          onChange={() => setData({ ...data, showDescription: !data.showDescription })}
        />
        Show event descriptions
      </label>

      <label>
        <input
          type="checkbox"
          checked={data.showLocation}
          onChange={() => setData({ ...data, showLocation: !data.showLocation })}
        />
        Show event locations
      </label>

      <hr />
      
      <h5>Setup Instructions</h5>
      <div className="setup-instructions">
        {data.authMethod === 'apiKey' ? (
          <>
            <p><strong>For Public Calendars (API Key):</strong></p>
            <ol>
              <li>Open Google Calendar</li>
              <li>Click the three dots next to the calendar you want to display</li>
              <li>Select "Settings and sharing"</li>
              <li>Scroll to "Access permissions" and check "Make available to public"</li>
              <li>Copy the Calendar ID from the "Integrate calendar" section</li>
              <li>Paste it in the Calendar ID field above</li>
            </ol>
            
            <p>
              <a 
                href="https://support.google.com/calendar/answer/37083" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                Learn more about making calendars public
              </a>
            </p>
          </>
        ) : (
          <>
            <p><strong>For Private Calendars (OAuth):</strong></p>
            <ol>
              <li>Click "Sign in with Google" above</li>
              <li>Grant permission to access your calendar</li>
              <li>Select any of your calendars from the dropdown</li>
              <li>Your events will be displayed privately and securely</li>
            </ol>
          </>
        )}
      </div>
    </div>
  );
};

export default GoogleCalendarSettings;