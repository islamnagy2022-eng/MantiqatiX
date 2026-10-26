export type AppRole = 'guest' | 'subscriber' | 'admin';
export type AppView = 'public_storefront' | 'merchant_admin' | 'super_admin' | 'login' | 'directory';

/**
 * One client-side view policy for every route and navigation entry.
 * Backend Edge Functions remain the authority for reading and mutating data.
 */
export function canAccessView(role: AppRole | string, view: AppView | string): boolean {
  const normalizedRole = String(role || 'guest').toLowerCase();
  const normalizedView = String(view || '');

  if (normalizedView === 'super_admin') return normalizedRole === 'admin';
  if (normalizedView === 'merchant_admin') return normalizedRole === 'admin' || normalizedRole === 'subscriber';

  // Login is a modal, not a routed screen. All other public views remain
  // available to visitors and authenticated accounts without an active catalog membership.
  if (normalizedView === 'login') return false;
  return normalizedView === 'directory' || normalizedView === 'public_storefront';
}

export function defaultViewForRole(role: AppRole | string): AppView {
  switch (String(role || 'guest').toLowerCase()) {
    case 'admin':
      return 'super_admin';
    case 'subscriber':
      return 'merchant_admin';
    default:
      return 'directory';
  }
}
