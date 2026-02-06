import {
  NormalizedProfile,
  ComparisonResult,
  DiffItem,
  DiffType,
  ObjectAccess,
  ObjectPermission,
  FieldPermission,
} from '../types';

/**
 * DiffEngine compares normalized profiles and produces a detailed diff report
 * 
 * The engine compares:
 * - Object permissions (CRUD, View All, Modify All)
 * - Field permissions (Read, Edit)
 * - System/User permissions
 * - Apex class access
 * - Visualforce page access
 * - Lightning page access
 * - Record type access
 * - Tab visibility
 * - App visibility
 * 
 * The diff output includes:
 * - Path to the differing value (for UI navigation)
 * - Category (for filtering)
 * - Values for each profile (for side-by-side display)
 * - Diff type: added, removed, changed, unchanged
 */
export class DiffEngine {
  /**
   * Compare multiple profiles and produce a comprehensive diff report
   * 
   * @param profiles - Array of normalized profiles to compare
   * @param includeUnchanged - If true, includes items that are identical across profiles
   * @returns ComparisonResult with all differences
   */
  compare(profiles: NormalizedProfile[], includeUnchanged = false): ComparisonResult {
    const differences: DiffItem[] = [];
    
    // Summary counters
    const summary = {
      objectPermissions: 0,
      fieldPermissions: 0,
      systemPermissions: 0,
      apexClasses: 0,
      visualforcePages: 0,
      lightningPages: 0,
      recordTypes: 0,
      tabVisibilities: 0,
      appVisibilities: 0,
    };
    
    // Compare each category
    this.compareObjectPermissions(profiles, differences, summary, includeUnchanged);
    this.compareFieldPermissions(profiles, differences, summary, includeUnchanged);
    this.compareSystemPermissions(profiles, differences, summary, includeUnchanged);
    this.compareArrayProperty(profiles, 'apexClasses', 'apexClass', differences, summary, includeUnchanged);
    this.compareArrayProperty(profiles, 'visualforcePages', 'visualforcePage', differences, summary, includeUnchanged);
    this.compareArrayProperty(profiles, 'lightningPages', 'lightningPage', differences, summary, includeUnchanged);
    this.compareArrayProperty(profiles, 'recordTypes', 'recordType', differences, summary, includeUnchanged);
    this.compareTabVisibilities(profiles, differences, summary, includeUnchanged);
    this.compareAppVisibilities(profiles, differences, summary, includeUnchanged);
    
    return {
      profiles: profiles.map(p => ({ id: p.profileId, name: p.profileName })),
      timestamp: new Date().toISOString(),
      totalDifferences: differences.filter(d => d.diffType !== 'unchanged').length,
      differences,
      summary,
    };
  }

  /**
   * Compare object-level permissions across profiles
   */
  private compareObjectPermissions(
    profiles: NormalizedProfile[],
    differences: DiffItem[],
    summary: { objectPermissions: number },
    includeUnchanged: boolean
  ): void {
    // Collect all unique object names across all profiles
    const allObjectNames = new Set<string>();
    for (const profile of profiles) {
      for (const objectName of Object.keys(profile.objects)) {
        allObjectNames.add(objectName);
      }
    }
    
    // Compare each object's permissions
    for (const objectName of allObjectNames) {
      const permissionTypes: (keyof ObjectPermission)[] = [
        'read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'
      ];
      
      for (const permType of permissionTypes) {
        const values: Record<string, boolean> = {};
        
        for (const profile of profiles) {
          const objAccess = profile.objects[objectName];
          values[profile.profileId] = objAccess?.permissions?.[permType] ?? false;
        }
        
        const diffType = this.determineDiffType(values);
        
        if (diffType !== 'unchanged' || includeUnchanged) {
          if (diffType !== 'unchanged') {
            summary.objectPermissions++;
          }
          
          differences.push({
            path: `objects.${objectName}.permissions.${permType}`,
            category: 'objectPermission',
            objectName,
            permissionName: permType,
            values,
            diffType,
          });
        }
      }
    }
  }

  /**
   * Compare field-level permissions across profiles
   */
  private compareFieldPermissions(
    profiles: NormalizedProfile[],
    differences: DiffItem[],
    summary: { fieldPermissions: number },
    includeUnchanged: boolean
  ): void {
    // Collect all unique object.field combinations
    const allFields = new Map<string, Set<string>>(); // objectName -> Set<fieldName>
    
    for (const profile of profiles) {
      for (const [objectName, objAccess] of Object.entries(profile.objects)) {
        if (!allFields.has(objectName)) {
          allFields.set(objectName, new Set());
        }
        for (const fieldName of Object.keys(objAccess.fields)) {
          allFields.get(objectName)!.add(fieldName);
        }
      }
    }
    
    // Compare each field's permissions
    for (const [objectName, fieldNames] of allFields) {
      for (const fieldName of fieldNames) {
        const permissionTypes: (keyof FieldPermission)[] = ['read', 'edit'];
        
        for (const permType of permissionTypes) {
          const values: Record<string, boolean> = {};
          
          for (const profile of profiles) {
            const fieldPerm = profile.objects[objectName]?.fields?.[fieldName];
            values[profile.profileId] = fieldPerm?.[permType] ?? false;
          }
          
          const diffType = this.determineDiffType(values);
          
          if (diffType !== 'unchanged' || includeUnchanged) {
            if (diffType !== 'unchanged') {
              summary.fieldPermissions++;
            }
            
            differences.push({
              path: `objects.${objectName}.fields.${fieldName}.${permType}`,
              category: 'fieldPermission',
              objectName,
              fieldName,
              permissionName: permType,
              values,
              diffType,
            });
          }
        }
      }
    }
  }

  /**
   * Compare system/user permissions across profiles
   */
  private compareSystemPermissions(
    profiles: NormalizedProfile[],
    differences: DiffItem[],
    summary: { systemPermissions: number },
    includeUnchanged: boolean
  ): void {
    // Collect all unique permission names
    const allPermissions = new Set<string>();
    for (const profile of profiles) {
      for (const permName of Object.keys(profile.systemPermissions)) {
        allPermissions.add(permName);
      }
    }
    
    // Compare each permission
    for (const permName of allPermissions) {
      const values: Record<string, boolean> = {};
      
      for (const profile of profiles) {
        values[profile.profileId] = profile.systemPermissions[permName] ?? false;
      }
      
      const diffType = this.determineDiffType(values);
      
      if (diffType !== 'unchanged' || includeUnchanged) {
        if (diffType !== 'unchanged') {
          summary.systemPermissions++;
        }
        
        differences.push({
          path: `systemPermissions.${permName}`,
          category: 'systemPermission',
          permissionName: permName,
          values,
          diffType,
        });
      }
    }
  }

  /**
   * Compare array properties (apexClasses, visualforcePages, etc.)
   * These are "has access" / "no access" comparisons
   */
  private compareArrayProperty(
    profiles: NormalizedProfile[],
    propertyName: keyof NormalizedProfile,
    category: string,
    differences: DiffItem[],
    summary: Record<string, number>,
    includeUnchanged: boolean
  ): void {
    // Map category to summary key (handle irregular plurals)
    const categoryToSummaryKey: Record<string, string> = {
      'apexClass': 'apexClasses',
      'visualforcePage': 'visualforcePages',
      'lightningPage': 'lightningPages',
      'recordType': 'recordTypes',
    };
    const summaryKey = categoryToSummaryKey[category] || `${category}s`;
    
    // Collect all unique items across profiles
    const allItems = new Set<string>();
    for (const profile of profiles) {
      const items = profile[propertyName] as string[];
      if (Array.isArray(items)) {
        for (const item of items) {
          allItems.add(item);
        }
      }
    }
    
    // Compare each item
    for (const item of allItems) {
      const values: Record<string, boolean> = {};
      
      for (const profile of profiles) {
        const items = profile[propertyName] as string[];
        values[profile.profileId] = Array.isArray(items) && items.includes(item);
      }
      
      const diffType = this.determineDiffType(values);
      
      if (diffType !== 'unchanged' || includeUnchanged) {
        if (diffType !== 'unchanged') {
          if (summaryKey in summary) {
            (summary as any)[summaryKey]++;
          }
        }
        
        differences.push({
          path: `${propertyName}.${item}`,
          category,
          permissionName: item,
          values,
          diffType,
        });
      }
    }
  }

  /**
   * Compare tab visibility settings
   */
  private compareTabVisibilities(
    profiles: NormalizedProfile[],
    differences: DiffItem[],
    summary: { tabVisibilities: number },
    includeUnchanged: boolean
  ): void {
    // Collect all unique tab names
    const allTabs = new Set<string>();
    for (const profile of profiles) {
      for (const tabName of Object.keys(profile.tabVisibilities)) {
        allTabs.add(tabName);
      }
    }
    
    // Compare each tab
    for (const tabName of allTabs) {
      const values: Record<string, string> = {};
      
      for (const profile of profiles) {
        values[profile.profileId] = profile.tabVisibilities[tabName] ?? 'Hidden';
      }
      
      const diffType = this.determineDiffTypeForStrings(values);
      
      if (diffType !== 'unchanged' || includeUnchanged) {
        if (diffType !== 'unchanged') {
          summary.tabVisibilities++;
        }
        
        differences.push({
          path: `tabVisibilities.${tabName}`,
          category: 'tabVisibility',
          permissionName: tabName,
          values,
          diffType,
        });
      }
    }
  }

  /**
   * Compare app visibility settings
   */
  private compareAppVisibilities(
    profiles: NormalizedProfile[],
    differences: DiffItem[],
    summary: { appVisibilities: number },
    includeUnchanged: boolean
  ): void {
    // Collect all unique app names
    const allApps = new Set<string>();
    for (const profile of profiles) {
      for (const appName of Object.keys(profile.appVisibilities)) {
        allApps.add(appName);
      }
    }
    
    // Compare each app's visibility
    for (const appName of allApps) {
      // Compare 'visible' property
      const visibleValues: Record<string, boolean> = {};
      const defaultValues: Record<string, boolean> = {};
      
      for (const profile of profiles) {
        const appVis = profile.appVisibilities[appName];
        visibleValues[profile.profileId] = appVis?.visible ?? false;
        defaultValues[profile.profileId] = appVis?.default ?? false;
      }
      
      const visibleDiffType = this.determineDiffType(visibleValues);
      const defaultDiffType = this.determineDiffType(defaultValues);
      
      if (visibleDiffType !== 'unchanged' || includeUnchanged) {
        if (visibleDiffType !== 'unchanged') {
          summary.appVisibilities++;
        }
        
        differences.push({
          path: `appVisibilities.${appName}.visible`,
          category: 'appVisibility',
          permissionName: `${appName} (Visible)`,
          values: visibleValues,
          diffType: visibleDiffType,
        });
      }
      
      if (defaultDiffType !== 'unchanged' || includeUnchanged) {
        if (defaultDiffType !== 'unchanged') {
          summary.appVisibilities++;
        }
        
        differences.push({
          path: `appVisibilities.${appName}.default`,
          category: 'appVisibility',
          permissionName: `${appName} (Default)`,
          values: defaultValues,
          diffType: defaultDiffType,
        });
      }
    }
  }

  /**
   * Determine the diff type for boolean values
   * 
   * Logic:
   * - If all values are the same: 'unchanged'
   * - If some are true and some are false: 'changed'
   * - If all are true: examine if this is an "added" scenario
   * - If all are false: examine if this is a "removed" scenario
   */
  private determineDiffType(values: Record<string, boolean>): DiffType {
    const boolValues = Object.values(values);
    const uniqueValues = new Set(boolValues);
    
    if (uniqueValues.size === 1) {
      return 'unchanged';
    }
    
    // At least two profiles have different values
    // Check if it's mostly true (added) or mostly false (removed) or mixed (changed)
    const trueCount = boolValues.filter(v => v === true).length;
    const falseCount = boolValues.filter(v => v === false).length;
    
    if (trueCount === 1 && falseCount > 0) {
      return 'added'; // One profile has it, others don't
    } else if (falseCount === 1 && trueCount > 0) {
      return 'removed'; // One profile lacks it, others have it
    }
    
    return 'changed';
  }

  /**
   * Determine diff type for string values (like tab visibility)
   */
  private determineDiffTypeForStrings(values: Record<string, string>): DiffType {
    const strValues = Object.values(values);
    const uniqueValues = new Set(strValues);
    
    if (uniqueValues.size === 1) {
      return 'unchanged';
    }
    
    return 'changed';
  }
}

/**
 * Utility function to create a diff engine instance
 */
export function createDiffEngine(): DiffEngine {
  return new DiffEngine();
}
