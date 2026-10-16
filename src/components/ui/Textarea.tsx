import React from "react";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: "default" | "compact";
}

export const Textarea: React.FC<TextareaProps> = ({
  className = "",
  variant = "default",
  ...props
}) => {
  const baseClasses =
    "px-2 py-1 text-sm font-medium bg-mid-gray/10 border border-mid-gray/80 rounded-md text-start placeholder:text-mid-gray transition-[background-color,border-color,box-shadow] duration-150 hover:bg-mid-gray/15 hover:border-accent focus:outline-none focus:bg-mid-gray/10 focus:border-accent focus:ring-1 focus:ring-accent resize-y";

  const variantClasses = {
    default: "px-3 py-2 min-h-[100px]",
    compact: "px-2 py-1 min-h-[80px]",
  };

  return (
    <textarea
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
};
