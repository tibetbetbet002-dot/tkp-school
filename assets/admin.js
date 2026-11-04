/* หน้าผู้บริหาร / ผู้ดูแลระบบ */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var USER = '', PW = '', ME = null, S = {}, charts = [], current = 'site';
  try { USER = sessionStorage.getItem('tkp_user') || ''; PW = sessionStorage.getItem('tkp_pw') || ''; } catch (e) { }
  var STATUS_CLASS = { present: 'b-present', late: 'b-late', leave: 'b-leave', official: 'b-official', absent: 'b-absent', waiting: 'b-waiting', off: 'b-off', future: 'b-future' };
  var esc = U.esc;

  if (U.DEMO) { $('demoBar').classList.remove('hidden'); window.addEventListener('demo-line', function (e) { U.toast('LINE (จำลอง)\n' + e.detail, 'line'); }); }

  function api(action, payload) {
    return API.call(action, Object.assign({ username: USER, password: PW }, payload || {})).catch(function (e) {
      if (e.code === 'AUTH' && action !== 'adminLogin') logout();
      if (e.code === 'MUST_CHANGE') changePassword(true);
      throw e;
    });
  }
  function fail(e) { U.toast(e.message || String(e), 'bad'); }
  function badge(code, label) { return '<span class="badge ' + (STATUS_CLASS[code] || '') + '">' + esc(label) + '</span>'; }
  function openModal(html) { $('modalBody').innerHTML = html; $('modal').classList.remove('hidden'); }
  function closeModal() { $('modal').classList.add('hidden'); Face.stop(); }
  $('modal').addEventListener('click', function (e) { if (e.target === this || e.target.dataset.close !== undefined) closeModal(); });
  function loading() { $('view').innerHTML = '<div class="empty"><span class="spinner"></span></div>'; }
  function head(title, right) { return '<div class="row" style="margin-bottom:18px"><h2 style="margin:0">' + title + '</h2><span class="spacer"></span>' + (right || '') + '</div>'; }
  function formData(form) { var o = {}; new FormData(form).forEach(function (v, k) { o[k] = v; }); return o; }

  // ---------- เข้าสู่ระบบ ----------
  API.call('getPublic').then(function (d) {
    var logo = d.settings.logoUrl || U.defaultLogo;
    $('navLogo').src = $('loginLogo').src = $('favicon').href = logo;
    document.querySelectorAll('[data-s]').forEach(function (el) { el.textContent = d.settings[el.dataset.s] || el.textContent; });
  }).catch(fail);

  function saveSession() { try { sessionStorage.setItem('tkp_user', USER); sessionStorage.setItem('tkp_pw', PW); } catch (x) { } }
  function enter(me) {
    ME = me;
    var isAdmin = me.role === 'admin';
    document.querySelectorAll('#side .admin-only').forEach(function (el) { el.classList.toggle('hidden', !isAdmin); });
    $('whoami').textContent = me.name + ' (' + (ADMIN_ROLES[me.role] || me.role) + ')';
    ['whoami', 'pwBtn', 'logoutBtn'].forEach(function (id) { $(id).classList.remove('hidden'); });
    $('loginView').classList.add('hidden'); $('appView').classList.remove('hidden');
    if (me.mustChange) { changePassword(true); return; }
    if (!isAdmin && !document.querySelector('#side [data-view="' + current + '"][data-editor]')) current = 'site';
    api('settingsGet').then(function (s) { S = s; show(current); }).catch(fail);
    if (isAdmin) refreshLeaveCount();
  }
  function logout() {
    USER = PW = ''; ME = null; try { sessionStorage.removeItem('tkp_user'); sessionStorage.removeItem('tkp_pw'); } catch (e) { }
    ['whoami', 'pwBtn', 'logoutBtn', 'appView'].forEach(function (id) { $(id).classList.add('hidden'); });
    $('loginView').classList.remove('hidden'); closeModal();
  }
  $('logoutBtn').onclick = logout;
  $('pwBtn').onclick = function () { changePassword(false); };
  $('loginForm').onsubmit = function (e) {
    e.preventDefault();
    var f = e.target, btn = f.querySelector('button'); btn.disabled = true;
    API.call('adminLogin', { username: f.username.value.trim(), password: f.password.value }).then(function (me) {
      USER = f.username.value.trim(); PW = f.password.value; saveSession(); f.password.value = '';
      enter(me);
    }).catch(fail).finally(function () { btn.disabled = false; });
  };
  if (USER && PW) api('adminLogin').then(enter).catch(function () { });

  // ---------- รหัสผ่านสุ่มที่แข็งแรง (สร้างในเครื่องนี้ ไม่ส่งไปที่อื่นนอกจากระบบ) ----------
  function strongPassword(len) {
    var sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%&*?+='], all = sets.join(''), out = [];
    var rnd = new Uint32Array(len || 14); crypto.getRandomValues(rnd);
    for (var i = 0; i < rnd.length; i++) out.push((i < 4 ? sets[i] : all).charAt(rnd[i] % (i < 4 ? sets[i] : all).length));
    for (var j = out.length - 1; j > 0; j--) { var k = rnd[j] % (j + 1), t = out[j]; out[j] = out[k]; out[k] = t; } // สลับตำแหน่ง
    return out.join('');
  }

  // ---------- ตั้งค่าครั้งแรก: สร้าง 3 บัญชีพร้อมรหัสสุ่ม ----------
  function bootstrapWizard() {
    var rows = [['director', 'ผู้อำนวยการโรงเรียน', 'admin'], ['officer', 'เจ้าหน้าที่ธุรการ', 'admin'], ['news', 'ครูประชาสัมพันธ์', 'editor']];
    openModal('<h3>ตั้งค่าบัญชีผู้ดูแลครั้งแรก</h3><p class="muted small">ระบบสร้างรหัสผ่านสุ่มที่แข็งแรงให้แต่ละบัญชีแล้ว (แก้ไขได้) ใส่อีเมลไว้เพื่อใช้ “ลืมรหัสผ่าน” · หลังกดสร้าง บัญชี admin / admin1234 จะใช้ไม่ได้อีก</p><form id="bsForm">' +
      rows.map(function (r, i) {
        return '<div class="card" style="padding:14px;margin-bottom:12px"><b>บัญชีที่ ' + (i + 1) + '</b><div class="grid g2" style="gap:0 12px;margin-top:8px">' +
          '<div class="field"><label>ชื่อผู้ใช้</label><input name="u' + i + '" value="' + r[0] + '" autocapitalize="none" required></div>' +
          '<div class="field"><label>ชื่อที่แสดง</label><input name="n' + i + '" value="' + r[1] + '"></div>' +
          '<div class="field"><label>สิทธิ์</label><select name="r' + i + '"><option value="admin"' + (r[2] === 'admin' ? ' selected' : '') + '>ผู้ดูแลระบบ</option><option value="editor"' + (r[2] === 'editor' ? ' selected' : '') + '>ผู้จัดการเนื้อหาเว็บ</option></select></div>' +
          '<div class="field"><label>อีเมล (สำหรับลืมรหัสผ่าน)</label><input type="email" name="e' + i + '" placeholder="name@gmail.com"></div>' +
          '<div class="field" style="grid-column:1/-1"><label>รหัสผ่าน</label><div class="row" style="flex-wrap:nowrap"><input name="p' + i + '" value="' + strongPassword(14) + '" style="font-family:monospace" required><button type="button" class="btn btn-sm" data-regen="' + i + '">สุ่มใหม่</button></div></div>' +
          '</div><label class="row small" style="font-weight:400"><input type="checkbox" name="x' + i + '"' + (i ? '' : ' disabled') + ' checked> สร้างบัญชีนี้</label></div>';
      }).join('') +
      '<div class="row"><span class="spacer"></span><button type="button" class="btn" id="pwLogout">ออกจากระบบ</button><button class="btn btn-primary">สร้างบัญชี</button></div></form>');
    $('pwLogout').onclick = logout;
    $('bsForm').querySelectorAll('[data-regen]').forEach(function (b) { b.onclick = function () { $('bsForm')['p' + b.dataset.regen].value = strongPassword(14); }; });
    $('bsForm').onsubmit = function (e) {
      e.preventDefault();
      var f = e.target, accounts = [];
      rows.forEach(function (r, i) {
        if (i && !f['x' + i].checked) return;
        accounts.push({ username: f['u' + i].value.trim(), name: f['n' + i].value.trim(), role: f['r' + i].value, email: f['e' + i].value.trim(), password: f['p' + i].value });
      });
      var btn = f.querySelector('.btn-primary'); btn.disabled = true;
      api('bootstrapSetup', { accounts: accounts }).then(function () {
        showCredentials(accounts);
      }).catch(fail).finally(function () { btn.disabled = false; });
    };
  }
  function showCredentials(accounts) {
    var text = accounts.map(function (a) { return a.name + '\nชื่อผู้ใช้: ' + a.username + '\nรหัสผ่าน: ' + a.password + '\nสิทธิ์: ' + (ADMIN_ROLES[a.role] || a.role); }).join('\n\n');
    openModal('<h3>สร้างบัญชีเรียบร้อย</h3><p class="muted small"><b style="color:var(--bad)">จดหรือบันทึกรหัสผ่านไว้ตอนนี้</b> ระบบเก็บรหัสแบบเข้ารหัส จะแสดงให้ดูได้ครั้งนี้ครั้งเดียว (เปลี่ยนภายหลังได้ที่ปุ่ม “เปลี่ยนรหัสผ่าน”)</p>' +
      '<div class="table-wrap" style="margin-bottom:14px"><table><thead><tr><th>ชื่อ</th><th>ชื่อผู้ใช้</th><th>รหัสผ่าน</th></tr></thead><tbody>' +
      accounts.map(function (a) { return '<tr><td>' + esc(a.name) + '<div class="small muted">' + esc(ADMIN_ROLES[a.role]) + '</div></td><td><b>' + esc(a.username) + '</b></td><td style="font-family:monospace">' + esc(a.password) + '</td></tr>'; }).join('') +
      '</tbody></table></div><div class="row"><button class="btn" id="credCopy">คัดลอกทั้งหมด</button><button class="btn" id="credPrint">พิมพ์</button><span class="spacer"></span><button class="btn btn-primary" id="credDone">บันทึกแล้ว เข้าใช้งาน</button></div>');
    $('credCopy').onclick = function () { navigator.clipboard.writeText(text).then(function () { U.toast('คัดลอกแล้ว', 'ok'); }, function () { U.toast('คัดลอกไม่สำเร็จ กรุณาจดเอง', 'bad'); }); };
    $('credPrint').onclick = function () {
      var w = window.open('', '_blank');
      w.document.write('<pre style="font:16px/1.6 sans-serif">บัญชีผู้ดูแลเว็บไซต์โรงเรียน\n\n' + esc(text) + '</pre>'); w.document.close(); w.print();
    };
    $('credDone').onclick = function () {
      USER = accounts[0].username; PW = accounts[0].password; saveSession(); closeModalForce();
      api('adminLogin').then(enter).catch(fail);
    };
  }
  function closeModalForce() { ME = null; closeModal(); }

  // ---------- ลืมรหัสผ่าน ----------
  if (U.DEMO) window.addEventListener('demo-mail', function (e) { alert('อีเมลจำลอง (โหมดทดลอง)\nถึง: ' + e.detail.to + '\nเรื่อง: ' + e.detail.subject + '\n\n' + e.detail.body); });
  $('forgotLink').onclick = function (e) {
    e.preventDefault();
    openModal('<h3>ลืมรหัสผ่าน</h3><p class="muted small">กรอกชื่อผู้ใช้หรืออีเมลของบัญชี ระบบจะส่งรหัสยืนยัน 8 หลักไปที่อีเมลที่ผูกไว้</p><form id="fgForm">' +
      '<div class="field"><label>ชื่อผู้ใช้ หรือ อีเมล</label><input name="username" required autocapitalize="none" value="' + esc($('loginForm').username.value) + '"></div>' +
      '<div class="row"><a href="#" id="haveCode" class="small">มีรหัสยืนยันแล้ว</a><span class="spacer"></span><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn btn-primary">ส่งรหัสยืนยัน</button></div></form>');
    $('haveCode').onclick = function (ev) { ev.preventDefault(); resetForm($('fgForm').username.value.trim()); };
    $('fgForm').onsubmit = function (ev) {
      ev.preventDefault();
      var who = ev.target.username.value.trim(), btn = ev.target.querySelector('.btn-primary'); btn.disabled = true;
      API.call('forgotPassword', { username: who }).then(function (r) { U.toast(r.message, 'ok'); resetForm(who.indexOf('@') > 0 ? '' : who); })
        .catch(fail).finally(function () { btn.disabled = false; });
    };
  };
  function resetForm(username) {
    openModal('<h3>ตั้งรหัสผ่านใหม่</h3><p class="muted small">เปิดอีเมลแล้วนำรหัสยืนยัน 8 หลักมากรอก (ถ้าไม่เห็น ให้ดูในโฟลเดอร์จดหมายขยะ/สแปม)</p><form id="rsForm">' +
      '<div class="field"><label>ชื่อผู้ใช้</label><input name="username" required autocapitalize="none" value="' + esc(username || '') + '"></div>' +
      '<div class="field"><label>รหัสยืนยันจากอีเมล</label><input name="code" required autocapitalize="characters" maxlength="8" style="font-family:monospace;letter-spacing:.2em;text-transform:uppercase"></div>' +
      '<div class="field"><label>รหัสผ่านใหม่</label><div class="row" style="flex-wrap:nowrap"><input name="pw1" required autocomplete="new-password" style="font-family:monospace"><button type="button" class="btn btn-sm" id="rsGen">สุ่มให้</button></div><div class="hint">อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข</div></div>' +
      '<div class="row"><span class="spacer"></span><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn btn-primary">บันทึกรหัสผ่านใหม่</button></div></form>');
    $('rsGen').onclick = function () { $('rsForm').pw1.value = strongPassword(14); };
    $('rsForm').onsubmit = function (ev) {
      ev.preventDefault();
      var f = formData(ev.target);
      API.call('resetPassword', { username: f.username.trim(), code: f.code, newPassword: f.pw1 }).then(function (r) {
        closeModal(); U.toast('ตั้งรหัสผ่านใหม่เรียบร้อย เข้าสู่ระบบได้เลย', 'ok');
        $('loginForm').username.value = r.username; $('loginForm').password.value = ''; $('loginForm').password.focus();
      }).catch(fail);
    };
  }

  // เปลี่ยนรหัสผ่าน (บังคับเมื่อเข้าครั้งแรกด้วยบัญชีเริ่มต้น หรือหลังผู้ดูแลรีเซ็ตรหัสให้)
  function changePassword(forced) {
    var first = ME && ME.bootstrap;
    if (first) { bootstrapWizard(); return; }
    openModal('<h3>' + (forced ? 'ตั้งรหัสผ่านใหม่ก่อนใช้งาน' : 'เปลี่ยนรหัสผ่าน') + '</h3>' +
      (first ? '<p class="muted small">นี่คือการเข้าใช้ครั้งแรกด้วยบัญชีเริ่มต้น กรุณาตั้งชื่อผู้ใช้และรหัสผ่านของคุณเอง รหัสเริ่มต้น admin1234 จะใช้ไม่ได้อีก</p>' : '<p class="muted small">รหัสผ่านต้องยาวอย่างน้อย 8 ตัว และมีทั้งตัวอักษรและตัวเลข</p>') +
      '<form id="pwForm">' +
      (first ? '<div class="field"><label>ชื่อผู้ใช้ใหม่ (ภาษาอังกฤษ/ตัวเลข)</label><input name="newUsername" required value="admin" autocapitalize="none"></div><div class="field"><label>ชื่อที่แสดง</label><input name="name" value="ผู้ดูแลระบบ"></div>' : '') +
      '<div class="field"><label>อีเมลสำหรับกู้คืนรหัสผ่าน</label><input type="email" name="email" value="' + esc((ME && ME.email) || '') + '" placeholder="name@gmail.com"></div>' +
      '<div class="field"><label>รหัสผ่านใหม่' + (forced ? '' : ' (เว้นว่าง = ไม่เปลี่ยน)') + '</label><div class="row" style="flex-wrap:nowrap"><input type="password" name="pw1"' + (forced ? ' required' : '') + ' autocomplete="new-password"><button type="button" class="btn btn-sm" id="pwGen">สุ่มให้</button></div></div>' +
      '<div class="field"><label>ยืนยันรหัสผ่านใหม่</label><input type="password" name="pw2" autocomplete="new-password"></div>' +
      '<div class="row"><span class="spacer"></span>' + (forced ? '<button type="button" class="btn" id="pwLogout">ออกจากระบบ</button>' : '<button type="button" class="btn" data-close>ยกเลิก</button>') + '<button class="btn btn-primary">บันทึก</button></div></form>');
    if ($('pwLogout')) $('pwLogout').onclick = logout;
    $('pwGen').onclick = function () {
      var p = strongPassword(14), f = $('pwForm');
      f.pw1.type = f.pw2.type = 'text'; f.pw1.value = f.pw2.value = p;
      U.toast('สุ่มรหัสให้แล้ว จดไว้ก่อนกดบันทึก');
    };
    $('pwForm').onsubmit = function (e) {
      e.preventDefault();
      var f = formData(e.target), jobs = Promise.resolve();
      if (f.pw1 && f.pw1 !== f.pw2) { U.toast('รหัสผ่านทั้งสองช่องไม่ตรงกัน', 'bad'); return; }
      if ((f.email || '') !== ((ME && ME.email) || '')) jobs = jobs.then(function () { return api('myEmailSave', { email: f.email }); });
      if (f.pw1) jobs = jobs.then(function () { return api('myPasswordChange', { newPassword: f.pw1 }); }).then(function (r) { USER = r.username; PW = f.pw1; saveSession(); });
      jobs.then(function () {
        closeModal(); U.toast('บันทึกแล้ว', 'ok');
        return api('adminLogin').then(enter);
      }).catch(fail);
    };
  }
  // ปิดหน้าต่างบังคับเปลี่ยนรหัสไม่ได้
  $('modal').addEventListener('click', function (e) { if (ME && ME.mustChange && ($('pwForm') || $('bsForm') || $('credDone')) && e.target === this) e.stopImmediatePropagation(); }, true);

  function refreshLeaveCount() {
    api('leavesList').then(function (l) {
      var n = l.filter(function (x) { return x.status === 'รออนุมัติ'; }).length;
      $('leaveCount').textContent = n; $('leaveCount').classList.toggle('hidden', !n);
    }).catch(function () { });
  }

  // ---------- เมนู ----------
  $('side').onclick = function (e) { var b = e.target.closest('button'); if (b) show(b.dataset.view); };
  function show(name, arg) {
    current = name; Face.stop();
    charts.forEach(function (c) { c.destroy(); }); charts = [];
    document.querySelectorAll('#side button').forEach(function (b) { b.classList.toggle('active', b.dataset.view === name); });
    loading(); views[name](arg);
  }

  var views = {};

  // ---------- แดชบอร์ด ----------
  views.dash = function (date) {
    date = date || U.todayStr();
    api('dashboard', { date: date, month: date.slice(0, 7) }).then(function (d) {
      var t = d.today, c = t.count, m = d.month;
      var kpi = function (icon, n, l, bg, fg) { return '<div class="card kpi"><div class="ic" style="background:' + bg + ';color:' + fg + '">' + icon + '</div><div><div class="n">' + n + '</div><div class="l">' + l + '</div></div></div>'; };
      $('view').innerHTML = head('แดชบอร์ด', '<input type="date" id="dashDate" value="' + date + '" style="width:auto">') +
        (t.workDay ? '' : '<div class="card" style="margin-bottom:16px;background:var(--gold-100)">วันนี้เป็นวันหยุด' + (t.holiday ? ' — ' + esc(t.holiday) : '') + '</div>') +
        '<div class="grid g4" style="gap:14px">' +
        kpi(U.icon('check'), (c.present + c.late) + '<span class="muted" style="font-size:1rem">/' + t.total + '</span>', 'มาปฏิบัติราชการ', 'var(--ok-bg)', 'var(--ok)') +
        kpi(U.icon('clock'), c.late, 'มาสาย', 'var(--warn-bg)', 'var(--warn)') +
        kpi(U.icon('note'), c.leave + c.official, 'ลา / ไปราชการ', 'var(--info-bg)', 'var(--info)') +
        kpi(U.icon('help'), c.waiting + c.absent, c.absent ? 'ขาด' : 'ยังไม่ลงเวลา', 'var(--bad-bg)', 'var(--bad)') + '</div>' +
        (d.pendingLeaves ? '<div class="card row" style="margin-top:14px;border-color:#f2dc94;background:var(--gold-100)"><b>มีคำขอลารออนุมัติ ' + d.pendingLeaves + ' รายการ</b><span class="spacer"></span><button class="btn btn-sm btn-primary" id="goLeaves">พิจารณา</button></div>' : '') +
        '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-top:16px">' +
        '<div class="card"><h3>สถานะ' + (date === U.todayStr() ? 'วันนี้' : 'วันที่ ' + U.thaiDate(date, true)) + '</h3><div style="height:220px"><canvas id="chToday"></canvas></div></div>' +
        '<div class="card"><h3>แนวโน้มเดือน' + U.thaiMonth(m.month) + '</h3><div style="height:220px"><canvas id="chTrend"></canvas></div></div></div>' +
        '<div class="card" style="margin-top:16px"><h3>รายชื่อ' + (date === U.todayStr() ? 'วันนี้' : '') + '</h3><div class="table-wrap" style="border:0"><table><thead><tr><th>ชื่อ - สกุล</th><th>มา</th><th>กลับ</th><th>สถานะ</th></tr></thead><tbody>' +
        t.list.map(function (x) { return '<tr><td>' + esc(x.name) + '<div class="small muted">' + esc(x.position) + '</div></td><td>' + U.hm(x.timeIn) + '</td><td>' + U.hm(x.timeOut) + '</td><td>' + badge(x.status, x.label) + '</td></tr>'; }).join('') +
        '</tbody></table></div></div>' +
        '<div class="card" style="margin-top:16px"><h3>สรุปรายบุคคลเดือน' + U.thaiMonth(m.month) + '</h3><div class="table-wrap" style="border:0"><table><thead><tr><th>ชื่อ - สกุล</th><th>วันทำการ</th><th>มา</th><th>สาย</th><th>ลา</th><th>ไปราชการ</th><th>ขาด</th><th>อัตราการมา</th></tr></thead><tbody>' +
        m.rows.map(function (r) {
          var k = r.count, rate = k.workDays ? Math.round((k.present + k.official) / k.workDays * 100) : 0;
          return '<tr><td>' + esc(r.name) + '</td><td>' + k.workDays + '</td><td>' + k.present + '</td><td>' + (k.late ? '<b style="color:var(--warn)">' + k.late + '</b>' : 0) + '</td><td>' + (k.sick + k.personal + k.otherLeave) + '</td><td>' + k.official + '</td><td>' + (k.absent ? '<b style="color:var(--bad)">' + k.absent + '</b>' : 0) + '</td>' +
            '<td style="min-width:130px"><div style="height:8px;border-radius:9px;background:var(--purple-100)"><div style="height:8px;border-radius:9px;width:' + rate + '%;background:linear-gradient(90deg,var(--purple-500),var(--gold-400))"></div></div><span class="small muted">' + rate + '%</span></td></tr>';
        }).join('') + '</tbody></table></div></div>';

      $('dashDate').onchange = function () { show('dash', this.value); };
      if ($('goLeaves')) $('goLeaves').onclick = function () { show('leaves'); };
      if (window.Chart) {
        Chart.defaults.font.family = 'Prompt, Sarabun, sans-serif';
        charts.push(new Chart($('chToday'), {
          type: 'doughnut',
          data: { labels: ['ตรงเวลา', 'สาย', 'ลา/ราชการ', 'ยังไม่มา/ขาด'], datasets: [{ data: [c.present, c.late, c.leave + c.official, c.waiting + c.absent], backgroundColor: ['#18a058', '#f4bf1f', '#2f6fdb', '#d93a4a'], borderWidth: 0 }] },
          options: { maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'right' } } }
        }));
        var work = m.trend.filter(function (x) { return x.work && x.date <= U.todayStr(); });
        charts.push(new Chart($('chTrend'), {
          type: 'bar',
          data: {
            labels: work.map(function (x) { return +x.date.slice(8); }),
            datasets: [
              { label: 'ตรงเวลา', data: work.map(function (x) { return x.present - x.late; }), backgroundColor: '#7a3fb8', borderRadius: 6 },
              { label: 'สาย', data: work.map(function (x) { return x.late; }), backgroundColor: '#f4bf1f', borderRadius: 6 },
              { label: 'ลา', data: work.map(function (x) { return x.leave; }), backgroundColor: '#9db8ef', borderRadius: 6 },
              { label: 'ขาด', data: work.map(function (x) { return x.absent; }), backgroundColor: '#d93a4a', borderRadius: 6 }
            ]
          },
          options: { maintainAspectRatio: false, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } }
        }));
      }
    }).catch(fail);
  };

  // ---------- การลงเวลารายวัน ----------
  views.daily = function (date) {
    date = date || U.todayStr();
    Promise.all([api('daily', { date: date }), api('attendanceList', { from: date, to: date })]).then(function (res) {
      var d = res[0], raw = {};
      res[1].forEach(function (r) { raw[r.teacherId] = r; });
      $('view').innerHTML = head('การลงเวลา', '<input type="date" id="dDate" value="' + date + '" style="width:auto"><button class="btn btn-gold" id="dWord">ดาวน์โหลด Word</button>') +
        '<p class="muted small" style="margin-top:-8px">วัน' + U.thaiDay(date) + 'ที่ ' + U.thaiDate(date) + (d.workDay ? '' : ' · วันหยุด ' + esc(d.holiday)) + ' · กด “แก้ไข” เพื่อบันทึกเวลาแทนครูที่ลืมลงเวลา</p>' +
        '<div class="table-wrap"><table><thead><tr><th>ที่</th><th>ชื่อ - สกุล</th><th>เวลามา</th><th>เวลากลับ</th><th>สถานะ</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>' +
        d.list.map(function (x, i) {
          var r = raw[x.id] || {};
          var photos = (r.photoIn ? '<button class="btn btn-sm" data-photo="' + esc(r.photoIn) + '">รูปมา</button>' : '') + (r.photoOut ? '<button class="btn btn-sm" data-photo="' + esc(r.photoOut) + '">รูปกลับ</button>' : '');
          return '<tr><td>' + (i + 1) + '</td><td>' + esc(x.name) + '</td><td>' + U.hm(x.timeIn) + (r.distIn !== undefined && r.distIn !== '' ? '<div class="small muted">' + r.distIn + ' ม.</div>' : '') + '</td><td>' + U.hm(x.timeOut) + '</td><td>' + badge(x.status, x.label) + '</td><td class="small">' + esc(x.note) + '</td>' +
            '<td><div class="row" style="gap:6px;flex-wrap:nowrap">' + photos + '<button class="btn btn-sm" data-edit="' + esc(x.id) + '">แก้ไข</button></div></td></tr>';
        }).join('') + '</tbody></table></div>';
      $('dDate').onchange = function () { loading(); views.daily(this.value); };
      $('dWord').onclick = function () { Report.daily(S, d).then(function () { U.toast('ดาวน์โหลดรายงานแล้ว', 'ok'); }).catch(fail); };
      $('view').querySelectorAll('[data-photo]').forEach(function (b) {
        b.onclick = function () {
          openModal('<h3>รูปถ่ายขณะลงเวลา</h3><div id="ph" class="empty"><span class="spinner"></span></div><button class="btn" data-close>ปิด</button>');
          api('photoGet', { ref: b.dataset.photo }).then(function (p) { $('ph').innerHTML = p.data ? '<img src="' + p.data + '" style="border-radius:16px;margin:auto;transform:scaleX(-1)">' : 'ไม่พบรูป'; }).catch(fail);
        };
      });
      $('view').querySelectorAll('[data-edit]').forEach(function (b) {
        b.onclick = function () {
          var x = d.list.filter(function (y) { return y.id === b.dataset.edit; })[0], r = raw[x.id] || {};
          openModal('<h3>แก้ไขเวลา: ' + esc(x.name) + '</h3><p class="muted small">' + U.thaiDate(date) + '</p><form id="eForm">' +
            '<div class="grid g2" style="gap:0 14px"><div class="field"><label>เวลามา</label><input type="time" name="timeIn" value="' + (x.timeIn || '').slice(0, 5) + '"></div>' +
            '<div class="field"><label>เวลากลับ</label><input type="time" name="timeOut" value="' + (x.timeOut || '').slice(0, 5) + '"></div></div>' +
            '<div class="field"><label>หมายเหตุ</label><input name="note" value="' + esc(r.note || '') + '" placeholder="เช่น ลืมลงเวลา / ระบบขัดข้อง"></div>' +
            '<div class="row">' + (r.id ? '<button type="button" class="btn btn-danger" id="eDel">ลบรายการ</button>' : '') + '<span class="spacer"></span><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn btn-primary">บันทึก</button></div></form>');
          $('eForm').onsubmit = function (e) {
            e.preventDefault();
            var f = formData(e.target), sec = function (v) { return v ? (v.length === 5 ? v + ':00' : v) : ''; };
            api('attendanceSave', { row: { id: r.id, teacherId: x.id, date: date, timeIn: sec(f.timeIn), timeOut: sec(f.timeOut), note: f.note } })
              .then(function () { closeModal(); U.toast('บันทึกแล้ว', 'ok'); views.daily(date); }).catch(fail);
          };
          if ($('eDel')) $('eDel').onclick = function () { if (confirm('ลบรายการลงเวลานี้?')) api('attendanceDelete', { id: r.id }).then(function () { closeModal(); views.daily(date); }).catch(fail); };
        };
      });
    }).catch(fail);
  };

  // ---------- ครูและใบหน้า ----------
  views.teachers = function () {
    api('teachersList').then(function (list) {
      $('view').innerHTML = head('ครูและบุคลากร', '<button class="btn btn-primary" id="tAdd">+ เพิ่มครู</button>') +
        '<p class="muted small" style="margin-top:-8px">การลงทะเบียนใบหน้าทำได้เฉพาะผู้ดูแลเท่านั้น: เพิ่มครู → กด “สแกนหน้า” ให้ครูคนนั้นมองกล้องที่เครื่องนี้ (ทำครั้งเดียว ~10 วินาที) · หลังจากนั้นระบบจะจำหน้าได้เองและลงเวลาให้อัตโนมัติ · PIN ใช้สำหรับขอลาและดูประวัติ</p>' +
        '<div class="table-wrap"><table><thead><tr><th></th><th>ชื่อ - สกุล</th><th>ตำแหน่ง</th><th>PIN</th><th>ใบหน้า</th><th>สถานะ</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(function (t) {
          return '<tr><td>' + (t.photo ? '<img src="' + esc(t.photo) + '" style="width:44px;height:44px;border-radius:50%;object-fit:cover">' : '<div class="avatar" style="width:44px;height:44px;font-size:1rem;border-width:2px;margin:0">' + esc(t.name.charAt(0)) + '</div>') + '</td>' +
            '<td><b>' + esc(t.name) + '</b></td><td>' + esc(t.position) + '</td><td>' + esc(t.pin) + '</td>' +
            '<td>' + (t.faceCount ? badge('present', 'ลงทะเบียนแล้ว') : badge('absent', 'ยังไม่ลงทะเบียน')) + '</td><td>' + (t.active ? 'ใช้งาน' : '<span class="muted">ปิดใช้งาน</span>') + '</td>' +
            '<td><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn btn-sm btn-gold" data-face="' + esc(t.id) + '">สแกนหน้า</button><button class="btn btn-sm" data-edit="' + esc(t.id) + '">แก้ไข</button></div></td></tr>';
        }).join('') : '<tr><td colspan="7" class="empty">ยังไม่มีข้อมูลครู กด “เพิ่มครู”</td></tr>') + '</tbody></table></div>';
      var byId = {}; list.forEach(function (t) { byId[t.id] = t; });
      $('tAdd').onclick = function () { editTeacher({ active: true, pin: String(Math.floor(1000 + Math.random() * 9000)) }); };
      $('view').querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { editTeacher(byId[b.dataset.edit]); }; });
      $('view').querySelectorAll('[data-face]').forEach(function (b) { b.onclick = function () { enrollFace(byId[b.dataset.face]); }; });
    }).catch(fail);
  };
  function editTeacher(t) {
    openModal('<h3>' + (t.id ? 'แก้ไขข้อมูลครู' : 'เพิ่มครู / บุคลากร') + '</h3><form id="tForm">' +
      '<div class="field"><label>ชื่อ - สกุล (มีคำนำหน้า)</label><input name="name" required value="' + esc(t.name || '') + '" placeholder="นางสาวสมใจ ใจดี"></div>' +
      '<div class="field"><label>ตำแหน่ง</label><input name="position" list="posList" value="' + esc(t.position || '') + '"><datalist id="posList"><option>ผู้อำนวยการโรงเรียน</option><option>รองผู้อำนวยการโรงเรียน</option><option>ครู ชำนาญการพิเศษ</option><option>ครู ชำนาญการ</option><option>ครู</option><option>ครูผู้ช่วย</option><option>พนักงานราชการ</option><option>ครูอัตราจ้าง</option><option>เจ้าหน้าที่ธุรการ</option><option>นักการภารโรง</option></datalist></div>' +
      '<div class="grid g2" style="gap:0 14px"><div class="field"><label>รหัส PIN</label><input name="pin" inputmode="numeric" maxlength="8" required value="' + esc(t.pin || '') + '"></div>' +
      '<div class="field"><label>ลำดับการแสดง</label><input name="order" type="number" min="1" value="' + esc(t.order || '') + '"></div></div>' +
      '<label class="row" style="font-weight:400;margin-bottom:18px"><input type="checkbox" name="active"' + (t.active !== false ? ' checked' : '') + '> เปิดใช้งาน (ปิดเมื่อย้าย/ลาออก ข้อมูลเดิมยังอยู่)</label>' +
      '<div class="row">' + (t.id ? '<button type="button" class="btn btn-danger" id="tDel">ลบ</button>' : '') + '<span class="spacer"></span><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn btn-primary">บันทึก</button></div></form>');
    $('tForm').onsubmit = function (e) {
      e.preventDefault();
      var f = formData(e.target);
      api('teacherSave', { teacher: { id: t.id, name: f.name.trim(), position: f.position.trim(), pin: f.pin.trim(), order: f.order, active: !!f.active } })
        .then(function (r) {
          closeModal(); U.toast('บันทึกแล้ว', 'ok');
          if (!t.id && confirm('ลงทะเบียนใบหน้าของ ' + f.name + ' เลยหรือไม่?')) enrollFace({ id: r.id, name: f.name, position: f.position, pin: f.pin, active: !!f.active });
          else views.teachers();
        }).catch(fail);
    };
    if ($('tDel')) $('tDel').onclick = function () {
      if (confirm('ลบ ' + t.name + ' ออกจากระบบ? (ประวัติการลงเวลายังอยู่ แนะนำให้ “ปิดใช้งาน” แทน)')) api('teacherDelete', { id: t.id }).then(function () { closeModal(); views.teachers(); }).catch(fail);
    };
  }
  function enrollFace(t) {
    openModal('<h3>ลงทะเบียนใบหน้า</h3><p class="muted">' + esc(t.name) + '</p>' +
      '<div class="scanner" style="max-width:340px"><video id="eVideo" playsinline muted></video><div class="frame" id="eFrame"></div><div class="msg" id="eMsg">กดเริ่มเพื่อเปิดกล้อง</div></div>' +
      '<p class="small muted center">อยู่ในที่มีแสงสว่าง ถอดแว่นกันแดด/หน้ากาก แล้วทำตามคำแนะนำบนจอ</p>' +
      '<div class="row"><span class="spacer"></span><button class="btn" data-close>ปิด</button><button class="btn btn-primary" id="eStart">เริ่มลงทะเบียน</button></div>');
    var status = function (m, ok) { if ($('eMsg')) { $('eMsg').textContent = m; $('eFrame').classList.toggle('ok', !!ok); } };
    var closed = function () { return !$('eVideo') || $('modal').classList.contains('hidden'); };
    Face.load().catch(function () { }); // โหลดระบบล่วงหน้าระหว่างรอกดเริ่ม
    $('eStart').onclick = async function () {
      var btn = this; btn.disabled = true;
      try {
        status('กำลังเตรียมระบบสแกนใบหน้า...');
        await Face.load();
        if (closed()) return;
        status('กำลังเปิดกล้อง...');
        await Face.start($('eVideo'));
        var r = await Face.enroll($('eVideo'), status, { isCancelled: closed });
        Face.stop();
        status('กำลังบันทึกข้อมูล...', true);
        await api('teacherSave', { teacher: { id: t.id, name: t.name, position: t.position, pin: t.pin, order: t.order, active: t.active, photo: r.photo }, faces: r.faces });
        U.toast('ลงทะเบียนใบหน้า ' + t.name + ' สำเร็จ', 'ok'); closeModal(); views.teachers();
      } catch (e) {
        Face.stop();
        if (e.message === 'ยกเลิก' || closed()) return;
        status(e.message); fail(e); btn.disabled = false; btn.textContent = 'ลองอีกครั้ง';
      }
    };
  }

  // ---------- คำขอลา ----------
  views.leaves = function (filter) {
    filter = filter || 'รออนุมัติ';
    Promise.all([api('leavesList'), api('teachersList')]).then(function (res) {
      var all = res[0], teachers = res[1];
      var list = filter === 'all' ? all : all.filter(function (l) { return l.status === filter; });
      $('view').innerHTML = head('คำขอลา / ไปราชการ', '<button class="btn btn-primary" id="lAdd">+ บันทึกการลาแทน</button>') +
        '<div class="tabs" id="lTabs" style="margin-bottom:16px;max-width:520px">' + ['รออนุมัติ', 'อนุมัติ', 'ไม่อนุมัติ', 'all'].map(function (f) { return '<button data-f="' + f + '" class="' + (f === filter ? 'active' : '') + '">' + (f === 'all' ? 'ทั้งหมด' : f) + '</button>'; }).join('') + '</div>' +
        (list.length ? '<div class="grid" style="gap:12px">' + list.map(function (l) {
          var cls = l.status === 'อนุมัติ' ? 'b-ok' : l.status === 'ไม่อนุมัติ' ? 'b-bad' : 'b-warn';
          return '<div class="card row" style="align-items:flex-start"><div style="flex:1;min-width:220px"><div class="row" style="gap:8px"><b>' + esc(l.name) + '</b><span class="badge b-info">' + esc(l.type) + '</span><span class="badge ' + cls + '">' + esc(l.status) + '</span></div>' +
            '<div class="muted small" style="margin-top:4px">' + U.thaiDate(l.from) + (l.to !== l.from ? ' – ' + U.thaiDate(l.to) : '') + ' · ' + l.days + ' วันทำการ</div>' +
            '<div style="margin-top:6px">' + esc(l.reason || '-') + '</div>' + (l.note ? '<div class="small muted">หมายเหตุ: ' + esc(l.note) + '</div>' : '') + '</div>' +
            '<div class="row" style="gap:6px">' + (l.status === 'รออนุมัติ' ? '<button class="btn btn-sm btn-primary" data-ok="' + esc(l.id) + '">อนุมัติ</button><button class="btn btn-sm btn-danger" data-no="' + esc(l.id) + '">ไม่อนุมัติ</button>' : '') +
            '<button class="btn btn-sm" data-del="' + esc(l.id) + '">ลบ</button></div></div>';
        }).join('') + '</div>' : '<div class="card empty">ไม่มีรายการ</div>');
      $('lTabs').onclick = function (e) { if (e.target.dataset.f) { loading(); views.leaves(e.target.dataset.f); } };
      function set(id, status) {
        var note = status === 'ไม่อนุมัติ' ? prompt('เหตุผลที่ไม่อนุมัติ (ถ้ามี)') || '' : '';
        api('leaveSet', { id: id, status: status, note: note }).then(function () { U.toast(status + 'แล้ว', 'ok'); refreshLeaveCount(); views.leaves(filter); }).catch(fail);
      }
      $('view').querySelectorAll('[data-ok]').forEach(function (b) { b.onclick = function () { set(b.dataset.ok, 'อนุมัติ'); }; });
      $('view').querySelectorAll('[data-no]').forEach(function (b) { b.onclick = function () { set(b.dataset.no, 'ไม่อนุมัติ'); }; });
      $('view').querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { if (confirm('ลบรายการนี้?')) api('leaveDelete', { id: b.dataset.del }).then(function () { refreshLeaveCount(); views.leaves(filter); }).catch(fail); }; });
      $('lAdd').onclick = function () {
        var today = U.todayStr();
        openModal('<h3>บันทึกการลา / ไปราชการแทนครู</h3><p class="muted small">รายการที่บันทึกโดยผู้ดูแลจะอนุมัติทันที</p><form id="laForm">' +
          '<div class="field"><label>ชื่อ - สกุล</label><select name="teacherId" required>' + teachers.filter(function (t) { return t.active; }).map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label>ประเภท</label><select name="type">' + LEAVE_TYPES.map(function (x) { return '<option>' + x + '</option>'; }).join('') + '</select></div>' +
          '<div class="grid g2" style="gap:0 14px"><div class="field"><label>ตั้งแต่</label><input type="date" name="from" value="' + today + '" required></div><div class="field"><label>ถึง</label><input type="date" name="to" value="' + today + '" required></div></div>' +
          '<div class="field"><label>เหตุผล</label><input name="reason"></div>' +
          '<div class="row"><span class="spacer"></span><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn btn-primary">บันทึก</button></div></form>');
        $('laForm').onsubmit = function (e) {
          e.preventDefault();
          api('leaveSave', { leave: formData(e.target) }).then(function () { closeModal(); U.toast('บันทึกแล้ว', 'ok'); views.leaves('อนุมัติ'); }).catch(fail);
        };
      };
    }).catch(fail);
  };

  // ---------- รายงาน Word ----------
  views.reports = function () {
    api('teachersList').then(function (teachers) {
      var today = U.todayStr(), month = today.slice(0, 7);
      var card = function (icon, title, desc, inputs, id) {
        return '<div class="card" style="display:flex;flex-direction:column;gap:12px"><div class="feature"><div class="ic" style="font-size:1.4rem">' + icon + '</div><div><h3 style="margin:0">' + title + '</h3><p class="muted small" style="margin:2px 0 0">' + desc + '</p></div></div>' +
          inputs + '<button class="btn btn-gold" id="' + id + '" style="margin-top:auto">ดาวน์โหลด .docx</button></div>';
      };
      $('view').innerHTML = head('รายงาน (Microsoft Word)') +
        '<p class="muted small" style="margin-top:-8px">ไฟล์ใช้ฟอนต์ TH SarabunPSK มีช่องลงนามผู้ตรวจสอบและผู้อำนวยการ (ตั้งชื่อผู้อำนวยการได้ที่เมนูตั้งค่า)</p>' +
        '<div class="grid g2">' +
        card(U.icon('calendar'), 'บัญชีลงเวลาประจำวัน', 'รายชื่อ เวลามา-กลับ หมายเหตุ สรุปจำนวน', '<input type="date" id="rDate" value="' + today + '">', 'rDaily') +
        card(U.icon('chart'), 'สรุปประจำเดือน', 'จำนวนวันมา สาย ลาป่วย ลากิจ ไปราชการ ขาด รายบุคคล', '<input type="month" id="rMonth" value="' + month + '">', 'rMonthly') +
        card(U.icon('table'), 'บัญชีลงเวลารายเดือน (ตาราง)', 'ตารางรายชื่อ x วันที่ พร้อมสัญลักษณ์ / ส ล ร ข', '<input type="month" id="rMatrix" value="' + month + '">', 'rMatrixBtn') +
        card(U.icon('note'), 'รายงานการลา / ไปราชการ', 'รายการลาทั้งหมดในเดือน พร้อมสถานะอนุมัติ', '<input type="month" id="rLeave" value="' + month + '">', 'rLeaves') +
        card(U.icon('user'), 'รายงานรายบุคคล', 'เวลามา-กลับทุกวันของครู 1 คน ในเดือนที่เลือก',
          '<select id="rPerson">' + teachers.map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>'; }).join('') + '</select><input type="month" id="rPMonth" value="' + month + '">', 'rPersonBtn') +
        '</div>';
      function run(btn, fn) {
        $(btn).onclick = function () {
          var b = this, txt = b.textContent; b.disabled = true; b.innerHTML = '<span class="spinner"></span> กำลังสร้าง...';
          fn().then(function () { U.toast('ดาวน์โหลดรายงานแล้ว', 'ok'); }).catch(fail).finally(function () { b.disabled = false; b.textContent = txt; });
        };
      }
      run('rDaily', function () { return api('daily', { date: $('rDate').value }).then(function (d) { return Report.daily(S, d); }); });
      run('rMonthly', function () { return api('monthly', { month: $('rMonth').value }).then(function (d) { return Report.monthly(S, d); }); });
      run('rMatrixBtn', function () { return api('monthly', { month: $('rMatrix').value }).then(function (d) { return Report.matrix(S, d); }); });
      run('rLeaves', function () { return api('leavesList').then(function (l) { return Report.leaves(S, l, $('rLeave').value); }); });
      run('rPersonBtn', function () {
        var m = $('rPMonth').value;
        return api('monthly', { month: m }).then(function (d) { return Report.person(S, d.rows.filter(function (r) { return r.id === $('rPerson').value; })[0], m); });
      });
    }).catch(fail);
  };

  // ---------- ข่าวสาร ----------
  views.news = function () {
    API.call('getPublic').then(function (d) {
      $('view').innerHTML = head('ข่าวประชาสัมพันธ์', '<button class="btn btn-primary" id="nAdd">+ เพิ่มข่าว</button>') +
        (d.news.length ? '<div class="grid g3">' + d.news.map(function (n) {
          return '<div class="card news-card" style="cursor:default"><div class="news-img">' + (n.image ? '<img src="' + esc(n.image) + '" alt="">' : U.icon('news')) + '</div><div class="news-body">' +
            '<span class="badge">' + esc(n.category || 'ข่าวประชาสัมพันธ์') + '</span> <span class="small muted">' + (String(n.pinned) === 'true' ? 'ปักหมุด · ' : '') + U.thaiDate(n.date, true) + '</span><h3>' + esc(n.title) + '</h3><p>' + esc(n.body) + '</p>' +
            '<div class="row" style="margin-top:12px"><button class="btn btn-sm" data-edit="' + esc(n.id) + '">แก้ไข</button><button class="btn btn-sm btn-danger" data-del="' + esc(n.id) + '">ลบ</button></div></div></div>';
        }).join('') + '</div>' : '<div class="card empty">ยังไม่มีข่าว</div>');
      var byId = {}; d.news.forEach(function (n) { byId[n.id] = n; });
      $('nAdd').onclick = function () { editNews({ date: U.todayStr(), category: NEWS_CATEGORIES[0] }); };
      $('view').querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { editNews(byId[b.dataset.edit]); }; });
      $('view').querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { if (confirm('ลบข่าวนี้?')) api('newsDelete', { id: b.dataset.del }).then(function () { views.news(); }).catch(fail); }; });
    }).catch(fail);
  };
  function editNews(n) {
    var imageData = null;
    openModal('<h3>' + (n.id ? 'แก้ไขข่าว' : 'เพิ่มข่าว') + '</h3><form id="nForm">' +
      '<div class="field"><label>หัวข้อข่าว</label><input name="title" required value="' + esc(n.title || '') + '"></div>' +
      '<div class="field"><label>รายละเอียด</label><textarea name="body" rows="6">' + esc(n.body || '') + '</textarea></div>' +
      '<div class="grid g2" style="gap:0 14px"><div class="field"><label>หมวด</label><select name="category">' + NEWS_CATEGORIES.map(function (c) { return '<option' + (c === (n.category || NEWS_CATEGORIES[0]) ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>วันที่</label><input type="date" name="date" value="' + esc(n.date || '') + '"></div></div>' +
      '<div class="field"><label>รูปภาพ</label><input type="file" accept="image/*" id="nFile"></div>' +
      '<div class="field"><label>ลิงก์ดูเพิ่มเติม (ไม่บังคับ)</label><input name="link" value="' + esc(n.link || '') + '" placeholder="เช่น ลิงก์โพสต์ Facebook หรืออัลบั้มรูป Google Drive"></div>' +
      '<div class="field"><label>หรือใส่ลิงก์รูปภาพ</label><input name="image" value="' + esc(n.image && n.image.indexOf('data:') !== 0 ? n.image : '') + '" placeholder="https://..."></div>' +
      '<img id="nPrev" style="border-radius:14px;margin-bottom:14px;max-height:200px;object-fit:cover;width:100%' + (n.image ? '' : ';display:none') + '" src="' + esc(n.image || '') + '">' +
      '<label class="row" style="font-weight:400;margin-bottom:18px"><input type="checkbox" name="pinned"' + (String(n.pinned) === 'true' ? ' checked' : '') + '> ปักหมุดไว้ด้านบน</label>' +
      '<div class="row"><span class="spacer"></span><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn btn-primary">บันทึก</button></div></form>');
    $('nFile').onchange = function () {
      if (!this.files[0]) return;
      U.resizeImage(this.files[0], 1200, 0.8).then(function (url) { imageData = url; $('nPrev').src = url; $('nPrev').style.display = ''; });
    };
    $('nForm').onsubmit = function (e) {
      e.preventDefault();
      var f = formData(e.target), btn = e.target.querySelector('.btn-primary'); btn.disabled = true;
      api('newsSave', { news: { id: n.id, title: f.title, body: f.body, date: f.date, pinned: !!f.pinned, category: f.category, link: f.link, image: f.image || (imageData ? '' : n.image) }, imageData: imageData })
        .then(function () { closeModal(); U.toast('บันทึกข่าวแล้ว', 'ok'); views.news(); }).catch(function (e) { btn.disabled = false; fail(e); });
    };
  }

  // ---------- ตัวช่วยฟอร์ม ----------
  function inp(s, k, label, attrs, hint) { return '<div class="field"><label>' + label + '</label><input name="' + k + '" value="' + esc(s[k] || '') + '" ' + (attrs || '') + '>' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>'; }
  function area(s, k, label, hint, rows) { return '<div class="field"><label>' + label + '</label><textarea name="' + k + '" rows="' + (rows || 3) + '">' + esc(s[k] || '') + '</textarea>' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>'; }
  function imagePicker(s, k, label, max) {
    return '<div class="field"><label>' + label + '</label><div class="row" style="flex-wrap:nowrap;align-items:flex-start">' +
      '<img data-prev="' + k + '" src="' + esc(s[k] || '') + '" style="width:84px;height:84px;object-fit:cover;border-radius:14px;background:var(--purple-50);flex:none' + (s[k] ? '' : ';visibility:hidden') + '">' +
      '<div style="flex:1;min-width:0"><input name="' + k + '" value="' + esc(s[k] || '') + '" placeholder="ลิงก์รูป https://... หรือเลือกไฟล์ด้านล่าง">' +
      '<input type="file" accept="image/*" data-upload="' + k + '" data-max="' + (max || 1200) + '" style="margin-top:6px"></div></div></div>';
  }
  function bindImagePickers(form) {
    form.querySelectorAll('[data-upload]').forEach(function (fi) {
      fi.onchange = function () {
        if (!fi.files[0]) return;
        var k = fi.dataset.upload, prev = form.querySelector('[data-prev="' + k + '"]');
        U.toast('กำลังอัปโหลดรูป...');
        U.resizeImage(fi.files[0], +fi.dataset.max, 0.82).then(function (data) { return api('uploadImage', { imageData: data, name: k }); })
          .then(function (r) { form[k].value = r.url; prev.src = r.url; prev.style.visibility = ''; U.toast('อัปโหลดแล้ว อย่าลืมกดบันทึก', 'ok'); })
          .catch(fail);
      };
    });
  }
  function collect(form) {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (el.name && el.type !== 'file') out[el.name] = el.value.trim();
      if (el.dataset.toggle) out[el.dataset.toggle] = el.checked ? 'on' : 'off';
    });
    return out;
  }

  // ---------- ข้อมูลเว็บไซต์ ----------
  views.site = function () {
    api('settingsGet').then(function (s) {
      S = s;
      $('view').innerHTML = head('ข้อมูลเว็บไซต์', '<a class="btn" href="index.html" target="_blank">ดูหน้าเว็บ</a><button class="btn btn-primary" id="wSave">บันทึก</button>') +
        '<p class="muted small" style="margin-top:-8px">ข้อมูลในหน้านี้แสดงบนหน้าเว็บโรงเรียน หัวข้อไหนเว้นว่างไว้จะไม่แสดง</p><form id="wForm" class="grid" style="gap:16px">' +
        '<div class="card"><h3>' + U.icon('megaphone') + ' ประกาศ (ข้อความวิ่งด้านบนเว็บ)</h3>' + inp(s, 'announcement', 'ข้อความประกาศ', 'placeholder="เช่น รับสมัครนักเรียนใหม่ ปีการศึกษา 2570 ตั้งแต่วันที่ ..."', 'เว้นว่าง = ไม่แสดงแถบประกาศ') + '</div>' +
        '<div class="card"><h3>' + U.icon('user') + ' ผู้บริหาร</h3><div class="grid g2" style="gap:0 14px">' + inp(s, 'directorName', 'ชื่อผู้อำนวยการ', '', 'ใช้ในช่องลงนามของรายงาน Word ด้วย') + inp(s, 'directorTitle', 'ตำแหน่ง') + '</div>' +
        imagePicker(s, 'directorPhoto', 'รูปผู้อำนวยการ', 600) + area(s, 'directorMessage', 'สารจากผู้อำนวยการ', '', 4) + '</div>' +
        '<div class="card"><h3>' + U.icon('school') + ' ข้อมูลทั่วไป</h3><div class="grid g2" style="gap:0 14px">' +
        inp(s, 'schoolName', 'ชื่อโรงเรียน') + inp(s, 'schoolNameEn', 'ชื่อภาษาอังกฤษ') + inp(s, 'affiliation', 'สังกัด') + inp(s, 'motto', 'ปรัชญา / คำขวัญ') +
        inp(s, 'studentsCount', 'จำนวนนักเรียน', 'type="number"') + inp(s, 'classesCount', 'จำนวนระดับชั้น', 'type="number"') + inp(s, 'founded', 'ปีที่ก่อตั้ง (พ.ศ.)') + inp(s, 'schoolColors', 'สีประจำโรงเรียน') + '</div>' +
        area(s, 'about', 'คำแนะนำโรงเรียน (ย่อหน้าสั้น ๆ)', '', 3) + '</div>' +
        '<div class="card"><h3>' + U.icon('book') + ' ข้อมูลพื้นฐาน</h3>' + area(s, 'history', 'ประวัติโรงเรียน', '', 5) + area(s, 'vision', 'วิสัยทัศน์', '', 3) + area(s, 'mission', 'พันธกิจ', 'ขึ้นบรรทัดใหม่ได้ตามต้องการ', 5) +
        area(s, 'goals', 'เป้าประสงค์', '', 4) + '<div class="grid g2" style="gap:0 14px">' + area(s, 'identity', 'อัตลักษณ์', '', 2) + area(s, 'uniqueness', 'เอกลักษณ์', '', 2) + '</div></div>' +
        '<div class="card"><h3>' + U.icon('phone') + ' ติดต่อ</h3><div class="grid g2" style="gap:0 14px">' + inp(s, 'phone', 'โทรศัพท์') + inp(s, 'email', 'อีเมล') + inp(s, 'facebook', 'ลิงก์เพจ Facebook') + inp(s, 'mapUrl', 'ลิงก์ Google Maps') +
        inp(s, 'address', 'ที่อยู่') + inp(s, 'oitUrl', 'ลิงก์หน้า ITA / OIT', '', 'แสดงเป็นเมนู ITA / OIT') + '</div></div>' +
        '<div class="card"><h3>' + U.icon('image') + ' รูปภาพ</h3><div class="grid g2" style="gap:0 14px">' + imagePicker(s, 'logoUrl', 'โลโก้ (เว้นว่าง = ใช้ตราโรงเรียนเดิม)', 512) + imagePicker(s, 'heroImage', 'ภาพพื้นหลังหน้าแรก (เช่น รูปอาคารเรียน)', 1600) + '</div></div>' +
        '</form>';
      bindImagePickers($('wForm'));
      $('wSave').onclick = function () {
        api('settingsSave', { settings: collect($('wForm')) }).then(function () { U.toast('บันทึกแล้ว', 'ok'); }).catch(fail);
      };
    }).catch(fail);
  };

  // ---------- ปฏิทินกิจกรรม ----------
  views.events = function () {
    API.call('getPublic').then(function (d) {
      var list = (d.events || []).slice().reverse();
      $('view').innerHTML = head('ปฏิทินกิจกรรม', '<button class="btn btn-primary" id="evAdd">+ เพิ่มกิจกรรม</button>') +
        '<p class="muted small" style="margin-top:-8px">กิจกรรมที่ยังไม่ผ่านจะแสดงบนหน้าเว็บ (สูงสุด 6 รายการถัดไป)</p>' +
        (list.length ? '<div class="table-wrap"><table><thead><tr><th>วันที่</th><th>กิจกรรม</th><th>เวลา / สถานที่</th><th></th></tr></thead><tbody>' + list.map(function (e) {
          return '<tr><td style="white-space:nowrap">' + U.thaiDate(e.date, true) + (e.dateEnd ? ' – ' + U.thaiDate(e.dateEnd, true) : '') + '</td><td><b>' + esc(e.title) + '</b><div class="small muted">' + esc(e.detail) + '</div></td><td class="small">' + esc([e.time, e.place].filter(String).join(' · ')) + '</td>' +
            '<td><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn btn-sm" data-edit="' + esc(e.id) + '">แก้ไข</button><button class="btn btn-sm btn-danger" data-del="' + esc(e.id) + '">ลบ</button></div></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="card empty">ยังไม่มีกิจกรรม</div>');
      var byId = {}; list.forEach(function (e) { byId[e.id] = e; });
      $('evAdd').onclick = function () { editEvent({ date: U.todayStr() }); };
      $('view').querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { editEvent(byId[b.dataset.edit]); }; });
      $('view').querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { if (confirm('ลบกิจกรรมนี้?')) api('eventDelete', { id: b.dataset.del }).then(function () { views.events(); }).catch(fail); }; });
    }).catch(fail);
  };
  function editEvent(e) {
    openModal('<h3>' + (e.id ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรม') + '</h3><form id="evForm">' +
      '<div class="field"><label>ชื่อกิจกรรม</label><input name="title" required value="' + esc(e.title || '') + '"></div>' +
      '<div class="grid g2" style="gap:0 14px"><div class="field"><label>วันที่</label><input type="date" name="date" required value="' + esc(e.date || '') + '"></div>' +
      '<div class="field"><label>ถึงวันที่ (ถ้ามีหลายวัน)</label><input type="date" name="dateEnd" value="' + esc(e.dateEnd || '') + '"></div>' +
      '<div class="field"><label>เวลา</label><input name="time" value="' + esc(e.time || '') + '" placeholder="เช่น 09:00 น."></div>' +
      '<div class="field"><label>สถานที่</label><input name="place" value="' + esc(e.place || '') + '"></div></div>' +
      '<div class="field"><label>รายละเอียด</label><input name="detail" value="' + esc(e.detail || '') + '"></div>' +
      '<div class="row"><span class="spacer"></span><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn btn-primary">บันทึก</button></div></form>');
    $('evForm').onsubmit = function (ev) {
      ev.preventDefault();
      api('eventSave', { event: Object.assign({ id: e.id }, formData(ev.target)) }).then(function () { closeModal(); U.toast('บันทึกแล้ว', 'ok'); views.events(); }).catch(fail);
    };
  }

  // ---------- ลิงก์ / เอกสาร ----------
  views.links = function () {
    API.call('getPublic').then(function (d) {
      var list = d.links || [], cats = d.linkCategories || [];
      $('view').innerHTML = head('ลิงก์ / เอกสาร', '<button class="btn btn-primary" id="lkAdd">+ เพิ่มลิงก์</button>') +
        '<p class="muted small" style="margin-top:-8px">ลิงก์หน่วยงาน เอกสารดาวน์โหลด (เช่น ลิงก์ Google Drive) และบริการออนไลน์ แสดงในส่วน “บริการและลิงก์” ของหน้าเว็บ</p>' +
        (list.length ? '<div class="table-wrap"><table><thead><tr><th>ลำดับ</th><th>ชื่อ</th><th>หมวด</th><th></th></tr></thead><tbody>' + list.map(function (l) {
          return '<tr><td>' + esc(l.order) + '</td><td><a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.title) + '</a></td><td><span class="badge">' + esc(l.category) + '</span></td>' +
            '<td><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn btn-sm" data-edit="' + esc(l.id) + '">แก้ไข</button><button class="btn btn-sm btn-danger" data-del="' + esc(l.id) + '">ลบ</button></div></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="card empty">ยังไม่มีลิงก์</div>');
      var byId = {}; list.forEach(function (l) { byId[l.id] = l; });
      function edit(l) {
        openModal('<h3>' + (l.id ? 'แก้ไขลิงก์' : 'เพิ่มลิงก์') + '</h3><form id="lkForm">' +
          '<div class="field"><label>ชื่อที่แสดง</label><input name="title" required value="' + esc(l.title || '') + '"></div>' +
          '<div class="field"><label>ลิงก์ (URL)</label><input name="url" required value="' + esc(l.url || '') + '" placeholder="https://..."></div>' +
          '<div class="grid g2" style="gap:0 14px"><div class="field"><label>หมวด</label><select name="category">' + cats.map(function (c) { return '<option' + (c === l.category ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label>ลำดับ</label><input type="number" name="order" value="' + esc(l.order || '') + '"></div></div>' +
          '<div class="row"><span class="spacer"></span><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn btn-primary">บันทึก</button></div></form>');
        $('lkForm').onsubmit = function (ev) {
          ev.preventDefault();
          api('linkSave', { link: Object.assign({ id: l.id }, formData(ev.target)) }).then(function () { closeModal(); U.toast('บันทึกแล้ว', 'ok'); views.links(); }).catch(fail);
        };
      }
      $('lkAdd').onclick = function () { edit({ category: cats[0] }); };
      $('view').querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { edit(byId[b.dataset.edit]); }; });
      $('view').querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { if (confirm('ลบลิงก์นี้?')) api('linkDelete', { id: b.dataset.del }).then(function () { views.links(); }).catch(fail); }; });
    }).catch(fail);
  };

  // ---------- ตั้งค่าระบบลงเวลา ----------
  views.settings = function () {
    api('settingsGet').then(function (s) {
      S = s;
      var toggle = function (k, label) { return '<label class="row" style="font-weight:400;margin-bottom:12px"><input type="checkbox" data-toggle="' + k + '"' + (s[k] === 'on' ? ' checked' : '') + '> ' + label + '</label>'; };
      $('view').innerHTML = head('ตั้งค่าระบบลงเวลา', '<button class="btn btn-primary" id="sSave">บันทึกการตั้งค่า</button>') + '<form id="sForm" class="grid" style="gap:16px">' +
        '<div class="card"><h3>' + U.icon('pin') + ' พิกัดโรงเรียน (GPS)</h3><p class="muted small">ครูลงเวลาได้เฉพาะเมื่ออยู่ในรัศมีที่กำหนดจากจุดนี้ ถ้าจุดยังไม่ตรงกลางโรงเรียน ให้ไปยืนกลางโรงเรียนแล้วกด “ใช้ตำแหน่งปัจจุบัน”</p>' +
        '<div class="grid g3" style="gap:0 14px">' + inp(s, 'lat', 'ละติจูด', 'inputmode="decimal"') + inp(s, 'lng', 'ลองจิจูด', 'inputmode="decimal"') + inp(s, 'radius', 'รัศมีที่อนุญาต (เมตร)', 'type="number" min="30"') + '</div>' +
        '<div class="row"><button type="button" class="btn btn-gold" id="sHere">' + U.icon('pin') + ' ใช้ตำแหน่งปัจจุบัน</button><span class="small muted" id="sHereInfo"></span></div>' +
        '<div id="sMap" style="margin-top:14px"></div>' +
        '<div class="grid g3" style="gap:0 14px;margin-top:10px">' + inp(s, 'gpsMaxAccuracy', 'ความคลาดเคลื่อน GPS สูงสุด (เมตร)', 'type="number" min="10"', 'ถ้าสัญญาณแย่กว่านี้จะให้ลองใหม่') + '</div></div>' +

        '<div class="card"><h3>' + U.icon('clock') + ' เวลาปฏิบัติราชการ</h3><div class="grid g3" style="gap:0 14px">' + inp(s, 'workStart', 'เวลาเข้างาน (หลังจากนี้ = สาย)', 'type="time"') + inp(s, 'workEnd', 'เวลาเลิกงาน', 'type="time"') + '</div>' +
        area(s, 'holidays', 'วันหยุดราชการ / วันหยุดโรงเรียน', 'บรรทัดละ 1 วัน รูปแบบ ปปปป-ดด-วว (ปี ค.ศ.) ตามด้วยชื่อวันหยุด เช่น 2026-12-05 วันพ่อแห่งชาติ · เสาร์-อาทิตย์เป็นวันหยุดอัตโนมัติ', 5) + '</div>' +

        '<div class="card"><h3>' + U.icon('face') + ' การสแกนใบหน้า</h3>' + toggle('liveness', 'ตรวจการกระพริบตา (ป้องกันการใช้รูปถ่ายมาสแกน)') +
        '<div class="grid g3" style="gap:0 14px">' + inp(s, 'faceThreshold', 'ความเข้มงวดการจับคู่ใบหน้า', 'type="number" step="0.01" min="0.3" max="0.7"', 'ค่าน้อย = เข้มงวดขึ้น (แนะนำ 0.45–0.55)') + '</div></div>' +

        '</form>';

      function drawMap() {
        var f = $('sForm'), lat = f.lat.value, lng = f.lng.value;
        $('sMap').innerHTML = lat && lng ? '<iframe class="map" style="height:260px" loading="lazy" src="https://maps.google.com/maps?q=' + encodeURIComponent(lat + ',' + lng) + '&z=17&output=embed"></iframe>' : '';
      }
      drawMap();
      $('sForm').lat.onchange = $('sForm').lng.onchange = drawMap;
      $('sHere').onclick = function () {
        $('sHereInfo').textContent = 'กำลังหาตำแหน่ง...';
        U.getPosition().then(function (p) {
          $('sForm').lat.value = p.lat.toFixed(6); $('sForm').lng.value = p.lng.toFixed(6);
          $('sHereInfo').textContent = 'ได้ตำแหน่งแล้ว (±' + Math.round(p.accuracy) + ' ม.) อย่าลืมกดบันทึก'; drawMap();
        }).catch(function (e) { $('sHereInfo').textContent = e.message; });
      };
      $('sSave').onclick = function () {
        api('settingsSave', { settings: collect($('sForm')) }).then(function () { U.toast('บันทึกการตั้งค่าแล้ว', 'ok'); views.settings(); }).catch(fail);
      };
    }).catch(fail);
  };

  // ---------- บัญชีผู้ดูแล ----------
  views.users = function () {
    api('usersList').then(function (list) {
      $('view').innerHTML = head('บัญชีผู้ดูแล', '<button class="btn btn-primary" id="uAdd">+ เพิ่มบัญชี</button>') +
        '<p class="muted small" style="margin-top:-8px"><b>ผู้ดูแลระบบ</b> ใช้ได้ทุกเมนู · <b>ผู้จัดการเนื้อหาเว็บ</b> แก้ได้เฉพาะข่าว ปฏิทิน ลิงก์ และข้อมูลหน้าเว็บ (เหมาะกับครูที่ดูแลประชาสัมพันธ์) · บัญชีใหม่ต้องเปลี่ยนรหัสเองเมื่อเข้าใช้ครั้งแรก</p>' +
        (list.length ? '<div class="table-wrap"><table><thead><tr><th>ชื่อผู้ใช้</th><th>ชื่อ</th><th>สิทธิ์</th><th>สถานะ</th><th></th></tr></thead><tbody>' + list.map(function (u) {
          return '<tr><td><b>' + esc(u.username) + '</b>' + (ME && u.id === ME.id ? ' <span class="badge">คุณ</span>' : '') + '</td><td>' + esc(u.name) + '<div class="small muted">' + (u.email ? esc(u.email) : '<span style="color:var(--warn)">ยังไม่มีอีเมล (ใช้ลืมรหัสไม่ได้)</span>') + '</div></td><td>' + esc(ADMIN_ROLES[u.role] || u.role) + '</td>' +
            '<td>' + (u.locked ? badge('late', 'ถูกล็อกชั่วคราว') : u.active ? badge('present', 'ใช้งาน') : badge('off', 'ปิดใช้งาน')) + '</td>' +
            '<td><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn btn-sm" data-edit="' + esc(u.id) + '">แก้ไข / รีเซ็ตรหัส</button>' + (ME && u.id !== ME.id ? '<button class="btn btn-sm btn-danger" data-del="' + esc(u.id) + '">ลบ</button>' : '') + '</div></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="card empty">ยังไม่มีบัญชี</div>');
      var byId = {}; list.forEach(function (u) { byId[u.id] = u; });
      function edit(u) {
        openModal('<h3>' + (u.id ? 'แก้ไขบัญชี' : 'เพิ่มบัญชีผู้ดูแล') + '</h3><form id="uForm">' +
          '<div class="grid g2" style="gap:0 14px"><div class="field"><label>ชื่อผู้ใช้ (ภาษาอังกฤษ/ตัวเลข)</label><input name="username" required autocapitalize="none" value="' + esc(u.username || '') + '"></div>' +
          '<div class="field"><label>ชื่อที่แสดง</label><input name="name" value="' + esc(u.name || '') + '" placeholder="เช่น ครูสมใจ (ประชาสัมพันธ์)"></div></div>' +
          '<div class="grid g2" style="gap:0 14px"><div class="field"><label>สิทธิ์</label><select name="role"><option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>ผู้ดูแลระบบ (ทุกเมนู)</option><option value="editor"' + (u.role === 'editor' ? ' selected' : '') + '>ผู้จัดการเนื้อหาเว็บ</option></select></div>' +
          '<div class="field"><label>อีเมล (สำหรับลืมรหัสผ่าน)</label><input type="email" name="email" value="' + esc(u.email || '') + '"></div></div>' +
          '<div class="field"><label>' + (u.id ? 'รีเซ็ตรหัสผ่าน (เว้นว่าง = ไม่เปลี่ยน)' : 'รหัสผ่านเริ่มต้น') + '</label><div class="row" style="flex-wrap:nowrap"><input name="password" autocomplete="new-password" style="font-family:monospace"' + (u.id ? '' : ' required value="' + strongPassword(12) + '"') + '><button type="button" class="btn btn-sm" id="uGen">สุ่ม</button></div><div class="hint">จดรหัสนี้ไปบอกเจ้าของบัญชี · ผู้ใช้จะต้องเปลี่ยนรหัสเองเมื่อเข้าใช้ครั้งแรก</div></div>' +
          '<label class="row" style="font-weight:400;margin-bottom:18px"><input type="checkbox" name="active"' + (u.active !== false ? ' checked' : '') + '> เปิดใช้งาน</label>' +
          '<div class="row"><span class="spacer"></span><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn btn-primary">บันทึก</button></div></form>');
        $('uGen').onclick = function () { $('uForm').password.value = strongPassword(12); };
        $('uForm').onsubmit = function (e) {
          e.preventDefault();
          var f = formData(e.target);
          api('userSave', { user: { id: u.id, username: f.username, name: f.name, role: f.role, email: f.email, active: !!f.active }, userPassword: f.password || undefined })
            .then(function () { closeModal(); U.toast('บันทึกแล้ว', 'ok'); views.users(); }).catch(fail);
        };
      }
      $('uAdd').onclick = function () { edit({ role: 'editor', active: true }); };
      $('view').querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { edit(byId[b.dataset.edit]); }; });
      $('view').querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { if (confirm('ลบบัญชีนี้?')) api('userDelete', { id: b.dataset.del }).then(function () { views.users(); }).catch(fail); }; });
    }).catch(fail);
  };
})();
