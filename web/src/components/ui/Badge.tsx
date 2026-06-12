import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

// Small semantic label whose tone conveys a state or level of importance.
type BadgeTone = "accent" | "danger" | "default" | "success" | "warning";

// Native span props allow badges to receive titles and accessibility attributes.
type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  tone?: BadgeTone;
};

// Tone names map directly to CSS modifiers, keeping visual logic out of callers.
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
