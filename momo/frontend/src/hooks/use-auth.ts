import { useState, useCallback } from 'preact/hooks';
import { apiEnvelope, setApiBaseOverride } from '../api';

const STORAGE_KEY_API_KEY = 'momo.ui.apiKey';
const STORAGE_KEY_TAG = 'momo.ui.containerTag';

export type AuthState = 'checking' | 'valid' | 'invalid' | 'missing';

function loadStored(key: string): string {
  return window.localStorage.getItem(key) ?? '';
}

export function useAuth() {
  const [apiKey, setApiKeyState] = useState<string>(() => loadStored(STORAGE_KEY_API_KEY));
  const [containerTag, setContainerTagState] = useState<string>(() => loadStored(STORAGE_KEY_TAG));
  const [authState, setAuthState] = useState<AuthState>(() =>
    loadStored(STORAGE_KEY_API_KEY) ? 'checking' : 'missing',
  );
  const [authError, setAuthError] = useState<string | null>(null);

  const validateApiKey = useCallback(async (key: string): Promise<boolean> => {
    if (!key.trim()) {
      setAuthState('missing');
      return false;
    }
    setAuthState('checking');
    const res = await apiEnvelope<unknown>(key, '/documents?limit=1');
    if (res.ok) {
      setAuthState('valid');
      setAuthError(null);
      return true;
    }
    if (res.status === 401) {
      setAuthState('invalid');
      setAuthError('Invalid API key');
      return false;
    }
    // Non-auth errors (e.g. 404 on empty DB) still mean auth succeeded
    setAuthState('valid');
    setAuthError(null);
    return true;
  }, []);

  const applyCredentials = useCallback(
    async (key: string, tag?: string, baseUrl?: string) => {
      const trimKey = key.trim();
      window.localStorage.setItem(STORAGE_KEY_API_KEY, trimKey);
      setApiKeyState(trimKey);

      if (tag !== undefined) {
        window.localStorage.setItem(STORAGE_KEY_TAG, tag);
        setContainerTagState(tag);
      }

      if (baseUrl !== undefined) {
        setApiBaseOverride(baseUrl);
      }

      return validateApiKey(trimKey);
    },
    [validateApiKey],
  );

  const setContainerTag = useCallback((tag: string) => {
    window.localStorage.setItem(STORAGE_KEY_TAG, tag);
    setContainerTagState(tag);
  }, []);

  const onAuthFailure = useCallback((message: string) => {
    setAuthState('invalid');
    setAuthError(message);
  }, []);

  return {
    apiKey,
    containerTag,
    setContainerTag,
    authState,
    authError,
    validateApiKey,
    applyCredentials,
    onAuthFailure,
  };
}
