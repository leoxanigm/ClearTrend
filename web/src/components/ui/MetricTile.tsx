import type { ReactNode } from "react";
import { Card } from "./Card";
import { cx } from "./cx";

// Compact dashboard statistic composed from the generic Card primitive.
type MetricTone = "accent" | "default" | "negative" | "positive" | "secondary";

// ReactNode values allow metrics to contain tooltips or formatted fragments.
type MetricTileProps = {
  className?: string;
  description?: ReactNode;
  label: ReactNode;
  tone?: MetricTone;
  value: ReactNode;
};

// Label, value, and optional description keep metric hierarchy consistent.
export function MetricTile({
  className,
  description,
  label,
  tone = "default",
  value,
}: MetricTileProps) {
  return (
    <Card className={cx("ui-metric-tile", className)} padded>
      <p className="app-eyebrow">{label}</p>
      <p className={cx("ui-metric-value", `ui-metric-value-${tone}`)}>
        {value}
      </p>
      {description ? (
        <div className="ui-metric-description">{description}</div>
      ) : null}
    </Card>
  );
}
