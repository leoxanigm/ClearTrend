import { getCurrentUserProfile } from "@/lib/profile";
import { NextResponse } from "next/server";


// 
export async function requireAdminUser() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return {
      profile: null,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  if (profile.role !== "ADMIN") {
    return {
      profile: null,
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  return {
    profile,
    response: null,
  };
}