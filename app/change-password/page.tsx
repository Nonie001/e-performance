import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import ChangePasswordForm from "./change-password-form";

export default async function ChangePasswordPage() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) redirect("/");
  if (!session.mustChangePassword) redirect("/dashboard");

  return <ChangePasswordForm employeeId={session.employeeId} />;
}
