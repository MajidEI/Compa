import { useState, useEffect } from 'react';
import { History, Trash2, ExternalLink, ChevronRight, Clock, AlertTriangle } from 'lucide-react';
import { 
  getHistory, 
  deleteHistoryEntry, 
  clearHistory, 
  formatDate,
  type HistoryEntry 
} from '../services/history';
import type { CompareResponse } from '../types';

interface HistoryPanelProps {
  onLoadComparison: (data: CompareResponse) => void;
  currentOrgId?: string;
}

/**
 * History Panel Component
 * 
 * Displays a list of previous comparisons that can be revisited.
 */
function HistoryPanel({ onLoadComparison, currentOrgId }: HistoryPanelProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Load history on mount and when it changes
  useEffect(() => {
    setHistory(getHistory());
  }, []);
  
  /**
   * Handle loading a comparison from history
   */
  function handleLoad(entry: HistoryEntry) {
    onLoadComparison(entry.data);
  }
  
  /**
   * Handle deleting a history entry
   */
  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    deleteHistoryEntry(id);
    setHistory(getHistory());
  }
  
  /**
   * Handle clearing all history
   */
  function handleClearAll() {
    clearHistory();
    setHistory([]);
    setShowClearConfirm(false);
  }
  
  if (history.length === 0) {
    return null; // Don't show if no history
  }
  
  return (
    <div className="mb-6">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 
                   rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <History className="w-5 h-5 text-gray-500" />
          <span className="font-medium text-gray-700">
            Recent Comparisons
          </span>
          <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full">
            {history.length}
          </span>
        </div>
        <ChevronRight 
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isExpanded ? 'rotate-90' : ''
          }`} 
        />
      </button>
      
      {/* History list */}
      {isExpanded && (
        <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
          <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-100">
            {history.map(entry => {
              const isDifferentOrg = currentOrgId && entry.orgId && entry.orgId !== currentOrgId;
              
              return (
                <div
                  key={entry.id}
                  onClick={() => !isDifferentOrg && handleLoad(entry)}
                  className={`p-4 flex items-center gap-4 transition-colors ${
                    isDifferentOrg 
                      ? 'bg-amber-50 cursor-not-allowed' 
                      : 'hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900 truncate">
                        {entry.profileNames.join(' vs ')}
                      </p>
                      {isDifferentOrg && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs 
                                         bg-amber-100 text-amber-700 rounded">
                          <AlertTriangle className="w-3 h-3" />
                          Different Org
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(entry.timestamp)}
                      </span>
                      <span>
                        {entry.totalDifferences} difference{entry.totalDifferences !== 1 ? 's' : ''}
                      </span>
                      {entry.instanceUrl && (
                        <span className="truncate max-w-[150px]" title={entry.instanceUrl}>
                          {new URL(entry.instanceUrl).hostname}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {!isDifferentOrg && (
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    )}
                    <button
                      onClick={(e) => handleDelete(entry.id, e)}
                      className="p-1.5 text-gray-400 hover:text-red-500 
                                 hover:bg-red-50 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Clear all button */}
          <div className="p-3 bg-gray-50 border-t border-gray-200">
            {showClearConfirm ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Clear all history?</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-200 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-sm text-gray-500 hover:text-red-500 transition-colors"
              >
                Clear history
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default HistoryPanel;
