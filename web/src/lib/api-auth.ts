import { getCurrentUserProfile, readUserProfileById } from '@/lib/profile';
import { getPrisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { NextResponse } from 'next/server';

export type ApiIdentity = {
  authType: 'session' | 'api-key';
  userId: string;
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
        userId: true
      }
    });

    if (!row) {
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
