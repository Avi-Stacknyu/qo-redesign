import type { ButtonVariant } from '$lib/components/ui/button';
import type { Component } from 'svelte';

export type HeaderCategoryTabsProps = {
  label: string;
  value?: string;
  href?: string;
  icon?: Component<{ class?: string }>;
  className?: string;
  variant?: ButtonVariant;
  onClick?: () => void;
};

export type AppLayoutState = {
  sidebarVisible: boolean;
};
