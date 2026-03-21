const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const tokenPath = path.join(require('os').homedir(), 'Library/Application Support/stepler/step-gcal-token.json');

async function test() {
  try {
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials(token);
    
    try {
      const info = await oauth2Client.getTokenInfo(token.access_token);
      console.log("Token info email:", info.email);
    } catch(err) {
      console.log("Token info error:", err.message);
    }
    
    try {
      const calendar = google.calendar({version: 'v3', auth: oauth2Client});
      const res = await calendar.calendars.get({calendarId: 'primary'});
      console.log("Calendar primary id (email):", res.data.id);
    } catch(err) {
      console.log("Calendar get error:", err.message);
    }
    
  } catch (e) {
    console.log("Error:", e.message);
  }
}

test();
