/* สแกนใบหน้าด้วย face-api.js (ประมวลผลในเครื่อง ไม่ส่งภาพไปบุคคลที่สาม) */
(function () {
  var MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/';
  var WASM_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.16.0/dist/';
  var loading = null, stream = null;

  // ใช้ WASM เป็นหลัก: ครั้งแรกเร็ว (~0.2 วินาที) ไม่ต้องคอมไพล์กราฟิกแบบ WebGL ที่ทำให้หน้าค้าง ~10 วินาทีบนการ์ดจอ Intel
  function pickBackend() {
    var tf = faceapi.tf;
    try { tf.setWasmPaths(WASM_URL); } catch (e) { /* ไม่มี WASM ในชุดนี้ */ }
    return tf.setBackend('wasm').then(function (ok) { if (!ok) throw new Error('wasm'); return tf.ready(); })
      .catch(function () { return tf.setBackend('webgl').then(function () { return tf.ready(); }); });
  }

  function load() {
    if (!loading) loading = pickBackend().then(function () {
      return Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
    }).catch(function (e) { loading = null; throw new Error('โหลดระบบสแกนใบหน้าไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'); });
    return loading;
  }

  function start(video) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.reject(new Error('เบราว์เซอร์นี้ไม่รองรับกล้อง (ต้องเปิดผ่าน https)'));
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      .then(function (s) { stream = s; video.srcObject = s; video.setAttribute('playsinline', ''); video.muted = true; return video.play(); })
      .catch(function (e) { throw new Error(e.name === 'NotAllowedError' ? 'กรุณาอนุญาตให้เว็บใช้กล้อง' : 'เปิดกล้องไม่สำเร็จ: ' + e.message); });
  }
  function stop() { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }

  function detect(video) {
    return faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
      .withFaceLandmarks().withFaceDescriptor();
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function ear(eye) { return (dist(eye[1], eye[5]) + dist(eye[2], eye[4])) / (2 * dist(eye[0], eye[3])); }
  function eyeRatio(lm) { return (ear(lm.getLeftEye()) + ear(lm.getRightEye())) / 2; }
  function average(list) {
    var out = new Array(128).fill(0);
    list.forEach(function (d) { for (var i = 0; i < 128; i++) out[i] += d[i] / list.length; });
    return out.map(function (v) { return Math.round(v * 10000) / 10000; });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var MIN_FACE = 0.14; // ความกว้างใบหน้าขั้นต่ำเทียบกับภาพ (กล้องโน้ตบุ๊กมุมกว้าง หน้าจะเล็กกว่ากล้องมือถือ)

  /*
   * สแกนเพื่อลงเวลา: รอให้หน้าอยู่ในกรอบ (และกระพริบตาถ้าเปิดตรวจสิ่งมีชีวิต)
   * opts: { liveness: bool, onStatus(text, ok), isCancelled() }
   */
  async function scan(video, opts) {
    opts = opts || {};
    var status = opts.onStatus || function () {};
    var samples = [], opened = false, blinked = !opts.liveness, t0 = Date.now();
    await waitForVideo(video);
    while (true) {
      if (opts.isCancelled && opts.isCancelled()) throw new Error('ยกเลิก');
      if (Date.now() - t0 > 40000) throw new Error('หมดเวลา ไม่สามารถตรวจจับใบหน้าได้ ลองอีกครั้งในที่มีแสงสว่าง');
      var r = await detect(video);
      if (!r) { status('ไม่พบใบหน้า — มองตรงไปที่กล้อง', false); samples = []; await sleep(80); continue; }
      var size = r.detection.box.width / video.videoWidth;
      if (size < MIN_FACE) { status('ขยับเข้ามาใกล้กล้องอีกนิด', false); await sleep(80); continue; }
      var e = eyeRatio(r.landmarks);
      if (!blinked) {
        if (e > 0.26) { opened = true; samples.push(Array.from(r.descriptor)); }
        else if (opened && e < 0.21) { blinked = true; status('ตรวจพบการกระพริบตาแล้ว', true); }
        if (samples.length > 5) samples.shift();
        if (!blinked) { status('กระพริบตา 1 ครั้งเพื่อยืนยันตัวตน', true); continue; }
      } else if (e > 0.24) samples.push(Array.from(r.descriptor));
      if (samples.length >= 3) {
        status('กำลังตรวจสอบ...', true);
        var photo = await U.resizeImage(video, 320, 0.7);
        return { descriptor: average(samples.slice(-3)), photo: photo };
      }
      status('ถือนิ่ง ๆ ...', true);
    }
  }

  // รอให้กล้องส่งภาพจริงก่อน (บางเครื่องภาพแรกยังว่าง ทำให้ตรวจจับไม่เจอ)
  async function waitForVideo(video) {
    for (var i = 0; i < 50 && !(video.videoWidth && video.readyState >= 2); i++) await sleep(100);
    if (!video.videoWidth) throw new Error('กล้องยังไม่ส่งภาพ กรุณาปิดแล้วลองใหม่');
  }

  /* ลงทะเบียนใบหน้า: เก็บ 3 ตัวอย่างจากมุมต่างกันเล็กน้อย
     opts.isCancelled() ให้กดยกเลิกกลางทางได้ */
  async function enroll(video, onStatus, opts) {
    opts = opts || {};
    var prompts = ['มองตรงไปที่กล้อง', 'หันหน้าไปทางซ้ายเล็กน้อย', 'หันหน้าไปทางขวาเล็กน้อย'];
    var faces = [], photo = '', t0 = Date.now();
    await waitForVideo(video);
    for (var i = 0; i < prompts.length; i++) {
      onStatus(prompts[i] + ' (' + (i + 1) + '/3)', true);
      await sleep(1000);
      var got = [], r = null;
      while (got.length < 3) {
        if (opts.isCancelled && opts.isCancelled()) throw new Error('ยกเลิก');
        if (Date.now() - t0 > 45000) throw new Error('ตรวจจับใบหน้าไม่ได้ภายในเวลาที่กำหนด กรุณาอยู่ในที่มีแสงสว่าง หันหน้าเข้ากล้อง แล้วลองใหม่');
        var d = await detect(video);
        if (!d) onStatus('ไม่พบใบหน้า — ' + prompts[i], false);
        else if (d.detection.box.width / video.videoWidth < MIN_FACE) onStatus('ขยับเข้ามาใกล้กล้องอีกนิด', false);
        else { r = d; got.push(Array.from(d.descriptor)); onStatus(prompts[i] + ' (' + (i + 1) + '/3) · ' + '●'.repeat(got.length) + '○'.repeat(3 - got.length), true); }
        await sleep(60); // เว้นจังหวะให้หน้าจอไม่ค้าง
      }
      faces.push(average(got));
      if (i === 0) {
        var c = document.createElement('canvas'), b = r.detection.box, pad = b.width * 0.35;
        var sx = Math.max(0, b.x - pad), sy = Math.max(0, b.y - pad * 1.2), sw = Math.min(video.videoWidth - sx, b.width + pad * 2), sh = Math.min(video.videoHeight - sy, b.height + pad * 2.2);
        var side = Math.min(sw, sh); c.width = c.height = 240;
        c.getContext('2d').drawImage(video, sx + (sw - side) / 2, sy + (sh - side) / 2, side, side, 0, 0, 240, 240);
        photo = c.toDataURL('image/jpeg', 0.75);
      }
    }
    onStatus('ลงทะเบียนใบหน้าเรียบร้อย', true);
    return { faces: faces, photo: photo };
  }

  window.Face = { load: load, start: start, stop: stop, scan: scan, enroll: enroll };
})();
