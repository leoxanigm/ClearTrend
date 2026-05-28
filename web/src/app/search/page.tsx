import { getCurrentUserProfile } from '@/lib/profile';
import { redirect } from 'next/navigation';
import { SearchClient } from '@/components/SearchClient';

export default async function SearchPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect('/login');
  }

  return <SearchClient />;
}
