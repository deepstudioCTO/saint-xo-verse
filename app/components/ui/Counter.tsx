interface CounterProps {
  label: string;
  count: number;
}

export function Counter({ label, count }: CounterProps) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-subtitle">{label}</span>
      <span className="text-sm font-semibold">{count}</span>
    </div>
  );
}
