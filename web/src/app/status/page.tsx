import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { StatusPageClient } from './StatusPageClient';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('statusPage');

  return {
    title: `${t('title')} - ClearTrend`
  };
}

export default function StatusPage() {
  return <StatusPageClient />;
}
