/* eslint-disable @next/next/no-img-element */

import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

type AvatarProps = ComponentPropsWithoutRef<"span"> & {
  alt?: string;
  fallback: string;
  imageClassName?: string;
  src?: string | null;
};

export function Avatar({
  alt = "",
  children,
  className,
  fallback,
  imageClassName,
  src,
  ...props
}: AvatarProps) {
  return (
    <span className={cx("ui-avatar", className)} {...props}>
      {children ??
        (src ? (
          <img
            alt={alt}
            className={cx("ui-avatar-image", imageClassName)}
            draggable={false}
            src={src}
          />
        ) : (
          <span className="ui-avatar-fallback">{fallback}</span>
        ))}
    </span>
  );
}
