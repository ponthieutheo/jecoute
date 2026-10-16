import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "success" | "secondary";
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "primary",
  className = "",
}) => {
  const variantClasses = {
    primary: "bg-accent-fill text-on-accent",
    success: "border border-success/50 text-success",
    secondary: "bg-mid-gray/15 text-text/80",
  };

  return (
    <span
      className={`inline-flex items-center h-5 px-1.5 rounded font-display text-[11px] font-semibold uppercase tracking-[0.06em] leading-none whitespace-nowrap ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;
