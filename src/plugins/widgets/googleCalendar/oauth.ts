import browser from 'webextension-polyfill';

// Only the CLIENT_ID is needed for PKCE flow
const CLIENT_ID = REACT_APP_GOOGLE_OAUTH_CLIENT_ID;

/**
 * Generate a cryptographically random string
 */
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

/**
 * Calculate the SHA256 hash of the input string
 */
async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await crypto.subtle.digest('SHA-256', data);
}

/**
 * Base64-url encode the input string
 */
function base64urlencode(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let str = '';
  for (const byte of bytes) {
    str += String.fromCharCode(byte);
  }
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate PKCE code verifier and challenge
 */
async function generatePKCEPair() {
  const codeVerifier = generateRandomString(128);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64urlencode(hashed);
  return { codeVerifier, codeChallenge };
}

/**
 * Starts the OAuth 2.0 Authorization Code Flow with PKCE.
 * This flow obtains an authorization code, exchanges it for an access_token
 * and a refresh_token, and stores them securely.
 */
export async function startOAuthFlow(): Promise<void> {
  const REDIRECT_URI = browser.identity.getRedirectURL();
  const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

  // Step 1: Generate PKCE pair
  const { codeVerifier, codeChallenge } = await generatePKCEPair();
  
  // Store the code verifier temporarily - we'll need it for the token exchange
  await browser.storage.local.set({ pkce_code_verifier: codeVerifier });

  // Step 2: Craft the authorization URL with PKCE parameters
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('access_type', 'offline'); // Request refresh token
  authUrl.searchParams.set('prompt', 'consent'); // Ensure refresh token is returned
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  try {
    // Step 3: Launch the web auth flow to get the authorization code
    const responseUrl = await browser.identity.launchWebAuthFlow({
      url: authUrl.href,
      interactive: true
    });

    const url = new URL(responseUrl);
    const code = url.searchParams.get('code');

    if (!code) {
      throw new Error('Authentication flow succeeded but no authorization code was returned.');
    }

    // Step 4: Retrieve the stored code verifier
    const { pkce_code_verifier } = await browser.storage.local.get('pkce_code_verifier');
    if (!pkce_code_verifier) {
      throw new Error('PKCE code verifier not found.');
    }

    // Step 5: Exchange the authorization code for tokens using PKCE
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code,
        client_id: CLIENT_ID,
        code_verifier: pkce_code_verifier, // This replaces the client_secret
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    // Clean up the temporary code verifier
    await browser.storage.local.remove('pkce_code_verifier');

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(`Token exchange failed: ${errorData.error_description || tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error('Token exchange succeeded but no access token was provided.');
    }

    // Step 6: Store the tokens and expiration time securely
    const expirationTime = Date.now() + (tokenData.expires_in * 1000);

    const tokensToStore: { [key: string]: any } = {
      google_access_token: tokenData.access_token,
      google_token_expires_at: expirationTime,
    };

    // The refresh token is only provided on the first authorization.
    if (tokenData.refresh_token) {
      tokensToStore.google_refresh_token = tokenData.refresh_token;
    }

    await browser.storage.local.set(tokensToStore);

  } catch (error: any) {
    // Clean up on error
    await browser.storage.local.remove('pkce_code_verifier');
    console.error("Authentication failed:", error.message);
    throw new Error(`Authentication failed: ${error.message}`);
  }
}