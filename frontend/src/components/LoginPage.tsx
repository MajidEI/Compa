import { useState } from 'react';
import { Shield, CheckCircle, Cloud, Building2, FlaskConical } from 'lucide-react';

type Environment = 'production' | 'sandbox';

interface LoginPageProps {
  onLogin: (env: Environment) => void;
}

/**
 * Login Page Component
 * 
 * Displayed when the user is not authenticated.
 * Provides environment selection and "Login with Salesforce" button.
 */
function LoginPage({ onLogin }: LoginPageProps) {
  const [selectedEnv, setSelectedEnv] = useState<Environment>('production');
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-sf-blue-50 to-white flex flex-col">
      {/* Header */}
      <header className="p-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-sf-blue-500 rounded-lg">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-gray-900">
            Compara
          </span>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 
                            bg-sf-blue-500 rounded-2xl shadow-lg mb-6">
              <Shield className="w-10 h-10 text-white" />
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Compara
            </h1>
            <p className="text-gray-600">
              Compare Salesforce Profiles and Permission Sets side-by-side 
              for security audits and compliance reviews.
            </p>
          </div>
          
          {/* Login card */}
          <div className="card p-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 text-center">
              Connect Your Salesforce Org
            </h2>
            
            {/* Features list */}
            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600 text-sm">
                  Compare object and field permissions across profiles
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600 text-sm">
                  View system permission differences at a glance
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600 text-sm">
                  Track Apex class and Visualforce page access
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600 text-sm">
                  Filter and search through permissions easily
                </span>
              </li>
            </ul>
            
            {/* Environment selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Environment
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedEnv('production')}
                  className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 
                             transition-all ${
                               selectedEnv === 'production'
                                 ? 'border-sf-blue-500 bg-sf-blue-50 text-sf-blue-700'
                                 : 'border-gray-200 hover:border-gray-300 text-gray-600'
                             }`}
                >
                  <Building2 className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-medium">Production</p>
                    <p className="text-xs opacity-75">login.salesforce.com</p>
                  </div>
                </button>
                
                <button
                  type="button"
                  onClick={() => setSelectedEnv('sandbox')}
                  className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 
                             transition-all ${
                               selectedEnv === 'sandbox'
                                 ? 'border-sf-blue-500 bg-sf-blue-50 text-sf-blue-700'
                                 : 'border-gray-200 hover:border-gray-300 text-gray-600'
                             }`}
                >
                  <FlaskConical className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-medium">Sandbox</p>
                    <p className="text-xs opacity-75">test.salesforce.com</p>
                  </div>
                </button>
              </div>
            </div>
            
            {/* Login button */}
            <button
              onClick={() => onLogin(selectedEnv)}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 
                         bg-sf-blue-500 text-white font-medium rounded-lg 
                         hover:bg-sf-blue-600 focus:outline-none focus:ring-2 
                         focus:ring-sf-blue-500 focus:ring-offset-2 
                         transition-colors shadow-md"
            >
              <Cloud className="w-5 h-5" />
              Login with Salesforce
            </button>
            
            <p className="text-xs text-gray-500 text-center mt-4">
              You'll be redirected to Salesforce to authorize this application.
              We only request read access to profile metadata.
            </p>
          </div>
          
          {/* Footer note */}
          <p className="text-center text-xs text-gray-400 mt-6">
            Built for Salesforce Admins conducting security audits
          </p>
        </div>
      </main>
    </div>
  );
}

export default LoginPage;
