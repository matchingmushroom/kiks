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
      var products = firestoreListPlain("products");

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

      var allProducts = firestoreListPlain("products");
      var allSales = firestoreQuery("sales", [["saleDate", "<", asOf]]);
      var allExpenses = firestoreQuery("expenses", [["date", "<", asOf]]);
      var allDebtors = firestoreListPlain("debtors");
      var allPurchases = firestoreQuery("purchases", [["purchaseDate", "<", asOf]]);
      var allCreditors = firestoreListPlain("creditors");
      var allAccounts = firestoreListPlain("accounts");
      var allTxns = firestoreQuery("accountTransactions", [["date", "<", asOf]]);
      var jeRaw = firestoreList("journalEntries");
      var jeEntries = [];
      for (var jei = 0; jei < jeRaw.length; jei++) {
        var jep = fieldsToObj(jeRaw[jei].fields);
        var jeDate = Number(jep.entryDate || 0);
        if (jeDate < asOf.getTime()) jeEntries.push(jep);
      }

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

      // Also calculate from journal entries (double-entry)
      var jeCash = 0, jeBank = 0;
      for (var jec = 0; jec < jeEntries.length; jec++) {
        var jEntry = jeEntries[jec];
        if (!jEntry.lines) continue;
        var jLines = jEntry.lines;
        for (var jl = 0; jl < jLines.length; jl++) {
          var jLine = jLines[jl];
          var code = String(jLine.accountCode || "");
          if (code === "1.1.1") jeCash += Number(jLine.debit || 0) - Number(jLine.credit || 0);
          if (code === "1.1.2") jeBank += Number(jLine.debit || 0) - Number(jLine.credit || 0);
        }
      }

      // Get opening balances from accounts collection
      var cashOpening = 0, bankOpening = 0;
      for (var a2 = 0; a2 < allAccounts.length; a2++) {
        if (allAccounts[a2].id === "cash_in_hand") cashOpening = Number(allAccounts[a2].openingBalance || 0);
        if (allAccounts[a2].id === "bank_account") bankOpening = Number(allAccounts[a2].openingBalance || 0);
      }
      // Use journal entries as primary source (avoids double-counting with accountTransactions)
      var cashBalance = jeEntries.length > 0 ? (cashOpening + jeCash) : (accountBalances["cash_in_hand"] || 0);
      var bankBalance = jeEntries.length > 0 ? (bankOpening + jeBank) : (accountBalances["bank_account"] || 0);

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
      // Use journal entries as primary source to avoid double-counting
      if (jeEntries.length > 0) {
        for (var jec2 = 0; jec2 < jeEntries.length; jec2++) {
          var je2 = jeEntries[jec2];
          if (!je2.lines) continue;
          for (var jl3 = 0; jl3 < je2.lines.length; jl3++) {
            var line2 = je2.lines[jl3];
            var code2 = String(line2.accountCode || "");
            if (code2.startsWith("4.")) retainedEarnings += Number(line2.credit || 0) - Number(line2.debit || 0);
            if (code2.startsWith("5.")) retainedEarnings -= Number(line2.debit || 0) - Number(line2.credit || 0);
          }
        }
      } else {
        // Legacy: compute from sales/expenses collections
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
      }

      var partnerDocs = firestoreList("partnerCapitals");
      var openingCapital = 0;
      for (var pci = 0; pci < partnerDocs.length; pci++) {
        var pp = fieldsToObj(partnerDocs[pci].fields);
        openingCapital += Number(pp.amount || 0);
      }

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

    if (data.action === "computeTrialBalance" && data.start && data.end) {
      var tbStart = new Date(data.start);
      var tbEnd = new Date(data.end);
      tbEnd.setDate(tbEnd.getDate() + 1);
      var tbEntriesRaw = firestoreList("journalEntries");
      var tbEntries = [];
      for (var tei = 0; tei < tbEntriesRaw.length; tei++) {
        var ep = fieldsToObj(tbEntriesRaw[tei].fields);
        ep.id = tbEntriesRaw[tei].id;
        tbEntries.push(ep);
      }
      var tbAccountsRaw = firestoreList("chartOfAccounts");
      var tbAccounts = [];
      for (var tai = 0; tai < tbAccountsRaw.length; tai++) {
        var ap = fieldsToObj(tbAccountsRaw[tai].fields);
        ap.id = tbAccountsRaw[tai].id;
        tbAccounts.push(ap);
      }
      var tbTotals = {};
      for (var te = 0; te < tbEntries.length; te++) {
        var entry = tbEntries[te];
        if (!entry.lines) continue;
        var eDate = Number(entry.entryDate || 0);
        if (eDate < tbStart.getTime() || eDate >= tbEnd.getTime()) continue;
        var lines = entry.lines;
        for (var tl = 0; tl < lines.length; tl++) {
          var line = lines[tl];
          var code = String(line.accountCode || "");
          if (!tbTotals[code]) tbTotals[code] = { debit: 0, credit: 0 };
          tbTotals[code].debit += Number(line.debit || 0);
          tbTotals[code].credit += Number(line.credit || 0);
        }
      }
      var tbRows = [];
      for (var ta = 0; ta < tbAccounts.length; ta++) {
        var acc = tbAccounts[ta];
        var total = tbTotals[acc.code] || { debit: 0, credit: 0 };
        tbRows.push({ Account: acc.code + " - " + acc.name, Debit: total.debit, Credit: total.credit });
      }
      return ContentService
        .createTextOutput(JSON.stringify({ status: "ok", headers: ["Account", "Debit", "Credit"], data: tbRows }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "computeCashFlow") {
      var cfRaw = firestoreList("journalEntries");
      var cfEntries = [];
      for (var cfi = 0; cfi < cfRaw.length; cfi++) {
        var cp = fieldsToObj(cfRaw[cfi].fields);
        cp.id = cfRaw[cfi].id;
        cfEntries.push(cp);
      }
      var cfOperating = 0, cfInvesting = 0, cfFinancing = 0;
      for (var ce = 0; ce < cfEntries.length; ce++) {
        var cfEntry = cfEntries[ce];
        if (!cfEntry.lines) continue;
        var cfLines = cfEntry.lines;
        for (var cl = 0; cl < cfLines.length; cl++) {
          var cfLine = cfLines[cl];
          var cfCode = String(cfLine.accountCode || "");
          var cfNet = Number(cfLine.credit || 0) - Number(cfLine.debit || 0);
          if (cfCode.startsWith("4.") || cfCode.startsWith("5.1")) cfOperating += cfNet;
          else if (cfCode.startsWith("1.1.7")) cfInvesting -= cfNet;
          else if (cfCode.startsWith("2.1.3") || cfCode.startsWith("3.")) cfFinancing += cfNet;
        }
      }
      var cfRows = [
        { Category: "Operating", Amount: cfOperating },
        { Category: "Investing", Amount: cfInvesting },
        { Category: "Financing", Amount: cfFinancing },
        { Category: "Net Cash Change", Amount: cfOperating + cfInvesting + cfFinancing },
      ];
      return ContentService
        .createTextOutput(JSON.stringify({ status: "ok", headers: ["Category", "Amount"], data: cfRows }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "computeAgedReceivables") {
      var arRaw = firestoreList("debtors");
      var arNow = Date.now();
      var arRows = [];
      for (var ad = 0; ad < arRaw.length; ad++) {
        var dp = fieldsToObj(arRaw[ad].fields);
        if (!dp || dp.status === "cleared") continue;
        var name = String(dp.customerName || "");
        var phone = String(dp.customerPhone || "");
        var balance = Number(dp.balanceDue || 0);
        var dueDate = Number(dp.dueDate || arNow);
        var daysDue = Math.max(0, Math.floor((arNow - dueDate) / 86400000));
        var bucket = daysDue <= 30 ? "0-30" : daysDue <= 60 ? "31-60" : daysDue <= 90 ? "61-90" : "90+";
        arRows.push({ Customer: name, Phone: phone, Balance: balance, "Days Due": daysDue, Bucket: bucket });
      }
      return ContentService
        .createTextOutput(JSON.stringify({ status: "ok", headers: ["Customer", "Phone", "Balance", "Days Due", "Bucket"], data: arRows }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "computeAgedPayables") {
      var apRaw = firestoreList("creditors");
      var apNow = Date.now();
      var apRows = [];
      for (var ac = 0; ac < apRaw.length; ac++) {
        var cp = fieldsToObj(apRaw[ac].fields);
        if (!cp || cp.status === "cleared") continue;
        var name = String(cp.supplierName || "");
        var phone = String(cp.supplierPhone || "");
        var balance = Number(cp.balanceDue || 0);
        var lastDate = Number(cp.lastTransactionDate || apNow);
        var daysDue = Math.max(0, Math.floor((apNow - lastDate) / 86400000));
        var bucket = daysDue <= 30 ? "0-30" : daysDue <= 60 ? "31-60" : daysDue <= 90 ? "61-90" : "90+";
        apRows.push({ Supplier: name, Phone: phone, Balance: balance, "Days Due": daysDue, Bucket: bucket });
      }
      return ContentService
        .createTextOutput(JSON.stringify({ status: "ok", headers: ["Supplier", "Phone", "Balance", "Days Due", "Bucket"], data: apRows }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "seedChartOfAccounts") {
      var coaAccounts = [
        { id: "cash_in_hand", code: "1.1.1", name: "Cash in Hand", category: "asset", subCategory: "current_asset", isActive: true, openingBalance: 0 },
        { id: "bank_account", code: "1.1.2", name: "Bank Account", category: "asset", subCategory: "current_asset", isActive: true, openingBalance: 0 },
        { id: "petty_cash", code: "1.1.3", name: "Petty Cash", category: "asset", subCategory: "current_asset", isActive: true, openingBalance: 0 },
        { id: "stock_in_trade", code: "1.1.4", name: "Stock in Trade", category: "asset", subCategory: "current_asset", isActive: true, openingBalance: 0 },
        { id: "staff_advance", code: "1.1.5", name: "Staff Advance", category: "asset", subCategory: "current_asset", isActive: true, openingBalance: 0 },
        { id: "sundry_debtors", code: "1.1.6", name: "Sundry Debtors", category: "asset", subCategory: "current_asset", isActive: true, openingBalance: 0 },
        { id: "fixed_assets", code: "1.1.7", name: "Fixed Assets", category: "asset", subCategory: "fixed_asset", isActive: true, openingBalance: 0 },
        { id: "sundry_creditors", code: "2.1.1", name: "Sundry Creditors", category: "liability", subCategory: "current_liability", isActive: true, openingBalance: 0 },
        { id: "outstanding_expenses", code: "2.1.2", name: "Outstanding Expenses", category: "liability", subCategory: "current_liability", isActive: true, openingBalance: 0 },
        { id: "bank_loan", code: "2.1.3", name: "Bank Loan", category: "liability", subCategory: "long_term_liability", isActive: true, openingBalance: 0 },
        { id: "owners_capital", code: "3.1.1", name: "Owner's Capital", category: "equity", subCategory: "capital", isActive: true, openingBalance: 0 },
        { id: "retained_earnings", code: "3.1.2", name: "Retained Earnings", category: "equity", subCategory: "reserves", isActive: true, openingBalance: 0 },
        { id: "drawings", code: "3.1.3", name: "Drawings", category: "equity", subCategory: "drawings", isActive: true, openingBalance: 0 },
        { id: "sales_revenue", code: "4.1.1", name: "Sales Revenue", category: "income", subCategory: "revenue", isActive: true, openingBalance: 0 },
        { id: "discount_received", code: "4.1.2", name: "Discount Received", category: "income", subCategory: "other_income", isActive: true, openingBalance: 0 },
        { id: "other_income", code: "4.1.3", name: "Other Income", category: "income", subCategory: "other_income", isActive: true, openingBalance: 0 },
        { id: "cogs", code: "5.1.1", name: "Cost of Goods Sold", category: "expense", subCategory: "direct_expense", isActive: true, openingBalance: 0 },
        { id: "salary", code: "5.2.1", name: "Salary", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
        { id: "rent", code: "5.2.2", name: "Rent", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
        { id: "electricity", code: "5.2.3", name: "Electricity", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
        { id: "water", code: "5.2.4", name: "Water", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
        { id: "internet", code: "5.2.5", name: "Internet", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
        { id: "marketing", code: "5.2.6", name: "Marketing", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
        { id: "travel", code: "5.2.7", name: "Travel", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
        { id: "maintenance", code: "5.2.8", name: "Maintenance", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
        { id: "packaging", code: "5.2.9", name: "Packaging", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
        { id: "bank_charges", code: "5.2.10", name: "Bank Charges", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
        { id: "taxes", code: "5.2.11", name: "Taxes", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
        { id: "miscellaneous_expense", code: "5.2.12", name: "Miscellaneous Expense", category: "expense", subCategory: "indirect_expense", isActive: true, openingBalance: 0 },
      ];
      var count = 0;
      for (var ci = 0; ci < coaAccounts.length; ci++) {
        try {
          firestorePatch("chartOfAccounts/" + coaAccounts[ci].id, coaAccounts[ci]);
          count++;
        } catch (e) { console.log("Seed error: " + e); }
      }
      return ContentService
        .createTextOutput(JSON.stringify({ status: "ok", message: "Seeded " + count + " accounts" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "migrateToDoubleEntry") {
      var migRaw = firestoreList("accountTransactions");
      var migTxns = [];
      for (var mi = 0; mi < migRaw.length; mi++) {
        var mp = fieldsToObj(migRaw[mi].fields);
        mp.id = migRaw[mi].id;
        migTxns.push(mp);
      }
      var count = 0;
      for (var mt = 0; mt < migTxns.length; mt++) {
        var tx = migTxns[mt];
        var txRefType = String(tx.referenceType || "");
        var txRefId = String(tx.referenceId || "");
        var txDate = Number(tx.date || Date.now());
        var txAmount = Number(tx.amount || 0);
        var txAccountId = String(tx.accountId || "");
        var txType = String(tx.type || "");
        var txDesc = String(tx.description || "");
        var txRecordedBy = String(tx.recordedBy || "");

        var cashCode = txAccountId === "cash_in_hand" ? "1.1.1" : "1.1.2";
        var lines = [];
        if (txType === "credit") {
          if (txRefType === "sale") {
            lines.push({ accountCode: cashCode, accountName: txAccountId === "cash_in_hand" ? "Cash in Hand" : "Bank Account", debit: txAmount, credit: 0 });
            lines.push({ accountCode: "4.1.1", accountName: "Sales Revenue", debit: 0, credit: txAmount });
          }
        } else if (txType === "debit") {
          if (txRefType === "expense") {
            lines.push({ accountCode: "5.2.12", accountName: "Miscellaneous", debit: txAmount, credit: 0 });
            lines.push({ accountCode: cashCode, accountName: txAccountId === "cash_in_hand" ? "Cash in Hand" : "Bank Account", debit: 0, credit: txAmount });
          } else if (txRefType === "purchase") {
            lines.push({ accountCode: "1.1.4", accountName: "Stock in Trade", debit: txAmount, credit: 0 });
            lines.push({ accountCode: cashCode, accountName: txAccountId === "cash_in_hand" ? "Cash in Hand" : "Bank Account", debit: 0, credit: txAmount });
          } else if (txRefType === "transfer") {
            var fromAcc = txDesc.includes("Bank") ? "1.1.2" : "1.1.1";
            var toAcc = fromAcc === "1.1.1" ? "1.1.2" : "1.1.1";
            if (txDesc.includes("Advance") || txDesc.includes("advance")) {
              lines.push({ accountCode: "1.1.5", accountName: "Staff Advance", debit: txAmount, credit: 0 });
              lines.push({ accountCode: "1.1.1", accountName: "Cash in Hand", debit: 0, credit: txAmount });
            } else {
              lines.push({ accountCode: toAcc, accountName: toAcc === "1.1.2" ? "Bank Account" : "Cash in Hand", debit: txAmount, credit: 0 });
              lines.push({ accountCode: fromAcc, accountName: fromAcc === "1.1.1" ? "Cash in Hand" : "Bank Account", debit: 0, credit: txAmount });
            }
          }
        }
        if (lines.length === 0) continue;
        try {
          var entryNum = "MIG-" + String(count + 1).padStart(6, "0");
          firestorePatch("journalEntries/" + tx.id, {
            entryNumber: entryNum, entryDate: txDate, description: txDesc,
            lines: lines, referenceType: txRefType, referenceId: txRefId,
            recordedBy: txRecordedBy, recordedByName: txRecordedBy,
            isPosted: true, createdAt: Date.now(),
          });
          count++;
        } catch (e) { console.log("Migration error: " + e); }
      }
      return ContentService
        .createTextOutput(JSON.stringify({ status: "ok", message: "Migrated " + count + " journal entries" }))
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

    if (data.action === "sendPartnerReport" && data.pdfBase64) {
      try {
        var pdfBlob = Utilities.newBlob(
          Utilities.base64Decode(data.pdfBase64),
          "application/pdf",
          "partner-report-" + new Date().toISOString().slice(0, 10) + ".pdf"
        );
        var emails = data.partnerEmails || [];
        var shopName = data.shopName || "Shop";
        var period = data.period || new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });

        if (emails.length > 0) {
          var recipient = emails[0];
          var bcc = emails.slice(1).join(",");

          var htmlBody = [
            "<div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">",
            "<h2 style=\"color: #1e3a5f;\">" + shopName + " — Partner Report</h2>",
            "<p style=\"color: #666;\">Please find attached the partner report for <strong>" + period + "</strong>.</p>",
            "<hr style=\"border: none; border-top: 1px solid #eee;\" />",
            "<p style=\"color: #999; font-size: 12px;\">This is an automated report from " + shopName + ". Generated on " + new Date().toLocaleString("en-IN") + ".</p>",
            "</div>"
          ].join("\n");

          MailApp.sendEmail({
            to: recipient,
            bcc: bcc || undefined,
            subject: shopName + " Partner Report — " + period,
            htmlBody: htmlBody,
            attachments: [pdfBlob],
          });
        }

        return ContentService
          .createTextOutput(JSON.stringify({ status: "ok", message: "Partner report sent to " + emails.length + " recipients." }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: "error", message: "Failed to send partner report: " + err.toString() }))
          .setMimeType(ContentService.MimeType.JSON);
      }
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

function firestoreListPlain(collection) {
  var raw = firestoreList(collection);
  var out = [];
  for (var i = 0; i < raw.length; i++) {
    var obj = fieldsToObj(raw[i].fields);
    obj.id = raw[i].id;
    out.push(obj);
  }
  return out;
}

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
