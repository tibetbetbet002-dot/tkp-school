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
    saveImage: function (dataUrl) { return dataUrl; }
  };

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
    store('settings', { studentsCount: '120' });
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

  // โลโก้เริ่มต้น (รวงข้าวสีทองในวงกลมสีม่วง) ใช้เมื่อยังไม่ได้ตั้งค่าโลโก้
  util.defaultLogo = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7b3fb5"/><stop offset="1" stop-color="#4a1d73"/></linearGradient></defs>' +
    '<circle cx="50" cy="50" r="48" fill="url(#g)"/><circle cx="50" cy="50" r="41" fill="none" stroke="#f6c945" stroke-width="2.5"/>' +
    '<path d="M50 82 C50 62 50 45 52 24" stroke="#f6c945" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    [[52, 26, -30], [50, 34, 30], [53, 40, -30], [50, 48, 30], [53, 54, -30], [50, 61, 30]].map(function (g) {
      return '<ellipse cx="' + (g[0] + (g[2] < 0 ? 6 : -6)) + '" cy="' + g[1] + '" rx="7" ry="3.6" fill="#f6c945" transform="rotate(' + g[2] + ' ' + (g[0] + (g[2] < 0 ? 6 : -6)) + ' ' + g[1] + ')"/>';
    }).join('') +
    '<path d="M30 74 Q50 66 70 74" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>');

  window.API = { call: call };
  window.U = util;
})();
