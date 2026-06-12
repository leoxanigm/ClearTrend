import { Button } from "./Button";

// Generic exclusive choice rendered as a visually connected button group.
type SegmentedControlOption<TValue extends string> = {
  label: string;
  value: TValue;
};

// TValue preserves the exact value union supplied by the parent component.
type SegmentedControlProps<TValue extends string> = {
  onChange: (value: TValue) => void;
  options: Array<SegmentedControlOption<TValue>>;
  value: TValue;
};

// Selection state remains controlled by the caller.
export function SegmentedControl<TValue extends string>({
  onChange,
  options,
  value,
}: SegmentedControlProps<TValue>) {
  return (
    <div className="tab-list">
      {/* Each option reuses Button's tab variant and active-state styling. */}
      {options.map((option) => (
        <Button
          active={value === option.value}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
          variant="tab"
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
