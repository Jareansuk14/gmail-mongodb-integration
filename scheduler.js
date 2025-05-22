// GMAIL-MONGODB-INTEGRATION/scheduler.js
const cron = require('node-cron');
const { authorize } = require('./auth');
const { fetchEmails } = require('./gmail');
const { saveEmails } = require('./db');

async function checkNewEmails() {
  console.log('🔍 Checking for new emails from Forward SMS...');
  global.lastEmailCheck = new Date().toISOString(); // เก็บเวลาการเช็คล่าสุด
  
  try {
    const auth = await authorize();
    if (!auth) {
      console.log('Authentication required. Please run the server and authenticate first.');
      return;
    }
    
    const emails = await fetchEmails(auth);
    console.log(`📧 Found ${emails.length} emails from Forward SMS`);
    
    if (emails.length > 0) {
      // แสดงข้อมูลที่ประมวลผลแล้ว
      emails.forEach((email, index) => {
        console.log(`\n--- Email ${index + 1} ---`);
        console.log('Subject:', email.subject);
        console.log('Processed Content:', email.processedBody);
        
        if (email.transactionData && email.transactionData.date) {
          console.log('Transaction Details:');
          console.log('  Date:', email.transactionData.date);
          console.log('  Time:', email.transactionData.time);
          console.log('  Type:', email.transactionData.transactionType);
          console.log('  Amount:', email.transactionData.amount);
          console.log('  Balance:', email.transactionData.balance);
          console.log('  Reference:', email.transactionData.reference);
        }
      });
      
      const result = await saveEmails(emails);
      console.log(`\n💾 ${result.insertedCount} new emails saved to MongoDB`);
    }
    
    return { success: true, emailsFound: emails.length };
  } catch (error) {
    console.error('❌ Error in email checking process:', error);
    return { success: false, error: error.message };
  }
}

function startScheduler() {
  // ตั้งค่าให้ทำงานทุก 3 นาที
  cron.schedule('*/3 * * * *', checkNewEmails);
  console.log('⏰ Scheduler started. Checking for new emails every 3 minutes...');
  
  // ทำงานครั้งแรกทันที
  checkNewEmails();
}

// Export ฟังก์ชันเพื่อให้ server.js เรียกใช้ได้
module.exports = { startScheduler, checkNewEmails };