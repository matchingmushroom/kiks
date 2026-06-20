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

// ── STRUCTURED QUERY HELPER ────────────────────────────

function firestoreQuery(collection, whereClauses, orderByClause, limitVal) {
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
    contentType: "application/json",
    payload: JSON.stringify({ structuredQuery: sq }),
    muteHttpExceptions: true,
  });

  if (resp.getResponseCode() !== 200) return [];

  return JSON.parse(resp.getContentText())
    .filter(function(r) { return r.document; })
    .map(function(r) {
      var obj = fieldsToObj(r.document.fields);
      obj.id = r.document.name.split("/").pop();
      return obj;
    });
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
