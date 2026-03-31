import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { ArrowClockwise } from '@phosphor-icons/react';
import { apiEnvelope } from '../api';
import { useApiAction } from '../hooks/use-api-action';
import { useApp } from '../context/app-context';
import { Panel } from '../components/ui/panel';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { JsonView } from '../components/ui/json-view';
import { GraphCanvas } from '../components/GraphCanvas';
import type { ContainerTagsResponse, GraphNodeResponse, GraphResponse } from '../types';

function parseOptionalNumber(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) throw new Error(`Invalid number: ${input}`);
  return value;
}

export function GraphPage() {
  const { apiKey, containerTag, setContainerTag, onAuthFailure } = useApp();
  const [graphState, runGraph] = useApiAction(onAuthFailure);
  const [tagsState, runTags] = useApiAction(onAuthFailure);

  const [mode, setMode] = useState<'container' | 'memory'>('container');
  const [memoryId, setMemoryId] = useState('');
  const [maxNodes, setMaxNodes] = useState('100');
  const [depth, setDepth] = useState('2');
  const [relationTypes, setRelationTypes] = useState('');
  const [containerTags, setContainerTags] = useState<string[]>([]);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNodeResponse | null>(null);

  const graphStats = useMemo(() => {
    const nodeCount = graph?.nodes.length ?? 0;
    const edgeCount = graph?.links.length ?? 0;
    return {
      nodeCount,
      edgeCount,
      sparse: nodeCount > 0 && edgeCount < Math.max(2, Math.floor(nodeCount / 4)),
    };
  }, [graph]);

  const loadTags = useCallback(async () => {
    const res = await runTags(() => apiEnvelope<ContainerTagsResponse>(apiKey, '/containers/tags'));
    if (res.ok && res.envelope?.data) {
      setContainerTags(
        (res.envelope.data.tags ?? [])
          .map((t) => t.trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b)),
      );
    }
  }, [apiKey, runTags]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  const loadGraph = async (overrides?: { mode?: 'container' | 'memory'; tag?: string }) => {
    const reqMode = overrides?.mode ?? mode;
    const tag = (overrides?.tag ?? containerTag).trim();

    try {
      const maxNodesVal = parseOptionalNumber(maxNodes);
      const depthVal = parseOptionalNumber(depth);

      if (reqMode === 'container') {
        if (!tag) {
          void runGraph(async () => ({ ok: false, status: 0, error: 'Container tag required. Set one in the scope bar.' }));
          return;
        }
        const q = new URLSearchParams();
        if (maxNodesVal !== undefined) q.append('maxNodes', String(Math.trunc(maxNodesVal)));
        const suffix = q.toString() ? `?${q.toString()}` : '';
        const res = await runGraph(() =>
          apiEnvelope<GraphResponse>(apiKey, `/containers/${encodeURIComponent(tag)}/graph${suffix}`),
        );
        if (res.ok) setGraph(res.envelope?.data ?? null);
        return;
      }

      if (!memoryId.trim()) {
        void runGraph(async () => ({ ok: false, status: 0, error: 'Memory ID is required for memory graph' }));
        return;
      }
      const q = new URLSearchParams();
      if (maxNodesVal !== undefined) q.append('maxNodes', String(Math.trunc(maxNodesVal)));
      if (depthVal !== undefined) q.append('depth', String(Math.trunc(depthVal)));
      const relList = relationTypes.split(',').map((s) => s.trim()).filter(Boolean);
      if (relList.length) q.append('relationTypes', relList.join(','));
      const suffix = q.toString() ? `?${q.toString()}` : '';
      const res = await runGraph(() =>
        apiEnvelope<GraphResponse>(apiKey, `/memories/${encodeURIComponent(memoryId.trim())}/graph${suffix}`),
      );
      if (res.ok) setGraph(res.envelope?.data ?? null);
    } catch (err) {
      void runGraph(async () => ({
        ok: false,
        status: 0,
        error: err instanceof Error ? err.message : 'Invalid parameters',
      }));
    }
  };

  const loadForTag = async (tag: string) => {
    setContainerTag(tag);
    setMode('container');
    await loadGraph({ mode: 'container', tag });
  };

  return (
    <div class="px-6 py-6 flex flex-col gap-6">
      <div>
        <h1
          class="font-mono font-medium text-sm tracking-wide"
          style={{ color: 'var(--c-text)', letterSpacing: '0.04em' }}
        >
          Graph
        </h1>
        <p class="text-xs mt-0.5" style={{ color: 'var(--c-text-3)' }}>
          Visualize memory and document relationships
        </p>
      </div>

      <div class="grid gap-6" style={{ gridTemplateColumns: '280px 1fr' }}>
        {/* Left: query controls */}
        <div class="flex flex-col gap-4">
          <Panel title="Query">
            <div class="flex flex-col gap-3">
              <Select
                label="Mode"
                value={mode}
                onChange={(e) => setMode((e.target as HTMLSelectElement).value as typeof mode)}
              >
                <option value="container">Container graph</option>
                <option value="memory">Memory graph</option>
              </Select>

              {mode === 'memory' && (
                <Input
                  label="Memory ID"
                  value={memoryId}
                  onInput={(e) => setMemoryId((e.target as HTMLInputElement).value)}
                />
              )}

              <Input
                label="Max nodes"
                value={maxNodes}
                onInput={(e) => setMaxNodes((e.target as HTMLInputElement).value)}
                placeholder="100"
              />

              {mode === 'memory' && (
                <>
                  <Input
                    label="Depth"
                    value={depth}
                    onInput={(e) => setDepth((e.target as HTMLInputElement).value)}
                    placeholder="2"
                  />
                  <Input
                    label="Relation types (comma-separated)"
                    value={relationTypes}
                    onInput={(e) => setRelationTypes((e.target as HTMLInputElement).value)}
                    placeholder="updates, relatesTo, sources"
                  />
                </>
              )}

              <div class="flex gap-2 pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  loading={graphState.loading}
                  onClick={() => void loadGraph()}
                >
                  Load graph
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setGraph(null);
                    setSelectedNode(null);
                  }}
                >
                  Clear
                </Button>
              </div>

              {graphState.error && (
                <p class="msg-error text-xs">{graphState.error}</p>
              )}
            </div>
          </Panel>

          <Panel
            title="Container tags"
            actions={
              <Button
                variant="ghost"
                size="sm"
                loading={tagsState.loading}
                onClick={loadTags}
              >
                <ArrowClockwise size={11} />
              </Button>
            }
          >
            {tagsState.loading && (
              <p class="font-mono text-xs" style={{ color: 'var(--c-text-3)' }}>Loading...</p>
            )}
            {!tagsState.loading && containerTags.length === 0 && (
              <p class="font-mono text-xs" style={{ color: 'var(--c-text-3)' }}>No container tags found.</p>
            )}
            {containerTags.length > 0 && (
              <div class="flex flex-col gap-1">
                {containerTags.map((tag) => (
                  <button
                    key={tag}
                    class="text-left font-mono text-xs px-2.5 py-1.5 rounded transition-colors"
                    style={{
                      background: containerTag.trim() === tag ? 'var(--c-surface-hi)' : 'transparent',
                      border: '1px solid',
                      borderColor: containerTag.trim() === tag ? 'var(--c-border-hi)' : 'transparent',
                      color: containerTag.trim() === tag ? 'var(--c-text)' : 'var(--c-text-2)',
                    }}
                    onClick={() => void loadForTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Right: visualization */}
        <div class="flex flex-col gap-4">
          <Panel title="Visualization">
            {graph && (
              <p class="font-mono text-xs mb-3" style={{ color: 'var(--c-text-3)' }}>
                {graphStats.nodeCount} nodes · {graphStats.edgeCount} relationships
                {graphStats.sparse && ' · sparse graph'}
              </p>
            )}

            <GraphCanvas graph={graph} onNodeSelect={setSelectedNode} />

            {selectedNode && (
              <div
                class="mt-4 p-3 rounded"
                style={{ background: 'var(--c-surface-hi)', border: '1px solid var(--c-border)' }}
              >
                <p class="font-mono text-xs font-medium mb-1" style={{ color: 'var(--c-text)' }}>
                  {selectedNode.id} · {selectedNode.type}
                </p>
                <JsonView data={selectedNode.metadata} label="Node metadata" defaultCollapsed={false} />
              </div>
            )}

            {!graph && !graphState.loading && (
              <div class="flex flex-col items-center justify-center py-12 gap-2">
                <p class="font-mono text-xs" style={{ color: 'var(--c-text-3)' }}>
                  Load a graph using the controls on the left.
                </p>
              </div>
            )}
          </Panel>

          {graphState.result && (
            <Panel title="Raw response">
              <JsonView data={graphState.result} label="Graph response" defaultCollapsed />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
