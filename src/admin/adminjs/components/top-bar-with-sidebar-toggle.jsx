import React from 'react';
import { Box, Button, Icon } from '@adminjs/design-system';

import { useAdminSidebarCollapsed } from './sidebar-state';

export default function TopBarWithSidebarToggle(props) {
  const { OriginalComponent } = props;
  const [collapsed, setCollapsed, hasMounted = true] = useAdminSidebarCollapsed();

  return (
    <Box position="relative">
      {OriginalComponent ? <OriginalComponent {...props} /> : null}
      {hasMounted ? (
        <Box
          position="absolute"
          top="50%"
          left="xl"
          style={{ transform: 'translateY(-50%)' }}
          display={['none', 'none', 'none', 'block', 'block']}
        >
          <Button
            type="button"
            size="sm"
            variant="light"
            onClick={() => setCollapsed((current) => !current)}
            data-testid="admin-sidebar-toggle-desktop"
          >
            <Icon icon={collapsed ? 'ChevronRight' : 'ChevronLeft'} />
            {collapsed ? '展开导航' : '收起导航'}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
