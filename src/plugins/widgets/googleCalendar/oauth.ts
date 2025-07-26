import browser from 'webextension-polyfill';

// IMPORTANT: You must get this from your Google Cloud Console credentials.
// Be aware of the security implications of storing this in client-side code.
  const CLIENT_ID = REACT_APP_GOOGLE_OAUTH_CLIENT_ID;
  const CLIENT_SECRET = REACT_APP_GOOGLE_OAUTH_CLIENT_SECRET;

/**
 * Starts the OAuth 2.0 Authorization Code Flow.
 * This flow obtains an authorization code, exchanges it for an access_token
 * and a refresh_token, and stores them securely.
 */
export async function startOAuthFlow(): Promise<void> {
  const REDIRECT_URI = browser.identity.getRedirectURL();
  const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

  // Step 1: Craft the authorization URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code'); // Use 'code' for the Authorization Code Flow
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('access_type', 'offline'); // Request a refresh token
  authUrl.searchParams.set('prompt', 'consent'); // Ensure the user is prompted, which helps in getting a refresh token

  try {
    // Step 2: Launch the web auth flow to get the authorization code
    const responseUrl = await browser.identity.launchWebAuthFlow({
      url: authUrl.href,
      interactive: true
    });

    const url = new URL(responseUrl);
    const code = url.searchParams.get('code');

    if (!code) {
      throw new Error('Authentication flow succeeded but no authorization code was returned.');
    }

    // Step 3: Exchange the authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            code: code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code',
        }),
    });

    if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(`Token exchange failed: ${errorData.error_description || tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
        throw new Error('Token exchange succeeded but no access token was provided.');
    }

    // Step 4: Store the tokens and expiration time securely
    const expirationTime = Date.now() + (tokenData.expires_in * 1000);

    const tokensToStore: { [key: string]: any } = {
        google_access_token: tokenData.access_token,
        google_token_expires_at: expirationTime,
    };

    // The refresh token is only provided on the first authorization.
    // Only update it in storage if it's present in the response.
    if (tokenData.refresh_token) {
        tokensToStore.google_refresh_token = tokenData.refresh_token;
    }

    await browser.storage.local.set(tokensToStore);

  } catch (error: any) {
    console.error("Authentication failed:", error.message);
    throw new Error(`Authentication failed: ${error.message}`);
  }
}