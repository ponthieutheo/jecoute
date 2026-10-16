import React from "react";
import { SettingContainer } from "./SettingContainer";
import { ResetButton } from "./ResetButton";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  label: string;
  description: string;
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  onReset?: () => void;
  isResetting?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  onChange,
  min,
  max,
  step = 0.01,
  disabled = false,
  label,
  description,
  descriptionMode = "tooltip",
  grouped = false,
  showValue = true,
  formatValue = (v) => v.toFixed(2),
  onReset,
  isResetting = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  };

  return (
    <SettingContainer
      title={label}
      description={description}
      descriptionMode={descriptionMode}
      grouped={grouped}
      layout="horizontal"
      disabled={disabled}
    >
      <div className="w-full">
        <div className="flex items-center space-x-1 h-6">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleChange}
            disabled={disabled}
            className="flex-grow h-1.5 rounded-full appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              // Piste en deux aplats (partie remplie rouge, reste gris), sans
              // dégradé : les deux arrêts sont à la même position.
              background: `linear-gradient(to right, var(--color-accent-fill) ${
                ((value - min) / (max - min)) * 100
              }%, color-mix(in srgb, var(--color-mid-gray) 30%, transparent) ${
                ((value - min) / (max - min)) * 100
              }%)`,
            }}
          />
          {showValue && (
            <span className="text-sm font-medium text-text/90 w-12 text-end tabular-nums">
              {formatValue(value)}
            </span>
          )}
          {onReset && (
            <ResetButton onClick={onReset} disabled={disabled || isResetting} />
          )}
        </div>
      </div>
    </SettingContainer>
  );
};
