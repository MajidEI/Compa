import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { config } from '../config';
import {
  SalesforceProfile,
  SalesforceObjectPermission,
  SalesforceFieldPermission,
  SalesforcePermissionSet,
  SalesforceSetupEntityAccess,
  UserSession,
} from '../types';

// ==========================================================================
// PKCE (Proof Key for Code Exchange) HELPERS
// ==========================================================================

/**
 * Store for PKCE code verifiers (in production, use Redis or database)
 * Maps state -> code_verifier
 */
const pkceStore = new Map<string, string>();

/**
 * Generate a cryptographically random code verifier for PKCE
 * Must be between 43 and 128 characters
 */
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate the code challenge from the verifier using SHA256
 * This is sent in the authorization request
 */
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Generate a random state parameter to prevent CSRF
 */
function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * SalesforceService handles all interactions with Salesforce APIs
 * 
 * This service is designed to:
 * 1. Handle OAuth token management
 * 2. Execute SOQL queries efficiently with pagination
 * 3. Minimize API calls by batching requests
 * 4. Handle large org scenarios gracefully
 */
export class SalesforceService {
  private accessToken: string;
  private instanceUrl: string;
  private apiClient: AxiosInstance;

  constructor(session: UserSession) {
    this.accessToken = session.accessToken;
    this.instanceUrl = session.instanceUrl;
    
    // Create a configured axios instance for all Salesforce API calls
    this.apiClient = axios.create({
      baseURL: `${this.instanceUrl}/services/data/v59.0`,
      timeout: config.api.timeout,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // ==========================================================================
  // SOQL QUERY HELPERS
  // ==========================================================================

  /**
   * Execute a SOQL query with automatic pagination for large result sets
   * Salesforce limits query results to 2000 records per request
   * This method handles the "nextRecordsUrl" to fetch all records
   */
  async query<T>(soql: string): Promise<T[]> {
    const records: T[] = [];
    let url: string | null = `/query?q=${encodeURIComponent(soql)}`;
    
    try {
      while (url) {
        const response = await this.apiClient.get(url);
        records.push(...response.data.records);
        
        // Salesforce returns nextRecordsUrl for paginated results
        // The URL is relative to the instance, so we need to extract just the path
        if (response.data.nextRecordsUrl) {
          // nextRecordsUrl comes as full path like "/services/data/v59.0/query/01gxx..."
          // We need to make it relative to our baseURL which already includes /services/data/v59.0
          const nextUrl = response.data.nextRecordsUrl;
          // Extract just the query ID part (e.g., "/query/01gxx...")
          const match = nextUrl.match(/\/query\/(.+)$/);
          if (match) {
            url = `/query/${match[1]}`;
          } else {
            url = null;
          }
        } else {
          url = null;
        }
      }
    } catch (err: any) {
      const objectMatch = soql.match(/FROM\s+(\w+)/i);
      const objectName = objectMatch ? objectMatch[1] : 'Unknown';
      console.error(`Query failed for ${objectName}:`, err.response?.data || err.message);
      throw err;
    }
    
    return records;
  }

  /**
   * Execute a Tooling API query
   * Tooling API provides access to metadata like ApexClass, ApexPage, etc.
   */
  async toolingQuery<T>(soql: string): Promise<T[]> {
    const records: T[] = [];
    let url: string | null = `/tooling/query?q=${encodeURIComponent(soql)}`;
    
    try {
      while (url) {
        const response = await this.apiClient.get(url);
        records.push(...response.data.records);
        
        // Handle pagination - extract just the query path
        if (response.data.nextRecordsUrl) {
          const nextUrl = response.data.nextRecordsUrl;
          const match = nextUrl.match(/\/query\/(.+)$/);
          if (match) {
            url = `/tooling/query/${match[1]}`;
          } else {
            url = null;
          }
        } else {
          url = null;
        }
      }
    } catch (err: any) {
      const objectMatch = soql.match(/FROM\s+(\w+)/i);
      const objectName = objectMatch ? objectMatch[1] : 'Unknown';
      console.error(`Tooling query failed for ${objectName}:`, err.response?.data || err.message);
      throw err;
    }
    
    return records;
  }

  // ==========================================================================
  // PROFILE DATA RETRIEVAL
  // ==========================================================================

  /**
   * Fetch all profiles in the org
   * Returns basic profile info for the selection UI
   */
  async getAllProfiles(): Promise<SalesforceProfile[]> {
    const soql = `
      SELECT Id, Name, UserLicenseId, UserType, Description
      FROM Profile
      ORDER BY Name
    `;
    return this.query<SalesforceProfile>(soql);
  }

  /**
   * Fetch all Permission Sets in the org (excluding profile-owned ones)
   * Returns Permission Sets that can be assigned to users
   */
  async getAllPermissionSets(): Promise<SalesforcePermissionSetInfo[]> {
    const soql = `
      SELECT Id, Name, Label, Description, IsCustom, PermissionSetGroupId, 
             Type, LicenseId, HasActivationRequired
      FROM PermissionSet
      WHERE IsOwnedByProfile = false
      ORDER BY Label
    `;
    return this.query<SalesforcePermissionSetInfo>(soql);
  }

  /**
   * Fetch all Permission Set Groups in the org
   */
  async getAllPermissionSetGroups(): Promise<SalesforcePermissionSetGroup[]> {
    try {
      const soql = `
        SELECT Id, DeveloperName, MasterLabel, Description, Status
        FROM PermissionSetGroup
        ORDER BY MasterLabel
      `;
      return this.query<SalesforcePermissionSetGroup>(soql);
    } catch (error) {
      console.warn('Permission Set Groups not available in this org');
      return [];
    }
  }

  /**
   * Get the PermissionSet IDs that are owned by the given profiles
   * 
   * IMPORTANT: In Salesforce, each Profile has an associated PermissionSet
   * where IsOwnedByProfile = true. This PermissionSet contains:
   * - Object permissions
   * - Field permissions
   * - System permissions (user permissions)
   * - Setup entity access (Apex classes, VF pages, etc.)
   * 
   * This is the key to understanding profile permissions programmatically.
   */
  async getProfilePermissionSetIds(profileIds: string[]): Promise<Map<string, string>> {
    if (profileIds.length === 0) return new Map();
    
    const idList = profileIds.map(id => `'${id}'`).join(',');
    const soql = `
      SELECT Id, ProfileId
      FROM PermissionSet
      WHERE IsOwnedByProfile = true
      AND ProfileId IN (${idList})
    `;
    
    const results = await this.query<{ Id: string; ProfileId: string }>(soql);
    
    // Create a map: ProfileId -> PermissionSetId
    const map = new Map<string, string>();
    for (const record of results) {
      map.set(record.ProfileId, record.Id);
    }
    
    // Log the mapping for debugging
    console.log('Profile to PermissionSet mapping:');
    for (const [profileId, permSetId] of map) {
      console.log(`  Profile ${profileId} -> PermissionSet ${permSetId}`);
    }
    
    // Warn if any profiles didn't have a matching PermissionSet
    const missingProfiles = profileIds.filter(id => !map.has(id));
    if (missingProfiles.length > 0) {
      console.warn('No PermissionSet found for profiles:', missingProfiles);
    }
    
    return map;
  }

  /**
   * Fetch Object Permissions for given PermissionSet IDs
   * 
   * Object permissions control CRUD access at the object level.
   * Each record represents one object's permissions for one profile.
   */
  async getObjectPermissions(permissionSetIds: string[]): Promise<SalesforceObjectPermission[]> {
    if (permissionSetIds.length === 0) return [];
    
    const idList = permissionSetIds.map(id => `'${id}'`).join(',');
    const soql = `
      SELECT Id, ParentId, SobjectType,
             PermissionsCreate, PermissionsRead, PermissionsEdit, PermissionsDelete,
             PermissionsViewAllRecords, PermissionsModifyAllRecords
      FROM ObjectPermissions
      WHERE ParentId IN (${idList})
    `;
    return this.query<SalesforceObjectPermission>(soql);
  }

  /**
   * Fetch Field Permissions for given PermissionSet IDs
   * 
   * Field permissions (Field-Level Security) control read/edit access per field.
   * The Field column contains the full path: "ObjectName.FieldName"
   * 
   * NOTE: This can be a large result set in orgs with many custom fields.
   * The pagination in query() handles this automatically.
   * 
   * NOTE: FieldPermissions only returns records where Read or Edit is explicitly granted.
   * Fields with no access won't appear in results.
   */
  async getFieldPermissions(permissionSetIds: string[]): Promise<SalesforceFieldPermission[]> {
    if (permissionSetIds.length === 0) return [];
    
    console.log('Fetching field permissions for PermissionSet IDs:', permissionSetIds);
    
    const idList = permissionSetIds.map(id => `'${id}'`).join(',');
    const soql = `
      SELECT Id, ParentId, SobjectType, Field,
             PermissionsRead, PermissionsEdit
      FROM FieldPermissions
      WHERE ParentId IN (${idList})
    `;
    
    try {
      const results = await this.query<SalesforceFieldPermission>(soql);
      console.log(`  Found ${results.length} field permissions`);
      return results;
    } catch (err: any) {
      console.warn('FieldPermissions query failed:', err.response?.data || err.message);
      console.warn('This may require "View Setup and Configuration" permission.');
      return [];
    }
  }

  /**
   * Fetch PermissionSet records with all system permission fields
   * 
   * System permissions (also called User Permissions) are boolean fields
   * on the PermissionSet object. Examples:
   * - PermissionsViewSetup
   * - PermissionsModifyAllData
   * - PermissionsApiEnabled
   * 
   * We need to dynamically discover which permission fields exist
   * because they can vary by edition and org configuration.
   */
  async getPermissionSetWithSystemPerms(permissionSetIds: string[]): Promise<SalesforcePermissionSet[]> {
    if (permissionSetIds.length === 0) return [];
    
    // First, describe the PermissionSet object to get all permission fields
    let permissionFields: string[] = [];
    try {
      const describeResponse = await this.apiClient.get('/sobjects/PermissionSet/describe');
      permissionFields = describeResponse.data.fields
        .filter((f: any) => f.name.startsWith('Permissions') && f.type === 'boolean')
        .map((f: any) => f.name);
    } catch (err: any) {
      console.warn('Could not describe PermissionSet, using basic fields:', err.message);
      // Use a minimal set of common permission fields as fallback
      permissionFields = [
        'PermissionsApiEnabled',
        'PermissionsViewSetup',
        'PermissionsModifyAllData',
        'PermissionsViewAllData',
        'PermissionsManageUsers',
      ];
    }
    
    const idList = permissionSetIds.map(id => `'${id}'`).join(',');
    const fieldList = ['Id', 'Name', 'ProfileId', 'IsOwnedByProfile', ...permissionFields].join(', ');
    
    const soql = `
      SELECT ${fieldList}
      FROM PermissionSet
      WHERE Id IN (${idList})
    `;
    
    return this.query<SalesforcePermissionSet>(soql);
  }

  /**
   * Fetch SetupEntityAccess records for Apex classes, VF pages, etc.
   * 
   * SetupEntityAccess controls access to:
   * - ApexClass: Apex class invocation
   * - ApexPage: Visualforce page access
   * - TabSet: Application visibility
   * - CustomPermission: Custom permissions
   * - ConnectedApplication: Connected app access
   */
  async getSetupEntityAccess(permissionSetIds: string[]): Promise<SalesforceSetupEntityAccess[]> {
    if (permissionSetIds.length === 0) return [];
    
    const idList = permissionSetIds.map(id => `'${id}'`).join(',');
    const soql = `
      SELECT Id, ParentId, SetupEntityId, SetupEntityType
      FROM SetupEntityAccess
      WHERE ParentId IN (${idList})
    `;
    
    try {
      const results = await this.query<SalesforceSetupEntityAccess>(soql);
      console.log(`  Found ${results.length} setup entity access records`);
      return results;
    } catch (err: any) {
      console.warn('SetupEntityAccess query failed:', err.response?.data || err.message);
      return [];
    }
  }

  /**
   * Fetch Apex class names by IDs
   * Used to resolve SetupEntityAccess records to friendly names
   * Batches requests to avoid URI Too Long errors
   */
  async getApexClassNames(classIds: string[]): Promise<Map<string, string>> {
    if (classIds.length === 0) return new Map();
    
    const result = new Map<string, string>();
    const batchSize = 100; // Process 100 IDs at a time to avoid URI length issues
    
    try {
      for (let i = 0; i < classIds.length; i += batchSize) {
        const batch = classIds.slice(i, i + batchSize);
        const idList = batch.map(id => `'${id}'`).join(',');
        const soql = `SELECT Id, Name FROM ApexClass WHERE Id IN (${idList})`;
        
        const results = await this.toolingQuery<{ Id: string; Name: string }>(soql);
        for (const r of results) {
          result.set(r.Id, r.Name);
        }
      }
    } catch (err) {
      console.warn('Could not fetch Apex class names');
    }
    
    return result;
  }

  /**
   * Fetch Visualforce page names by IDs
   * Batches requests to avoid URI Too Long errors
   */
  async getApexPageNames(pageIds: string[]): Promise<Map<string, string>> {
    if (pageIds.length === 0) return new Map();
    
    const result = new Map<string, string>();
    const batchSize = 100;
    
    try {
      for (let i = 0; i < pageIds.length; i += batchSize) {
        const batch = pageIds.slice(i, i + batchSize);
        const idList = batch.map(id => `'${id}'`).join(',');
        const soql = `SELECT Id, Name FROM ApexPage WHERE Id IN (${idList})`;
        
        const results = await this.toolingQuery<{ Id: string; Name: string }>(soql);
        for (const r of results) {
          result.set(r.Id, r.Name);
        }
      }
    } catch (err) {
      console.warn('Could not fetch Apex page names');
    }
    
    return result;
  }

  /**
   * Fetch all Record Types for name resolution
   */
  async getRecordTypes(): Promise<Map<string, string>> {
    try {
      const recordTypes = await this.query<{
        Id: string;
        Name: string;
        SobjectType: string;
        DeveloperName: string;
      }>(`SELECT Id, Name, SobjectType, DeveloperName FROM RecordType WHERE IsActive = true`);
      
      // Build a map of RecordType ID to "ObjectName.RecordTypeName"
      const rtMap = new Map<string, string>();
      for (const rt of recordTypes) {
        rtMap.set(rt.Id, `${rt.SobjectType}.${rt.DeveloperName}`);
      }
      
      console.log(`  Found ${rtMap.size} record types`);
      return rtMap;
    } catch (err: any) {
      console.warn('Could not fetch record types:', err.message);
      return new Map();
    }
  }

  /**
   * Fetch all Custom Tabs for name resolution
   */
  async getCustomTabs(): Promise<Map<string, string>> {
    try {
      // Query CustomTab from Tooling API - CustomTab only has Id and SobjectName/DeveloperName
      const tabs = await this.toolingQuery<{
        Id: string;
        DeveloperName: string;
        SobjectName: string;
      }>(`SELECT Id, DeveloperName, SobjectName FROM CustomTab`);
      
      const tabMap = new Map<string, string>();
      for (const tab of tabs) {
        tabMap.set(tab.Id, tab.DeveloperName || tab.SobjectName || tab.Id);
      }
      
      console.log(`  Found ${tabMap.size} custom tabs`);
      return tabMap;
    } catch (err: any) {
      console.warn('Could not fetch custom tabs:', err.message);
      return new Map();
    }
  }

  /**
   * Fetch all Custom Applications for name resolution
   */
  async getCustomApps(): Promise<Map<string, string>> {
    try {
      // Query CustomApplication from Tooling API
      const apps = await this.toolingQuery<{
        Id: string;
        DeveloperName: string;
        Label: string;
      }>(`SELECT Id, DeveloperName, Label FROM CustomApplication`);
      
      const appMap = new Map<string, string>();
      for (const app of apps) {
        appMap.set(app.Id, app.Label || app.DeveloperName);
      }
      
      console.log(`  Found ${appMap.size} custom apps`);
      return appMap;
    } catch (err: any) {
      console.warn('Could not fetch custom apps:', err.message);
      return new Map();
    }
  }

  /**
   * Fetch all Lightning pages (FlexiPage) for access checking
   */
  async getLightningPages(): Promise<Map<string, string>> {
    const soql = `SELECT Id, DeveloperName FROM FlexiPage`;
    
    try {
      const results = await this.toolingQuery<{ Id: string; DeveloperName: string }>(soql);
      return new Map(results.map(r => [r.Id, r.DeveloperName]));
    } catch (error) {
      // FlexiPage might not be accessible in all orgs
      console.warn('Could not fetch FlexiPage data:', error);
      return new Map();
    }
  }

  /**
   * Get Application (TabSet) information for app visibility
   */
  async getApplications(): Promise<Map<string, string>> {
    const soql = `SELECT Id, Name FROM AppMenuItem WHERE Type = 'TabSet'`;
    
    try {
      const results = await this.query<{ Id: string; Name: string }>(soql);
      return new Map(results.map(r => [r.Id, r.Name]));
    } catch (error) {
      console.warn('Could not fetch Application data:', error);
      return new Map();
    }
  }

  /**
   * Fetch Profile metadata including tab settings and app visibility
   * Uses the Tooling API to read Profile metadata
   */
  async getProfileMetadata(profileIds: string[]): Promise<Map<string, ProfileMetadata>> {
    const result = new Map<string, ProfileMetadata>();
    
    if (profileIds.length === 0) return result;
    
    try {
      // Use Tooling API to get Profile metadata
      // ProfileTabVisibility and ProfileApplicationVisibility are embedded in Profile metadata
      const idList = profileIds.map(id => `'${id}'`).join(',');
      
      // Query Profile with related metadata
      const profiles = await this.toolingQuery<{
        Id: string;
        Name: string;
        FullName: string;
        Metadata: {
          tabVisibilities?: Array<{
            tab: string;
            visibility: 'DefaultOn' | 'DefaultOff' | 'Hidden';
          }>;
          applicationVisibilities?: Array<{
            application: string;
            visible: boolean;
            default: boolean;
          }>;
        } | null;
      }>(`SELECT Id, Name, FullName, Metadata FROM Profile WHERE Id IN (${idList})`);
      
      for (const profile of profiles) {
        const metadata: ProfileMetadata = {
          tabVisibilities: {},
          appVisibilities: {},
        };
        
        if (profile.Metadata) {
          // Process tab visibilities
          if (profile.Metadata.tabVisibilities) {
            for (const tab of profile.Metadata.tabVisibilities) {
              metadata.tabVisibilities[tab.tab] = tab.visibility;
            }
          }
          
          // Process app visibilities
          if (profile.Metadata.applicationVisibilities) {
            for (const app of profile.Metadata.applicationVisibilities) {
              metadata.appVisibilities[app.application] = {
                visible: app.visible,
                default: app.default,
              };
            }
          }
        }
        
        result.set(profile.Id, metadata);
      }
      
      console.log(`  ✓ Profile metadata: ${result.size} profiles with tab/app settings`);
    } catch (error: any) {
      console.warn('Could not fetch Profile metadata via Tooling API:', error.message);
      console.warn('  This requires "View Setup and Configuration" permission.');
      console.warn('  Falling back to SetupEntityAccess for partial data.');
    }
    
    return result;
  }

  /**
   * Get all available tabs in the org for reference
   */
  async getAllTabs(): Promise<Map<string, TabInfo>> {
    const result = new Map<string, TabInfo>();
    
    try {
      // Use the tabs() REST endpoint to get all tabs
      const response = await this.apiClient.get('/tabs');
      const tabs = response.data as Array<{
        name: string;
        label: string;
        sobjectName?: string;
        custom: boolean;
      }>;
      
      for (const tab of tabs) {
        result.set(tab.name, {
          name: tab.name,
          label: tab.label,
          sobjectName: tab.sobjectName,
          isCustom: tab.custom,
        });
      }
      
      console.log(`  ✓ All tabs: ${result.size} tabs in org`);
    } catch (error: any) {
      console.warn('Could not fetch tabs list:', error.message);
    }
    
    return result;
  }

  /**
   * Get all applications in the org
   */
  async getAllApplications(): Promise<Map<string, AppInfo>> {
    const result = new Map<string, AppInfo>();
    
    try {
      const apps = await this.toolingQuery<{
        Id: string;
        DeveloperName: string;
        Label: string;
        NavType: string;
      }>(`SELECT Id, DeveloperName, Label, NavType FROM CustomApplication`);
      
      for (const app of apps) {
        result.set(app.DeveloperName, {
          id: app.Id,
          name: app.DeveloperName,
          label: app.Label,
          navType: app.NavType,
        });
      }
      
      console.log(`  ✓ All applications: ${result.size} apps in org`);
    } catch (error: any) {
      console.warn('Could not fetch applications list:', error.message);
    }
    
    return result;
  }
}

/**
 * Profile metadata structure
 */
export interface ProfileMetadata {
  tabVisibilities: Record<string, 'DefaultOn' | 'DefaultOff' | 'Hidden'>;
  appVisibilities: Record<string, { visible: boolean; default: boolean }>;
}

export interface TabInfo {
  name: string;
  label: string;
  sobjectName?: string;
  isCustom: boolean;
}

export interface AppInfo {
  id: string;
  name: string;
  label: string;
  navType: string;
}

// ==========================================================================
// OAUTH HELPER FUNCTIONS
// ==========================================================================

/**
 * Generate the Salesforce OAuth authorization URL
 * This is the URL users are redirected to for login
 */
/**
 * Store for environment selection (state -> environment)
 */
const envStore = new Map<string, string>();

/**
 * Get the login URL based on environment
 */
function getLoginUrl(env: 'production' | 'sandbox'): string {
  return env === 'sandbox' 
    ? 'https://test.salesforce.com'
    : 'https://login.salesforce.com';
}

/**
 * Generate the Salesforce OAuth authorization URL with PKCE
 * Returns both the URL and the state (needed to retrieve code_verifier later)
 * 
 * @param env - 'production' or 'sandbox' - determines which Salesforce login URL to use
 */
export function getAuthorizationUrl(env: 'production' | 'sandbox' = 'production'): { url: string; state: string } {
  const loginUrl = getLoginUrl(env);
  const baseUrl = `${loginUrl}/services/oauth2/authorize`;
  
  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();
  
  // Store the code verifier and environment for later use during token exchange
  pkceStore.set(state, codeVerifier);
  envStore.set(state, env);
  
  // Clean up old entries after 10 minutes
  setTimeout(() => {
    pkceStore.delete(state);
    envStore.delete(state);
  }, 10 * 60 * 1000);
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.salesforce.clientId,
    redirect_uri: config.salesforce.callbackUrl,
    scope: 'api refresh_token',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  
  console.log('OAuth Authorization URL generated:', {
    environment: env,
    loginUrl: loginUrl,
    clientId: config.salesforce.clientId.substring(0, 20) + '...',
    redirectUri: config.salesforce.callbackUrl,
    state: state,
  });
  
  return { url: `${baseUrl}?${params.toString()}`, state };
}

/**
 * Get the stored environment for a given state
 */
export function getStoredEnvironment(state: string): 'production' | 'sandbox' {
  const env = envStore.get(state);
  if (env) {
    envStore.delete(state); // One-time use
  }
  return (env as 'production' | 'sandbox') || 'production';
}

/**
 * Get the stored code verifier for a given state
 */
export function getCodeVerifier(state: string): string | undefined {
  const verifier = pkceStore.get(state);
  if (verifier) {
    pkceStore.delete(state); // One-time use
  }
  return verifier;
}

/**
 * Exchange authorization code for access token (with PKCE)
 * Called after user authorizes the app
 * 
 * @param code - The authorization code from Salesforce
 * @param codeVerifier - The PKCE code verifier (required for PKCE flow)
 * @param env - The environment (production or sandbox) to determine token URL
 */
export async function exchangeCodeForToken(
  code: string, 
  codeVerifier?: string,
  env: 'production' | 'sandbox' = 'production'
): Promise<UserSession> {
  const loginUrl = getLoginUrl(env);
  const tokenUrl = `${loginUrl}/services/oauth2/token`;
  
  // Build params - include code_verifier for PKCE
  const params: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    client_id: config.salesforce.clientId,
    redirect_uri: config.salesforce.callbackUrl,
  };
  
  // Add client_secret (required for web server flow)
  if (config.salesforce.clientSecret) {
    params.client_secret = config.salesforce.clientSecret;
  }
  
  // Add code_verifier for PKCE
  if (codeVerifier) {
    params.code_verifier = codeVerifier;
  }
  
  console.log('Exchanging code for token...', {
    environment: env,
    tokenUrl: tokenUrl,
    hasCodeVerifier: !!codeVerifier,
    hasClientSecret: !!config.salesforce.clientSecret,
  });
  
  const response = await axios.post(tokenUrl, new URLSearchParams(params), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  
  const data = response.data;
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    instanceUrl: data.instance_url,
    userId: data.id.split('/').pop(),
    organizationId: data.id.split('/')[4],
    expiresAt: Date.now() + (data.expires_in || 7200) * 1000,
  };
}

/**
 * Refresh an expired access token
 * Uses the refresh token to get a new access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<UserSession> {
  const tokenUrl = `${config.salesforce.loginUrl}/services/oauth2/token`;
  
  const response = await axios.post(tokenUrl, null, {
    params: {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.salesforce.clientId,
      client_secret: config.salesforce.clientSecret,
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  
  const data = response.data;
  
  return {
    accessToken: data.access_token,
    refreshToken: refreshToken, // Refresh token stays the same
    instanceUrl: data.instance_url,
    userId: data.id.split('/').pop(),
    organizationId: data.id.split('/')[4],
    expiresAt: Date.now() + (data.expires_in || 7200) * 1000,
  };
}
