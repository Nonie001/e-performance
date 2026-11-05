import Image from "next/image";
import type { Metadata } from "next";

import styles from "./round-two.module.css";

export const metadata: Metadata = {
  title: "ตัวอย่างคะแนนรอบ 2 | E-Performance",
  robots: { index: false, follow: false },
};

const reports = [
  { id: "EMP-001", name: "พนักงานตัวอย่าง ก", department: "หน่วยงานตัวอย่าง", form: "EF-03", self: 76, supervisor: 82.5 },
  { id: "EMP-002", name: "พนักงานตัวอย่าง ข", department: "หน่วยงานตัวอย่าง", form: "EF-04", self: 81, supervisor: null },
  { id: "EMP-003", name: "พนักงานตัวอย่าง ค", department: "อีกหน่วยงาน", form: "EF-07", self: null, supervisor: null },
];

export default function RoundTwoPreviewPage() {
  const completed = reports.filter((report) => report.supervisor !== null).length;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <Image src="/innovation-technology-logo.webp" alt="Innovation Technology" width={52} height={52} priority />
            <div><span>E-PERFORMANCE</span><strong>ระบบประเมินผลการปฏิบัติงาน</strong></div>
          </div>
          <span className={styles.demoBadge}>ตัวอย่างหน้าจอ · ข้อมูลสมมติ</span>
        </header>

        <div className={styles.content}>
          <div className={styles.intro}>
            <p>แดชบอร์ดหัวหน้างาน / รอบประเมินที่ 2</p>
            <h1>คะแนนพนักงานในความดูแล</h1>
            <span>แสดงคะแนนประเมินตนเองและคะแนนจากหัวหน้างานแยกกัน</span>
          </div>

          <section className={styles.summary} aria-label="ภาพรวมการประเมิน">
            <div><span>พนักงานทั้งหมด</span><strong>{reports.length}</strong><small>คน</small></div>
            <div><span>หัวหน้าประเมินแล้ว</span><strong>{completed}</strong><small>คน</small></div>
            <div><span>รอประเมินรอบ 2</span><strong>{reports.length - completed}</strong><small>คน</small></div>
          </section>

          <section className={styles.panel} aria-labelledby="reports-heading">
            <div className={styles.panelHeader}>
              <div><p>รายการประเมิน</p><h2 id="reports-heading">ทีมของคุณ</h2></div>
              <span>คะแนนจากแบบประเมินรอบ 2</span>
            </div>
            <div className={styles.list}>
              {reports.map((report) => (
                <article className={styles.report} key={report.id}>
                  <div className={styles.person}>
                    <strong>{report.name}</strong>
                    <span>{report.id} · {report.department} · {report.form}</span>
                  </div>
                  <div className={styles.scores}>
                    <div><span>ประเมินตนเอง</span><strong>{report.self ?? "—"}</strong></div>
                    <div><span>หัวหน้างานรอบ 2</span><strong>{report.supervisor ?? "—"}</strong></div>
                  </div>
                  <span className={report.supervisor === null ? styles.pending : styles.done}>
                    {report.supervisor === null ? "รอคะแนนหัวหน้า" : "ประเมินแล้ว"}
                  </span>
                </article>
              ))}
            </div>
          </section>
          <p className={styles.note}>ตัวเลขและชื่อทั้งหมดในหน้านี้เป็นข้อมูลสมมติสำหรับดูหน้าตา ยังไม่ได้เชื่อมคะแนนจริง</p>
        </div>
      </div>
    </main>
  );
}
