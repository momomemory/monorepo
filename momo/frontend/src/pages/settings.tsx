import { useEffect, useState } from 'preact/hooks';
import { apiEnvelope } from '../api';
import { useApiAction } from '../hooks/use-api-action';
import { useApp } from '../context/app-context';
import { Panel } from '../components/ui/panel';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Toggle } from '../components/ui/toggle';
import { JsonView } from '../components/ui/json-view';
import { getApiBaseOverride } from '../api';
import type { AuthState } from '../hooks/use-auth';

interface SettingsPageProps {
  applyCredentials: (key: string, tag?: string, baseUrl?: string) => Promise<boolean>;
  validateApiKey: (key: string) => Promise<boolean>;
  authState: AuthState;
}

export function SettingsPage({ applyCredentials, validateApiKey, authState }: SettingsPageProps) {
  const { apiKey, containerTag, onAuthFailure } = useApp();

  // ── Credentials ──────────────────────────────────────────
  const [draftKey, setDraftKey] = useState(apiKey);
  const [draftBase, setDraftBase] = useState(() => getApiBaseOverride());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => { setDraftKey(apiKey); }, [apiKey]);

  const saveCredentials = async (e: Event) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    const ok = await applyCredentials(draftKey.trim(), undefined, draftBase.trim());
    setSaving(false);
    setSaveMsg(ok ? 'Saved and validated.' : 'Saved, but validation failed.');
  };

  const recheck = async () => {
    setSaving(true);
    await validateApiKey(apiKey);
    setSaving(false);
  };

  // ── Profile ───────────────────────────────────────────────
  const [profileState, runProfile, resetProfile] = useApiAction(onAuthFailure);
  const [profileQuery, setProfileQuery] = useState('');
  const [profileThreshold, setProfileThreshold] = useState('');
  const [profileLimit, setProfileLimit] = useState('50');
  const [includeDynamic, setIncludeDynamic] = useState(true);
  const [generateNarrative, setGenerateNarrative] = useState(true);

  const computeProfile = async (e: Event) => {
    e.preventDefault();
    if (!containerTag.trim()) {
      void runProfile(async () => ({ ok: false, status: 0, error: 'Container tag is required. Set one in the scope bar.' }));
      return;
    }
    try {
      const threshold = profileThreshold.trim() ? Number(profileThreshold) : undefined;
      const limit = profileLimit.trim() ? Math.trunc(Number(profileLimit)) : undefined;
      await runProfile(() =>
        apiEnvelope(apiKey, '/profile:compute', {
          method: 'POST',
          body: {
            containerTag: containerTag.trim(),
            q: profileQuery.trim() || undefined,
            threshold,
            includeDynamic,
            limit,
            generateNarrative,
          },
        }),
      );
    } catch (err) {
      void runProfile(async () => ({ ok: false, status: 0, error: err instanceof Error ? err.message : 'Invalid parameters' }));
    }
  };

  // ── Conversation ──────────────────────────────────────────
  const [convState, runConv, resetConv] = useApiAction(onAuthFailure);
  const [sessionId, setSessionId] = useState('');
  const [convMemType, setConvMemType] = useState<'fact' | 'preference' | 'episode' | ''>('');
  const [messagesJson, setMessagesJson] = useState(
    JSON.stringify([
      { role: 'user', content: 'I prefer dark mode.' },
      { role: 'assistant', content: 'Noted.' },
    ], null, 2),
  );

  const ingestConversation = async (e: Event) => {
    e.preventDefault();
    if (!containerTag.trim()) {
      void runConv(async () => ({ ok: false, status: 0, error: 'Container tag is required. Set one in the scope bar.' }));
      return;
    }
    try {
      const parsed = JSON.parse(messagesJson) as unknown;
      if (!Array.isArray(parsed)) throw new Error('Messages must be a JSON array');
      await runConv(() =>
        apiEnvelope(apiKey, '/conversations:ingest', {
          method: 'POST',
          body: {
            messages: parsed,
            containerTag: containerTag.trim(),
            sessionId: sessionId.trim() || undefined,
            memoryType: convMemType || undefined,
          },
        }),
      );
    } catch (err) {
      void runConv(async () => ({ ok: false, status: 0, error: err instanceof Error ? err.message : 'Invalid conversation payload' }));
    }
  };

  // ── Admin ─────────────────────────────────────────────────
  const [adminState, runAdmin, resetAdmin] = useApiAction(onAuthFailure);

  const runForgettingCycle = () =>
    runAdmin(() => apiEnvelope(apiKey, '/admin/forgetting:run', { method: 'POST' }));

  return (
    <div class="px-6 py-6 flex flex-col gap-6 max-w-3xl">
      <div>
        <h1
          class="font-mono font-medium text-sm tracking-wide"
          style={{ color: 'var(--c-text)', letterSpacing: '0.04em' }}
        >
          Settings
        </h1>
        <p class="text-xs mt-0.5" style={{ color: 'var(--c-text-3)' }}>
          Credentials, profile, conversations, and admin
        </p>
      </div>

      {/* ── API credentials ── */}
      <Panel title="API credentials">
        <form onSubmit={saveCredentials} class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label class="field-label">
              API key
              <span
                class="ml-2 font-mono text-xs"
                style={{
                  color: authState === 'valid' ? 'var(--c-ok)' : authState === 'invalid' ? 'var(--c-err)' : 'var(--c-text-3)',
                }}
              >
                {authState === 'valid' ? '● valid' : authState === 'invalid' ? '● invalid' : authState === 'checking' ? '○ checking...' : '○ not set'}
              </span>
            </label>
            <div class="relative">
              <input
                class="field-input pr-10"
                type={showKey ? 'text' : 'password'}
                value={draftKey}
                onInput={(e) => setDraftKey((e.target as HTMLInputElement).value)}
                placeholder="sk-..."
                autoComplete="current-password"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                style={{ background: 'none', border: 'none', color: 'var(--c-text-3)', cursor: 'pointer' }}
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? 'hide' : 'show'}
              </button>
            </div>
          </div>

          <Input
            label="API base URL (optional override)"
            value={draftBase}
            onInput={(e) => setDraftBase((e.target as HTMLInputElement).value)}
            placeholder="https://your-momo-instance.com/api/v1"
          />

          {saveMsg && (
            <p class="font-mono text-xs" style={{ color: saveMsg.includes('fail') ? 'var(--c-err)' : 'var(--c-ok)' }}>
              {saveMsg}
            </p>
          )}

          <div class="flex gap-2">
            <Button type="submit" variant="primary" size="sm" loading={saving}>
              Save settings
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={saving}
              onClick={recheck}
            >
              Re-check auth
            </Button>
          </div>
        </form>
      </Panel>

      {/* ── Profile ── */}
      <Panel title="Compute profile">
        <form onSubmit={computeProfile} class="flex flex-col gap-4">
          <Input
            label="Query (optional)"
            value={profileQuery}
            onInput={(e) => setProfileQuery((e.target as HTMLInputElement).value)}
            placeholder="Filter by relevance..."
          />
          <div class="grid grid-cols-2 gap-3">
            <Input
              label="Threshold (optional)"
              value={profileThreshold}
              onInput={(e) => setProfileThreshold((e.target as HTMLInputElement).value)}
              placeholder="0.5"
            />
            <Input
              label="Limit"
              value={profileLimit}
              onInput={(e) => setProfileLimit((e.target as HTMLInputElement).value)}
              placeholder="50"
            />
          </div>
          <div class="flex flex-col gap-2">
            <Toggle
              checked={includeDynamic}
              onChange={setIncludeDynamic}
              label="Include dynamic facts"
            />
            <Toggle
              checked={generateNarrative}
              onChange={setGenerateNarrative}
              label="Generate narrative summary"
            />
          </div>
          <div class="flex gap-2">
            <Button type="submit" variant="primary" size="sm" loading={profileState.loading}>
              Compute profile
            </Button>
            {profileState.result && (
              <Button variant="ghost" size="sm" onClick={resetProfile}>Clear</Button>
            )}
          </div>
          {profileState.error && <p class="msg-error text-sm">{profileState.error}</p>}
        </form>
        {profileState.result && (
          <div class="mt-4">
            <JsonView data={profileState.result} label="Profile response" />
          </div>
        )}
      </Panel>

      {/* ── Conversation ── */}
      <Panel title="Ingest conversation">
        <form onSubmit={ingestConversation} class="flex flex-col gap-4">
          <div class="grid grid-cols-2 gap-3">
            <Input
              label="Session ID (optional)"
              value={sessionId}
              onInput={(e) => setSessionId((e.target as HTMLInputElement).value)}
            />
            <Select
              label="Memory type (optional)"
              value={convMemType}
              onChange={(e) => setConvMemType((e.target as HTMLSelectElement).value as typeof convMemType)}
            >
              <option value="">Auto</option>
              <option value="fact">Fact</option>
              <option value="preference">Preference</option>
              <option value="episode">Episode</option>
            </Select>
          </div>
          <Textarea
            label="Messages JSON array"
            value={messagesJson}
            onInput={(e) => setMessagesJson((e.target as HTMLTextAreaElement).value)}
            rows={8}
            mono
          />
          <div class="flex gap-2">
            <Button type="submit" variant="primary" size="sm" loading={convState.loading}>
              Ingest conversation
            </Button>
            {convState.result && (
              <Button variant="ghost" size="sm" onClick={resetConv}>Clear</Button>
            )}
          </div>
          {convState.error && <p class="msg-error text-sm">{convState.error}</p>}
        </form>
        {convState.result && (
          <div class="mt-4">
            <JsonView data={convState.result} label="Conversation response" />
          </div>
        )}
      </Panel>

      {/* ── Admin ── */}
      <Panel title="Admin">
        <div class="flex flex-col gap-3">
          <p class="text-sm" style={{ color: 'var(--c-text-2)' }}>
            Run one immediate forgetting cycle. This triggers the forgetting manager to process memories that are due for decay or deletion.
          </p>
          <div class="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              loading={adminState.loading}
              onClick={() => void runForgettingCycle()}
            >
              Run forgetting cycle
            </Button>
            {adminState.result && (
              <Button variant="ghost" size="sm" onClick={resetAdmin}>Clear</Button>
            )}
          </div>
          {adminState.error && <p class="msg-error text-sm">{adminState.error}</p>}
          {adminState.result && (
            <div class="mt-2">
              <JsonView data={adminState.result} label="Admin response" />
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
