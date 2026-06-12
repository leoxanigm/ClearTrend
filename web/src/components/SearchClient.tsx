"use client";

import type { SubmitEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  SearchDirection,
  SearchEntityType,
  SearchResponse,
  SearchResultItem,
  SearchSortKey
} from "@/lib/search-types";
import { AppLogo } from "@/components/AppLogo";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { TextInput } from "@/components/ui/TextInput";
import { useTranslations } from "next-intl";

// Advanced search page coordinating filters, pagination, and heterogeneous results.
export function SearchClient() {
  // Filter, request, and pagination state
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

  // Build one stable URL from the complete active filter state.
  const searchUrl = useMemo(() => {
    // Required parameters are always sent so backend defaults stay explicit.
    const params = new URLSearchParams();

    params.set('q', query);
    params.set('type', type);
    params.set('sort', sort);
    params.set('direction', direction);
    params.set('page', String(page));
    params.set('limit', '10');

    if (sentiment) {
      // Optional filters are omitted rather than sent as empty values.
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

  // Search request lifecycle
  useEffect(() => {
    // Each filter change invalidates the previous in-flight request.
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

        // The backend owns result normalization and pagination metadata.
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
      // Cancel obsolete requests when filters change before a response arrives.
      controller.abort();
    };
  }, [searchUrl, t]);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    // Filtering already triggers requests; submit mainly resets pagination.
    event.preventDefault();
    setPage(1);
  }

  function resetFilters() {
    // Reset all controlled fields together to produce one canonical search state.
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

  // Translated select options
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

  // Result formatting helpers
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
    // Search results use singular backend types while filters use plural groups.
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
    // Results share one visual body but may or may not be navigable.
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
          // Metadata is intentionally generic because each entity exposes different fields.
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
      // Only results with an application destination become links.
      return (
        <a className='search-result-card' href={result.href}>
          {content}
        </a>
      );
    }

    return <article className='search-result-card'>{content}</article>;
  }

  // Search form, result list, and pagination
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
        {/* Every filter resets the page to avoid requesting an invalid high page. */}
        <TextInput
          containerClassName='search-field search-field-wide'
          id='search-q'
          inputClassName=''
          label={t('labels.query')}
          labelClassName=''
          onChange={event => {
              setQuery(event.target.value);
              setPage(1);
          }}
          placeholder={t('placeholders.query')}
          type='search'
          value={query}
        />

        <SelectField
          containerClassName='search-field'
          id='search-type'
          label={t('labels.type')}
          labelClassName=''
          onValueChange={value => {
            setType(value as SearchEntityType);
            setPage(1);
          }}
          options={entityTypes}
          selectClassName=''
          value={type}
        />

        <SelectField
          containerClassName='search-field'
          id='search-sort'
          label={t('labels.sort')}
          labelClassName=''
          onValueChange={value => {
            setSort(value as SearchSortKey);
            setPage(1);
          }}
          options={sortOptions}
          selectClassName=''
          value={sort}
        />

        <SelectField
          containerClassName='search-field'
          id='search-direction'
          label={t('labels.direction')}
          labelClassName=''
          onValueChange={value => {
            setDirection(value as SearchDirection);
            setPage(1);
          }}
          options={directionOptions}
          selectClassName=''
          value={direction}
        />

        <SelectField
          containerClassName='search-field'
          id='search-sentiment'
          label={t('labels.sentiment')}
          labelClassName=''
          onValueChange={value => {
            setSentiment(value);
            setPage(1);
          }}
          options={sentimentOptions}
          selectClassName=''
          value={sentiment}
        />

        <SelectField
          containerClassName='search-field'
          id='search-source'
          label={t('labels.source')}
          labelClassName=''
          onValueChange={value => {
            setSource(value);
            setPage(1);
          }}
          options={sourceOptions}
          selectClassName=''
          value={source}
        />

        <TextInput
          containerClassName='search-field'
          id='search-date-from'
          inputClassName=''
          label={t('labels.from')}
          labelClassName=''
          onChange={event => {
              setDateFrom(event.target.value);
              setPage(1);
          }}
          type='date'
          value={dateFrom}
        />

        <TextInput
          containerClassName='search-field'
          id='search-date-to'
          inputClassName=''
          label={t('labels.to')}
          labelClassName=''
          onChange={event => {
              setDateTo(event.target.value);
              setPage(1);
          }}
          type='date'
          value={dateTo}
        />

        <div className='search-actions'>
          <Button type='submit' variant='plain'>{commonT('search')}</Button>
          <Button onClick={resetFilters} variant='plain'>
            {t('buttons.reset')}
          </Button>
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
            <Button
              disabled={!pagination.hasPreviousPage || isLoading}
              onClick={() => setPage(current => Math.max(1, current - 1))}
              variant='plain'>
              {t('buttons.previous')}
            </Button>

            <Button
              disabled={!pagination.hasNextPage || isLoading}
              onClick={() => setPage(current => current + 1)}
              variant='plain'>
              {t('buttons.next')}
            </Button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
