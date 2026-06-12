import {
  forwardRef,
  type ReactNode,
  type ComponentPropsWithoutRef,
} from "react";
import { cx } from "./cx";

// Native details/summary provides keyboard and open-state behavior without JS.
type DropdownMenuProps = Omit<ComponentPropsWithoutRef<"details">, "children"> & {
  // Menu content and trigger stay independent so each can use rich markup.
  children: ReactNode;
  label: string;
  panelClassName?: string;
  trigger: ReactNode;
  triggerClassName?: string;
};

// Forwarding the details ref lets parents close the menu after an action.
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
    // The summary is the accessible interactive control for the native details.
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
