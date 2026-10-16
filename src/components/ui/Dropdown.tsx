import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Popover } from "@/app/ui/Popover";
import { OptionList } from "@/app/ui/OptionList";

export interface DropdownOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  className?: string;
  /** Classes du menu ; « right-0 » l'aligne sur le bord droit de la liste. */
  menuClassName?: string;
  selectedValue: string | null;
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onRefresh?: () => void;
  /** Champ de recherche dans le menu (longues listes). */
  searchPlaceholder?: string;
  /** Nom accessible quand aucun libellé visible ne décrit la liste. */
  ariaLabel?: string;
  /** Liste pleine largeur (réglages empilés). */
  fullWidth?: boolean;
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  selectedValue,
  onSelect,
  className = "",
  menuClassName,
  placeholder,
  disabled = false,
  onRefresh,
  searchPlaceholder,
  ariaLabel,
  fullWidth = false,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setIsOpen(false), []);

  const selectedOption = options.find(
    (option) => option.value === selectedValue,
  );

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen && onRefresh) onRefresh();
    setIsOpen((open) => !open);
  };

  const describedWide = options.some((o) => o.description);

  return (
    <div className={`j-dropdown ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`j-select ${fullWidth ? "full" : ""}`}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !isOpen) {
            e.preventDefault();
            handleToggle();
          }
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        title={selectedOption?.label}
      >
        <span className={selectedOption ? "" : "placeholder"}>
          {selectedOption?.label || placeholder || t("common.select")}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <Popover
        anchor={triggerRef.current}
        open={isOpen && !disabled}
        onClose={close}
        align={menuClassName?.includes("right-0") ? "end" : "start"}
        minWidth={describedWide ? 300 : 160}
        maxHeight={300}
      >
        {(maxHeight) => (
          <OptionList
            options={options}
            selectedValue={selectedValue}
            maxHeight={maxHeight}
            searchPlaceholder={searchPlaceholder}
            emptyLabel={t("common.noOptionsFound")}
            onSelect={(value) => {
              onSelect(value);
              setIsOpen(false);
              triggerRef.current?.focus();
            }}
          />
        )}
      </Popover>
    </div>
  );
};
