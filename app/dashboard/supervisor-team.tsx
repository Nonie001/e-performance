"use client";

import { useMemo, useState } from "react";
import type { SupervisorReport } from "@/lib/apps-script";
import styles from "./supervisor-team.module.css";

function workName(value: string) {
  return value.replace(/^[0-9]+\s*:\s*/, "").trim() || "—";
}

export default function SupervisorTeam({ reports, scoreSourceAvailable }: { reports: SupervisorReport[]; scoreSourceAvailable: boolean }) {
  const [query, setQuery] = useState("");
  const visibleReports = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("th");
    if (!term) return reports;
    return reports.filter((report) => [
      report.employeeId, report.firstName, report.lastName,
      report.department, report.project, report.position,
    ].some((value) => value.toLocaleLowerCase("th").includes(term)));
  }, [query, reports]);

  return (
    <section className={styles.section} id="team" aria-labelledby="team-heading">
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>สำหรับหัวหน้างาน</p>
          <h2 id="team-heading">พนักงานในความดูแล <span className={styles.count}>{reports.length} คน</span></h2>
          <p className={styles.subtitle}>ผลประเมินรอบ 2 · ปี 2568</p>
        </div>
        <label className={styles.search}>
          <span className="sr-only">ค้นหาพนักงานในความดูแล</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ รหัส หรือหน่วยงาน" />
        </label>
      </div>

      <div className={styles.list}>
        {visibleReports.length ? visibleReports.map((report) => (
          <article className={styles.row} key={report.employeeId}>
            <div className={styles.person}>
              <strong>{[report.firstName, report.lastName].filter(Boolean).join(" ") || report.employeeId}</strong>
              <span>รหัส {report.employeeId} · {workName(report.department)}</span>
              <span>{workName(report.project)}{report.position ? ` · ${report.position}` : ""}</span>
            </div>
            <div className={styles.scores} aria-label={`คะแนนของ ${report.firstName} ${report.lastName}`}>
              <div><span>ประเมินตนเอง</span><strong>{scoreSourceAvailable ? report.selfEvaluationScore ?? "—" : "—"}</strong></div>
              <div><span>หัวหน้างานรอบ 2</span><strong>{scoreSourceAvailable ? report.supervisorEvaluationScore ?? "—" : "—"}</strong></div>
            </div>
            <div className={styles.footer}>
              <div className={styles.status}>
                <strong className={scoreSourceAvailable && report.supervisorEvaluationScore !== null ? styles.complete : undefined}>
                  {!scoreSourceAvailable ? "โหลดคะแนนไม่ได้" : report.supervisorEvaluationScore !== null ? "ประเมินแล้ว" : "รอคะแนนหัวหน้า"}
                </strong>
              </div>
              <div className={styles.action}>
                {report.evaluationUrl ? (
                  <a href={report.evaluationUrl} target="_blank" rel="noopener noreferrer">ดูเอกสารประเมิน <span aria-hidden="true">↗</span></a>
                ) : <span>ยังไม่มีลิงก์ประเมิน</span>}
              </div>
            </div>
          </article>
        )) : <p className={styles.empty}>ไม่พบพนักงานที่ตรงกับคำค้นหา</p>}
      </div>
      <p className={styles.note}>{scoreSourceAvailable
        ? "คะแนนจากไฟล์ประเมินรอบ 2 ของหัวหน้างาน ช่องว่างแสดงเป็น — และคะแนน 0 แสดงตามจริง"
        : "ยังเข้าถึงไฟล์คะแนนรอบ 2 ไม่ได้ กรุณาตรวจสิทธิ์ไฟล์และเวอร์ชัน Apps Script"}</p>
    </section>
  );
}
