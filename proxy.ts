import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, accessToken } from "@/lib/access";

export async function proxy(request: NextRequest) {
  const password = process.env.APP_ACCESS_PASSWORD;
  if (!password) return NextResponse.redirect(new URL("/access", request.url));
  const expected = await accessToken(password);
  if (request.cookies.get(ACCESS_COOKIE)?.value !== expected) return NextResponse.redirect(new URL("/access", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!access|api/access|_next/static|_next/image|favicon.svg).*)"] };
