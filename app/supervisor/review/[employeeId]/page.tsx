import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getSupervisorReview } from "@/lib/apps-script";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import styles from "./review.module.css";

function workName(value: string) {
  return value.replace(/^[0-9]+\s*:\s*/, "").trim() || "—";
}

function score(value: number | null) {
  return value === null ? "—" : String(value);
}

export default async function SupervisorReviewPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/");
  if (session.mustChangePassword && !session.skippedPasswordChange) redirect("/change-password");

  const { employeeId } = await params;
  if (!/^\d{1,10}$/.test(employeeId)) notFound();

  let review;
  try {
    review = await getSupervisorReview(session.employeeId, session.credentialsRow, employeeId);
  } catch (error) {
    console.error("Supervisor review load failed", error instanceof Error ? error.message : "Unknown error");
    return (
      <main className={styles.page}>
        <section className={styles.shell}>
          <Link className={styles.back} href="/dashboard#team">← กลับไปพนักงานในความดูแล</Link>
          <h1>ยังโหลดข้อมูลตรวจทานไม่ได้</h1>
          <p>กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบหากยังพบปัญหา</p>
        </section>
      </main>
    );
  }
  if (!review) notFound();

  const { report } = review;
  const fullName = [report.firstName, report.lastName].filter(Boolean).join(" ") || report.employeeId;
  const hrScore = review.hrScore;
  const selfScore = review.scoreSourceAvailable ? report.selfEvaluationScore : null;
  const breakdown = review.hrScoreBreakdown;
  const maximums = review.hrScoreMaximums;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link className={styles.back} href="/dashboard#team">← กลับไปพนักงานในความดูแล</Link>
        <header className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>หัวหน้างาน · ตรวจทานข้อมูลรายคน</p>
            <h1>{fullName}</h1>
            <p>ข้อมูลประกอบการประเมินรอบ 2 · ปี 2568</p>
          </div>
          <span className={styles.id}>รหัสพนักงาน {report.employeeId}</span>
        </header>

        <section className={styles.person} aria-labelledby="person-heading">
          <h2 id="person-heading">ข้อมูลพนักงาน</h2>
          <dl className={styles.fields}>
            <div><dt>ชื่อ-นามสกุล</dt><dd>{fullName}</dd></div>
            <div><dt>ตำแหน่ง</dt><dd>{report.position || "—"}</dd></div>
            <div><dt>หน่วยงาน</dt><dd>{workName(report.department)}</dd></div>
            <div><dt>โครงการ</dt><dd>{workName(report.project)}</dd></div>
          </dl>
        </section>

        <div className={styles.columns}>
          <section className={styles.card} aria-labelledby="hr-heading">
            <p className={styles.source}>ข้อมูลจากฝ่าย HR</p>
            <h2 id="hr-heading">คะแนน HR</h2>
            <p className={styles.bigScore}>{score(hrScore)}{hrScore !== null && <span> / {score(review.hrFullScore)} คะแนน</span>}</p>
            {hrScore === null && <p className={styles.missing}>ยังไม่มีคะแนนรวมที่จับคู่ได้</p>}
            {review.hrPastPerformanceScore !== null && (
              <p className={styles.past}>คะแนนการปฏิบัติงานที่ผ่านมา: <strong>{review.hrPastPerformanceScore}</strong></p>
            )}
            {breakdown && (
              <dl className={styles.breakdown}>
                <div><dt>KPI ฝึกอบรม</dt><dd>{score(breakdown.training)} / {score(maximums?.training ?? null)}</dd></div>
                <div><dt>KPI ลา</dt><dd>{score(breakdown.leave)} / {score(maximums?.leave ?? null)}</dd></div>
                <div><dt>KPI ใบเตือน</dt><dd>{score(breakdown.warning)} / {score(maximums?.warning ?? null)}</dd></div>
                <div><dt>KPI ประชุม</dt><dd>{score(breakdown.meeting)} / {score(maximums?.meeting ?? null)}</dd></div>
                <div><dt>คะแนนตรวจสุขภาพ</dt><dd>{score(breakdown.health)}</dd></div>
              </dl>
            )}
          </section>

          <section className={styles.card} aria-labelledby="self-heading">
            <p className={styles.source}>ข้อมูลการประเมินตนเอง</p>
            <h2 id="self-heading">คะแนนประเมินตนเอง</h2>
            <p className={styles.submission}>
              สถานะการส่งแบบประเมิน: <strong>{review.selfSubmission.status === "submitted"
                ? "ส่งแล้ว" : review.selfSubmission.status === "not_submitted" ? "ยังไม่พบการส่ง" : "ตรวจสอบไม่ได้"}</strong>
              {review.selfSubmission.formCode && <span> · {review.selfSubmission.formCode}</span>}
            </p>
            <p className={styles.bigScore}>{score(selfScore)}<span>{selfScore !== null ? " คะแนน" : ""}</span></p>
            {selfScore === null && <p className={styles.missing}>{review.scoreSourceAvailable ? "ยังไม่พบคะแนนประเมินตนเอง" : "ยังโหลดแหล่งคะแนนไม่ได้"}</p>}
            <p className={styles.note}>สถานะอ้างอิงคำตอบในไฟล์ EF ตามรหัสพนักงาน ส่วนคะแนนอ้างอิงไฟล์ประเมินรอบ 2 ของหัวหน้า</p>
            {report.evaluationUrl && <a className={styles.document} href={report.evaluationUrl} target="_blank" rel="noopener noreferrer">เปิดเอกสารประเมิน ↗</a>}
          </section>
        </div>
      </div>
    </main>
  );
}
