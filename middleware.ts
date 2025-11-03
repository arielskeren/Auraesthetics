import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to landing page, API routes, and static files
  if (
    pathname.startsWith('/landing') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/amy-photo') ||
    pathname.startsWith('/services') ||
    pathname === '/'
  ) {
    // If root path and not authenticated, redirect to landing
    if (pathname === '/') {
      const authCookie = request.cookies.get('auraAdminAuth');
      const isAuthenticated = authCookie?.value === 'authenticated';
      
      if (!isAuthenticated) {
        const url = request.nextUrl.clone();
        url.pathname = '/landing';
        return NextResponse.redirect(url);
      }
    }
    
    return NextResponse.next();
  }

  // Check for admin authentication cookie
  const authCookie = request.cookies.get('auraAdminAuth');
  const isAuthenticated = authCookie?.value === 'authenticated';

  // If not authenticated and trying to access protected routes, redirect to landing
  if (!isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/landing';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

