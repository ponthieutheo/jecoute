import React from "react";
import ResetIcon from "../icons/ResetIcon";

interface ResetButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  children?: React.ReactNode;
}

export const ResetButton: React.FC<ResetButtonProps> = React.memo(
  ({ onClick, disabled = false, className = "", ariaLabel, children }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      className={`p-1 rounded-md border border-transparent outline-none focus-visible:outline-2 focus-visible:outline-accent transition-colors duration-150 ${
        disabled
          ? "opacity-50 cursor-not-allowed text-text/40"
          : "text-mid-gray hover:text-text hover:bg-mid-gray/15 active:bg-mid-gray/25 active:translate-y-[1px] hover:cursor-pointer"
      } ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children ?? <ResetIcon />}
    </button>
  ),
);
