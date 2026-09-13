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

// Silah başına sunucu taraflı hasar (istemciden gelen hasarı değil, silah
// tipini baz alıyoruz — basit ama kopya/hile riskini azaltır)
const WEAPON_DAMAGE = {
  knife: 75,
  pistol: 20,
  m4: 18,
  ak47: 22,
};
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
    if (p.ws.readyState === p.ws.OPEN) p.ws.send(data);
  }
}

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
      const target = players.get(msg.targetId);
      if (!target || !target.alive || msg.targetId === id) return;
      if (target.team === player.team) return; // dostluk ateşi yok

      const weapon = VALID_WEAPONS.includes(msg.weapon) ? msg.weapon : "pistol";
      const damage = WEAPON_DAMAGE[weapon];
      target.health -= damage;

      broadcast({
        type: "hit",
        targetId: msg.targetId,
        shooterId: id,
        damage,
        health: Math.max(0, target.health),
      });

      if (target.health <= 0 && target.alive) {
        target.alive = false;
        target.deaths++;
        player.kills++;
        broadcast({
          type: "death",
          id: msg.targetId,
          killerId: id,
          killerName: player.name,
          victimName: target.name,
          weapon,
        });

        setTimeout(() => {
          if (!players.has(msg.targetId)) return;
          target.health = MAX_HEALTH;
          target.alive = true;
          target.position = randomSpawn();
          broadcast({ type: "respawn", id: msg.targetId, position: target.position });
        }, RESPAWN_MS);
      }
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
