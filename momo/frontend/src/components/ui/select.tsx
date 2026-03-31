import type { ComponentChildren, JSX } from 'preact';

interface SelectProps extends JSX.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ComponentChildren;
}

export function Select({ label, id, children, class: cls, ...rest }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div class="flex flex-col gap-1">
      {label && (
        <label class="field-label" for={selectId}>
          {label}
        </label>
      )}
      <select id={selectId} class={['field-input', cls].filter(Boolean).join(' ')} {...rest}>
        {children}
      </select>
    </div>
  );
}
