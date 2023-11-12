import { UTM_URL_PARAMETERS } from '@root/src/shared/lib/constants';
import React from 'react';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: never;
}

interface AnchorProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

type DefaultButtonProps = React.PropsWithChildren<
  (ButtonProps | AnchorProps) & { className?: string }
>;

const DefaultButton: React.FC<DefaultButtonProps> = ({ children, href, className, ...props }) => {
  const Component: React.ElementType = href ? 'a' : 'button';
  const urlParameters = new URLSearchParams(UTM_URL_PARAMETERS);

  const extraProps = href
    ? {
        // This is a hack to add UTM parameters to Monarch links automatically, we should probably
        // do this in a more robust way in the future.
        href:
          !href.includes('utm_source') && href.includes('monarch')
            ? `${href}?${urlParameters.toString()}`
            : href,
        target: '_blank',
        rel: 'noopener noreferrer',
      }
    : {};

  return (
    // @ts-ignore
    <Component
      {...props}
      className={twMerge(
        'block w-full rounded-small border border-slate-300 bg-white px-small py-2 text-sm font-medium text-text shadow-sm hover:border-grayLight active:bg-grayBackground active:shadow-inner disabled:bg-grayBackground disabled:text-textLight',
        href && 'cursor-pointer',
        className,
      )}
      {...extraProps}>
      {children}
    </Component>
  );
};

export default DefaultButton;
