/* สร้างรายงานเป็นไฟล์ Word (.docx) ในเบราว์เซอร์ ด้วยไลบรารี docx */
(function () {
  var DOCX_URL = 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js';
  var FONT = 'TH SarabunPSK';
  var loading = null;
  function loadDocx() {
    if (window.docx) return Promise.resolve(window.docx);
    if (!loading) loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = DOCX_URL;
      s.onload = function () { resolve(window.docx); };
      s.onerror = function () { loading = null; reject(new Error('โหลดตัวสร้างไฟล์ Word ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function build(d, opts) {
    var A = d.AlignmentType;
    function P(text, o) {
      o = o || {};
      return new d.Paragraph({
        alignment: o.align || A.LEFT, spacing: { before: o.before || 0, after: o.after || 0 }, indent: o.indent ? { left: o.indent } : undefined,
        children: [new d.TextRun({ text: String(text == null ? '' : text), bold: !!o.bold, size: (o.size || 16) * 2, font: FONT, color: o.color })]
      });
    }
    function cell(text, o) {
      o = o || {};
      return new d.TableCell({
        children: [P(text, { align: o.align || A.CENTER, bold: o.bold, size: o.size || opts.cellSize || 14, color: o.color })],
        shading: o.fill ? { fill: o.fill, type: d.ShadingType.CLEAR, color: 'auto' } : undefined,
        verticalAlign: d.VerticalAlign.CENTER, width: o.width ? { size: o.width, type: d.WidthType.PERCENTAGE } : undefined,
        margins: { top: 40, bottom: 40, left: 70, right: 70 }
      });
    }
    function table(headers, rows, widths, aligns) {
      return new d.Table({
        width: { size: 100, type: d.WidthType.PERCENTAGE },
        rows: [new d.TableRow({ tableHeader: true, children: headers.map(function (h, i) { return cell(h, { bold: true, fill: 'EFE6F9', width: widths && widths[i] }); }) })]
          .concat(rows.map(function (r) {
            return new d.TableRow({ cantSplit: true, children: r.map(function (v, i) { return cell(v, { align: aligns && aligns[i], width: widths && widths[i], color: /สาย|ขาด/.test(String(v)) && i > 1 ? 'B42318' : undefined }); }) });
          }))
      });
    }
    return { P: P, cell: cell, table: table, A: A };
  }

  function signature(h, s) {
    return [
      h.P('', { after: 200 }),
      h.P('ลงชื่อ ......................................................... ผู้ตรวจสอบ', { align: h.A.RIGHT, before: 300 }),
      h.P('(.........................................................)', { align: h.A.RIGHT, after: 200 }),
      h.P('ลงชื่อ ......................................................... ', { align: h.A.RIGHT, before: 300 }),
      h.P('(' + (s.directorName || '.........................................................') + ')', { align: h.A.RIGHT }),
      h.P(s.directorTitle || 'ผู้อำนวยการโรงเรียน', { align: h.A.RIGHT })
    ];
  }
  function header(h, s, title, sub) {
    return [
      h.P(title, { align: h.A.CENTER, bold: true, size: 20 }),
      h.P(s.schoolName + (s.affiliation ? '  ' + s.affiliation : ''), { align: h.A.CENTER, size: 16 }),
      h.P(sub, { align: h.A.CENTER, size: 16, after: 200 })
    ];
  }
  async function save(d, sections, filename) {
    var doc = new d.Document({
      creator: 'ระบบลงเวลาโรงเรียน', title: filename,
      styles: { default: { document: { run: { font: FONT, size: 32 } } } },
      sections: sections
    });
    var blob = await d.Packer.toBlob(doc);
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename + '.docx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }
  var MARGIN = { top: 1000, bottom: 900, left: 1000, right: 1000 };
  var portrait = { page: { margin: MARGIN } };
  var landscape = { page: { margin: { top: 800, bottom: 700, left: 700, right: 700 }, size: { orientation: 'landscape', width: 11906, height: 16838 } } };
  var printed = function () { return 'พิมพ์เมื่อ ' + new Date().toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' }) + ' น.'; };

  /* 1) บัญชีลงเวลาประจำวัน */
  async function daily(s, data) {
    var d = await loadDocx(), h = build(d, {});
    var rows = data.list.map(function (t, i) {
      var note = t.status === 'late' ? 'มาสาย' : t.status === 'absent' ? 'ขาด' : (t.status === 'leave' || t.status === 'official') ? t.label + (t.note ? ' (' + t.note + ')' : '') : (t.note || '');
      return [i + 1, t.name, t.position, t.timeIn ? U.hm(t.timeIn) : '-', t.timeOut ? U.hm(t.timeOut) : '-', note];
    });
    var c = data.count;
    var children = header(h, s, 'บัญชีลงเวลาปฏิบัติราชการ', 'วัน' + U.thaiDay(data.date) + 'ที่ ' + U.thaiDate(data.date) + (data.holiday ? ' (' + data.holiday + ')' : ''))
      .concat([h.table(['ที่', 'ชื่อ - สกุล', 'ตำแหน่ง', 'เวลามา', 'เวลากลับ', 'หมายเหตุ'], rows, [6, 30, 20, 11, 11, 22], [h.A.CENTER, h.A.LEFT, h.A.LEFT, h.A.CENTER, h.A.CENTER, h.A.LEFT]),
        h.P('สรุป: ข้าราชการครูและบุคลากรทั้งหมด ' + data.total + ' คน  มาปฏิบัติราชการ ' + (c.present + c.late) + ' คน  มาสาย ' + c.late + ' คน  ลา ' + c.leave + ' คน  ไปราชการ ' + c.official + ' คน  ขาด ' + c.absent + ' คน', { before: 200 }),
        h.P('เวลาปฏิบัติราชการ ' + s.workStart + ' - ' + s.workEnd + ' น.', { size: 14, color: '666666' })])
      .concat(signature(h, s)).concat([h.P(printed(), { size: 12, color: '888888', before: 300 })]);
    await save(d, [{ properties: portrait, children: children }], 'บัญชีลงเวลา_' + data.date);
  }

  /* 2) สรุปการปฏิบัติราชการประจำเดือน */
  async function monthly(s, data) {
    var d = await loadDocx(), h = build(d, {});
    var rows = data.rows.map(function (r, i) {
      var c = r.count;
      return [i + 1, r.name, c.workDays, c.present, c.late, c.sick, c.personal, c.official, c.otherLeave, c.absent, c.earlyOut, ''];
    });
    var tot = data.rows.reduce(function (a, r) { ['present', 'late', 'sick', 'personal', 'official', 'otherLeave', 'absent'].forEach(function (k) { a[k] = (a[k] || 0) + r.count[k]; }); return a; }, {});
    var children = header(h, s, 'รายงานสรุปการปฏิบัติราชการของข้าราชการครูและบุคลากร', 'ประจำเดือน' + U.thaiMonth(data.month))
      .concat([h.table(['ที่', 'ชื่อ - สกุล', 'วันทำการ', 'มา', 'สาย', 'ลาป่วย', 'ลากิจ', 'ไปราชการ', 'ลาอื่น', 'ขาด', 'กลับก่อน', 'หมายเหตุ'], rows,
        [5, 27, 7, 6, 6, 7, 7, 8, 7, 6, 7, 7], [h.A.CENTER, h.A.LEFT]),
        h.P('รวมทั้งหมด: มาปฏิบัติราชการ ' + tot.present + ' ครั้ง  มาสาย ' + tot.late + ' ครั้ง  ลาป่วย ' + tot.sick + ' วัน  ลากิจ ' + tot.personal + ' วัน  ไปราชการ ' + tot.official + ' วัน  ขาด ' + tot.absent + ' วัน', { before: 200 })])
      .concat(signature(h, s)).concat([h.P(printed(), { size: 12, color: '888888', before: 300 })]);
    await save(d, [{ properties: landscape, children: children }], 'สรุปประจำเดือน_' + data.month);
  }

  /* 3) บัญชีลงเวลารายเดือนแบบตาราง (ครู x วันที่) */
  async function matrix(s, data) {
    var d = await loadDocx(), h = build(d, { cellSize: 10 });
    var mark = { present: '/', late: 'ส', leave: 'ล', official: 'ร', absent: 'ข', off: '', future: '', waiting: '' };
    var days = data.rows.length ? data.rows[0].days : [];
    var headers = ['ที่', 'ชื่อ - สกุล'].concat(days.map(function (x) { return String(+x.date.slice(8)); })).concat(['มา', 'สาย', 'ลา', 'ขาด']);
    var widths = [3, 18].concat(days.map(function () { return 65 / days.length; })).concat([3.5, 3.5, 3.5, 3.5]);
    var rows = data.rows.map(function (r, i) {
      var c = r.count;
      return [i + 1, r.name].concat(r.days.map(function (x) { return x.status === 'off' ? '-' : mark[x.status]; }))
        .concat([c.present, c.late, c.sick + c.personal + c.otherLeave + c.official, c.absent]);
    });
    var children = header(h, s, 'บัญชีลงเวลาปฏิบัติราชการรายเดือน', 'ประจำเดือน' + U.thaiMonth(data.month))
      .concat([h.table(headers, rows, widths, [h.A.CENTER, h.A.LEFT]),
        h.P('สัญลักษณ์:  /  มาปฏิบัติราชการ    ส  มาสาย    ล  ลา    ร  ไปราชการ    ข  ขาด    -  วันหยุด', { size: 14, before: 160 })])
      .concat(signature(h, s));
    await save(d, [{ properties: landscape, children: children }], 'บัญชีลงเวลารายเดือน_' + data.month);
  }

  /* 4) รายงานรายบุคคล */
  async function person(s, row, month) {
    if (!row) throw new Error('ไม่มีข้อมูล');
    var d = await loadDocx(), h = build(d, {});
    var rows = row.days.filter(function (x) { return x.status !== 'future'; }).map(function (x) {
      return [U.thaiDate(x.date, true), U.thaiDay(x.date), x.timeIn ? U.hm(x.timeIn) : '-', x.timeOut ? U.hm(x.timeOut) : '-', x.status === 'off' ? x.label : x.status === 'present' ? (x.label === 'ตรงเวลา' ? 'มาปฏิบัติราชการ' : x.label) : x.label];
    });
    var c = row.count;
    var children = header(h, s, 'รายงานการลงเวลาปฏิบัติราชการรายบุคคล', 'ประจำเดือน' + U.thaiMonth(month))
      .concat([h.P('ชื่อ - สกุล  ' + row.name + '    ตำแหน่ง  ' + (row.position || '-'), { bold: true, after: 160 }),
        h.table(['วันที่', 'วัน', 'เวลามา', 'เวลากลับ', 'สถานะ'], rows, [20, 18, 16, 16, 30]),
        h.P('สรุป: วันทำการ ' + c.workDays + ' วัน  มา ' + c.present + ' วัน  สาย ' + c.late + ' ครั้ง  ลาป่วย ' + c.sick + ' วัน  ลากิจ ' + c.personal + ' วัน  ไปราชการ ' + c.official + ' วัน  ขาด ' + c.absent + ' วัน', { before: 200 }),
        h.P('ลงชื่อ ......................................................... ผู้รายงาน', { align: h.A.RIGHT, before: 400 }),
        h.P('(' + row.name + ')', { align: h.A.RIGHT })])
      .concat(signature(h, s).slice(3));
    await save(d, [{ properties: portrait, children: children }], 'รายงาน_' + row.name.replace(/\s*\(.*\)/, '') + '_' + month);
  }

  /* 5) รายงานการลา */
  async function leaves(s, list, month) {
    var d = await loadDocx(), h = build(d, {});
    var items = list.filter(function (l) { return l.from.slice(0, 7) <= month && l.to.slice(0, 7) >= month; });
    var rows = items.map(function (l, i) { return [i + 1, l.name, l.type, U.thaiDate(l.from, true) + (l.to !== l.from ? ' - ' + U.thaiDate(l.to, true) : ''), l.days, l.reason || '-', l.status]; });
    if (!rows.length) rows = [['', 'ไม่มีรายการ', '', '', '', '', '']];
    var children = header(h, s, 'รายงานการลาและการไปราชการ', 'ประจำเดือน' + U.thaiMonth(month))
      .concat([h.table(['ที่', 'ชื่อ - สกุล', 'ประเภท', 'วันที่', 'จำนวนวัน', 'เหตุผล', 'สถานะ'], rows, [5, 24, 13, 20, 8, 20, 10], [h.A.CENTER, h.A.LEFT, h.A.LEFT, h.A.LEFT, h.A.CENTER, h.A.LEFT])])
      .concat(signature(h, s));
    await save(d, [{ properties: portrait, children: children }], 'รายงานการลา_' + month);
  }

  window.Report = { daily: daily, monthly: monthly, matrix: matrix, person: person, leaves: leaves };
})();
