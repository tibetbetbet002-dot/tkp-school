/*
 * แกนกลางระบบลงเวลา (Core logic)
 * ไฟล์นี้ใช้ร่วมกัน 2 ที่:
 *   1) ในเบราว์เซอร์ (โหมดทดลอง ใช้ localStorage)
 *   2) ใน Google Apps Script — คัดลอกทั้งไฟล์ไปเป็น Core.gs
 * ห้ามใช้ API ที่มีเฉพาะเบราว์เซอร์หรือเฉพาะ Apps Script ในไฟล์นี้
 */

var CORE_DEFAULT_SETTINGS = {
  schoolName: 'โรงเรียนบ้านทุ่งข้าวพวง',
  schoolNameEn: 'Ban Thung Khao Phuang School',
  motto: 'เรียนดี มีวินัย ใฝ่คุณธรรม',
  vision: 'มุ่งพัฒนาผู้เรียนให้มีความรู้คู่คุณธรรม มีทักษะการเรียนรู้ในศตวรรษที่ 21 ภูมิใจในท้องถิ่น และดำรงชีวิตตามหลักปรัชญาของเศรษฐกิจพอเพียง',
  mission: '1. จัดการศึกษาให้ผู้เรียนมีคุณภาพตามมาตรฐานการศึกษา\n2. ส่งเสริมให้ผู้เรียนมีคุณธรรม จริยธรรม และค่านิยมที่พึงประสงค์\n3. พัฒนาครูและบุคลากรให้มีความรู้ความสามารถในการจัดการเรียนรู้\n4. บริหารจัดการโดยการมีส่วนร่วมของชุมชนและภาคีเครือข่าย\n5. ส่งเสริมการเรียนรู้ตามหลักปรัชญาของเศรษฐกิจพอเพียงและภูมิปัญญาท้องถิ่น',
  goals: '',
  identity: '',
  uniqueness: '',
  schoolColors: 'ม่วง - เหลือง - ขาว',
  history: '',
  about: 'โรงเรียนบ้านทุ่งข้าวพวงเป็นโรงเรียนประถมศึกษาที่อยู่คู่ชุมชน จัดการศึกษาตั้งแต่ระดับปฐมวัยถึงประถมศึกษาปีที่ 6 โดยร่วมมือกับผู้ปกครองและชุมชนในการพัฒนาผู้เรียนอย่างรอบด้าน',
  address: 'ตำบลทุ่งข้าวพวง อำเภอเชียงดาว จังหวัดเชียงใหม่ 50170',
  affiliation: 'สังกัดสำนักงานเขตพื้นที่การศึกษาประถมศึกษาเชียงใหม่ เขต 3',
  phone: '',
  email: '',
  facebook: 'https://www.facebook.com/BanThungKhaoPhuang.school',
  mapUrl: 'https://maps.app.goo.gl/VvBob9aD36QCa1oY9',
  oitUrl: 'https://sites.google.com/pracharath.ac.th/tkpsc/',
  announcement: '',
  directorName: 'นางสาวประภาพร กิติ',
  directorTitle: 'ผู้อำนวยการโรงเรียนบ้านทุ่งข้าวพวง',
  directorPhoto: 'assets/photos/director.jpg',
  directorMessage: '',
  studentsCount: '423',
  classesCount: '8',
  founded: '',
  logoUrl: '',
  heroImage: '',
  lat: '19.554926',
  lng: '98.958191',
  radius: '200',
  gpsMaxAccuracy: '150',
  workStart: '08:00',
  workEnd: '16:30',
  faceThreshold: '0.5',
  liveness: 'on',
  lineEachCheckin: 'off',
  lineLeave: 'off',
  lineDaily: 'off',
  lineDailyTime: '08:30',
  holidays: '',
  adminPassword: 'admin1234'
};

var CORE_PUBLIC_KEYS = ['schoolName', 'schoolNameEn', 'motto', 'vision', 'mission', 'goals', 'identity', 'uniqueness', 'schoolColors', 'history',
  'about', 'address', 'affiliation', 'phone', 'email', 'facebook', 'mapUrl', 'oitUrl', 'announcement',
  'directorName', 'directorTitle', 'directorPhoto', 'directorMessage', 'studentsCount', 'classesCount', 'founded', 'logoUrl', 'heroImage',
  'lat', 'lng', 'radius', 'gpsMaxAccuracy', 'workStart', 'workEnd', 'liveness', 'holidays'];

var LEAVE_TYPES = ['ลาป่วย', 'ลากิจส่วนตัว', 'ลาพักผ่อน', 'ลาคลอดบุตร', 'ไปราชการ', 'อื่นๆ'];
var NEWS_CATEGORIES = ['ข่าวประชาสัมพันธ์', 'กิจกรรม', 'ประกาศ', 'ผลงาน/รางวัล'];
var LINK_CATEGORIES = ['ลิงก์หน่วยงาน', 'เอกสารดาวน์โหลด', 'บริการออนไลน์'];

// ข้อมูลที่ "ผู้จัดการเนื้อหา" แก้ได้ (แก้ได้เฉพาะหน้าเว็บ ไม่เกี่ยวกับระบบลงเวลา)
var SITE_KEYS = ['schoolName', 'schoolNameEn', 'motto', 'vision', 'mission', 'goals', 'identity', 'uniqueness', 'schoolColors', 'history',
  'about', 'address', 'affiliation', 'phone', 'email', 'facebook', 'mapUrl', 'oitUrl', 'announcement', 'directorName', 'directorTitle',
  'directorPhoto', 'directorMessage', 'studentsCount', 'classesCount', 'founded', 'logoUrl', 'heroImage'];
var ADMIN_ROLES = { admin: 'ผู้ดูแลระบบ', editor: 'ผู้จัดการเนื้อหาเว็บ' };

/* SHA-256 (เขียนเองเพื่อให้ใช้ได้ทั้งเบราว์เซอร์และ Apps Script แบบไม่ต้องรอ) */
function coreSha256(str) {
  var ascii = unescape(encodeURIComponent(str));
  function rr(v, n) { return (v >>> n) | (v << (32 - n)); }
  var maxWord = Math.pow(2, 32), i, j, result = '', words = [], bitLen = ascii.length * 8;
  var hash = [], k = [], count = 0, composite = {};
  for (var c = 2; count < 64; c++) {
    if (!composite[c]) {
      for (i = 0; i < 313; i += c) composite[i] = c;
      hash[count] = (Math.pow(c, .5) * maxWord) | 0;
      k[count++] = (Math.pow(c, 1 / 3) * maxWord) | 0;
    }
  }
  hash = hash.slice(0, 8);
  ascii += '\x80';
  while (ascii.length % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) words[i >> 2] |= ascii.charCodeAt(i) << ((3 - i) % 4) * 8;
  words[words.length] = (bitLen / maxWord) | 0;
  words[words.length] = bitLen;
  for (j = 0; j < words.length;) {
    var w = words.slice(j, j += 16), old = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
      var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
        (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
      var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(t1 + t2) | 0].concat(hash);
      hash[4] = (hash[4] + t1) | 0;
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
  }
  for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { var b = (hash[i] >> (j * 8)) & 255; result += (b < 16 ? '0' : '') + b.toString(16); }
  return result;
}
function corePasswordHash(password, salt) {
  var h = salt + ':' + password;
  for (var i = 0; i < 300; i++) h = coreSha256(salt + h); // วนหลายรอบให้เดารหัสยากขึ้น
  return h;
}

function createCore(db, env) {
  var TZ_MS = 7 * 3600 * 1000; // เวลาประเทศไทย UTC+7

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function nowBkk() {
    var t = new Date(env.now().getTime() + TZ_MS);
    return {
      date: t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()),
      time: pad(t.getUTCHours()) + ':' + pad(t.getUTCMinutes()) + ':' + pad(t.getUTCSeconds()),
      iso: t.toISOString().replace('Z', '+07:00')
    };
  }
  function toMin(hhmm) { var p = String(hhmm || '0:0').split(':'); return Number(p[0]) * 60 + Number(p[1] || 0); }
  function dateObj(s) { var p = String(s).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function dateStr(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(s, n) { var d = dateObj(s); d.setUTCDate(d.getUTCDate() + n); return dateStr(d); }
  function uid() { return Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }

  function settings() {
    var s = db.settings() || {}, out = {};
    for (var k in CORE_DEFAULT_SETTINGS) out[k] = (s[k] === undefined || s[k] === null) ? CORE_DEFAULT_SETTINGS[k] : String(s[k]);
    return out;
  }
  function holidayMap(s) {
    var map = {};
    String(s.holidays || '').split(/[\n,]+/).forEach(function (line) {
      var m = line.trim().match(/^(\d{4}-\d{2}-\d{2})\s*(.*)$/);
      if (m) map[m[1]] = m[2] || 'วันหยุด';
    });
    return map;
  }
  function isWorkDay(date, s, hol) {
    var dow = dateObj(date).getUTCDay();
    return dow !== 0 && dow !== 6 && !hol[date];
  }
  function workDaysBetween(from, to, s) {
    var hol = holidayMap(s), n = 0;
    for (var d = from; d <= to; d = addDays(d, 1)) if (isWorkDay(d, s, hol)) n++;
    return n;
  }

  function haversine(lat1, lng1, lat2, lng2) {
    var R = 6371000, toR = Math.PI / 180;
    var dLat = (lat2 - lat1) * toR, dLng = (lng2 - lng1) * toR;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  function faceDistance(a, b) {
    var sum = 0;
    for (var i = 0; i < a.length; i++) { var d = a[i] - b[i]; sum += d * d; }
    return Math.sqrt(sum);
  }
  function parseFaces(t) { try { var f = JSON.parse(t.faces || '[]'); return Array.isArray(f) ? f : []; } catch (e) { return []; } }
  function isActive(t) { return String(t.active) !== 'false' && String(t.active) !== '0'; }

  function teachers() {
    return db.rows('teachers').filter(isActive).sort(function (a, b) { return (Number(a.order) || 999) - (Number(b.order) || 999); });
  }
  function fail(msg, code) { var e = new Error(msg); e.code = code || 'ERROR'; throw e; }
  // ---------- บัญชีผู้ดูแล (ชื่อผู้ใช้ + รหัสผ่าน) ----------
  function admins() { return db.rows('admins'); }
  function findAdmin(username) {
    var u = String(username || '').trim().toLowerCase();
    return admins().filter(function (a) { return String(a.username).toLowerCase() === u; })[0];
  }
  function checkPasswordRule(pw) {
    pw = String(pw || '');
    if (pw.length < 8 || !/[0-9]/.test(pw) || !/[^0-9]/.test(pw)) fail('รหัสผ่านต้องยาวอย่างน้อย 8 ตัว และมีทั้งตัวอักษรและตัวเลข');
  }
  function setPassword(user, pw) {
    user.salt = uid() + Math.random().toString(36).slice(2);
    user.hash = corePasswordHash(pw, user.salt);
  }
  function authAdmin(req) {
    var all = admins();
    // ยังไม่มีบัญชีเลย: ใช้บัญชีเริ่มต้น admin + รหัสในแผ่นงานตั้งค่า แล้วบังคับเปลี่ยนรหัส
    if (!all.length) {
      if (String(req.username || '').toLowerCase() === 'admin' && req.password && req.password === settings().adminPassword)
        return { id: '', username: 'admin', name: 'ผู้ดูแลระบบ', role: 'admin', mustChange: true, bootstrap: true };
      fail('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'AUTH');
    }
    var u = findAdmin(req.username), now = env.now().getTime();
    if (!u || String(u.active) === 'false') fail('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'AUTH');
    if (Number(u.lockUntil) > now) fail('บัญชีถูกล็อกชั่วคราวเพราะใส่รหัสผิดหลายครั้ง ลองใหม่ในอีก ' + Math.ceil((Number(u.lockUntil) - now) / 60000) + ' นาที', 'AUTH');
    if (corePasswordHash(String(req.password || ''), u.salt) !== u.hash) {
      u.failCount = (Number(u.failCount) || 0) + 1;
      if (u.failCount >= 5) { u.lockUntil = now + 15 * 60000; u.failCount = 0; }
      db.put('admins', 'id', u);
      fail('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'AUTH');
    }
    if (Number(u.failCount) || Number(u.lockUntil)) { u.failCount = 0; u.lockUntil = ''; db.put('admins', 'id', u); }
    return { id: u.id, username: u.username, name: u.name, email: u.email || '', role: u.role === 'editor' ? 'editor' : 'admin', mustChange: String(u.mustChange) === 'true' };
  }
  function checkEmail(email) {
    email = String(email || '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('รูปแบบอีเมลไม่ถูกต้อง: ' + email);
  }

  // ---------- ลืมรหัสผ่าน: ส่งรหัสยืนยันทางอีเมลที่ผูกกับบัญชี ----------
  var RESET_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function forgotPassword(req) {
    var key = String(req.username || '').trim().toLowerCase(), now = env.now().getTime();
    var generic = { ok: true, message: 'ถ้าข้อมูลถูกต้อง ระบบได้ส่งรหัสยืนยันไปที่อีเมลของบัญชีแล้ว (หมดอายุใน 30 นาที)' };
    if (!key) fail('กรุณากรอกชื่อผู้ใช้หรืออีเมล');
    var u = admins().filter(function (a) { return String(a.username).toLowerCase() === key || String(a.email || '').toLowerCase() === key; })[0];
    // ไม่บอกว่าบัญชีมีอยู่จริงหรือไม่ เพื่อไม่ให้คนนอกใช้เดาชื่อผู้ใช้
    if (!u || !u.email || String(u.active) === 'false') return generic;
    if (Number(u.resetExpire) - 28 * 60000 > now) return generic; // ขอซ้ำได้ทุก 2 นาที
    if (!env.sendMail) fail('ระบบส่งอีเมลยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบคนอื่นให้รีเซ็ตรหัสให้');
    var code = '';
    for (var i = 0; i < 8; i++) code += RESET_CHARS.charAt(Math.floor(Math.random() * RESET_CHARS.length));
    u.resetHash = coreSha256(u.salt + ':reset:' + code);
    u.resetExpire = now + 30 * 60000;
    db.put('admins', 'id', u);
    var name = settings().schoolName;
    env.sendMail(u.email, 'รหัสรีเซ็ตรหัสผ่าน - ' + name,
      'สวัสดีคุณ ' + u.name + '\n\nมีการขอรีเซ็ตรหัสผ่านสำหรับบัญชี "' + u.username + '" ของระบบผู้ดูแลเว็บไซต์' + name +
      '\n\nรหัสยืนยัน: ' + code + '\n(ใช้ได้ภายใน 30 นาที)\n\nนำรหัสนี้ไปกรอกที่หน้า "ลืมรหัสผ่าน" แล้วตั้งรหัสผ่านใหม่\nถ้าคุณไม่ได้ขอรีเซ็ตรหัสผ่าน ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ');
    return generic;
  }
  function resetPassword(req) {
    var u = findAdmin(req.username), now = env.now().getTime();
    var bad = function () { fail('รหัสยืนยันไม่ถูกต้องหรือหมดอายุ กรุณาขอรหัสใหม่'); };
    if (!u || !u.resetHash || Number(u.resetExpire) < now) bad();
    var code = String(req.code || '').trim().toUpperCase();
    if (coreSha256(u.salt + ':reset:' + code) !== u.resetHash) {
      u.failCount = (Number(u.failCount) || 0) + 1;
      if (u.failCount >= 5) { u.resetHash = ''; u.resetExpire = ''; u.failCount = 0; } // เดาผิด 5 ครั้ง รหัสยืนยันใช้ไม่ได้
      db.put('admins', 'id', u);
      bad();
    }
    checkPasswordRule(req.newPassword);
    setPassword(u, req.newPassword);
    u.resetHash = ''; u.resetExpire = ''; u.failCount = 0; u.lockUntil = ''; u.mustChange = 'false';
    db.put('admins', 'id', u);
    return { ok: true, username: u.username };
  }

  var EDITOR_ACTIONS = { adminLogin: 1, myPasswordChange: 1, myEmailSave: 1, settingsGet: 1, settingsSave: 1, newsSave: 1, newsDelete: 1,
    eventSave: 1, eventDelete: 1, linkSave: 1, linkDelete: 1, uploadImage: 1 };
  function requireTeacher(req) {
    var t = db.rows('teachers').filter(function (x) { return String(x.id) === String(req.teacherId); })[0];
    if (!t) fail('ไม่พบข้อมูลครู');
    if (String(t.pin) !== String(req.pin)) fail('รหัส PIN ไม่ถูกต้อง', 'AUTH');
    return t;
  }
  function notify(flag, text) {
    if (settings()[flag] === 'on' && env.notify) { try { env.notify(text); } catch (e) { /* ไม่ให้การแจ้งเตือนล้มเหลวกระทบการลงเวลา */ } }
  }

  // ---------- สถานะรายวัน ----------
  function leaveOn(leaves, teacherId, date) {
    for (var i = 0; i < leaves.length; i++) {
      var l = leaves[i];
      if (String(l.teacherId) === String(teacherId) && l.status === 'อนุมัติ' && l.from <= date && date <= l.to) return l;
    }
    return null;
  }
  function dayStatus(t, date, ctx) {
    var s = ctx.s, now = ctx.now;
    if (!isWorkDay(date, s, ctx.hol)) return { code: 'off', label: ctx.hol[date] || 'วันหยุด' };
    var row = ctx.att[date + '|' + t.id];
    var lv = leaveOn(ctx.leaves, t.id, date);
    if (lv) return { code: lv.type === 'ไปราชการ' ? 'official' : 'leave', label: lv.type, leave: lv, row: row };
    if (row && row.timeIn) return { code: row.status === 'สาย' ? 'late' : 'present', label: row.status || 'มา', row: row };
    if (row && row.timeOut) return { code: 'present', label: 'ไม่ได้ลงเวลามา', row: row, missingIn: true };
    if (date < now.date || (date === now.date && toMin(now.time) > toMin(s.workEnd))) return { code: 'absent', label: 'ขาด' };
    if (date > now.date) return { code: 'future', label: '' };
    return { code: 'waiting', label: 'ยังไม่ลงเวลา' };
  }
  function context(from, to) {
    var s = settings(), att = {};
    db.rows('attendance').forEach(function (r) { if (r.date >= from && r.date <= to) att[r.date + '|' + r.teacherId] = r; });
    return { s: s, hol: holidayMap(s), att: att, leaves: db.rows('leaves'), now: nowBkk() };
  }
  function monthRange(month) {
    var p = month.split('-'), last = new Date(Date.UTC(+p[0], +p[1], 0)).getUTCDate();
    return { from: month + '-01', to: month + '-' + pad(last) };
  }

  function daily(date) {
    var ctx = context(date, date);
    var list = teachers().map(function (t) {
      var st = dayStatus(t, date, ctx);
      return {
        id: t.id, name: t.name, position: t.position, status: st.code, label: st.label,
        timeIn: st.row ? st.row.timeIn || '' : '', timeOut: st.row ? st.row.timeOut || '' : '',
        note: st.row ? (st.row.note || '') : (st.leave ? st.leave.reason || '' : '')
      };
    });
    var count = { present: 0, late: 0, leave: 0, official: 0, absent: 0, waiting: 0 };
    list.forEach(function (x) { if (count[x.status] !== undefined) count[x.status]++; });
    return { date: date, workDay: isWorkDay(date, ctx.s, ctx.hol), holiday: ctx.hol[date] || '', list: list, count: count, total: list.length };
  }

  function monthly(month) {
    var r = monthRange(month), ctx = context(r.from, r.to);
    var days = [];
    for (var d = r.from; d <= r.to; d = addDays(d, 1)) days.push(d);
    var trend = days.map(function (d) { return { date: d, present: 0, late: 0, leave: 0, absent: 0, work: isWorkDay(d, ctx.s, ctx.hol) }; });
    var rows = teachers().map(function (t) {
      var c = { workDays: 0, present: 0, late: 0, sick: 0, personal: 0, official: 0, otherLeave: 0, absent: 0, earlyOut: 0, noOut: 0 };
      var detail = days.map(function (d, i) {
        var st = dayStatus(t, d, ctx);
        if (st.code !== 'off' && st.code !== 'future') {
          c.workDays++;
          if (st.code === 'present' || st.code === 'late') {
            c.present++; trend[i].present++;
            if (st.code === 'late') { c.late++; trend[i].late++; }
            if (st.row && st.row.timeOut && toMin(st.row.timeOut) < toMin(ctx.s.workEnd)) c.earlyOut++;
            if (st.row && st.row.timeIn && !st.row.timeOut && d < ctx.now.date) c.noOut++;
          } else if (st.code === 'official') { c.official++; trend[i].leave++; }
          else if (st.code === 'leave') {
            trend[i].leave++;
            if (st.label === 'ลาป่วย') c.sick++; else if (st.label === 'ลากิจส่วนตัว') c.personal++; else c.otherLeave++;
          } else if (st.code === 'absent') { c.absent++; trend[i].absent++; }
        }
        return { date: d, status: st.code, label: st.label, timeIn: st.row ? st.row.timeIn || '' : '', timeOut: st.row ? st.row.timeOut || '' : '' };
      });
      return { id: t.id, name: t.name, position: t.position, count: c, days: detail };
    });
    return { month: month, from: r.from, to: r.to, rows: rows, trend: trend, holidays: ctx.hol };
  }

  function dailySummaryText(date) {
    var d = daily(date), s = settings();
    if (!d.workDay) return '';
    var names = function (code) { return d.list.filter(function (x) { return x.status === code; }).map(function (x) { return '- ' + x.name + (x.timeIn ? ' (' + x.timeIn.slice(0, 5) + ')' : x.label && code !== 'waiting' ? ' (' + x.label + ')' : ''); }).join('\n'); };
    var parts = ['📋 สรุปการลงเวลา ' + s.schoolName, 'วันที่ ' + date,
      '✅ มาปฏิบัติราชการ ' + (d.count.present + d.count.late) + '/' + d.total + ' คน (สาย ' + d.count.late + ')'];
    if (d.count.late) parts.push('⏰ มาสาย\n' + names('late'));
    if (d.count.leave + d.count.official) parts.push('📝 ลา/ไปราชการ\n' + names('leave') + (d.count.leave && d.count.official ? '\n' : '') + names('official'));
    var waiting = d.list.filter(function (x) { return x.status === 'waiting' || x.status === 'absent'; });
    if (waiting.length) parts.push('❔ ยังไม่ลงเวลา\n' + waiting.map(function (x) { return '- ' + x.name; }).join('\n'));
    return parts.join('\n\n');
  }

  // ---------- การลงเวลา ----------
  function checkin(req) {
    var s = settings(), now = nowBkk();
    if (!s.lat || !s.lng) fail('ผู้ดูแลยังไม่ได้ตั้งค่าพิกัดโรงเรียน');
    var lat = Number(req.lat), lng = Number(req.lng), acc = Number(req.accuracy) || 0;
    if (!isFinite(lat) || !isFinite(lng)) fail('ไม่ได้รับตำแหน่ง GPS');
    if (acc > Number(s.gpsMaxAccuracy)) fail('สัญญาณ GPS ยังไม่แม่นยำพอ (±' + Math.round(acc) + ' ม.) กรุณาลองใหม่ในที่โล่ง', 'GPS');
    var dist = haversine(lat, lng, Number(s.lat), Number(s.lng));
    if (dist > Number(s.radius)) fail('คุณอยู่นอกบริเวณโรงเรียน (ห่าง ' + Math.round(dist) + ' ม. อนุญาต ' + s.radius + ' ม.)', 'GPS');

    var desc = req.descriptor;
    if (!desc || desc.length !== 128) fail('ไม่พบข้อมูลใบหน้า');
    var best = null, bestD = 9;
    teachers().forEach(function (t) {
      parseFaces(t).forEach(function (f) { var d = faceDistance(desc, f); if (d < bestD) { bestD = d; best = t; } });
    });
    if (!best || bestD > Number(s.faceThreshold)) fail('ไม่พบใบหน้านี้ในระบบ กรุณาลองใหม่ หรือติดต่อผู้ดูแลเพื่อลงทะเบียนใบหน้า', 'FACE');

    var mode = req.mode === 'out' ? 'out' : 'in';
    var row = db.rows('attendance').filter(function (r) { return r.date === now.date && String(r.teacherId) === String(best.id); })[0];
    var photo = req.photo && env.savePhoto ? env.savePhoto(req.photo, now.date + '_' + best.name + '_' + mode) : '';
    var result = { teacherId: best.id, name: best.name, position: best.position, mode: mode, time: now.time, date: now.date, distance: Math.round(dist), score: Math.round((1 - bestD) * 100) };

    if (mode === 'in') {
      if (row && row.timeIn) { result.already = true; result.time = row.timeIn; result.status = row.status; return result; }
      var late = toMin(now.time.slice(0, 5)) > toMin(s.workStart);
      var status = late ? 'สาย' : 'ตรงเวลา';
      if (row) { row.timeIn = now.time; row.status = status; row.distIn = Math.round(dist); row.photoIn = photo; db.put('attendance', 'id', row); }
      else db.add('attendance', { id: uid(), date: now.date, teacherId: best.id, name: best.name, timeIn: now.time, timeOut: '', status: status, distIn: Math.round(dist), distOut: '', photoIn: photo, photoOut: '', note: '' });
      result.status = status;
    } else {
      var early = toMin(now.time.slice(0, 5)) < toMin(s.workEnd);
      if (row) { row.timeOut = now.time; row.distOut = Math.round(dist); row.photoOut = photo; db.put('attendance', 'id', row); }
      else db.add('attendance', { id: uid(), date: now.date, teacherId: best.id, name: best.name, timeIn: '', timeOut: now.time, status: '', distIn: '', distOut: Math.round(dist), photoIn: '', photoOut: photo, note: 'ไม่ได้ลงเวลามา' });
      result.status = early ? 'กลับก่อนเวลา' : 'ปกติ';
      result.missingIn = !row || !row.timeIn;
    }
    notify('lineEachCheckin', (mode === 'in' ? '🟢 ' : '🔵 ') + best.name + (mode === 'in' ? ' ลงเวลามา ' : ' ลงเวลากลับ ') + now.time.slice(0, 5) + ' น. (' + result.status + ')');
    return result;
  }

  function todayBoard() {
    var now = nowBkk();
    var rows = db.rows('attendance').filter(function (r) { return r.date === now.date; })
      .map(function (r) { return { name: r.name, timeIn: r.timeIn, timeOut: r.timeOut, status: r.status }; })
      .sort(function (a, b) { return String(b.timeOut || b.timeIn).localeCompare(String(a.timeOut || a.timeIn)); });
    return { date: now.date, time: now.time, rows: rows, total: teachers().length };
  }

  // ---------- การลา ----------
  function leaveRequest(req) {
    var t = requireTeacher(req), s = settings();
    if (LEAVE_TYPES.indexOf(req.type) < 0) fail('ประเภทการลาไม่ถูกต้อง');
    if (!req.from || !req.to || req.to < req.from) fail('ช่วงวันที่ไม่ถูกต้อง');
    var item = { id: uid(), teacherId: t.id, name: t.name, type: req.type, from: req.from, to: req.to,
      days: workDaysBetween(req.from, req.to, s), reason: String(req.reason || '').slice(0, 500),
      status: 'รออนุมัติ', createdAt: nowBkk().iso, note: '' };
    db.add('leaves', item);
    notify('lineLeave', '📝 คำขอ' + item.type + '\n' + t.name + '\nวันที่ ' + item.from + (item.to !== item.from ? ' ถึง ' + item.to : '') + ' (' + item.days + ' วันทำการ)\nเหตุผล: ' + (item.reason || '-'));
    return item;
  }

  function teacherHistory(req) {
    var t = requireTeacher(req), month = req.month || nowBkk().date.slice(0, 7);
    var m = monthly(month), mine = m.rows.filter(function (r) { return String(r.id) === String(t.id); })[0];
    var leaves = db.rows('leaves').filter(function (l) { return String(l.teacherId) === String(t.id); })
      .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).slice(0, 30);
    return { teacher: { id: t.id, name: t.name, position: t.position }, month: month, summary: mine, leaves: leaves };
  }

  // ---------- สาธารณะ ----------
  function getPublic() {
    var s = settings(), pub = {};
    CORE_PUBLIC_KEYS.forEach(function (k) { pub[k] = s[k]; });
    var news = db.rows('news').sort(function (a, b) {
      if (String(a.pinned) === 'true' && String(b.pinned) !== 'true') return -1;
      if (String(b.pinned) === 'true' && String(a.pinned) !== 'true') return 1;
      return String(b.date).localeCompare(String(a.date));
    }).slice(0, 30);
    var staff = teachers().map(function (t) { return { id: t.id, name: t.name, position: t.position, photo: t.photo || '', hasFace: parseFaces(t).length > 0 }; });
    var events = db.rows('events').sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    var links = db.rows('links').sort(function (a, b) { return (Number(a.order) || 999) - (Number(b.order) || 999); });
    return { settings: pub, news: news, staff: staff, events: events, links: links, leaveTypes: LEAVE_TYPES,
      newsCategories: NEWS_CATEGORIES, linkCategories: LINK_CATEGORIES, today: nowBkk() };
  }

  // ---------- ผู้ดูแล ----------
  var admin = {
    adminLogin: function (req, me) { return me; },
    bootstrapSetup: function (req, me) {
      // ตั้งค่าครั้งแรก: สร้างหลายบัญชีพร้อมกัน แล้วปิดบัญชีเริ่มต้น admin/admin1234
      if (!me.bootstrap) fail('ตั้งค่าครั้งแรกไปแล้ว');
      var list = req.accounts || [], seen = {};
      if (!list.length) fail('กรุณาเพิ่มอย่างน้อย 1 บัญชี');
      if (!list.some(function (a) { return a.role !== 'editor'; })) fail('ต้องมีผู้ดูแลระบบอย่างน้อย 1 บัญชี');
      var items = list.map(function (a) {
        var username = String(a.username || '').trim();
        if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) fail('ชื่อผู้ใช้ "' + username + '" ใช้ได้เฉพาะ a-z 0-9 . _ - ยาว 3-30 ตัว');
        if (seen[username.toLowerCase()]) fail('ชื่อผู้ใช้ซ้ำกัน: ' + username);
        seen[username.toLowerCase()] = 1;
        checkEmail(a.email);
        checkPasswordRule(a.password);
        var item = { id: uid(), username: username, name: a.name || username, role: a.role === 'editor' ? 'editor' : 'admin', email: String(a.email || '').trim(),
          active: 'true', failCount: 0, lockUntil: '', mustChange: 'false', resetHash: '', resetExpire: '' };
        setPassword(item, a.password);
        return item;
      });
      items.forEach(function (it) { db.add('admins', it); });
      var s = db.settings() || {}; s.adminPassword = uid() + uid() + uid(); db.saveSettings(s); // รหัสเริ่มต้นเดิมใช้ไม่ได้อีก
      return { usernames: items.map(function (i) { return i.username; }) };
    },
    myEmailSave: function (req, me) {
      if (me.bootstrap) fail('กรุณาตั้งค่าครั้งแรกก่อน');
      checkEmail(req.email);
      var u = findAdmin(me.username); u.email = String(req.email || '').trim(); db.put('admins', 'id', u);
      return { ok: true };
    },
    myPasswordChange: function (req, me) {
      checkPasswordRule(req.newPassword);
      if (me.bootstrap) {
        // เปลี่ยนจากบัญชีเริ่มต้นเป็นบัญชีจริงครั้งแรก (ตั้งชื่อผู้ใช้ใหม่ได้)
        var username = String(req.newUsername || 'admin').trim();
        if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) fail('ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - ยาว 3-30 ตัว');
        var first = { id: uid(), username: username, name: req.name || 'ผู้ดูแลระบบ', role: 'admin', active: 'true', failCount: 0, lockUntil: '', mustChange: 'false' };
        setPassword(first, req.newPassword);
        db.add('admins', first);
        var s = db.settings() || {}; s.adminPassword = uid() + uid(); db.saveSettings(s); // ปิดรหัสเริ่มต้นเดิม
        return { username: username };
      }
      var u = findAdmin(me.username);
      setPassword(u, req.newPassword); u.mustChange = 'false'; db.put('admins', 'id', u);
      return { username: u.username };
    },
    usersList: function () {
      return admins().map(function (a) { return { id: a.id, username: a.username, name: a.name, role: a.role, email: a.email || '', active: String(a.active) !== 'false', locked: Number(a.lockUntil) > env.now().getTime() }; });
    },
    userSave: function (req, me) {
      var u = req.user || {}, all = admins();
      var username = String(u.username || '').trim();
      if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) fail('ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - ยาว 3-30 ตัว');
      var dup = findAdmin(username);
      if (dup && dup.id !== u.id) fail('ชื่อผู้ใช้นี้มีอยู่แล้ว');
      var old = u.id ? all.filter(function (a) { return a.id === u.id; })[0] : null;
      var item = old || { id: uid(), failCount: 0, lockUntil: '' };
      checkEmail(u.email);
      item.username = username; item.name = u.name || username; item.role = u.role === 'editor' ? 'editor' : 'admin';
      item.email = String(u.email || '').trim();
      item.active = u.active === false ? 'false' : 'true';
      if (old && old.id === me.id && (item.role !== 'admin' || item.active === 'false')) fail('ไม่สามารถลดสิทธิ์หรือปิดบัญชีของตัวเองได้');
      // req.password คือรหัสของผู้ที่ล็อกอินอยู่ รหัสของบัญชีที่แก้ใช้ req.userPassword
      if (req.userPassword) { checkPasswordRule(req.userPassword); setPassword(item, req.userPassword); item.mustChange = 'true'; item.failCount = 0; item.lockUntil = ''; }
      else if (!old) fail('กรุณาตั้งรหัสผ่านเริ่มต้น');
      if (old) db.put('admins', 'id', item); else db.add('admins', item);
      return { id: item.id };
    },
    userDelete: function (req, me) {
      if (req.id === me.id) fail('ไม่สามารถลบบัญชีของตัวเองได้');
      var left = admins().filter(function (a) { return a.id !== req.id && a.role !== 'editor' && String(a.active) !== 'false'; });
      if (!left.length) fail('ต้องมีผู้ดูแลระบบอย่างน้อย 1 บัญชี');
      db.del('admins', 'id', req.id); return { ok: true };
    },
    dashboard: function (req) {
      var now = nowBkk(), date = req.date || now.date, month = req.month || date.slice(0, 7);
      var pending = db.rows('leaves').filter(function (l) { return l.status === 'รออนุมัติ'; }).length;
      return { today: daily(date), month: monthly(month), pendingLeaves: pending };
    },
    daily: function (req) { return daily(req.date || nowBkk().date); },
    monthly: function (req) { return monthly(req.month || nowBkk().date.slice(0, 7)); },
    teachersList: function () {
      return db.rows('teachers').sort(function (a, b) { return (Number(a.order) || 999) - (Number(b.order) || 999); })
        .map(function (t) { return { id: t.id, name: t.name, position: t.position, pin: t.pin, active: isActive(t), order: t.order, photo: t.photo || '', faceCount: parseFaces(t).length }; });
    },
    teacherSave: function (req) {
      var t = req.teacher || {};
      if (!t.name) fail('กรุณากรอกชื่อ');
      var old = t.id ? db.rows('teachers').filter(function (x) { return String(x.id) === String(t.id); })[0] : null;
      if (req.faces && req.faces.length) {
        // กันลงทะเบียนหน้าคนเดียวกันซ้ำในชื่อครูคนอื่น
        var th = Number(settings().faceThreshold);
        teachers().forEach(function (o) {
          if (old && String(o.id) === String(old.id)) return;
          parseFaces(o).forEach(function (f) { if (faceDistance(req.faces[0], f) < th) fail('ใบหน้านี้ตรงกับ ' + o.name + ' ที่ลงทะเบียนไว้แล้ว'); });
        });
      }
      var item = {
        id: old ? old.id : uid(), name: t.name, position: t.position || '', pin: String(t.pin || (old && old.pin) || '1234'),
        active: t.active === false ? 'false' : 'true', order: t.order || (old && old.order) || String(db.rows('teachers').length + 1),
        photo: t.photo !== undefined ? t.photo : (old ? old.photo : ''),
        faces: req.faces ? JSON.stringify(req.faces) : (old ? old.faces : '[]')
      };
      if (old) db.put('teachers', 'id', item); else db.add('teachers', item);
      return { id: item.id };
    },
    teacherDelete: function (req) { db.del('teachers', 'id', req.id); return { ok: true }; },
    attendanceList: function (req) {
      return db.rows('attendance').filter(function (r) { return r.date >= req.from && r.date <= req.to; })
        .sort(function (a, b) { return (b.date + b.timeIn).localeCompare(a.date + a.timeIn); });
    },
    attendanceSave: function (req) {
      var r = req.row || {}, s = settings();
      if (!r.teacherId || !r.date) fail('ข้อมูลไม่ครบ');
      var t = db.rows('teachers').filter(function (x) { return String(x.id) === String(r.teacherId); })[0];
      var old = db.rows('attendance').filter(function (x) { return r.id ? x.id === r.id : (x.date === r.date && String(x.teacherId) === String(r.teacherId)); })[0];
      var item = old || { id: uid(), distIn: '', distOut: '', photoIn: '', photoOut: '' };
      item.date = r.date; item.teacherId = r.teacherId; item.name = t ? t.name : r.name;
      item.timeIn = r.timeIn || ''; item.timeOut = r.timeOut || '';
      item.status = item.timeIn ? (toMin(item.timeIn.slice(0, 5)) > toMin(s.workStart) ? 'สาย' : 'ตรงเวลา') : '';
      item.note = r.note || 'แก้ไขโดยผู้ดูแล';
      if (old) db.put('attendance', 'id', item); else db.add('attendance', item);
      return item;
    },
    attendanceDelete: function (req) { db.del('attendance', 'id', req.id); return { ok: true }; },
    leavesList: function () { return db.rows('leaves').sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }); },
    leaveSet: function (req) {
      var l = db.rows('leaves').filter(function (x) { return x.id === req.id; })[0];
      if (!l) fail('ไม่พบคำขอ');
      l.status = req.status; l.note = req.note || ''; db.put('leaves', 'id', l);
      notify('lineLeave', (l.status === 'อนุมัติ' ? '✅ ' : '❌ ') + l.status + l.type + ' ของ ' + l.name + ' วันที่ ' + l.from + (l.to !== l.from ? ' ถึง ' + l.to : ''));
      return l;
    },
    leaveSave: function (req) {
      var r = req.leave || {}, s = settings();
      var t = db.rows('teachers').filter(function (x) { return String(x.id) === String(r.teacherId); })[0];
      if (!t || !r.from || !r.to || r.to < r.from) fail('ข้อมูลไม่ครบหรือช่วงวันที่ไม่ถูกต้อง');
      var item = { id: uid(), teacherId: t.id, name: t.name, type: r.type, from: r.from, to: r.to, days: workDaysBetween(r.from, r.to, s),
        reason: r.reason || '', status: 'อนุมัติ', createdAt: nowBkk().iso, note: 'บันทึกโดยผู้ดูแล' };
      db.add('leaves', item); return item;
    },
    leaveDelete: function (req) { db.del('leaves', 'id', req.id); return { ok: true }; },
    newsSave: function (req) {
      var n = req.news || {};
      if (!n.title) fail('กรุณากรอกหัวข้อข่าว');
      var old = n.id ? db.rows('news').filter(function (x) { return x.id === n.id; })[0] : null;
      var image = n.image || '';
      if (req.imageData && env.saveImage) image = env.saveImage(req.imageData, n.title);
      var item = { id: old ? old.id : uid(), title: n.title, body: n.body || '', image: image, date: n.date || nowBkk().date, pinned: n.pinned ? 'true' : 'false',
        category: NEWS_CATEGORIES.indexOf(n.category) >= 0 ? n.category : NEWS_CATEGORIES[0], link: n.link || '' };
      if (old) db.put('news', 'id', item); else db.add('news', item);
      return item;
    },
    newsDelete: function (req) { db.del('news', 'id', req.id); return { ok: true }; },
    eventSave: function (req) {
      var e = req.event || {};
      if (!e.title || !e.date) fail('กรุณากรอกชื่อกิจกรรมและวันที่');
      var item = { id: e.id || uid(), title: e.title, date: e.date, dateEnd: e.dateEnd && e.dateEnd >= e.date ? e.dateEnd : '', time: e.time || '', place: e.place || '', detail: e.detail || '' };
      if (e.id) db.put('events', 'id', item); else db.add('events', item);
      return item;
    },
    eventDelete: function (req) { db.del('events', 'id', req.id); return { ok: true }; },
    linkSave: function (req) {
      var l = req.link || {};
      if (!l.title || !l.url) fail('กรุณากรอกชื่อและลิงก์');
      var item = { id: l.id || uid(), title: l.title, url: l.url, category: LINK_CATEGORIES.indexOf(l.category) >= 0 ? l.category : LINK_CATEGORIES[0], order: l.order || String(db.rows('links').length + 1) };
      if (l.id) db.put('links', 'id', item); else db.add('links', item);
      return item;
    },
    linkDelete: function (req) { db.del('links', 'id', req.id); return { ok: true }; },
    uploadImage: function (req) {
      if (!req.imageData || !env.saveImage) fail('ไม่มีรูปภาพ');
      return { url: env.saveImage(req.imageData, req.name || 'image') };
    },
    settingsGet: function () { var s = settings(); delete s.adminPassword; return s; },
    settingsSave: function (req, me) {
      var cur = db.settings() || {}, inc = req.settings || {};
      for (var k in inc) {
        if (!CORE_DEFAULT_SETTINGS.hasOwnProperty(k) || k === 'adminPassword') continue;
        if (me.role === 'editor' && SITE_KEYS.indexOf(k) < 0) continue; // ผู้จัดการเนื้อหาแก้ได้เฉพาะข้อมูลเว็บ
        cur[k] = String(inc[k]);
      }
      db.saveSettings(cur); return { ok: true };
    },
    photoGet: function (req) { return { data: env.getPhoto ? env.getPhoto(req.ref) : '' }; },
    lineTest: function () {
      if (!env.notify) fail('ยังไม่ได้ตั้งค่า LINE');
      env.notify('🔔 ทดสอบการแจ้งเตือนจากระบบลงเวลา ' + settings().schoolName);
      return { ok: true };
    },
    lineDailyNow: function () {
      var text = dailySummaryText(nowBkk().date);
      if (!text) fail('วันนี้เป็นวันหยุด');
      if (!env.notify) fail('ยังไม่ได้ตั้งค่า LINE');
      env.notify(text); return { ok: true, text: text };
    }
  };

  var publicActions = {
    getPublic: getPublic,
    checkin: checkin,
    todayBoard: todayBoard,
    leaveRequest: leaveRequest,
    teacherHistory: teacherHistory,
    verifyPin: function (req) { var t = requireTeacher(req); return { id: t.id, name: t.name }; },
    forgotPassword: forgotPassword,
    resetPassword: resetPassword
  };

  function handle(req) {
    try {
      var a = req && req.action;
      if (publicActions[a]) return { ok: true, data: publicActions[a](req) };
      if (admin[a]) {
        var me = authAdmin(req);
        if (me.role !== 'admin' && !EDITOR_ACTIONS[a]) fail('บัญชีนี้ไม่มีสิทธิ์ใช้งานส่วนนี้', 'ROLE');
        if (me.mustChange && a !== 'adminLogin' && a !== 'myPasswordChange' && a !== 'bootstrapSetup') fail('กรุณาเปลี่ยนรหัสผ่านก่อนใช้งาน', 'MUST_CHANGE');
        return { ok: true, data: admin[a](req, me) };
      }
      fail('ไม่รู้จักคำสั่ง ' + a);
    } catch (e) {
      return { ok: false, error: e.message || String(e), code: e.code || 'ERROR' };
    }
  }

  return { handle: handle, dailySummaryText: dailySummaryText, nowBkk: nowBkk, settings: settings, isWorkDay: function (d) { var s = settings(); return isWorkDay(d, s, holidayMap(s)); } };
}
