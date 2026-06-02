'use client';

import { SubmitEvent, useEffect, useMemo, useState } from 'react';
import type {
  SearchDirection,
  SearchEntityType,
  SearchResponse,
  SearchResultItem,
  SearchSortKey
} from '@/lib/search-types';
import { AppLogo } from '@/components/AppLogo';
import { useTranslations } from 'next-intl';

export function SearchClient() {
  const t = useTranslations('searchPage');
  const tDashboard = useTranslations('dashboard');
  const commonT = useTranslations('common');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<SearchEntityType>('all');
  const [sort, setSort] = useState<SearchSortKey>('createdAt');
  const [direction, setDirection] = useState<SearchDirection>('desc');
  const [sentiment, setSentiment] = useState('');
  const [source, setSource] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const searchUrl = useMemo(() => {
    const params = new URLSearchParams();

    params.set('q', query);
    params.set('type', type);
    params.set('sort', sort);
    params.set('direction', direction);
    params.set('page', String(page));
    params.set('limit', '10');

    if (sentiment) {
      params.set('sentiment', sentiment);
    }

    if (source) {
      params.set('source', source);
    }

    if (dateFrom) {
      params.set('dateFrom', dateFrom);
    }

    if (dateTo) {
      params.set('dateTo', dateTo);
    }

    return `/api/search?${params.toString()}`;
  }, [dateFrom, dateTo, direction, page, query, sentiment, sort, source, type]);

  useEffect(() => {
    const controller = new AbortController();

    async function runSearch() {
      setIsLoading(true);
      setError('');

      try {
        const nextResponse = await fetch(searchUrl, {
          cache: 'no-store',
          signal: controller.signal
        });

        if (!nextResponse.ok) {
          throw new Error(t('errors.searchFailed'));
        }

        const body = (await nextResponse.json()) as SearchResponse;

        setResponse(body);
      } catch {
        if (!controller.signal.aborted) {
          setResponse(null);
          setError(t('errors.searchFailed'));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    runSearch();

    return () => {
      controller.abort();
    };
  }, [searchUrl, t]);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
  }

  function resetFilters() {
    setQuery('');
    setType('all');
    setSort('createdAt');
    setDirection('desc');
    setSentiment('');
    setSource('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }

  const pagination = response?.pagination;

  const entityTypes: Array<{ label: string; value: SearchEntityType }> = [
    { label: t('entityTypes.all'), value: 'all' },
    { label: t('entityTypes.assets'), value: 'assets' },
    { label: t('entityTypes.analyses'), value: 'analyses' },
    { label: t('entityTypes.reports'), value: 'reports' },
    { label: t('entityTypes.notifications'), value: 'notifications' }
  ];

  const sortOptions: Array<{ label: string; value: SearchSortKey }> = [
    { label: t('sortOptions.createdAt'), value: 'createdAt' },
    { label: t('sortOptions.name'), value: 'name' },
    { label: t('sortOptions.symbol'), value: 'symbol' }
  ];

  const directionOptions: Array<{ label: string; value: SearchDirection }> = [
    { label: t('directionOptions.desc'), value: 'desc' },
    { label: t('directionOptions.asc'), value: 'asc' }
  ];

  const sentimentOptions = [
    { label: t('sentimentOptions.any'), value: '' },
    { label: t('sentimentOptions.bullish'), value: 'BULLISH' },
    { label: t('sentimentOptions.neutral'), value: 'NEUTRAL' },
    { label: t('sentimentOptions.bearish'), value: 'BEARISH' }
  ];

  const sourceOptions = [
    { label: t('sourceOptions.any'), value: '' },
    { label: t('sourceOptions.price'), value: 'PRICE' },
    { label: t('sourceOptions.comment'), value: 'COMMENT' },
    { label: t('sourceOptions.news'), value: 'NEWS' },
    { label: t('sourceOptions.api'), value: 'API' },
    { label: t('sourceOptions.scrape'), value: 'SCRAPE' }
  ];

  function formatDate(value: string | null) {
    if (!value) {
      return t('states.noDate');
    }

    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(value));
  }

  function resultTypeLabel(type: SearchResultItem['type']) {
    if (type === 'asset') {
      return t('resultTypes.asset');
    }

    if (type === 'analysis') {
      return t('resultTypes.analysis');
    }

    if (type === 'report') {
      return t('resultTypes.report');
    }

    return t('resultTypes.notification');
  }

  function SearchResultCard({ result }: { result: SearchResultItem }) {
    const content = (
      <>
        <div className='search-result-header'>
          <span className='search-result-type'>
            {resultTypeLabel(result.type)}
          </span>
          <span className='search-result-date'>
            {formatDate(result.createdAt)}
          </span>
        </div>

        <h2 className='search-result-title'>{result.title}</h2>

        {result.subtitle ? (
          <p className='search-result-subtitle'>{result.subtitle}</p>
        ) : null}

        {result.description ? (
          <p className='search-result-description'>{result.description}</p>
        ) : null}

        {Object.keys(result.metadata).length > 0 ? (
          <dl className='search-result-metadata'>
            {Object.entries(result.metadata).map(([key, value]) =>
              value === null ? null : (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              )
            )}
          </dl>
        ) : null}
      </>
    );

    if (result.href) {
      return (
        <a className='search-result-card' href={result.href}>
          {content}
        </a>
      );
    }

    return <article className='search-result-card'>{content}</article>;
  }

  return (
    <main className='search-page'>
      <header className='search-page-header'>
        <AppLogo
          ariaLabel={tDashboard('logoAria')}
          href='/dashboard'
          size='small'
        />

        <div>
          <p className='app-eyebrow'>{commonT('advancedSearch')}</p>
          <h1>{commonT('search')}</h1>
        </div>

        <a className='search-back-link' href='/dashboard'>
          {commonT('dashboard')}
        </a>
      </header>

      <form className='search-panel' onSubmit={handleSubmit}>
        <div className='search-field search-field-wide'>
          <label htmlFor='search-q'>{t('labels.query')}</label>
          <input
            id='search-q'
            onChange={event => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={t('placeholders.query')}
            type='search'
            value={query}
          />
        </div>

        <div className='search-field'>
          <label htmlFor='search-type'>{t('labels.type')}</label>
          <select
            id='search-type'
            onChange={event => {
              setType(event.target.value as SearchEntityType);
              setPage(1);
            }}
            value={type}>
            {entityTypes.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className='search-field'>
          <label htmlFor='search-sort'>{t('labels.sort')}</label>
          <select
            id='search-sort'
            onChange={event => {
              setSort(event.target.value as SearchSortKey);
              setPage(1);
            }}
            value={sort}>
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className='search-field'>
          <label htmlFor='search-direction'>{t('labels.direction')}</label>
          <select
            id='search-direction'
            onChange={event => {
              setDirection(event.target.value as SearchDirection);
              setPage(1);
            }}
            value={direction}>
            {directionOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className='search-field'>
          <label htmlFor='search-sentiment'>{t('labels.sentiment')}</label>
          <select
            id='search-sentiment'
            onChange={event => {
              setSentiment(event.target.value);
              setPage(1);
            }}
            value={sentiment}>
            {sentimentOptions.map(option => (
              <option key={option.value || 'any'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className='search-field'>
          <label htmlFor='search-source'>{t('labels.source')}</label>
          <select
            id='search-source'
            onChange={event => {
              setSource(event.target.value);
              setPage(1);
            }}
            value={source}>
            {sourceOptions.map(option => (
              <option key={option.value || 'any'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className='search-field'>
          <label htmlFor='search-date-from'>{t('labels.from')}</label>
          <input
            id='search-date-from'
            onChange={event => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            type='date'
            value={dateFrom}
          />
        </div>

        <div className='search-field'>
          <label htmlFor='search-date-to'>{t('labels.to')}</label>
          <input
            id='search-date-to'
            onChange={event => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            type='date'
            value={dateTo}
          />
        </div>

        <div className='search-actions'>
          <button type='submit'>{commonT('search')}</button>
          <button onClick={resetFilters} type='button'>
            {t('buttons.reset')}
          </button>
        </div>
      </form>

      <section className='search-results-section'>
        <div className='search-results-toolbar'>
          <p>
            {isLoading
              ? t('states.loading')
              : pagination?.total === 1
                ? t('pagination.results', { count: pagination.total })
                : t('pagination.resultsPlural', {
                    count: pagination?.total ?? 0
                  })}
          </p>

          {pagination ? (
            <p>
              {t('pagination.pageOf', {
                page: pagination.page,
                totalPages: pagination.totalPages
              })}
            </p>
          ) : null}
        </div>

        {error ? <div className='search-state'>{error}</div> : null}

        {!error && !isLoading && response?.results.length === 0 ? (
          <div className='search-state'>{t('states.noResults')}</div>
        ) : null}

        <div className='search-results-list'>
          {response?.results.map(result => (
            <SearchResultCard
              key={`${result.type}-${result.id}`}
              result={result}
            />
          ))}
        </div>

        {pagination ? (
          <div className='search-pagination'>
            <button
              disabled={!pagination.hasPreviousPage || isLoading}
              onClick={() => setPage(current => Math.max(1, current - 1))}
              type='button'>
              {t('buttons.previous')}
            </button>

            <button
              disabled={!pagination.hasNextPage || isLoading}
              onClick={() => setPage(current => current + 1)}
              type='button'>
              {t('buttons.next')}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
