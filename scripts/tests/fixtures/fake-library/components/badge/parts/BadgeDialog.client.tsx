'use client';

import type { ReactNode } from 'react';
import { useBadge } from '../hooks/useBadge.client';

export const BadgeDialog = ({ children }: { children: ReactNode }) => {
  const { open } = useBadge();
  return open ? <span>{children}</span> : null;
};
