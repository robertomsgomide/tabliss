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
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add your development URL to authorized origins (e.g., `http://localhost:8081`)
   - Add your development URL to authorized redirect URIs (e.g., `http://localhost:8081`)
5. Add the OAuth Client ID to your `.env` file as `REACT_APP_GOOGLE_OAUTH_CLIENT_ID`

**Example `.env` file:**
```
REACT_APP_GOOGLE_CALENDAR_API_KEY=your_api_key_here
REACT_APP_GOOGLE_OAUTH_CLIENT_ID=your_oauth_client_id_here
```

Note: OAuth allows secure access to your private calendars without making them public.

## Translations

Checkout the guide to [adding translations](TRANSLATING.md).
