import type { JSX } from 'preact';

interface TextareaProps extends JSX.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  mono?: boolean;
}

export function Textarea({ label, hint, error, mono = false, id, class: cls, ...rest }: TextareaProps) {
  const taId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const monoStyle = mono ? { fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' } : undefined;

  return (
    <div class="flex flex-col gap-1">
      {label && (
        <label class="field-label" for={taId}>
          {label}
        </label>
      )}
      <textarea
        id={taId}
        class={['field-input', cls].filter(Boolean).join(' ')}
        style={monoStyle}
        {...rest}
      />
      {error && <span class="text-xs c-err font-mono">{error}</span>}
      {!error && hint && <span class="text-xs c-text-3 font-mono">{hint}</span>}
    </div>
  );
}
