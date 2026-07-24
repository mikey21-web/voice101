import * as React from "react";
import { Loader2 } from "lucide-react";

const variantStyles = {
  default: "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-85 shadow-sm transition-colors",
  destructive: "bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:opacity-85 shadow-sm transition-colors",
  outline: "border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] transition-colors",
  secondary: "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:opacity-80 transition-colors",
  ghost: "hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] transition-colors",
  link: "text-[var(--primary)] underline-offset-4 hover:underline",
};

const sizeStyles = {
  default: "h-9 px-4 py-2",
  sm: "h-8 rounded-md px-3 text-xs",
  lg: "h-10 rounded-md px-8",
  icon: "h-9 w-9",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "default", loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--ring)] disabled:pointer-events-none disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
