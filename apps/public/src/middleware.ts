import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.firebaseio.com https://*.googleapis.com https://*.googlesyndication.com https://jsbarcode https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.googleapis.com https://*.firebasestorage.app https://*.googleusercontent.com; font-src 'self' data:; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://firestore.googleapis.com wss://*.firebaseio.com https://script.google.com; frame-src 'self' https://*.firebaseapp.com https://*.google.com; media-src 'self'"
  );

  return response;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|logo\\.svg).*)",
};
