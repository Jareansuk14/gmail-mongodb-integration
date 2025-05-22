//GMAIL-MONGODB-INTEGRATION/gmail.js
const { google } = require('googleapis');

// ฟังก์ชันสำหรับประมวลผลเนื้อหา body
function processEmailBody(body) {
  if (!body) return '';
  
  try {
    // แยกบรรทัดของข้อความ
    const lines = body.split('\n');
    
    // หาบรรทัดที่มีข้อมูลธุรกรรม (มีคำว่า "เงินเข้า" หรือ "เงินออก" หรือ "คงเหลือ")
    for (let line of lines) {
      line = line.trim();
      
      // ตรวจสอบว่าบรรทัดนี้มีข้อมูลธุรกรรมหรือไม่
      if (line.includes('เงินเข้า') || line.includes('เงินออก') || line.includes('คงเหลือ')) {
        // ตัดส่วนที่ไม่ต้องการออก (เช่น "From: KBank")
        if (line.startsWith('From:')) {
          continue;
        }
        
        // ตรวจสอบว่ามีรูปแบบวันที่และเวลาหรือไม่ (เช่น 22/05/68 09:22)
        const dateTimePattern = /\d{2}\/\d{2}\/\d{2}\s+\d{2}:\d{2}/;
        if (dateTimePattern.test(line)) {
          return line;
        }
      }
    }
    
    // ถ้าไม่เจอด้วยวิธีข้างต้น ลองหาด้วย pattern อื่น
    for (let line of lines) {
      line = line.trim();
      
      // ตรวจสอบรูปแบบข้อความธนาคาร (มีวันที่ เวลา และจำนวนเงิน)
      const bankPattern = /\d{2}\/\d{2}\/\d{2}\s+\d{2}:\d{2}.*(?:เงินเข้า|เงินออก|คงเหลือ).*\d+\.\d{2}/;
      if (bankPattern.test(line)) {
        return line;
      }
    }
    
    // ถ้ายังไม่เจอ ลองหาบรรทัดที่มี pattern การเงิน
    for (let line of lines) {
      line = line.trim();
      
      // หาบรรทัดที่มีทั้งวันที่และจำนวนเงิน
      if (line.includes('/') && line.includes(':') && line.includes('.') && 
          (line.includes('บ.') || line.includes('บาท'))) {
        // ตรวจสอบว่าไม่ใช่ส่วนลิงก์หรือส่วนอื่นๆ
        if (!line.includes('http') && !line.includes('www') && 
            !line.includes('Forward SMS') && !line.includes('Received At:')) {
          return line;
        }
      }
    }
    
    return body.trim(); // ถ้าไม่เจอให้คืนค่า body เดิม
  } catch (error) {
    console.error('Error processing email body:', error);
    return body;
  }
}

// ฟังก์ชันสำหรับแยกข้อมูลธุรกรรม
function parseTransactionData(transactionText) {
  if (!transactionText) return null;
  
  try {
    // ตัวอย่าง: "22/05/68 09:22 บช X-0442 เงินเข้า 10.00 คงเหลือ 20.01 บ."
    
    // แยกวันที่และเวลา
    const dateTimeMatch = transactionText.match(/(\d{2}\/\d{2}\/\d{2})\s+(\d{2}:\d{2})/);
    const date = dateTimeMatch ? dateTimeMatch[1] : '';
    const time = dateTimeMatch ? dateTimeMatch[2] : '';
    
    // แยกประเภทการทำรายการ
    const transactionType = transactionText.includes('เงินเข้า') ? 'เงินเข้า' : 
                           transactionText.includes('เงินออก') ? 'เงินออก' : 'อื่นๆ';
    
    // แยกจำนวนเงิน
    const amountMatch = transactionText.match(/(?:เงินเข้า|เงินออก)\s+([\d,]+\.?\d*)/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '')) : 0;
    
    // แยกยอดคงเหลือ
    const balanceMatch = transactionText.match(/คงเหลือ\s+([\d,]+\.?\d*)/);
    const balance = balanceMatch ? parseFloat(balanceMatch[1].replace(',', '')) : 0;
    
    // แยกรหัสอ้างอิง
    const refMatch = transactionText.match(/([A-Z]-\d+)/);
    const reference = refMatch ? refMatch[1] : '';
    
    return {
      date,
      time,
      transactionType,
      amount,
      balance,
      reference,
      originalText: transactionText
    };
  } catch (error) {
    console.error('Error parsing transaction data:', error);
    return {
      originalText: transactionText
    };
  }
}

async function fetchEmails(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  
  try {
    // ค้นหาอีเมลจากผู้ส่งชื่อ "Forward SMS"
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'from:"Forward SMS"',
      maxResults: 10  // จำนวนอีเมลสูงสุดที่ต้องการดึง
    });
    
    const messages = response.data.messages || [];
    
    // ถ้าไม่มีข้อความใหม่
    if (messages.length === 0) {
      return [];
    }
    
    // ดึงรายละเอียดของแต่ละอีเมล
    const emails = await Promise.all(
      messages.map(async (message) => {
        const email = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });
        
        // แปลงข้อมูลอีเมลให้อยู่ในรูปแบบที่ใช้งานง่าย
        const headers = email.data.payload.headers;
        const subject = headers.find(header => header.name === 'Subject')?.value || '';
        const from = headers.find(header => header.name === 'From')?.value || '';
        const date = headers.find(header => header.name === 'Date')?.value || '';
        
        let body = '';
        
        // ดึงเนื้อหาของอีเมล
        if (email.data.payload.parts) {
          // กรณีมีหลาย parts (HTML และ plain text)
          const textPart = email.data.payload.parts.find(part => part.mimeType === 'text/plain');
          if (textPart && textPart.body.data) {
            body = Buffer.from(textPart.body.data, 'base64').toString();
          }
        } else if (email.data.payload.body.data) {
          // กรณีมี part เดียว
          body = Buffer.from(email.data.payload.body.data, 'base64').toString();
        }
        
        // ประมวลผลเนื้อหา body เพื่อสกัดเฉพาะข้อมูลที่ต้องการ
        const processedBody = processEmailBody(body);
        
        // แยกข้อมูลธุรกรรม
        const transactionData = parseTransactionData(processedBody);
        
        return {
          id: message.id,
          threadId: email.data.threadId,
          subject,
          from,
          date,
          originalBody: body,  // เก็บ body เดิมไว้สำหรับอ้างอิง
          processedBody,       // เก็บเฉพาะข้อมูลที่ต้องการ
          transactionData,     // ข้อมูลธุรกรรมที่แยกแล้ว
          receivedAt: new Date(),
          processed: false
        };
      })
    );
    
    return emails;
  } catch (error) {
    console.error('Error fetching emails:', error);
    throw error;
  }
}

module.exports = { fetchEmails };