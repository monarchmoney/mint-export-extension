import clsx from 'clsx';
import React from 'react';

type Props = {
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
};

const Section = ({ children, left, right, className }: React.PropsWithChildren<Props>) => (
  <div
    className={clsx(
      'grid grid-cols-[1fr_auto_1fr] items-center border-b border-grayBackground p-4 py-medium',
      className,
    )}>
    <div className="justify-self-start">{left}</div>
    <div className="w-full justify-self-center text-center">{children}</div>
    <div className="justify-self-end">{right}</div>
  </div>
);

export default Section;
