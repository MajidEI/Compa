import { LogOut, ArrowLeft, Shield } from 'lucide-react';

interface HeaderProps {
  instanceUrl?: string;
  onLogout: () => void;
  onBackToSelection?: () => void;
}

/**
 * Application Header
 * 
 * Displays:
 * - App logo and title
 * - Connected Salesforce instance URL
 * - Back button (when viewing comparison)
 * - Logout button
 */
function Header({ instanceUrl, onLogout, onBackToSelection }: HeaderProps) {
  // Extract org name from instance URL
  const orgName = instanceUrl 
    ? new URL(instanceUrl).hostname.split('.')[0]
    : 'Unknown';
  
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Left side: Logo and title */}
          <div className="flex items-center gap-3">
            {onBackToSelection && (
              <button
                onClick={onBackToSelection}
                className="p-2 rounded-md hover:bg-gray-100 text-gray-600 
                           hover:text-gray-900 transition-colors"
                title="Back to profile selection"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            
            <div className="flex items-center gap-2">
              <div className="p-2 bg-sf-blue-500 rounded-lg">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  Compara
                </h1>
                <p className="text-xs text-gray-500">
                  Salesforce Permission Comparison Tool
                </p>
              </div>
            </div>
          </div>
          
          {/* Right side: Instance info and logout */}
          <div className="flex items-center gap-4">
            {instanceUrl && (
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-gray-700">
                  Connected to
                </p>
                <p className="text-xs text-gray-500">
                  {orgName}
                </p>
              </div>
            )}
            
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium 
                         text-gray-700 hover:text-gray-900 hover:bg-gray-100 
                         rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
