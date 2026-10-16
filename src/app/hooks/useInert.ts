import { useLayoutEffect, useRef } from "react";

/**
 * Rend un panneau fermé inerte (ni focus clavier, ni lecteur d'écran) :
 * l'attribut `inert` n'est pas encore typé par React 18.
 */
export const useInert = <T extends HTMLElement>(hidden: boolean) => {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (hidden) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  }, [hidden]);
  return ref;
};
