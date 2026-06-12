// Canonical profile shape returned by the profile API to client components.
export type UserProfile = {
  id: string;
  email: string;
  role: "USER" | "ADMIN" | "ANALYST";
  displayName: string;
  avatarUrl: string | null;
  avatarMimeType: string | null;
  avatarSize: number | null;
  // The image remains intact; these values reproduce the chosen visual crop.
  avatarScale: number;
  avatarOffsetX: number;
  avatarOffsetY: number;
};
