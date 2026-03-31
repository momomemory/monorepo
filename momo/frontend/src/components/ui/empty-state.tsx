import type { ComponentChildren } from 'preact';

interface EmptyStateProps {
  icon?: ComponentChildren;
  title: string;
  description?: string;
  action?: ComponentChildren;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div class="flex flex-col items-center justify-center py-16 px-8 text-center">
      {icon && (
        <div class="mb-4" style={{ color: 'var(--c-text-3)' }}>
          {icon}
        </div>
      )}
      <p
        class="font-mono text-sm font-medium mb-1"
        style={{ color: 'var(--c-text-2)' }}
      >
        {title}
      </p>
      {description && (
        <p class="text-sm max-w-xs mb-4" style={{ color: 'var(--c-text-3)' }}>
          {description}
        </p>
      )}
      {action && <div class="mt-2">{action}</div>}
    </div>
  );
}
