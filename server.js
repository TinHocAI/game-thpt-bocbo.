const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const DB_FILE = path.join(ROOT_DIR, 'accounts_db.json');
const ADMIN_PIN = String(process.env.ADMIN_PIN || 'bocbo2026');
const onlineRooms = new Map();

const WEATHER_TYPES = ['sunny', 'cloudy', 'rainy', 'windy'];

function getRealDateVN() {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date());
  } catch (e) {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
}

function createRoomEnv() {
  return {
    startSchoolSeconds: 6 * 3600, // Mặc định 06:00 AM khi người đầu tiên tạo phòng
    createdAtMs: Date.now(),
    realDate: getRealDateVN(),
    weather: WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)]
  };
}

function getRoomState(roomCode) {
  const code = String(roomCode || 'BOCBO-2026').trim().toUpperCase() || 'BOCBO-2026';
  if (!onlineRooms.has(code)) {
    onlineRooms.set(code, { players: new Map(), events: [], seq: 0, env: createRoomEnv() });
  }
  return onlineRooms.get(code);
}

function verifyAdminPin(req, body) {
  const pin = String(req.headers['x-admin-pin'] || (body && body.adminPin) || '');
  const a = Buffer.from(pin);
  const b = Buffer.from(ADMIN_PIN);
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2'
};

function loadAccountsDB() {
  try {
    if (!fs.existsSync(DB_FILE)) return {};
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('Lỗi đọc accounts_db.json:', err.message);
    return {};
  }
}

function saveAccountsDB(db) {
  const tmpFile = DB_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}

function hashPassword(password, saltHex) {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sanitizeAccountForClient(username, acc) {
  return {
    username,
    coins: typeof acc.coins === 'number' ? acc.coins : 20,
    dynamicScore: typeof acc.dynamicScore === 'number' ? acc.dynamicScore : 0,
    discipline: typeof acc.discipline === 'number' ? acc.discipline : 100,
    energy: typeof acc.energy === 'number' ? acc.energy : 100,
    ownedVehicles: Array.isArray(acc.ownedVehicles) && acc.ownedVehicles.length > 0 ? acc.ownedVehicles : ['walk'],
    activeVehicleId: acc.activeVehicleId || 'walk',
    ownedAccessories: Array.isArray(acc.ownedAccessories) ? acc.ownedAccessories : [],
    equippedAccessories: Array.isArray(acc.equippedAccessories) ? acc.equippedAccessories : [],
    friends: Array.isArray(acc.friends) ? acc.friends : [],
    collectedBooks: (acc.collectedBooks && typeof acc.collectedBooks === 'object') ? acc.collectedBooks : {},
    roomDocs: (acc.roomDocs && typeof acc.roomDocs === 'object') ? acc.roomDocs : {},
    profile: acc.profile || { name: username, className: '10A' }
  };
}

function sendJSON(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-pin'
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('Payload quá lớn'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('JSON không hợp lệ'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-admin-pin'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      const db = loadAccountsDB();
      return sendJSON(res, 200, { ok: true, totalAccounts: Object.keys(db).length });
    }

    if (req.method === 'POST' && pathname === '/api/register') {
      const body = await readJsonBody(req);
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      const name = String(body.name || '').trim();
      const className = String(body.className || '10A').trim() || '10A';

      if (!/^[a-z0-9_]{3,24}$/.test(username)) {
        return sendJSON(res, 400, { ok: false, error: 'Tên đăng nhập phải từ 3–24 ký tự chữ không dấu, số hoặc dấu gạch dưới (_).' });
      }
      if (password.length < 4) {
        return sendJSON(res, 400, { ok: false, error: 'Mật khẩu phải có ít nhất 4 ký tự.' });
      }
      if (!name) {
        return sendJSON(res, 400, { ok: false, error: 'Vui lòng nhập Họ và tên học sinh.' });
      }

      const db = loadAccountsDB();
      if (db[username]) {
        return sendJSON(res, 409, { ok: false, error: 'Tên đăng nhập này đã tồn tại!' });
      }

      const { salt, hash } = hashPassword(password);
      db[username] = {
        salt,
        passwordHash: hash,
        coins: 20,
        dynamicScore: 0,
        discipline: 100,
        energy: 100,
        ownedVehicles: ['walk'],
        activeVehicleId: 'walk',
        ownedAccessories: [],
        equippedAccessories: [],
        friends: [],
        collectedBooks: {},
        roomDocs: {},
        profile: {
          name,
          className,
          gender: 'male',
          hairStyle: 'short',
          hairColor: 'black',
          outfit: 'classic',
          glasses: true
        },
        createdAt: Date.now(),
        lastSaved: Date.now()
      };
      saveAccountsDB(db);
      return sendJSON(res, 201, { ok: true, account: sanitizeAccountForClient(username, db[username]) });
    }

    if (req.method === 'POST' && pathname === '/api/login') {
      const body = await readJsonBody(req);
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');

      const db = loadAccountsDB();
      const acc = db[username];
      if (!acc) {
        return sendJSON(res, 404, { ok: false, error: 'Tài khoản chưa tồn tại!' });
      }
      if (!verifyPassword(password, acc.salt, acc.passwordHash)) {
        return sendJSON(res, 401, { ok: false, error: 'Mật khẩu không chính xác!' });
      }
      return sendJSON(res, 200, { ok: true, account: sanitizeAccountForClient(username, acc) });
    }

    if (req.method === 'GET' && pathname === '/api/account') {
      const username = String(parsedUrl.searchParams.get('username') || '').trim().toLowerCase();
      const db = loadAccountsDB();
      const acc = db[username];
      if (!acc) {
        return sendJSON(res, 404, { ok: false, error: 'Không tìm thấy tài khoản.' });
      }
      return sendJSON(res, 200, { ok: true, account: sanitizeAccountForClient(username, acc) });
    }

    if (req.method === 'POST' && pathname === '/api/save') {
      const body = await readJsonBody(req);
      const username = String(body.username || '').trim().toLowerCase();
      if (!username) {
        return sendJSON(res, 400, { ok: false, error: 'Thiếu tên đăng nhập.' });
      }
      const db = loadAccountsDB();
      const acc = db[username];
      if (!acc) {
        return sendJSON(res, 404, { ok: false, error: 'Tài khoản không tồn tại.' });
      }

      if (typeof body.coins === 'number') acc.coins = body.coins;
      if (typeof body.dynamicScore === 'number') acc.dynamicScore = body.dynamicScore;
      if (typeof body.discipline === 'number') acc.discipline = body.discipline;
      if (typeof body.energy === 'number') acc.energy = body.energy;
      if (Array.isArray(body.ownedVehicles)) acc.ownedVehicles = body.ownedVehicles;
      if (typeof body.activeVehicleId === 'string') acc.activeVehicleId = body.activeVehicleId;
      if (Array.isArray(body.ownedAccessories)) acc.ownedAccessories = body.ownedAccessories;
      if (Array.isArray(body.equippedAccessories)) acc.equippedAccessories = body.equippedAccessories;
      if (Array.isArray(body.friends)) acc.friends = body.friends;
      if (body.collectedBooks && typeof body.collectedBooks === 'object') acc.collectedBooks = body.collectedBooks;
      if (body.roomDocs && typeof body.roomDocs === 'object') acc.roomDocs = body.roomDocs;
      if (body.profile && typeof body.profile === 'object') {
        acc.profile = { ...(acc.profile || {}), ...body.profile };
      }
      acc.lastSaved = Date.now();
      saveAccountsDB(db);
      return sendJSON(res, 200, { ok: true });
    }

    // =========================================================================
    // API QUẢN TRỊ GIÁO VIÊN (XEM DANH SÁCH HỌC SINH, ĐẶT LẠI MẬT KHẨU, XÓA)
    // =========================================================================
    if (req.method === 'GET' && pathname === '/api/admin/accounts') {
      if (!verifyAdminPin(req, null)) {
        return sendJSON(res, 401, { ok: false, error: 'Mã PIN quản trị không chính xác!' });
      }
      const db = loadAccountsDB();
      const accounts = Object.keys(db).map(username => {
        const acc = db[username];
        return {
          username,
          name: acc.profile?.name || username,
          className: acc.profile?.className || '10A',
          coins: typeof acc.coins === 'number' ? acc.coins : 20,
          dynamicScore: typeof acc.dynamicScore === 'number' ? acc.dynamicScore : 0,
          discipline: typeof acc.discipline === 'number' ? acc.discipline : 100,
          activeVehicleId: acc.activeVehicleId || 'walk',
          ownedVehiclesCount: Array.isArray(acc.ownedVehicles) ? acc.ownedVehicles.length : 1,
          ownedAccessoriesCount: Array.isArray(acc.ownedAccessories) ? acc.ownedAccessories.length : 0,
          createdAt: acc.createdAt || null,
          lastSaved: acc.lastSaved || null
        };
      }).sort((a, b) => (b.lastSaved || 0) - (a.lastSaved || 0));
      return sendJSON(res, 200, { ok: true, accounts });
    }

    if (req.method === 'POST' && pathname === '/api/admin/reset-password') {
      const body = await readJsonBody(req);
      if (!verifyAdminPin(req, body)) {
        return sendJSON(res, 401, { ok: false, error: 'Mã PIN quản trị không chính xác!' });
      }
      const username = String(body.username || '').trim().toLowerCase();
      const newPassword = String(body.newPassword || '');
      if (!username || newPassword.length < 4) {
        return sendJSON(res, 400, { ok: false, error: 'Tên đăng nhập không hợp lệ hoặc mật khẩu mới < 4 ký tự.' });
      }
      const db = loadAccountsDB();
      const acc = db[username];
      if (!acc) {
        return sendJSON(res, 404, { ok: false, error: 'Không tìm thấy tài khoản này.' });
      }
      const { salt, hash } = hashPassword(newPassword);
      acc.salt = salt;
      acc.passwordHash = hash;
      acc.lastSaved = Date.now();
      saveAccountsDB(db);
      return sendJSON(res, 200, { ok: true });
    }

    if (req.method === 'POST' && pathname === '/api/admin/delete-account') {
      const body = await readJsonBody(req);
      if (!verifyAdminPin(req, body)) {
        return sendJSON(res, 401, { ok: false, error: 'Mã PIN quản trị không chính xác!' });
      }
      const username = String(body.username || '').trim().toLowerCase();
      const db = loadAccountsDB();
      if (!db[username]) {
        return sendJSON(res, 404, { ok: false, error: 'Không tìm thấy tài khoản này.' });
      }
      delete db[username];
      saveAccountsDB(db);
      return sendJSON(res, 200, { ok: true });
    }

    // =========================================================================
    // API ĐỒNG BỘ MULTIPLAYER THỜI GIAN THỰC QUA MÁY CHỦ (PC + ĐIỆN THOẠI)
    // =========================================================================
    if (req.method === 'POST' && pathname === '/api/mp/sync') {
      const body = await readJsonBody(req);
      const room = getRoomState(body.roomCode);
      const now = Date.now();
      // Dọn các người chơi cũ quá hạn trước khi kiểm tra phòng trống
      for (const [id, p] of room.players.entries()) {
        if (now - p.lastSeen > 8000) {
          room.players.delete(id);
        }
      }
      // Nếu phòng đang trống và người đầu tiên vừa vào -> đặt lại 06:00 AM, ngày thực tế & random thời tiết mới
      if (room.players.size === 0) {
        room.env = createRoomEnv();
      }

      const player = body.player;
      const pid = player && player.id ? String(player.id) : '';
      if (pid) {
        room.players.set(pid, {
          ...player,
          id: pid,
          lastSeen: now
        });
      }

      const others = [];
      for (const [id, p] of room.players.entries()) {
        if (id !== pid) others.push(p);
      }

      const hasSinceSeq = body.sinceSeq !== undefined && body.sinceSeq !== null;
      const sinceSeq = hasSinceSeq ? Number(body.sinceSeq) : 0;
      const newEvents = hasSinceSeq
        ? room.events.filter(ev => ev.seq > sinceSeq && ev.senderId !== pid)
        : [];

      const elapsedVirtualSec = (now - room.env.createdAtMs) / 1000;
      return sendJSON(res, 200, {
        ok: true,
        players: others,
        events: newEvents,
        latestSeq: room.seq,
        env: {
          schoolSeconds: room.env.startSchoolSeconds + elapsedVirtualSec,
          realDate: room.env.realDate,
          weather: room.env.weather
        }
      });
    }

    if (req.method === 'POST' && pathname === '/api/mp/event') {
      const body = await readJsonBody(req);
      const room = getRoomState(body.roomCode);
      const ev = body.event;
      if (ev && typeof ev === 'object') {
        room.seq += 1;
        room.events.push({ ...ev, seq: room.seq, senderId: String(body.senderId || ev.id || '') });
        if (room.events.length > 50) {
          room.events.splice(0, room.events.length - 50);
        }
      }
      return sendJSON(res, 200, { ok: true, seq: room.seq });
    }

    if (req.method === 'POST' && pathname === '/api/mp/leave') {
      const body = await readJsonBody(req);
      const room = getRoomState(body.roomCode);
      if (body.id) room.players.delete(String(body.id));
      return sendJSON(res, 200, { ok: true });
    }

    // Serve static files from ROOT_DIR
    let relPath = pathname === '/' ? '/index.html' : pathname;
    relPath = decodeURIComponent(relPath);
    const safePath = path.normalize(path.join(ROOT_DIR, relPath));
    if (!safePath.startsWith(ROOT_DIR) || path.basename(safePath) === 'accounts_db.json') {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    fs.readFile(safePath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Not Found');
      }
      const ext = path.extname(safePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(content);
    });
  } catch (err) {
    sendJSON(res, 500, { ok: false, error: err.message || 'Lỗi máy chủ nội bộ' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏫 Máy chủ Trường THPT Bộc Bố 3D đang chạy!`);
  console.log(`   👉 Trên máy này: http://localhost:${PORT}`);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`   📱 Trên điện thoại / máy khác cùng Wi-Fi: http://${net.address}:${PORT}`);
      }
    }
  }
  console.log(`   💾 Dữ liệu tài khoản lưu tại: ${DB_FILE}`);
  console.log(`   🛡️ Mã PIN Quản trị Giáo viên: ${ADMIN_PIN}\n`);
});
