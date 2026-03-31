import {
  House,
  MagnifyingGlass,
  Files,
  Brain,
  ShareNetwork,
  GearSix,
  Sun,
  Moon,
} from '@phosphor-icons/react';
import type { RouteId } from '../../hooks/use-route';
import type { Theme } from '../../hooks/use-theme';

interface NavItem {
  id: RouteId;
  label: string;
  icon: preact.ComponentChildren;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <House size={16} /> },
  { id: 'search', label: 'Search', icon: <MagnifyingGlass size={16} /> },
  { id: 'documents', label: 'Documents', icon: <Files size={16} /> },
  { id: 'memories', label: 'Memories', icon: <Brain size={16} /> },
  { id: 'graph', label: 'Graph', icon: <ShareNetwork size={16} /> },
  { id: 'settings', label: 'Settings', icon: <GearSix size={16} /> },
];

interface SidebarProps {
  activeRoute: RouteId;
  onNavigate: (route: RouteId) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Sidebar({ activeRoute, onNavigate, theme, onToggleTheme }: SidebarProps) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <aside
      class="flex flex-col h-full select-none"
      style={{
        width: '220px',
        backgroundColor: 'var(--c-surface)',
        borderRight: '1px solid var(--c-border)',
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <div
        class="flex flex-col px-4 py-5"
        style={{ borderBottom: '1px solid var(--c-border)' }}
      >
        <div class="flex items-center gap-2.5">
          {/* Starburst icon */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 128 128"
            style={{ flexShrink: 0 }}
          >
            <path
              fill-rule="evenodd"
              d="M81 36 64 0 47 36l-1 2-9-10a6 6 0 0 0-9 9l10 10h-2L0 64l36 17h2L28 91a6 6 0 1 0 9 9l9-10 1 2 17 36 17-36v-2l9 10a6 6 0 1 0 9-9l-9-9 2-1 36-17-36-17-2-1 9-9a6 6 0 1 0-9-9l-9 10v-2Zm-17 2-2 5c-4 8-11 15-19 19l-5 2 5 2c8 4 15 11 19 19l2 5 2-5c4-8 11-15 19-19l5-2-5-2c-8-4-15-11-19-19l-2-5Z"
              clip-rule="evenodd"
              fill="currentColor"
              style={{ color: 'var(--c-text)' }}
            />
            <path
              d="M118 19a6 6 0 0 0-9-9l-3 3a6 6 0 1 0 9 9l3-3Zm-96 4c-2 2-6 2-9 0l-3-3a6 6 0 1 1 9-9l3 3c3 2 3 6 0 9Zm0 82c-2-2-6-2-9 0l-3 3a6 6 0 1 0 9 9l3-3c3-2 3-6 0-9Zm96 4a6 6 0 0 1-9 9l-3-3a6 6 0 1 1 9-9l3 3Z"
              fill="currentColor"
              style={{ color: 'var(--c-text)' }}
            />
          </svg>
          <span
            class="font-mono font-medium tracking-wider"
            style={{ fontSize: '0.875rem', color: 'var(--c-text)' }}
          >
            momo
          </span>
        </div>
        <span
          class="font-mono mt-0.5 ml-7"
          style={{ fontSize: '0.6875rem', color: 'var(--c-text-3)', letterSpacing: '0.06em' }}
        >
          console
        </span>
      </div>

      {/* Nav items */}
      <nav class="flex flex-col flex-1 py-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            class={`nav-item ${activeRoute === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span style={{ opacity: activeRoute === item.id ? 1 : 0.6 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Theme toggle */}
      <div
        class="px-4 py-3"
        style={{ borderTop: '1px solid var(--c-border)' }}
      >
        <button
          class="flex items-center gap-2 w-full font-mono text-xs transition-colors"
          style={{ color: 'var(--c-text-3)', background: 'none', border: 'none' }}
          onClick={onToggleTheme}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
          <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
        </button>
      </div>
    </aside>
  );
}
