import type { JSX } from 'preact';

interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  hint?: string;
}

export function Input({ label, error, hint, id, class: cls, ...rest }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div class="flex flex-col gap-1">
      {label && (
        <label class="field-label" for={inputId}>
          {label}
        </label>
      )}
      <input id={inputId} class={['field-input', cls].filter(Boolean).join(' ')} {...rest} />
      {error && <span class="text-xs c-err font-mono">{error}</span>}
      {!error && hint && <span class="text-xs c-text-3 font-mono">{hint}</span>}
    </div>
  );
}
