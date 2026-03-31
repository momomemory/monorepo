import type { JSX } from 'preact';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  id?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, id, disabled = false }: ToggleProps) {
  const toggleId = id ?? (label ? `toggle-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  const handleChange = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    onChange((e.target as HTMLInputElement).checked);
  };

  return (
    <label class="check-row" style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      <span class="toggle-wrap">
        <input
          type="checkbox"
          id={toggleId}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
        />
        <span class="toggle-slider" />
      </span>
      {label && <span>{label}</span>}
    </label>
  );
}
