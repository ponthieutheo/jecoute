import React from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";

interface ResetButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  children?: React.ReactNode;
}

export const ResetButton: React.FC<ResetButtonProps> = React.memo(
  ({ onClick, disabled = false, className = "", ariaLabel, children }) => {
    const { t } = useTranslation();
    const label = ariaLabel ?? t("common.reset");
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        className={`j-ibtn sm ${className}`}
        onClick={onClick}
        disabled={disabled}
      >
        {children ?? <RotateCcw size={15} aria-hidden="true" />}
      </button>
    );
  },
);
