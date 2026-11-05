import "server-only";

export class AppsScriptConfigurationError extends Error {}
export class AppsScriptRequestError extends Error {}
export class AppsScriptTimeoutError extends Error {}

type AppsScriptResponse = {
  success: boolean;
  message?: string;
  employeeId?: string;
  rowNumber?: number;
  mustChangePassword?: boolean;
  verified?: boolean;
  firstName?: string;
  lastName?: string;
  formUrl?: string;
  prefilledFormUrl?: string | null;
  department?: string;
  project?: string;
  hrScore?: number | null;
  hrFullScore?: number | null;
  hrPastPerformanceScore?: number | null;
  hrScoreBreakdown?: Partial<Record<"training" | "leave" | "warning" | "meeting" | "health", number | null>> | null;
  hrScoreMaximums?: Partial<Record<"training" | "leave" | "warning" | "meeting", number | null>> | null;
  isSupervisor?: boolean;
  scoreSourceAvailable?: boolean;
  reports?: unknown;
};

function getConfiguration() {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;

  if (!url || !secret) {
    throw new AppsScriptConfigurationError(
      "Google Apps Script connection is not configured.",
    );
  }

  return { url, secret };
}

async function callAppsScript(
  payload: Record<string, string | number>,
): Promise<AppsScriptResponse> {
  const { url, secret } = getConfiguration();
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, secret }),
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new AppsScriptTimeoutError("Apps Script did not respond in time");
    }

    throw new AppsScriptRequestError("ไม่สามารถเชื่อมต่อ Apps Script ได้");
  }

  if (!response.ok) {
    throw new AppsScriptRequestError("Apps Script ไม่ตอบสนอง");
  }

  try {
    return (await response.json()) as AppsScriptResponse;
  } catch {
    throw new AppsScriptRequestError("Apps Script ส่งข้อมูลกลับมาไม่ถูกต้อง");
  }
}

export type AuthenticatedEmployee = {
  employeeId: string;
  rowNumber: number;
  mustChangePassword: boolean;
};

export type EmployeeProfile = {
  employeeId: string;
  firstName: string;
  lastName: string;
  formUrl: string | null;
  prefilledFormUrl: string | null;
  department: string;
  project: string;
  hrScore: number | null;
  hrFullScore: number | null;
  hrPastPerformanceScore: number | null;
  hrScoreBreakdown: {
    training: number | null;
    leave: number | null;
    warning: number | null;
    meeting: number | null;
    health: number | null;
  } | null;
  hrScoreMaximums: {
    training: number | null;
    leave: number | null;
    warning: number | null;
    meeting: number | null;
  } | null;
};

export type SupervisorReport = {
  employeeId: string;
  firstName: string;
  lastName: string;
  department: string;
  project: string;
  position: string;
  evaluationUrl: string | null;
  selfEvaluationScore: number | null;
  supervisorEvaluationScore: number | null;
};

export type SupervisorDashboard = {
  isSupervisor: boolean;
  scoreSourceAvailable: boolean;
  reports: SupervisorReport[];
};

function validEvaluationUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "docs.google.com" &&
      url.pathname.startsWith("/spreadsheets/d/") ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function getSupervisorDashboard(
  employeeId: string,
  rowNumber: number,
): Promise<SupervisorDashboard> {
  const result = await callAppsScript({ action: "getSupervisorDashboard", employeeId, rowNumber });
  if (!result.success || typeof result.isSupervisor !== "boolean" || !Array.isArray(result.reports)) {
    throw new AppsScriptRequestError("ไม่สามารถโหลดข้อมูลทีมได้");
  }

  const reports = result.reports.map((item) => {
    if (!item || typeof item !== "object") throw new AppsScriptRequestError("ข้อมูลลูกน้องไม่ถูกต้อง");
    const row = item as Record<string, unknown>;
    if (["employeeId", "firstName", "lastName", "department", "project", "position"].some(
      (key) => typeof row[key] !== "string",
    )) throw new AppsScriptRequestError("ข้อมูลลูกน้องไม่ครบถ้วน");
    return {
      employeeId: row.employeeId as string,
      firstName: row.firstName as string,
      lastName: row.lastName as string,
      department: row.department as string,
      project: row.project as string,
      position: row.position as string,
      evaluationUrl: validEvaluationUrl(row.evaluationUrl),
      selfEvaluationScore: validScore(row.selfEvaluationScore),
      supervisorEvaluationScore: validScore(row.supervisorEvaluationScore),
    };
  });

  return {
    isSupervisor: result.isSupervisor && reports.length > 0,
    scoreSourceAvailable: result.scoreSourceAvailable === true,
    reports,
  };
}

function validScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function validFormUrl(value: string): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      url.hostname === "docs.google.com" &&
      url.pathname.startsWith("/forms/")
    ) {
      return url.toString();
    }
  } catch {
    // A missing or malformed form URL is treated as unavailable.
  }

  return null;
}

export async function getEmployeeProfile(
  employeeId: string,
  rowNumber: number,
): Promise<EmployeeProfile> {
  const result = await callAppsScript({
    action: "getProfile",
    employeeId,
    rowNumber,
  });

  if (
    !result.success ||
    typeof result.employeeId !== "string" ||
    typeof result.firstName !== "string" ||
    typeof result.lastName !== "string" ||
    typeof result.formUrl !== "string"
  ) {
    throw new AppsScriptRequestError("ไม่สามารถโหลดข้อมูลพนักงานได้");
  }

  return {
    employeeId: result.employeeId,
    firstName: result.firstName,
    lastName: result.lastName,
    formUrl: validFormUrl(result.formUrl),
    prefilledFormUrl: typeof result.prefilledFormUrl === "string" ? validFormUrl(result.prefilledFormUrl) : null,
    department: typeof result.department === "string" ? result.department : "",
    project: typeof result.project === "string" ? result.project : "",
    hrScore: validScore(result.hrScore),
    hrFullScore: validScore(result.hrFullScore),
    hrPastPerformanceScore: validScore(result.hrPastPerformanceScore),
    hrScoreBreakdown: result.hrScoreBreakdown ? {
      training: validScore(result.hrScoreBreakdown.training),
      leave: validScore(result.hrScoreBreakdown.leave),
      warning: validScore(result.hrScoreBreakdown.warning),
      meeting: validScore(result.hrScoreBreakdown.meeting),
      health: validScore(result.hrScoreBreakdown.health),
    } : null,
    hrScoreMaximums: result.hrScoreMaximums ? {
      training: validScore(result.hrScoreMaximums.training),
      leave: validScore(result.hrScoreMaximums.leave),
      warning: validScore(result.hrScoreMaximums.warning),
      meeting: validScore(result.hrScoreMaximums.meeting),
    } : null,
  };
}

export async function authenticateEmployee(
  username: string,
  password: string,
): Promise<AuthenticatedEmployee | null> {
  const result = await callAppsScript({
    action: "login",
    username,
    password,
  });

  if (!result.success) {
    if (result.message === "Invalid credentials" || result.message === "Account not found") {
      return null;
    }

    if (result.message === "Unauthorized") {
      throw new AppsScriptConfigurationError(
        "Apps Script rejected the API secret. Check APPS_SCRIPT_SECRET, API_SECRET, and the deployment URL.",
      );
    }

    throw new AppsScriptRequestError(result.message ?? "Apps Script login failed");
  }

  if (
    typeof result.employeeId !== "string" ||
    typeof result.rowNumber !== "number" ||
    typeof result.mustChangePassword !== "boolean"
  ) {
    throw new AppsScriptRequestError("ข้อมูลบัญชีที่ได้รับไม่ครบถ้วน");
  }

  return {
    employeeId: result.employeeId,
    rowNumber: result.rowNumber,
    mustChangePassword: result.mustChangePassword,
  };
}

export async function changeEmployeePassword(
  employeeId: string,
  rowNumber: number,
  password: string,
) {
  const result = await callAppsScript({
    action: "changePassword",
    employeeId,
    rowNumber,
    password,
  });

  if (!result.success) {
    throw new AppsScriptRequestError(
      result.message ?? "ไม่สามารถเปลี่ยนรหัสผ่านได้",
    );
  }

  if (result.verified !== true) {
    throw new AppsScriptRequestError("ระบบยังไม่ยืนยันว่ารหัสผ่านถูกบันทึกในชีตแล้ว");
  }
}
