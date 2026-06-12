import {
  createElement,
  type FormEventHandler,
  type PointerEventHandler,
  type ReactNode,
} from "react";
import { cx } from "./cx";

// The panel element can adapt to content semantics while sharing one modal shell.
type ModalPanelElement = "div" | "form" | "section";

// Backdrop dismissal remains controlled by the caller because busy dialogs differ.
type ModalProps = {
  ariaLabel?: string;
  ariaLabelledBy?: string;
  as?: ModalPanelElement;
  backdropClassName?: string;
  children: ReactNode;
  className?: string;
  onBackdropPointerDown?: PointerEventHandler<HTMLDivElement>;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  role?: "alertdialog" | "dialog";
};

// The primitive supplies dialog semantics but leaves header/body/footer composition free.
export function Modal({
  ariaLabel,
  ariaLabelledBy,
  as = "section",
  backdropClassName,
  children,
  className,
  onBackdropPointerDown,
  onSubmit,
  role = "dialog",
}: ModalProps) {
  // Pointer handling belongs to the backdrop; callers verify the exact target.
  return (
    <div
      className={cx("ui-modal-backdrop", backdropClassName)}
      onPointerDown={onBackdropPointerDown}
    >
      {/* createElement keeps the wrapper configurable without duplicating markup. */}
      {createElement(
        as,
        {
          "aria-label": ariaLabel,
          "aria-labelledby": ariaLabelledBy,
          "aria-modal": true,
          className: cx("ui-modal-panel", className),
          onSubmit,
          role,
        },
        children
      )}
    </div>
  );
}
