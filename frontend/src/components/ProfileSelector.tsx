import { useState, useEffect, useMemo } from 'react';
import { Search, Check, AlertCircle, ArrowRight, Users, Shield } from 'lucide-react';
import { getProfiles, getPermissionSets, compareItems, getErrorMessage } from '../services/api';
import type { Profile, PermissionSet, CompareResponse } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface ProfileSelectorProps {
  onComparisonComplete: (data: CompareResponse) => void;
}

type ViewMode = 'profiles' | 'permissionSets' | 'both';

/**
 * Profile Selector Component
 * 
 * Allows users to:
 * 1. View all profiles and permission sets in the connected org
 * 2. Search/filter profiles and permission sets
 * 3. Select 2+ items to compare
 * 4. Initiate the comparison
 */
function ProfileSelector({ onComparisonComplete }: ProfileSelectorProps) {
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('both');
  
  // Data state
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [permissionSets, setPermissionSets] = useState<PermissionSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selection state
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [selectedPermSetIds, setSelectedPermSetIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
  // Comparison state
  const [isComparing, setIsComparing] = useState(false);
  
  /**
   * Fetch profiles and permission sets on component mount
   */
  useEffect(() => {
    fetchData();
  }, []);
  
  /**
   * Fetch all profiles and permission sets from the connected org
   */
  async function fetchData() {
    setIsLoading(true);
    setError(null);
    
    try {
      const [profileData, permSetData] = await Promise.all([
        getProfiles(),
        getPermissionSets(),
      ]);
      setProfiles(profileData);
      setPermissionSets(permSetData);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }
  
  /**
   * Filter profiles based on search query
   */
  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) {
      return profiles;
    }
    
    const query = searchQuery.toLowerCase();
    return profiles.filter(p => 
      p.name.toLowerCase().includes(query)
    );
  }, [profiles, searchQuery]);
  
  /**
   * Filter permission sets based on search query
   */
  const filteredPermissionSets = useMemo(() => {
    if (!searchQuery.trim()) {
      return permissionSets;
    }
    
    const query = searchQuery.toLowerCase();
    return permissionSets.filter(ps => 
      ps.label.toLowerCase().includes(query) ||
      ps.name.toLowerCase().includes(query)
    );
  }, [permissionSets, searchQuery]);
  
  /**
   * Toggle profile selection
   */
  function toggleProfileSelection(profileId: string) {
    setSelectedProfileIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(profileId)) {
        newSet.delete(profileId);
      } else {
        newSet.add(profileId);
      }
      return newSet;
    });
  }
  
  /**
   * Toggle permission set selection
   */
  function togglePermSetSelection(permSetId: string) {
    setSelectedPermSetIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(permSetId)) {
        newSet.delete(permSetId);
      } else {
        newSet.add(permSetId);
      }
      return newSet;
    });
  }
  
  /**
   * Select all visible items
   */
  function selectAll() {
    if (viewMode === 'profiles' || viewMode === 'both') {
      setSelectedProfileIds(new Set(filteredProfiles.map(p => p.id)));
    }
    if (viewMode === 'permissionSets' || viewMode === 'both') {
      setSelectedPermSetIds(new Set(filteredPermissionSets.map(ps => ps.id)));
    }
  }
  
  /**
   * Clear all selections
   */
  function clearSelection() {
    setSelectedProfileIds(new Set());
    setSelectedPermSetIds(new Set());
  }
  
  // Total selected count
  const totalSelected = selectedProfileIds.size + selectedPermSetIds.size;
  
  /**
   * Start the comparison
   */
  async function handleCompare() {
    if (totalSelected < 2) return;
    
    setIsComparing(true);
    setError(null);
    
    try {
      const data = await compareItems(
        Array.from(selectedProfileIds),
        Array.from(selectedPermSetIds)
      );
      onComparisonComplete(data);
    } catch (err) {
      setError(getErrorMessage(err));
      setIsComparing(false);
    }
  }
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" message="Loading profiles..." />
      </div>
    );
  }
  
  // Show comparison in progress
  if (isComparing) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner 
          size="lg" 
          message="Comparing profiles... This may take a moment for large orgs." 
        />
      </div>
    );
  }
  
  // Calculate visible counts based on view mode
  const visibleCount = viewMode === 'profiles' 
    ? filteredProfiles.length 
    : viewMode === 'permissionSets' 
    ? filteredPermissionSets.length 
    : filteredProfiles.length + filteredPermissionSets.length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Select Items to Compare
        </h2>
        <p className="text-gray-600">
          Choose profiles and/or permission sets to see a detailed side-by-side comparison 
          of all permissions and access settings.
        </p>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg 
                        flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
      
      {/* View mode tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode('both')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                      transition-colors ${viewMode === 'both' 
                        ? 'bg-sf-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          All
          <span className="px-1.5 py-0.5 text-xs rounded bg-opacity-20 bg-white">
            {profiles.length + permissionSets.length}
          </span>
        </button>
        <button
          onClick={() => setViewMode('profiles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                      transition-colors ${viewMode === 'profiles' 
                        ? 'bg-sf-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          <Users className="w-4 h-4" />
          Profiles
          <span className="px-1.5 py-0.5 text-xs rounded bg-opacity-20 bg-white">
            {profiles.length}
          </span>
        </button>
        <button
          onClick={() => setViewMode('permissionSets')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                      transition-colors ${viewMode === 'permissionSets' 
                        ? 'bg-sf-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          <Shield className="w-4 h-4" />
          Permission Sets
          <span className="px-1.5 py-0.5 text-xs rounded bg-opacity-20 bg-white">
            {permissionSets.length}
          </span>
        </button>
      </div>
      
      {/* Search and selection controls */}
      <div className="card p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 
                               w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search profiles and permission sets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9"
            />
          </div>
          
          {/* Selection buttons */}
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="btn-secondary text-sm whitespace-nowrap"
            >
              Select All ({visibleCount})
            </button>
            <button
              onClick={clearSelection}
              className="btn-secondary text-sm whitespace-nowrap"
              disabled={totalSelected === 0}
            >
              Clear ({totalSelected})
            </button>
          </div>
        </div>
        
        {/* Selection summary */}
        {totalSelected > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {selectedProfileIds.size > 0 && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                {selectedProfileIds.size} profile{selectedProfileIds.size !== 1 ? 's' : ''}
              </span>
            )}
            {selectedPermSetIds.size > 0 && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                {selectedPermSetIds.size} permission set{selectedPermSetIds.size !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Items list */}
      <div className="card divide-y divide-gray-100 mb-6 max-h-[500px] 
                      overflow-y-auto scrollbar-thin">
        {/* Profiles section */}
        {(viewMode === 'profiles' || viewMode === 'both') && filteredProfiles.length > 0 && (
          <>
            {viewMode === 'both' && (
              <div className="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-600 
                              flex items-center gap-2 sticky top-0 z-10">
                <Users className="w-4 h-4" />
                Profiles ({filteredProfiles.length})
              </div>
            )}
            {filteredProfiles.map(profile => (
              <ProfileItem
                key={profile.id}
                profile={profile}
                isSelected={selectedProfileIds.has(profile.id)}
                onToggle={() => toggleProfileSelection(profile.id)}
                type="profile"
              />
            ))}
          </>
        )}
        
        {/* Permission Sets section */}
        {(viewMode === 'permissionSets' || viewMode === 'both') && filteredPermissionSets.length > 0 && (
          <>
            {viewMode === 'both' && (
              <div className="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-600 
                              flex items-center gap-2 sticky top-0 z-10">
                <Shield className="w-4 h-4" />
                Permission Sets ({filteredPermissionSets.length})
              </div>
            )}
            {filteredPermissionSets.map(permSet => (
              <PermissionSetItem
                key={permSet.id}
                permissionSet={permSet}
                isSelected={selectedPermSetIds.has(permSet.id)}
                onToggle={() => togglePermSetSelection(permSet.id)}
              />
            ))}
          </>
        )}
        
        {/* Empty state */}
        {((viewMode === 'profiles' && filteredProfiles.length === 0) ||
          (viewMode === 'permissionSets' && filteredPermissionSets.length === 0) ||
          (viewMode === 'both' && filteredProfiles.length === 0 && filteredPermissionSets.length === 0)) && (
          <div className="p-8 text-center text-gray-500">
            {searchQuery 
              ? 'No items match your search'
              : 'No items found in this org'
            }
          </div>
        )}
      </div>
      
      {/* Compare button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {totalSelected === 0 
            ? 'Select at least 2 items to compare'
            : totalSelected === 1
            ? 'Select one more item to compare'
            : `${totalSelected} items selected`
          }
        </p>
        
        <button
          onClick={handleCompare}
          disabled={totalSelected < 2}
          className="btn-primary flex items-center gap-2"
        >
          Compare
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Individual profile item in the list
 */
interface ProfileItemProps {
  profile: Profile;
  isSelected: boolean;
  onToggle: () => void;
  type?: 'profile' | 'permissionSet';
}

function ProfileItem({ profile, isSelected, onToggle }: ProfileItemProps) {
  return (
    <label
      className={`flex items-center gap-4 p-4 cursor-pointer transition-colors
                  ${isSelected ? 'bg-sf-blue-50' : 'hover:bg-gray-50'}`}
    >
      <div className={`flex items-center justify-center w-5 h-5 rounded border-2 
                       transition-colors
                       ${isSelected 
                         ? 'bg-sf-blue-500 border-sf-blue-500' 
                         : 'border-gray-300'}`}>
        {isSelected && <Check className="w-3 h-3 text-white" />}
      </div>
      
      <Users className="w-4 h-4 text-blue-500 flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">
          {profile.name}
        </p>
        <p className="text-xs text-gray-500 font-mono truncate">
          {profile.id}
        </p>
      </div>
      
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="sr-only"
      />
    </label>
  );
}

/**
 * Individual permission set item in the list
 */
interface PermissionSetItemProps {
  permissionSet: PermissionSet;
  isSelected: boolean;
  onToggle: () => void;
}

function PermissionSetItem({ permissionSet, isSelected, onToggle }: PermissionSetItemProps) {
  return (
    <label
      className={`flex items-center gap-4 p-4 cursor-pointer transition-colors
                  ${isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
    >
      <div className={`flex items-center justify-center w-5 h-5 rounded border-2 
                       transition-colors
                       ${isSelected 
                         ? 'bg-purple-500 border-purple-500' 
                         : 'border-gray-300'}`}>
        {isSelected && <Check className="w-3 h-3 text-white" />}
      </div>
      
      <Shield className="w-4 h-4 text-purple-500 flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900 truncate">
            {permissionSet.label}
          </p>
          {permissionSet.type && permissionSet.type !== 'Regular' && (
            <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
              {permissionSet.type}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">
          {permissionSet.name}
          {permissionSet.description && ` • ${permissionSet.description}`}
        </p>
      </div>
      
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="sr-only"
      />
    </label>
  );
}

export default ProfileSelector;
