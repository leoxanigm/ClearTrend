import { getCurrentUserProfile, readUserProfileById } from '@/lib/profile';
import { getPrisma } from '@/lib/prisma';
import { getClientIp, isRateLimited } from '@/lib/rate-limit';
import { createHash } from 'crypto';
import { NextResponse } from 'next/server';

export type ApiIdentity = {
  authType: 'session' | 'api-key';
  userId: string;
};

// 120 api requests every minute
export const publicApiRateLimit = {
  limit: 120,
  windowMs: 60_000
};

function readApiKey(req: Request) {
  const authorization = req.headers.get('authorization');

  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice('bearer '.length).trim();
  }

  return req.headers.get('x-api-key')?.trim() ?? null;
}

export function hashApiKey(apiKey: string) {
  return createHash('sha256').update(apiKey).digest('hex');
}

export async function getApiIdentity(
  req: Request
): Promise<ApiIdentity | null> {
  const apiKey = readApiKey(req);

  if (apiKey) {
    const prisma = getPrisma();
    const keyHash = hashApiKey(apiKey);

    const row = await prisma.apiKey.findFirst({
      where: {
        keyHash,
        revokedAt: null
      },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            bannedAt: true
          }
        }
      }
    });

    if (!row || row.user.bannedAt) {
      return null;
    }

    await prisma.apiKey.update({
      where: {
        id: row.id
      },
      data: {
        lastUsedAt: new Date()
      }
    });

    return {
      authType: 'api-key',
      userId: row.userId
    };
  }

  const profile = await getCurrentUserProfile();

  if (!profile) {
    return null;
  }

  return {
    authType: 'session',
    userId: profile.id
  };
}

function createRateLimitResponse(resetAt: number, remaining: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

  return NextResponse.json(
    {
      error: 'Rate limit exceeded.'
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(publicApiRateLimit.limit),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000))
      }
    }
  );
}

export async function requireApiIdentity(req: Request) {
  const identity = await getApiIdentity(req);

  if (!identity) {
    return {
      identity: null,
      response: NextResponse.json(
        {
          error: 'Unauthorized.'
        },
        {
          status: 401
        }
      )
    };
  }

  const ip = getClientIp(req);
  const rateLimitKey =
    identity.authType === 'api-key'
      ? `public-api:api-key:${identity.userId}`
      : `public-api:session:${identity.userId}:${ip}`;

  const result = isRateLimited(rateLimitKey, publicApiRateLimit);

  if (!result.allowed) {
    return {
      identity: null,
      response: createRateLimitResponse(result.resetAt, result.remaining)
    };
  }

  return {
    identity,
    response: null
  };
}

export async function getApiUserProfile(req: Request) {
  const { identity, response } = await requireApiIdentity(req);

  if (!identity) {
    return {
      profile: null,
      response
    };
  }

  const profile = await readUserProfileById(identity.userId);

  if (!profile) {
    return {
      profile: null,
      response: NextResponse.json(
        {
          error: 'User not found.'
        },
        {
          status: 404
        }
      )
    };
  }

  return {
    profile,
    response: null
  };
}
