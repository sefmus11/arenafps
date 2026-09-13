const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const path = require("path");

const app = express();
app.use(express.static(path.join(__dirname)));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const TICK_RATE = 20;
const MAP_SIZE = 48;
const RESPAWN_MS = 3000;
const MAX_HEALTH = 100;

const WEAPON_DAMAGE = { knife: 75, pistol: 20, m4: 18, ak47: 22 };
const VALID_WEAPONS = ["knife", "pistol", "m4", "ak47"];

const players = new Map();
let nextId = 1;

function randomSpawn() {
  return {
    x: (Math.random() * 2 - 1) * (MAP_SIZE / 2 - 4),
    y: 1.7,
    z: (Math.random() * 2 - 1) * (MAP_SIZE / 2 - 4),
  };
}

function randomTeam() {
  return Math.random() < 0.5 ? "blue" : "red";
}

function broadcast(obj) {
  const data = JSON.stringify(obj);
  for (const [, p] of players) {
    if (p.ws && p.ws.readyState === p.ws.OPEN) p.ws.send(data);
  }
}

// Hasar uygulama mantığı ortaklaştırıldı: hem gerçek oyuncular hem de
// botlar aynı fonksiyonu kullanıyor.
function applyDamage(shooterId, targetId, weapon) {
  const shooter = players.get(shooterId);
  const target = players.get(targetId);
  if (!shooter || !target || !target.alive || shooterId === targetId) return;
  if (target.team === shooter.team) return; // dostluk ateşi yok

  const damage = WEAPON_DAMAGE[weapon] || WEAPON_DAMAGE.pistol;
  target.health -= damage;

  broadcast({
    type: "hit",
    targetId,
    shooterId,
    damage,
    health: Math.max(0, target.health),
  });

  if (target.health <= 0 && target.alive) {
    target.alive = false;
    target.deaths++;
    shooter.kills++;
    broadcast({
      type: "death",
      id: targetId,
      killerId: shooterId,
      killerName: shooter.name,
      victimName: target.name,
      weapon,
    });

    setTimeout(() => {
      if (!players.has(targetId)) return;
      target.health = MAX_HEALTH;
      target.alive = true;
      target.position = randomSpawn();
      broadcast({ type: "respawn", id: targetId, position: target.position });
    }, RESPAWN_MS);
  }
}

// ================== BOTLAR (YAPAY ZEKA OYUNCULAR) ==================
const BOT_COUNT = 4; // 2 mavi, 2 kırmızı
const BOT_NAMES = ["Ares", "Raven", "Ghost", "Nova", "Havoc", "Vega", "Fenrir", "Onyx"];
const BOT_WEAPON_DELAY = { knife: 500, pistol: 500, m4: 350, ak47: 400 };
const BOT_MOVE_SPEED = 4;
const BOT_DETECT_RANGE = 26;
const BOT_SHOOT_RANGE = 20;
const BOT_TICK_MS = 150;
const BOT_ACCURACY = 0.65; // botlar mükemmel nişancı olmasın

function spawnBot(team) {
  const id = `bot${nextId++}`;
  players.set(id, {
    ws: null,
    isBot: true,
    name: `${BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]} 🤖`,
    team,
    position: randomSpawn(),
    rotationY: 0,
    health: MAX_HEALTH,
    kills: 0,
    deaths: 0,
    alive: true,
    weapon: ["pistol", "m4", "ak47"][Math.floor(Math.random() * 3)],
    wanderTarget: randomSpawn(),
    lastShotTime: 0,
  });
}
for (let i = 0; i < BOT_COUNT; i++) spawnBot(i % 2 === 0 ? "blue" : "red");

function dist2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

setInterval(() => {
  const now = Date.now();
  const limit = MAP_SIZE / 2 - 1;

  for (const [id, bot] of players) {
    if (!bot.isBot || !bot.alive) continue;

    let nearestId = null;
    let nearestData = null;
    let nearestDist = Infinity;
    for (const [oid, other] of players) {
      if (oid === id || !other.alive || other.team === bot.team) continue;
      const d = dist2D(bot.position, other.position);
      if (d < nearestDist) {
        nearestDist = d;
        nearestId = oid;
        nearestData = other;
      }
    }

    if (nearestData && nearestDist < BOT_DETECT_RANGE) {
      const dx = nearestData.position.x - bot.position.x;
      const dz = nearestData.position.z - bot.position.z;
      bot.rotationY = Math.atan2(dx, dz);

      if (nearestDist < BOT_SHOOT_RANGE) {
        const delay = BOT_WEAPON_DELAY[bot.weapon] || 500;
        if (now - bot.lastShotTime > delay) {
          bot.lastShotTime = now;
          if (Math.random() < BOT_ACCURACY) applyDamage(id, nearestId, bot.weapon);
        }
      } else {
        const step = BOT_MOVE_SPEED * (BOT_TICK_MS / 1000);
        const len = Math.hypot(dx, dz) || 1;
        bot.position.x += (dx / len) * step;
        bot.position.z += (dz / len) * step;
      }
    } else {
      const wx = bot.wanderTarget.x - bot.position.x;
      const wz = bot.wanderTarget.z - bot.position.z;
      const wdist = Math.hypot(wx, wz);
      if (wdist < 1.5) {
        bot.wanderTarget = randomSpawn();
      } else {
        const step = BOT_MOVE_SPEED * 0.6 * (BOT_TICK_MS / 1000);
        bot.position.x += (wx / wdist) * step;
        bot.position.z += (wz / wdist) * step;
        bot.rotationY = Math.atan2(wx, wz);
      }
    }

    bot.position.x = Math.max(-limit, Math.min(limit, bot.position.x));
    bot.position.z = Math.max(-limit, Math.min(limit, bot.position.z));
  }
}, BOT_TICK_MS);

// ================== BAĞLANTI YÖNETİMİ ==================
wss.on("connection", (ws) => {
  const id = String(nextId++);
  const player = {
    ws,
    name: `Oyuncu${id}`,
    team: randomTeam(),
    position: randomSpawn(),
    rotationY: 0,
    health: MAX_HEALTH,
    kills: 0,
    deaths: 0,
    alive: true,
    weapon: "pistol",
  };
  players.set(id, player);

  ws.send(JSON.stringify({ type: "welcome", id, spawn: player.position, team: player.team }));

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "join") {
      player.name = String(msg.name || player.name).slice(0, 16) || player.name;
      if (msg.team === "blue" || msg.team === "red") player.team = msg.team;
      broadcast({ type: "playerJoined", id, name: player.name, team: player.team });
    }

    if (msg.type === "move" && player.alive) {
      const pos = msg.position;
      if (typeof pos?.x === "number" && typeof pos?.y === "number" && typeof pos?.z === "number") {
        player.position = pos;
        player.rotationY = typeof msg.rotationY === "number" ? msg.rotationY : player.rotationY;
      }
    }

    if (msg.type === "weapon" && VALID_WEAPONS.includes(msg.weapon)) {
      player.weapon = msg.weapon;
    }

    if (msg.type === "shoot" && player.alive) {
      const weapon = VALID_WEAPONS.includes(msg.weapon) ? msg.weapon : "pistol";
      applyDamage(id, msg.targetId, weapon);
    }
  });

  ws.on("close", () => {
    players.delete(id);
    broadcast({ type: "playerLeft", id });
  });
});

setInterval(() => {
  const state = {};
  for (const [id, p] of players) {
    state[id] = {
      name: p.name,
      team: p.team,
      position: p.position,
      rotationY: p.rotationY,
      health: p.health,
      alive: p.alive,
      kills: p.kills,
      deaths: p.deaths,
      weapon: p.weapon,
    };
  }
  broadcast({ type: "state", players: state });
}, 1000 / TICK_RATE);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışıyor`));
