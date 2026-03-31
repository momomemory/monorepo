import { useEffect, useMemo } from 'preact/hooks';
import { ArrowSquareOut, ArrowClockwise } from '@phosphor-icons/react';
import { apiEnvelope, apiRaw, getEffectiveApiBase } from '../api';
import { useApiAction } from '../hooks/use-api-action';
import { useApp } from '../context/app-context';
import { Panel } from '../components/ui/panel';
import { Button } from '../components/ui/button';
import { JsonView } from '../components/ui/json-view';
import { SkeletonBlock } from '../components/ui/loading';
import type { HealthData } from '../types';

function parseHealthData(result: unknown): HealthData | null {
  if (!result || typeof result !== 'object') return null;
  const maybeEnvelope = result as { data?: unknown };
  const payload = maybeEnvelope.data ?? result;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (!('status' in payload)) return null;
  return payload as HealthData;
}

function statusVariant(status: string | undefined): 'ok' | 'error' | 'warn' {
  const s = (status ?? '').toLowerCase();
  if (s === 'ok' || s === 'healthy' || s === 'up' || s === 'available' || s === 'ready') return 'ok';
  if (!s || s === 'unknown') return 'warn';
  return 'error';
}

const STATUS_COLORS = {
  ok: { bg: 'var(--c-ok-bg)', border: 'var(--c-ok)', text: 'var(--c-ok)' },
  warn: { bg: 'var(--c-warn-bg)', border: 'var(--c-warn)', text: 'var(--c-warn)' },
  error: { bg: 'var(--c-err-bg)', border: 'var(--c-err)', text: 'var(--c-err)' },
} as const;

interface HealthCardProps {
  title: string;
  status: string | undefined;
  detail: string;
}

function HealthCard({ title, status, detail }: HealthCardProps) {
  const variant = statusVariant(status);
  const colors = STATUS_COLORS[variant];

  return (
    <div
      class="flex flex-col gap-1.5 px-4 py-3.5 rounded"
      style={{
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
      }}
    >
      <div class="flex items-center justify-between gap-2">
        <span class="font-mono text-xs section-label">{title}</span>
        <span
          class="font-mono text-xs font-medium"
          style={{ color: colors.text }}
        >
          {status ?? 'unknown'}
        </span>
      </div>
      <p class="text-xs" style={{ color: 'var(--c-text-3)' }}>{detail}</p>
    </div>
  );
}

export function DashboardPage() {
  const { apiKey, onAuthFailure } = useApp();
  const [healthState, runHealth] = useApiAction(onAuthFailure);
  const [openapiState, runOpenapi, resetOpenapi] = useApiAction(onAuthFailure);

  const healthData = useMemo(() => parseHealthData(healthState.result), [healthState.result]);
  const effectiveBase = getEffectiveApiBase();

  useEffect(() => {
    void runHealth(() => apiEnvelope<HealthData>(apiKey, '/health', { auth: false }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div class="px-6 py-6 flex flex-col gap-6 max-w-3xl">
      {/* Page header */}
      <div>
        <h1
          class="font-mono font-medium text-sm tracking-wide"
          style={{ color: 'var(--c-text)', letterSpacing: '0.04em' }}
        >
          Dashboard
        </h1>
        <p class="text-xs mt-0.5" style={{ color: 'var(--c-text-3)' }}>
          Service health and API status
        </p>
      </div>

      {/* Health panel */}
      <Panel
        title="Service health"
        actions={
          <Button
            variant="ghost"
            size="sm"
            loading={healthState.loading}
            onClick={() => runHealth(() => apiEnvelope<HealthData>(apiKey, '/health', { auth: false }))}
          >
            <ArrowClockwise size={12} />
            Refresh
          </Button>
        }
      >
        {healthState.loading && !healthData && (
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[...Array(5)].map((_, i) => <SkeletonBlock key={i} height="72px" />)}
          </div>
        )}

        {healthState.error && (
          <p class="msg-error text-xs">{healthState.error}</p>
        )}

        {healthData && (
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <HealthCard
              title="Service"
              status={healthData.status}
              detail={`Version ${healthData.version}`}
            />
            <HealthCard
              title="Database"
              status={healthData.database?.status}
              detail="LibSQL"
            />
            <HealthCard
              title="Embeddings"
              status={healthData.embeddings?.status}
              detail={`${healthData.embeddings?.model ?? 'n/a'} · ${healthData.embeddings?.dimensions ?? '?'}d`}
            />
            <HealthCard
              title="LLM"
              status={healthData.llm?.status}
              detail={`${healthData.llm?.provider ?? 'local'} / ${healthData.llm?.model ?? 'n/a'}`}
            />
            <HealthCard
              title="Reranker"
              status={healthData.reranker?.status}
              detail={healthData.reranker?.enabled ? `${healthData.reranker?.model ?? 'n/a'}` : 'Disabled'}
            />
          </div>
        )}

        {!healthState.loading && !healthState.error && !healthData && (
          <p class="text-xs" style={{ color: 'var(--c-text-3)' }}>
            Health endpoint did not return structured data.
          </p>
        )}

        {healthState.result && (
          <div class="mt-4">
            <JsonView data={healthState.result} label="Raw response" defaultCollapsed />
          </div>
        )}
      </Panel>

      {/* API panel */}
      <Panel title="API">
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs font-mono" style={{ color: 'var(--c-text-2)' }}>Base URL</p>
              <p class="font-mono text-xs mt-0.5" style={{ color: 'var(--c-text-3)' }}>{effectiveBase}</p>
            </div>
            <a
              href={`${effectiveBase}/docs`}
              target="_blank"
              rel="noreferrer"
              class="btn btn-secondary btn-sm inline-flex items-center gap-1.5"
            >
              <ArrowSquareOut size={12} />
              API docs
            </a>
          </div>

          <div class="divider" />

          <div class="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              loading={openapiState.loading}
              onClick={() => runOpenapi(() => apiRaw<Record<string, unknown>>(apiKey, '/openapi.json', { auth: false }))}
            >
              Fetch OpenAPI JSON
            </Button>
            {openapiState.result && (
              <Button variant="ghost" size="sm" onClick={resetOpenapi}>Clear</Button>
            )}
          </div>

          {openapiState.error && (
            <p class="msg-error text-xs">{openapiState.error}</p>
          )}

          {openapiState.result && (
            <JsonView data={openapiState.result} label="openapi.json" defaultCollapsed />
          )}
        </div>
      </Panel>
    </div>
  );
}
