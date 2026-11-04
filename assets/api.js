/* ตัวเชื่อมต่อข้อมูล + ฟังก์ชันช่วยที่ใช้ทุกหน้า */
(function () {
  var cfg = window.APP_CONFIG || {};
  var DEMO = !cfg.API_URL;

  // ---------- โหมดทดลอง: ฐานข้อมูลใน localStorage ----------
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem('tkp_' + key) || 'null');
      localStorage.setItem('tkp_' + key, JSON.stringify(val));
    } catch (e) { if (val !== undefined) console.warn('บันทึกข้อมูลในเครื่องไม่สำเร็จ', e); }
    return null;
  }
  var demoDb = {
    rows: function (t) { return (store('t_' + t) || []).map(function (r) { return Object.assign({}, r); }); },
    add: function (t, obj) { var a = store('t_' + t) || []; a.push(obj); store('t_' + t, a); },
    put: function (t, key, obj) {
      var a = store('t_' + t) || [], i = a.findIndex(function (r) { return String(r[key]) === String(obj[key]); });
      if (i >= 0) a[i] = obj; else a.push(obj);
      store('t_' + t, a);
    },
    del: function (t, key, val) { store('t_' + t, (store('t_' + t) || []).filter(function (r) { return String(r[key]) !== String(val); })); },
    settings: function () { return store('settings') || {}; },
    saveSettings: function (s) { store('settings', s); }
  };
  var demoEnv = {
    now: function () { return new Date(); },
    notify: function (text) {
      var log = store('linelog') || []; log.unshift({ at: new Date().toISOString(), text: text }); store('linelog', log.slice(0, 30));
      window.dispatchEvent(new CustomEvent('demo-line', { detail: text }));
    },
    savePhoto: function (dataUrl) {
      var p = store('photos') || {}, id = 'p' + Date.now().toString(36), keys = Object.keys(p);
      if (keys.length > 40) delete p[keys[0]];
      p[id] = dataUrl; store('photos', p); return id;
    },
    getPhoto: function (ref) { return (store('photos') || {})[ref] || ''; },
    sendMail: function (to, subject, body) {
      // โหมดทดลอง: แสดงอีเมลบนจอแทนการส่งจริง
      window.dispatchEvent(new CustomEvent('demo-mail', { detail: { to: to, subject: subject, body: body } }));
    },
    saveImage: function (dataUrl) { return dataUrl; }
  };

  var DEFAULT_LINKS = [
    { id: 'k1', title: 'สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน (สพฐ.)', url: 'https://www.obec.go.th', category: 'ลิงก์หน่วยงาน', order: '1' },
    { id: 'k2', title: 'สพป.เชียงใหม่ เขต 3', url: 'https://cmarea3.go.th', category: 'ลิงก์หน่วยงาน', order: '2' },
    { id: 'k3', title: 'กระทรวงศึกษาธิการ', url: 'https://www.moe.go.th', category: 'ลิงก์หน่วยงาน', order: '3' }
  ];

  function seedDemo(core) {
    if (store('seeded')) return;
    var names = [
      ['นางสาวสมใจ ใจดี', 'ผู้อำนวยการโรงเรียน'], ['นายประเสริฐ ทองคำ', 'ครู ชำนาญการพิเศษ'],
      ['นางวันเพ็ญ แสงจันทร์', 'ครู ชำนาญการ'], ['นายอนุชา ศรีสุข', 'ครู'],
      ['นางสาวกาญจนา พวงมาลัย', 'ครูผู้ช่วย'], ['นายธนพล ดอยคำ', 'พนักงานราชการ']
    ];
    var teachers = names.map(function (n, i) { return { id: 'demo' + (i + 1), name: n[0] + ' (ตัวอย่าง)', position: n[1], pin: '1234', active: 'true', order: String(i + 1), photo: '', faces: '[]' }; });
    store('t_teachers', teachers);
    var att = [], leaves = [], today = core.nowBkk().date;
    var d = new Date(); d.setDate(d.getDate() - 45);
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function t(h, m) { m = Math.max(0, m); h += Math.floor(m / 60); m %= 60; return pad(h) + ':' + pad(m) + ':' + pad(Math.floor(Math.random() * 60)); }
    for (; ; d.setDate(d.getDate() + 1)) {
      var ds = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      if (ds >= today) break;
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      teachers.forEach(function (tc, i) {
        var r = Math.random();
        if (r < 0.04) return; // ขาด
        if (r < 0.09) { leaves.push({ id: 'l' + ds + i, teacherId: tc.id, name: tc.name, type: r < 0.06 ? 'ลาป่วย' : r < 0.075 ? 'ลากิจส่วนตัว' : 'ไปราชการ', from: ds, to: ds, days: 1, reason: 'ข้อมูลตัวอย่าง', status: 'อนุมัติ', createdAt: ds + 'T07:00:00+07:00', note: '' }); return; }
        var inM = 20 + Math.floor(Math.random() * 45) + (r > 0.9 ? 30 : 0);
        var tin = t(7, inM);
        att.push({ id: 'a' + ds + i, date: ds, teacherId: tc.id, name: tc.name, timeIn: tin, timeOut: t(16, 30 + Math.floor(Math.random() * 60)), status: tin > '08:00:59' ? 'สาย' : 'ตรงเวลา', distIn: 40, distOut: 55, photoIn: '', photoOut: '', note: '' });
      });
    }
    leaves.push({ id: 'lpending', teacherId: 'demo4', name: teachers[3].name, type: 'ลากิจส่วนตัว', from: today, to: today, days: 1, reason: 'ธุระครอบครัว (ตัวอย่าง)', status: 'รออนุมัติ', createdAt: today + 'T06:30:00+07:00', note: '' });
    store('t_attendance', att); store('t_leaves', leaves);
    store('t_news', [
      { id: 'n1', title: 'เปิดภาคเรียนที่ 2 ปีการศึกษา 2569', body: 'โรงเรียนบ้านทุ่งข้าวพวงเปิดภาคเรียนที่ 2 ขอให้ผู้ปกครองเตรียมความพร้อมของนักเรียน ทั้งเครื่องแบบและอุปกรณ์การเรียน', image: '', date: today, pinned: 'true' },
      { id: 'n2', title: 'กิจกรรมวันลอยกระทง', body: 'นักเรียนร่วมกันประดิษฐ์กระทงจากวัสดุธรรมชาติ สืบสานประเพณีไทย และรักษาสิ่งแวดล้อม', image: '', date: today, pinned: 'false' },
      { id: 'n3', title: 'ประชุมผู้ปกครองนักเรียน', body: 'ขอเชิญผู้ปกครองร่วมประชุมเพื่อรับฟังแนวทางการพัฒนาผู้เรียนและร่วมแลกเปลี่ยนความคิดเห็น', image: '', date: today, pinned: 'false' }
    ]);
    store('t_events', [
      { id: 'e1', title: 'ประชุมผู้ปกครองนักเรียน (ตัวอย่าง)', date: today, dateEnd: '', time: '09:00 น.', place: 'หอประชุมโรงเรียน', detail: '' }
    ]);
    store('t_links', DEFAULT_LINKS);
    store('settings', { announcement: 'ยินดีต้อนรับสู่เว็บไซต์โรงเรียนบ้านทุ่งข้าวพวง (ข้อความประกาศตัวอย่าง แก้ไขได้ที่หน้าผู้ดูแล)' });
    store('seeded', true);
  }

  var core = null;
  function demoCore() {
    if (!core) { core = createCore(demoDb, demoEnv); seedDemo(core); }
    return core;
  }

  function call(action, payload) {
    var req = Object.assign({ action: action }, payload || {});
    if (DEMO) {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          var res = demoCore().handle(JSON.parse(JSON.stringify(req)));
          res.ok ? resolve(res.data) : reject(Object.assign(new Error(res.error), { code: res.code }));
        }, 150);
      });
    }
    return fetch(cfg.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(req) })
      .then(function (r) { if (!r.ok) throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ (' + r.status + ')'); return r.json(); })
      .then(function (res) { if (!res.ok) throw Object.assign(new Error(res.error), { code: res.code }); return res.data; });
  }

  // ---------- ฟังก์ชันช่วย ----------
  var TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var TH_MONTHS_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  function parts(s) { var p = String(s).split('-'); return { y: +p[0], m: +p[1], d: +p[2] }; }
  var util = {
    DEMO: DEMO,
    TH_MONTHS: TH_MONTHS,
    thaiDate: function (s, short) { if (!s) return ''; var p = parts(s); return p.d + ' ' + (short ? TH_MONTHS_S : TH_MONTHS)[p.m - 1] + ' ' + (p.y + 543); },
    thaiDay: function (s) { var p = parts(s); return TH_DAYS[new Date(p.y, p.m - 1, p.d).getDay()]; },
    thaiMonth: function (ym) { var p = parts(ym + '-01'); return TH_MONTHS[p.m - 1] + ' ' + (p.y + 543); },
    hm: function (t) { return t ? String(t).slice(0, 5) : '-'; },
    esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); },
    todayStr: function () { var d = new Date(Date.now() + 7 * 3600e3); return d.toISOString().slice(0, 10); },
    toast: function (msg, type) {
      var box = document.getElementById('toasts');
      if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
      var el = document.createElement('div'); el.className = 'toast ' + (type || ''); el.textContent = msg; box.appendChild(el);
      setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 400); }, 4200);
    },
    resizeImage: function (src, max, quality) {
      return new Promise(function (resolve, reject) {
        function draw(img, w, h) {
          var s = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
          c.width = Math.round(w * s); c.height = Math.round(h * s);
          var ctx = c.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); // JPEG ไม่มีพื้นโปร่งใส
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', quality || 0.75));
        }
        if (src instanceof HTMLVideoElement || src instanceof HTMLCanvasElement) return draw(src, src.videoWidth || src.width, src.videoHeight || src.height);
        var img = new Image();
        img.onload = function () { draw(img, img.naturalWidth, img.naturalHeight); };
        img.onerror = reject;
        if (src instanceof Blob) { var fr = new FileReader(); fr.onload = function () { img.src = fr.result; }; fr.readAsDataURL(src); } else img.src = src;
      });
    },
    getPosition: function () {
      return new Promise(function (resolve, reject) {
        if (!navigator.geolocation) return reject(new Error('อุปกรณ์นี้ไม่รองรับ GPS'));
        navigator.geolocation.getCurrentPosition(function (p) { resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); },
          function (e) { reject(new Error(e.code === 1 ? 'กรุณาอนุญาตให้เว็บเข้าถึงตำแหน่ง (GPS)' : 'ไม่สามารถระบุตำแหน่งได้ กรุณาเปิด GPS แล้วลองใหม่')); },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
      });
    },
    distance: function (lat1, lng1, lat2, lng2) {
      var R = 6371000, r = Math.PI / 180, a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lng2 - lng1) * r / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(a));
    },
    demoReset: function () { Object.keys(localStorage).filter(function (k) { return k.indexOf('tkp_') === 0; }).forEach(function (k) { localStorage.removeItem(k); }); location.reload(); }
  };

  // โลโก้โรงเรียน (ใช้เมื่อยังไม่ได้ตั้งค่าโลโก้อื่น)
  util.defaultLogo = 'assets/logo.png';

  // ไอคอนเส้น (ใช้แทนอิโมจิ) — ใส่ใน HTML ได้ด้วย <span data-icon="ชื่อ"></span>
  var ICONS = {
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    facebook: '<path d="M15 3h-2a4 4 0 0 0-4 4v3H7v4h2v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2z"/>',
    pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c1-3.5 3.8-5.5 7-5.5s6 2 7 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.8.8 3 2.6 3.5 5.2"/>',
    teacher: '<circle cx="9" cy="7" r="3.5"/><path d="M2 21c.8-4 3.6-6.5 7-6.5 1.6 0 3 .5 4.2 1.4"/><path d="M14 4h8v7h-8M18 11v3"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    school: '<path d="M3 10 12 4l9 6"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
    news: '<path d="M4 5h12v14H6a2 2 0 0 1-2-2z"/><path d="M16 9h4v8a2 2 0 0 1-2 2"/><path d="M8 9h4M8 13h4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    chart: '<path d="M4 20V11M10 20V5M16 20v-7M22 20H2"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="10" r="3"/><path d="M7 17c1-2 3-3 5-3s4 1 5 3"/>',
    note: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
    pinned: '<path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/>',
    face: '<circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M8.5 15a4.5 4.5 0 0 0 7 0"/>'
  };
  util.icon = function (name) {
    return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  };
  document.querySelectorAll('[data-icon]').forEach(function (el) { el.innerHTML = util.icon(el.dataset.icon); });

  window.API = { call: call };
  window.U = util;
})();
