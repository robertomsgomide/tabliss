<h1 align="center">Tabliss</h1>

<p align="center">A beautiful, customisable New Tab page for Firefox and Chrome.</p>

![Tabliss Screenshot](screenshot.png)

<p align="center"><a href="https://tabliss.io">https://tabliss.io</a></p>

## Usage

Install dependencies with `npm install` before running the following scripts.

- `npm run dev[:target]` Local development server
- `npm run build[:target]` Production build
- `npm run translations` Manage translation files

To develop with external services you will additionally need to signup for your own API keys
and enter them into your `.env` file. Get started by copying the example provided `cp .env.example .env`.

### Google Calendar Widget

The Google Calendar widget supports both public and private calendar access:

**For Public Calendars (API Key):**
1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API
4. Create credentials (API Key)
5. Add the API key to your `.env` file as `REACT_APP_GOOGLE_CALENDAR_API_KEY`

**For Private Calendars (OAuth 2.0):**
1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API
4. Create OAuth 2.0 credentials:
   - **Firefox build ➜ choose “Desktop App”**
   - **Chrome build ➜ choose “Chrome Extension”** and enter the extension ID.
   Google will download a JSON file—open it and copy:
   * `"client_id"` → `REACT_APP_GOOGLE_OAUTH_CLIENT_ID`
   * `"client_secret"` → `REACT_APP_GOOGLE_OAUTH_CLIENT_SECRET`
   (Google doesn’t treat this secret as confidential for installed apps.)
5. Add the OAuth Client ID and secret to your `.env` file as `REACT_APP_GOOGLE_OAUTH_CLIENT_ID` and `REACT_APP_GOOGLE_OAUTH_CLIENT_SECRET`

**Example `.env` file:**
```
GIPHY_API_KEY=your_giphy_api_key_here
UNSPLASH_API_KEY=your_unplash_api_key_here
REACT_APP_GOOGLE_CALENDAR_API_KEY=your_api_key_here
REACT_APP_GOOGLE_OAUTH_CLIENT_ID=your_oauth_client_id_here
REACT_APP_GOOGLE_OAUTH_CLIENT_SECRET=your_oath_client_secret_here
```

Note: OAuth allows secure access to your private calendars without making them public.

## Translations

Checkout the guide to [adding translations](TRANSLATING.md).
