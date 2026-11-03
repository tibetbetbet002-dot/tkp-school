/*
 * ตั้งค่าการเชื่อมต่อระบบ
 * - ปล่อย API_URL ว่างไว้ = โหมดทดลอง (เก็บข้อมูลในเครื่องนี้เท่านั้น ใช้ทดลองระบบได้ทันที)
 * - ใส่ URL ของ Google Apps Script Web App (ลงท้ายด้วย /exec) = ใช้งานจริง ข้อมูลเก็บใน Google Sheets
 *   ดูขั้นตอนในไฟล์ "คู่มือติดตั้ง.md"
 */
window.APP_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyTeVavIlYPz95FHiYjObsOA1oYO0hTbt80EUYLPVgb-EeUDpxg7wzgXvAYlYCCFwE4/exec'
};
