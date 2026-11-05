import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AppsScriptConfigurationError,
  AppsScriptRequestError,
  AppsScriptTimeoutError,
  authenticateEmployee,
} from "@/lib/apps-script";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session";

const loginSchema = z.object({
  employeeId: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

export const maxDuration = 40;

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: "กรุณากรอกรหัสพนักงานและรหัสผ่านให้ครบถ้วน" },
        { status: 400 },
      );
    }

    const employee = await authenticateEmployee(
      result.data.employeeId,
      result.data.password,
    );

    if (!employee) {
      return NextResponse.json(
        { message: "รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 },
      );
    }

    const token = await createSessionToken({
      employeeId: employee.employeeId,
      credentialsRow: employee.rowNumber,
      mustChangePassword: employee.mustChangePassword,
    });

    const response = NextResponse.json({
      next: employee.mustChangePassword ? "/change-password" : "/dashboard",
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return response;
  } catch (error) {
    if (error instanceof AppsScriptConfigurationError) {
      return NextResponse.json(
        { message: "ระบบตรวจสอบบัญชียังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ" },
        { status: 503 },
      );
    }

    if (error instanceof AppsScriptRequestError) {
      return NextResponse.json(
        { message: "ไม่สามารถติดต่อระบบตรวจสอบบัญชีได้" },
        { status: 502 },
      );
    }

    if (error instanceof AppsScriptTimeoutError) {
      return NextResponse.json(
        { message: "ระบบตรวจสอบบัญชีตอบช้า กรุณาลองใหม่อีกครั้ง" },
        { status: 504 },
      );
    }

    console.error("Login failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { message: "ไม่สามารถเข้าสู่ระบบได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }
}
