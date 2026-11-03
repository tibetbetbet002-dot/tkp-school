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
  about: 'โรงเรียนบ้านทุ่งข้าวพวงเป็นโรงเรียนประถมศึกษาที่อยู่คู่ชุมชน จัดการศึกษาตั้งแต่ระดับปฐมวัยถึงประถมศึกษาปีที่ 6 โดยร่วมมือกับผู้ปกครองและชุมชนในการพัฒนาผู้เรียนอย่างรอบด้าน',
  address: 'ตำบลทุ่งข้าวพวง อำเภอเชียงดาว จังหวัดเชียงใหม่',
  affiliation: 'สังกัดสำนักงานเขตพื้นที่การศึกษาประถมศึกษา',
  phone: '',
  email: '',
  facebook: '',
  directorName: '',
  directorTitle: 'ผู้อำนวยการโรงเรียนบ้านทุ่งข้าวพวง',
  studentsCount: '',
  classesCount: '8',
  founded: '',
  logoUrl: '',
  heroImage: '',
  lat: '',
  lng: '',
  radius: '200',
  gpsMaxAccuracy: '150',
  workStart: '08:00',
  workEnd: '16:30',
  faceThreshold: '0.5',
  liveness: 'on',
  lineEachCheckin: 'off',
  lineLeave: 'on',
  lineDaily: 'on',
  lineDailyTime: '08:30',
  holidays: '',
  adminPassword: 'admin1234'
};

var CORE_PUBLIC_KEYS = ['schoolName', 'schoolNameEn', 'motto', 'vision', 'about', 'address', 'affiliation', 'phone', 'email',
  'facebook', 'directorName', 'directorTitle', 'studentsCount', 'classesCount', 'founded', 'logoUrl', 'heroImage',
  'lat', 'lng', 'radius', 'gpsMaxAccuracy', 'workStart', 'workEnd', 'liveness', 'holidays'];

var LEAVE_TYPES = ['ลาป่วย', 'ลากิจส่วนตัว', 'ลาพักผ่อน', 'ลาคลอดบุตร', 'ไปราชการ', 'อื่นๆ'];

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
  function requireAdmin(req) { if (!req.password || req.password !== settings().adminPassword) fail('รหัสผ่านผู้ดูแลไม่ถูกต้อง', 'AUTH'); }
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
    var result = { name: best.name, position: best.position, mode: mode, time: now.time, date: now.date, distance: Math.round(dist), score: Math.round((1 - bestD) * 100) };

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
    return { settings: pub, news: news, staff: staff, leaveTypes: LEAVE_TYPES, today: nowBkk() };
  }

  // ---------- ผู้ดูแล ----------
  var admin = {
    adminLogin: function () { return { ok: true }; },
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
      var item = { id: old ? old.id : uid(), title: n.title, body: n.body || '', image: image, date: n.date || nowBkk().date, pinned: n.pinned ? 'true' : 'false' };
      if (old) db.put('news', 'id', item); else db.add('news', item);
      return item;
    },
    newsDelete: function (req) { db.del('news', 'id', req.id); return { ok: true }; },
    settingsGet: function () { var s = settings(); delete s.adminPassword; return s; },
    settingsSave: function (req) {
      var cur = db.settings() || {}, inc = req.settings || {};
      for (var k in inc) if (CORE_DEFAULT_SETTINGS.hasOwnProperty(k) && k !== 'adminPassword') cur[k] = String(inc[k]);
      if (req.newPassword) { if (String(req.newPassword).length < 6) fail('รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร'); cur.adminPassword = String(req.newPassword); }
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
    verifyPin: function (req) { var t = requireTeacher(req); return { id: t.id, name: t.name }; }
  };

  function handle(req) {
    try {
      var a = req && req.action;
      if (publicActions[a]) return { ok: true, data: publicActions[a](req) };
      if (admin[a]) { requireAdmin(req); return { ok: true, data: admin[a](req) }; }
      fail('ไม่รู้จักคำสั่ง ' + a);
    } catch (e) {
      return { ok: false, error: e.message || String(e), code: e.code || 'ERROR' };
    }
  }

  return { handle: handle, dailySummaryText: dailySummaryText, nowBkk: nowBkk, settings: settings, isWorkDay: function (d) { var s = settings(); return isWorkDay(d, s, holidayMap(s)); } };
}
