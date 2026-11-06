/**
 * ==========================================================================
 * SYNTHEX 2026 - GOOGLE SPREADSHEET & DRIVE APPS SCRIPT WEBHOOK
 * ==========================================================================
 * 
 * This script connects your SYNTHEX 2026 website directly to your Google Sheet
 * and automatically saves uploaded Concept Papers (PDF/DOC/DOCX) into Google Drive!
 * 
 * --------------------------------------------------------------------------
 * STEP-BY-STEP DEPLOYMENT INSTRUCTIONS:
 * --------------------------------------------------------------------------
 * 1. Open Google Sheets (https://sheets.new) or your existing spreadsheet.
 * 2. In the top menu, click: Extensions -> Apps Script
 * 3. Delete any code in the editor and PASTE THIS ENTIRE FILE.
 * 4. Click the "Save project" icon (Floppy disk).
 * 5. In the top-right corner, click: Deploy -> New deployment
 * 6. Click the gear icon (Select type) next to "Deployment type" and choose: "Web app"
 * 7. Fill in the deployment details:
 *      - Description: "SYNTHEX 2026 Submissions Webhook"
 *      - Execute as: "Me" (your email)
 *      - Who has access: "Anyone"  <-- CRITICAL: Must be "Anyone", NOT "Only myself"
 * 8. Click "Deploy".
 * 9. If prompted, click "Authorize access", choose your Google account, 
 *    click "Advanced", then click "Go to ... (unsafe)", and click "Allow".
 * 10. COPY the "Web app URL" (it starts with: https://script.google.com/macros/s/.../exec).
 * 11. Open your SYNTHEX website (submit.html), click the Settings (Gear) icon 
 *     in the top navigation bar, paste this URL, and click "Save Settings".
 *     (You can also paste it into CONFIG.appsScriptUrl in app.js).
 * 
 * That's it! Every submission will now instantly appear in your Google Sheet,
 * and uploaded concept papers will be stored in a Google Drive folder with clickable links!
 * ==========================================================================
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Add header row if spreadsheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp",
        "Reference ID",
        "Submission Type",
        "Batch",
        "Registration & Member Details",
        "Presenter / Lead Name",
        "Topic of Idea",
        "Concept Paper (Drive Link)",
        "Email",
        "Contact Number"
      ]);
      
      // Style header row
      var headerRange = sheet.getRange(1, 1, 1, 10);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#020712");
      headerRange.setFontColor("#00FF87");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }

    // Parse incoming data (supports JSON text/plain or urlencoded)
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    var timestamp = data.timestamp || new Date().toLocaleString();
    var id = data.id || "SYNTHEX-" + Utilities.getUuid().slice(0, 8).toUpperCase();
    var subType = data.submissionTypeTitle || (data.submissionType === "group" ? "Group Submission" : "Individual Submission");
    var batch = data.batch || "";
    
    // Member details (handles both individual & compiled group tables)
    var regDetails = data.regAndNames || (data.submissionType === "group" ? data.groupMembers : data.regNo) || "";
    var presenterName = data.participantSummary || data.fullName || (data.submissionType === "group" ? "Team Entry" : "");
    var topic = data.topic || data.groupTopic || "";
    var email = data.email || data.groupEmail || "";
    var phone = data.phone || data.groupPhone || "";

    // Handle File Upload to Google Drive
    var fileUrl = data.description || "";
    if (data.fileData && data.fileName) {
      try {
        var folderName = "SYNTHEX 2026 Submissions";
        var folders = DriveApp.getFoldersByName(folderName);
        var targetFolder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

        var contentType = data.fileType || "application/octet-stream";
        var base64Data = data.fileData;
        if (base64Data.indexOf("base64,") > -1) {
          base64Data = base64Data.split("base64,")[1];
        }

        var decoded = Utilities.base64Decode(base64Data);
        var safeFileName = id + "_" + data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        var blob = Utilities.newBlob(decoded, contentType, safeFileName);
        var createdFile = targetFolder.createFile(blob);

        // Make file accessible to anyone with the link
        try {
          createdFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (shareErr) {
          // Keep existing Drive permissions if domain restricts public sharing
        }

        fileUrl = createdFile.getUrl();
      } catch (driveErr) {
        fileUrl = (data.fileName || "File Uploaded") + " (Drive upload notice: " + driveErr.message + ")";
      }
    }

    // Append submission row
    sheet.appendRow([
      timestamp,
      id,
      subType,
      batch,
      regDetails,
      presenterName,
      topic,
      fileUrl,
      email,
      phone
    ]);

    // Format new row styling
    var lastRow = sheet.getLastRow();
    var rowRange = sheet.getRange(lastRow, 1, 1, 10);
    rowRange.setVerticalAlignment("middle");
    
    // Auto-fit column widths reasonably
    if (lastRow <= 2) {
      for (var c = 1; c <= 10; c++) {
        sheet.autoResizeColumn(c);
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ 
        status: "success", 
        id: id, 
        fileUrl: fileUrl,
        message: "Submission successfully recorded in Google Sheets." 
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ 
        status: "error", 
        message: error.toString() 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ 
      status: "active", 
      message: "SYNTHEX 2026 Google Sheets webhook is active and ready to receive submissions." 
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
