/**
 * AS-Collection Email Backup — Google Apps Script
 * 
 * DEPLOYMENT:
 * 1. Open https://script.google.com/ and create a new project
 * 2. Paste this entire file
 * 3. Set FIREBASE_CONFIG below with your project details
 * 4. Save and deploy → Web App → Execute as "Me", Access "Anyone"
 * 5. Copy the web app URL → paste in AS-Collection Settings as "GAS Webhook URL"
 * 6. To enable scheduled backups, go to Triggers → Add Trigger:
 *    - Function: doBackup
 *    - Time-driven: Day timer (e.g., 8 AM)
 */

// ── CONFIGURE THESE ───────────────────────────────────

var FIREBASE_CONFIG = {
  projectId: "your-firebase-project-id",
  apiKey: "AIzaSyYourApiKey",
};

// ── DO NOT EDIT BELOW ─────────────────────────────────

var CONFIG_DOC = "shop_settings/emailBackupConfig";

/**
 * Handles manual "Send Now" requests from AS-Collection.
 * POST with JSON body: { action, module, csv, filename, period, emailTo, driveFolderId }
 */
function doPost(e) {
  try {
    var raw = e.postData && e.postData.contents ? e.postData.contents : (e.parameter && e.parameter.payload ? e.parameter.payload : null);
    var data = JSON.parse(raw);

    if (data.action === "uploadImage" && data.imageBase64 && data.filename) {
      var decoded = Utilities.base64Decode(data.imageBase64);
      var blob = Utilities.newBlob(decoded, data.mimeType || "image/jpeg", data.filename);
      var folder = data.driveFolderId
        ? DriveApp.getFolderById(data.driveFolderId)
        : DriveApp.getRootFolder();
      var file = folder.createFile(blob);
      var result = JSON.stringify({ status: "ok", fileId: file.getId(), name: file.getName() });
      return HtmlService.createHtmlOutput(
        '<html><body><script>parent.postMessage(' + result + ', "*");</script></body></html>'
      );
    }

    if (data.action === "sendReport" && data.csv && data.module) {
      var blob = Utilities.newBlob(data.csv, "text/csv", data.filename || (data.module + ".csv"));

      if (data.emailTo) {
        MailApp.sendEmail({
          to: data.emailTo,
          subject: "AS-Collection Report: " + data.module + " — " + (data.period || ""),
          body: "Please find the attached " + data.module + " report (" + (data.period || "selected period") + ").\n\nThis is an automated email from AS-Collection.",
          attachments: [blob],
        });
      }

      if (data.driveFolderId) {
        var folder = DriveApp.getFolderById(data.driveFolderId);
        folder.createFile(blob.setName(data.filename || (data.module + ".csv")));
      }

      return ContentService
        .createTextOutput(JSON.stringify({ status: "ok", message: "Report sent and saved." }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: "Invalid payload" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", message: "GAS webhook is running." }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Scheduled backup — called by time-driven trigger.
 * Fetches all enabled modules from Firestore REST API, emails CSV attachments, saves to Drive.
 */
function doBackup() {
  var config = firestoreGet(CONFIG_DOC);
  if (!config || !config.emailTo) {
    console.log("No emailBackupConfig found or no emailTo set");
    return;
  }

  var emailTo = config.emailTo;
  var driveFolderId = config.driveFolderId;
  var enabledModules = config.enabledModules || [];
  var attachments = [];
  var period = new Date().toISOString().slice(0, 10);

  var moduleMap = {
    sales: { collection: "sales", fields: "saleDate", label: "Sales" },
    purchases: { collection: "purchases", fields: "purchaseDate", label: "Purchases" },
    orders: { collection: "orders", fields: "createdAt", label: "Orders" },
    inventory: { collection: "products", fields: "name", label: "Inventory" },
    debtors: { collection: "debtors", fields: "createdAt", label: "Debtors" },
    creditors: { collection: "creditors", fields: "lastTransactionDate", label: "Creditors" },
    expenses: { collection: "expenses", fields: "date", label: "Expenses" },
  };

  for (var i = 0; i < enabledModules.length; i++) {
    var moduleKey = enabledModules[i];
    var info = moduleMap[moduleKey];
    if (!info) continue;

    try {
      var docs = firestoreList(info.collection);
      var csv = docsToCSV(docs);
      if (csv) {
        var filename = moduleKey + "-" + period + ".csv";
        var blob = Utilities.newBlob(csv, "text/csv", filename);
        attachments.push(blob);

        if (driveFolderId) {
          var folder = DriveApp.getFolderById(driveFolderId);
          folder.createFile(blob);
        }
      }
    } catch (err) {
      console.log("Error exporting " + moduleKey + ": " + err);
    }
  }

  if (attachments.length > 0) {
    MailApp.sendEmail({
      to: emailTo,
      subject: "AS-Collection Daily Backup — " + period,
      body: "Please find attached the scheduled backup reports for " + period + ".\n\nModules: " + enabledModules.join(", "),
      attachments: attachments,
    });
  }
}

// ── FIRESTORE REST HELPERS ────────────────────────────

function firestoreGet(path) {
  var url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_CONFIG.projectId + "/databases/(default)/documents/" + path + "?key=" + FIREBASE_CONFIG.apiKey;
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) return null;
  var data = JSON.parse(resp.getContentText());
  return fieldsToObj(data.fields);
}

function firestoreList(collection) {
  var url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_CONFIG.projectId + "/databases/(default)/documents/" + collection + "?key=" + FIREBASE_CONFIG.apiKey;
  var allDocs = [];
  var pageToken = "";

  while (true) {
    var queryUrl = url + (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
    var resp = UrlFetchApp.fetch(queryUrl, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) break;
    var data = JSON.parse(resp.getContentText());
    var documents = data.documents || [];

    for (var i = 0; i < documents.length; i++) {
      var doc = documents[i];
      var id = doc.name.split("/").pop();
      allDocs.push({ id: id, fields: doc.fields });
    }

    if (data.nextPageToken) {
      pageToken = data.nextPageToken;
    } else {
      break;
    }
  }

  return allDocs;
}

function fieldsToObj(fields) {
  if (!fields) return {};
  var obj = {};
  for (var key in fields) {
    if (fields.hasOwnProperty(key)) {
      obj[key] = getFieldValue(fields[key]);
    }
  }
  return obj;
}

function getFieldValue(field) {
  if (!field) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.integerValue !== undefined) return Number(field.integerValue);
  if (field.doubleValue !== undefined) return Number(field.doubleValue);
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.timestampValue) return field.timestampValue;
  if (field.arrayValue) {
    var arr = field.arrayValue.values || [];
    return arr.map(getFieldValue);
  }
  if (field.mapValue) {
    return fieldsToObj(field.mapValue.fields);
  }
  return null;
}

// ── CSV HELPERS ───────────────────────────────────────

function docsToCSV(docs) {
  if (!docs || docs.length === 0) return "";

  var headers = ["id"];
  var firstFields = docs[0].fields || {};
  for (var key in firstFields) {
    if (firstFields.hasOwnProperty(key) && key !== "id") {
      headers.push(key);
    }
  }

  var lines = [headers.join(",")];
  for (var i = 0; i < docs.length; i++) {
    var obj = fieldsToObj(docs[i].fields);
    obj.id = docs[i].id;
    var row = headers.map(function (h) {
      return csvEscape(obj[h]);
    });
    lines.push(row.join(","));
  }

  return lines.join("\n");
}

function csvEscape(val) {
  if (val === null || val === undefined) return "";
  var s = String(val);
  if (s.indexOf(",") !== -1 || s.indexOf('"') !== -1 || s.indexOf("\n") !== -1) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
