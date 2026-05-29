import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function proxy(request) {
  const path = request.nextUrl.pathname;
  const isPublicPath = path === '/login';
  const isAdminPath = path.startsWith('/admin');
  
  // Read the real NextAuth token
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET 
  });

  if (isPublicPath && token) {
    return NextResponse.redirect(new URL('/', request.nextUrl));
  }

  // Admin route requires exact email match
  if (isAdminPath) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.nextUrl));
    }
    const adminEmailsStr = process.env.ADMIN_EMAILS || "";
    const adminEmails = adminEmailsStr.split(',').map(e => e.trim().toLowerCase());
    
    if (!token.email || !adminEmails.includes(token.email.toLowerCase())) {
      // If they are logged in but not an admin, kick them back to the reporting page
      return NextResponse.redirect(new URL('/', request.nextUrl)); 
    }
  }

  // Protect all main routes except login (and we let API routes pass for YOLO)
  if (!isPublicPath && !token && !path.startsWith('/api') && !path.startsWith('/_next') && !path.includes('.')) {
    return NextResponse.redirect(new URL('/login', request.nextUrl));
  }
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ]
};
