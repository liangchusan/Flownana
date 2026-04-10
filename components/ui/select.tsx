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
          "w-full rounded-xl border border-stone-200/50 bg-white px-3 py-2 text-xs text-stone-900 transition-all duration-300",
          "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-stone-500",
          "hover:border-stone-300",
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
