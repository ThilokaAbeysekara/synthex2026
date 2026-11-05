/**
 * ==========================================================================
 * SYNTHEX 2026 - GOOGLE SPREADSHEET APPS SCRIPT WEBHOOK
 * ==========================================================================
 * 
 * INSTRUCTIONS TO DEPLOY:
 * 1. Open Google Sheets (https://sheets.new) or your existing spreadsheet.
 * 2. In the top menu, click: Extensions -> Apps Script
 * 3. Delete any code in the editor, paste this entire script, and click "Save" (Floppy icon).
 * 4. In the top right, click "Deploy" -> "New deployment"
 * 5. Select type: "Web app" (Gear icon -> Web app)
 * 6. Set Description: "SYNTHEX 2026 Form Submission"
 * 7. Set "Execute as": "Me"
 * 8. Set "Who has access": "Anyone" (IMPORTANT!)
 * 9. Click "Deploy", authorize permissions when prompted.
 * 10. Copy the Web App URL (starts with https://script.google.com/macros/s/.../exec).
 * 11. Open your SYNTHEX website, click the Settings (Gear) icon in the top right, 
 *     paste the Web App URL, and click "Save Settings".
 * ==========================================================================
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Check if sheet is empty, add headers if needed
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp",
        "Reference ID",
        "Submission Type",
        "Batch",
        "Registration / Member Details",
        "Presenter / Lead Name",
        "Topic of Your Idea",
        "Describe Your Idea",
        "Email",
        "Contact Number"
      ]);
      
      // Style header row
      var headerRange = sheet.getRange(1, 1, 1, 10);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#020712");
      headerRange.setFontColor("#00FF87");
    }

    var data;
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        data = e.parameter;
      }
    } else {
      data = e.parameter || {};
    }

    var timestamp = data.timestamp || new Date().toLocaleString();
    var id = data.id || "SYNTHEX-" + Utilities.getUuid().slice(0, 8).toUpperCase();
    var subType = data.submissionType === "group" ? "Group Submission" : "Individual Submission";
    var batch = data.batch || "";
    var regDetails = data.submissionType === "group" ? (data.groupMembers || "") : (data.regNo || "");
    var presenterName = data.submissionType === "group" ? "Team Entry" : (data.fullName || "");
    var topic = data.topic || data.groupTopic || "";
    var description = data.description || data.groupDescription || "";
    var email = data.email || data.groupEmail || "";
    var phone = data.phone || data.groupPhone || "";

    // Append submission row
    sheet.appendRow([
      timestamp,
      id,
      subType,
      batch,
      regDetails,
      presenterName,
      topic,
      description,
      email,
      phone
    ]);

    // Format new row
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 1, 1, 10).setVerticalAlignment("middle");

    return ContentService
      .createTextOutput(JSON.stringify({ status: "success", id: id }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "active", message: "SYNTHEX 2026 Webhook is running." }))
    .setMimeType(ContentService.MimeType.JSON);
}
