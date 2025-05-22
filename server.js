//GMAIL-MONGODB-INTEGRATION/server.js
const express = require('express');
const { getAuthUrl, getToken } = require('./auth');
const { startScheduler } = require('./scheduler');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', async (req, res) => {
  const authUrl = await getAuthUrl();
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Gmail to MongoDB</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f5f5f5;
          margin: 0;
          padding: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
        }
        .login-container {
          text-align: center;
        }
        .google-btn {
          display: inline-flex;
          align-items: center;
          background-color: #fff;
          color: #757575;
          border: 1px solid #ddd;
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          padding: 0;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .google-btn:hover {
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          transform: translateY(-1px);
        }
        .google-btn:active {
          background-color: #f5f5f5;
          transform: translateY(0);
        }
        .google-icon-wrapper {
          width: 40px;
          height: 40px;
          display: flex;
          justify-content: center;
          align-items: center;
          border-right: 1px solid #ddd;
        }
        .google-icon {
          width: 18px;
          height: 18px;
        }
        .btn-text {
          padding: 0 16px;
          font-size: 14px;
          font-weight: 500;
        }
      </style>
    </head>
    <body>
      <div class="login-container">
        <a href="${authUrl}" class="google-btn">
          <div class="google-icon-wrapper">
            <svg class="google-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
          </div>
          <span class="btn-text">Sign in with Google</span>
        </a>
      </div>
    </body>
    </html>
  `);
});

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    await getToken(code);
    res.send(`
      <h1>Authentication Successful!</h1>
      <p>You can now close this window. The scheduler will start checking for new emails.</p>
      <script>
        setTimeout(() => {
          window.close();
        }, 5000);
      </script>
    `);
    
    // เริ่มต้นตัวจับเวลาหลังจาก authentication สำเร็จ
    startScheduler();
  } catch (error) {
    console.error('Error during authentication:', error);
    res.status(500).send('Authentication failed. Please try again.');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});