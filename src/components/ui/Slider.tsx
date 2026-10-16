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
  /** Commande ajoutée après la valeur (ex. écouter le signal). */
  extra?: React.ReactNode;
}

/** Curseur seul, piste remplie en rouge jusqu'à la valeur. */
export const Range: React.FC<{
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  label: string;
  onChange: (value: number) => void;
  className?: string;
}> = ({
  value,
  min,
  max,
  step = 0.01,
  disabled,
  label,
  onChange,
  className = "",
}) => {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      className={`j-range ${className}`}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ "--j-fill": `${fill}%` } as React.CSSProperties}
    />
  );
};

export const Slider: React.FC<SliderProps> = ({
  value,
  onChange,
  min,
  max,
  step = 0.01,
  disabled = false,
  label,
  description,
  showValue = true,
  formatValue = (v) => v.toFixed(2),
  onReset,
  isResetting = false,
  extra,
}) => (
  <SettingContainer title={label} description={description} disabled={disabled}>
    <div className="flex items-center gap-2" style={{ width: 214 }}>
      <Range
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        label={label}
        onChange={onChange}
      />
      {showValue && (
        <span
          className="j-num j-muted shrink-0 text-end"
          style={{ minWidth: 46, fontSize: 13.5 }}
        >
          {formatValue(value)}
        </span>
      )}
      {onReset && (
        <ResetButton onClick={onReset} disabled={disabled || isResetting} />
      )}
      {extra}
    </div>
  </SettingContainer>
);
