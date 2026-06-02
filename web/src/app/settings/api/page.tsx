import { ApiKeySettingsClient } from '@/components/ApiKeySettingsClient';
import { getCurrentUserProfile } from '@/lib/profile';
import { redirect } from 'next/navigation';

export default async function ApiKeySettingsPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect('/login');
  }

  return <ApiKeySettingsClient />;
}
