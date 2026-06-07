import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

type TextInputProps = ComponentPropsWithoutRef<"input"> & {
  containerClassName?: string;
  inputClassName?: string;
  label: string;
  labelClassName?: string;
};

export function TextInput({
  className,
  containerClassName = "form-field",
  inputClassName = "form-input",
  label,
  labelClassName = "form-label",
  ...props
}: TextInputProps) {
  return (
    <label className={containerClassName}>
      <span className={labelClassName}>{label}</span>
      <input className={cx(inputClassName, className)} {...props} />
    </label>
  );
}
