import { useState } from 'preact/hooks';
import { CaretDown, CaretRight, CopySimple, Check } from '@phosphor-icons/react';

interface JsonViewProps {
  data: unknown;
  label?: string;
  defaultCollapsed?: boolean;
}

export function JsonView({ data, label, defaultCollapsed = false }: JsonViewProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [copied, setCopied] = useState(false);

  const json = JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      class="rounded border"
      style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-bg)' }}
    >
      <div
        class="flex items-center justify-between px-3 py-2 border-b cursor-pointer"
        style={{ borderColor: 'var(--c-border)' }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div class="flex items-center gap-2">
          <span style={{ color: 'var(--c-text-3)' }}>
            {collapsed ? <CaretRight size={13} weight="bold" /> : <CaretDown size={13} weight="bold" />}
          </span>
          <span class="font-mono text-xs" style={{ color: 'var(--c-text-2)' }}>
            {label ?? 'response'}
          </span>
        </div>
        <button
          class="flex items-center gap-1.5 font-mono text-xs px-2 py-1 rounded transition-colors"
          style={{ color: 'var(--c-text-3)', backgroundColor: 'transparent' }}
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          title="Copy JSON"
        >
          {copied ? (
            <>
              <Check size={12} weight="bold" style={{ color: 'var(--c-ok)' }} />
              <span style={{ color: 'var(--c-ok)' }}>copied</span>
            </>
          ) : (
            <>
              <CopySimple size={12} />
              <span>copy</span>
            </>
          )}
        </button>
      </div>

      {!collapsed && (
        <pre
          class="p-4 overflow-auto text-xs leading-relaxed m-0"
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--c-text)',
            maxHeight: '420px',
          }}
        >
          {json}
        </pre>
      )}
    </div>
  );
}
