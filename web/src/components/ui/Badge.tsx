import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

type BadgeTone = "accent" | "danger" | "default" | "success" | "warning";

type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  tone?: BadgeTone;
};

export function Badge({
  className,
  tone = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cx("ui-badge", `ui-badge-${tone}`, className)}
      {...props}
    />
  );
}

