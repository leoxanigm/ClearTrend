import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

type ButtonVariant = "outline" | "plain" | "primary" | "sidebar" | "tab";

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

export function Button({
  active = false,
  className,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(
        variantClasses[variant],
        variant === "tab" && active && "tab-button-active",
        className
      )}
      type={type}
      {...props}
    />
  );
}
