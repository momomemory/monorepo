import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { RouteId } from '../hooks/use-route';

export interface AppContextValue {
  apiKey: string;
  containerTag: string;
  setContainerTag: (tag: string) => void;
  onAuthFailure: (message: string) => void;
  navigate: (route: RouteId) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be called inside AppContext.Provider');
  return ctx;
}
