"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import styles from "../login.module.css";

function EyeIcon({ hidden }: { hidden: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-5.2 9.5-5.2 9.5 5.2 9.5 5.2-3.3 5.2-9.5 5.2S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.5" />{hidden && <path d="m4 4 16 16" />}</svg>;
}

export default function ChangePasswordForm({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password !== confirmation) {
      setMessage("รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { message?: string; next?: string };

      if (!response.ok || !data.next) {
        setMessage(data.message ?? "ไม่สามารถเปลี่ยนรหัสผ่านได้");
        return;
      }

      router.push(data.next);
      router.refresh();
    } catch {
      setMessage("ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setPending(false);
    }
  }

  async function handleSkip() {
    setMessage("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/skip-password-change", {
        method: "POST",
      });
      const data = (await response.json()) as { message?: string; next?: string };

      if (!response.ok || !data.next) {
        setMessage(data.message ?? "ไม่สามารถข้ามได้ กรุณาลองใหม่อีกครั้ง");
        return;
      }

      router.push(data.next);
      router.refresh();
    } catch {
      setMessage("ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className={styles.pageShell}>
      <section className={styles.loginPanel}>
        <div className={styles.loginCard}>
          <div className={styles.logoWrap}>
            <Image src="/innovation-technology-logo.webp" alt="Innovation Technology" width={256} height={256} priority />
          </div>
          <div className={styles.heading}>
            <h2>ตั้งรหัสผ่านใหม่</h2>
            <p>เข้าสู่ระบบครั้งแรกด้วยรหัสพนักงาน {employeeId}</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.fieldGroup}>
              <label htmlFor="new-password">รหัสผ่านใหม่</label>
              <div className={styles.inputWrap}>
                <input id="new-password" name="newPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="อย่างน้อย 8 ตัวอักษร" value={password} onChange={(event) => setPassword(event.target.value)} required />
                <button className={styles.passwordToggle} type="button" aria-label={showPassword ? "ซ่อนรหัสผ่านใหม่" : "แสดงรหัสผ่านใหม่"} aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)}><EyeIcon hidden={showPassword} /></button>
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</label>
              <div className={styles.inputWrap}>
                <input id="confirm-password" name="confirmPassword" type={showConfirmation ? "text" : "password"} autoComplete="new-password" placeholder="กรอกรหัสผ่านใหม่อีกครั้ง" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
                <button className={styles.passwordToggle} type="button" aria-label={showConfirmation ? "ซ่อนรหัสผ่านยืนยัน" : "แสดงรหัสผ่านยืนยัน"} aria-pressed={showConfirmation} onClick={() => setShowConfirmation((current) => !current)}><EyeIcon hidden={showConfirmation} /></button>
              </div>
            </div>

            <div className={styles.passwordRules}>รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และประกอบด้วยตัวอักษรภาษาอังกฤษกับตัวเลข</div>
            <button className={styles.submitButton} type="submit" disabled={pending}>
              {pending ? <><span className={styles.spinner} aria-hidden="true" />กำลังบันทึก...</> : "บันทึกรหัสผ่านใหม่"}
            </button>
            <button className={styles.skipButton} type="button" onClick={handleSkip} disabled={pending}>
              ข้ามไปก่อน
            </button>
            <p className={styles.skipHint}>ระบบจะให้ตั้งรหัสผ่านใหม่อีกครั้งเมื่อเข้าสู่ระบบครั้งถัดไป</p>
            <p className={`${styles.notice} ${styles.noticeError}`} aria-live="polite">{message}</p>
          </form>
        </div>
      </section>
    </main>
  );
}
