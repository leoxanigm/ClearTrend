import { getPrisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function checkDatabase() {
  try {
    const prisma = getPrisma();

    await prisma.$queryRaw`SELECT 1`;

    return 'ok';
  } catch {
    return 'error';
  }
}

async function checkAnalysis() {
  const analysisUrl = process.env.ANALYSIS_URL;

  if (!analysisUrl) {
    return 'not_configured';
  }

  try {
    const response = await fetch(new URL('/health', analysisUrl), {
      cache: 'no-store',
      signal: AbortSignal.timeout(2000)
    });

    return response.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

export async function GET() {
  const [database, analysis] = await Promise.all([
    checkDatabase(),
    checkAnalysis()
  ]);

  const status = database === 'ok' && analysis !== 'error' ? 'ok' : 'error';

  return Response.json(
    {
      status,
      timestamp: new Date().toISOString(),
      services: {
        web: 'ok',
        database,
        analysis
      }
    },
    {
      status: status === 'ok' ? 200 : 503
    }
  );
}
