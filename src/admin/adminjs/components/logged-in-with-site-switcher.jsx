import React from 'react';
import { Box, Button } from '@adminjs/design-system';
import { sites } from '../../../config/sites';

function formatSiteLabel(siteKey) {
  if (siteKey === 'dma') {
    return 'DMA';
  }

  return siteKey.charAt(0).toUpperCase() + siteKey.slice(1);
}

function getAdminRedirectUrl() {
  if (typeof window === 'undefined') {
    return '/admin-next';
  }

  const redirectUrl = `${window.location.pathname || ''}${window.location.search || ''}`;

  if (redirectUrl === '/admin-next' || redirectUrl.startsWith('/admin-next/')) {
    return redirectUrl;
  }

  return '/admin-next';
}

export default function LoggedInWithSiteSwitcher(props) {
  const { OriginalComponent, session } = props;
  const currentSiteKey = session?.siteKey || 'dma';
  const redirectTo = getAdminRedirectUrl();

  return (
    <Box display="flex" alignItems="center" gap="default">
      <Box
        as="form"
        action="/admin-next/switch-site"
        method="post"
        display="flex"
        alignItems="center"
        gap="sm"
        data-testid="admin-site-switcher"
      >
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <Box as="span" style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>
          站点
        </Box>
        {sites.map((siteKey) => {
          const isCurrentSite = siteKey === currentSiteKey;

          return (
            <Button
              key={siteKey}
              type="submit"
              name="siteKey"
              value={siteKey}
              size="sm"
              variant={isCurrentSite ? 'contained' : 'light'}
              disabled={isCurrentSite}
              data-testid={`admin-site-switcher-${siteKey}`}
            >
              {formatSiteLabel(siteKey)}
            </Button>
          );
        })}
      </Box>
      {OriginalComponent ? <OriginalComponent {...props} /> : null}
    </Box>
  );
}
