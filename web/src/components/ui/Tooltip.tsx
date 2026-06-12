import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

// CSS-rendered tooltip that remains reachable by keyboard as a real button.
type TooltipProps = ComponentPropsWithoutRef<"button"> & {
  content: string;
  label?: string;
};

// Tooltip content is duplicated into an accessible label and a CSS data attribute.
export function Tooltip({
  children,
  className,
  content,
  label,
  type = "button",
  ...props
}: TooltipProps) {
  const accessibleLabel =
    // Prefer an explicit label, then visible text, then the tooltip content.
    label ?? (typeof children === "string" ? children : content);

  return (
    <button
      aria-label={`${accessibleLabel}: ${content}`}
      className={cx("ui-tooltip", className)}
      // ui.css reads this attribute through content: attr(data-tooltip).
      data-tooltip={content}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
