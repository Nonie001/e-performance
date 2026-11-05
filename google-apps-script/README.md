# Google Apps Script setup

1. Open the E-Performance Google Sheet.
2. Select **Extensions → Apps Script**.
3. Replace the contents of `Code.gs` with the repository's `Code.gs` file.
4. Open **Project Settings → Script Properties** and create `API_SECRET` with a random value of at least 32 characters.
5. Select **Deploy → New deployment → Web app**.
6. Set **Execute as** to `Me` and **Who has access** to `Anyone`.
7. Deploy, authorize access, and copy the URL ending in `/exec`.
8. Put the URL and the same secret in the Next.js/Vercel environment variables:

```env
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
APPS_SCRIPT_SECRET=the-same-value-as-API_SECRET
SESSION_SECRET=a-different-random-value-at-least-32-characters
```

Generate each secret separately:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Never commit `.env.local` or share either secret in chat.

After changing `Code.gs`, update the existing Web App deployment via **Deploy → Manage deployments → Edit → New version → Deploy**. Saving the editor alone does not update the `/exec` deployment. The password-change API now returns `verified: true` only after reading the new value back from column B; Next.js rejects older deployments that do not return this confirmation.

The Dashboard calls the `getProfile` action to read the signed-in employee's row in `UserCredentials`: column C (`empId`), D (`firstName`), E (`lastName`), and I (`formUrl`). It then matches the employee ID against column A in `Hierarchy for evaluate` and reads F (`หน่วยงาน`) and G (`โครงการ`). Deploy a new Apps Script version after changing `Code.gs`; until then, the new fields will appear as unavailable.

The same action opens the HR Score spreadsheet (`HR_SPREADSHEET_ID`) and matches the employee ID against column A (`รหัสพนักงาน`). It reads the past performance score from V (`คะแนนการปฏิบัติงานที่ผ่านมาในปี`), KPI maximums from Y:AB, KPI earned scores from AC:AF, the current total from AJ (`คะแนนรวม`), the total maximum from AK (`Full score`), and the health adjustment from AM (`HeathScore`). The deployment owner must have access to that spreadsheet. A missing or duplicate ID, a blank or nonnumeric total, or a sheet access error shows “ยังไม่มีข้อมูลคะแนน” for the current total on the Dashboard. A real score of zero remains visible as `0`; a blank category maximum is shown as `—`, distinct from zero. The past score is labeled separately from the current total and KPI breakdown. Updated values appear after Apps Script and the Next.js app have been redeployed.

The evaluation button uses the employee's `formUrl` from column I. When all prefill fields are available, Apps Script builds a per-employee Google Forms URL using entry IDs from F:H and K:N, and values from A, D:E, and O:R. This reproduces the old form's prefilled employee ID, name, surname, and four HR scores without reusing its login page. The O:R values are passed through as stored in the old system, including a valid zero or nonempty text. If an entry ID or required value is missing or invalid, the button retains the raw form URL and tells the employee to fill the form manually. Update the existing Apps Script deployment to a new version, then deploy the Next.js app to enable prefill.

The supervisor Dashboard shows 2568 round-two results for direct reports. It verifies the signed-in supervisor against `UserCredentials`, selects direct reports using `Hierarchy for evaluate` columns A (`ID`) and B (`2nd`), then looks up that supervisor's six-digit ID in column AE and opens the spreadsheet URL in AG. It reads `Score record` (A = ID, B = self score, C = supervisor score) because some files have results there while `บันทึกการประเมิน` is empty. Numeric values from `บันทึกการประเมิน` (B = ID, C = self score, D = supervisor score) override records when present. For repeated IDs, the last numeric value in each score column wins. Only rows whose IDs are in the verified direct-report list are returned. Missing source mappings or inaccessible files show a source-unavailable message; a blank score displays `—` while a numeric zero displays `0`. The script deployment owner needs access to the linked supervisor spreadsheets. Update the existing Apps Script Web App deployment to a new version after changing `Code.gs`.

The `getSupervisorReview` action powers `/supervisor/review/[employeeId]`. It verifies the supervisor's session-backed employee ID and credentials row, checks that the target is exactly one of their direct reports, and only then reads that employee's HR score. The route displays identity, HR score breakdown, and self-evaluation score together. It is read-only; a missing self score does not prove whether the employee submitted the Google Form. Deploy a new Apps Script Web App version for this action before using the route with live data.
