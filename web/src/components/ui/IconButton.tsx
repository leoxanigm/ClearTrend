import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

// Icon-only command button with a mandatory accessible label.
type IconButtonSize = "md" | "sm";
type IconButtonVariant = "ghost" | "outline";

// aria-label is replaced by the required label prop so it cannot be omitted.
type IconButtonProps = Omit<ComponentPropsWithoutRef<"button">, "aria-label"> & {
  label: string;
  pressed?: boolean;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
};

// pressed is optional because only toggle-style icon buttons need aria-pressed.
export function IconButton({
  children,
  className,
  label,
  pressed,
  size = "md",
  type = "button",
  variant = "outline",
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      aria-pressed={pressed}
      className={cx(
        "ui-icon-button",
        `ui-icon-button-${variant}`,
        `ui-icon-button-${size}`,
        className
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
