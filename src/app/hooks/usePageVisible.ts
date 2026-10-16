import { useEffect, useState } from "react";

/** Fenêtre affichée (ni cachée dans la barre des tâches, ni réduite). */
export const usePageVisible = (): boolean => {
  const [visible, setVisible] = useState(
    () => document.visibilityState !== "hidden",
  );
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
};
