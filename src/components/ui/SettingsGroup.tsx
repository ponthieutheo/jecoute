import React from "react";

interface SettingsGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

/** Un groupe de lignes de réglage, sous un intertitre discret. */
export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  title,
  description,
  children,
}) => (
  <section>
    {title && <h3 className="j-grp">{title}</h3>}
    {description && <p className="j-grp-desc">{description}</p>}
    <div>{children}</div>
  </section>
);
