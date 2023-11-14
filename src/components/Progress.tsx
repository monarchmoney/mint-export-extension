import React from 'react';

type Props = {
  percentage: number;
};

const Progress = ({ percentage }: React.PropsWithChildren<Props>) => (
  <div className="h-2 w-full rounded-full bg-grayFocus">
    <div
      className="h-full rounded-full bg-greenSpecial transition-all duration-200 ease-in-out"
      style={{ width: `${percentage * 100}%` }}
    />
  </div>
);

export default Progress;
