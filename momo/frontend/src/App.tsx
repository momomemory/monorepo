import { useEffect } from 'preact/hooks';
import { useAuth } from './hooks/use-auth';
import { useRoute } from './hooks/use-route';
import { useTheme } from './hooks/use-theme';
import { AppContext } from './context/app-context';
import { Sidebar } from './components/layout/sidebar';
import { ScopeBar } from './components/layout/scope-bar';
import { AuthModal } from './components/layout/auth-modal';
import { DashboardPage } from './pages/dashboard';
import { SearchPage } from './pages/search';
import { DocumentsPage } from './pages/documents';
import { MemoriesPage } from './pages/memories';
import { GraphPage } from './pages/graph';
import { SettingsPage } from './pages/settings';

export function App() {
  const auth = useAuth();
  const { route, navigate } = useRoute();
  const { theme, toggleTheme } = useTheme();

  // Validate on mount if a stored key exists
  useEffect(() => {
    if (auth.authState === 'checking') {
      void auth.validateApiKey(auth.apiKey);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAuthSubmit = async (apiKey: string, baseUrl: string): Promise<boolean> => {
    return auth.applyCredentials(apiKey, undefined, baseUrl);
  };

  return (
    <AppContext.Provider
      value={{
        apiKey: auth.apiKey,
        containerTag: auth.containerTag,
        setContainerTag: auth.setContainerTag,
        onAuthFailure: auth.onAuthFailure,
        navigate,
      }}
    >
      <div
        class="flex h-screen overflow-hidden"
        style={{ backgroundColor: 'var(--c-bg)' }}
      >
        {/* Sidebar */}
        <Sidebar
          activeRoute={route}
          onNavigate={navigate}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {/* Right panel: scope bar + page content */}
        <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
          <ScopeBar
            apiKey={auth.apiKey}
            containerTag={auth.containerTag}
            onTagChange={auth.setContainerTag}
          />

          <main class="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--c-bg)' }}>
            {route === 'dashboard' && <DashboardPage />}
            {route === 'search' && <SearchPage />}
            {route === 'documents' && <DocumentsPage />}
            {route === 'memories' && <MemoriesPage />}
            {route === 'graph' && <GraphPage />}
            {route === 'settings' && (
              <SettingsPage
                applyCredentials={auth.applyCredentials}
                validateApiKey={auth.validateApiKey}
                authState={auth.authState}
              />
            )}
          </main>
        </div>
      </div>

      <AuthModal
        authState={auth.authState}
        authError={auth.authError}
        onSubmit={handleAuthSubmit}
      />
    </AppContext.Provider>
  );
}
