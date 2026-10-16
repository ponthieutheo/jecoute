import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MARGIN = 8;

export interface PopoverProps {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  /** Alignement horizontal sur l'ancre. */
  align?: "start" | "end";
  /** Largeur au moins égale à celle de l'ancre. */
  matchWidth?: boolean;
  minWidth?: number;
  width?: number;
  maxHeight?: number;
  className?: string;
  children: React.ReactNode | ((maxHeight: number) => React.ReactNode);
  role?: string;
  id?: string;
  "aria-label"?: string;
}

interface Placement {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  width?: number;
  minWidth: number;
  maxHeight: number;
  side: "top" | "bottom";
}

/**
 * Panneau flottant rendu dans <body>, placé sous son ancre (ou au-dessus s'il
 * manque de place) : jamais rogné par un conteneur qui défile, comme le
 * panneau des réglages.
 */
export const Popover: React.FC<PopoverProps> = ({
  anchor,
  open,
  onClose,
  align = "start",
  matchWidth = true,
  minWidth = 160,
  width,
  maxHeight = 280,
  className = "",
  children,
  role,
  id,
  "aria-label": ariaLabel,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const place = useCallback(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = vh - r.bottom - MARGIN - 4;
    const above = r.top - MARGIN - 4;
    const wanted = Math.min(maxHeight, 220);
    const side: "top" | "bottom" =
      below >= wanted || below >= above ? "bottom" : "top";
    const room = Math.max(120, side === "bottom" ? below : above);
    const w = width ?? undefined;
    const min = Math.min(
      vw - 2 * MARGIN,
      Math.max(minWidth, matchWidth ? r.width : 0),
    );
    const isRtl = getComputedStyle(anchor).direction === "rtl";
    const alignEnd = (align === "end") !== isRtl;
    const next: Placement = {
      minWidth: min,
      maxHeight: Math.min(maxHeight, room),
      side,
      width: w,
    };
    if (side === "bottom") next.top = r.bottom + 4;
    else next.bottom = vh - r.top + 4;
    if (alignEnd) next.right = Math.max(MARGIN, vw - r.right);
    else next.left = Math.max(MARGIN, Math.min(r.left, vw - min - MARGIN));
    setPlacement(next);
  }, [anchor, align, matchWidth, minWidth, maxHeight, width]);

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    place();
    let frame = 0;
    const onMove = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  // Le panneau ne doit jamais déborder de la fenêtre à droite : on le recale
  // une fois sa largeur réelle connue.
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!open || !el || !placement || placement.left === undefined) return;
    const overflow =
      el.getBoundingClientRect().right - (window.innerWidth - MARGIN);
    if (overflow > 0.5) {
      setPlacement((p) =>
        p && p.left !== undefined
          ? { ...p, left: Math.max(MARGIN, p.left - overflow) }
          : p,
      );
    }
  }, [open, placement]);

  useLayoutEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchor?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        anchor?.focus();
      }
    };
    const onBlur = () => onClose();
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [open, onClose, anchor]);

  if (!open || !placement) return null;

  const style: React.CSSProperties = {
    top: placement.top,
    bottom: placement.bottom,
    left: placement.left,
    right: placement.right,
    minWidth: placement.minWidth,
    width: placement.width,
    maxHeight: placement.maxHeight,
    maxWidth: window.innerWidth - 2 * MARGIN,
  };

  return createPortal(
    <div
      ref={panelRef}
      className={`j-menu ${className}`}
      data-side={placement.side}
      style={style}
      role={role}
      id={id}
      aria-label={ariaLabel}
      dir={anchor ? getComputedStyle(anchor).direction : undefined}
    >
      {typeof children === "function"
        ? children(placement.maxHeight)
        : children}
    </div>,
    document.body,
  );
};

export default Popover;
