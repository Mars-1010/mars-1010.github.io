// Local, deterministic interaction model. Nothing is stored or transmitted.
export const initialPanels = Object.freeze([
  Object.freeze({ id: 'a', label: 'Panel A', x: -2.6, z: -0.8 }),
  Object.freeze({ id: 'b', label: 'Panel B', x: -0.8, z: 0.6 }),
  Object.freeze({ id: 'c', label: 'Panel C', x: 1.1, z: -0.8 }),
  Object.freeze({ id: 'd', label: 'Panel D', x: 2.8, z: 0.7 }),
]);

export const suggestionCatalogue = Object.freeze([
  Object.freeze({ id: 'a-layout', panelId: 'a', type: 'layout', title: 'Bring Panel A closer', why: 'Place the reference within the working area.', to: Object.freeze({ x: -1.8, z: -0.25 }) }),
  Object.freeze({ id: 'b-layout', panelId: 'b', type: 'layout', title: 'Give Panel B more space', why: 'Separate the comparison from the central working area.', to: Object.freeze({ x: -0.35, z: 1.25 }) }),
  Object.freeze({ id: 'a-hint', panelId: 'a', type: 'hint', title: 'Check the reference alignment', why: 'Compare the edge of Panel A with the main layout before making changes.' }),
  Object.freeze({ id: 'c-layout', panelId: 'c', type: 'layout', title: 'Move Panel C into view', why: 'Keep the third panel beside the current comparison.', to: Object.freeze({ x: 1.65, z: 0.15 }) }),
  Object.freeze({ id: 'b-hint', panelId: 'b', type: 'hint', title: 'Compare the spacing', why: 'Check the gap around Panel B; this suggestion does not move it.' }),
  Object.freeze({ id: 'd-layout', panelId: 'd', type: 'layout', title: 'Bring Panel D into the group', why: 'Make the final panel easier to compare with its neighbour.', to: Object.freeze({ x: 2.2, z: 0.2 }) }),
  Object.freeze({ id: 'c-hint', panelId: 'c', type: 'hint', title: 'Check the viewing order', why: 'Compare Panel C with its neighbours to check that the sequence is clear; this suggestion does not move it.' }),
  Object.freeze({ id: 'd-hint', panelId: 'd', type: 'hint', title: 'Review the final comparison', why: 'Use Panel D as a final reference and check its relationship to the group; this suggestion does not move it.' }),
]);
export const catalogue = suggestionCatalogue;

const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const ACTION_TYPES = new Set(['layout', 'hint']);
const STAGES = new Set(['arrange', 'review']);
const MAX_HISTORY = 30;
const MAX_EVENTS = 200;

export function createState() {
  return {
    panels: initialPanels.map(panel => ({ ...panel })),
    selected: 'a', boundary: null, draftBoundary: null, suggestion: null,
    stage: 'arrange', cursor: 0, events: [], history: [],
    lastOutcome: null, nextEventId: 1,
  };
}

function normaliseTarget(target, panels) {
  if (!target || typeof target !== 'object') return null;
  const kind = target.kind ?? target.type;
  if (kind === 'object') {
    const panelId = target.panelId ?? target.id;
    return panels.some(panel => panel.id === panelId) ? { kind: 'object', panelId } : null;
  }
  if (kind === 'region') {
    const rect = target.rect ?? target;
    const values = [rect.minX ?? rect.x1, rect.maxX ?? rect.x2, rect.minZ ?? rect.z1, rect.maxZ ?? rect.z2];
    if (!values.every(Number.isFinite)) return null;
    const [x1, x2, z1, z2] = values;
    if (x1 === x2 || z1 === z2) return null;
    return { kind: 'region', rect: { minX: Math.min(x1, x2), maxX: Math.max(x1, x2), minZ: Math.min(z1, z2), maxZ: Math.max(z1, z2) } };
  }
  return null;
}

export function boundaryMatches(boundary, candidate, panels, stage) {
  if (!boundary || !candidate || boundary.action !== candidate.type) return false;
  if (boundary.duration === 'stage' && boundary.stage !== stage) return false;
  if (!['stage', 'session'].includes(boundary.duration)) return false;
  const target = normaliseTarget(boundary.target, panels);
  if (!target) return false;
  if (target.kind === 'object') return target.panelId === candidate.panelId;
  const panel = panels.find(item => item.id === candidate.panelId);
  if (!panel) return false;
  const { minX, maxX, minZ, maxZ } = target.rect;
  return panel.x >= minX && panel.x <= maxX && panel.z >= minZ && panel.z <= maxZ;
}

export function boundaryReason(boundary) {
  if (!boundary) return '';
  const where = (boundary.target.kind ?? boundary.target.type) === 'object'
    ? `Panel ${(boundary.target.panelId ?? boundary.target.id).toUpperCase()}` : 'the marked region';
  return `${boundary.action === 'layout' ? 'Layout changes' : 'Hints'} paused for ${where} ${boundary.duration === 'stage' ? 'during this stage' : 'until removed or reset'}.`;
}

function event(state, type, data = {}) {
  const id = state.nextEventId;
  return { ...state, nextEventId: id + 1, events: [...state.events, { id, type, stage: state.stage, ...copy(data) }].slice(-MAX_EVENTS) };
}

function snapshot(state) {
  const { panels, selected, boundary, suggestion, stage, cursor, lastOutcome } = state;
  return copy({ panels, selected, boundary, suggestion, stage, cursor, lastOutcome });
}

function commit(state, changes, type, data) {
  const history = [...state.history, snapshot(state)].slice(-MAX_HISTORY);
  return event({ ...state, ...changes, history }, type, data);
}

function offerCandidate(state, source, changes = {}) {
  let candidate = copy(source);
  const panel = state.panels.find(item => item.id === candidate.panelId);
  if (candidate.type === 'layout' && candidate.to && panel
    && Math.abs(panel.x - candidate.to.x) < 1e-8 && Math.abs(panel.z - candidate.to.z) < 1e-8) {
    const initial = initialPanels.find(item => item.id === candidate.panelId);
    candidate = { ...candidate, id: `${candidate.id}-return`, title: `Restore ${panel.label}'s starting position`, why: 'Compare with its original position.', to: { x: initial.x, z: initial.z } };
  }
  const suppressed = boundaryMatches(state.boundary, candidate, state.panels, state.stage);
  const ruleReason = suppressed ? boundaryReason(state.boundary) : undefined;
  const lastOutcome = { kind: suppressed ? 'suppressed' : 'offered', candidate, ...(suppressed ? { ruleReason } : {}) };
  return event({ ...state, ...changes, suggestion: suppressed ? null : candidate, lastOutcome }, suppressed ? 'suggestion-suppressed' : 'suggestion-offered', { candidate, ...(suppressed ? { boundary: state.boundary, ruleReason } : {}) });
}

export function dispatch(state, action) {
  switch (action.type) {
    case 'SELECT':
      return state.panels.some(panel => panel.id === action.id) ? { ...state, selected: action.id } : state;
    case 'DRAFT_BOUNDARY': {
      const target = normaliseTarget(action.target, state.panels);
      if (!target || !ACTION_TYPES.has(action.action) || !['stage', 'session'].includes(action.duration)) return state;
      return { ...state, draftBoundary: { target, action: action.action, duration: action.duration, stage: state.stage }, lastOutcome: null };
    }
    case 'CANCEL_DRAFT':
      return { ...state, draftBoundary: null };
    case 'CONFIRM_BOUNDARY': {
      if (!state.draftBoundary) return state;
      const boundary = copy(state.draftBoundary);
      return commit(state, { boundary, draftBoundary: null, suggestion: null, lastOutcome: null }, 'boundary-confirmed', { boundary, replaced: state.boundary, clearedProposal: state.suggestion?.id ?? null });
    }
    case 'REMOVE_BOUNDARY':
      return state.boundary ? commit(state, { boundary: null, lastOutcome: null }, 'boundary-removed', { boundary: state.boundary }) : state;
    case 'NEXT_SUGGESTION': {
      if (state.suggestion || state.draftBoundary) return state;
      return offerCandidate(state, suggestionCatalogue[state.cursor % suggestionCatalogue.length], { cursor: state.cursor + 1 });
    }
    case 'TRY_SUGGESTION': {
      if (state.suggestion || state.draftBoundary) return state;
      const candidateType = action.candidateType ?? action.action;
      const candidate = suggestionCatalogue.find(item => item.panelId === action.panelId && item.type === candidateType);
      return candidate ? offerCandidate(state, candidate) : state;
    }
    case 'ACCEPT_SUGGESTION': {
      if (!state.suggestion || state.draftBoundary) return state;
      const candidate = state.suggestion;
      // Re-check at commit time so a stale suggestion cannot bypass a boundary.
      if (boundaryMatches(state.boundary, candidate, state.panels, state.stage)) {
        const ruleReason = boundaryReason(state.boundary);
        return event({ ...state, suggestion: null, lastOutcome: { kind: 'suppressed', candidate: copy(candidate), ruleReason } }, 'suggestion-suppressed', { candidate, boundary: state.boundary, ruleReason });
      }
      const previous = state.panels.find(panel => panel.id === candidate.panelId);
      const panels = candidate.type === 'layout' && candidate.to ? state.panels.map(panel => panel.id === candidate.panelId ? { ...panel, ...candidate.to } : { ...panel }) : state.panels.map(panel => ({ ...panel }));
      return commit(state, { panels, suggestion: null, lastOutcome: null }, 'suggestion-accepted', { candidate, ...(candidate.type === 'layout' ? { from: { x: previous.x, z: previous.z }, to: candidate.to } : {}) });
    }
    case 'DISMISS_SUGGESTION':
      return state.suggestion ? event({ ...state, suggestion: null, lastOutcome: null }, 'suggestion-dismissed', { candidate: state.suggestion, ruleCreated: false }) : state;
    case 'CHANGE_STAGE': {
      const stage = action.stage ?? action.to ?? (state.stage === 'arrange' ? 'review' : 'arrange');
      if (!STAGES.has(stage) || stage === state.stage) return state;
      const expires = state.boundary?.duration === 'stage';
      return commit(state, { stage, boundary: expires ? null : state.boundary, draftBoundary: null, suggestion: null, lastOutcome: null }, 'stage-changed', { from: state.stage, to: stage, expiredBoundary: expires ? state.boundary : null });
    }
    case 'UNDO': {
      if (!state.history.length) return state;
      const previous = copy(state.history[state.history.length - 1]);
      return event({ ...state, ...previous, draftBoundary: null, history: state.history.slice(0, -1) }, 'undo', { restoredStage: previous.stage, restoredBoundary: previous.boundary });
    }
    case 'RESET': {
      const fresh = createState();
      return commit(state, { ...fresh, events: state.events, nextEventId: state.nextEventId }, 'reset', { restoredPanels: initialPanels.map(({ id, x, z }) => ({ id, x, z })) });
    }
    case 'CLEAR_LOG':
      return { ...state, events: [] };
    default:
      return state;
  }
}
