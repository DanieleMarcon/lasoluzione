// src/middleware.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Non toccare asset/statiche e le route di NextAuth o la pagina di signin
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/admin/signin'
  ) {
    return NextResponse.next()
  }

  // Proteggi tutto /admin (tranne /admin/signin escluso sopra)
  if (pathname.startsWith('/admin')) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token) {
      const url = req.nextUrl.clone()
      url.pathname = '/admin/signin'
      url.searchParams.set('from', pathname) // per eventuale redirect post-login
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

// Limitiamo il middleware alle sole route che ci interessano
export const config = {
  matcher: ['/admin/:path*', '/api/auth/:path*'],
}
