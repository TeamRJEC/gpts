/******************************************************
 * Code.gs
 * - doGet(): serve the kiosk page
 * - getBaysAndOptions(): returns all bays + features
 * - updateBayFeatures(): logs + emails the submission
 ******************************************************/

/**
 * doGet() - Required for a web app
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Car Wash Kiosk')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * include() - Helper to load partial HTML files
 */
function include(filename) {
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}

/**
 * getBaysAndOptions()
 * - Loads all rows from "Bays" + all rows from "Options"
 * - Returns { success, bays, features }
 */
function getBaysAndOptions() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('SHEET_ID');
  if (!sheetId) {
    return { success: false, error: 'SHEET_ID not set in Script Properties.' };
  }

  try {
    const ss = SpreadsheetApp.openById(sheetId);

    // 1) Bays
    const baysSheet = ss.getSheetByName('Bays');
    if (!baysSheet) {
      return { success: false, error: 'No "Bays" sheet found.' };
    }
    const baysData = baysSheet.getDataRange().getValues();
    const bays = [];
    for (let i = 1; i < baysData.length; i++) {
      if (baysData[i][0]) {
        bays.push({
          bayId: baysData[i][0],
          bayName: baysData[i][1],
          location: baysData[i][2]
        });
      }
    }

    // 2) Features
    const optionsSheet = ss.getSheetByName('Options');
    let features = [];
    if (optionsSheet) {
      const optData = optionsSheet.getDataRange().getValues();
      for (let i = 1; i < optData.length; i++) {
        if (optData[i][0]) {
          features.push({
            optionId: optData[i][0],
            optionName: optData[i][1]
          });
        }
      }
    }

    return {
      success: true,
      bays: bays,
      features: features
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * updateBayFeatures()
 * - Logs each feature's status in "CarWashStatus"
 * - Sends a descriptive email about the submission
 */
function updateBayFeatures(bayId, bayName, inspector, phone, notes, featureStatuses) {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('SHEET_ID');
  if (!sheetId) {
    return { success: false, message: 'SHEET_ID not set in Script Properties.' };
  }

  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const logSheet = ss.getSheetByName('CarWashStatus');
    if (!logSheet) {
      return { success: false, message: 'No CarWashStatus sheet found!' };
    }

    // 1) Log each feature row in "CarWashStatus"
    // Example columns: [Timestamp, BayID, FeatureID, FeatureName, Status, Inspector, Phone, Notes]
    const now = new Date();
    featureStatuses.forEach(fs => {
      logSheet.appendRow([
        now,
        bayId,
        fs.optionId,
        fs.optionName,
        fs.status,
        inspector,
        phone,
        notes
      ]);
    });

    // 2) Send a descriptive email
    // Make sure "Gmail" advanced service is enabled in Services
    const emailTo = 'YOUR_EMAIL@EXAMPLE.COM'; // Or store in Script Props
    const subject = `Car Wash Kiosk Submission - Bay ${bayId} (${bayName})`;

    // Break out features by color
    const redFeatures = [];
    const yellowFeatures = [];
    const greenFeatures = [];
    featureStatuses.forEach(fs => {
      if (fs.status === 'RED') {
        redFeatures.push(fs.optionName);
      } else if (fs.status === 'YELLOW') {
        yellowFeatures.push(fs.optionName);
      } else if (fs.status === 'GREEN') {
        greenFeatures.push(fs.optionName);
      }
    });

    let body = `Inspector: ${inspector}\nPhone: ${phone}\nNotes: ${notes}\n\n`;
    body += `Bay: ${bayId} (${bayName})\n\n`;

    if (redFeatures.length > 0) {
      body += `Broken (RED):\n`;
      redFeatures.forEach(f => body += ` - ${f}\n`);
      body += '\n';
    }
    if (yellowFeatures.length > 0) {
      body += `Needs Attention (YELLOW):\n`;
      yellowFeatures.forEach(f => body += ` - ${f}\n`);
      body += '\n';
    }
    if (greenFeatures.length > 0) {
      body += `Working (GREEN):\n`;
      greenFeatures.forEach(f => body += ` - ${f}\n`);
      body += '\n';
    }

    GmailApp.sendEmail(emailTo, subject, body);

    return {
      success: true,
      message: `Logged ${featureStatuses.length} feature(s) for Bay ${bayId}, and emailed submission.`
    };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}
