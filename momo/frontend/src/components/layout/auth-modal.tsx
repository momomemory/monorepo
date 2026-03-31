import { useState } from 'preact/hooks';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import type { AuthState } from '../../hooks/use-auth';
import { getApiBaseOverride } from '../../api';

interface AuthModalProps {
  authState: AuthState;
  authError: string | null;
  onSubmit: (apiKey: string, baseUrl: string) => Promise<boolean>;
}

export function AuthModal({ authState, authError, onSubmit }: AuthModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(() => getApiBaseOverride());
  const [showKey, setShowKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (authState === 'valid' || authState === 'checking') return null;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setSubmitting(true);
    await onSubmit(apiKey.trim(), baseUrl.trim());
    setSubmitting(false);
  };

  return (
    <div
      class="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div
        class="w-full max-w-sm mx-4"
        style={{
          backgroundColor: 'var(--c-surface)',
          border: '1px solid var(--c-border-hi)',
          borderRadius: '6px',
        }}
      >
        {/* Header */}
        <div class="px-6 py-5" style={{ borderBottom: '1px solid var(--c-border)' }}>
          <div class="flex items-center gap-2.5 mb-3">
            {/* Mini starburst */}
            <svg width="16" height="16" viewBox="0 0 128 128">
              <path
                fill-rule="evenodd"
                d="M81 36 64 0 47 36l-1 2-9-10a6 6 0 0 0-9 9l10 10h-2L0 64l36 17h2L28 91a6 6 0 1 0 9 9l9-10 1 2 17 36 17-36v-2l9 10a6 6 0 1 0 9-9l-9-9 2-1 36-17-36-17-2-1 9-9a6 6 0 1 0-9-9l-9 10v-2Zm-17 2-2 5c-4 8-11 15-19 19l-5 2 5 2c8 4 15 11 19 19l2 5 2-5c4-8 11-15 19-19l5-2-5-2c-8-4-15-11-19-19l-2-5Z"
                clip-rule="evenodd"
                fill="currentColor"
                style={{ color: 'var(--c-text)' }}
              />
              <path
                d="M118 19a6 6 0 0 0-9-9l-3 3a6 6 0 1 0 9 9l3-3Zm-96 4c-2 2-6 2-9 0l-3-3a6 6 0 1 1 9-9l3 3c3 2 3 6 0 9Zm0 82c-2-2-6-2-9 0l-3 3a6 6 0 1 0 9 9l3-3c3-2 3-6 0-9Zm96 4a6 6 0 0 1-9 9l-3-3a6 6 0 1 1 9-9l3 3Z"
                fill="currentColor"
                style={{ color: 'var(--c-text)' }}
              />
            </svg>
            <span class="font-mono font-medium" style={{ color: 'var(--c-text)', fontSize: '0.875rem' }}>
              momo console
            </span>
          </div>
          <p class="text-sm" style={{ color: 'var(--c-text-2)' }}>
            {authState === 'invalid'
              ? 'Authentication failed. Check your API key and try again.'
              : 'Enter your API key to access the console.'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} class="px-6 py-5 flex flex-col gap-4">
          {authError && (
            <div class="msg-error text-sm">{authError}</div>
          )}

          <div class="flex flex-col gap-1">
            <label class="field-label">API Key</label>
            <div class="relative">
              <input
                class="field-input pr-10"
                type={showKey ? 'text' : 'password'}
                placeholder="sk-..."
                value={apiKey}
                onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
                autoFocus
                autoComplete="current-password"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ background: 'none', border: 'none', color: 'var(--c-text-3)', padding: 0 }}
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeSlash size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <label class="field-label">API Base URL <span style={{ color: 'var(--c-text-3)' }}>(optional)</span></label>
            <input
              class="field-input"
              type="url"
              placeholder="https://your-momo-instance.com/api/v1"
              value={baseUrl}
              onInput={(e) => setBaseUrl((e.target as HTMLInputElement).value)}
              autoComplete="off"
            />
          </div>

          <button
            class="btn btn-primary w-full mt-1"
            type="submit"
            disabled={submitting || !apiKey.trim()}
          >
            {submitting ? (
              <span class="inline-flex items-center gap-2">
                <span
                  class="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"
                  style={{ borderTopColor: 'transparent' }}
                />
                Connecting...
              </span>
            ) : (
              'Connect'
            )}
          </button>
        </form>

        <div
          class="px-6 py-3"
          style={{ borderTop: '1px solid var(--c-border)' }}
        >
          <p class="font-mono text-xs" style={{ color: 'var(--c-text-3)' }}>
            If no API keys are configured on the server, leave this blank and connect.
          </p>
        </div>
      </div>
    </div>
  );
}
