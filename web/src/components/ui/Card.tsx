import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

// Basic framed surface with optional standard internal spacing.
type CardProps = ComponentPropsWithoutRef<"div"> & {
  // Padding is opt-in so cards can host edge-to-edge specialized content.
  padded?: boolean;
};

// Callers retain all native div props while sharing one surface treatment.
export function Card({
  className,
  padded = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cx(
        "ui-card",
        padded && "ui-card-padded",
        className
      )}
      {...props}
    />
  );
}
