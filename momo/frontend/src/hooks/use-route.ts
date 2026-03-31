import { useState, useEffect } from 'preact/hooks';

export type RouteId = 'dashboard' | 'search' | 'documents' | 'memories' | 'graph' | 'settings';

const VALID_ROUTES: RouteId[] = [
  'dashboard',
  'search',
  'documents',
  'memories',
  'graph',
  'settings',
];

// Aliases for old routes → new destinations
const ROUTE_ALIASES: Record<string, RouteId> = {
  '': 'dashboard',
  '/': 'dashboard',
  'system': 'dashboard',
  'admin': 'settings',
  'profile': 'settings',
  'conversation': 'settings',
};

function parseRoute(hash: string): RouteId {
  const id = hash.replace(/^#\/?/, '').trim();
  if (VALID_ROUTES.includes(id as RouteId)) return id as RouteId;
  if (id in ROUTE_ALIASES) return ROUTE_ALIASES[id];
  return 'dashboard';
}

export function useRoute() {
  const [route, setRoute] = useState<RouteId>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (to: RouteId) => {
    window.location.hash = `/${to}`;
  };

  return { route, navigate };
}
