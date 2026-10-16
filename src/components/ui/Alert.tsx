import React from "react";
import { AlertCircle, AlertTriangle, Info, CheckCircle } from "lucide-react";

type AlertVariant = "error" | "warning" | "info" | "success";

interface AlertProps {
  variant?: AlertVariant;
  /** When true, removes rounded corners for use inside containers */
  contained?: boolean;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<
  AlertVariant,
  { container: string; icon: string; text: string }
> = {
  // Teinte légère et bordure de la couleur d'état ; le texte reste dans la
  // couleur du texte pour rester lisible (AA) sur toutes les teintes.
  error: {
    container: "bg-error/[0.08] border border-error/35",
    icon: "text-error",
    text: "text-text",
  },
  warning: {
    container: "bg-warning/[0.08] border border-warning/35",
    icon: "text-warning",
    text: "text-text",
  },
  info: {
    container: "bg-mid-gray/10 border border-mid-gray/30",
    icon: "text-mid-gray",
    text: "text-text",
  },
  success: {
    container: "bg-success/[0.08] border border-success/35",
    icon: "text-success",
    text: "text-text",
  },
};

const variantIcons: Record<AlertVariant, React.ElementType> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
};

export const Alert: React.FC<AlertProps> = ({
  variant = "error",
  contained = false,
  children,
  className = "",
}) => {
  const styles = variantStyles[variant];
  const Icon = variantIcons[variant];

  return (
    <div
      className={`flex items-start gap-3 p-4 ${styles.container} ${contained ? "" : "rounded-lg"} ${className}`}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${styles.icon}`} />
      <p className={`text-sm ${styles.text}`}>{children}</p>
    </div>
  );
};
