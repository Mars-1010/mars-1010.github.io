import {createGame} from './game.js';

const byId = id => document.getElementById(id);
const canvas = byId('game');
const arcade = canvas.closest('.arcade');
const overlay = byId('overlay');
const play = byId('gf-start');
const pause = byId('pause');
const sound = byId('sound');
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const touchButtons = [...document.querySelectorAll('[data-action]')];
const readout = Object.fromEntries(
  ['time', 'score', 'lives', 'blocks', 'assists', 'behavior', 'behavior-copy',
    'behavior-label', 'phase-text', 'callout', 'overlay-title', 'overlay-label', 'overlay-copy']
    .map(id => [id, byId(id)])
);
const behaviours = {
  FORMATION: ['Formation', 'Your Fellow holds position beside your ship.'],
  INTERCEPT: ['Intercept', 'Your Fellow is moving to intercept a threat.'],
  SUPPORT_FIRE: ['Support fire', 'Your Fellow fires in response to your shot.'],
  RECOVER: ['Recover', 'Your Fellow is returning to formation.'],
  SOLO: ['Solo flight', 'You are flying without a teammate.']
};
const phaseLabels = {ready: 'Ready', running: 'Live', paused: 'Paused', ended: 'Complete'};
const keyActions = {ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'fire'};
const presses = new Map();
let selection = 'fellow';
let phase = 'ready';
let latest = null;
let endState = null;
let audio = null;
let soundOn = false;

function setText(el, text) {
  if (el.textContent !== String(text)) el.textContent = text;
}

function activateAudio() {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    audio ||= new Audio();
    audio.resume().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

function playTone(type) {
  if (!soundOn || audio?.state !== 'running') return;
  const frequencies = {block: [420, 710], assist: [510, 720], damage: [173, 115]};
  const profile = frequencies[type];
  if (!profile) return;
  const [from, to] = profile;
  const start = audio.currentTime;
  const tone = audio.createOscillator();
  const volume = audio.createGain();
  tone.type = 'sine';
  tone.frequency.setValueAtTime(from, start);
  tone.frequency.exponentialRampToValueAtTime(to, start + .12);
  volume.gain.setValueAtTime(.001, start);
  volume.gain.exponentialRampToValueAtTime(.12, start + .018);
  volume.gain.exponentialRampToValueAtTime(.001, start + .13);
  tone.connect(volume).connect(audio.destination);
  tone.start(start);
  tone.stop(start + .14);
}

function onUpdate(state) {
  latest = state;
  phase = state.phase ?? phase;
  setText(readout.time, phase === 'ready' ? '—' : `${state.timeLeft}s`);
  for (const key of ['score', 'lives', 'blocks', 'assists']) {
    setText(readout[key], state[key]);
  }
  setText(readout['phase-text'], phaseLabels[phase]);
  const teammate = phase === 'ready' ? selection === 'fellow' : state.mode === 'fellow';
  const [name, explanation] = behaviours[teammate ? state.state : 'SOLO'] ?? behaviours.FORMATION;
  setText(readout['behavior-label'], teammate ? 'Fellow behavior' : 'Flight mode');
  setText(readout.behavior, name);
  setText(readout['behavior-copy'], explanation);
}

function onEvent({type, message}) {
  if (type === 'block' || type === 'assist' || type === 'damage') {
    setText(readout.callout, message);
    playTone(type);
  }
}

function onEnd(state) {
  endState = state;
  phase = 'ended';
  releaseInputs();
  onUpdate({...state, phase: 'ended'});
  updateControls();
  setText(readout.callout, 'Switch modes to try the same opening again.');
  play.focus({preventScroll: true});
}

const game = createGame({canvas, onUpdate, onEvent, onEnd});

function updateControls() {
  overlay.hidden = phase === 'running';
  canvas.tabIndex = phase === 'running' ? 0 : -1;
  pause.disabled = phase === 'ready' || phase === 'ended';
  setText(pause, phase === 'paused' ? 'Resume' : 'Pause');
  const withFellow = selection === 'fellow';
  if (phase === 'paused') {
    setText(readout['overlay-label'], 'Flight paused');
    setText(readout['overlay-title'], 'Take a moment.');
    setText(readout['overlay-copy'], 'Resume whenever you’re ready.');
    setText(play, 'Resume flight →');
  } else if (phase === 'ended') {
    setText(readout['overlay-label'], 'Flight complete');
    setText(readout['overlay-title'], 'Round complete.');
    const summary = withFellow
      ? `Score ${endState.score} · ${endState.blocks} blocked · ${endState.assists} support shots`
      : `Score ${endState.score} · Solo flight`;
    setText(readout['overlay-copy'], summary);
    setText(play, 'Play again →');
  } else if (phase === 'ready') {
    setText(readout['overlay-label'], 'Flight check');
    setText(readout['overlay-title'], withFellow ? 'Ready to fly?' : 'Ready to fly solo?');
    setText(readout['overlay-copy'], withFellow
      ? 'You pilot the white ship. Watch what your cyan teammate does.'
      : 'You pilot the white ship. Try the same opening without a teammate.');
    setText(play, withFellow ? 'Play with Fellow →' : 'Play solo →');
  }
}

function chooseMode(mode) {
  if (mode === selection) return;
  selection = mode;
  releaseInputs();
  game.stop();
  phase = 'ready';
  endState = null;
  onUpdate({mode, phase, score: 0, lives: 3, blocks: 0, assists: 0, state: 'FORMATION'});
  for (const button of modeButtons) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  setText(readout.callout, 'Press Play to launch.');
  updateControls();
}

function startOrResume() {
  releaseInputs();
  if (soundOn) activateAudio();
  if (phase === 'paused') {
    phase = 'running';
    game.resume();
  } else {
    phase = 'running';
    game.start(selection);
    setText(readout.callout, selection === 'fellow'
      ? 'Hold Fire to see your teammate fire alongside you.'
      : 'Avoid incoming shots and clear the wave.');
  }
  updateControls();
  canvas.closest('.main-game').scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'instant'});
  canvas.focus({preventScroll: true});
}

function togglePause() {
  if (phase === 'running') {
    releaseInputs();
    game.pause();
    phase = 'paused';
    if (latest) onUpdate({...latest, phase});
    updateControls();
    play.focus({preventScroll: true});
  } else if (phase === 'paused') {
    startOrResume();
  }
}

function setPressed(action, source, active) {
  if (active && phase !== 'running') return;
  let sources = presses.get(action);
  if (!sources) presses.set(action, sources = new Set());
  if (active) sources.add(source);
  else sources.delete(source);
  game.setInput(action, sources.size > 0);
  const button = touchButtons.find(button => button.dataset.action === action);
  if (button) button.dataset.held = String(sources.size > 0);
}

function releaseInputs() {
  presses.clear();
  for (const action of ['left', 'right', 'fire']) game.setInput(action, false);
  for (const button of touchButtons) button.dataset.held = 'false';
}

for (const button of modeButtons) button.addEventListener('click', () => chooseMode(button.dataset.mode));
play.addEventListener('click', startOrResume);
pause.addEventListener('click', togglePause);
sound.addEventListener('click', () => {
  soundOn = !soundOn && activateAudio();
  sound.setAttribute('aria-pressed', String(soundOn));
  setText(sound, soundOn ? 'Sound on' : 'Sound off');
});

document.addEventListener('keydown', event => {
  if (!arcade.contains(event.target) || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
  if (event.code === 'KeyP' && !event.repeat && (phase === 'running' || phase === 'paused')) {
    event.preventDefault();
    togglePause();
    return;
  }
  if (phase !== 'running' || !keyActions[event.code] || event.target.closest?.('button,a,input')) return;
  event.preventDefault();
  setPressed(keyActions[event.code], event.code, true);
});
document.addEventListener('keyup', event => {
  if (keyActions[event.code]) setPressed(keyActions[event.code], event.code, false);
});
arcade.addEventListener('focusout', event => {
  if (!arcade.contains(event.relatedTarget)) releaseInputs();
});
window.addEventListener('blur', releaseInputs);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) releaseInputs();
});

for (const button of touchButtons) {
  const action = button.dataset.action;
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || phase !== 'running') return;
    button.setPointerCapture(event.pointerId);
    setPressed(action, event.pointerId, true);
  });
  for (const kind of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(kind, event => setPressed(action, event.pointerId, false));
  }
  button.addEventListener('keydown', event => {
    if (phase !== 'running' || !['Space', 'Enter'].includes(event.code)) return;
    event.preventDefault();
    setPressed(action, `button:${event.code}`, true);
  });
  button.addEventListener('keyup', event => setPressed(action, `button:${event.code}`, false));
  button.addEventListener('blur', () => {
    for (const key of ['Space', 'Enter']) setPressed(action, `button:${key}`, false);
  });
}

updateControls();
