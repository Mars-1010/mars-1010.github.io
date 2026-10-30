/**
 * A small, lazy adapter for the assistant's real-project lighting demonstration.
 * The cave renderer uses the supplied Damo installation photographs. This module
 * does not access a microphone, camera, or AI service.
 */

const clamp = (value, fallback = .5) => Number.isFinite(Number(value))
  ? Math.max(0, Math.min(1, Number(value))) : fallback;

const MOODS = Object.freeze({
  normal: { photo: 'blue', energy: .55, calm: .45, filter: 'brightness(1) saturate(1)' },
  calm: { photo: 'blue', energy: .16, calm: .93, filter: 'brightness(.62) saturate(.76)' },
  vivid: { photo: 'projection', energy: 1, calm: .1, filter: 'brightness(1.06) saturate(1.2)' },
  warm: { photo: 'projection', energy: .58, calm: .62, filter: 'brightness(.94) sepia(.68) saturate(1.12)' },
});

function cancelled() {
  const error = new Error('The assistant scene has been disposed.');
  error.name = 'AbortError';
  return error;
}

export class AssistantScene {
  constructor(canvas) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('AssistantScene needs a canvas.');
    this.canvas = canvas;
    this.world = null;
    this.pending = null;
    this.disposed = false;
    this.mood = 'normal';
    this.paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.position = { x: .5, y: .5, active: false };
    this.previousFilter = canvas.style.filter;
  }

  /** Loading starts only after the visitor chooses to open the cave. */
  openCave() {
    if (this.disposed) return Promise.reject(cancelled());
    if (this.pending) return this.pending;
    if (this.world) return Promise.resolve(this);
    const operation = (async () => {
      const { PhotoCaveWorld } = await import('./cave-photo-world.js');
      if (this.disposed) throw cancelled();
      const world = new PhotoCaveWorld(this.canvas);
      this.world = world;
      try {
        this.applyState();
        await world.ready;
        if (this.disposed || this.world !== world) throw cancelled();
        // The canvas can become visible while its photographs are loading.
        world.resize();
        this.applyState();
        return this;
      } catch (error) {
        world.dispose();
        if (this.world === world) this.world = null;
        throw error;
      }
    })();
    this.pending = operation;
    // Attach both handlers so a rejected load is retryable, without masking its
    // rejection from the caller or introducing an unhandled derived promise.
    operation.then(
      () => { if (this.pending === operation) this.pending = null; },
      () => { if (this.pending === operation) this.pending = null; },
    );
    return operation;
  }

  applyState() {
    if (this.disposed) return;
    const { filter, ...mood } = MOODS[this.mood];
    this.canvas.style.filter = filter;
    this.world?.setState({
      ...mood,
      mode: 'ripple',
      original: false,
      paused: this.paused,
      x: this.position.x,
      y: 1 - this.position.y,
      source: 'pointer',
      isActive: this.position.active,
      isTracking: false,
      bodyX: null,
      bodyY: null,
      opening: 0,
      held: false,
    });
  }

  setMood(mood = 'normal') {
    if (!(mood in MOODS)) throw new TypeError(`Unknown assistant scene mood: ${mood}`);
    if (this.disposed) return this;
    this.mood = mood;
    this.applyState();
    return this;
  }

  /** Coordinates are normalized from the canvas's top-left corner. */
  pointer(xNorm, yNorm, active = true) {
    if (this.disposed) return this;
    this.position = { x: clamp(xNorm), y: clamp(yNorm), active: Boolean(active) };
    this.world?.setState({
      x: this.position.x,
      y: 1 - this.position.y,
      source: 'pointer',
      isActive: this.position.active,
    });
    return this;
  }

  setPaused(paused) {
    if (this.disposed) return this;
    this.paused = Boolean(paused);
    this.world?.setState({ paused: this.paused });
    return this;
  }

  reset() {
    if (this.disposed) return this;
    this.mood = 'normal';
    this.position = { x: .5, y: .5, active: false };
    this.world?.clearMemory();
    this.applyState();
    return this;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.world?.dispose();
    this.world = null;
    this.canvas.style.filter = this.previousFilter;
  }
}

export default AssistantScene;
