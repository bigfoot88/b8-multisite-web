import { useEffect, useLayoutEffect, useState } from 'react';

export const ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY = 'adminjs.sidebar.collapsed';
export const ADMIN_SIDEBAR_EVENT = 'adminjs:sidebar-preference';
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function normalizeCollapsedValue(value) {
  return value === true || value === '1';
}

export function readSidebarCollapsedPreference() {
  if (typeof window === 'undefined') {
    return false;
  }

  return normalizeCollapsedValue(window.localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY));
}

export function writeSidebarCollapsedPreference(collapsed) {
  if (typeof window === 'undefined') {
    return;
  }

  const nextCollapsed = typeof collapsed === 'function'
    ? Boolean(collapsed(readSidebarCollapsedPreference()))
    : Boolean(collapsed);
  window.localStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY, nextCollapsed ? '1' : '0');
  window.dispatchEvent(new CustomEvent(ADMIN_SIDEBAR_EVENT, {
    detail: {
      collapsed: nextCollapsed,
    },
  }));
}

export function useAdminSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readSidebarCollapsedPreference);
  const [hasMounted, setHasMounted] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    setCollapsed(readSidebarCollapsedPreference());
    setHasMounted(true);

    const syncCollapsed = (event) => {
      if (typeof event?.detail?.collapsed === 'boolean') {
        setCollapsed(event.detail.collapsed);
        return;
      }

      setCollapsed(readSidebarCollapsedPreference());
    };

    window.addEventListener(ADMIN_SIDEBAR_EVENT, syncCollapsed);
    window.addEventListener('storage', syncCollapsed);

    return () => {
      window.removeEventListener(ADMIN_SIDEBAR_EVENT, syncCollapsed);
      window.removeEventListener('storage', syncCollapsed);
    };
  }, []);

  return [collapsed, writeSidebarCollapsedPreference, hasMounted];
}
