import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AppsScriptConfigurationError,
  AppsScriptRequestError,
  AppsScriptTimeoutError,
  changeEmployeePassword,
} from "@/lib/apps-script";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/session";

const passwordSchema = z.object({
  password: z
    .string()
    .min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
    .max(100, "รหัสผ่านยาวเกินไป")
    .regex(/[A-Za-z]/, "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษ")
    .regex(/[0-9]/, "รหัสผ่านต้องมีตัวเลข"),
});

export const maxDuration = 40;

export async function POST(request: Request) {
  try {
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

    const body: unknown = await request.json();
    const result = passwordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: result.error.issues[0]?.message ?? "รหัสผ่านไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    if (/^\d{13}$/.test(result.data.password)) {
      return NextResponse.json(
        { message: "รหัสผ่านใหม่ต้องไม่ใช่เลขประจำตัวประชาชน" },
        { status: 400 },
      );
    }

    await changeEmployeePassword(
      session.employeeId,
      session.credentialsRow,
      result.data.password,
    );

    const token = await createSessionToken({
      ...session,
      mustChangePassword: false,
    });
    const response = NextResponse.json({ next: "/dashboard" });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return response;
  } catch (error) {
    if (error instanceof AppsScriptConfigurationError) {
      return NextResponse.json(
        { message: "ระบบยังไม่ได้ตั้งค่าการเชื่อมต่อ Google Apps Script" },
        { status: 503 },
      );
    }

    if (error instanceof AppsScriptRequestError) {
      return NextResponse.json(
        { message: error.message },
        { status: 502 },
      );
    }

    if (error instanceof AppsScriptTimeoutError) {
      return NextResponse.json(
        { message: "ระบบบันทึกรหัสผ่านตอบช้า กรุณาลองเข้าสู่ระบบด้วยรหัสใหม่ก่อน" },
        { status: 504 },
      );
    }

    console.error(
      "Password change failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { message: "ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }
}
