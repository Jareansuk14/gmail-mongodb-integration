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
    prompt: 'consent' // บังคับให้แสดง consent screen เพื่อให้ได้ refresh_token
  });
}

async function getToken(code) {
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  
  // บันทึก token ไว้ใช้ในอนาคต
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log('Token saved successfully!');
  console.log('Access Token expires in:', tokens.expiry_date ? new Date(tokens.expiry_date) : 'Unknown');
  console.log('Has Refresh Token:', !!tokens.refresh_token);
  
  return tokens;
}

async function refreshAccessToken() {
  try {
    const { credentials } = await oAuth2Client.refreshAccessToken();
    oAuth2Client.setCredentials(credentials);
    
    // อัพเดท token ในไฟล์
    const existingTokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
    const updatedTokens = { ...existingTokens, ...credentials };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(updatedTokens, null, 2));
    
    console.log('Access token refreshed successfully!');
    console.log('New expiry time:', new Date(credentials.expiry_date));
    
    return credentials;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw error;
  }
}

async function authorize() {
  try {
    if (!fs.existsSync(TOKEN_PATH)) {
      console.log('No token found. Please authenticate first.');
      return null;
    }

    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oAuth2Client.setCredentials(tokens);

    // ตรวจสอบว่า token หมดอายุหรือไม่
    const now = new Date().getTime();
    const expiryDate = tokens.expiry_date;

    if (expiryDate && expiryDate <= now) {
      console.log('Access token expired. Attempting to refresh...');
      
      if (tokens.refresh_token) {
        await refreshAccessToken();
      } else {
        console.log('No refresh token available. Please re-authenticate.');
        return null;
      }
    } else if (expiryDate) {
      const timeLeft = Math.round((expiryDate - now) / (1000 * 60));
      console.log(`Access token valid for ${timeLeft} more minutes`);
    }

    return oAuth2Client;
  } catch (error) {
    console.error('Error in authorization:', error);
    
    // ถ้าเกิดข้อผิดพลาด ลองใช้ refresh token
    try {
      const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
      if (tokens.refresh_token) {
        oAuth2Client.setCredentials(tokens);
        await refreshAccessToken();
        return oAuth2Client;
      }
    } catch (refreshError) {
      console.error('Failed to refresh token:', refreshError);
    }
    
    return null;
  }
}

// ฟังก์ชันตรวจสอบสถานะ token
async function checkTokenStatus() {
  try {
    if (!fs.existsSync(TOKEN_PATH)) {
      return { status: 'no_token' };
    }

    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
    const now = new Date().getTime();
    const expiryDate = tokens.expiry_date;

    if (!expiryDate) {
      return { status: 'unknown_expiry', hasRefreshToken: !!tokens.refresh_token };
    }

    const timeLeft = Math.round((expiryDate - now) / (1000 * 60));
    
    if (expiryDate <= now) {
      return { 
        status: 'expired', 
        hasRefreshToken: !!tokens.refresh_token,
        expiredMinutes: Math.abs(timeLeft)
      };
    }

    return { 
      status: 'valid', 
      minutesLeft: timeLeft,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: new Date(expiryDate)
    };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}

module.exports = { 
  getAuthUrl, 
  getToken, 
  authorize, 
  refreshAccessToken,
  checkTokenStatus 
};