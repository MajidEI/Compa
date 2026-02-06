import { Router, Request, Response } from 'express';
import { config } from '../config';
import {
  getAuthorizationUrl,
  getCodeVerifier,
  getStoredEnvironment,
  exchangeCodeForToken,
  refreshAccessToken,
} from '../services/salesforce.service';

const router = Router();

/**
 * GET /auth/login
 * 
 * Redirects the user to Salesforce OAuth login page.
 * Uses PKCE (Proof Key for Code Exchange) for enhanced security.
 * After successful authentication, Salesforce redirects back to /auth/callback
 * 
 * Query params:
 *   - env: 'production' | 'sandbox' (default: 'production')
 */
router.get('/login', (req: Request, res: Response) => {
  // Get environment from query param (production or sandbox)
  const env = req.query.env === 'sandbox' ? 'sandbox' : 'production';
  const { url } = getAuthorizationUrl(env);
  console.log(`Redirecting to Salesforce OAuth (${env})...`);
  res.redirect(url);
});

/**
 * GET /auth/callback
 * 
 * OAuth callback handler. Salesforce redirects here with an authorization code.
 * We exchange the code for access and refresh tokens (using PKCE code_verifier),
 * store them in the session, and redirect the user to the frontend.
 */
router.get('/callback', async (req: Request, res: Response) => {
  const { code, error, error_description, state } = req.query;
  
  // Handle OAuth errors (user denied access, etc.)
  if (error) {
    console.error('OAuth error:', error, error_description);
    return res.redirect(`${config.frontendUrl}?error=${encodeURIComponent(String(error))}`);
  }
  
  if (!code || typeof code !== 'string') {
    return res.redirect(`${config.frontendUrl}?error=no_code`);
  }
  
  // Retrieve the code_verifier and environment using the state parameter
  let codeVerifier: string | undefined;
  let env: 'production' | 'sandbox' = 'production';
  
  if (state && typeof state === 'string') {
    codeVerifier = getCodeVerifier(state);
    env = getStoredEnvironment(state);
    if (!codeVerifier) {
      console.warn('No code verifier found for state:', state);
    }
  }
  
  try {
    // Exchange authorization code for access token (with PKCE code_verifier)
    const session = await exchangeCodeForToken(code, codeVerifier, env);
    
    // Store session data (access token, refresh token, instance URL)
    req.session.salesforce = session;
    
    console.log('OAuth successful! User authenticated from:', session.instanceUrl);
    
    // Redirect to frontend with success indicator
    res.redirect(`${config.frontendUrl}?auth=success`);
  } catch (err: any) {
    console.error('Token exchange error:', err.response?.data || err.message);
    res.redirect(`${config.frontendUrl}?error=token_exchange_failed`);
  }
});

/**
 * POST /auth/refresh
 * 
 * Refresh the access token using the stored refresh token.
 * Called when the access token expires (typically after 2 hours).
 */
router.post('/refresh', async (req: Request, res: Response) => {
  const sfSession = req.session.salesforce;
  
  if (!sfSession?.refreshToken) {
    return res.status(401).json({ error: 'No refresh token available' });
  }
  
  try {
    const newSession = await refreshAccessToken(sfSession.refreshToken);
    req.session.salesforce = newSession;
    
    res.json({ success: true });
  } catch (err: any) {
    console.error('Token refresh error:', err.response?.data || err.message);
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

/**
 * GET /auth/status
 * 
 * Check if the user is authenticated.
 * Returns user info if authenticated, 401 otherwise.
 */
router.get('/status', (req: Request, res: Response) => {
  const sfSession = req.session.salesforce;
  
  if (!sfSession?.accessToken) {
    return res.status(401).json({ authenticated: false });
  }
  
  // Check if token might be expired
  const isExpired = sfSession.expiresAt && Date.now() > sfSession.expiresAt;
  
  res.json({
    authenticated: true,
    expired: isExpired,
    instanceUrl: sfSession.instanceUrl,
    userId: sfSession.userId,
    organizationId: sfSession.organizationId,
  });
});

/**
 * POST /auth/logout
 * 
 * Clear the session and log out the user.
 */
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

export default router;
