import { NextResponse } from "next/server";

import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/session";

export async function POST(request: Request) {
  const session = await verifySessionToken(
    request.headers.get("cookie")
      ?.split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1),
  );

  if (!session || !session.mustChangePassword) {
    return NextResponse.json(
      { message: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่" },
      { status: 401 },
    );
  }

  const token = await createSessionToken({
    ...session,
    skippedPasswordChange: true,
  });
  const response = NextResponse.json({ next: "/dashboard" });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
}
