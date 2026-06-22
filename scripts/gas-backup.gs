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
  projectId: "kiks-collections",
  apiKey: "AIzaSyBWYuU_UpuHhgvbG9KjaSIvQxazWpeIXZE",
};

// ── REQUIRED SCOPES (set in appsscript.json) ──────────
// oauthScopes:
//   - https://www.googleapis.com/auth/datastore
//   - https://www.googleapis.com/auth/drive
//   - https://www.googleapis.com/auth/spreadsheets
//   - https://www.googleapis.com/auth/script.external_request
//   - https://www.googleapis.com/auth/script.send_mail

// ── DO NOT EDIT BELOW ─────────────────────────────────

var CONFIG_DOC = "shop_settings/emailBackupConfig";

/**
 * Handles manual "Send Now" requests from AS-Collection.
 * POST with JSON body: { action, module, csv, filename, period, emailTo, driveFolderId }
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === "uploadImage" && data.imageBase64 && data.filename) {
      var decoded = Utilities.base64Decode(data.imageBase64);
      var blob = Utilities.newBlob(decoded, data.mimeType || "image/jpeg", data.filename);
      var folder = data.driveFolderId
        ? DriveApp.getFolderById(data.driveFolderId)
        : DriveApp.getRootFolder();
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      if (data.uploadId && data.uploadId.length > 0 && data.authToken) {
        try {
          firestoreWrite("pendingUploads/" + data.uploadId, {
            status: "done",
            fileId: file.getId(),
            name: file.getName(),
          }, data.authToken);
        } catch (e) {
          console.log("firestoreWrite error: " + e);
        }
      }

      return ContentService
        .createTextOutput(JSON.stringify({ status: "ok", fileId: file.getId() }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "computePnl" && data.start && data.end) {
      var start = new Date(data.start);
      var end = new Date(data.end);
      end.setDate(end.getDate() + 1);

      var sales = firestoreQuery("sales", [
        ["saleDate", ">=", start],
        ["saleDate", "<", end]
      ]);
      var expenses = firestoreQuery("expenses", [
        ["date", ">=", start],
        ["date", "<", end]
      ]);
      var products = firestoreList("products");

      // Also get archived data from Sheet
      try {
        var cfg = firestoreGet(CONFIG_DOC);
        var sid = cfg && cfg[ARCHIVE_CONFIG_KEY] ? cfg[ARCHIVE_CONFIG_KEY] : null;
        if (sid) {
          var ss = SpreadsheetApp.openById(sid);
          var sSheet = ss.getSheetByName("Sales");
          var eSheet = ss.getSheetByName("Expenses");
          if (sSheet) {
            var archivedSales = sheetQueryRange(sSheet, start.getTime(), end.getTime());
            for (var as = 0; as < archivedSales.length; as++) {
              sales.push(archivedSales[as]);
            }
          }
          if (eSheet) {
            var archivedExpenses = sheetQueryRange(eSheet, start.getTime(), end.getTime());
            for (var ae = 0; ae < archivedExpenses.length; ae++) {
              expenses.push(archivedExpenses[ae]);
            }
          }
        }
      } catch (e) { console.log("Sheet merge error: " + e); }

      var productMap = {};
      for (var p = 0; p < products.length; p++) {
        productMap[products[p].id] = products[p];
      }

      var grossRevenue = 0, cogs = 0;
      var expenseByHead = {};

      for (var s = 0; s < sales.length; s++) {
        grossRevenue += Number(sales[s].finalAmount || 0);
        var items = sales[s].items || [];
        for (var i = 0; i < items.length; i++) {
          var cp = items[i].costPriceAtSale || (productMap[items[i].productId] ? productMap[items[i].productId].costPrice : 0);
          cogs += Number(cp || 0) * Number(items[i].quantity || 1);
        }
      }

      for (var e = 0; e < expenses.length; e++) {
        var head = expenses[e].head || "Other";
        expenseByHead[head] = (expenseByHead[head] || 0) + Number(expenses[e].amount || 0);
      }

      var totalExpenses = 0;
      for (var h in expenseByHead) {
        if (expenseByHead.hasOwnProperty(h)) totalExpenses += expenseByHead[h];
      }

      return ContentService
        .createTextOutput(JSON.stringify({
          grossRevenue: grossRevenue,
          cogs: cogs,
          grossProfit: grossRevenue - cogs,
          totalExpenses: totalExpenses,
          expenseByHead: expenseByHead,
          netProfit: grossRevenue - cogs - totalExpenses,
          saleCount: sales.length,
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "computeBalanceSheet" && data.asOf) {
      var asOf = new Date(data.asOf);
      asOf.setDate(asOf.getDate() + 1);

      var allProducts = firestoreList("products");
      var allSales = firestoreQuery("sales", [["saleDate", "<", asOf]]);
      var allExpenses = firestoreQuery("expenses", [["date", "<", asOf]]);
      var allDebtors = firestoreList("debtors");
      var allPurchases = firestoreQuery("purchases", [["purchaseDate", "<", asOf]]);
      var allCreditors = firestoreList("creditors");
      var allAccounts = firestoreList("accounts");
      var allTxns = firestoreQuery("accountTransactions", [["date", "<", asOf]]);

      // Also get archived data from Sheet
      try {
        var cfg = firestoreGet(CONFIG_DOC);
        var sid = cfg && cfg[ARCHIVE_CONFIG_KEY] ? cfg[ARCHIVE_CONFIG_KEY] : null;
        if (sid) {
          var ss = SpreadsheetApp.openById(sid);
          var startEpoch = new Date(0).getTime();
          var endTs = asOf.getTime();
          var sSheet = ss.getSheetByName("Sales");
          var eSheet = ss.getSheetByName("Expenses");
          var pSheet = ss.getSheetByName("Purchases");
          if (sSheet) {
            var archivedSales = sheetQueryRange(sSheet, startEpoch, endTs);
            for (var as2 = 0; as2 < archivedSales.length; as2++) {
              allSales.push(archivedSales[as2]);
            }
          }
          if (eSheet) {
            var archivedExpenses = sheetQueryRange(eSheet, startEpoch, endTs);
            for (var ae2 = 0; ae2 < archivedExpenses.length; ae2++) {
              allExpenses.push(archivedExpenses[ae2]);
            }
          }
          if (pSheet) {
            var archivedPurchases = sheetQueryRange(pSheet, startEpoch, endTs);
            for (var ap = 0; ap < archivedPurchases.length; ap++) {
              allPurchases.push(archivedPurchases[ap]);
            }
          }
        }
      } catch (e) { console.log("BS Sheet merge error: " + e); }

      var costMap = {};
      for (var p = 0; p < allProducts.length; p++) {
        costMap[allProducts[p].id] = allProducts[p].costPrice || 0;
      }

      var closingStock = 0;
      for (var p = 0; p < allProducts.length; p++) {
        closingStock += Number(allProducts[p].quantityInStock || 0) * Number(allProducts[p].costPrice || 0);
      }

      var sundryDebtors = 0;
      for (var d = 0; d < allDebtors.length; d++) {
        if (allDebtors[d].status === "active") sundryDebtors += Number(allDebtors[d].balanceDue || 0);
      }

      var accountBalances = {};
      for (var a = 0; a < allAccounts.length; a++) {
        var acc = allAccounts[a];
        var credits = 0, debits = 0;
        for (var t = 0; t < allTxns.length; t++) {
          if (allTxns[t].accountId === acc.id) {
            if (allTxns[t].type === "credit") credits += Number(allTxns[t].amount || 0);
            else if (allTxns[t].type === "debit") debits += Number(allTxns[t].amount || 0);
          }
        }
        accountBalances[acc.id] = (acc.openingBalance || 0) + credits - debits;
      }

      var cashBalance = accountBalances["cash_in_hand"] || 0;
      var bankBalance = accountBalances["bank_account"] || 0;

      var crBalance = 0;
      for (var c = 0; c < allCreditors.length; c++) {
        crBalance += Number(allCreditors[c].balanceDue || 0);
      }
      var unpaidPurchases = 0;
      for (var pu = 0; pu < allPurchases.length; pu++) {
        if (allPurchases[pu].paymentStatus === "unpaid" || allPurchases[pu].paymentStatus === "partially_paid") {
          unpaidPurchases += Number(allPurchases[pu].totalAmount || 0) - Number(allPurchases[pu].paidAmount || 0);
        }
      }
      var sundryCreditors = crBalance > 0 ? crBalance : unpaidPurchases;

      var retainedEarnings = 0;
      for (var s = 0; s < allSales.length; s++) {
        retainedEarnings += Number(allSales[s].finalAmount || 0);
        var items = allSales[s].items || [];
        for (var i = 0; i < items.length; i++) {
          var cp = items[i].costPriceAtSale || costMap[items[i].productId] || 0;
          retainedEarnings -= Number(cp) * Number(items[i].quantity || 1);
        }
      }
      for (var e = 0; e < allExpenses.length; e++) {
        retainedEarnings -= Number(allExpenses[e].amount || 0);
      }

      var config = firestoreGet("shop_settings/config");
      var openingCapital = (config && config.openingCapital) ? Number(config.openingCapital) : 0;

      var totalAssets = cashBalance + bankBalance + closingStock + sundryDebtors;
      var totalLiabilities = sundryCreditors;
      var totalEquity = openingCapital + retainedEarnings;

      return ContentService
        .createTextOutput(JSON.stringify({
          cashBalance: cashBalance,
          bankBalance: bankBalance,
          closingStock: closingStock,
          productCount: allProducts.length,
          sundryDebtors: sundryDebtors,
          sundryCreditors: sundryCreditors,
          openingCapital: openingCapital,
          retainedEarnings: retainedEarnings,
          totalAssets: totalAssets,
          totalLiabilities: totalLiabilities,
          totalEquity: totalEquity,
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "archiveToSheet" && data.driveFolderId) {
      var archiveStart = data.archiveStart ? new Date(data.archiveStart) : null;
      var archiveEnd = data.archiveEnd ? new Date(data.archiveEnd) : null;
      if (!archiveStart || !archiveEnd) {
        var cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 1);
        archiveStart = null;
        archiveEnd = cutoff;
      }
      var archiveInfo = getArchiveSheet(data.driveFolderId);
      var tabs = archiveInfo.tabs;
      var collections = [
        { name: "sales", tab: tabs["Sales"], dateField: "saleDate", label: "Sales" },
        { name: "purchases", tab: tabs["Purchases"], dateField: "purchaseDate", label: "Purchases" },
        { name: "expenses", tab: tabs["Expenses"], dateField: "date", label: "Expenses" },
        { name: "invoices", tab: tabs["Invoices"], dateField: "createdAt", label: "Invoices" },
      ];
      var totals = {};
      for (var c = 0; c < collections.length; c++) {
        var col = collections[c];
        var whereClauses = archiveStart
          ? [[col.dateField, ">=", archiveStart], [col.dateField, "<", archiveEnd]]
          : [[col.dateField, "<", archiveEnd]];
        var docs = firestoreQuery(col.name, whereClauses);
        var archivedCount = 0;
        for (var d = 0; d < docs.length; d++) {
          docs[d].dateField = docs[d][col.dateField] instanceof Date
            ? docs[d][col.dateField].getTime()
            : Number(docs[d][col.dateField] || 0);
          sheetAppendRow(col.tab, docs[d]);
          firestoreDelete(col.name + "/" + docs[d].id);
          archivedCount++;
        }
        totals[col.label] = archivedCount;
      }
      return ContentService
        .createTextOutput(JSON.stringify({ status: "ok", archived: totals }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "queryArchivedDoc" && data.collection && data.id) {
      var cfg = firestoreGet(CONFIG_DOC);
      var sid = cfg && cfg[ARCHIVE_CONFIG_KEY] ? cfg[ARCHIVE_CONFIG_KEY] : null;
      if (!sid) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: "error", message: "No archive sheet found" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var tabMap = { sales: "Sales", purchases: "Purchases", expenses: "Expenses", invoices: "Invoices" };
      var tabName = tabMap[data.collection];
      if (!tabName) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: "error", message: "Unknown collection" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var ss = SpreadsheetApp.openById(sid);
      var sheet = ss.getSheetByName(tabName);
      if (!sheet) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: "error", message: "Tab not found" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var doc = sheetFindById(sheet, data.id);
      if (!doc) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: "error", message: "Not found in archive" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService
        .createTextOutput(JSON.stringify({ status: "ok", doc: doc }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "queryArchivedRange" && data.collection && data.start && data.end) {
      var cfg = firestoreGet(CONFIG_DOC);
      var sid = cfg && cfg[ARCHIVE_CONFIG_KEY] ? cfg[ARCHIVE_CONFIG_KEY] : null;
      if (!sid) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: "error", message: "No archive sheet found" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var tabMap = { sales: "Sales", purchases: "Purchases", expenses: "Expenses", invoices: "Invoices" };
      var tabName = tabMap[data.collection];
      if (!tabName) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: "error", message: "Unknown collection" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var ss = SpreadsheetApp.openById(sid);
      var sheet = ss.getSheetByName(tabName);
      if (!sheet) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: "ok", docs: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var start = new Date(data.start).getTime();
      var end = new Date(data.end).getTime();
      end += 86400000;
      var docs = sheetQueryRange(sheet, start, end);
      return ContentService
        .createTextOutput(JSON.stringify({ status: "ok", docs: docs }))
        .setMimeType(ContentService.MimeType.JSON);
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
  console.log("doBackup started");
  var config = firestoreGet(CONFIG_DOC);
  if (!config) {
    console.log("doBackup: config not found at " + CONFIG_DOC);
    return;
  }
  if (!config.emailTo) {
    console.log("doBackup: emailTo is empty in config");
    return;
  }

  var emailTo = config.emailTo;
  var driveFolderId = config.driveFolderId;
  var enabledModules = config.enabledModules || [];
  console.log("doBackup: emailTo=" + emailTo + " modules=" + enabledModules.join(","));

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
      console.log("doBackup: fetching " + info.collection);
      var docs = firestoreList(info.collection);
      var csv = docsToCSV(docs);
      if (csv) {
        var filename = moduleKey + "-" + period + ".csv";
        var blob = Utilities.newBlob(csv, "text/csv", filename);
        attachments.push(blob);
        console.log("doBackup: " + moduleKey + " -> " + docs.length + " docs, CSV " + csv.length + " chars");

        if (driveFolderId) {
          try {
            var folder = DriveApp.getFolderById(driveFolderId);
            folder.createFile(blob);
          } catch (e) {
            console.log("doBackup: Drive save failed for " + moduleKey + ": " + e);
          }
        }
      } else {
        console.log("doBackup: " + moduleKey + " -> " + docs.length + " docs, CSV empty");
      }
    } catch (err) {
      console.log("doBackup: Error exporting " + moduleKey + ": " + err);
    }
  }

  if (attachments.length > 0) {
    console.log("doBackup: sending email with " + attachments.length + " attachments");
    MailApp.sendEmail({
      to: emailTo,
      subject: "AS-Collection Daily Backup — " + period,
      body: "Please find attached the scheduled backup reports for " + period + ".\n\nModules: " + enabledModules.join(", "),
      attachments: attachments,
    });
    console.log("doBackup: email sent");
  } else {
    console.log("doBackup: no attachments, email NOT sent");
  }

  // Chain archive: move previous fiscal year data to Google Sheet
  if (driveFolderId) {
    try {
      var cfgArch = firestoreGet(CONFIG_DOC);
      var archiveStart = cfgArch && cfgArch.archiveFYStart ? new Date(cfgArch.archiveFYStart) : null;
      var archiveEnd = cfgArch && cfgArch.archiveFYEnd ? new Date(cfgArch.archiveFYEnd) : null;
      if (!archiveStart || !archiveEnd) {
        var cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 1);
        archiveEnd = cutoff;
      }
      console.log("doBackup: starting archive chain, archiveStart=" + archiveStart + ", archiveEnd=" + archiveEnd);
      var archiveInfo = getArchiveSheet(driveFolderId);
      var tabs = archiveInfo.tabs;
      var collections = [
        { name: "sales", tab: tabs["Sales"], dateField: "saleDate", label: "Sales" },
        { name: "purchases", tab: tabs["Purchases"], dateField: "purchaseDate", label: "Purchases" },
        { name: "expenses", tab: tabs["Expenses"], dateField: "date", label: "Expenses" },
        { name: "invoices", tab: tabs["Invoices"], dateField: "createdAt", label: "Invoices" },
      ];
      for (var c = 0; c < collections.length; c++) {
        var col = collections[c];
        console.log("doBackup: archiving " + col.name);
        var whereClauses = archiveStart
          ? [[col.dateField, ">=", archiveStart], [col.dateField, "<", archiveEnd]]
          : [[col.dateField, "<", archiveEnd]];
        var docs = firestoreQuery(col.name, whereClauses);
        var archived = 0;
        for (var d = 0; d < docs.length; d++) {
          docs[d].dateField = docs[d][col.dateField] instanceof Date
            ? docs[d][col.dateField].getTime()
            : Number(docs[d][col.dateField] || 0);
          sheetAppendRow(col.tab, docs[d]);
          firestoreDelete(col.name + "/" + docs[d].id);
          archived++;
        }
        console.log("doBackup: archived " + archived + " " + col.name);
      }
    } catch (e) {
      console.log("doBackup: Archive chain error: " + e);
    }
  }
  console.log("doBackup finished");
}

// ── FIRESTORE WRITE HELPER ────────────────────────────

function objToFields(obj) {
  var fields = {};
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      fields[key] = valueToField(obj[key]);
    }
  }
  return fields;
}

function valueToField(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "number") {
    if (v % 1 === 0 && Math.abs(v) < 9007199254740991) return { integerValue: String(v) };
    return { doubleValue: v };
  }
  if (typeof v === "boolean") return { booleanValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valueToField) } };
  if (typeof v === "object") return { mapValue: { fields: objToFields(v) } };
  return { stringValue: String(v) };
}

function firestoreWrite(path, data, token) {
  var url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_CONFIG.projectId + "/databases/(default)/documents/" + path + "?key=" + FIREBASE_CONFIG.apiKey;
  var payload = { fields: objToFields(data) };
  UrlFetchApp.fetch(url, {
    method: "PATCH",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify(payload),
    contentType: "application/json",
    muteHttpExceptions: true,
  });
}

function firestorePatch(path, data) {
  var url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_CONFIG.projectId + "/databases/(default)/documents/" + path + "?key=" + FIREBASE_CONFIG.apiKey;
  var token = ScriptApp.getOAuthToken();
  var payload = { fields: objToFields(data) };
  UrlFetchApp.fetch(url, {
    method: "PATCH",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify(payload),
    contentType: "application/json",
    muteHttpExceptions: true,
  });
}

function firestoreDelete(path) {
  var url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_CONFIG.projectId + "/databases/(default)/documents/" + path + "?key=" + FIREBASE_CONFIG.apiKey;
  var token = ScriptApp.getOAuthToken();
  UrlFetchApp.fetch(url, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true,
  });
}

// ── FIRESTORE REST HELPERS ────────────────────────────

function firestoreGet(path) {
  var token = ScriptApp.getOAuthToken();
  var url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_CONFIG.projectId + "/databases/(default)/documents/" + path + "?key=" + FIREBASE_CONFIG.apiKey;
  var resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true,
  });
  if (resp.getResponseCode() !== 200) {
    console.log("firestoreGet(" + path + ") returned " + resp.getResponseCode() + ": " + resp.getContentText().slice(0, 200));
    return null;
  }
  var data = JSON.parse(resp.getContentText());
  return fieldsToObj(data.fields);
}

function firestoreList(collection) {
  var token = ScriptApp.getOAuthToken();
  var url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_CONFIG.projectId + "/databases/(default)/documents/" + collection + "?key=" + FIREBASE_CONFIG.apiKey;
  var allDocs = [];
  var pageToken = "";

  while (true) {
    var queryUrl = url + (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
    var resp = UrlFetchApp.fetch(queryUrl, {
      headers: { Authorization: "Bearer " + token },
      muteHttpExceptions: true,
    });
    if (resp.getResponseCode() !== 200) {
      console.log("firestoreList(" + collection + ") returned " + resp.getResponseCode() + ": " + resp.getContentText().slice(0, 200));
      break;
    }
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

// ── STRUCTURED QUERY HELPER ────────────────────────────

function firestoreQuery(collection, whereClauses, orderByClause, limitVal) {
  var token = ScriptApp.getOAuthToken();
  var url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_CONFIG.projectId + "/databases/(default)/documents:runQuery?key=" + FIREBASE_CONFIG.apiKey;

  var sq = { from: [{ collectionId: collection }] };

  if (whereClauses && whereClauses.length > 0) {
    var FILTER_OPS = {
      "==": "EQUAL", "!=": "NOT_EQUAL",
      "<": "LESS_THAN", "<=": "LESS_THAN_OR_EQUAL",
      ">": "GREATER_THAN", ">=": "GREATER_THAN_OR_EQUAL",
      "array-contains": "ARRAY_CONTAINS",
    };
    var filters = whereClauses.map(function(w) {
      return {
        fieldFilter: {
          field: { fieldPath: w[0] },
          op: FILTER_OPS[w[1]] || "EQUAL",
          value: valueToField(w[2]),
        }
      };
    });
    sq.where = filters.length === 1
      ? filters[0]
      : { compositeFilter: { op: "AND", filters: filters } };
  }

  if (orderByClause) {
    sq.orderBy = [{
      field: { fieldPath: orderByClause[0] },
      direction: orderByClause[1] === "desc" ? "DESCENDING" : "ASCENDING",
    }];
  }

  if (limitVal !== undefined) sq.limit = limitVal;

  var resp = UrlFetchApp.fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    contentType: "application/json",
    payload: JSON.stringify({ structuredQuery: sq }),
    muteHttpExceptions: true,
  });

  if (resp.getResponseCode() !== 200) {
    console.log("firestoreQuery(" + collection + ") returned " + resp.getResponseCode() + ": " + resp.getContentText().slice(0, 200));
    return [];
  }

  return JSON.parse(resp.getContentText())
    .filter(function(r) { return r.document; })
    .map(function(r) {
      var obj = fieldsToObj(r.document.fields);
      obj.id = r.document.name.split("/").pop();
      return obj;
    });
}

// ── ARCHIVE SHEET HELPERS ────────────────────────────

var ARCHIVE_SHEET_NAME = "AS-Collection_Archive";
var ARCHIVE_CONFIG_KEY = "archiveSheetId";

function getArchiveSheet(driveFolderId) {
  var config = firestoreGet(CONFIG_DOC);
  var sheetId = config && config[ARCHIVE_CONFIG_KEY] ? config[ARCHIVE_CONFIG_KEY] : null;
  var ss;
  if (sheetId) {
    try { ss = SpreadsheetApp.openById(sheetId); } catch (e) { ss = null; }
  }
  if (!ss) {
    var folder = driveFolderId ? DriveApp.getFolderById(driveFolderId) : DriveApp.getRootFolder();
    ss = SpreadsheetApp.create(ARCHIVE_SHEET_NAME);
    var file = DriveApp.getFileById(ss.getId());
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
    sheetId = ss.getId();
    firestorePatch(CONFIG_DOC, {});
    var url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_CONFIG.projectId + "/databases/(default)/documents/" + CONFIG_DOC + "?key=" + FIREBASE_CONFIG.apiKey;
    var token = ScriptApp.getOAuthToken();
    var payload = { fields: objToFields({ archiveSheetId: sheetId }) };
    UrlFetchApp.fetch(url, {
      method: "PATCH", headers: { Authorization: "Bearer " + token },
      payload: JSON.stringify(payload), contentType: "application/json", muteHttpExceptions: true,
    });
  }
  var tabs = {};
  var tabNames = ["Sales", "Purchases", "Expenses", "Invoices"];
  for (var t = 0; t < tabNames.length; t++) {
    var sheet = ss.getSheetByName(tabNames[t]);
    if (!sheet) {
      sheet = ss.insertSheet(tabNames[t]);
      sheet.appendRow(["id", "dateField", "data"]);
    }
    tabs[tabNames[t]] = sheet;
  }
  ss.getSheetByName("Sheet1") && ss.deleteSheet(ss.getSheetByName("Sheet1"));
  return { ss: ss, tabs: tabs, id: sheetId };
}

function sheetAppendRow(sheet, doc) {
  var dataStr = JSON.stringify(doc);
  sheet.appendRow([doc.id, doc.dateField || "", dataStr]);
}

function sheetFindById(sheet, id) {
  var data = sheet.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][0]) === String(id)) {
      try { return JSON.parse(data[r][2]); } catch (e) { return null; }
    }
  }
  return null;
}

function sheetQueryRange(sheet, start, end) {
  var data = sheet.getDataRange().getValues();
  var results = [];
  for (var r = 1; r < data.length; r++) {
    var ts = Number(data[r][1]);
    if (ts >= start && ts < end) {
      try { results.push(JSON.parse(data[r][2])); } catch (e) {}
    }
  }
  return results;
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
