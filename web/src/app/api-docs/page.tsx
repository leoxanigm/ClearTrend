import { AppLogo } from '@/components/AppLogo';
import { getTranslations } from 'next-intl/server';

type Endpoint = {
  auth: 'public' | 'authenticated' | 'admin';
  body?: string;
  description: string;
  form?: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
};

const endpoints: Endpoint[] = [
  { method: 'GET', path: '/api/health', auth: 'public', description: 'health' },

  {
    method: 'GET',
    path: '/api/assets/watchlist',
    auth: 'authenticated',
    description: 'watchlistGet'
  },
  {
    method: 'POST',
    path: '/api/assets/watchlist',
    auth: 'authenticated',
    description: 'watchlistPost',
    body: '{"symbol":"AAPL"}'
  },
  {
    method: 'PUT',
    path: '/api/assets/watchlist',
    auth: 'authenticated',
    description: 'watchlistPut',
    body: '{"symbols":["AAPL","MSFT"]}'
  },
  {
    method: 'PATCH',
    path: '/api/assets/watchlist',
    auth: 'authenticated',
    description: 'watchlistPatch',
    body: '{"symbol":"AAPL","isFavorite":true}'
  },
  {
    method: 'DELETE',
    path: '/api/assets/watchlist',
    auth: 'authenticated',
    description: 'watchlistDelete',
    body: '{"symbol":"AAPL"}'
  },

  {
    method: 'GET',
    path: '/api/assets/watchlist/file',
    auth: 'authenticated',
    description: 'watchlistFileGet'
  },
  {
    method: 'POST',
    path: '/api/assets/watchlist/file',
    auth: 'authenticated',
    description: 'watchlistFilePost',
    form: 'watchlist=@watchlist.json;type=application/json'
  },

  {
    method: 'GET',
    path: '/api/search?q=AAPL&type=assets&page=1&limit=10',
    auth: 'authenticated',
    description: 'search'
  },
  {
    method: 'GET',
    path: '/api/assets/search?q=AAPL',
    auth: 'authenticated',
    description: 'assetSearch'
  },
  {
    method: 'GET',
    path: '/api/assets/candles?symbol=AAPL&range=1M',
    auth: 'authenticated',
    description: 'candles'
  },
  {
    method: 'GET',
    path: '/api/assets/candles/meta?symbol=AAPL&range=1M',
    auth: 'authenticated',
    description: 'candlesMeta'
  },
  {
    method: 'GET',
    path: '/api/assets/performance?symbols=AAPL,MSFT&range=1D',
    auth: 'authenticated',
    description: 'performance'
  },
  {
    method: 'GET',
    path: '/api/ml/analyse?symbol=AAPL&horizon=1D',
    auth: 'authenticated',
    description: 'mlAnalyse'
  },

  {
    method: 'GET',
    path: '/api/admin/ping',
    auth: 'admin',
    description: 'adminPing'
  },
  {
    method: 'GET',
    path: '/api/admin/settings/finance-refresh-rate',
    auth: 'admin',
    description: 'financeGet'
  },
  {
    method: 'POST',
    path: '/api/admin/settings/finance-refresh-rate',
    auth: 'admin',
    description: 'financePost',
    body: '{"refreshRateSeconds":60}'
  },
  {
    method: 'PUT',
    path: '/api/admin/settings/finance-refresh-rate',
    auth: 'admin',
    description: 'financePut',
    body: '{"refreshRateSeconds":300}'
  },
  {
    method: 'PATCH',
    path: '/api/admin/settings/finance-refresh-rate',
    auth: 'admin',
    description: 'financePatch',
    body: '{"refreshRateSeconds":900}'
  },
  {
    method: 'DELETE',
    path: '/api/admin/settings/finance-refresh-rate',
    auth: 'admin',
    description: 'financeDelete'
  }
];

function buildCurlExample(endpoint: Endpoint) {
  const key =
    endpoint.auth === 'admin'
      ? '$CLEARTREND_ADMIN_API_KEY'
      : '$CLEARTREND_API_KEY';

  return [
    'curl',
    endpoint.method === 'GET' ? null : `-X ${endpoint.method}`,
    endpoint.auth === 'public' ? null : `-H "Authorization: Bearer ${key}"`,
    endpoint.body ? '-H "Content-Type: application/json"' : null,
    endpoint.body ? `-d '${endpoint.body}'` : null,
    endpoint.form ? `-F '${endpoint.form}'` : null,
    `"https://localhost${endpoint.path}"`
  ]
    .filter(Boolean)
    .join(' \\\n  ');
}

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
            {t('description')}{' '}
            <code>Authorization: Bearer &lt;api_key&gt;</code> {t('or')}{' '}
            <code>X-API-Key: &lt;api_key&gt;</code>.
          </p>
          <p className='api-docs-description'>{t('rateLimit')}</p>
          <p className='api-docs-description'>{t('errors')}</p>
        </div>

        <div className='api-docs-list'>
          {endpoints.map(endpoint => (
            <article
              className='api-docs-endpoint'
              key={`${endpoint.method}-${endpoint.path}`}>
              <header>
                <span
                  className={`api-method api-method-${endpoint.method.toLowerCase()}`}>
                  {endpoint.method}
                </span>
                <code>{endpoint.path}</code>
              </header>
              <p>{t(`endpoints.${endpoint.description}`)}</p>
              <p className='api-docs-auth'>{t(`auth.${endpoint.auth}`)}</p>
              <pre>
                <code>{buildCurlExample(endpoint)}</code>
              </pre>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
