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
          "w-full border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 transition-colors rounded-lg",
          "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500",
          "hover:border-slate-400",
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
