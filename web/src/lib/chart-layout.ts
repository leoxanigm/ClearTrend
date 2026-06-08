import type { ChartRange } from "@/lib/analysis-data";

const minimumCandleWidth = 2;
const maximumCandleWidth = 14;
const maximumOneDayCandleWidth = 6;
const candleSpacingRatio = 0.62;

function median(values: number[]) {
  const sortedValues = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 0) {
    return (
      (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2
    );
  }

  return sortedValues[middleIndex];
}

export function getCandlestickWidth(
  xPositions: number[],
  usableWidth: number,
  range: ChartRange
) {
  const spacings = xPositions
    .slice(1)
    .map((position, index) => position - xPositions[index])
    .filter((spacing) => Number.isFinite(spacing) && spacing > 0);
  const typicalSpacing =
    spacings.length > 0
      ? median(spacings)
      : usableWidth / Math.max(xPositions.length, 1);
  const maximumWidth =
    range === "1D" ? maximumOneDayCandleWidth : maximumCandleWidth;

  return Math.max(
    minimumCandleWidth,
    Math.min(maximumWidth, typicalSpacing * candleSpacingRatio)
  );
}
