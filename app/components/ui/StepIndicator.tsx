interface StepIndicatorProps {
  label: string;
  current: number;
  total: number;
}

export function StepIndicator({ label, current, total }: StepIndicatorProps) {
  const formattedCurrent = String(current).padStart(2, "0");
  const formattedTotal = String(total).padStart(2, "0");

  return (
    <span className="text-subtitle">
      {label} {formattedCurrent} / {formattedTotal}
    </span>
  );
}
