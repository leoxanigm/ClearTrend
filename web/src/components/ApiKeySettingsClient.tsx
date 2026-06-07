'use client';

import { AppLogo } from '@/components/AppLogo';
import { Button } from '@/components/ui/Button';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

type ApiKeyMetadata = {
  createdAt: string;
  lastUsedAt: string | null;
  prefix: string;
};

type ApiKeyResponse = {
  apiKey: ApiKeyMetadata | null;
  secret?: string;
};

function formatDate(value: string | null, locale: string) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function ApiKeySettingsClient() {
  const t = useTranslations('apiKeyPage');
  const dashboardT = useTranslations('dashboard');
  const commonT = useTranslations('common');
  const [apiKey, setApiKey] = useState<ApiKeyMetadata | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadApiKey() {
      try {
        const response = await fetch('/api/account/api-key', {
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error('API key request failed');
        }

        const body = (await response.json()) as ApiKeyResponse;

        setApiKey(body.apiKey);
      } catch {
        setError(t('errors.load'));
      } finally {
        setIsLoading(false);
      }
    }

    loadApiKey();
  }, [t]);

  async function createApiKey() {
    setIsSaving(true);
    setError(null);
    setCopied(false);

    try {
      const response = await fetch('/api/account/api-key', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('API key creation failed');
      }

      const body = (await response.json()) as ApiKeyResponse;

      setApiKey(body.apiKey);
      setSecret(body.secret ?? null);
    } catch {
      setError(t('errors.create'));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteApiKey() {
    setIsSaving(true);
    setError(null);
    setCopied(false);

    try {
      const response = await fetch('/api/account/api-key', {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('API key deletion failed');
      }

      setApiKey(null);
      setSecret(null);
    } catch {
      setError(t('errors.delete'));
    } finally {
      setIsSaving(false);
    }
  }

  async function copySecret() {
    if (!secret) {
      return;
    }

    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setError(t('errors.copy'));
    }
  }

  return (
    <main className='api-key-page'>
      <header className='api-key-page-header'>
        <AppLogo
          ariaLabel={dashboardT('logoAria')}
          href='/dashboard'
          size='small'
        />

        <div className='api-key-page-actions'>
          <a className='secondary-link-button' href='/api-docs'>
            {t('buttons.docs')}
          </a>
          <a className='secondary-link-button' href='/dashboard'>
            {commonT('dashboard')}
          </a>
        </div>
      </header>

      <section className='api-key-page-content'>
        <div>
          <p className='app-eyebrow'>{t('eyebrow')}</p>
          <h1>{t('title')}</h1>
          <p className='api-key-page-description'>{t('description')}</p>
        </div>

        <div className='api-key-panel'>
          {isLoading ? <p>{t('states.loading')}</p> : null}

          {!isLoading && !apiKey ? (
            <>
              <p>{t('states.noKey')}</p>
              <Button
                className='primary-action-button'
                disabled={isSaving}
                onClick={createApiKey}
                variant='plain'>
                {isSaving ? t('buttons.creating') : t('buttons.create')}
              </Button>
            </>
          ) : null}

          {!isLoading && apiKey ? (
            <>
              <dl className='api-key-metadata'>
                <div>
                  <dt>{t('labels.prefix')}</dt>
                  <dd>
                    <code>{apiKey.prefix}...</code>
                  </dd>
                </div>
                <div>
                  <dt>{t('labels.createdAt')}</dt>
                  <dd>{formatDate(apiKey.createdAt, navigator.language)}</dd>
                </div>
                <div>
                  <dt>{t('labels.lastUsedAt')}</dt>
                  <dd>
                    {formatDate(apiKey.lastUsedAt, navigator.language) ??
                      t('states.neverUsed')}
                  </dd>
                </div>
              </dl>

              <Button
                className='danger-action-button'
                disabled={isSaving}
                onClick={deleteApiKey}
                variant='plain'>
                {isSaving ? t('buttons.deleting') : t('buttons.delete')}
              </Button>
            </>
          ) : null}

          {secret ? (
            <div className='api-key-secret'>
              <p>{t('states.secretWarning')}</p>
              <code>{secret}</code>
              <Button
                className='secondary-action-button'
                onClick={copySecret}
                variant='plain'>
                {copied ? t('buttons.copied') : t('buttons.copy')}
              </Button>
            </div>
          ) : null}

          {error ? <p className='api-key-error'>{error}</p> : null}
        </div>
      </section>
    </main>
  );
}
