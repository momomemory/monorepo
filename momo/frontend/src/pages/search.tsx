import { useState } from 'preact/hooks';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { apiEnvelope } from '../api';
import { useApiAction } from '../hooks/use-api-action';
import { useApp } from '../context/app-context';
import { Panel } from '../components/ui/panel';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Toggle } from '../components/ui/toggle';
import { JsonView } from '../components/ui/json-view';

function parseOptionalNumber(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) throw new Error(`Invalid number: ${input}`);
  return value;
}

export function SearchPage() {
  const { apiKey, containerTag, onAuthFailure } = useApp();
  const [state, run, reset] = useApiAction(onAuthFailure);

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'hybrid' | 'documents' | 'memories'>('hybrid');
  const [limit, setLimit] = useState('20');
  const [threshold, setThreshold] = useState('');
  const [rerank, setRerank] = useState(false);
  const [includeDocuments, setIncludeDocuments] = useState(true);
  const [includeChunks, setIncludeChunks] = useState(false);

  const onSubmit = async (e: Event) => {
    e.preventDefault();
    try {
      await run(() =>
        apiEnvelope(apiKey, '/search', {
          method: 'POST',
          body: {
            q: query,
            scope,
            containerTags: containerTag.trim() ? [containerTag.trim()] : undefined,
            threshold: parseOptionalNumber(threshold),
            limit: parseOptionalNumber(limit),
            include: { documents: includeDocuments, chunks: includeChunks },
            rerank,
          },
        }),
      );
    } catch (err) {
      void run(async () => ({
        ok: false,
        status: 0,
        error: err instanceof Error ? err.message : 'Invalid parameters',
      }));
    }
  };

  return (
    <div class="px-6 py-6 flex flex-col gap-6 max-w-3xl">
      <div>
        <h1
          class="font-mono font-medium text-sm tracking-wide"
          style={{ color: 'var(--c-text)', letterSpacing: '0.04em' }}
        >
          Search
        </h1>
        <p class="text-xs mt-0.5" style={{ color: 'var(--c-text-3)' }}>
          Unified hybrid search across documents and memories
        </p>
      </div>

      <Panel title="Query">
        <form onSubmit={onSubmit} class="flex flex-col gap-4">
          <Input
            label="Query"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            placeholder="What are you looking for?"
            required
          />

          <div class="grid grid-cols-2 gap-3">
            <Select
              label="Scope"
              value={scope}
              onChange={(e) => setScope((e.target as HTMLSelectElement).value as typeof scope)}
            >
              <option value="hybrid">Hybrid</option>
              <option value="documents">Documents only</option>
              <option value="memories">Memories only</option>
            </Select>

            <Input
              label="Limit"
              value={limit}
              onInput={(e) => setLimit((e.target as HTMLInputElement).value)}
              placeholder="20"
            />
          </div>

          <Input
            label="Threshold (optional)"
            value={threshold}
            onInput={(e) => setThreshold((e.target as HTMLInputElement).value)}
            placeholder="0.5"
          />

          <div class="flex flex-col gap-2">
            <Toggle
              checked={rerank}
              onChange={(v) => setRerank(v)}
              label="Enable reranking"
            />
            <Toggle
              checked={includeDocuments}
              onChange={(v) => setIncludeDocuments(v)}
              label="Include documents"
            />
            <Toggle
              checked={includeChunks}
              onChange={(v) => setIncludeChunks(v)}
              label="Include document chunks"
            />
          </div>

          <div class="flex items-center gap-2 pt-1">
            <Button type="submit" variant="primary" loading={state.loading}>
              <MagnifyingGlass size={13} />
              Search
            </Button>
            {state.result && (
              <Button variant="ghost" size="sm" onClick={reset}>Clear</Button>
            )}
          </div>

          {state.error && (
            <p class="msg-error text-sm">{state.error}</p>
          )}
        </form>
      </Panel>

      {state.result && (
        <Panel title="Results">
          <JsonView data={state.result} label="Search response" />
        </Panel>
      )}
    </div>
  );
}
