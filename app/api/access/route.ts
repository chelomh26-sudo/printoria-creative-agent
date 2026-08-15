import { NextResponse } from "next/server";
import { ACCESS_COOKIE, accessToken } from "@/lib/access";

export async function POST(request: Request) {
  const configuredPassword = process.env.APP_ACCESS_PASSWORD;
  if (!configuredPassword) return NextResponse.json({ error: "Falta configurar APP_ACCESS_PASSWORD en Vercel." }, { status: 503 });
  const { password } = await request.json();
  if (typeof password !== "string" || password !== configuredPassword) return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, await accessToken(configuredPassword), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
