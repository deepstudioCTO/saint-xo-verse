interface SubTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function SubTitle({ children, className = "" }: SubTitleProps) {
  return (
    <p className={`text-subtitle ${className}`}>
      {children}
    </p>
  );
}
