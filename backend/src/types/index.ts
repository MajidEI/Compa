/**
 * Type definitions for Salesforce Profile Comparison
 * These types define the normalized data model used throughout the application
 */

// ============================================================================
// OBJECT & FIELD PERMISSIONS
// ============================================================================

/**
 * CRUD permissions for a Salesforce object
 * Maps to ObjectPermissions metadata
 */
export interface ObjectPermission {
  read: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  viewAll: boolean;   // View All Data for this object
  modifyAll: boolean; // Modify All Data for this object
}

/**
 * Field-level security settings
 * Maps to FieldPermissions metadata
 */
export interface FieldPermission {
  read: boolean;
  edit: boolean;
}

/**
 * Complete object access including fields
 */
export interface ObjectAccess {
  permissions: ObjectPermission;
  fields: Record<string, FieldPermission>;
}

// ============================================================================
// NORMALIZED PROFILE DATA MODEL
// ============================================================================

/**
 * The main normalized profile structure
 * This is the canonical format used for comparison
 */
export interface NormalizedProfile {
  profileId: string;
  profileName: string;
  
  // Object and field permissions indexed by API name
  objects: Record<string, ObjectAccess>;
  
  // System-level permissions (e.g., "ViewSetup", "ModifyAllData")
  // Retrieved from the associated PermissionSet where IsOwnedByProfile = true
  systemPermissions: Record<string, boolean>;
  
  // Apex class access - list of class names with access
  apexClasses: string[];
  
  // Visualforce pages with access
  visualforcePages: string[];
  
  // Lightning pages/components with access
  lightningPages: string[];
  
  // Record types accessible by this profile
  // Format: "ObjectName.RecordTypeName"
  recordTypes: string[];
  
  // Tab visibility settings
  // Maps tab name to visibility: "DefaultOn", "DefaultOff", "Hidden"
  tabVisibilities: Record<string, string>;
  
  // App visibility settings
  // Maps app name to visibility and default status
  appVisibilities: Record<string, AppVisibility>;
  
  // User permissions specific to this profile
  userPermissions: Record<string, boolean>;
}

export interface AppVisibility {
  visible: boolean;
  default: boolean;
}

// ============================================================================
// COMPARISON RESULT TYPES
// ============================================================================

/**
 * Represents the type of difference found
 */
export type DiffType = 'added' | 'removed' | 'changed' | 'unchanged';

/**
 * A single difference item
 */
export interface DiffItem {
  path: string;           // Dot-notation path to the differing value
  category: string;       // Category: "objectPermission", "fieldPermission", "systemPermission", etc.
  objectName?: string;    // Object API name if applicable
  fieldName?: string;     // Field API name if applicable
  permissionName?: string; // Permission name if applicable
  values: Record<string, any>; // Profile ID -> value mapping
  diffType: DiffType;
}

/**
 * Aggregated comparison result between profiles
 */
export interface ComparisonResult {
  profiles: Array<{
    id: string;
    name: string;
  }>;
  timestamp: string;
  totalDifferences: number;
  differences: DiffItem[];
  
  // Categorized differences for easier navigation
  summary: {
    objectPermissions: number;
    fieldPermissions: number;
    systemPermissions: number;
    apexClasses: number;
    visualforcePages: number;
    lightningPages: number;
    recordTypes: number;
    tabVisibilities: number;
    appVisibilities: number;
  };
}

// ============================================================================
// SALESFORCE RAW API RESPONSE TYPES
// ============================================================================

/**
 * Raw Profile record from Salesforce
 */
export interface SalesforceProfile {
  Id: string;
  Name: string;
  UserLicenseId: string;
  UserType?: string;
  Description?: string;
}

/**
 * Raw ObjectPermissions from Salesforce
 */
export interface SalesforceObjectPermission {
  Id: string;
  ParentId: string;        // PermissionSet ID
  SobjectType: string;     // Object API name
  PermissionsCreate: boolean;
  PermissionsRead: boolean;
  PermissionsEdit: boolean;
  PermissionsDelete: boolean;
  PermissionsViewAllRecords: boolean;
  PermissionsModifyAllRecords: boolean;
}

/**
 * Raw FieldPermissions from Salesforce
 */
export interface SalesforceFieldPermission {
  Id: string;
  ParentId: string;        // PermissionSet ID
  SobjectType: string;
  Field: string;           // Format: "Object.Field"
  PermissionsRead: boolean;
  PermissionsEdit: boolean;
}

/**
 * Raw PermissionSet record (used to get system permissions)
 */
export interface SalesforcePermissionSet {
  Id: string;
  Name: string;
  ProfileId?: string;
  IsOwnedByProfile: boolean;
  // System permissions are dynamic fields starting with "Permissions"
  [key: string]: any;
}

/**
 * Permission Set info for listing
 */
export interface SalesforcePermissionSetInfo {
  Id: string;
  Name: string;
  Label: string;
  Description?: string;
  IsCustom: boolean;
  PermissionSetGroupId?: string;
  Type?: string;
  LicenseId?: string;
  HasActivationRequired: boolean;
}

/**
 * Permission Set Group
 */
export interface SalesforcePermissionSetGroup {
  Id: string;
  DeveloperName: string;
  MasterLabel: string;
  Description?: string;
  Status: string;
}

/**
 * Raw SetupEntityAccess for Apex/VF/Lightning access
 */
export interface SalesforceSetupEntityAccess {
  Id: string;
  ParentId: string;        // PermissionSet ID
  SetupEntityId: string;   // ID of the Apex class, VF page, etc.
  SetupEntityType: string; // "ApexClass", "ApexPage", "TabSet", etc.
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface ProfileListResponse {
  profiles: Array<{
    id: string;
    name: string;
  }>;
}

export interface CompareRequest {
  profileIds: string[];
}

export interface CompareResponse {
  comparison: ComparisonResult;
  profiles: NormalizedProfile[];
}

// ============================================================================
// SESSION & AUTH TYPES
// ============================================================================

export interface UserSession {
  accessToken: string;
  refreshToken?: string;
  instanceUrl: string;
  userId: string;
  organizationId: string;
  expiresAt?: number;
}

// Extend Express session
declare module 'express-session' {
  interface SessionData {
    salesforce?: UserSession;
  }
}
