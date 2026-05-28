'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type {
  SearchDirection,
  SearchEntityType,
  SearchResponse,
  SearchResultItem,
  SearchSortKey
} from '@/lib/search-types';

const entityTypes: Array<{ label: string; value: SearchEntityType }> = [
  { label: 'All', value: 'all' },
  { label: 'Assets', value: 'assets' },
  { label: 'Analyses', value: 'analyses' },
  { label: 'Reports', value: 'reports' },
  { label: 'Notifications', value: 'notifications' }
];

const sortOptions: Array<{ label: string; value: SearchSortKey }> = [
  { label: 'Created date', value: 'createdAt' },
  { label: 'Name', value: 'name' },
  { label: 'Symbol', value: 'symbol' }
];

const directionOptions: Array<{ label: string; value: SearchDirection }> = [
  { label: 'Newest / Z-A', value: 'desc' },
  { label: 'Oldest / A-Z', value: 'asc' }
];

const sentimentOptions = [
  { label: 'Any sentiment', value: '' },
  { label: 'Bullish', value: 'BULLISH' },
  { label: 'Neutral', value: 'NEUTRAL' },
  { label: 'Bearish', value: 'BEARISH' }
];

const sourceOptions = [
  { label: 'Any source', value: '' },
  { label: 'Price', value: 'PRICE' },
  { label: 'Comment', value: 'COMMENT' },
  { label: 'News', value: 'NEWS' },
  { label: 'API', value: 'API' },
  { label: 'Scrape', value: 'SCRAPE' }
];

function formatDate(value: string | null) {
  if (!value) {
    return 'No date';
  }

  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));
}

function resultTypeLabel(type: SearchResultItem['type']) {
  if (type === 'asset') {
    return 'Asset';
  }

  if (type === 'analysis') {
    return 'Analysis';
  }

  if (type === 'report') {
    return 'Report';
  }

  return 'Notification';
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

export function SearchClient() {
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
          throw new Error('Search failed');
        }

        const body = (await nextResponse.json()) as SearchResponse;

        setResponse(body);
      } catch {
        if (!controller.signal.aborted) {
          setResponse(null);
          setError('Search failed.');
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
  }, [searchUrl]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

  return (
    <main className='search-page'>
      <header className='search-page-header'>
        <div>
          <p className='app-eyebrow'>Advanced search</p>
          <h1>Search</h1>
        </div>

        <a className='search-back-link' href='/dashboard'>
          Dashboard
        </a>
      </header>

      <form className='search-panel' onSubmit={handleSubmit}>
        <div className='search-field search-field-wide'>
          <label htmlFor='search-q'>Query</label>
          <input
            id='search-q'
            onChange={event => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder='Symbol, company, report, notification...'
            type='search'
            value={query}
          />
        </div>

        <div className='search-field'>
          <label htmlFor='search-type'>Type</label>
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
          <label htmlFor='search-sort'>Sort</label>
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
          <label htmlFor='search-direction'>Direction</label>
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
          <label htmlFor='search-sentiment'>Sentiment</label>
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
          <label htmlFor='search-source'>Source</label>
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
          <label htmlFor='search-date-from'>From</label>
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
          <label htmlFor='search-date-to'>To</label>
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
          <button type='submit'>Search</button>
          <button onClick={resetFilters} type='button'>
            Reset
          </button>
        </div>
      </form>

      <section className='search-results-section'>
        <div className='search-results-toolbar'>
          <p>
            {isLoading
              ? 'Loading...'
              : `${pagination?.total ?? 0} result${
                  pagination?.total === 1 ? '' : 's'
                }`}
          </p>

          {pagination ? (
            <p>
              Page {pagination.page} of {pagination.totalPages}
            </p>
          ) : null}
        </div>

        {error ? <div className='search-state'>{error}</div> : null}

        {!error && !isLoading && response?.results.length === 0 ? (
          <div className='search-state'>No results.</div>
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
              Previous
            </button>

            <button
              disabled={!pagination.hasNextPage || isLoading}
              onClick={() => setPage(current => current + 1)}
              type='button'>
              Next
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
