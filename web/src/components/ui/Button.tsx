import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

// Shared button API used to keep command styling consistent across screens.
type ButtonVariant = "outline" | "plain" | "primary" | "sidebar" | "tab";

// All native button attributes remain available to specialized screens.
type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  active?: boolean;
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  outline: "outline-button",
  plain: "",
  primary: "primary-button",
  sidebar: "sidebar-item",
  tab: "tab-button",
};

// Defaulting to type="button" prevents accidental form submission.
export function Button({
  active = false,
  className,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  // The plain variant intentionally contributes no base class.
  return (
    <button
      className={cx(
        variantClasses[variant],
        // Only tab buttons need an additional visual class for selection.
        variant === "tab" && active && "tab-button-active",
        className
      )}
      type={type}
      {...props}
    />
  );
}
