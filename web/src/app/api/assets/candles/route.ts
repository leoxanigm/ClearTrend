import { requireApiIdentity } from '@/lib/api-auth';
import {
  fetchAnalysisCandles,
  isChartRange,
  type ChartRange
} from '@/lib/analysis-data';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const symbolPattern = /^[A-Z0-9.-]{1,15}$/;

export async function GET(req: Request) {
  const { response } = await requireApiIdentity(req);

  if (response) { // unauthorized session or api key
    return response;
  }

  const url = new URL(req.url);
  const symbol = url.searchParams.get('symbol')?.trim().toUpperCase() ?? '';
  const rangeParam =
    url.searchParams.get('range')?.trim().toUpperCase() ?? '1M';
  // Only pass supported product ranges to analysis; unknown values fall back to
  // the dashboard default instead of reaching the backend as arbitrary input.
  const range: ChartRange = isChartRange(rangeParam) ? rangeParam : '1M';

  if (!symbolPattern.test(symbol)) {
    return NextResponse.json(
      {
        error: 'Invalid symbol.'
      },
      { status: 400 }
    );
  }

  try {
    const data = await fetchAnalysisCandles(symbol, range);

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      {
        error: 'Chart data failed.'
      },
      { status: 502 }
    );
  }
}
