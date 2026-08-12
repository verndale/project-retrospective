import type { BadgeProps } from './Badge.types';
import { BadgeDialog } from './parts/BadgeDialog.client';
import { BadgeHeader } from './parts/BadgeHeader';

export const Badge = ({ label }: BadgeProps) => (
  <BadgeDialog>
    <BadgeHeader>{label}</BadgeHeader>
  </BadgeDialog>
);
