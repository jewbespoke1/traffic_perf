export const SUBDOMAIN_COLORS: Record<string, string> = {
  www: '#4db9e7',
  api: '#47a0df',
  auth: '#8b5cf6',
  cdn: '#2dd4bf',
  media: '#f97316',
  blog: '#facc15',
  shop: '#06b6d4',
  support: '#f472b6',
  status: '#22d3ee',
  dev: '#a855f7',
  docs: '#38bdf8',
  analytics: '#f43f5e',
};

export function getColorForSubdomain(subdomain: string): string {
  return SUBDOMAIN_COLORS[subdomain] ?? '#4b5563';
}

