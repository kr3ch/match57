import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

export function Glass({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "glass relative overflow-hidden p-5 sm:p-6",
        className,
      )}
      {...rest}
    />
  );
}
