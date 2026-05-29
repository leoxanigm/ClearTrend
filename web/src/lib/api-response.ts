import { NextResponse } from 'next/server';

export function apiError(message: string, status = 400) {
  return NextResponse.json(
    {
      error: message
    },
    {
      status
    }
  );
}

export function readJsonBody(req: Request) {
  return req.json().catch(() => null);
}

export function getRequestContentType(req: Request) {
  return req.headers.get('content-type')?.toLowerCase() ?? '';
}

export function expectsJson(req: Request) {
  const contentType = getRequestContentType(req);

  return contentType.includes('application/json') || contentType === '';
}
