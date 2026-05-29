import { requireApiIdentity } from '@/lib/api-auth';
import { ExternalDataCooldownError } from '@/lib/external-data';
import {
  fetchTwelveDataCandles,
  isChartRange,
  type ChartRange
} from '@/lib/twelvedata';
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
    const data = await fetchTwelveDataCandles(symbol, range);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ExternalDataCooldownError) {
      return NextResponse.json(
        {
          error: 'Chart data was requested recently. Try again shortly.'
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: 'Chart data failed.'
      },
      { status: 502 }
    );
  }
}
