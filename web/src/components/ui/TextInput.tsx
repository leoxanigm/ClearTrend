import type { ComponentPropsWithoutRef } from "react";

type TextInputProps = ComponentPropsWithoutRef<"input"> & {
  label: string;
};

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function TextInput({ className, label, ...props }: TextInputProps) {
  return (
    <label className="form-field">
      <span className="form-label">{label}</span>
      <input className={cx("form-input", className)} {...props} />
    </label>
  );
}
