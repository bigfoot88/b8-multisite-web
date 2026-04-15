import React from 'react';
import { Box } from '@adminjs/design-system';
import { styled } from '@adminjs/design-system/styled-components';

import { useAdminSidebarCollapsed } from './sidebar-state';

const SidebarShell = styled(Box)`
  @media (min-width: 1024px) {
    &[data-sidebar-collapsed='true'] [data-css='sidebar'] {
      width: 88px;
      min-width: 88px;
    }

    &[data-sidebar-collapsed='true'] [data-css='sidebar'] nav {
      padding-left: ${({ theme }) => theme.space.sm};
      padding-right: ${({ theme }) => theme.space.sm};
    }

    &[data-sidebar-collapsed='true'] [data-css='sidebar'] nav > label,
    &[data-sidebar-collapsed='true'] [data-css='sidebar'] .arrow-box,
    &[data-sidebar-collapsed='true'] [data-css='sidebar'] .icon-box + * {
      display: none;
    }

    &[data-sidebar-collapsed='true'] [data-css='sidebar'] a {
      justify-content: center;
      padding-left: ${({ theme }) => theme.space.md};
      padding-right: ${({ theme }) => theme.space.md};
    }

    &[data-sidebar-collapsed='true'] [data-css='sidebar-logo'] {
      padding-left: ${({ theme }) => theme.space.md};
      padding-right: ${({ theme }) => theme.space.md};
    }

    &[data-sidebar-collapsed='true'] [data-css='sidebar-logo'] h1 {
      display: none;
    }

    &[data-sidebar-collapsed='true'] [data-css='sidebar-logo'] img {
      max-width: 32px;
    }
  }
`;

export default function SidebarWithCollapse(props) {
  const { OriginalComponent } = props;
  const [collapsed, , hasMounted = true] = useAdminSidebarCollapsed();

  if (!hasMounted) {
    return OriginalComponent ? <OriginalComponent {...props} /> : null;
  }

  return (
    <SidebarShell data-sidebar-collapsed={collapsed ? 'true' : 'false'}>
      {OriginalComponent ? <OriginalComponent {...props} /> : null}
    </SidebarShell>
  );
}
