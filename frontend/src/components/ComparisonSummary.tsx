import { 
  Database, Key, Code, FileText, Zap, 
  Layout, Grid, Settings 
} from 'lucide-react';
import type { ComparisonResult } from '../types';

interface ComparisonSummaryProps {
  comparison: ComparisonResult;
  profileCount: number;
}

/**
 * ComparisonSummary Component
 * 
 * Displays summary statistics about the comparison:
 * - Total differences found
 * - Breakdown by category
 * - Timestamp of comparison
 */
function ComparisonSummary({ comparison, profileCount }: ComparisonSummaryProps) {
  const { summary, totalDifferences, timestamp } = comparison;
  
  const stats = [
    { 
      label: 'Object Permissions', 
      value: summary.objectPermissions, 
      icon: Database,
      color: 'text-blue-600 bg-blue-50',
    },
    { 
      label: 'Field Permissions', 
      value: summary.fieldPermissions, 
      icon: Key,
      color: 'text-purple-600 bg-purple-50',
    },
    { 
      label: 'System Permissions', 
      value: summary.systemPermissions, 
      icon: Settings,
      color: 'text-orange-600 bg-orange-50',
    },
    { 
      label: 'Apex Classes', 
      value: summary.apexClasses, 
      icon: Code,
      color: 'text-green-600 bg-green-50',
    },
    { 
      label: 'Visualforce Pages', 
      value: summary.visualforcePages, 
      icon: FileText,
      color: 'text-teal-600 bg-teal-50',
    },
    { 
      label: 'Lightning Pages', 
      value: summary.lightningPages, 
      icon: Zap,
      color: 'text-yellow-600 bg-yellow-50',
    },
    { 
      label: 'Record Types', 
      value: summary.recordTypes, 
      icon: Layout,
      color: 'text-pink-600 bg-pink-50',
    },
    { 
      label: 'Tab/App Settings', 
      value: summary.tabVisibilities + summary.appVisibilities, 
      icon: Grid,
      color: 'text-indigo-600 bg-indigo-50',
    },
  ];
  
  // Format timestamp
  const formattedTime = new Date(timestamp).toLocaleString();
  
  return (
    <div className="space-y-4">
      {/* Header with total */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Comparison Results
          </h2>
          <p className="text-gray-600">
            Comparing {profileCount} profiles • Generated {formattedTime}
          </p>
        </div>
        
        {/* Total differences badge */}
        <div className="flex items-center gap-3">
          <div className={`px-4 py-2 rounded-lg ${
            totalDifferences > 0 
              ? 'bg-amber-50 border border-amber-200' 
              : 'bg-green-50 border border-green-200'
          }`}>
            <p className="text-sm text-gray-600">Total Differences</p>
            <p className={`text-2xl font-bold ${
              totalDifferences > 0 ? 'text-amber-700' : 'text-green-700'
            }`}>
              {totalDifferences.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
      
      {/* Category stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {stats.map(stat => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded ${color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 truncate" title={label}>{label}</p>
    </div>
  );
}

export default ComparisonSummary;
