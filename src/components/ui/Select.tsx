import React from "react";
import SelectComponent from "react-select";
import CreatableSelect from "react-select/creatable";
import type {
  ActionMeta,
  Props as ReactSelectProps,
  SingleValue,
  StylesConfig,
} from "react-select";

export type SelectOption = {
  value: string;
  label: string;
  isDisabled?: boolean;
};

type BaseProps = {
  value: string | null;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  isClearable?: boolean;
  onChange: (value: string | null, action: ActionMeta<SelectOption>) => void;
  onBlur?: () => void;
  className?: string;
  formatCreateLabel?: (input: string) => string;
};

type CreatableProps = {
  isCreatable: true;
  onCreateOption: (value: string) => void;
};

type NonCreatableProps = {
  isCreatable?: false;
  onCreateOption?: never;
};

export type SelectProps = BaseProps & (CreatableProps | NonCreatableProps);

const baseBackground = "var(--color-surface)";
const hoverBackground = "var(--color-surface-2)";
const selectedBackground = "var(--color-surface-2)";
// Bordure des champs : contraste ≥ 3:1 avec la surface (WCAG 1.4.11).
const neutralBorder = "var(--color-border-strong)";

const selectStyles: StylesConfig<SelectOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 34,
    borderRadius: 6,
    borderColor: state.isFocused ? "var(--color-accent)" : neutralBorder,
    boxShadow: "none",
    backgroundColor: baseBackground,
    fontSize: 14,
    fontWeight: 500,
    color: "var(--color-text)",
    transition:
      "border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease",
    ":hover": {
      borderColor: state.isFocused
        ? "var(--color-accent)"
        : "var(--color-text)",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    paddingInline: 10,
    paddingBlock: 4,
  }),
  input: (base) => ({
    ...base,
    color: "var(--color-text)",
  }),
  singleValue: (base) => ({
    ...base,
    color: "var(--color-text)",
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? "var(--color-text)" : "var(--color-mid-gray)",
    ":hover": {
      color: "var(--color-text)",
    },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "var(--color-mid-gray)",
    ":hover": {
      color: "var(--color-text)",
    },
  }),
  indicatorSeparator: (base) => ({
    ...base,
    backgroundColor:
      "color-mix(in srgb, var(--color-mid-gray) 35%, transparent)",
  }),
  menuPortal: (provided) => ({ ...provided, zIndex: 80 }),
  menu: (provided) => ({
    ...provided,
    zIndex: 80,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "var(--color-surface)",
    color: "var(--color-text)",
    border:
      "1px solid color-mix(in srgb, var(--color-mid-gray) 35%, transparent)",
    boxShadow: "var(--elevation-popover)",
  }),
  option: (base, state) => ({
    ...base,
    fontSize: 14,
    borderRadius: 5,
    backgroundColor: state.isSelected
      ? selectedBackground
      : state.isFocused
        ? hoverBackground
        : "transparent",
    // L'option retenue porte un trait rouge à gauche, sans teinte rose.
    fontWeight: state.isSelected ? 600 : 400,
    color: "var(--color-text)",
    ":active": {
      backgroundColor: selectedBackground,
    },
    cursor: state.isDisabled ? "not-allowed" : base.cursor,
    opacity: state.isDisabled ? 0.5 : 1,
  }),
  placeholder: (base) => ({
    ...base,
    color: "var(--color-mid-gray)",
  }),
};

export const Select: React.FC<SelectProps> = React.memo(
  ({
    value,
    options,
    placeholder,
    disabled,
    isLoading,
    isClearable = true,
    onChange,
    onBlur,
    className = "",
    isCreatable,
    formatCreateLabel,
    onCreateOption,
  }) => {
    const selectValue = React.useMemo(() => {
      if (!value) return null;
      const existing = options.find((option) => option.value === value);
      if (existing) return existing;
      return { value, label: value, isDisabled: false };
    }, [value, options]);

    const handleChange = (
      option: SingleValue<SelectOption>,
      action: ActionMeta<SelectOption>,
    ) => {
      onChange(option?.value ?? null, action);
    };

    const sharedProps: Partial<ReactSelectProps<SelectOption, false>> = {
      className,
      classNamePrefix: "app-select",
      value: selectValue,
      options,
      onChange: handleChange,
      placeholder,
      isDisabled: disabled,
      isLoading,
      onBlur,
      isClearable,
      styles: selectStyles,
      // Rendu dans <body> : jamais rogné par le panneau des réglages.
      menuPortalTarget: typeof document !== "undefined" ? document.body : null,
      menuPosition: "fixed",
      menuPlacement: "auto",
    };

    if (isCreatable) {
      return (
        <CreatableSelect<SelectOption, false>
          {...sharedProps}
          onCreateOption={onCreateOption}
          formatCreateLabel={formatCreateLabel}
        />
      );
    }

    return <SelectComponent<SelectOption, false> {...sharedProps} />;
  },
);

Select.displayName = "Select";
