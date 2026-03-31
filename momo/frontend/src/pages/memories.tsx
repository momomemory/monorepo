import { useState } from 'preact/hooks';
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

type SubTab = 'list' | 'create' | 'manage' | 'forget';

function parseJsonObject(input: string): Record<string, unknown> | undefined {
  if (!input.trim()) return undefined;
  const parsed = JSON.parse(input) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new Error('Metadata must be a JSON object');
  return parsed as Record<string, unknown>;
}

export function MemoriesPage() {
  const { apiKey, containerTag, onAuthFailure } = useApp();
  const [state, run, reset] = useApiAction(onAuthFailure);
  const [subTab, setSubTab] = useState<SubTab>('list');

  // List
  const [limit, setLimit] = useState('20');
  const [cursor, setCursor] = useState('');

  // Create
  const [memContent, setMemContent] = useState('');
  const [memType, setMemType] = useState<'fact' | 'preference' | 'episode'>('fact');
  const [memMetadata, setMemMetadata] = useState('');

  // Manage
  const [memoryId, setMemoryId] = useState('');
  const [updatedContent, setUpdatedContent] = useState('');
  const [updatedMetadata, setUpdatedMetadata] = useState('');
  const [isStatic, setIsStatic] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  // Forget
  const [forgetContent, setForgetContent] = useState('');
  const [forgetReason, setForgetReason] = useState('');

  const requireTag = async (action: () => Promise<void>) => {
    if (!containerTag.trim()) {
      void run(async () => ({ ok: false, status: 0, error: 'Container tag is required. Set one in the scope bar above.' }));
      return;
    }
    await action();
  };

  const listMemories = () =>
    requireTag(async () => {
      const q = new URLSearchParams();
      q.append('containerTag', containerTag.trim());
      if (limit.trim()) q.append('limit', limit.trim());
      if (cursor.trim()) q.append('cursor', cursor.trim());
      await run(() => apiEnvelope(apiKey, `/memories?${q.toString()}`));
    });

  const createMemory = (e: Event) => {
    e.preventDefault();
    void requireTag(async () => {
      try {
        const metadata = parseJsonObject(memMetadata);
        await run(() =>
          apiEnvelope(apiKey, '/memories', {
            method: 'POST',
            body: {
              content: memContent,
              containerTag: containerTag.trim(),
              memoryType: memType,
              metadata,
            },
          }),
        );
      } catch (err) {
        void run(async () => ({ ok: false, status: 0, error: err instanceof Error ? err.message : 'Invalid metadata' }));
      }
    });
  };

  const getMemory = () => run(() => apiEnvelope(apiKey, `/memories/${encodeURIComponent(memoryId.trim())}`));

  const updateMemory = async () => {
    try {
      const metadata = parseJsonObject(updatedMetadata);
      await run(() =>
        apiEnvelope(apiKey, `/memories/${encodeURIComponent(memoryId.trim())}`, {
          method: 'PATCH',
          body: { content: updatedContent || undefined, metadata, isStatic },
        }),
      );
    } catch (err) {
      void run(async () => ({ ok: false, status: 0, error: err instanceof Error ? err.message : 'Invalid update' }));
    }
  };

  const deleteMemory = () =>
    run(() =>
      apiEnvelope(apiKey, `/memories/${encodeURIComponent(memoryId.trim())}`, {
        method: 'DELETE',
        body: { reason: deleteReason.trim() || undefined },
      }),
    );

  const forgetByContent = () =>
    requireTag(async () => {
      await run(() =>
        apiEnvelope(apiKey, '/memories:forget', {
          method: 'POST',
          body: {
            content: forgetContent,
            containerTag: containerTag.trim(),
            reason: forgetReason.trim() || undefined,
          },
        }),
      );
    });

  return (
    <div class="px-6 py-6 flex flex-col gap-6 max-w-3xl">
      <div>
        <h1
          class="font-mono font-medium text-sm tracking-wide"
          style={{ color: 'var(--c-text)', letterSpacing: '0.04em' }}
        >
          Memories
        </h1>
        <p class="text-xs mt-0.5" style={{ color: 'var(--c-text-3)' }}>
          Create, manage, and forget memories
        </p>
      </div>

      <Panel title="Memories">
        <div class="subtab-bar">
          {(['list', 'create', 'manage', 'forget'] as SubTab[]).map((t) => (
            <button
              key={t}
              class={`subtab ${subTab === t ? 'active' : ''}`}
              onClick={() => { setSubTab(t); reset(); }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* List */}
        {subTab === 'list' && (
          <div class="flex flex-col gap-4">
            <div class="grid grid-cols-2 gap-3">
              <Input
                label="Limit"
                value={limit}
                onInput={(e) => setLimit((e.target as HTMLInputElement).value)}
                placeholder="20"
              />
              <Input
                label="Cursor"
                value={cursor}
                onInput={(e) => setCursor((e.target as HTMLInputElement).value)}
                placeholder="Next page cursor"
              />
            </div>
            <div class="flex gap-2">
              <Button variant="primary" size="sm" loading={state.loading} onClick={() => void listMemories()}>
                List memories
              </Button>
            </div>
          </div>
        )}

        {/* Create */}
        {subTab === 'create' && (
          <form onSubmit={createMemory} class="flex flex-col gap-4">
            <Textarea
              label="Content"
              value={memContent}
              onInput={(e) => setMemContent((e.target as HTMLTextAreaElement).value)}
              rows={4}
              required
            />
            <Select
              label="Memory type"
              value={memType}
              onChange={(e) => setMemType((e.target as HTMLSelectElement).value as typeof memType)}
            >
              <option value="fact">Fact</option>
              <option value="preference">Preference</option>
              <option value="episode">Episode</option>
            </Select>
            <Textarea
              label="Metadata JSON (optional)"
              value={memMetadata}
              onInput={(e) => setMemMetadata((e.target as HTMLTextAreaElement).value)}
              rows={3}
              mono
              placeholder='{}'
            />
            <div class="flex gap-2">
              <Button type="submit" variant="primary" size="sm" loading={state.loading}>
                Create memory
              </Button>
            </div>
          </form>
        )}

        {/* Manage */}
        {subTab === 'manage' && (
          <div class="flex flex-col gap-4">
            <Input
              label="Memory ID"
              value={memoryId}
              onInput={(e) => setMemoryId((e.target as HTMLInputElement).value)}
            />
            <Textarea
              label="Updated content (optional)"
              value={updatedContent}
              onInput={(e) => setUpdatedContent((e.target as HTMLTextAreaElement).value)}
              rows={3}
            />
            <Textarea
              label="Updated metadata JSON (optional)"
              value={updatedMetadata}
              onInput={(e) => setUpdatedMetadata((e.target as HTMLTextAreaElement).value)}
              rows={3}
              mono
              placeholder='{}'
            />
            <Toggle
              checked={isStatic}
              onChange={setIsStatic}
              label="Set memory as static (exempt from forgetting)"
            />
            <Input
              label="Delete reason (optional)"
              value={deleteReason}
              onInput={(e) => setDeleteReason((e.target as HTMLInputElement).value)}
            />
            <div class="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={state.loading}
                disabled={!memoryId.trim()}
                onClick={() => void getMemory()}
              >
                Get
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={state.loading}
                disabled={!memoryId.trim()}
                onClick={updateMemory}
              >
                Update
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={state.loading}
                disabled={!memoryId.trim()}
                onClick={() => void deleteMemory()}
              >
                Delete
              </Button>
            </div>
          </div>
        )}

        {/* Forget */}
        {subTab === 'forget' && (
          <div class="flex flex-col gap-4">
            <Textarea
              label="Memory content to forget"
              value={forgetContent}
              onInput={(e) => setForgetContent((e.target as HTMLTextAreaElement).value)}
              rows={3}
              placeholder="Describe the memory to forget..."
            />
            <Input
              label="Reason (optional)"
              value={forgetReason}
              onInput={(e) => setForgetReason((e.target as HTMLInputElement).value)}
            />
            <div class="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                loading={state.loading}
                disabled={!forgetContent.trim()}
                onClick={() => void forgetByContent()}
              >
                Forget
              </Button>
            </div>
          </div>
        )}

        {state.error && <p class="msg-error text-sm mt-4">{state.error}</p>}
      </Panel>

      {state.result && (
        <Panel title="Response">
          <JsonView data={state.result} label="Memories response" />
        </Panel>
      )}
    </div>
  );
}
