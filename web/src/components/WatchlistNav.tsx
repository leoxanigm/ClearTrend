'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { WatchlistAsset } from '@/lib/assets';
import { chartRanges, type ChartRange } from '@/lib/analysis-data';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { SelectField } from '@/components/ui/SelectField';
import { supportsMlAnalysis } from '@/lib/ml-analysis';
import { useTranslations } from 'next-intl';

type SortDirection = 'asc' | 'desc';
type SortKey = 'dp' | 'favorite' | 'name';
type SortState = {
  direction: SortDirection;
  favoritesFirst: boolean;
  key: SortKey;
};

type WatchlistNavProps = {
  assets: WatchlistAsset[];
  mobile?: boolean;
  onAssetAdd: (asset: WatchlistAsset) => void;
  onFavoriteChange: (
    symbol: string,
    isFavorite: boolean
  ) => Promise<void> | void;
  onPerformanceRangeChange: (range: ChartRange) => void;
  onSelectSymbol: (symbol: string) => void;
  performanceBySymbol: Record<string, number | null>;
  performanceRange: ChartRange;
  selectedSymbol: string | null;
};

type AssetSearchResult = {
  name: string | null;
  symbol: string | null;
  type: string | null;
};

function getAssetPerformance(
  asset: WatchlistAsset,
  performanceBySymbol: Record<string, number | null>,
  performanceRange: ChartRange
) {
  return performanceRange === '1D'
    ? asset.dayChangePercent
    : performanceBySymbol[asset.symbol] ?? null;
}

function formatPerformancePercent(value: number | null) {
  if (value === null) {
    return 'N/A';
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function getDayChangeClass(value: number | null) {
  if (value === null || value === 0) {
    return 'asset-performance-muted';
  }

  return value > 0
    ? 'asset-performance-positive'
    : 'asset-performance-negative';
}

function compareAssetNames(a: WatchlistAsset, b: WatchlistAsset) {
  return a.name.localeCompare(b.name, 'en', {
    sensitivity: 'base'
  });
}

function compareAssetPerformance(
  a: WatchlistAsset,
  b: WatchlistAsset,
  direction: 'asc' | 'desc',
  performanceBySymbol: Record<string, number | null>,
  performanceRange: ChartRange
) {
  const aPerformance = getAssetPerformance(
    a,
    performanceBySymbol,
    performanceRange
  );
  const bPerformance = getAssetPerformance(
    b,
    performanceBySymbol,
    performanceRange
  );

  if (aPerformance === null && bPerformance === null) {
    return compareAssetNames(a, b);
  }

  if (aPerformance === null) {
    return 1;
  }

  if (bPerformance === null) {
    return -1;
  }

  const result = aPerformance - bPerformance;

  return direction === 'asc' ? result : -result;
}

function compareAssetFavorites(
  a: WatchlistAsset,
  b: WatchlistAsset,
  favoritesFirst: boolean
) {
  if (a.isFavorite === b.isFavorite) {
    return 0;
  }

  if (favoritesFirst) {
    return a.isFavorite ? -1 : 1;
  }

  return a.isFavorite ? 1 : -1;
}

function sortAssets(
  assets: WatchlistAsset[],
  sortState: SortState,
  performanceBySymbol: Record<string, number | null>,
  performanceRange: ChartRange
) {
  return [...assets].sort((a, b) => {
    const favoriteResult = compareAssetFavorites(
      a,
      b,
      sortState.favoritesFirst
    );

    if (favoriteResult !== 0) {
      return favoriteResult;
    }

    if (sortState.key === 'dp') {
      return compareAssetPerformance(
        a,
        b,
        sortState.direction,
        performanceBySymbol,
        performanceRange
      );
    }

    if (sortState.direction === 'desc' && sortState.key === 'name') {
      return compareAssetNames(b, a);
    }

    return compareAssetNames(a, b);
  });
}

function getNextSortDirection(direction: SortDirection) {
  return direction === 'asc' ? 'desc' : 'asc';
}

function getSortArrow(direction: SortDirection) {
  return direction === 'asc' ? '↑' : '↓';
}

function AiAnalysisIndicator({
  badge,
  label,
  visible
}: {
  badge: string;
  label: string;
  visible: boolean;
}) {
  return (
    <span className='watchlist-ai-indicator-slot'>
      {visible ? (
        <span
          aria-label={label}
          className='watchlist-ai-indicator'
          role='img'
          title={label}>
          {badge}
        </span>
      ) : null}
    </span>
  );
}

function WatchlistItem({
  aiBadge,
  aiAnalysisLabel,
  asset,
  favoriteLabel,
  favoritePending,
  mobile,
  onFavoriteToggle,
  onSelect,
  performancePercent,
  selected,
  setItemRef
}: {
  aiBadge: string;
  aiAnalysisLabel: string;
  asset: WatchlistAsset;
  favoriteLabel: string;
  favoritePending: boolean;
  mobile: boolean;
  onFavoriteToggle: (symbol: string, isFavorite: boolean) => void;
  onSelect: (symbol: string) => void;
  performancePercent: number | null;
  selected: boolean;
  setItemRef: (symbol: string, element: HTMLElement | null) => void;
}) {
  const className = `sidebar-item sidebar-asset${
    selected ? ' sidebar-asset-selected' : ''
  }`;
  const hasMlAnalysis = supportsMlAnalysis(asset.symbol);
  const content = (
    <>
      <span className='sidebar-asset-main'>
        <span className='sidebar-asset-name'>{asset.name}</span>
        <span className='sidebar-asset-symbol'>{asset.symbol}</span>
      </span>
      <span
        className={`sidebar-performance ${getDayChangeClass(
          performancePercent
        )}`}>
        {formatPerformancePercent(performancePercent)}
      </span>
    </>
  );
  const favoriteButton = (
    <IconButton
      className={`watchlist-favorite-button${
        asset.isFavorite ? ' watchlist-favorite-button-active' : ''
      }`}
      disabled={favoritePending}
      label={favoriteLabel}
      onClick={() => onFavoriteToggle(asset.symbol, !asset.isFavorite)}
      pressed={asset.isFavorite}
      variant='ghost'>
      <span aria-hidden='true'>{asset.isFavorite ? '★' : '☆'}</span>
    </IconButton>
  );

  if (mobile) {
    return (
      <div
        className={className}
        ref={element => setItemRef(asset.symbol, element)}>
        <AiAnalysisIndicator
          badge={aiBadge}
          label={aiAnalysisLabel}
          visible={hasMlAnalysis}
        />
        {favoriteButton}
        <label
          className='sidebar-asset-select'
          htmlFor='dashboard-drawer'
          onClick={() => onSelect(asset.symbol)}>
          {content}
        </label>
      </div>
    );
  }

  return (
    <div
      className={className}
      ref={element => setItemRef(asset.symbol, element)}>
      <AiAnalysisIndicator
        badge={aiBadge}
        label={aiAnalysisLabel}
        visible={hasMlAnalysis}
      />
      {favoriteButton}
      <Button
        aria-label={`${asset.name} ${formatPerformancePercent(
          performancePercent
        )}`}
        aria-pressed={selected}
        className='sidebar-asset-select'
        onClick={() => onSelect(asset.symbol)}
        variant='plain'>
        {content}
      </Button>
    </div>
  );
}

export function WatchlistNav({
  assets,
  mobile = false,
  onAssetAdd,
  onFavoriteChange,
  onPerformanceRangeChange,
  onSelectSymbol,
  performanceBySymbol,
  performanceRange,
  selectedSymbol
}: WatchlistNavProps) {
  const t = useTranslations('watchlist');
  const commonT = useTranslations('common');
  const [sortState, setSortState] = useState<SortState>({
    direction: 'asc',
    favoritesFirst: true,
    key: 'name'
  });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AssetSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [pendingFavorites, setPendingFavorites] = useState<Set<string>>(
    () => new Set()
  );
  const itemRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchMessage(null);

      try {
        const response = await fetch(
          `/api/assets/search?q=${encodeURIComponent(trimmedQuery)}`,
          {
            cache: 'no-store',
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const body = (await response.json()) as {
          results?: AssetSearchResult[];
        };
        const nextResults = body.results ?? [];

        setResults(nextResults);
        setSearchMessage(nextResults.length === 0 ? t('noResult') : null);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setSearchMessage(t('searchFailed'));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query, t]);

  const sortedAssets = useMemo(
    () =>
      sortAssets(
        assets,
        sortState,
        performanceBySymbol,
        performanceRange
      ),
    [assets, performanceBySymbol, performanceRange, sortState]
  );
  const searchInputId = mobile ? 'asset-search-mobile' : 'asset-search-desktop';

  useEffect(() => {
    if (!selectedSymbol) {
      return;
    }

    itemRefs.current.get(selectedSymbol)?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth'
    });
  }, [selectedSymbol, sortedAssets]);

  function setItemRef(symbol: string, element: HTMLElement | null) {
    if (element) {
      itemRefs.current.set(symbol, element);
      return;
    }

    itemRefs.current.delete(symbol);
  }

  function handleQueryChange(value: string) {
    setQuery(value);

    if (value.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      setSearchMessage(null);
    }
  }

  function handleSortChange(key: SortKey) {
    setSortState(currentSort => {
      if (key === 'favorite') {
        return {
          ...currentSort,
          favoritesFirst: !currentSort.favoritesFirst,
          key
        };
      }

      if (currentSort.key === key) {
        return {
          ...currentSort,
          direction: getNextSortDirection(currentSort.direction),
          key
        };
      }

      return {
        ...currentSort,
        direction: key === 'dp' ? 'desc' : 'asc',
        key
      };
    });
  }

  function setFavoritePending(symbol: string, isPending: boolean) {
    setPendingFavorites(currentPending => {
      const nextPending = new Set(currentPending);

      if (isPending) {
        nextPending.add(symbol);
      } else {
        nextPending.delete(symbol);
      }

      return nextPending;
    });
  }

  async function handleFavoriteToggle(symbol: string, isFavorite: boolean) {
    if (pendingFavorites.has(symbol)) {
      return;
    }

    setFavoritePending(symbol, true);

    try {
      await onFavoriteChange(symbol, isFavorite);
    } catch {
      // The parent already rolls the optimistic state back.
    } finally {
      setFavoritePending(symbol, false);
    }
  }

  async function addAsset(symbol: string | null) {
    if (!symbol) {
      return;
    }

    const normalizedSymbol = symbol.trim().toUpperCase();

    if (assets.some(asset => asset.symbol === normalizedSymbol)) {
      onSelectSymbol(normalizedSymbol);
      setQuery('');
      setResults([]);
      return;
    }

    setSearchMessage(t('adding'));

    try {
      const response = await fetch(
        `/api/assets/watchlist?symbols=${encodeURIComponent(normalizedSymbol)}`,
        {
          cache: 'no-store'
        }
      );

      if (!response.ok) {
        throw new Error('Add failed');
      }

      const body = (await response.json()) as {
        assets?: WatchlistAsset[];
      };
      const [asset] = body.assets ?? [];

      if (!asset) {
        throw new Error('No asset returned');
      }

      onAssetAdd(asset);
      onSelectSymbol(asset.symbol);
      setQuery('');
      setResults([]);
      setSearchMessage(null);
    } catch {
      setSearchMessage(t('addFailed'));
    }
  }

  return (
    <div className='watchlist-panel mt-5'>
      <div className='asset-search'>
        <label className='asset-search-label' htmlFor={searchInputId}>
          {t('searchAsset')}
        </label>
        <input
          className='asset-search-input'
          id={searchInputId}
          onChange={event => handleQueryChange(event.target.value)}
          placeholder={t('searchPlaceholder')}
          type='search'
          value={query}
        />

        

        {(results.length > 0 || isSearching || searchMessage) && (
          <div className='asset-search-results'>
            {isSearching && (
              <p className='asset-search-message'>{t('searching')}</p>
            )}

            {!isSearching &&
              results.map(result => (
                <Button
                  className='asset-search-result'
                  key={`${result.symbol}-${result.name}`}
                  onClick={() => addAsset(result.symbol)}
                  variant='plain'>
                  <span className='asset-search-result-name'>
                    {result.name ?? result.symbol}
                  </span>
                  <span className='asset-search-result-symbol'>
                    {result.symbol}
                  </span>
                </Button>
              ))}

            {!isSearching && searchMessage && (
              <p className='asset-search-message'>{searchMessage}</p>
            )}
          </div>
        )}

        <a className='asset-advanced-search-button' href='/search'>
          {commonT("advancedSearch")}
        </a>
      </div>

      <div aria-label={t('sort')} className='watchlist-sort-bar' role='group'>
        <span aria-hidden='true' />
        <Button
          aria-label={t('sortFavorites')}
          className='watchlist-sort-button watchlist-sort-button-favorite'
          onClick={() => handleSortChange('favorite')}
          variant='plain'>
          <span aria-hidden='true'>★</span>
          <span className='watchlist-sort-arrow' aria-hidden='true'>
            {sortState.favoritesFirst ? '↑' : '↓'}
          </span>
        </Button>
        <Button
          aria-label={t('sortName')}
          className={`watchlist-sort-button watchlist-sort-button-name${
            sortState.key === 'name' ? ' watchlist-sort-button-active' : ''
          }`}
          onClick={() => handleSortChange('name')}
          variant='plain'>
          <span>A-Z</span>
          {sortState.key === 'name' ? (
            <span className='watchlist-sort-arrow' aria-hidden='true'>
              {getSortArrow(sortState.direction)}
            </span>
          ) : null}
        </Button>
        <SelectField
          ariaLabel={t('performanceRange')}
          containerClassName='watchlist-range-field'
          hideLabel
          label={t('performanceRange')}
          onValueChange={value => onPerformanceRangeChange(value)}
          options={chartRanges.map(range => ({
            label: range,
            value: range
          }))}
          selectClassName='watchlist-range-select'
          value={performanceRange}
        />
        <Button
          aria-label={t('sortDailyPercent')}
          className={`watchlist-sort-button watchlist-sort-button-percent${
            sortState.key === 'dp' ? ' watchlist-sort-button-active' : ''
          }`}
          onClick={() => handleSortChange('dp')}
          variant='plain'>
          <span>%</span>
          {sortState.key === 'dp' ? (
            <span className='watchlist-sort-arrow' aria-hidden='true'>
              {getSortArrow(sortState.direction)}
            </span>
          ) : null}
        </Button>
      </div>

      <nav className='watchlist-nav space-y-2'>
        {sortedAssets.map(asset => {
          const performancePercent = getAssetPerformance(
            asset,
            performanceBySymbol,
            performanceRange
          );

          return (
            <WatchlistItem
              aiBadge={t('aiBadge')}
              aiAnalysisLabel={t('aiAnalysisAvailable', {
                symbol: asset.symbol
              })}
              asset={asset}
              favoriteLabel={t(
                asset.isFavorite ? 'unfavoriteAsset' : 'favoriteAsset',
                {
                  symbol: asset.symbol
                }
              )}
              favoritePending={pendingFavorites.has(asset.symbol)}
              key={asset.symbol}
              mobile={mobile}
              onFavoriteToggle={handleFavoriteToggle}
              onSelect={onSelectSymbol}
              performancePercent={performancePercent}
              selected={asset.symbol === selectedSymbol}
              setItemRef={setItemRef}
            />
          );
        })}
      </nav>
    </div>
  );
}
