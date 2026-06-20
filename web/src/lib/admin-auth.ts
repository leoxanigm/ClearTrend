import type { Role } from '@/generated/prisma/enums';
import { requireApiIdentity } from '@/lib/api-auth';
import { getCurrentUserProfile, readUserProfileById } from '@/lib/profile';
import { NextResponse } from 'next/server';

async function getAdminApiProfile(req: Request) {
  const { identity, response } = await requireApiIdentity(req);

  if (!identity) {
    return null;
  }

  const apiProfile = await readUserProfileById(identity.userId);

  if (!apiProfile) {
    return null;
  }

  return apiProfile;
}

export async function requireAdminUser(req?: Request) {
  const profile = req ? await getAdminApiProfile(req) : await getCurrentUserProfile();

  if (!profile) {
    return {
      profile: null,
      response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    };
  }

  if (profile.role !== 'ADMIN') {
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
