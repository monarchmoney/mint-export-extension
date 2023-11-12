import React from 'react';
import clsx from 'clsx';
import Spinner from '@root/src/components/Spinner';
import Check from '@root/src/components/Check';

type Props = {
  complete?: boolean;
  className?: string;
};

const SpinnerWithText = ({ children, className, complete }: React.PropsWithChildren<Props>) => (
  <div
    className={clsx(
      className,
      'flex flex-col items-center gap-6 font-medium',
      complete ? '' : 'text-textLight',
    )}>
    {complete ? <Check /> : <Spinner />}
    {children}
  </div>
);

export default SpinnerWithText;
