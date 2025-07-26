import type { Browser } from "webextension-polyfill";

declare global {
  const BUILD_TARGET: "chromium" | "firefox" | "web";
  const DEV: boolean;
  const GIPHY_API_KEY: string;
  const REACT_APP_GOOGLE_CALENDAR_API_KEY: string;
  const REACT_APP_GOOGLE_OAUTH_CLIENT_ID: string;
  const UNSPLASH_API_KEY: string;
  const VERSION: string;

  const browser: Browser;

  // Google Identity Services API
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: any) => void;
            error_callback?: (error: any) => void;
          }): {
            requestAccessToken: () => void;
          };
        };
        id: {
          initialize: (config: any) => void;
        };
      };
    };
  }
}
