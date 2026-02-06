/**
 * Frontend type definitions
 * These mirror the backend types for consistent data handling
 */

// ============================================================================
// AUTH TYPES
// ============================================================================

export interface AuthStatus {
  authenticated: boolean;
  expired?: boolean;
  instanceUrl?: string;
  userId?: string;
  organizationId?: string;
}

// ============================================================================
// PROFILE TYPES
// ============================================================================

export interface Profile {
  id: string;
  name: string;
}

export interface PermissionSet {
  id: string;
  name: string;
  label: string;
  description?: string;
  isCustom: boolean;
  type: string;
}

export interface ObjectPermission {
  read: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  viewAll: boolean;
  modifyAll: boolean;
}

export interface FieldPermission {
  read: boolean;
  edit: boolean;
}

export interface ObjectAccess {
  permissions: ObjectPermission;
  fields: Record<string, FieldPermission>;
}

export interface AppVisibility {
  visible: boolean;
  default: boolean;
}

export interface NormalizedProfile {
  profileId: string;
  profileName: string;
  objects: Record<string, ObjectAccess>;
  systemPermissions: Record<string, boolean>;
  apexClasses: string[];
  visualforcePages: string[];
  lightningPages: string[];
  recordTypes: string[];
  tabVisibilities: Record<string, string>;
  appVisibilities: Record<string, AppVisibility>;
  userPermissions: Record<string, boolean>;
}

// ============================================================================
// COMPARISON TYPES
// ============================================================================

export type DiffType = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DiffItem {
  path: string;
  category: string;
  objectName?: string;
  fieldName?: string;
  permissionName?: string;
  values: Record<string, any>;
  diffType: DiffType;
}

export interface ComparisonSummary {
  objectPermissions: number;
  fieldPermissions: number;
  systemPermissions: number;
  apexClasses: number;
  visualforcePages: number;
  lightningPages: number;
  recordTypes: number;
  tabVisibilities: number;
  appVisibilities: number;
}

export interface ComparisonResult {
  profiles: Array<{ id: string; name: string }>;
  timestamp: string;
  totalDifferences: number;
  differences: DiffItem[];
  summary: ComparisonSummary;
}

export interface CompareResponse {
  comparison: ComparisonResult;
  profiles: NormalizedProfile[];
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export type Category =
  | 'all'
  | 'objectPermission'
  | 'fieldPermission'
  | 'systemPermission'
  | 'apexClass'
  | 'visualforcePage'
  | 'lightningPage'
  | 'recordType'
  | 'tabVisibility'
  | 'appVisibility';

export interface FilterState {
  showOnlyDifferences: boolean;
  selectedCategories: Category[];
  searchQuery: string;
}

export interface TreeNode {
  id: string;
  label: string;
  type: 'category' | 'object' | 'field' | 'permission';
  children?: TreeNode[];
  diffItems?: DiffItem[];
  expanded?: boolean;
}
