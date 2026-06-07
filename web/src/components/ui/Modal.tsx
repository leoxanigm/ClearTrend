import {
  createElement,
  type FormEventHandler,
  type PointerEventHandler,
  type ReactNode,
} from "react";
import { cx } from "./cx";

type ModalPanelElement = "div" | "form" | "section";

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
  return (
    <div
      className={cx("ui-modal-backdrop", backdropClassName)}
      onPointerDown={onBackdropPointerDown}
    >
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
