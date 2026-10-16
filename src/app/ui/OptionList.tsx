import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";

export interface OptionItem {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  /** Contenu affiché à la place du libellé (le libellé sert à la recherche). */
  content?: React.ReactNode;
}

interface OptionListProps {
  options: OptionItem[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
  maxHeight: number;
  /** Champ de recherche en tête de liste. */
  searchPlaceholder?: string;
  emptyLabel: string;
  /** Contenu ajouté sous la liste (séparateur + actions). */
  footer?: React.ReactNode;
}

/**
 * Liste d'options navigable au clavier (flèches, Entrée, Début, Fin), avec
 * recherche facultative. Utilisée par toutes les listes déroulantes.
 */
export const OptionList: React.FC<OptionListProps> = ({
  options,
  selectedValue,
  onSelect,
  maxHeight,
  searchPlaceholder,
  emptyLabel,
  footer,
}) => {
  const listId = useId();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLocaleLowerCase().includes(q));
  }, [options, query]);
  const initial = Math.max(
    0,
    filtered.findIndex((o) => o.value === selectedValue),
  );
  const [active, setActive] = useState(initial);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchPlaceholder) searchRef.current?.focus();
    else listRef.current?.focus();
  }, [searchPlaceholder]);

  const initialRef = useRef(initial);
  initialRef.current = initial;
  useEffect(() => {
    setActive(query ? 0 : initialRef.current);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${active}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const move = (delta: number) => {
    if (filtered.length === 0) return;
    let next = active;
    for (let i = 0; i < filtered.length; i++) {
      next = (next + delta + filtered.length) % filtered.length;
      if (!filtered[next].disabled) break;
    }
    setActive(next);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(filtered.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[active];
      if (option && !option.disabled) onSelect(option.value);
    }
  };

  const searchHeight = searchPlaceholder ? 42 : 0;

  return (
    <>
      {searchPlaceholder && (
        <label className="j-field j-menu-search">
          <Search size={15} aria-hidden="true" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            aria-controls={listId}
            aria-activedescendant={
              filtered[active] ? `${listId}-${active}` : undefined
            }
          />
        </label>
      )}
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        tabIndex={searchPlaceholder ? -1 : 0}
        className="j-menu-list"
        style={{ maxHeight: Math.max(80, maxHeight - 10 - searchHeight) }}
        onKeyDown={searchPlaceholder ? undefined : onKeyDown}
        aria-activedescendant={
          !searchPlaceholder && filtered[active]
            ? `${listId}-${active}`
            : undefined
        }
      >
        {filtered.length === 0 ? (
          <div className="j-menu-empty">{emptyLabel}</div>
        ) : (
          filtered.map((option, index) => {
            const selected = option.value === selectedValue;
            return (
              <div
                key={option.value}
                id={`${listId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={selected}
                aria-disabled={option.disabled || undefined}
                data-active={index === active}
                className="j-menu-item"
                onMouseEnter={() => setActive(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (!option.disabled) onSelect(option.value);
                }}
              >
                <span className="min-w-0">
                  {option.content ?? option.label}
                  {option.description && (
                    <span className="desc">{option.description}</span>
                  )}
                </span>
                {selected && (
                  <Check size={16} className="check" aria-hidden="true" />
                )}
              </div>
            );
          })
        )}
      </div>
      {footer}
    </>
  );
};

export default OptionList;
