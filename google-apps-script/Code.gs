/**
 * Roat's Bas Mitzvah — Google Sheets + Drive backend.
 * Run setup() once from the Apps Script editor, then deploy as a web app.
 * Public submissions are accepted; admin reads require an email one-time code.
 */

const ADMIN_EMAIL = "them allingers@gmail.com";
const PROP = PropertiesService.getScriptProperties();

function setup() {
  let spreadsheetId = PROP.getProperty("SPREADSHEET_ID");
  let spreadsheet;
  if (spreadsheetId) {
    spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  } else {
    spreadsheet = SpreadsheetApp.create("Roat's Bas Mitzvah — Guest Responses");
    spreadsheetId = spreadsheet.getId();
    PROP.setProperty("SPREADSHEET_ID", spreadsheetId);
  }

  const definitions = {
    RSVPs: ["Timestamp", "Name", "Email", "Phone", "Attending", "Guest Count"],
    Songs: ["Timestamp", "Name", "Song"],
    VoiceMessages: ["Timestamp", "Name", "Drive File ID", "File Name", "Duration Seconds", "Content Type"]
  };
  Object.entries(definitions).forEach(([name, headers]) => {
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) sheet = spreadsheet.insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  });

  let folderId = PROP.getProperty("VOICE_FOLDER_ID");
  if (!folderId) {
    const folder = DriveApp.createFolder("Roat's Bas Mitzvah — Voice Messages");
    folderId = folder.getId();
    PROP.setProperty("VOICE_FOLDER_ID", folderId);
  }
  Logger.log("Spreadsheet: " + spreadsheet.getUrl());
  Logger.log("Voice folder: https://drive.google.com/drive/folders/" + folderId);
  return { spreadsheetUrl: spreadsheet.getUrl(), voiceFolderId: folderId };
}

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.website) return reply_(false, "Submission rejected.");
    const ss = SpreadsheetApp.openById(requiredProp_("SPREADSHEET_ID"));
    const now = new Date();

    if (p.action === "rsvp") {
      const name = clean_(p.name, 100);
      const email = clean_(p.email, 254);
      const phone = clean_(p.phone, 40);
      const attending = p.attending === "yes" ? "Yes" : "No";
      const guests = Math.max(1, Math.min(20, Number(p.guest_count) || 1));
      if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Please provide a name and valid email address.");
      }
      ss.getSheetByName("RSVPs").appendRow([now, name, email, phone, attending, guests]);
      return reply_(true, "Your RSVP is in. Thank you!");
    }

    if (p.action === "song") {
      const name = clean_(p.name, 100);
      const song = clean_(p.song, 500);
      if (!name || !song) throw new Error("Please add your name and song.");
      ss.getSheetByName("Songs").appendRow([now, name, song]);
      return reply_(true, "Song submitted! Roat's playlist just got better.");
    }

    if (p.action === "voice") {
      const name = clean_(p.name, 100);
      const duration = Number(p.duration_seconds);
      const encoded = p.audio_base64 || "";
      if (!name) throw new Error("Please add your name.");
      if (duration < 15 || duration > 30) throw new Error("Voice messages must be 15–30 seconds.");
      if (!encoded || encoded.length > 8000000) throw new Error("The recording is missing or too large. Please try again.");
      const bytes = Utilities.base64Decode(encoded);
      const type = clean_(p.content_type || "audio/webm", 80);
      const extension = type.indexOf("mp4") >= 0 ? "m4a" : "webm";
      const blob = Utilities.newBlob(bytes, type, "Roat voice message - " + name + "." + extension);
      const folder = DriveApp.getFolderById(requiredProp_("VOICE_FOLDER_ID"));
      const file = folder.createFile(blob);
      ss.getSheetByName("VoiceMessages").appendRow([now, name, file.getId(), file.getName(), duration, type]);
      return reply_(true, "Your message is saved. Roat will hear it at the party!");
    }

    throw new Error("Unknown submission.");
  } catch (err) {
    return reply_(false, err.message || "Something went wrong. Please try again.");
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const callback = /^[a-zA-Z_$][\w.$]*$/.test(p.callback || "") ? p.callback : "";
  try {
    let result;
    if (p.action === "sendCode") {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      CacheService.getScriptCache().put("admin_code", code, 600);
      MailApp.sendEmail(ADMIN_EMAIL, "Roat's Bas Mitzvah dashboard sign-in", "Your sign-in code is " + code + ". It expires in 10 minutes.");
      result = { ok: true, message: "A sign-in code was sent." };
    } else if (p.action === "verifyCode") {
      const expected = CacheService.getScriptCache().get("admin_code");
      if (!expected || p.code !== expected) throw new Error("That code is incorrect or expired.");
      CacheService.getScriptCache().remove("admin_code");
      const token = Utilities.getUuid() + Utilities.getUuid();
      CacheService.getScriptCache().put("admin_" + token, ADMIN_EMAIL, 3600);
      result = { ok: true, token: token };
    } else if (p.action === "adminData") {
      requireAdmin_(p.token);
      const ss = SpreadsheetApp.openById(requiredProp_("SPREADSHEET_ID"));
      result = {
        ok: true,
        rsvps: readRows_(ss.getSheetByName("RSVPs")),
        songs: readRows_(ss.getSheetByName("Songs")),
        voices: readRows_(ss.getSheetByName("VoiceMessages")).map(row => ({
          timestamp: row[0], name: row[1], fileId: row[2], fileName: row[3],
          duration: row[4], contentType: row[5],
          driveUrl: "https://drive.google.com/uc?export=download&id=" + encodeURIComponent(row[2])
        }))
      };
    } else {
      throw new Error("Unknown action.");
    }
    return jsonp_(result, callback);
  } catch (err) {
    return jsonp_({ ok: false, error: err.message || "Request failed." }, callback);
  }
}

function readRows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  return values.map(row => row.map(value => value instanceof Date ? value.toISOString() : value));
}
function requireAdmin_(token) {
  if (!token || CacheService.getScriptCache().get("admin_" + token) !== ADMIN_EMAIL) {
    throw new Error("Please sign in again.");
  }
}
function requiredProp_(key) {
  const value = PROP.getProperty(key);
  if (!value) throw new Error("Run setup() once in the Apps Script editor.");
  return value;
}
function clean_(value, max) {
  return String(value || "").trim().slice(0, max);
}
function reply_(ok, message) {
  const safe = JSON.stringify({ ok: ok, message: message }).replace(/</g, "\\u003c");
  return HtmlService.createHtmlOutput("<!doctype html><script>window.parent.postMessage(" + safe + ", '*');</script>");
}
function jsonp_(data, callback) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return ContentService.createTextOutput(callback ? callback + "(" + json + ");" : json)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
