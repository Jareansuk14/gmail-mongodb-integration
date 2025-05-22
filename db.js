//GMAIL-MONGODB-INTEGRATION/db.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

let client = null;

async function connectDB() {
  try {
    if (client) return client.db();
    
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    console.log('Connected to MongoDB');
    return client.db();
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

async function saveEmails(emails) {
  if (emails.length === 0) {
    return { insertedCount: 0 };
  }
  
  try {
    const db = await connectDB();
    const collection = db.collection('emails');
    
    // ตรวจสอบว่ามีอีเมลที่บันทึกแล้วหรือไม่
    const existingIds = (await collection.find({
      id: { $in: emails.map(email => email.id) }
    }).toArray()).map(doc => doc.id);
    
    // กรองเฉพาะอีเมลที่ยังไม่ได้บันทึก
    const newEmails = emails.filter(email => !existingIds.includes(email.id));
    
    if (newEmails.length === 0) {
      return { insertedCount: 0 };
    }
    
    // บันทึกอีเมลใหม่ลงใน MongoDB
    const result = await collection.insertMany(newEmails);
    console.log(`${result.insertedCount} emails saved to MongoDB`);
    return result;
  } catch (error) {
    console.error('Error saving emails to MongoDB:', error);
    throw error;
  }
}

module.exports = { connectDB, saveEmails };