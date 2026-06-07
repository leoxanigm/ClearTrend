import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

type IconButtonSize = "md" | "sm";
type IconButtonVariant = "ghost" | "outline";

type IconButtonProps = Omit<ComponentPropsWithoutRef<"button">, "aria-label"> & {
  label: string;
  pressed?: boolean;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
};

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
