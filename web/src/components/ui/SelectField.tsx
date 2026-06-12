import type { ComponentPropsWithoutRef } from "react";

// Typed select option keeps emitted values aligned with the caller's union type.
export type SelectFieldOption<TValue extends string> = {
  label: string;
  value: TValue;
};

// Native class names are configurable because selects appear in several layouts.
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

// The component keeps the label associated by wrapping the native select.
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
      {/* Hidden labels remain available to assistive technologies. */}
      <span className={hideLabel ? "sr-only" : labelClassName}>{label}</span>
      <select
        aria-label={ariaLabel ?? label}
        className={selectClassName}
        // Cast is safe because every rendered option comes from TValue.
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
