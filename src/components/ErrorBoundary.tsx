import Text from '@root/src/components/Text';
import React from 'react';

/* This is only the UI of the error boundary, not the error boundary itself. */
const ErrorBoundary = ({ children }: React.PropsWithChildren) => (
  <div className="flex flex-col items-center gap-3 p-large text-center">
    <span className="mb-2 text-5xl">🛟</span>
    <Text type="subtitle">{children ?? 'Sorry, something went wrong'}</Text>
    <Text type="header">
      Please try opening the extension again. If the problem persists, reach out to us at{' '}
      <a href="mailto:support@monarchmoney.com" className="text-blue">
        support@monarchmoney.com
      </a>
      .
    </Text>
  </div>
);

export default ErrorBoundary;
