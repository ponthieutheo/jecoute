import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "primary-soft"
    | "secondary"
    | "warning"
    | "danger"
    | "danger-ghost"
    | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = "",
  variant = "primary",
  size = "md",
  ...props
}) => {
  const baseClasses =
    "font-medium rounded-md border outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

  const variantClasses = {
    primary:
      "text-on-accent bg-accent-fill border-accent-fill hover:bg-accent-fill-hover hover:border-accent-fill-hover",
    "primary-soft":
      "text-text bg-mid-gray/10 border-accent/60 hover:bg-mid-gray/15 hover:border-accent",
    secondary:
      "text-text bg-mid-gray/10 border-mid-gray/45 hover:bg-mid-gray/15 hover:border-accent",
    // Secondary's neutral resting look, but hover/focus use the semantic
    // --color-warning token (theme.css) instead of the accent — for buttons
    // sitting on warning surfaces like SecureInputWarning
    warning:
      "text-text bg-mid-gray/10 border-mid-gray/45 hover:bg-warning/15 hover:border-warning focus-visible:outline-warning",
    danger:
      "text-on-accent bg-accent-fill border-accent-fill hover:bg-accent-fill-hover hover:border-accent-fill-hover",
    "danger-ghost":
      "text-error border-transparent hover:bg-error/10 focus-visible:bg-error/10",
    ghost:
      "text-current border-transparent hover:bg-mid-gray/15 focus-visible:bg-mid-gray/15",
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-4 py-[5px] text-sm",
    lg: "px-4 py-2 text-base",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
