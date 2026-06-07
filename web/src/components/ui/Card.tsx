import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

type CardProps = ComponentPropsWithoutRef<"div"> & {
  padded?: boolean;
};

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
