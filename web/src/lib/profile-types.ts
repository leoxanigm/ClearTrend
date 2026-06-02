export type UserProfile = {
  id: string;
  email: string;
  role: "USER" | "ADMIN" | "ANALYST";
  displayName: string;
  avatarUrl: string | null;
  avatarMimeType: string | null;
  avatarSize: number | null;
  avatarScale: number;
  avatarOffsetX: number;
  avatarOffsetY: number;
};
