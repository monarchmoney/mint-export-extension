import React from 'react';
import clsx from 'clsx';

type Props = {
  type?: 'header' | 'subtitle';
  className?: string;
};

const Text = ({ children, type, className }: React.PropsWithChildren<Props>) => (
  <span
    className={clsx(
      'text-text',
      type === 'header' && 'font-medium text-text',
      type === 'subtitle' && 'text-xs font-semibold uppercase tracking-wider text-textLight',
      className,
    )}>
    {children}
  </span>
);

export default Text;
