import { useState } from 'preact/hooks';
import { apiEnvelope } from '../api';
import { useApiAction } from '../hooks/use-api-action';
import { useApp } from '../context/app-context';
import { Panel } from '../components/ui/panel';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Toggle } from '../components/ui/toggle';
import { JsonView } from '../components/ui/json-view';

type SubTab = 'list' | 'create' | 'batch' | 'ingest';

function parseJsonObject(input: string): Record<string, unknown> | undefined {
  if (!input.trim()) return undefined;
  const parsed = JSON.parse(input) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new Error('Metadata must be a JSON object');
  return parsed as Record<string, unknown>;
}

function parseCommaList(input: string): string[] {
  return input.split(',').map((s) => s.trim()).filter(Boolean);
}

export function DocumentsPage() {
  const { apiKey, containerTag, onAuthFailure } = useApp();
  const [state, run, reset] = useApiAction(onAuthFailure);
  const [subTab, setSubTab] = useState<SubTab>('list');

  // List
  const [listLimit, setListLimit] = useState('20');
  const [listCursor, setListCursor] = useState('');

  // Create
  const [docContent, setDocContent] = useState('');
  const [docCustomId, setDocCustomId] = useState('');
  const [docContentType, setDocContentType] = useState('');
  const [docMetadata, setDocMetadata] = useState('');
  const [extractMemories, setExtractMemories] = useState(false);

  // Batch
  const [batchLines, setBatchLines] = useState('');
  const [batchMetadata, setBatchMetadata] = useState('');

  // Ingest / manage
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMetadata, setUploadMetadata] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [ingestionId, setIngestionId] = useState('');
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateMetadata, setUpdateMetadata] = useState('');
  const [updateContainerTags, setUpdateContainerTags] = useState('');

  const listDocuments = async () => {
    const q = new URLSearchParams();
    if (containerTag.trim()) q.append('containerTags', containerTag.trim());
    if (listLimit.trim()) q.append('limit', listLimit.trim());
    if (listCursor.trim()) q.append('cursor', listCursor.trim());
    const suffix = q.toString() ? `?${q.toString()}` : '';
    await run(() => apiEnvelope(apiKey, `/documents${suffix}`));
  };

  const createDocument = async (e: Event) => {
    e.preventDefault();
    try {
      const metadata = parseJsonObject(docMetadata);
      const res = await run(() =>
        apiEnvelope<{ documentId?: string; ingestionId?: string }>(apiKey, '/documents', {
          method: 'POST',
          body: {
            content: docContent,
            containerTag: containerTag.trim() || undefined,
            customId: docCustomId.trim() || undefined,
            metadata,
            contentType: docContentType.trim() || undefined,
            extractMemories,
          },
        }),
      );
      if (res.ok && res.envelope?.data?.documentId) {
        setDocumentId(res.envelope.data.documentId);
        setIngestionId(res.envelope.data.ingestionId ?? res.envelope.data.documentId);
        setSubTab('ingest');
      }
    } catch (err) {
      void run(async () => ({ ok: false, status: 0, error: err instanceof Error ? err.message : 'Invalid metadata' }));
    }
  };

  const batchCreate = async () => {
    try {
      const lines = batchLines.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) throw new Error('Add at least one document line');
      const metadata = parseJsonObject(batchMetadata);
      await run(() =>
        apiEnvelope(apiKey, '/documents:batch', {
          method: 'POST',
          body: {
            documents: lines.map((content) => ({ content, extractMemories })),
            containerTag: containerTag.trim() || undefined,
            metadata,
          },
        }),
      );
    } catch (err) {
      void run(async () => ({ ok: false, status: 0, error: err instanceof Error ? err.message : 'Invalid input' }));
    }
  };

  const uploadDocument = async () => {
    if (!uploadFile) {
      void run(async () => ({ ok: false, status: 0, error: 'Select a file first' }));
      return;
    }
    const fd = new FormData();
    fd.append('file', uploadFile);
    if (containerTag.trim()) fd.append('containerTag', containerTag.trim());
    if (uploadMetadata.trim()) fd.append('metadata', uploadMetadata);
    await run(() =>
      apiEnvelope<{ documentId?: string; ingestionId?: string }>(apiKey, '/documents:upload', {
        method: 'POST',
        body: fd,
      }),
    );
  };

  const getDocument = () => run(() => apiEnvelope(apiKey, `/documents/${encodeURIComponent(documentId.trim())}`));

  const updateDocument = async () => {
    try {
      const metadata = parseJsonObject(updateMetadata);
      const tags = parseCommaList(updateContainerTags);
      await run(() =>
        apiEnvelope(apiKey, `/documents/${encodeURIComponent(documentId.trim())}`, {
          method: 'PATCH',
          body: {
            title: updateTitle.trim() || undefined,
            metadata,
            containerTags: tags.length ? tags : undefined,
          },
        }),
      );
    } catch (err) {
      void run(async () => ({ ok: false, status: 0, error: err instanceof Error ? err.message : 'Invalid update' }));
    }
  };

  const deleteDocument = () =>
    run(() =>
      apiEnvelope(apiKey, `/documents/${encodeURIComponent(documentId.trim())}`, { method: 'DELETE' }),
    );

  const getIngestionStatus = () =>
    run(() => apiEnvelope(apiKey, `/ingestions/${encodeURIComponent(ingestionId.trim())}`));

  return (
    <div class="px-6 py-6 flex flex-col gap-6 max-w-3xl">
      <div>
        <h1
          class="font-mono font-medium text-sm tracking-wide"
          style={{ color: 'var(--c-text)', letterSpacing: '0.04em' }}
        >
          Documents
        </h1>
        <p class="text-xs mt-0.5" style={{ color: 'var(--c-text-3)' }}>
          Create, manage, and ingest documents
        </p>
      </div>

      <Panel title="Documents">
        {/* Sub-tab bar */}
        <div class="subtab-bar">
          {(['list', 'create', 'batch', 'ingest'] as SubTab[]).map((t) => (
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
                value={listLimit}
                onInput={(e) => setListLimit((e.target as HTMLInputElement).value)}
                placeholder="20"
              />
              <Input
                label="Cursor"
                value={listCursor}
                onInput={(e) => setListCursor((e.target as HTMLInputElement).value)}
                placeholder="Next page cursor"
              />
            </div>
            <div class="flex gap-2">
              <Button variant="primary" size="sm" loading={state.loading} onClick={listDocuments}>
                List documents
              </Button>
            </div>
          </div>
        )}

        {/* Create */}
        {subTab === 'create' && (
          <form onSubmit={createDocument} class="flex flex-col gap-4">
            <Textarea
              label="Content"
              value={docContent}
              onInput={(e) => setDocContent((e.target as HTMLTextAreaElement).value)}
              rows={5}
              required
            />
            <div class="grid grid-cols-2 gap-3">
              <Input
                label="Custom ID (optional)"
                value={docCustomId}
                onInput={(e) => setDocCustomId((e.target as HTMLInputElement).value)}
              />
              <Input
                label="Content type (optional)"
                value={docContentType}
                onInput={(e) => setDocContentType((e.target as HTMLInputElement).value)}
                placeholder="text/plain"
              />
            </div>
            <Textarea
              label="Metadata JSON (optional)"
              value={docMetadata}
              onInput={(e) => setDocMetadata((e.target as HTMLTextAreaElement).value)}
              rows={3}
              mono
              placeholder='{}'
            />
            <Toggle
              checked={extractMemories}
              onChange={setExtractMemories}
              label="Extract memories from document"
            />
            <div class="flex gap-2">
              <Button type="submit" variant="primary" size="sm" loading={state.loading}>
                Create document
              </Button>
            </div>
          </form>
        )}

        {/* Batch */}
        {subTab === 'batch' && (
          <div class="flex flex-col gap-4">
            <Textarea
              label="Document contents (one per line)"
              value={batchLines}
              onInput={(e) => setBatchLines((e.target as HTMLTextAreaElement).value)}
              rows={7}
              placeholder="First document content&#10;Second document content&#10;Third document content"
            />
            <Textarea
              label="Shared metadata JSON (optional)"
              value={batchMetadata}
              onInput={(e) => setBatchMetadata((e.target as HTMLTextAreaElement).value)}
              rows={3}
              mono
              placeholder='{}'
            />
            <Toggle
              checked={extractMemories}
              onChange={setExtractMemories}
              label="Extract memories from documents"
            />
            <div class="flex gap-2">
              <Button variant="primary" size="sm" loading={state.loading} onClick={batchCreate}>
                Batch create
              </Button>
            </div>
          </div>
        )}

        {/* Ingest / manage */}
        {subTab === 'ingest' && (
          <div class="flex flex-col gap-5">
            <div>
              <p class="section-label mb-3">Upload file</p>
              <div class="flex flex-col gap-3">
                <div class="flex flex-col gap-1">
                  <label class="field-label">File</label>
                  <input
                    class="field-input"
                    type="file"
                    onInput={(e) => setUploadFile((e.target as HTMLInputElement).files?.[0] ?? null)}
                  />
                </div>
                <Textarea
                  label="Upload metadata JSON (optional)"
                  value={uploadMetadata}
                  onInput={(e) => setUploadMetadata((e.target as HTMLTextAreaElement).value)}
                  rows={3}
                  mono
                  placeholder='{}'
                />
                <div class="flex gap-2">
                  <Button variant="primary" size="sm" loading={state.loading} onClick={uploadDocument}>
                    Upload
                  </Button>
                </div>
              </div>
            </div>

            <div class="divider" />

            <div>
              <p class="section-label mb-3">Manage by ID</p>
              <div class="flex flex-col gap-3">
                <div class="grid grid-cols-2 gap-3">
                  <Input
                    label="Document ID"
                    value={documentId}
                    onInput={(e) => setDocumentId((e.target as HTMLInputElement).value)}
                  />
                  <Input
                    label="Ingestion ID"
                    value={ingestionId}
                    onInput={(e) => setIngestionId((e.target as HTMLInputElement).value)}
                  />
                </div>
                <Input
                  label="Update title (optional)"
                  value={updateTitle}
                  onInput={(e) => setUpdateTitle((e.target as HTMLInputElement).value)}
                />
                <Textarea
                  label="Update metadata JSON (optional)"
                  value={updateMetadata}
                  onInput={(e) => setUpdateMetadata((e.target as HTMLTextAreaElement).value)}
                  rows={3}
                  mono
                  placeholder='{}'
                />
                <Input
                  label="Update container tags (comma-separated, optional)"
                  value={updateContainerTags}
                  onInput={(e) => setUpdateContainerTags((e.target as HTMLInputElement).value)}
                  placeholder="tag1, tag2"
                />
                <div class="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={state.loading}
                    disabled={!documentId.trim()}
                    onClick={() => void getDocument()}
                  >
                    Get
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={state.loading}
                    disabled={!documentId.trim()}
                    onClick={updateDocument}
                  >
                    Update
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={state.loading}
                    disabled={!documentId.trim()}
                    onClick={() => void deleteDocument()}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={state.loading}
                    disabled={!ingestionId.trim()}
                    onClick={() => void getIngestionStatus()}
                  >
                    Ingestion status
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {state.error && <p class="msg-error text-sm mt-4">{state.error}</p>}
      </Panel>

      {state.result && (
        <Panel title="Response">
          <JsonView data={state.result} label="Documents response" />
        </Panel>
      )}
    </div>
  );
}
