export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  avatarMimeType: string | null;
  avatarSize: number | null;
  avatarScale: number;
  avatarOffsetX: number;
  avatarOffsetY: number;
};
