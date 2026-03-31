import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { Tag, CaretDown, X } from '@phosphor-icons/react';
import { apiEnvelope } from '../../api';
import type { ContainerTagsResponse } from '../../types';

const SCOPE_STORAGE_KEY = 'momo.ui.scopeExpanded';

interface ScopeBarProps {
  apiKey: string;
  containerTag: string;
  onTagChange: (tag: string) => void;
}

export function ScopeBar({ apiKey, containerTag, onTagChange }: ScopeBarProps) {
  const [expanded, setExpanded] = useState(() => {
    return window.localStorage.getItem(SCOPE_STORAGE_KEY) === 'true';
  });
  const [inputValue, setInputValue] = useState(containerTag);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchTags = useCallback(async () => {
    if (!apiKey) return;
    setLoadingSuggestions(true);
    const res = await apiEnvelope<ContainerTagsResponse>(apiKey, '/containers/tags');
    if (res.ok && res.envelope?.data) {
      setSuggestions(res.envelope.data.tags ?? []);
    }
    setLoadingSuggestions(false);
  }, [apiKey]);

  useEffect(() => {
    setInputValue(containerTag);
  }, [containerTag]);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    window.localStorage.setItem(SCOPE_STORAGE_KEY, String(next));
    if (next) {
      fetchTags();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const applyTag = (tag: string) => {
    onTagChange(tag.trim());
    setExpanded(false);
    window.localStorage.setItem(SCOPE_STORAGE_KEY, 'false');
  };

  const clearTag = (e: MouseEvent) => {
    e.stopPropagation();
    onTagChange('');
    setInputValue('');
  };

  const filteredSuggestions = suggestions.filter(
    (s) => s.toLowerCase().includes(inputValue.toLowerCase()) && s !== inputValue,
  );

  return (
    <div
      class="relative"
      style={{ borderBottom: '1px solid var(--c-border)' }}
    >
      {/* Header row */}
      <div
        class="flex items-center gap-3 px-6 py-3 cursor-pointer"
        onClick={toggleExpanded}
      >
        <Tag size={13} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />

        <div class="flex items-center gap-2 flex-1 min-w-0">
          <span class="font-mono text-xs" style={{ color: 'var(--c-text-3)', whiteSpace: 'nowrap' }}>
            scope
          </span>
          {containerTag ? (
            <span
              class="scope-pill has-tag"
              style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {containerTag}
              <button
                onClick={clearTag}
                style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1, color: 'inherit' }}
              >
                <X size={10} weight="bold" />
              </button>
            </span>
          ) : (
            <span class="scope-pill" style={{ color: 'var(--c-text-3)' }}>
              global
            </span>
          )}
        </div>

        <CaretDown
          size={12}
          style={{
            color: 'var(--c-text-3)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      </div>

      {/* Expanded dropdown */}
      {expanded && (
        <div
          class="px-6 pb-4 pt-2"
          style={{ borderTop: '1px solid var(--c-border-lo)' }}
        >
          <div class="flex gap-2">
            <input
              ref={inputRef}
              class="field-input flex-1"
              type="text"
              placeholder="Enter container tag..."
              value={inputValue}
              onInput={(e) => setInputValue((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyTag(inputValue);
                if (e.key === 'Escape') toggleExpanded();
              }}
            />
            <button class="btn btn-primary" onClick={() => applyTag(inputValue)}>
              Apply
            </button>
          </div>

          {/* Suggestions */}
          {loadingSuggestions ? (
            <p class="font-mono text-xs mt-2" style={{ color: 'var(--c-text-3)' }}>
              Loading tags...
            </p>
          ) : filteredSuggestions.length > 0 ? (
            <div class="flex flex-wrap gap-1.5 mt-2">
              {filteredSuggestions.map((tag) => (
                <button
                  key={tag}
                  class="font-mono text-xs px-2 py-1 rounded cursor-pointer transition-colors"
                  style={{
                    background: 'var(--c-surface-hi)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-text-2)',
                  }}
                  onClick={() => {
                    setInputValue(tag);
                    applyTag(tag);
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
