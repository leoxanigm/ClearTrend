import { AppLogo } from '@/components/AppLogo';
import { getTranslations } from 'next-intl/server';

const endpoints = [
  {
    method: 'GET',
    path: '/api/health',
    auth: 'public',
    description: 'health',
    example: 'curl http://localhost:3000/api/health'
  },
  {
    method: 'GET',
    path: '/api/assets/candles?symbol=AAPL&range=1M',
    auth: 'authenticated',
    description: 'candles',
    example:
      'curl -H "Authorization: Bearer $CLEARTREND_API_KEY" \\\n  "http://localhost:3000/api/assets/candles?symbol=AAPL&range=1M"'
  },
  {
    method: 'GET',
    path: '/api/assets/watchlist',
    auth: 'authenticated',
    description: 'watchlistGet',
    example:
      'curl -H "Authorization: Bearer $CLEARTREND_API_KEY" \\\n  http://localhost:3000/api/assets/watchlist'
  },
  {
    method: 'POST',
    path: '/api/assets/watchlist',
    auth: 'authenticated',
    description: 'watchlistPost',
    example:
      'curl -X POST -H "Authorization: Bearer $CLEARTREND_API_KEY" \\\n  -H "Content-Type: application/json" -d \'{"symbol":"AAPL"}\' \\\n  http://localhost:3000/api/assets/watchlist'
  },
  {
    method: 'PUT',
    path: '/api/assets/watchlist',
    auth: 'authenticated',
    description: 'watchlistPut',
    example:
      'curl -X PUT -H "Authorization: Bearer $CLEARTREND_API_KEY" \\\n  -H "Content-Type: application/json" -d \'{"symbols":["AAPL","MSFT"]}\' \\\n  http://localhost:3000/api/assets/watchlist'
  },
  {
    method: 'DELETE',
    path: '/api/assets/watchlist',
    auth: 'authenticated',
    description: 'watchlistDelete',
    example:
      'curl -X DELETE -H "Authorization: Bearer $CLEARTREND_API_KEY" \\\n  -H "Content-Type: application/json" -d \'{"symbol":"AAPL"}\' \\\n  http://localhost:3000/api/assets/watchlist'
  },
  {
    method: 'GET',
    path: '/api/search?q=AAPL&type=assets&page=1&limit=10',
    auth: 'authenticated',
    description: 'search',
    example:
      'curl -H "Authorization: Bearer $CLEARTREND_API_KEY" \\\n  "http://localhost:3000/api/search?q=AAPL&type=assets&page=1&limit=10"'
  }
];

export default async function ApiDocsPage() {
  const t = await getTranslations('apiDocsPage');
  const dashboardT = await getTranslations('dashboard');
  const commonT = await getTranslations('common');

  return (
    <main className='api-docs-page'>
      <header className='api-docs-header'>
        <AppLogo
          ariaLabel={dashboardT('logoAria')}
          href='/dashboard'
          size='small'
        />

        <div className='api-key-page-actions'>
          <a className='secondary-link-button' href='/settings/api'>
            {t('buttons.settings')}
          </a>
          <a className='secondary-link-button' href='/dashboard'>
            {commonT('dashboard')}
          </a>
        </div>
      </header>

      <section className='api-docs-content'>
        <div>
          <p className='app-eyebrow'>{t('eyebrow')}</p>
          <h1>{t('title')}</h1>
          <p className='api-docs-description'>
            {t('description')} <code>Authorization: Bearer &lt;api_key&gt;</code>{' '}
            {t('or')}{' '}
            <code>X-API-Key: &lt;api_key&gt;</code>.
          </p>
        </div>

        <div className='api-docs-list'>
          {endpoints.map(endpoint => (
            <article
              className='api-docs-endpoint'
              key={`${endpoint.method}-${endpoint.path}`}>
              <header>
                <span className={`api-method api-method-${endpoint.method.toLowerCase()}`}>
                  {endpoint.method}
                </span>
                <code>{endpoint.path}</code>
              </header>
              <p>{t(`endpoints.${endpoint.description}`)}</p>
              <p className='api-docs-auth'>{t(`auth.${endpoint.auth}`)}</p>
              <pre>
                <code>{endpoint.example}</code>
              </pre>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
