import { getPrisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const body = await req.json();
    const email = body.email;
    const password = body.password;
    if (!email || !password) {
      return Response.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }
    const passwordHash =
      await bcrypt.hash(password, 12);
    
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
      },
    });
    return Response.json({
      id: user.id,
      email: user.email,
    });
  } catch {
    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}