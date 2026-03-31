import type { ComponentChildren } from 'preact';

type BadgeVariant = 'ok' | 'error' | 'warn' | 'unknown';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ComponentChildren;
  dot?: boolean;
}

export function Badge({ variant = 'unknown', dot = false, children }: BadgeProps) {
  const variantClass = `status-${variant}`;

  return (
    <span class={`status-badge ${variantClass}`}>
      {dot && (
        <span
          class="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: 'currentColor' }}
        />
      )}
      {children}
    </span>
  );
}

export function StatusDot({ variant }: { variant: BadgeVariant }) {
  const colors: Record<BadgeVariant, string> = {
    ok: 'var(--c-ok)',
    error: 'var(--c-err)',
    warn: 'var(--c-warn)',
    unknown: 'var(--c-text-3)',
  };

  return (
    <span
      class="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: colors[variant] }}
    />
  );
}
