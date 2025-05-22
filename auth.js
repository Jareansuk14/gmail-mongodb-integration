//GMAIL-MONGODB-INTEGRATION/auth.js
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// สร้าง OAuth2 client
const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// ตรวจสอบว่ามี token อยู่แล้วหรือไม่
const TOKEN_PATH = path.join(__dirname, 'token.json');

async function getAuthUrl() {
  const scopes = ['https://www.googleapis.com/auth/gmail.readonly'];
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });
}

async function getToken(code) {
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  
  // บันทึก token ไว้ใช้ในอนาคต
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  return tokens;
}

async function authorize() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
      oAuth2Client.setCredentials(tokens);
      return oAuth2Client;
    } else {
      console.log('No token found. Please authenticate first.');
      return null;
    }
  } catch (error) {
    console.error('Error loading token:', error);
    return null;
  }
}

module.exports = { getAuthUrl, getToken, authorize };