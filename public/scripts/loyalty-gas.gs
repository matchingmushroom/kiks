/**
 * Loyalty Module - Google Apps Script Web App
 * Deploy as: Web App -> Execute as: Me -> Who has access: Anyone
 * 
 * Sheets required (auto-created on first request):
 *   Sheet 1: Loyalty_Register  - phone | name | address | email | registeredAt | currentPoints | lifetimePoints
 *   Sheet 2: Loyalty_Transactions - txnId | phone | type | points | referenceId | refType | note | createdAt
 */

var REG_SHEET = "Loyalty_Register";
var TXN_SHEET = "Loyalty_Transactions";

function getOrCreateSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doGet(e) {
  var params = e.parameter;
  var action = params.action || "";
  
  try {
    if (action === "balance") return jsonResponse(getBalance(params.phone || ""));
    if (action === "history") return jsonResponse(getHistory(params.phone || ""));
    if (action === "lookup") return jsonResponse(lookupCustomer(params.phone || ""));
    if (action === "ping") return jsonResponse({ ok: true, message: "Loyalty GAS is alive" });
    return jsonResponse({ ok: false, error: "Unknown action. Use: balance, history, lookup, ping" }, 400);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action || "";
    
    if (action === "register") return jsonResponse(registerCustomer(body));
    if (action === "transaction") return jsonResponse(addTransaction(body));
    if (action === "sync") return jsonResponse(syncToFirestore(body));
    if (action === "migrate") return jsonResponse(migrateFromFirestore(body));
    return jsonResponse({ ok: false, error: "Unknown action. Use: register, transaction, sync, migrate" }, 400);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

function jsonResponse(data, status) {
  if (!status) status = 200;
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ----------- REGISTER ----------- */

function registerCustomer(body) {
  var phone = body.phone;
  var name = body.name;
  var address = body.address || "";
  var email = body.email || "";
  
  if (!phone || !name) throw new Error("phone and name are required");
  
  var sheet = getOrCreateSheet(REG_SHEET, ["phone", "name", "address", "email", "registeredAt", "currentPoints", "lifetimePoints"]);
  var data = sheet.getDataRange().getValues();
  
  // Check if phone already registered
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === phone) {
      throw new Error("Phone number already registered");
    }
  }
  
  var now = new Date().toISOString();
  sheet.appendRow([phone, name, address, email, now, 0, 0]);
  
  return { ok: true, message: "Registered successfully", data: { phone: phone, name: name, currentPoints: 0 } };
}

/* ----------- TRANSACTION ----------- */

function addTransaction(body) {
  var phone = body.phone;
  var type = body.type;
  var points = body.points;
  var referenceId = body.referenceId || "";
  var refType = body.refType || "";
  var note = body.note || "";
  
  if (!phone || !type || points === undefined || points === null) throw new Error("phone, type, and points are required");
  if (["earn", "redeem", "refund", "adjust"].indexOf(type) === -1) throw new Error("Invalid type");
  
  // Write transaction
  var txnSheet = getOrCreateSheet(TXN_SHEET, ["txnId", "phone", "type", "points", "referenceId", "refType", "note", "createdAt"]);
  var txnId = "LTX-" + String(Date.now()).slice(-8) + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  txnSheet.appendRow([txnId, phone, type, points, referenceId, refType, note, new Date().toISOString()]);
  
  // Update balance in register
  var regSheet = getOrCreateSheet(REG_SHEET, ["phone", "name", "address", "email", "registeredAt", "currentPoints", "lifetimePoints"]);
  var regData = regSheet.getDataRange().getValues();
  
  for (var i = 1; i < regData.length; i++) {
    if (String(regData[i][0]) === phone) {
      var currentPoints = Number(regData[i][5]) || 0;
      var lifetimePoints = Number(regData[i][6]) || 0;
      
      if (type === "earn") {
        regSheet.getRange(i + 1, 6).setValue(currentPoints + Math.abs(points));
        regSheet.getRange(i + 1, 7).setValue(lifetimePoints + Math.abs(points));
      } else if (type === "redeem") {
        regSheet.getRange(i + 1, 6).setValue(Math.max(0, currentPoints - Math.abs(points)));
      } else if (type === "refund") {
        var pointsNum = Number(points);
        regSheet.getRange(i + 1, 6).setValue(Math.max(0, currentPoints + pointsNum));
        if (pointsNum > 0) {
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
        data: { txnId: txnId, phone: phone, type: type, points: points, currentPoints: regSheet.getRange(i + 1, 6).getValue() }
      };
    }
  }
  
  throw new Error("Phone not registered. Register first.");
}

/* ----------- BALANCE ----------- */

function getBalance(phone) {
  if (!phone) throw new Error("phone parameter required");
  var sheet = getOrCreateSheet(REG_SHEET, ["phone", "name", "address", "email", "registeredAt", "currentPoints", "lifetimePoints"]);
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
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

/* ----------- HISTORY ----------- */

function getHistory(phone) {
  if (!phone) throw new Error("phone parameter required");
  var sheet = getOrCreateSheet(TXN_SHEET, ["txnId", "phone", "type", "points", "referenceId", "refType", "note", "createdAt"]);
  var data = sheet.getDataRange().getValues();
  var txns = [];
  
  for (var i = 1; i < data.length; i++) {
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
  
  txns.sort(function(a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  
  return { ok: true, data: txns };
}

/* ----------- LOOKUP ----------- */

function lookupCustomer(phone) {
  if (!phone) throw new Error("phone parameter required");
  var sheet = getOrCreateSheet(REG_SHEET, ["phone", "name", "address", "email", "registeredAt", "currentPoints", "lifetimePoints"]);
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
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

/* ----------- SYNC -> FIRESTORE ----------- */

function syncToFirestore(body) {
  var firebaseProjectId = body.firebaseProjectId;
  var firebaseApiKey = body.firebaseApiKey;
  if (!firebaseApiKey) throw new Error("firebaseApiKey required");
  
  var sheet = getOrCreateSheet(REG_SHEET, ["phone", "name", "address", "email", "registeredAt", "currentPoints", "lifetimePoints"]);
  var data = sheet.getDataRange().getValues();
  var results = [];
  
  for (var i = 1; i < data.length; i++) {
    var phone = String(data[i][0]);
    var name = String(data[i][1]);
    var currentPoints = Number(data[i][5]) || 0;
    var lifetimePoints = Number(data[i][6]) || 0;
    
    try {
      var queryPayload = {
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
      
      var queryUrl = "https://firestore.googleapis.com/v1/projects/" + firebaseProjectId + "/databases/(default)/documents:runQuery";
      var queryRes = UrlFetchApp.fetch(queryUrl, {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + firebaseApiKey },
        payload: JSON.stringify(queryPayload),
        muteHttpExceptions: true
      });
      
      var queryData = JSON.parse(queryRes.getContentText());
      var hasDoc = queryData && queryData[0] && queryData[0].document;
      
      if (hasDoc) {
        var docPath = queryData[0].document.name;
        var updateUrl = docPath + "?updateMask.fieldPaths=loyaltyPoints&updateMask.fieldPaths=lifetimePoints&updateMask.fieldPaths=updatedAt";
        UrlFetchApp.fetch(updateUrl, {
          method: "patch",
          contentType: "application/json",
          headers: { Authorization: "Bearer " + firebaseApiKey },
          payload: JSON.stringify({
            fields: {
              loyaltyPoints: { integerValue: currentPoints },
              lifetimePoints: { integerValue: lifetimePoints },
              updatedAt: { timestampValue: new Date().toISOString() }
            }
          }),
          muteHttpExceptions: true
        });
        results.push({ phone: phone, status: "updated", currentPoints: currentPoints });
      } else {
        results.push({ phone: phone, status: "skipped", reason: "Not found in Firestore" });
      }
    } catch (err) {
      results.push({ phone: phone, status: "error", error: err.message });
    }
  }
  
  return { ok: true, data: results };
}

/* ----------- MIGRATE -> SHEETS ----------- */

function migrateFromFirestore(body) {
  var customers = body.customers;
  if (!customers || !Array.isArray(customers)) throw new Error("customers array required");
  
  var sheet = getOrCreateSheet(REG_SHEET, ["phone", "name", "address", "email", "registeredAt", "currentPoints", "lifetimePoints"]);
  var added = 0;
  
  for (var j = 0; j < customers.length; j++) {
    var c = customers[j];
    if (!c.phone) continue;
    var existingData = sheet.getDataRange().getValues();
    var exists = false;
    for (var k = 1; k < existingData.length; k++) {
      if (String(existingData[k][0]) === c.phone) { exists = true; break; }
    }
    if (!exists) {
      sheet.appendRow([c.phone, c.name || "", c.address || "", c.email || "", new Date().toISOString(), c.loyaltyPoints || 0, c.lifetimePoints || 0]);
      added++;
    }
  }
  
  return { ok: true, message: "Migrated " + added + " customers" };
}
