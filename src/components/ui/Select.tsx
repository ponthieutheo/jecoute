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

const baseBackground =
  "color-mix(in srgb, var(--color-mid-gray) 10%, transparent)";
const hoverBackground =
  "color-mix(in srgb, var(--color-mid-gray) 15%, transparent)";
const selectedBackground =
  "color-mix(in srgb, var(--color-mid-gray) 16%, transparent)";
// Bordure des champs : contraste ≥ 3:1 avec la surface (WCAG 1.4.11).
const neutralBorder =
  "color-mix(in srgb, var(--color-mid-gray) 80%, transparent)";

const selectStyles: StylesConfig<SelectOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 36,
    borderRadius: 6,
    borderColor: state.isFocused ? "var(--color-accent)" : neutralBorder,
    boxShadow: state.isFocused ? "0 0 0 1px var(--color-accent)" : "none",
    backgroundColor: state.isFocused ? hoverBackground : baseBackground,
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "var(--color-text)",
    transition:
      "border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease",
    ":hover": {
      borderColor: "var(--color-accent)",
      backgroundColor: hoverBackground,
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
  menu: (provided) => ({
    ...provided,
    zIndex: 30,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "var(--color-surface)",
    color: "var(--color-text)",
    border:
      "1px solid color-mix(in srgb, var(--color-mid-gray) 35%, transparent)",
    boxShadow: "var(--elevation-popover)",
  }),
  option: (base, state) => ({
    ...base,
    fontSize: "0.875rem",
    backgroundColor: state.isSelected
      ? selectedBackground
      : state.isFocused
        ? hoverBackground
        : "transparent",
    // L'option retenue porte un trait rouge à gauche, sans teinte rose.
    boxShadow: state.isSelected ? "inset 3px 0 0 var(--color-accent)" : "none",
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
