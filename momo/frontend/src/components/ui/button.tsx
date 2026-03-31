import type { ComponentChildren, JSX } from 'preact';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ComponentChildren;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  children,
  class: cls,
  ...rest
}: ButtonProps) {
  const variantClass = `btn-${variant}`;
  const sizeClass = size === 'sm' ? 'btn-sm' : '';
  const classes = ['btn', variantClass, sizeClass, cls].filter(Boolean).join(' ');

  return (
    <button class={classes} disabled={disabled || loading} {...rest}>
      {loading ? (
        <span class="inline-flex items-center gap-2">
          <span
            class="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"
            style={{ borderTopColor: 'transparent' }}
          />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
