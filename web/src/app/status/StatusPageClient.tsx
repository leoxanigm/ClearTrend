'use client';

import { AppLogo } from '@/components/AppLogo';
import { Badge, Button } from '@/components/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

type ServiceStatus = 'error' | 'not_configured' | 'ok';

type HealthPayload = {
  services: {
    analysis: ServiceStatus;
    database: ServiceStatus;
    web: ServiceStatus;
  };
  status: 'error' | 'ok';
  timestamp: string;
};

const serviceNames = ['web', 'database', 'analysis'] as const;

export function StatusPageClient() {
  const locale = useLocale();
  const t = useTranslations('statusPage');
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [requestFailed, setRequestFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);

    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      const payload = (await response.json()) as HealthPayload;

      setHealth(payload);
      setRequestFailed(false);
    } catch {
      setRequestFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 15_000);

    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [refresh]);

  const overallStatus = requestFailed ? 'error' : health?.status;

  return (
    <main className='status-page'>
      <header className='status-header'>
        <AppLogo ariaLabel={t('logoAria')} href='/login' size='small' />
        <Button
          disabled={refreshing}
          onClick={() => void refresh()}
          variant='outline'>
          {refreshing ? t('refreshing') : t('refresh')}
        </Button>
      </header>

      <section className='status-content'>
        <div className='status-heading'>
          <div>
            <p className='app-eyebrow'>{t('eyebrow')}</p>
            <h1>{t('title')}</h1>
          </div>
          <Badge
            aria-live='polite'
            tone={overallStatus === 'ok' ? 'success' : overallStatus ? 'danger' : 'warning'}>
            {overallStatus ? t(`states.${overallStatus}`) : t('states.loading')}
          </Badge>
        </div>

        <p className='status-description'>{t('description')}</p>

        <div className='status-services'>
          {serviceNames.map(service => {
            const status = requestFailed ? 'error' : health?.services[service];

            return (
              <div className='status-service-row' key={service}>
                <div>
                  <strong>{t(`services.${service}.name`)}</strong>
                  <p>{t(`services.${service}.description`)}</p>
                </div>
                <Badge
                  tone={
                    status === 'ok'
                      ? 'success'
                      : status === 'not_configured'
                        ? 'warning'
                        : status
                          ? 'danger'
                          : 'warning'
                  }>
                  {status ? t(`states.${status}`) : t('states.loading')}
                </Badge>
              </div>
            );
          })}
        </div>

        <p className='status-updated' aria-live='polite'>
          {requestFailed
            ? t('unreachable')
            : health
              ? t('lastChecked', {
                  date: new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'medium'
                  }).format(new Date(health.timestamp))
                })
              : t('checking')}
        </p>
      </section>
    </main>
  );
}
