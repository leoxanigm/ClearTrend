import { Button } from "./Button";

type SegmentedControlOption<TValue extends string> = {
  label: string;
  value: TValue;
};

type SegmentedControlProps<TValue extends string> = {
  onChange: (value: TValue) => void;
  options: Array<SegmentedControlOption<TValue>>;
  value: TValue;
};

export function SegmentedControl<TValue extends string>({
  onChange,
  options,
  value,
}: SegmentedControlProps<TValue>) {
  return (
    <div className="tab-list">
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
