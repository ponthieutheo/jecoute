import React, { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

interface AccordionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/** Options rares, repliées : la hauteur s'anime sans saut de mise en page. */
export const Accordion: React.FC<AccordionProps> = ({
  title,
  defaultOpen = false,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="j-acc" data-open={open}>
      <button
        type="button"
        className="j-acc-h"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {title}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <div className="j-acc-body" id={id}>
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Accordion;
