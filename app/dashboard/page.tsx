import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getEmployeeProfile, getSupervisorDashboard, type EmployeeProfile } from "@/lib/apps-script";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import SupervisorTeam from "./supervisor-team";
import styles from "./dashboard.module.css";

function displayWorkName(value: string) {
  return value.replace(/^[0-9]+\s*:\s*/, "").trim() || "—";
}

function displayKpiScore(value: number | null, maximum: number | null | undefined, showMaximum: boolean) {
  const earned = value ?? "—";
  return showMaximum ? `${earned} / ${maximum ?? "—"}` : String(earned);
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) redirect("/");
  if (session.mustChangePassword && !session.skippedPasswordChange) redirect("/change-password");

  const [profileResult, supervisorResult] = await Promise.allSettled([
    getEmployeeProfile(session.employeeId, session.credentialsRow),
    getSupervisorDashboard(session.employeeId, session.credentialsRow),
  ]);
  const profile: EmployeeProfile | null = profileResult.status === "fulfilled" ? profileResult.value : null;
  const supervisor = supervisorResult.status === "fulfilled" && supervisorResult.value.isSupervisor
    ? supervisorResult.value : null;
  if (profileResult.status === "rejected") {
    console.error("Dashboard profile load failed", profileResult.reason instanceof Error ? profileResult.reason.message : "Unknown error");
  }

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");

  return (
    <main className={styles.page}>
      <div className={styles.dashboard}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <Image src="/innovation-technology-logo.webp" alt="Innovation Technology" width={88} height={88} priority />
            <div className={styles.brandText}>
              <span>E-PERFORMANCE</span>
              <strong>ระบบประเมินผลการปฏิบัติงาน</strong>
            </div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className={styles.logoutButton} type="submit">ออกจากระบบ</button>
          </form>
        </header>

        <div className={styles.content}>
          <section className={styles.intro} aria-label="ภาพรวมของคุณ">
            <div className={styles.introText}>
              <p className={styles.kicker}>แดชบอร์ดของคุณ</p>
              <h1>สวัสดี {fullName || session.employeeId}</h1>
              <p className={styles.description}>
                {supervisor
                  ? "ตรวจสอบข้อมูลของคุณและพนักงานในความดูแล"
                  : "ตรวจสอบข้อมูลส่วนตัวและคะแนนของคุณ"}
              </p>
            </div>
            <div className={styles.introAction}>
              <span>แบบประเมินของคุณ</span>
              {profile?.formUrl ? (
                <a className={styles.evaluateButton} href={profile.prefilledFormUrl ?? profile.formUrl} target="_blank" rel="noopener noreferrer">
                  เริ่มประเมิน <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <p className={styles.formUnavailable}>
                  {profile ? "ยังไม่มีลิงก์แบบประเมิน" : "โหลดลิงก์แบบประเมินไม่ได้"}
                </p>
              )}
            </div>
          </section>

          {session.mustChangePassword && (
            <p className={styles.passwordReminder}>
              คุณยังไม่ได้เปลี่ยนรหัสผ่านเริ่มต้น <Link href="/change-password">ตั้งรหัสผ่านใหม่</Link>
            </p>
          )}

          <div className={styles.contentGrid}>
            <section className={styles.profileCard} aria-labelledby="profile-heading">
              <h2 id="profile-heading">ข้อมูลส่วนตัว</h2>
              {profile ? (
                <dl className={styles.profileFields}>
                  <div><dt>รหัสพนักงาน</dt><dd>{profile.employeeId}</dd></div>
                  <div><dt>ชื่อ-นามสกุล</dt><dd>{fullName || "—"}</dd></div>
                  <div><dt>หน่วยงาน</dt><dd>{displayWorkName(profile.department)}</dd></div>
                  <div><dt>โครงการ</dt><dd>{displayWorkName(profile.project)}</dd></div>
                </dl>
              ) : (
                <p className={styles.profileUnavailable}>ไม่สามารถโหลดข้อมูลส่วนตัวได้ กรุณาลองใหม่อีกครั้ง</p>
              )}
            </section>

            <section className={styles.scoreCard} aria-labelledby="hr-score-heading">
              <div className={styles.scoreHeader}>
                <p className={styles.sectionLabel}>ผลคะแนนของคุณ</p>
                <h2 id="hr-score-heading">คะแนน HR</h2>
              </div>
              <div className={styles.scoreBody}>
                <div className={styles.scoreMain}>
                  <span className={styles.scoreMainLabel}>คะแนนรอบปัจจุบัน</span>
                  <div className={styles.scoreValue}>
                    {profile?.hrScore !== null && profile?.hrScore !== undefined ? (
                      <><strong>{profile.hrScore}</strong><span>{profile.hrFullScore !== null ? `/ ${profile.hrFullScore} คะแนน` : "คะแนน"}</span></>
                    ) : (
                      <span>ยังไม่มีข้อมูลคะแนน</span>
                    )}
                  </div>
                  <p className={styles.scoreDescription}>ข้อมูลจากฝ่ายบุคคล</p>
                  {profile?.hrPastPerformanceScore !== null && profile?.hrPastPerformanceScore !== undefined && (
                    <div className={styles.historicalScore}>
                      <span>คะแนนการปฏิบัติงานที่ผ่านมา</span>
                      <strong>{profile.hrPastPerformanceScore} คะแนน</strong>
                    </div>
                  )}
                </div>
                <div className={styles.scoreDetails}>
                  <div className={styles.scoreDetailsHeading}>
                    <h3>รายละเอียดคะแนน</h3>
                    {profile?.hrScoreMaximums && <span>คะแนนที่ได้ / คะแนนเต็ม</span>}
                  </div>
                  {profile?.hrScoreBreakdown ? (
                    <dl className={styles.scoreBreakdown}>
                      <div><dt>KPI ฝึกอบรม</dt><dd>{displayKpiScore(profile.hrScoreBreakdown.training, profile.hrScoreMaximums?.training, !!profile.hrScoreMaximums)}</dd></div>
                      <div><dt>KPI ลา</dt><dd>{displayKpiScore(profile.hrScoreBreakdown.leave, profile.hrScoreMaximums?.leave, !!profile.hrScoreMaximums)}</dd></div>
                      <div><dt>KPI ใบเตือน</dt><dd>{displayKpiScore(profile.hrScoreBreakdown.warning, profile.hrScoreMaximums?.warning, !!profile.hrScoreMaximums)}</dd></div>
                      <div><dt>KPI ประชุม</dt><dd>{displayKpiScore(profile.hrScoreBreakdown.meeting, profile.hrScoreMaximums?.meeting, !!profile.hrScoreMaximums)}</dd></div>
                      <div><dt>คะแนนตรวจสุขภาพ</dt><dd>{profile.hrScoreBreakdown.health ?? "—"}</dd></div>
                    </dl>
                  ) : (
                    <p className={styles.scoreDetailsUnavailable}>รายละเอียดคะแนนยังไม่พร้อม</p>
                  )}
                </div>
              </div>
            </section>
          </div>
          {supervisor && <SupervisorTeam reports={supervisor.reports} />}
        </div>
      </div>
    </main>
  );
}
