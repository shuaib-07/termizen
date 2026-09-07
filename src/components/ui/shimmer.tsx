import { cn } from "@/lib/utils";

export function Shimmer({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <span className={cn("t-shimmer font-medium", className)} data-text={children}>
      {children}
    </span>
  );
}

export default Shimmer;
