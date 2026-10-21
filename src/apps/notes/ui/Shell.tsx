import type { ReactNode } from 'react';
import { AppHeader } from '../../../components/AppHeader';

/** Slim header shared by the Pages screens. */
export function Shell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader app={{ name: 'Pages', to: '/pages', accent: '#ffd23f' }}>{right}</AppHeader>
      {children}
    </div>
  );
}
