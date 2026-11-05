"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import styles from "./login.module.css";

type FormErrors = { employeeId?: string; password?: string };

const Icon = ({ name }: { name: "user" | "lock" }) => {
  const shapes = {
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.5-4.1 2.8-6.4 7-6.4s6.5 2.3 7 6.4" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 14v2.5" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{shapes[name]}</svg>;
};

function EyeIcon({ hidden }: { hidden: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-5.2 9.5-5.2 9.5 5.2 9.5 5.2-3.3 5.2-9.5 5.2S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.5" />{hidden && <path d="m4 4 16 16" />}</svg>;
}

export default function Home() {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [hasSubmitError, setHasSubmitError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    if (!employeeId.trim()) nextErrors.employeeId = "กรุณากรอกรหัสพนักงาน";
    if (!password) nextErrors.password = "กรุณากรอกรหัสผ่าน";
    setErrors(nextErrors);
    setNotice("");
    setHasSubmitError(false);
    if (Object.keys(nextErrors).length) return;
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employeeId.trim(), password }),
      });
      const data = (await response.json()) as { message?: string; next?: string };

      if (!response.ok || !data.next) {
        setHasSubmitError(true);
        setNotice(data.message ?? "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง");
        return;
      }

      router.push(data.next);
    } catch {
      setHasSubmitError(true);
      setNotice("ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.pageShell}>
      <section className={styles.loginPanel}>
        <div className={styles.loginCard}>
          <div className={styles.logoWrap}><Image src="/innovation-technology-logo.webp" alt="Innovation Technology" width={256} height={256} priority /></div>
          <div className={styles.heading}>
            <h2>เข้าสู่ระบบประเมินผล</h2>
            <p>กรอกข้อมูลบัญชีพนักงานเพื่อดำเนินการต่อ</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.fieldGroup}>
              <label htmlFor="employeeId">รหัสพนักงาน</label>
              <div className={`${styles.inputWrap} ${errors.employeeId ? styles.inputError : ""}`}>
                <span className={styles.inputIcon}><Icon name="user" /></span>
                <input id="employeeId" name="employeeId" type="text" autoComplete="username" placeholder="เช่น EMP00123" value={employeeId} aria-invalid={Boolean(errors.employeeId)} aria-describedby={errors.employeeId ? "employeeId-error" : undefined} onChange={(event) => { setEmployeeId(event.target.value); if (errors.employeeId) setErrors((current) => ({ ...current, employeeId: undefined })); }} />
              </div>
              {errors.employeeId && <p id="employeeId-error" className={styles.errorText}>{errors.employeeId}</p>}
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.labelRow}><label htmlFor="password">รหัสผ่าน</label><span>ครั้งแรกใช้รหัสผ่านที่ HR แจ้ง</span></div>
              <div className={`${styles.inputWrap} ${errors.password ? styles.inputError : ""}`}>
                <span className={styles.inputIcon}><Icon name="lock" /></span>
                <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="กรอกรหัสผ่าน" value={password} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : undefined} onChange={(event) => { setPassword(event.target.value); if (errors.password) setErrors((current) => ({ ...current, password: undefined })); }} />
                <button className={styles.passwordToggle} type="button" aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)}><EyeIcon hidden={showPassword} /></button>
              </div>
              {errors.password && <p id="password-error" className={styles.errorText}>{errors.password}</p>}
            </div>

            <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><span className={styles.spinner} aria-hidden="true" />กำลังเข้าสู่ระบบ...</> : <>เข้าสู่ระบบ<span aria-hidden="true">→</span></>}
            </button>
            <p className={`${styles.notice} ${hasSubmitError ? styles.noticeError : ""}`} aria-live="polite">{notice}</p>
          </form>

          <div className={styles.helpBox}><span className={styles.helpIcon}>?</span><div><strong>ไม่สามารถเข้าสู่ระบบได้?</strong><p>กรุณาติดต่อฝ่ายทรัพยากรบุคคล (HR) เพื่อขอความช่วยเหลือ</p></div></div>
        </div>
        <footer className={styles.footer}><span>© 2026 Innovation Technology Co., Ltd.</span><span className={styles.footerDivider} /><span>ระบบ E-Performance</span></footer>
      </section>
    </main>
  );
}
