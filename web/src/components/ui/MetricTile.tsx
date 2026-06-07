import { Card } from "./Card";
import { cx } from "./cx";

type MetricTone = "accent" | "default" | "negative" | "positive" | "secondary";

type MetricTileProps = {
  className?: string;
  description?: string;
  label: string;
  tone?: MetricTone;
  value: string;
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
      {description ? <p className="ui-metric-description">{description}</p> : null}
    </Card>
  );
}

