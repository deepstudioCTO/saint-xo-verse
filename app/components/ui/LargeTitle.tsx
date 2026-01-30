interface LargeTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function LargeTitle({ children, className = "" }: LargeTitleProps) {
  return (
    <h1 className={`text-hero ${className}`}>
      {children}
    </h1>
  );
}
