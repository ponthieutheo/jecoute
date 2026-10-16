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

/** Interrupteur seul (sans ligne de réglage). */
export const Switch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, disabled = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    className="j-toggle"
    disabled={disabled}
    onClick={() => onChange(!checked)}
  />
);

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  isUpdating = false,
  label,
  description,
}) => (
  <SettingContainer title={label} description={description} disabled={disabled}>
    <Switch
      checked={checked}
      onChange={onChange}
      label={label}
      disabled={disabled || isUpdating}
    />
  </SettingContainer>
);
