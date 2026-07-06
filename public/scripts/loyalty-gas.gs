/**
 * Loyalty Module — Google Apps Script Web App
 * Deploy as: Web App → Execute as: Me → Who has access: Anyone
 * 
 * Sheets required (auto-created on first request):
 *   Sheet 1: Loyalty_Register  — phone | name | address | email | registeredAt | currentPoints | lifetimePoints
 *   Sheet 2: Loyalty_Transactions — txnId | phone | type | points | referenceId | refType | note | createdAt
 */

const REG_SHEET = "Loyalty_Register";
const TXN_SHEET = "Loyalty_Transactions";

function getOrCreateSheet(name: string, headers: string[]): GoogleAppsScript.Spreadsheet.Sheet {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doGet(e: GoogleAppsScript.Events.DoGet) {
  const params = e.parameter;
  const action = params.action || "";
  
  try {
    if (action === "balance") return jsonResponse(getBalance(params.phone || ""));
    if (action === "history") return jsonResponse(getHistory(params.phone || ""));
    if (action === "lookup") return jsonResponse(lookupCustomer(params.phone || ""));
    if (action === "ping") return jsonResponse({ ok: true, message: "Loyalty GAS is alive" });
    return jsonResponse({ ok: false, error: "Unknown action. Use: balance, history, lookup, ping" }, 400);
  } catch (err: any) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

function doPost(e: GoogleAppsScript.Events.DoPost) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || "";
    
    if (action === "register") return jsonResponse(registerCustomer(body));
    if (action === "transaction") return jsonResponse(addTransaction(body));
    if (action === "sync") return jsonResponse(syncToFirestore(body));
    if (action === "migrate") return jsonResponse(migrateFromFirestore(body));
    return jsonResponse({ ok: false, error: "Unknown action. Use: register, transaction, sync, migrate" }, 400);
  } catch (err: any) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

function jsonResponse(data: any, status = 200) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ─────────── REGISTER ─────────── */

function registerCustomer(body: any) {
  const { phone, name, address, email } = body;
  if (!phone || !name) throw new Error("phone and name are required");
  
  const sheet = getOrCreateSheet(REG_SHEET, ["phone", "name", "address", "email", "registeredAt", "currentPoints", "lifetimePoints"]);
  const data = sheet.getDataRange().getValues();
  
  // Check if phone already registered
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === phone) {
      throw new Error("Phone number already registered");
    }
  }
  
  const now = new Date().toISOString();
  sheet.appendRow([phone, name, address || "", email || "", now, 0, 0]);
  
  return { ok: true, message: "Registered successfully", data: { phone, name, currentPoints: 0 } };
}

/* ─────────── TRANSACTION ─────────── */

function addTransaction(body: any) {
  const { phone, type, points, referenceId, refType, note } = body;
  if (!phone || !type || points === undefined || points === null) throw new Error("phone, type, and points are required");
  if (!["earn", "redeem", "refund", "adjust"].includes(type)) throw new Error("Invalid type");
  
  // Write transaction
  const txnSheet = getOrCreateSheet(TXN_SHEET, ["txnId", "phone", "type", "points", "referenceId", "refType", "note", "createdAt"]);
  const txnId = "LTX-" + String(Date.now()).slice(-8) + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  txnSheet.appendRow([txnId, phone, type, points, referenceId || "", refType || "", note || "", new Date().toISOString()]);
  
  // Update balance in register
  const regSheet = getOrCreateSheet(REG_SHEET, ["phone", "name", "address", "email", "registeredAt", "currentPoints", "lifetimePoints"]);
  const regData = regSheet.getDataRange().getValues();
  
  for (let i = 1; i < regData.length; i++) {
    if (String(regData[i][0]) === phone) {
      const currentPoints = Number(regData[i][5]) || 0;
      const lifetimePoints = Number(regData[i][6]) || 0;
      
      if (type === "earn") {
        regSheet.getRange(i + 1, 6).setValue(currentPoints + Math.abs(points));
        regSheet.getRange(i + 1, 7).setValue(lifetimePoints + Math.abs(points));
      } else if (type === "redeem") {
        regSheet.getRange(i + 1, 6).setValue(Math.max(0, currentPoints - Math.abs(points)));
      } else if (type === "refund") {
        const pointsNum = Number(points);
        regSheet.getRange(i + 1, 6).setValue(Math.max(0, currentPoints + pointsNum));
        if (pointsNum > 0 && type === "refund") {
          // Refund that restores earned points — also restore lifetimePoints
          regSheet.getRange(i + 1, 7).setValue(Math.max(0, lifetimePoints - pointsNum));
        }
      } else if (type === "adjust") {
        regSheet.getRange(i + 1, 6).setValue(Math.max(0, currentPoints + Number(points)));
        if (Number(points) > 0) {
          regSheet.getRange(i + 1, 7).setValue(lifetimePoints + Number(points));
        }
      }
      
      return {
        ok: true,
        message: "Transaction recorded",
        data: { txnId, phone, type, points, currentPoints: regSheet.getRange(i + 1, 6).getValue() }
      };
    }
  }
  
  throw new Error("Phone not registered. Register first.");
}

/* ─────────── BALANCE ─────────── */

function getBalance(phone: string) {
  if (!phone) throw new Error("phone parameter required");
  const sheet = getOrCreateSheet(REG_SHEET, ["phone", "name", "address", "email", "registeredAt", "currentPoints", "lifetimePoints"]);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === phone) {
      return {
        ok: true,
        data: {
          phone: data[i][0],
          name: data[i][1],
          currentPoints: Number(data[i][5]) || 0,
          lifetimePoints: Number(data[i][6]) || 0,
        }
      };
    }
  }
  return { ok: false, error: "Phone not registered" };
}

/* ─────────── HISTORY ─────────── */

function getHistory(phone: string) {
  if (!phone) throw new Error("phone parameter required");
  const sheet = getOrCreateSheet(TXN_SHEET, ["txnId", "phone", "type", "points", "referenceId", "refType", "note", "createdAt"]);
  const data = sheet.getDataRange().getValues();
  const txns: any[] = [];
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === phone) {
      txns.push({
        txnId: data[i][0],
        phone: data[i][1],
        type: data[i][2],
        points: Number(data[i][3]) || 0,
        referenceId: data[i][4],
        refType: data[i][5],
        note: data[i][6],
        createdAt: data[i][7],
      });
    }
  }
  
  txns.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  
  return { ok: true, data: txns };
}

/* ─────────── LOOKUP ─────────── */

function lookupCustomer(phone: string) {
  if (!phone) throw new Error("phone parameter required");
  const sheet = getOrCreateSheet(REG_SHEET, ["phone", "name", "address", "email", "registeredAt", "currentPoints", "lifetimePoints"]);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === phone) {
      return {
        ok: true,
        data: {
          phone: data[i][0],
          name: data[i][1],
          address: data[i][2],
          email: data[i][3],
          registeredAt: data[i][4],
          currentPoints: Number(data[i][5]) || 0,
          lifetimePoints: Number(data[i][6]) || 0,
        }
      };
    }
  }
  return { ok: false, error: "Phone not registered" };
}

/* ─────────── SYNC → FIRESTORE ─────────── */

function syncToFirestore(body: any) {
  const { firebaseProjectId, firebaseApiKey } = body;
  if (!firebaseApiKey) throw new Error("firebaseApiKey required");
  
  const sheet = getOrCreateSheet(REG_SHEET, ["phone", "name", "address", "email", "registeredAt", "currentPoints", "lifetimePoints"]);
  const data = sheet.getDataRange().getValues();
  const results: any[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const phone = String(data[i][0]);
    const name = String(data[i][1]);
    const currentPoints = Number(data[i][5]) || 0;
    const lifetimePoints = Number(data[i][6]) || 0;
    
    try {
      // Query Firestore for customer by phone
      const queryUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents:runQuery`;
      const queryPayload = {
        structuredQuery: {
          from: [{ collectionId: "customers" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "phone" },
              op: "EQUAL",
              value: { stringValue: phone }
            }
          },
          limit: 1
        }
      };
      
      const queryRes = UrlFetchApp.fetch(queryUrl, {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: `Bearer ${firebaseApiKey}` },
        payload: JSON.stringify(queryPayload),
        muteHttpExceptions: true
      });
      
      const queryData = JSON.parse(queryRes.getContentText());
      const hasDoc = queryData && queryData[0] && queryData[0].document;
      
      if (hasDoc) {
        const docPath = queryData[0].document.name;
        const updateUrl = `${docPath}?updateMask.fieldPaths=loyaltyPoints&updateMask.fieldPaths=lifetimePoints&updateMask.fieldPaths=updatedAt`;
        UrlFetchApp.fetch(updateUrl, {
          method: "patch",
          contentType: "application/json",
          headers: { Authorization: `Bearer ${firebaseApiKey}` },
          payload: JSON.stringify({
            fields: {
              loyaltyPoints: { integerValue: currentPoints },
              lifetimePoints: { integerValue: lifetimePoints },
              updatedAt: { timestampValue: new Date().toISOString() }
            }
          }),
          muteHttpExceptions: true
        });
        results.push({ phone, status: "updated", currentPoints });
      } else {
        results.push({ phone, status: "skipped", reason: "Not found in Firestore" });
      }
    } catch (err: any) {
      results.push({ phone, status: "error", error: err.message });
    }
  }
  
  return { ok: true, data: results };
}

/* ─────────── MIGRATE → SHEETS ─────────── */

function migrateFromFirestore(body: any) {
  const { customers } = body;
  if (!customers || !Array.isArray(customers)) throw new Error("customers array required");
  
  const sheet = getOrCreateSheet(REG_SHEET, ["phone", "name", "address", "email", "registeredAt", "currentPoints", "lifetimePoints"]);
  let added = 0;
  
  for (const c of customers) {
    if (!c.phone) continue;
    // Check duplicate
    const data = sheet.getDataRange().getValues();
    let exists = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === c.phone) { exists = true; break; }
    }
    if (!exists) {
      sheet.appendRow([c.phone, c.name || "", c.address || "", c.email || "", new Date().toISOString(), c.loyaltyPoints || 0, c.lifetimePoints || 0]);
      added++;
    }
  }
  
  return { ok: true, message: `Migrated ${added} customers` };
}
