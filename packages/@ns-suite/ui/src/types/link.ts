import type { ComponentType, ReactNode } from "react";

export type NsLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
};

/** Client or i18n-aware link (e.g. next-intl `Link`). */
export type NsLinkComponent = ComponentType<NsLinkProps>;
