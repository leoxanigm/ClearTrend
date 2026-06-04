import { getCurrentUserProfile } from '@/lib/profile';
import { getPrisma } from '@/lib/prisma';
import { apiError } from '@/lib/api-response';
import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { hashApiKey } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

function toApiKeyMetadata(apiKey: {
  createdAt: Date;
  lastUsedAt: Date | null;
  prefix: string;
}) {
  return {
    createdAt: apiKey.createdAt.toISOString(),
    lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
    prefix: apiKey.prefix
  };
}

export async function GET() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return apiError('Unauthorized.', 401);
  }

  const prisma = getPrisma();
  const apiKey = await prisma.apiKey.findUnique({
    where: {
      userId: profile.id
    },
    select: {
      createdAt: true,
      lastUsedAt: true,
      prefix: true
    }
  });

  return NextResponse.json({
    apiKey: apiKey ? toApiKeyMetadata(apiKey) : null
  });
}

export async function POST() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return apiError('Unauthorized.', 401);
  }

  const prisma = getPrisma();
  const existingApiKey = await prisma.apiKey.findUnique({
    where: {
      userId: profile.id
    },
    select: {
      id: true
    }
  });

  if (existingApiKey) {
    return apiError('An API key already exists for this account.', 409);
  }

  const apiKey = `ct_${randomBytes(32).toString('base64url')}`;
  const prefix = apiKey.slice(0, 11);

  try {
    const createdApiKey = await prisma.apiKey.create({
      data: {
        keyHash: hashApiKey(apiKey),
        name: 'Account API key',
        prefix,
        userId: profile.id
      },
      select: {
        createdAt: true,
        lastUsedAt: true,
        prefix: true
      }
    });

    return NextResponse.json(
      {
        apiKey: toApiKeyMetadata(createdApiKey),
        secret: apiKey
      },
      {
        status: 201
      }
    );
  } catch (error) {
    const isUniqueConflict =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002';

    if (isUniqueConflict) {
      return apiError('An API key already exists for this account.', 409);
    }

    throw error;
  }
}

export async function DELETE() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return apiError('Unauthorized.', 401);
  }

  const prisma = getPrisma();

  await prisma.apiKey.deleteMany({
    where: {
      userId: profile.id
    }
  });

  return new NextResponse(null, {
    status: 204
  });
}
