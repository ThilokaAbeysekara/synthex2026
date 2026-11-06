/**
 * Server-to-server Sheets bridge. No participant page, Drive upload or public
 * document links. Deploy as a Web App (execute as owner, access Anyone).
 * Set Script Properties: SHEETS_SYNC_SECRET, SPREADSHEET_ID and optional SHEET_NAME.
 * Set the same secret and the /exec URL ONLY in Supabase Edge Function secrets.
 */
function doPost(e) {
  var lock;
  try {
    var properties = PropertiesService.getScriptProperties();
    var expected = properties.getProperty('SHEETS_SYNC_SECRET');
    var data = JSON.parse(e && e.postData && e.postData.contents || '{}');
    if (!expected || !safeEqual_(expected, data.secret)) return json_({ success: false, error: 'Unauthorized.' });
    var s = data.submission;
    if (!s || !/^SYNTHEX-[A-F0-9-]{36}$/.test(s.id || '') ||
        !s.topic || !s.email || !s.filePath || !Array.isArray(s.members) ||
        (s.submissionType === 'individual' ? s.members.length !== 1 : s.submissionType !== 'group' || s.members.length < 2 || s.members.length > 6)) {
      return json_({ success: false, error: 'Invalid confirmed registration.' });
    }
    var spreadsheetId = properties.getProperty('SPREADSHEET_ID');
    if (!spreadsheetId) return json_({ success: false, error: 'Bridge not configured.' });
    lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return json_({ success: false, error: 'Bridge busy; retry later.' });
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var sheetName = properties.getProperty('SHEET_NAME');
    var sheet = sheetName ? spreadsheet.getSheetByName(sheetName) : spreadsheet.getSheets()[0];
    if (!sheet) return json_({ success: false, error: 'Configured sheet was not found.' });
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Reference ID', 'Submission Type', 'Batch',
        'Registration & Member Details', 'Presenter / Lead Name', 'Topic of Idea',
        'Concept Paper (Private Storage Path)', 'Email', 'Contact Number']);
      sheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#020712').setFontColor('#00FF87');
      sheet.setFrozenRows(1);
    }
    // The existing spreadsheet format keeps reference IDs in column B.
    var count = sheet.getLastRow();
    if (count > 1 && sheet.getRange(2, 2, count - 1, 1).createTextFinder(s.id).matchEntireCell(true).findNext()) {
      return json_({ success: true, id: s.id, duplicate: true });
    }
    var details = s.members.map(function (member, i) {
      return (i + 1) + '. ' + member.regNo + ' - ' + member.fullName + (i === 0 ? ' (Lead)' : '');
    }).join('\n');
    var row = [s.timestamp, s.id, s.submissionType === 'group' ? 'Group Submission' : 'Individual Submission',
      s.batch, details, s.members[0].fullName, s.topic, 'concept-papers/' + s.filePath, s.email, s.phone || ''];
    sheet.appendRow(row.map(sheetText_));
    SpreadsheetApp.flush();
    return json_({ success: true, id: s.id });
  } catch (_) {
    return json_({ success: false, error: 'Sheets synchronization failed; retry later.' });
  } finally {
    if (lock) lock.releaseLock();
  }
}
function doGet() {
  return json_({ success: false, error: 'Server-to-server POST endpoint only.' });
}
function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
function safeEqual_(expected, actual) {
  if (typeof actual !== 'string') return false;
  var a = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, expected);
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, actual);
  var difference = 0;
  for (var i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
function sheetText_(value) {
  var text = value == null ? '' : String(value);
  return /^[\s\u0000-\u001f]*[=+@-]/.test(text) ? "'" + text : text;
}
