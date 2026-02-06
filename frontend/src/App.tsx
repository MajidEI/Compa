import { useState, useEffect, useCallback } from 'react';
import { getAuthStatus, logout, getLoginUrl } from './services/api';
import { saveToHistory } from './services/history';
import type { AuthStatus, CompareResponse } from './types';
import Header from './components/Header';
import LoginPage from './components/LoginPage';
import ProfileSelector from './components/ProfileSelector';
import ComparisonView from './components/ComparisonView';
import LoadingSpinner from './components/LoadingSpinner';
import HistoryPanel from './components/HistoryPanel';

/**
 * Main Application Component
 * 
 * Manages authentication state and renders the appropriate view:
 * - LoginPage: when not authenticated
 * - ProfileSelector: when authenticated but no comparison active
 * - ComparisonView: when comparison results are available
 */
function App() {
  // Authentication state
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // Comparison state
  const [comparisonData, setComparisonData] = useState<CompareResponse | null>(null);
  
  /**
   * Check authentication status on mount and after OAuth callback
   */
  useEffect(() => {
    checkAuth();
    
    // Check for OAuth callback parameters in URL
    const params = new URLSearchParams(window.location.search);
    const authResult = params.get('auth');
    const error = params.get('error');
    
    if (authResult === 'success') {
      // Clear URL parameters after successful auth
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    if (error) {
      console.error('OAuth error:', error);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
  
  /**
   * Fetch current authentication status from backend
   */
  const checkAuth = useCallback(async () => {
    setIsCheckingAuth(true);
    try {
      const status = await getAuthStatus();
      setAuthStatus(status);
    } catch (error) {
      // Not authenticated or server error
      setAuthStatus({ authenticated: false });
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);
  
  /**
   * Handle user login - redirect to Salesforce OAuth
   * @param env - 'production' or 'sandbox'
   */
  const handleLogin = useCallback((env: 'production' | 'sandbox' = 'production') => {
    window.location.href = getLoginUrl(env);
  }, []);
  
  /**
   * Handle user logout
   */
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      setAuthStatus({ authenticated: false });
      setComparisonData(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);
  
  /**
   * Handle comparison results from ProfileSelector
   */
  const handleComparisonComplete = useCallback((data: CompareResponse) => {
    // Save to history
    saveToHistory(data, {
      orgId: authStatus?.organizationId,
      instanceUrl: authStatus?.instanceUrl,
    });
    setComparisonData(data);
  }, [authStatus?.organizationId, authStatus?.instanceUrl]);
  
  /**
   * Handle loading a comparison from history
   */
  const handleLoadFromHistory = useCallback((data: CompareResponse) => {
    setComparisonData(data);
  }, []);
  
  /**
   * Go back to profile selection
   */
  const handleBackToSelection = useCallback(() => {
    setComparisonData(null);
  }, []);
  
  // Show loading spinner while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" message="Checking authentication..." />
      </div>
    );
  }
  
  // Show login page if not authenticated
  if (!authStatus?.authenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        instanceUrl={authStatus.instanceUrl} 
        onLogout={handleLogout}
        onBackToSelection={comparisonData ? handleBackToSelection : undefined}
      />
      
      <main className="container mx-auto px-4 py-6">
        {comparisonData ? (
          <ComparisonView 
            data={comparisonData} 
            onBack={handleBackToSelection}
          />
        ) : (
          <>
            <HistoryPanel 
              onLoadComparison={handleLoadFromHistory}
              currentOrgId={authStatus?.organizationId}
            />
            <ProfileSelector onComparisonComplete={handleComparisonComplete} />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
