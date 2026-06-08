import { apiError, readJsonBody } from "@/lib/api-response";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUserProfile } from "@/lib/profile";
import { NextResponse } from "next/server";

const notificationTypes = [
  "WATCHLIST_CREATED",
  "WATCHLIST_UPDATED",
  "WATCHLIST_DELETED",
  "ANALYSIS_CREATED",
  "ANALYSIS_UPDATED",
  "ANALYSIS_FAILED",
  "API_KEY_CREATED",
  "API_KEY_REVOKED",
  "EXPORT_READY",
  "SYSTEM",
] as const;

type NotificationTypeInput = (typeof notificationTypes)[number];

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown, maxLength: number) {
  const nextValue = readString(value);

  return nextValue ? nextValue.slice(0, maxLength) : null;
}

function readNotificationType(value: unknown): NotificationTypeInput {
  return typeof value === "string" &&
    notificationTypes.includes(value as NotificationTypeInput)
    ? (value as NotificationTypeInput)
    : "SYSTEM";
}

export async function POST(req: Request) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return apiError("Unauthorized.", 401);
  }

  const body = await readJsonBody(req);

  if (!body || typeof body !== "object") {
    return apiError("Invalid request body.");
  }

  const fields = body as Record<string, unknown>;
  const title = readString(fields.title).slice(0, 160);

  if (!title) {
    return apiError("Missing notification title.");
  }

  const prisma = getPrisma();
  const notification = await prisma.notification.create({
    data: {
      body: readOptionalString(fields.body, 1_000),
      entityId: readOptionalString(fields.entityId, 120),
      entityType: readOptionalString(fields.entityType, 80),
      title,
      type: readNotificationType(fields.type),
      userId: profile.id,
    },
    select: {
      id: true,
    },
  });

  return NextResponse.json(
    {
      id: notification.id,
    },
    {
      status: 201,
    }
  );
}
