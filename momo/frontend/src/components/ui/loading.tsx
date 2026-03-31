interface LoadingProps {
  message?: string;
  size?: 'sm' | 'md';
}

export function Loading({ message = 'Loading...', size = 'md' }: LoadingProps) {
  const spinSize = size === 'sm' ? '14px' : '18px';

  return (
    <div class="flex items-center gap-3" style={{ color: 'var(--c-text-3)' }}>
      <span
        class="inline-block border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0"
        style={{
          width: spinSize,
          height: spinSize,
          borderTopColor: 'transparent',
        }}
      />
      <span class="font-mono text-xs">{message}</span>
    </div>
  );
}

export function PageLoading() {
  return (
    <div class="flex items-center justify-center" style={{ height: '200px' }}>
      <Loading message="Loading..." />
    </div>
  );
}

export function SkeletonLine({ width = '100%' }: { width?: string }) {
  return (
    <div
      class="rounded animate-pulse"
      style={{
        width,
        height: '14px',
        backgroundColor: 'var(--c-surface-hi)',
      }}
    />
  );
}

export function SkeletonBlock({ height = '60px' }: { height?: string }) {
  return (
    <div
      class="rounded animate-pulse"
      style={{
        width: '100%',
        height,
        backgroundColor: 'var(--c-surface-hi)',
      }}
    />
  );
}
