/**
 * Comparison History Service
 * 
 * Stores and retrieves comparison history from localStorage
 */

import type { CompareResponse } from '../types';

export interface HistoryEntry {
  id: string;
  timestamp: string;
  orgId?: string;
  instanceUrl?: string;
  profileNames: string[];
  totalDifferences: number;
  summary: {
    objectPermissions: number;
    fieldPermissions: number;
    systemPermissions: number;
  };
  // We store the full data for revisiting
  data: CompareResponse;
}

const HISTORY_KEY = 'compara-history';
const MAX_HISTORY_ENTRIES = 20;

/**
 * Get all history entries
 */
export function getHistory(): HistoryEntry[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    
    const entries = JSON.parse(stored) as HistoryEntry[];
    // Sort by timestamp descending (newest first)
    return entries.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (error) {
    console.error('Error reading history:', error);
    return [];
  }
}

/**
 * Save a new comparison to history
 */
export function saveToHistory(
  data: CompareResponse,
  orgInfo?: { orgId?: string; instanceUrl?: string }
): HistoryEntry {
  const entry: HistoryEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    orgId: orgInfo?.orgId,
    instanceUrl: orgInfo?.instanceUrl,
    profileNames: data.comparison.profiles.map(p => p.name),
    totalDifferences: data.comparison.totalDifferences,
    summary: {
      objectPermissions: data.comparison.summary.objectPermissions,
      fieldPermissions: data.comparison.summary.fieldPermissions,
      systemPermissions: data.comparison.summary.systemPermissions,
    },
    data,
  };
  
  const history = getHistory();
  
  // Add new entry at the beginning
  history.unshift(entry);
  
  // Limit the number of entries
  const trimmed = history.slice(0, MAX_HISTORY_ENTRIES);
  
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Error saving history:', error);
    // If localStorage is full, try removing old entries
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      const reduced = trimmed.slice(0, Math.floor(MAX_HISTORY_ENTRIES / 2));
      localStorage.setItem(HISTORY_KEY, JSON.stringify(reduced));
    }
  }
  
  return entry;
}

/**
 * Get a specific history entry by ID
 */
export function getHistoryEntry(id: string): HistoryEntry | undefined {
  const history = getHistory();
  return history.find(entry => entry.id === id);
}

/**
 * Delete a history entry
 */
export function deleteHistoryEntry(id: string): void {
  const history = getHistory();
  const filtered = history.filter(entry => entry.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
}

/**
 * Clear all history
 */
export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format a date for display
 */
export function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}
