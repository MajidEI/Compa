/**
 * Export Service - Generates CSV and other export formats for comparison data
 */

import { ComparisonResult, NormalizedProfile, DiffItem } from '../types';

export interface ExportOptions {
  format: 'csv' | 'json';
  includeUnchanged: boolean;
  categories?: string[];
}

/**
 * Generate CSV export of comparison results
 */
export function generateCSV(
  comparison: ComparisonResult,
  profiles: NormalizedProfile[],
  options: ExportOptions
): string {
  const lines: string[] = [];
  
  // Filter differences based on options
  let diffs = comparison.differences;
  if (!options.includeUnchanged) {
    diffs = diffs.filter(d => d.diffType !== 'unchanged');
  }
  if (options.categories && options.categories.length > 0 && !options.categories.includes('all')) {
    diffs = diffs.filter(d => options.categories!.includes(d.category));
  }
  
  // Build header row
  const profileNames = comparison.profiles.map(p => p.name);
  const headers = ['Category', 'Object', 'Field/Permission', 'Diff Type', ...profileNames];
  lines.push(escapeCSVRow(headers));
  
  // Build data rows
  for (const diff of diffs) {
    const row = [
      formatCategory(diff.category),
      diff.objectName || '',
      diff.fieldName ? `${diff.fieldName}.${diff.permissionName}` : (diff.permissionName || ''),
      diff.diffType,
      ...comparison.profiles.map(p => formatValue(diff.values[p.id])),
    ];
    lines.push(escapeCSVRow(row));
  }
  
  return lines.join('\n');
}

/**
 * Generate detailed CSV with all profile data (not just differences)
 */
export function generateDetailedCSV(
  profiles: NormalizedProfile[]
): string {
  const lines: string[] = [];
  
  // Header
  const profileNames = profiles.map(p => p.profileName);
  lines.push(escapeCSVRow(['Type', 'Category', 'Object', 'Field/Permission', ...profileNames]));
  
  // Collect all unique items across all profiles
  
  // 1. Object Permissions
  const allObjects = new Set<string>();
  profiles.forEach(p => Object.keys(p.objects).forEach(o => allObjects.add(o)));
  
  for (const objectName of Array.from(allObjects).sort()) {
    const permTypes = ['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'] as const;
    for (const permType of permTypes) {
      const values = profiles.map(p => {
        const obj = p.objects[objectName];
        return obj?.permissions?.[permType] ?? false;
      });
      lines.push(escapeCSVRow([
        'Object Permission',
        objectName,
        '',
        permType,
        ...values.map(v => v ? 'Yes' : 'No'),
      ]));
    }
    
    // Field permissions for this object
    const allFields = new Set<string>();
    profiles.forEach(p => {
      const obj = p.objects[objectName];
      if (obj?.fields) {
        Object.keys(obj.fields).forEach(f => allFields.add(f));
      }
    });
    
    for (const fieldName of Array.from(allFields).sort()) {
      for (const permType of ['read', 'edit'] as const) {
        const values = profiles.map(p => {
          const field = p.objects[objectName]?.fields?.[fieldName];
          return field?.[permType] ?? false;
        });
        lines.push(escapeCSVRow([
          'Field Permission',
          objectName,
          fieldName,
          permType,
          ...values.map(v => v ? 'Yes' : 'No'),
        ]));
      }
    }
  }
  
  // 2. System Permissions
  const allSystemPerms = new Set<string>();
  profiles.forEach(p => Object.keys(p.systemPermissions).forEach(s => allSystemPerms.add(s)));
  
  for (const permName of Array.from(allSystemPerms).sort()) {
    const values = profiles.map(p => p.systemPermissions[permName] ?? false);
    lines.push(escapeCSVRow([
      'System Permission',
      '',
      '',
      permName,
      ...values.map(v => v ? 'Yes' : 'No'),
    ]));
  }
  
  // 3. Apex Classes
  const allApexClasses = new Set<string>();
  profiles.forEach(p => p.apexClasses.forEach(c => allApexClasses.add(c)));
  
  for (const className of Array.from(allApexClasses).sort()) {
    const values = profiles.map(p => p.apexClasses.includes(className));
    lines.push(escapeCSVRow([
      'Apex Class',
      '',
      '',
      className,
      ...values.map(v => v ? 'Yes' : 'No'),
    ]));
  }
  
  // 4. Visualforce Pages
  const allVfPages = new Set<string>();
  profiles.forEach(p => p.visualforcePages.forEach(v => allVfPages.add(v)));
  
  for (const pageName of Array.from(allVfPages).sort()) {
    const values = profiles.map(p => p.visualforcePages.includes(pageName));
    lines.push(escapeCSVRow([
      'Visualforce Page',
      '',
      '',
      pageName,
      ...values.map(v => v ? 'Yes' : 'No'),
    ]));
  }
  
  // 5. Lightning Pages
  const allLightningPages = new Set<string>();
  profiles.forEach(p => p.lightningPages.forEach(l => allLightningPages.add(l)));
  
  for (const pageName of Array.from(allLightningPages).sort()) {
    const values = profiles.map(p => p.lightningPages.includes(pageName));
    lines.push(escapeCSVRow([
      'Lightning Page',
      '',
      '',
      pageName,
      ...values.map(v => v ? 'Yes' : 'No'),
    ]));
  }
  
  // 6. Record Types
  const allRecordTypes = new Set<string>();
  profiles.forEach(p => p.recordTypes.forEach(r => allRecordTypes.add(r)));
  
  for (const rtName of Array.from(allRecordTypes).sort()) {
    const values = profiles.map(p => p.recordTypes.includes(rtName));
    lines.push(escapeCSVRow([
      'Record Type',
      '',
      '',
      rtName,
      ...values.map(v => v ? 'Yes' : 'No'),
    ]));
  }
  
  // 7. Tab Visibilities
  const allTabs = new Set<string>();
  profiles.forEach(p => Object.keys(p.tabVisibilities).forEach(t => allTabs.add(t)));
  
  for (const tabName of Array.from(allTabs).sort()) {
    const values = profiles.map(p => p.tabVisibilities[tabName] || 'Hidden');
    lines.push(escapeCSVRow([
      'Tab Visibility',
      '',
      '',
      tabName,
      ...values,
    ]));
  }
  
  // 8. App Visibilities
  const allApps = new Set<string>();
  profiles.forEach(p => Object.keys(p.appVisibilities).forEach(a => allApps.add(a)));
  
  for (const appName of Array.from(allApps).sort()) {
    const visibleValues = profiles.map(p => p.appVisibilities[appName]?.visible ?? false);
    const defaultValues = profiles.map(p => p.appVisibilities[appName]?.default ?? false);
    
    lines.push(escapeCSVRow([
      'App Visibility',
      '',
      '',
      `${appName} (Visible)`,
      ...visibleValues.map(v => v ? 'Yes' : 'No'),
    ]));
    lines.push(escapeCSVRow([
      'App Visibility',
      '',
      '',
      `${appName} (Default)`,
      ...defaultValues.map(v => v ? 'Yes' : 'No'),
    ]));
  }
  
  return lines.join('\n');
}

/**
 * Generate summary CSV with just the statistics
 */
export function generateSummaryCSV(comparison: ComparisonResult): string {
  const lines: string[] = [];
  
  lines.push(escapeCSVRow(['Profile Comparison Summary']));
  lines.push(escapeCSVRow(['Generated', new Date().toISOString()]));
  lines.push(escapeCSVRow(['Profiles Compared', comparison.profiles.map(p => p.name).join(', ')]));
  lines.push(escapeCSVRow(['']));
  lines.push(escapeCSVRow(['Category', 'Differences']));
  lines.push(escapeCSVRow(['Object Permissions', comparison.summary.objectPermissions.toString()]));
  lines.push(escapeCSVRow(['Field Permissions', comparison.summary.fieldPermissions.toString()]));
  lines.push(escapeCSVRow(['System Permissions', comparison.summary.systemPermissions.toString()]));
  lines.push(escapeCSVRow(['Apex Classes', comparison.summary.apexClasses.toString()]));
  lines.push(escapeCSVRow(['Visualforce Pages', comparison.summary.visualforcePages.toString()]));
  lines.push(escapeCSVRow(['Lightning Pages', comparison.summary.lightningPages.toString()]));
  lines.push(escapeCSVRow(['Record Types', comparison.summary.recordTypes.toString()]));
  lines.push(escapeCSVRow(['Tab Visibilities', comparison.summary.tabVisibilities.toString()]));
  lines.push(escapeCSVRow(['App Visibilities', comparison.summary.appVisibilities.toString()]));
  lines.push(escapeCSVRow(['']));
  lines.push(escapeCSVRow(['Total Differences', comparison.totalDifferences.toString()]));
  
  return lines.join('\n');
}

/**
 * Escape a row for CSV format
 */
function escapeCSVRow(values: string[]): string {
  return values.map(v => {
    const str = String(v);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(',');
}

/**
 * Format a value for display
 */
function formatValue(value: any): string {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

/**
 * Format category name for display
 */
function formatCategory(category: string): string {
  const categoryNames: Record<string, string> = {
    objectPermission: 'Object Permission',
    fieldPermission: 'Field Permission',
    systemPermission: 'System Permission',
    apexClass: 'Apex Class',
    visualforcePage: 'Visualforce Page',
    lightningPage: 'Lightning Page',
    recordType: 'Record Type',
    tabVisibility: 'Tab Visibility',
    appVisibility: 'App Visibility',
  };
  return categoryNames[category] || category;
}
