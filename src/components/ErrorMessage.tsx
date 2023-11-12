const ErrorMessage = ({ children }: React.PropsWithChildren) => (
  <div className="m-large flex flex-col gap-2 rounded-small bg-grayBackground  p-4 text-center text-sm font-medium text-text">
    <span>{children}</span>
  </div>
);

export default ErrorMessage;
