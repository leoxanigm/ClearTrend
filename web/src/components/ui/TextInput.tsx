import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

// Labeled native input with overridable classes for screen-specific layouts.
type TextInputProps = ComponentPropsWithoutRef<"input"> & {
  containerClassName?: string;
  inputClassName?: string;
  label: string;
  labelClassName?: string;
};

// Wrapping the input in label preserves association without a generated id.
export function TextInput({
  className,
  containerClassName = "form-field",
  inputClassName = "form-input",
  label,
  labelClassName = "form-label",
  ...props
}: TextInputProps) {
  // Native input props such as type, value, and validation constraints pass through.
  return (
    <label className={containerClassName}>
      <span className={labelClassName}>{label}</span>
      <input className={cx(inputClassName, className)} {...props} />
    </label>
  );
}
