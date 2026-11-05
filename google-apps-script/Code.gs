const SPREADSHEET_ID = "1ok23gHD6q8vHtGkrA92XKzoGXNTdXlaR97GYuHR4H54";
const HR_SPREADSHEET_ID = "1UM2iyWr7qWVyezCVtAiwxXb__O7LRmEirWQd3isb3fo";
const CREDENTIALS_SHEET = "UserCredentials";
const HIERARCHY_SHEET = "Hierarchy for evaluate";

function doPost(e) {
  try {
    const request = JSON.parse((e.postData && e.postData.contents) || "{}");
    const expectedSecret = PropertiesService.getScriptProperties().getProperty("API_SECRET");

    if (!expectedSecret || request.secret !== expectedSecret) {
      return jsonResponse({ success: false, message: "Unauthorized" });
    }

    if (request.action === "login") {
      return login(request);
    }

    if (request.action === "getProfile") {
      return getProfile(request);
    }

    if (request.action === "getSupervisorDashboard") {
      return getSupervisorDashboard(request);
    }

    if (request.action === "changePassword") {
      return changePassword(request);
    }

    return jsonResponse({ success: false, message: "Unknown action" });
  } catch (error) {
    console.error(error);
    return jsonResponse({ success: false, message: "Internal error" });
  }
}

function login(request) {
  const sheet = getCredentialsSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return jsonResponse({ success: false, message: "Account not found" });
  }

  // A = username, B = password. Display values preserve leading zeroes.
  const rows = sheet.getRange(2, 1, lastRow - 1, 2).getDisplayValues();
  const inputUsername = String(request.username || "").trim().toLowerCase();
  const inputPassword = String(request.password || "");

  for (let index = 0; index < rows.length; index += 1) {
    const storedUsername = String(rows[index][0] || "").trim();
    const storedPassword = String(rows[index][1] || "");

    if (
      storedUsername.toLowerCase() === inputUsername &&
      storedPassword === inputPassword
    ) {
      return jsonResponse({
        success: true,
        employeeId: storedUsername,
        rowNumber: index + 2,
        mustChangePassword: /^\d{13}$/.test(storedPassword),
      });
    }
  }

  return jsonResponse({ success: false, message: "Invalid credentials" });
}

function getProfile(request) {
  const rowNumber = Number(request.rowNumber);
  const employeeId = String(request.employeeId || "").trim();

  if (!Number.isInteger(rowNumber) || rowNumber < 2 || !employeeId) {
    return jsonResponse({ success: false, message: "Invalid employee" });
  }

  const sheet = getCredentialsSheet();
  if (rowNumber > sheet.getLastRow()) {
    return jsonResponse({ success: false, message: "Account not found" });
  }

  // A = username, C:E = profile, F:H and K:N = Form entry IDs,
  // I = formUrl, O:R = HR scores used by the legacy form.
  const credentialRange = sheet.getRange(rowNumber, 1, 1, 18);
  const row = credentialRange.getDisplayValues()[0];
  const rawRow = credentialRange.getValues()[0];
  if (String(row[0] || "").trim() !== employeeId) {
    return jsonResponse({ success: false, message: "Account not found" });
  }

  const profileEmployeeId = String(row[2] || "").trim() || employeeId;
  const workDetails = getWorkDetails(profileEmployeeId);
  let hrScoreDetails = null;

  try {
    hrScoreDetails = getHrScoreDetails(profileEmployeeId);
  } catch (error) {
    console.error("HR score lookup failed", error);
  }

  return jsonResponse({
    success: true,
    employeeId: profileEmployeeId,
    firstName: String(row[3] || "").trim(),
    lastName: String(row[4] || "").trim(),
    formUrl: String(row[8] || "").trim(),
    prefilledFormUrl: buildPrefilledFormUrl(row, rawRow),
    department: workDetails.department,
    project: workDetails.project,
    hrScore: hrScoreDetails ? hrScoreDetails.total : null,
    hrFullScore: hrScoreDetails ? hrScoreDetails.fullScore : null,
    hrPastPerformanceScore: hrScoreDetails ? hrScoreDetails.pastPerformanceScore : null,
    hrScoreBreakdown: hrScoreDetails ? hrScoreDetails.breakdown : null,
    hrScoreMaximums: hrScoreDetails ? hrScoreDetails.maximums : null,
  });
}

function getSupervisorDashboard(request) {
  const employeeId = String(request.employeeId || "").trim();
  const rowNumber = Number(request.rowNumber);
  if (!employeeId || !Number.isInteger(rowNumber) || rowNumber < 2) {
    return jsonResponse({ success: false, message: "Invalid employee" });
  }

  // Only a signed-in account may request its own direct reports. The Next.js
  // server supplies these values from its verified session, never the browser.
  const credentials = getCredentialsSheet();
  if (rowNumber > credentials.getLastRow() ||
      String(credentials.getRange(rowNumber, 1).getDisplayValue()).trim() !== employeeId) {
    return jsonResponse({ success: false, message: "Account not found" });
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HIERARCHY_SHEET);
  if (!sheet) {
    throw new Error("Hierarchy sheet was not found");
  }

  const reports = [];
  if (sheet.getLastRow() >= 2) {
    // A = employee ID, B = direct supervisor (2nd), D:G = identity/work,
    // J = position, Q = legacy evaluation document link.
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 17).getDisplayValues();
    const supervisorId = normalizeEmployeeId(employeeId);
    for (const row of rows) {
      const reportId = String(row[0] || "").trim();
      if (!reportId || normalizeEmployeeId(row[1]) !== supervisorId ||
          normalizeEmployeeId(reportId) === supervisorId) continue;

      reports.push({
        employeeId: reportId,
        firstName: String(row[3] || "").trim(),
        lastName: String(row[4] || "").trim(),
        department: String(row[5] || "").trim(),
        project: String(row[6] || "").trim(),
        position: String(row[9] || "").trim(),
        evaluationUrl: String(row[16] || "").trim(),
      });
    }
  }

  return jsonResponse({ success: true, isSupervisor: reports.length > 0, reports });
}

function buildPrefilledFormUrl(displayRow, rawRow) {
  const formUrl = String(displayRow[8] || "").trim();
  if (!/^https:\/\/docs\.google\.com\/forms\/d\/(?:e\/)?[^/?#]+\/viewform(?:[?#]|$)/.test(formUrl)) {
    return null;
  }

  // UserCredentials: F:H and K:N hold the seven entry IDs for this person's form.
  const entryColumns = [5, 6, 7, 10, 11, 12, 13];
  const entryIds = entryColumns.map((column) => String(rawRow[column] ?? "").trim());
  if (entryIds.some((id) => !/^\d+$/.test(id)) || new Set(entryIds).size !== entryIds.length) {
    return null;
  }

  // Keep the employee ID's leading zeroes. Use O:R exactly as the old system did.
  const scores = rawRow.slice(14, 18).map((value) => String(value ?? "").trim());
  if (scores.some((score) => score === "" || /^#(?:N\/A|REF!|VALUE!|DIV\/0!|ERROR!)/.test(score))) {
    return null;
  }

  const values = [
    String(displayRow[0] || "").trim(),
    String(displayRow[3] || "").trim(),
    String(displayRow[4] || "").trim(),
    ...scores,
  ];
  if (values.some((value) => value === "")) {
    return null;
  }

  const fragmentIndex = formUrl.indexOf("#");
  const baseUrl = fragmentIndex === -1 ? formUrl : formUrl.slice(0, fragmentIndex);
  const fragment = fragmentIndex === -1 ? "" : formUrl.slice(fragmentIndex);
  const separator = /[?&]$/.test(baseUrl) ? "" : baseUrl.includes("?") ? "&" : "?";
  const prefillFields = entryIds.map((id, index) =>
    `entry.${id}=${encodeURIComponent(values[index])}`
  );

  return `${baseUrl}${separator}${prefillFields.join("&")}${fragment}`;
}

function normalizeEmployeeId(value) {
  const id = String(value || "").trim();
  return /^[0-9]+$/.test(id) ? id.padStart(6, "0") : id;
}

function numericScore(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getHrScoreDetails(employeeId) {
  const spreadsheet = SpreadsheetApp.openById(HR_SPREADSHEET_ID);
  const sheet = spreadsheet.getSheets().find((candidate) => {
    const headers = candidate.getRange(1, 1, 1, 39).getDisplayValues()[0];
    return headers[0] === "รหัสพนักงาน" &&
      headers[21] === "คะแนนการปฏิบัติงานที่ผ่านมาในปี" &&
      headers[24] === "การเข้ารับการฝึกอบรมและการพัฒนางาน (คะแนนเต็ม)" &&
      headers[25] === "ลากิจ,ลาป่วย(ไม่มีใบรับรองแพทย์)" &&
      headers[26] === "การปฏิบัติตามระเบียบบริษัท (ได้รับใบเตือน)" &&
      headers[27] === "การให้ความร่วมมือต่อองค์การ (ประชุมประจำเดือน)" &&
      headers[28] === "KPI ฝึกอบรม" &&
      headers[29] === "KPI ลา" &&
      headers[30] === "KPI ใบเตือน" &&
      headers[31] === "KPI ประชุม" &&
      headers[35] === "คะแนนรวม" &&
      headers[36] === "Full score" &&
      headers[38] === "HeathScore";
  });

  if (!sheet || sheet.getLastRow() < 2) {
    return null;
  }

  const rowCount = sheet.getLastRow() - 1;
  const ids = sheet.getRange(2, 1, rowCount, 1).getDisplayValues();
  const pastPerformanceScores = sheet.getRange(2, 22, rowCount, 1).getValues();
  const maximumScores = sheet.getRange(2, 25, rowCount, 4).getValues();
  const components = sheet.getRange(2, 29, rowCount, 4).getValues();
  const totals = sheet.getRange(2, 36, rowCount, 2).getValues();
  const healthScores = sheet.getRange(2, 39, rowCount, 1).getValues();
  const targetId = normalizeEmployeeId(employeeId);
  let matchingDetails = null;
  let matches = 0;

  for (let index = 0; index < rowCount; index += 1) {
    if (normalizeEmployeeId(ids[index][0]) !== targetId) continue;
    matches += 1;
    const total = numericScore(totals[index][0]);
    matchingDetails = {
      total,
      fullScore: numericScore(totals[index][1]),
      pastPerformanceScore: numericScore(pastPerformanceScores[index][0]),
      breakdown: total === null ? null : {
        training: numericScore(components[index][0]),
        leave: numericScore(components[index][1]),
        warning: numericScore(components[index][2]),
        meeting: numericScore(components[index][3]),
        health: numericScore(healthScores[index][0]),
      },
      maximums: {
        training: numericScore(maximumScores[index][0]),
        leave: numericScore(maximumScores[index][1]),
        warning: numericScore(maximumScores[index][2]),
        meeting: numericScore(maximumScores[index][3]),
      },
    };
  }

  return matches === 1 ? matchingDetails : null;
}

function getWorkDetails(employeeId) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HIERARCHY_SHEET);
  if (!sheet || sheet.getLastRow() < 2) {
    return { department: "", project: "" };
  }

  // Hierarchy for evaluate: A = ID, F = หน่วยงาน, G = โครงการ.
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getDisplayValues();
  const matchingRow = rows.find((row) => normalizeEmployeeId(row[0]) === normalizeEmployeeId(employeeId));

  return {
    department: matchingRow ? String(matchingRow[5] || "").trim() : "",
    project: matchingRow ? String(matchingRow[6] || "").trim() : "",
  };
}

function changePassword(request) {
  const rowNumber = Number(request.rowNumber);
  const employeeId = String(request.employeeId || "").trim();
  const newPassword = String(request.password || "");

  if (
    !Number.isInteger(rowNumber) ||
    rowNumber < 2 ||
    newPassword.length < 8 ||
    !/[A-Za-z]/.test(newPassword) ||
    !/[0-9]/.test(newPassword) ||
    /^\d{13}$/.test(newPassword)
  ) {
    return jsonResponse({ success: false, message: "รูปแบบรหัสผ่านใหม่ไม่ถูกต้อง" });
  }

  const sheet = getCredentialsSheet();
  const storedUsername = String(sheet.getRange(rowNumber, 1).getDisplayValue()).trim();

  if (storedUsername !== employeeId) {
    return jsonResponse({ success: false, message: "ไม่พบข้อมูลพนักงาน" });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    // Write only column B and keep the value as plain text.
    const passwordCell = sheet.getRange(rowNumber, 2);
    passwordCell.setNumberFormat("@").setValue(newPassword);
    SpreadsheetApp.flush();

    if (passwordCell.getDisplayValue() !== newPassword) {
      return jsonResponse({ success: false, message: "ไม่สามารถยืนยันการบันทึกรหัสผ่านในชีตได้" });
    }
  } finally {
    lock.releaseLock();
  }

  return jsonResponse({ success: true, verified: true });
}

function getCredentialsSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(CREDENTIALS_SHEET);

  if (!sheet) {
    throw new Error("UserCredentials sheet was not found");
  }

  return sheet;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
