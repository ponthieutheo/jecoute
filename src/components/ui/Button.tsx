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

const VARIANT_CLASS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "primary",
  "primary-soft": "",
  secondary: "",
  warning: "",
  danger: "primary",
  "danger-ghost": "ghost danger",
  ghost: "ghost",
};

export const Button: React.FC<ButtonProps> = ({
  children,
  className = "",
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}) => (
  <button
    type={type}
    className={`j-btn ${VARIANT_CLASS[variant]} ${size === "md" ? "" : size} ${className}`}
    {...props}
  >
    {children}
  </button>
);
