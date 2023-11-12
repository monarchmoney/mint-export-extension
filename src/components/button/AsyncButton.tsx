import React, { useState } from 'react';
import DefaultButton from '@root/src/components/button/DefaultButton';
import clsx from 'clsx';

const AsyncButton = ({
  children,
  onClick,
  loadingText = 'Loading...',
  className,
  ...props
}: React.PropsWithChildren<{
  onClick: (e: React.MouseEvent) => Promise<void>;
  loadingText?: string;
  className?: string;
}>) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    if (onClick) {
      setIsLoading(true);

      try {
        await onClick(event);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <DefaultButton
      {...props}
      onClick={handleClick}
      disabled={isLoading} // Disable button when loading
      className={clsx('block w-full rounded-sm border px-2 py-1 text-sm font-medium shadow-sm', {
        'border-slate-300 hover:border-zinc-300 active:bg-slate-100 active:shadow-inner':
          !isLoading,
        'cursor-not-allowed border-slate-200 bg-slate-200': isLoading,
        className,
      })}>
      {isLoading ? loadingText ?? 'Loading...' : children}
    </DefaultButton>
  );
};

export default AsyncButton;
