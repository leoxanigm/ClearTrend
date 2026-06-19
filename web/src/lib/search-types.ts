export const searchEntityTypes = [
  'assets',
  'analyses',
] as const;

export type SearchEntityType = (typeof searchEntityTypes)[number];

export const searchSortKeys = ['createdAt', 'name', 'symbol'] as const;

export type SearchSortKey = (typeof searchSortKeys)[number];

export const searchDirections = ['asc', 'desc'] as const;

export type SearchDirection = (typeof searchDirections)[number];

export type SearchResultItem = {
  id: string;
  type: 'asset' | 'analysis';
  title: string;
  subtitle: string | null;
  description: string | null;
  href: string | null;
  createdAt: string | null;
  metadata: Record<string, string | number | boolean | null>;
};

export type SearchResponse = {
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    direction: SearchDirection;
    limit: number;
    page: number;
    q: string;
    sentiment: string | null;
    sort: SearchSortKey;
    source: string | null;
    type: SearchEntityType;
  };
  pagination: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
  results: SearchResultItem[];
};
