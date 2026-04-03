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
          "h-11 w-full rounded-xl border border-slate-200/60 bg-white px-3 text-sm text-slate-900 shadow-sm transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300",
          "hover:border-slate-300",
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
