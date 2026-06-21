import type { Role } from '@/generated/prisma/enums';
import { requireApiIdentity } from '@/lib/api-auth';
import { getCurrentUserProfile, readUserProfileById } from '@/lib/profile';
import { NextResponse } from 'next/server';

async function getAdminApiProfile(req: Request) {
  const { identity, response } = await requireApiIdentity(req);

  if (!identity) {
    return { profile: null, response };
  }

  const profile = await readUserProfileById(identity.userId);

  if (!profile) {
    return {
      profile: null,
      response: NextResponse.json({ error: 'User not found.' }, { status: 404 })
    };
  }

  return { profile, response: null };
}

export async function requireAdminUser(req?: Request) {
  const result = req
    ? await getAdminApiProfile(req)
    : {
        profile: await getCurrentUserProfile(),
        response: null
      };

  if (!result.profile) {
    return {
      profile: null,
      response:
        result.response ??
        NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    };
  }

  if (result.profile.role !== 'ADMIN') {
    return {
      profile: null,
      response: NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    };
  }

  return {
    profile: result.profile,
    response: null
  };
}

export async function requireRole(roles: readonly Role[]) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return {
      profile: null,
      response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    };
  }

  if (!roles.includes(profile.role)) {
    return {
      profile: null,
      response: NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    };
  }

  return {
    profile,
    response: null
  };
}
