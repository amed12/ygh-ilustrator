'use client';

import React from 'react';
import { ACTION_TYPE_META } from '../data/actionTypes';
import type { ActionType } from '../types';

interface ActionTypeBadgeProps {
  actionType: ActionType;
  size?: 'xs' | 'sm';
}

const SIZE_CLASSES = {
  xs: 'w-4 h-4 p-0.5',
  sm: 'w-5 h-5 p-0.5'
};

const ICON_SIZE = { xs: 10, sm: 12 };

export function ActionTypeBadge({ actionType, size = 'xs' }: ActionTypeBadgeProps) {
  const meta = ACTION_TYPE_META[actionType];
  const Icon = meta.Icon;
  return (
    <span
      title={meta.label}
      className={`inline-flex items-center justify-center rounded-full ${meta.colorClass} ${SIZE_CLASSES[size]}`}
    >
      <Icon size={ICON_SIZE[size]} weight="bold" />
    </span>
  );
}
