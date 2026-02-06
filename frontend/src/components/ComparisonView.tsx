import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Filter, ChevronDown, ChevronRight, 
  Check, X, AlertTriangle, Minus, Download, FileSpreadsheet, FileJson
} from 'lucide-react';
import type { CompareResponse, DiffItem, DiffType, Category, FilterState } from '../types';
import ComparisonSummary from './ComparisonSummary';
import { exportCSV, exportJSON, downloadBlob, getErrorMessage } from '../services/api';

interface ComparisonViewProps {
  data: CompareResponse;
  onBack: () => void;
}

/**
 * ComparisonView Component
 * 
 * The main comparison UI that displays:
 * - Summary statistics
 * - Filters (show only differences, category filter, search)
 * - Tree-based side-by-side comparison
 * - Diff highlighting
 */
function ComparisonView({ data }: ComparisonViewProps) {
  const { comparison, profiles } = data;
  
  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    showOnlyDifferences: true,
    selectedCategories: ['all'],
    searchQuery: '',
  });
  
  // Expanded nodes in the tree
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // Export state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  
  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    }
    
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu]);
  
  /**
   * Filter and organize differences into a tree structure
   */
  const filteredDiffs = useMemo(() => {
    let items = comparison.differences;
    
    // Filter by "show only differences"
    if (filters.showOnlyDifferences) {
      items = items.filter(d => d.diffType !== 'unchanged');
    }
    
    // Filter by category
    if (!filters.selectedCategories.includes('all')) {
      items = items.filter(d => 
        filters.selectedCategories.includes(d.category as Category)
      );
    }
    
    // Filter by search query
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      items = items.filter(d => 
        d.path.toLowerCase().includes(query) ||
        d.objectName?.toLowerCase().includes(query) ||
        d.fieldName?.toLowerCase().includes(query) ||
        d.permissionName?.toLowerCase().includes(query)
      );
    }
    
    return items;
  }, [comparison.differences, filters]);
  
  /**
   * Organize diffs into categories for tree display
   */
  const categorizedDiffs = useMemo(() => {
    const categories: Record<string, DiffItem[]> = {
      objectPermission: [],
      fieldPermission: [],
      systemPermission: [],
      apexClass: [],
      visualforcePage: [],
      lightningPage: [],
      recordType: [],
      tabVisibility: [],
      appVisibility: [],
    };
    
    for (const diff of filteredDiffs) {
      if (categories[diff.category]) {
        categories[diff.category].push(diff);
      }
    }
    
    return categories;
  }, [filteredDiffs]);
  
  /**
   * Toggle a node's expanded state
   */
  function toggleNode(nodeId: string) {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }
  
  /**
   * Expand all nodes
   */
  function expandAll() {
    const allNodeIds = new Set<string>();
    Object.entries(categorizedDiffs).forEach(([category, diffs]) => {
      if (diffs.length > 0) {
        allNodeIds.add(category);
        // Add object nodes for object/field permissions
        const objects = new Set(diffs.map(d => d.objectName).filter(Boolean));
        objects.forEach(obj => allNodeIds.add(`${category}:${obj}`));
      }
    });
    setExpandedNodes(allNodeIds);
  }
  
  /**
   * Collapse all nodes
   */
  function collapseAll() {
    setExpandedNodes(new Set());
  }
  
  /**
   * Handle export to CSV
   */
  async function handleExport(format: 'differences' | 'detailed' | 'summary') {
    setIsExporting(true);
    setExportError(null);
    setShowExportMenu(false);
    
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const blob = await exportCSV(comparison, profiles, {
        format,
        includeUnchanged: !filters.showOnlyDifferences,
        categories: filters.selectedCategories.includes('all') 
          ? undefined 
          : filters.selectedCategories,
      });
      downloadBlob(blob, `profile-comparison-${format}-${timestamp}.csv`);
    } catch (err) {
      setExportError(getErrorMessage(err));
    } finally {
      setIsExporting(false);
    }
  }
  
  /**
   * Handle export to JSON
   */
  async function handleExportJSON() {
    setIsExporting(true);
    setExportError(null);
    setShowExportMenu(false);
    
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const blob = await exportJSON(comparison, profiles);
      downloadBlob(blob, `profile-comparison-${timestamp}.json`);
    } catch (err) {
      setExportError(getErrorMessage(err));
    } finally {
      setIsExporting(false);
    }
  }
  
  const categoryLabels: Record<string, string> = {
    objectPermission: 'Object Permissions',
    fieldPermission: 'Field Permissions',
    systemPermission: 'System Permissions',
    apexClass: 'Apex Classes',
    visualforcePage: 'Visualforce Pages',
    lightningPage: 'Lightning Pages',
    recordType: 'Record Types',
    tabVisibility: 'Tab Visibility',
    appVisibility: 'App Visibility',
  };
  
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <ComparisonSummary 
        comparison={comparison} 
        profileCount={profiles.length} 
      />
      
      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 
                               w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search objects, fields, permissions..."
              value={filters.searchQuery}
              onChange={(e) => setFilters(f => ({ ...f, searchQuery: e.target.value }))}
              className="input pl-9"
            />
          </div>
          
          {/* Show only differences toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.showOnlyDifferences}
              onChange={(e) => setFilters(f => ({ 
                ...f, 
                showOnlyDifferences: e.target.checked 
              }))}
              className="checkbox"
            />
            <span className="text-sm text-gray-700">
              Show only differences
            </span>
          </label>
          
          {/* Category filter dropdown */}
          <div className="relative">
            <select
              value={filters.selectedCategories[0]}
              onChange={(e) => setFilters(f => ({ 
                ...f, 
                selectedCategories: [e.target.value as Category] 
              }))}
              className="input pr-8 appearance-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 
                               w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          
          {/* Expand/Collapse buttons */}
          <div className="flex gap-2">
            <button onClick={expandAll} className="btn-secondary text-sm">
              Expand All
            </button>
            <button onClick={collapseAll} className="btn-secondary text-sm">
              Collapse All
            </button>
          </div>
          
          {/* Export dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Exporting...' : 'Export'}
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg 
                              border border-gray-200 py-2 z-50">
                <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                  CSV Exports
                </div>
                <button
                  onClick={() => handleExport('differences')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 
                             flex items-center gap-3"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="font-medium">Differences Only</p>
                    <p className="text-xs text-gray-500">Export only changed items</p>
                  </div>
                </button>
                <button
                  onClick={() => handleExport('detailed')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 
                             flex items-center gap-3"
                >
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="font-medium">Detailed Export</p>
                    <p className="text-xs text-gray-500">All permissions for all profiles</p>
                  </div>
                </button>
                <button
                  onClick={() => handleExport('summary')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 
                             flex items-center gap-3"
                >
                  <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                  <div>
                    <p className="font-medium">Summary</p>
                    <p className="text-xs text-gray-500">Statistics overview</p>
                  </div>
                </button>
                
                <div className="border-t border-gray-100 my-2" />
                <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                  Other Formats
                </div>
                <button
                  onClick={handleExportJSON}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 
                             flex items-center gap-3"
                >
                  <FileJson className="w-4 h-4 text-orange-600" />
                  <div>
                    <p className="font-medium">JSON Export</p>
                    <p className="text-xs text-gray-500">Full data for developers</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Results count */}
        <div className="mt-3 text-sm text-gray-600">
          Showing {filteredDiffs.length} of {comparison.differences.length} items
          {filters.showOnlyDifferences && (
            <span className="text-sf-blue-600 ml-2">
              ({comparison.totalDifferences} differences)
            </span>
          )}
        </div>
        
        {/* Export error */}
        {exportError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg 
                          flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {exportError}
            <button 
              onClick={() => setExportError(null)} 
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      
      {/* Comparison table header */}
      <div className="card overflow-hidden">
        {/* Profile column headers */}
        <div className="bg-gray-50 border-b border-gray-200 p-4">
          <div className="grid gap-4" style={{ 
            gridTemplateColumns: `minmax(250px, 1fr) repeat(${profiles.length}, minmax(120px, 1fr))` 
          }}>
            <div className="font-medium text-gray-700">Permission</div>
            {comparison.profiles.map(profile => (
              <div key={profile.id} className="font-medium text-gray-700 text-center truncate">
                {profile.name}
              </div>
            ))}
          </div>
        </div>
        
        {/* Comparison tree */}
        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto scrollbar-thin">
          {Object.entries(categorizedDiffs).map(([category, diffs]) => {
            if (diffs.length === 0) return null;
            
            return (
              <CategorySection
                key={category}
                category={category}
                label={categoryLabels[category] || category}
                diffs={diffs}
                profileIds={comparison.profiles.map(p => p.id)}
                expandedNodes={expandedNodes}
                onToggle={toggleNode}
              />
            );
          })}
          
          {filteredDiffs.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              {filters.showOnlyDifferences 
                ? 'No differences found between these profiles!'
                : 'No matching items found'
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Category section in the tree
 */
interface CategorySectionProps {
  category: string;
  label: string;
  diffs: DiffItem[];
  profileIds: string[];
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
}

function CategorySection({ 
  category, 
  label, 
  diffs, 
  profileIds, 
  expandedNodes, 
  onToggle 
}: CategorySectionProps) {
  const isExpanded = expandedNodes.has(category);
  const diffCount = diffs.filter(d => d.diffType !== 'unchanged').length;
  
  // Group by object for object/field permissions
  const isObjectBased = ['objectPermission', 'fieldPermission'].includes(category);
  
  const groupedByObject = useMemo(() => {
    if (!isObjectBased) return null;
    
    const groups: Record<string, DiffItem[]> = {};
    for (const diff of diffs) {
      const key = diff.objectName || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(diff);
    }
    return groups;
  }, [diffs, isObjectBased]);
  
  return (
    <div>
      {/* Category header */}
      <button
        onClick={() => onToggle(category)}
        className="w-full px-4 py-3 flex items-center gap-2 hover:bg-gray-50 
                   transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
        <span className="font-medium text-gray-900">{label}</span>
        <span className="text-sm text-gray-500">
          ({diffs.length} items, {diffCount} differences)
        </span>
      </button>
      
      {/* Category content */}
      {isExpanded && (
        <div className="pl-6 border-l-2 border-gray-100 ml-4">
          {isObjectBased && groupedByObject ? (
            // Object-grouped view
            Object.entries(groupedByObject).map(([objectName, objectDiffs]) => (
              <ObjectSection
                key={`${category}:${objectName}`}
                nodeId={`${category}:${objectName}`}
                objectName={objectName}
                diffs={objectDiffs}
                profileIds={profileIds}
                expandedNodes={expandedNodes}
                onToggle={onToggle}
              />
            ))
          ) : (
            // Flat list view
            diffs.map((diff, idx) => (
              <DiffRow
                key={`${diff.path}-${idx}`}
                diff={diff}
                profileIds={profileIds}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Object section for grouping field permissions
 */
interface ObjectSectionProps {
  nodeId: string;
  objectName: string;
  diffs: DiffItem[];
  profileIds: string[];
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
}

function ObjectSection({ 
  nodeId, 
  objectName, 
  diffs, 
  profileIds, 
  expandedNodes, 
  onToggle 
}: ObjectSectionProps) {
  const isExpanded = expandedNodes.has(nodeId);
  const diffCount = diffs.filter(d => d.diffType !== 'unchanged').length;
  
  return (
    <div>
      <button
        onClick={() => onToggle(nodeId)}
        className="w-full px-4 py-2 flex items-center gap-2 hover:bg-gray-50 
                   transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-gray-400" />
        ) : (
          <ChevronRight className="w-3 h-3 text-gray-400" />
        )}
        <span className="font-medium text-gray-800">{objectName}</span>
        {diffCount > 0 && (
          <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
            {diffCount} diff
          </span>
        )}
      </button>
      
      {isExpanded && (
        <div className="pl-6 border-l-2 border-gray-100 ml-4">
          {diffs.map((diff, idx) => (
            <DiffRow
              key={`${diff.path}-${idx}`}
              diff={diff}
              profileIds={profileIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Individual diff row
 */
interface DiffRowProps {
  diff: DiffItem;
  profileIds: string[];
}

function DiffRow({ diff, profileIds }: DiffRowProps) {
  // Build the display label
  const label = diff.fieldName 
    ? `${diff.fieldName}.${diff.permissionName}`
    : diff.permissionName || diff.path.split('.').pop() || diff.path;
  
  // Get the CSS class for diff highlighting
  const rowClass = getDiffRowClass(diff.diffType);
  
  return (
    <div className={`grid gap-4 px-4 py-2 items-center ${rowClass}`}
         style={{ 
           gridTemplateColumns: `minmax(250px, 1fr) repeat(${profileIds.length}, minmax(120px, 1fr))` 
         }}>
      {/* Permission label */}
      <div className="text-sm text-gray-700 truncate" title={diff.path}>
        {label}
      </div>
      
      {/* Value columns */}
      {profileIds.map(profileId => (
        <div key={profileId} className="flex justify-center">
          <ValueDisplay value={diff.values[profileId]} />
        </div>
      ))}
    </div>
  );
}

/**
 * Display a permission value with appropriate styling
 */
function ValueDisplay({ value }: { value: any }) {
  if (typeof value === 'boolean') {
    return value ? (
      <div className="flex items-center gap-1 text-green-600">
        <Check className="w-4 h-4" />
        <span className="text-xs">Yes</span>
      </div>
    ) : (
      <div className="flex items-center gap-1 text-gray-400">
        <X className="w-4 h-4" />
        <span className="text-xs">No</span>
      </div>
    );
  }
  
  if (typeof value === 'string') {
    return (
      <span className="text-sm text-gray-700 truncate max-w-[100px]" title={value}>
        {value}
      </span>
    );
  }
  
  return (
    <div className="text-gray-400">
      <Minus className="w-4 h-4" />
    </div>
  );
}

/**
 * Get the CSS class for a diff row based on diff type
 */
function getDiffRowClass(diffType: DiffType): string {
  switch (diffType) {
    case 'added':
      return 'diff-added';
    case 'removed':
      return 'diff-removed';
    case 'changed':
      return 'diff-changed';
    default:
      return 'hover:bg-gray-50';
  }
}

export default ComparisonView;
