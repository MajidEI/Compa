import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { config, validateConfig } from './config';
import authRoutes from './routes/auth.routes';
import profilesRoutes from './routes/profiles.routes';
import exportRoutes from './routes/export.routes';

// Validate configuration on startup
validateConfig();

const app = express();

// =============================================================================
// MIDDLEWARE CONFIGURATION
// =============================================================================

/**
 * CORS Configuration
 * Allow requests from the frontend application
 * credentials: true is required for session cookies to work cross-origin
 * Supports multiple origins for different environments
 */
const allowedOrigins = config.frontendUrl.split(',').map(url => url.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

/**
 * Body Parser
 * Parse JSON request bodies for POST requests
 */
app.use(express.json());

/**
 * Session Configuration
 * Sessions store the Salesforce OAuth tokens
 * 
 * In production, use a persistent session store like Redis or PostgreSQL
 * to support horizontal scaling and survive server restarts.
 */
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

// =============================================================================
// ROUTES
// =============================================================================

/**
 * Health check endpoint
 * Used by load balancers and monitoring
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Authentication routes
 * Handles Salesforce OAuth flow
 */
app.use('/auth', authRoutes);

/**
 * Profile routes
 * Handles profile listing and comparison
 */
app.use('/profiles', profilesRoutes);

/**
 * Export routes
 * Handles CSV and JSON exports
 */
app.use('/export', exportRoutes);

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * Global error handler
 * Catches unhandled errors and returns a consistent error response
 */
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

app.listen(config.port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              Compara - Backend Server                         ║
║     Salesforce Profile & Permission Set Comparison Tool       ║
╠═══════════════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${config.port}                   ║
║  Frontend URL:      ${config.frontendUrl}                      ║
║  OAuth Callback:    ${config.salesforce.callbackUrl}  ║
╚═══════════════════════════════════════════════════════════════╝

API Endpoints:
  GET  /health              - Health check
  GET  /auth/login          - Initiate Salesforce OAuth
  GET  /auth/callback       - OAuth callback
  GET  /auth/status         - Check authentication status
  POST /auth/logout         - Logout
  POST /auth/refresh        - Refresh access token
  GET  /profiles            - List all profiles
  POST /profiles/compare    - Compare selected profiles
  GET  /profiles/:id        - Get single profile details
  `);
});

export default app;
