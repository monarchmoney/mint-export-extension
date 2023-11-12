import React from 'react';
import DefaultButton from '@root/src/components/button/DefaultButton';

const PrimaryButton = ({ children, ...props }: React.ComponentProps<typeof DefaultButton>) => (
  <DefaultButton {...props} className="border-0 bg-orange text-white active:bg-orangeDark">
    {children}
  </DefaultButton>
);

export default PrimaryButton;
