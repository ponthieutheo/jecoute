import React from "react";
import { SettingContainer } from "./SettingContainer";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  isUpdating?: boolean;
  label: string;
  description: string;
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  tooltipPosition?: "top" | "bottom";
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  isUpdating = false,
  label,
  description,
  descriptionMode = "tooltip",
  grouped = false,
  tooltipPosition = "top",
}) => {
  return (
    <SettingContainer
      title={label}
      description={description}
      descriptionMode={descriptionMode}
      grouped={grouped}
      disabled={disabled}
      tooltipPosition={tooltipPosition}
    >
      <label
        className={`flex items-center ${disabled || isUpdating ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <input
          type="checkbox"
          value=""
          className="sr-only peer"
          checked={checked}
          disabled={disabled || isUpdating}
          onChange={(e) => onChange(e.target.checked)}
        />
        {/* Éteint : piste vide cerclée de gris, petit pouce gris. Allumé :
            piste rouge pleine, pouce blanc plus grand (contrastes ≥ 3:1). */}
        <div className="relative w-11 h-6 rounded-full border-2 border-mid-gray bg-transparent transition-colors duration-150 peer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-checked:bg-accent-fill peer-checked:border-accent-fill peer-disabled:opacity-50 after:content-[''] after:absolute after:top-[3px] after:start-[3px] after:h-3.5 after:w-3.5 after:rounded-full after:bg-mid-gray after:transition-all after:duration-150 peer-checked:after:top-[2px] peer-checked:after:start-[2px] peer-checked:after:h-4 peer-checked:after:w-4 peer-checked:after:bg-on-accent peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5"></div>
      </label>
      {isUpdating && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </SettingContainer>
  );
};
