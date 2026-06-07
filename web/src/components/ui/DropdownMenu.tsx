import {
  forwardRef,
  type ReactNode,
  type ComponentPropsWithoutRef,
} from "react";
import { cx } from "./cx";

type DropdownMenuProps = Omit<ComponentPropsWithoutRef<"details">, "children"> & {
  children: ReactNode;
  label: string;
  panelClassName?: string;
  trigger: ReactNode;
  triggerClassName?: string;
};

export const DropdownMenu = forwardRef<HTMLDetailsElement, DropdownMenuProps>(
  function DropdownMenu(
    {
      children,
      className,
      label,
      panelClassName,
      trigger,
      triggerClassName,
      ...props
    },
    ref
  ) {
    return (
      <details className={cx("ui-dropdown", className)} ref={ref} {...props}>
        <summary
          aria-label={label}
          className={cx("ui-dropdown-trigger", triggerClassName)}
        >
          {trigger}
        </summary>
        <div className={cx("ui-dropdown-panel", panelClassName)}>
          {children}
        </div>
      </details>
    );
  }
);

