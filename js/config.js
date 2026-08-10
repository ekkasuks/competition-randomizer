/*
 * config.js — ตั้งค่าระบบ
 * ------------------------------------------------------------------
 * โหมดการทำงาน:
 *   - ถ้า GAS_URL เป็นค่าว่าง ("")  -> ใช้ localStorage (ทดลองในเครื่องเดียว)
 *   - ถ้าใส่ GAS_URL               -> ใช้ Google Apps Script (โหวตหลายเครื่องได้จริง)
 *
 * วิธีเปิดใช้งานจริง:
 *   1) ทำตามคู่มือใน README.md เพื่อ deploy Google Apps Script
 *   2) นำ URL ของ Web App (ลงท้าย /exec) มาวางในช่อง GAS_URL ด้านล่าง
 *   3) ตั้ง ADMIN_KEY ให้ตรงกับที่ตั้งไว้ใน Apps Script (Script Property: ADMIN_KEY)
 */
const CONFIG = {
  // วาง URL ของ Google Apps Script Web App ที่นี่ (ลงท้ายด้วย /exec)
  GAS_URL: "",

  // รหัสผ่านแอดมิน (ต้องตรงกับที่ตั้งใน Apps Script เมื่อใช้โหมด GAS)
  ADMIN_KEY: "banmai2569",

  // ชื่อระบบที่แสดงบนหัวเว็บ
  APP_NAME: "ระบบสุ่มและโหวตการแข่งขัน",
  SCHOOL_NAME: "โรงเรียนบ้านใหม่",
};
