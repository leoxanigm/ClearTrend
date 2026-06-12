/* eslint-disable @next/next/no-img-element */

import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

// Generic circular avatar that displays custom content, an image, or a fallback.
type AvatarProps = ComponentPropsWithoutRef<"span"> & {
  // An empty default alt keeps decorative avatars silent to screen readers.
  alt?: string;
  fallback: string;
  // Consumers can adapt image positioning without replacing the primitive.
  imageClassName?: string;
  src?: string | null;
};

// The children prop deliberately takes priority for advanced crop compositions.
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
      {/* Use custom content first, then a native image, then textual initials. */}
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
