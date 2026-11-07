// Browser adaptation of the Game Fellow prototype's state-based teammate.
const WIDTH = 720;
const HEIGHT = 480;
const ROUND_SECONDS = 45;
const PLAYER_Y = HEIGHT - 53;
const PLAYER_SPEED = 275;
const PLAYER_LANE = PLAYER_Y - 33;
const SHIELD_RADIUS = 30;
const SEED = 20261107;
const STEP = 1 / 60;

const FELLOW_STATES = {
  formation: "FORMATION",
  intercept: "INTERCEPT",
  support: "SUPPORT_FIRE",
  recover: "RECOVER",
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);

function createRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(1664525, value) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

export function createGame({ canvas, onUpdate = () => {}, onEvent = () => {}, onEnd = () => {} }) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable.");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const starRandom = createRandom(42011);
  const stars = Array.from({ length: 80 }, () => ({
    x: starRandom() * WIDTH,
    y: starRandom() * HEIGHT,
    size: starRandom() > 0.88 ? 1.7 : 1,
    opacity: 0.19 + starRandom() * 0.45,
    speed: 4 + starRandom() * 16,
  }));
  const backdrop = context.createLinearGradient(0, 0, 0, HEIGHT);
  backdrop.addColorStop(0, "#101831");
  backdrop.addColorStop(0.46, "#090f20");
  backdrop.addColorStop(1, "#070b16");

  const input = { left: false, right: false, fire: false };
  let round;
  let animation = null;
  let lastFrame = null;
  let accumulator = 0;
  let lastStatus;

  function clearInput() {
    input.left = false;
    input.right = false;
    input.fire = false;
  }

  function reset(mode, phase) {
    round = {
      mode,
      phase,
      elapsed: 0,
      score: 0,
      lives: 3,
      blocks: 0,
      assists: 0,
      nextWave: 3.7,
      nextEnemyFire: 0.8,
      wave: 1,
      shotIndex: 0,
      random: createRandom(SEED),
      enemies: [],
      enemyShots: [],
      friendlyShots: [],
      bursts: [],
      player: { x: WIDTH / 2, y: PLAYER_Y, vx: 0, nextFire: 0, immuneUntil: 0 },
      fellow: mode === "fellow" ? {
        x: WIDTH / 2 + 72,
        y: PLAYER_Y + 6,
        vx: 0,
        vy: 0,
        side: 1,
        canSwitchAt: 0,
        state: FELLOW_STATES.formation,
        stateUntil: 0,
        shieldReadyAt: 0,
        assistReadyAt: 0,
        requestedUntil: -1,
        threat: null,
      } : null,
    };
    clearInput();
    spawnWave(true);
  }

  function snapshot(reason) {
    const secondsLeft = Math.max(0, ROUND_SECONDS - round.elapsed);
    return {
      mode: round.mode,
      phase: round.phase,
      score: round.score,
      timeLeft: Math.ceil(secondsLeft),
      secondsLeft,
      lives: round.lives,
      blocks: round.blocks,
      assists: round.assists,
      state: round.fellow?.state ?? "SOLO",
      ...(reason ? { reason } : {}),
    };
  }

  function publish(force = false) {
    const status = snapshot();
    const signature = [
      status.phase, status.mode, status.timeLeft, status.score,
      status.lives, status.blocks, status.assists, status.state,
    ].join("|");
    if (!force && signature === lastStatus) return;
    lastStatus = signature;
    onUpdate(status);
  }

  function announce(type, message) {
    onEvent({ type, message });
  }

  function spawnWave(first) {
    const row = round.wave % 2;
    const anchors = first ? [175, 267, 360, 452, 545] : [116, 239, 360, 481, 604];
    for (const [index, anchor] of anchors.entries()) {
      const phase = round.random() * Math.PI * 2;
      const jitter = (round.random() - 0.5) * 35;
      const targetY = (row ? 105 : 155) + (index % 2) * 28;
      if (round.enemies.length >= 20) continue;
      round.enemies.push({
        x: anchor,
        y: first ? targetY : -22 - index * 14,
        anchor: anchor + jitter,
        targetY,
        phase,
        color: (round.wave + index) % 2 ? "#eb949b" : "#bea0ed",
        dead: false,
      });
    }
  }

  function updateEnemies(dt) {
    const t = round.elapsed;
    for (const enemy of round.enemies) {
      enemy.y = Math.min(enemy.targetY, enemy.y + 125 * dt);
      enemy.x = enemy.anchor + Math.sin(t * 1.7 + enemy.phase) * 32;
    }

    if (t >= round.nextWave) {
      round.wave += 1;
      round.nextWave += 4.25;
      spawnWave(false);
    }

    if (t < round.nextEnemyFire) return;
    const available = round.enemies.filter(enemy => enemy.y >= 44);
    round.shotIndex += 1;
    round.nextEnemyFire += Math.max(0.72, 1.33 - t * 0.012);
    if (!available.length) return;
    const enemy = round.shotIndex === 1
      ? available.reduce((nearest, candidate) =>
        Math.abs(candidate.x - round.player.x) < Math.abs(nearest.x - round.player.x)
          ? candidate : nearest)
      : available[(round.shotIndex * 7) % available.length];
    const vy = 176 + Math.min(84, t * 2.2);
    const timeToPlayer = (PLAYER_Y - enemy.y) / vy;
    const predictedX = round.player.x + clamp(round.player.vx * 0.12, -29, 29);
    const vx = clamp((predictedX - enemy.x) / timeToPlayer, -165, 165);
    round.enemyShots.push({ x: enemy.x, y: enemy.y + 11, vx, vy, dead: false });
  }

  function fireFrom(ship, source, speed) {
    round.friendlyShots.push({ x: ship.x, y: ship.y - 16, vx: 0, vy: -speed, source, dead: false });
  }

  function updatePlayer(dt) {
    const player = round.player;
    player.vx = (Number(input.right) - Number(input.left)) * PLAYER_SPEED;
    player.x = clamp(player.x + player.vx * dt, 24, WIDTH - 24);
    if (!input.fire || round.elapsed < player.nextFire) return;
    player.nextFire = round.elapsed + 0.26;
    fireFrom(player, "player", 485);
    if (round.fellow) round.fellow.requestedUntil = round.elapsed + 0.39;
  }

  function pickThreat() {
    let best = null;
    for (const shot of round.enemyShots) {
      if (shot.dead) continue;
      const timeToLane = (PLAYER_LANE - shot.y) / shot.vy;
      if (timeToLane < 0 || timeToLane > 0.82) continue;
      const impactX = shot.x + timeToLane * shot.vx;
      const error = Math.abs(impactX - round.player.x);
      if (error > 39) continue;
      const score = timeToLane + error / 850;
      if (!best || score < best.score) best = { shot, impactX, score };
    }
    return best;
  }

  function formationTarget(fellow) {
    const t = round.elapsed;
    let x = round.player.x + fellow.side * 74;
    if ((x < 27 || x > WIDTH - 27) && t >= fellow.canSwitchAt) {
      fellow.side *= -1;
      fellow.canSwitchAt = t + 1.7;
      x = round.player.x + fellow.side * 74;
    }
    return { x: clamp(x, 24, WIDTH - 24), y: PLAYER_Y + 6 };
  }

  function moveFellow(fellow, target, dt) {
    const dx = target.x - fellow.x;
    const dy = target.y - fellow.y;
    const gap = Math.hypot(dx, dy);
    const limit = fellow.state === FELLOW_STATES.intercept ? 290 : 220;
    const pace = Math.min(limit, gap * 7);
    const desiredX = gap > 0.05 ? dx / gap * pace : 0;
    const desiredY = gap > 0.05 ? dy / gap * pace : 0;
    const changeX = desiredX - fellow.vx;
    const changeY = desiredY - fellow.vy;
    const acceleration = Math.hypot(changeX, changeY);
    const changeScale = acceleration > 0 ? Math.min(1, 1020 * dt / acceleration) : 0;
    fellow.vx += changeX * changeScale;
    fellow.vy += changeY * changeScale;
    fellow.x = clamp(fellow.x + fellow.vx * dt, 18, WIDTH - 18);
    fellow.y = clamp(fellow.y + fellow.vy * dt, PLAYER_LANE - 18, PLAYER_Y + 23);
  }

  function setFellowState(state, duration = 0) {
    const fellow = round.fellow;
    if (fellow.state === state) return;
    fellow.state = state;
    fellow.stateUntil = round.elapsed + duration;
  }

  function updateFellow(dt) {
    const fellow = round.fellow;
    if (!fellow) return;
    const t = round.elapsed;
    const threat = t >= fellow.shieldReadyAt ? pickThreat() : null;
    const target = formationTarget(fellow);
    fellow.threat = threat;

    if (threat) {
      setFellowState(FELLOW_STATES.intercept);
      target.x = clamp(threat.impactX, 18, WIDTH - 18);
      target.y = PLAYER_LANE;
    } else if (fellow.state === FELLOW_STATES.intercept) {
      setFellowState(FELLOW_STATES.recover, 0.35);
    } else if (t >= fellow.stateUntil) {
      if (fellow.requestedUntil >= t && t >= fellow.assistReadyAt) {
        fireFrom(fellow, "fellow", 472);
        fellow.assistReadyAt = t + 0.62;
        fellow.requestedUntil = -1;
        round.assists += 1;
        setFellowState(FELLOW_STATES.support, 0.19);
        announce("assist", "Covering fire");
      } else if (fellow.state === FELLOW_STATES.support) {
        setFellowState(FELLOW_STATES.recover, 0.20);
      } else {
        setFellowState(FELLOW_STATES.formation);
      }
    }
    if (fellow.state === FELLOW_STATES.support) target.y -= 17;
    moveFellow(fellow, target, dt);
  }

  function advanceShots(dt) {
    for (const shot of round.friendlyShots) {
      shot.y += shot.vy * dt;
      shot.dead ||= shot.y < -14;
    }
    for (const shot of round.enemyShots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.dead ||= shot.y > HEIGHT + 12 || shot.x < -16 || shot.x > WIDTH + 16;
    }
  }

  function burst(x, y, color, size) {
    round.bursts.push({ x, y, color, size, start: round.elapsed });
  }

  function resolveHits() {
    const { player, fellow } = round;
    const t = round.elapsed;
    for (const shot of round.enemyShots) {
      if (shot.dead) continue;
      const isThreat = fellow?.threat?.shot === shot;
      if (fellow && t >= fellow.shieldReadyAt &&
          distance(shot, fellow) < (isThreat ? SHIELD_RADIUS : 13)) {
        shot.dead = true;
        fellow.threat = null;
        fellow.shieldReadyAt = t + 1.15;
        round.blocks += 1;
        burst(shot.x, shot.y, "#61e8ed", 46);
        setFellowState(FELLOW_STATES.recover, 0.41);
        announce("block", "Fellow blocked an incoming shot");
      } else if (t >= player.immuneUntil && distance(shot, player) < 15) {
        shot.dead = true;
        player.immuneUntil = t + 2.1;
        round.lives -= 1;
        burst(player.x, player.y, "#ff8f9b", 43);
        announce("damage", "Your ship was hit");
      }
    }
    for (const shot of round.friendlyShots) {
      if (shot.dead) continue;
      const hit = round.enemies.find(enemy => !enemy.dead && distance(enemy, shot) < 18);
      if (!hit) continue;
      shot.dead = true;
      hit.dead = true;
      round.score += 120;
      burst(hit.x, hit.y, shot.source === "fellow" ? "#61e8ed" : "#e7c79b", 31);
    }
    round.enemyShots = round.enemyShots.filter(shot => !shot.dead);
    round.friendlyShots = round.friendlyShots.filter(shot => !shot.dead);
    round.enemies = round.enemies.filter(enemy => !enemy.dead);
    round.bursts = round.bursts.filter(item => t - item.start < 0.35);
  }

  function drawBackground() {
    context.fillStyle = backdrop;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    for (const star of stars) {
      context.globalAlpha = star.opacity;
      context.fillStyle = "#c1ddf8";
      const y = (star.y + star.speed * round.elapsed) % HEIGHT;
      context.fillRect(star.x, y, star.size, star.size);
    }
    context.globalAlpha = 1;
    context.strokeStyle = "#22334d";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, PLAYER_Y + 35);
    context.lineTo(WIDTH, PLAYER_Y + 35);
    context.stroke();
  }

  function drawEnemy(enemy) {
    const { x, y, color } = enemy;
    context.save();
    context.translate(x, y);
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, 15);
    context.lineTo(-10, 5);
    context.lineTo(-17, -6);
    context.lineTo(-11, -10);
    context.lineTo(0, -4);
    context.lineTo(11, -10);
    context.lineTo(17, -6);
    context.lineTo(10, 5);
    context.closePath();
    context.fill();
    context.fillStyle = "#30192f";
    context.fillRect(-2, -2, 4, 9);
    context.restore();
  }

  function drawShip(ship, color, fellow = false) {
    const { x, y } = ship;
    context.save();
    context.translate(x, y);
    if (!fellow && round.elapsed < ship.immuneUntil) context.globalAlpha = 0.65;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, -16);
    context.lineTo(7, -2);
    context.lineTo(17, 10);
    context.lineTo(7, 8);
    context.lineTo(0, 12);
    context.lineTo(-7, 8);
    context.lineTo(-17, 10);
    context.lineTo(-7, -2);
    context.closePath();
    context.fill();
    context.fillStyle = fellow ? "#0a3846" : "#476286";
    context.fillRect(-2, -7, 4, 9);
    context.fillStyle = fellow ? "#a3f5fb" : "#f1dfad";
    context.globalAlpha *= 0.75;
    context.fillRect(-2, 12, 4, 3 + Math.sin(round.elapsed * 30) * 2);
    context.restore();
  }

  function drawFellow(fellow) {
    const active = fellow.state === FELLOW_STATES.intercept;
    if (active && fellow.threat) {
      const { shot, impactX } = fellow.threat;
      context.save();
      context.strokeStyle = "#68e2ec";
      context.globalAlpha = 0.62;
      context.lineWidth = 1.3;
      context.setLineDash([4, 5]);
      context.beginPath();
      context.moveTo(shot.x, shot.y);
      context.lineTo(impactX, PLAYER_LANE);
      context.stroke();
      context.setLineDash([]);
      context.beginPath();
      context.arc(impactX, PLAYER_LANE, 8, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
    context.strokeStyle = active ? "#65edf3" : "#28596a";
    context.lineWidth = active ? 1.6 : 1.2;
    context.beginPath();
    context.arc(fellow.x, fellow.y, active ? SHIELD_RADIUS : 21, 0, Math.PI * 2);
    context.stroke();
    drawShip(fellow, "#63e6ec", true);
  }

  function draw() {
    drawBackground();
    for (const enemy of round.enemies) drawEnemy(enemy);
    for (const shot of round.friendlyShots) {
      context.fillStyle = shot.source === "fellow" ? "#6ceef1" : "#f8e7b9";
      context.fillRect(shot.x - 1.5, shot.y - 6, 3, 12);
    }
    for (const shot of round.enemyShots) {
      context.strokeStyle = "#db596c";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(shot.x - shot.vx * 0.057, shot.y - shot.vy * 0.057);
      context.lineTo(shot.x, shot.y);
      context.stroke();
      context.fillStyle = "#ffb1b5";
      context.beginPath();
      context.arc(shot.x, shot.y, 3.5, 0, Math.PI * 2);
      context.fill();
    }
    if (round.lives > 0) drawShip(round.player, "#f4f6f9");
    if (round.fellow) drawFellow(round.fellow);
    for (const effect of round.bursts) {
      const progress = (round.elapsed - effect.start) / 0.35;
      context.globalAlpha = 1 - progress;
      context.strokeStyle = effect.color;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(effect.x, effect.y, 5 + effect.size * progress, 0, Math.PI * 2);
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  function cancelFrame() {
    if (animation !== null) cancelAnimationFrame(animation);
    animation = null;
    lastFrame = null;
    accumulator = 0;
  }

  function finish(reason) {
    round.phase = "ended";
    clearInput();
    cancelFrame();
    publish(true);
    onEnd(snapshot(reason));
  }

  function tick(timestamp) {
    animation = null;
    if (round.phase !== "running") return;
    if (lastFrame !== null) accumulator += Math.min((timestamp - lastFrame) / 1000, 0.10);
    lastFrame = timestamp;
    while (accumulator >= STEP && round.phase === "running") {
      accumulator -= STEP;
      round.elapsed = Math.min(ROUND_SECONDS, round.elapsed + STEP);
      updatePlayer(STEP);
      updateEnemies(STEP);
      advanceShots(STEP);
      updateFellow(STEP);
      resolveHits();
      if (round.lives <= 0) finish("lives");
      else if (round.elapsed >= ROUND_SECONDS - STEP / 2) {
        round.elapsed = ROUND_SECONDS;
        finish("time");
      }
    }
    draw();
    publish();
    if (round.phase === "running") animation = requestAnimationFrame(tick);
  }

  function start(mode = "fellow") {
    if (mode !== "fellow" && mode !== "solo") throw new RangeError("Unknown play mode.");
    cancelFrame();
    reset(mode, "running");
    draw();
    publish(true);
    animation = requestAnimationFrame(tick);
  }

  function pause() {
    if (round.phase !== "running") return;
    cancelFrame();
    clearInput();
    round.phase = "paused";
    publish(true);
  }

  function resume() {
    if (round.phase !== "paused") return;
    round.phase = "running";
    publish(true);
    animation = requestAnimationFrame(tick);
  }

  function stop() {
    cancelFrame();
    reset(round.mode, "ready");
    draw();
    publish(true);
  }

  function setInput(action, pressed) {
    if (!Object.hasOwn(input, action)) throw new RangeError("Unknown game input.");
    if (round.phase === "running" || !pressed) input[action] = Boolean(pressed);
  }

  reset("fellow", "ready");
  draw();
  publish(true);
  return { start, pause, resume, stop, setInput };
}
