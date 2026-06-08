import type { ReactNode } from "react";
import { Card } from "./Card";
import { cx } from "./cx";

type MetricTone = "accent" | "default" | "negative" | "positive" | "secondary";

type MetricTileProps = {
  className?: string;
  description?: ReactNode;
  label: ReactNode;
  tone?: MetricTone;
  value: ReactNode;
};

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
