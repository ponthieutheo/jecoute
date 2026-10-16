import React from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen } from "lucide-react";
import { Button } from "./Button";

interface PathDisplayProps {
  path: string;
  onOpen: () => void;
  disabled?: boolean;
}

export const PathDisplay: React.FC<PathDisplayProps> = ({
  path,
  onOpen,
  disabled = false,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 w-full min-w-0">
      <div
        className="j-input mono j-selectable flex-1 flex items-center overflow-hidden"
        title={path}
      >
        <span className="truncate" dir="ltr">
          {path}
        </span>
      </div>
      <Button
        onClick={onOpen}
        variant="secondary"
        size="sm"
        disabled={disabled}
        className="shrink-0"
      >
        <FolderOpen size={14} aria-hidden="true" />
        {t("common.open")}
      </Button>
    </div>
  );
};
