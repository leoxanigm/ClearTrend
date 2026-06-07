import type { ComponentPropsWithoutRef } from "react";

export type SelectFieldOption<TValue extends string> = {
  label: string;
  value: TValue;
};

type SelectFieldProps<TValue extends string> = Omit<
  ComponentPropsWithoutRef<"select">,
  "className" | "onChange"
> & {
  ariaLabel?: string;
  containerClassName?: string;
  hideLabel?: boolean;
  label: string;
  labelClassName?: string;
  onValueChange?: (value: TValue) => void;
  options: Array<SelectFieldOption<TValue>>;
  selectClassName?: string;
};

export function SelectField<TValue extends string>({
  ariaLabel,
  containerClassName = "language-select",
  hideLabel = false,
  label,
  labelClassName = "language-select-label",
  onValueChange,
  options,
  selectClassName = "language-select-control",
  ...props
}: SelectFieldProps<TValue>) {
  return (
    <label className={containerClassName}>
      <span className={hideLabel ? "sr-only" : labelClassName}>{label}</span>
      <select
        aria-label={ariaLabel ?? label}
        className={selectClassName}
        onChange={(event) => onValueChange?.(event.target.value as TValue)}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
