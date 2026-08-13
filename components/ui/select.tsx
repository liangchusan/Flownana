import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  menuLabel?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, menuLabel, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "w-full rounded-ui border border-input bg-background px-3 py-2 text-xs text-foreground transition-all duration-300",
          "focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30",
          "hover:border-primary/50",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
        {...props}
      >
        {menuLabel ? (
          <option value="" disabled>
            {menuLabel}
          </option>
        ) : null}
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";

export { Select };
