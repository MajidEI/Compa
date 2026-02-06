import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Application configuration
 * All environment variables are centralized here for easy management
 */
export const config = {
  // Server settings
  port: parseInt(process.env.PORT || '3001', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  
  // Session configuration
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  
  // Salesforce OAuth settings
  salesforce: {
    clientId: process.env.SF_CLIENT_ID || '',
    clientSecret: process.env.SF_CLIENT_SECRET || '',
    callbackUrl: process.env.SF_CALLBACK_URL || 'http://localhost:3001/auth/callback',
    loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com',
  },
  
  // API settings for handling large orgs
  api: {
    // Maximum records per SOQL query
    queryBatchSize: 2000,
    // Timeout for Salesforce API calls (ms)
    timeout: 120000,
    // Maximum concurrent API requests
    maxConcurrentRequests: 5,
  }
};

/**
 * Validate required configuration
 */
export function validateConfig(): void {
  const required = [
    'SF_CLIENT_ID',
    'SF_CLIENT_SECRET',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`⚠️  Missing required environment variables: ${missing.join(', ')}`);
    console.warn('   Copy .env.example to .env and fill in your Salesforce Connected App credentials.');
  }
}
