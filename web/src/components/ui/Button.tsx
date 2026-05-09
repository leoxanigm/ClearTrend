import type { ComponentPropsWithoutRef } from "react";

type ButtonVariant = "outline" | "primary" | "sidebar" | "tab";

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  active?: boolean;
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  outline: "outline-button",
  primary: "primary-button",
  sidebar: "sidebar-item",
  tab: "tab-button",
};

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Button({
  active = false,
  className,
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
      {...props}
    />
  );
}
