import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();

    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      status: "ok",
      services: {
        web: "ok",
        database: "ok",
      },
    });
  } catch {
    return Response.json(
      {
        status: "error",
        services: {
          web: "ok",
          database: "error",
        },
      },
      { status: 503 }
    );
  }
}
