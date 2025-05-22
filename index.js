//GMAIL-MONGODB-INTEGRATION/index.js
const { startScheduler } = require('./scheduler');
const server = require('./server');
const { authorize } = require('./auth');

async function start() {
  try {
    // ตรวจสอบว่ามี token อยู่แล้วหรือไม่
    const auth = await authorize();
    if (auth) {
      console.log('Already authenticated. Starting scheduler...');
      startScheduler();
    } else {
      console.log('Please access the web server and authenticate first.');
    }
  } catch (error) {
    console.error('Error starting application:', error);
  }
}

start();