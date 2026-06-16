import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Read token from Zustand persisted storage cookie
  const authStorage = request.cookies.get('trustscore-auth')?.value;
  let isAuthenticated = false;

  if (authStorage) {
    try {
      const parsed = JSON.parse(decodeURIComponent(authStorage));
      isAuthenticated = !!parsed?.state?.token;
    } catch {
      isAuthenticated = false;
    }
  }

  if (!isAuthenticated && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthenticated && isPublic) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};