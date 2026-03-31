import type { ComponentChildren } from 'preact';

interface PanelProps {
  title?: string;
  actions?: ComponentChildren;
  children: ComponentChildren;
  tight?: boolean;
  class?: string;
}

export function Panel({ title, actions, children, tight = false, class: cls }: PanelProps) {
  const base = tight ? 'panel-tight' : 'panel';
  const classes = [base, cls].filter(Boolean).join(' ');

  return (
    <div class={classes}>
      {(title || actions) && (
        <div class="flex items-center justify-between mb-4">
          {title && (
            <h2
              class="font-mono text-xs font-medium tracking-widest uppercase"
              style={{ color: 'var(--c-text-3)' }}
            >
              {title}
            </h2>
          )}
          {actions && <div class="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
