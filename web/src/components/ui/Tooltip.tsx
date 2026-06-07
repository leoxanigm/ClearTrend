import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

type TooltipProps = ComponentPropsWithoutRef<"button"> & {
  content: string;
  label?: string;
};

export function Tooltip({
  children,
  className,
  content,
  label,
  type = "button",
  ...props
}: TooltipProps) {
  const accessibleLabel =
    label ?? (typeof children === "string" ? children : content);

  return (
    <button
      aria-label={`${accessibleLabel}: ${content}`}
      className={cx("ui-tooltip", className)}
      data-tooltip={content}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
