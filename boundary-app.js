import { createState, dispatch, suggestionCatalogue, boundaryReason } from './boundary-model.mjs';
import { BoundaryScene } from './boundary-scene.js';

const $ = selector => document.querySelector(selector);
const stageNames = {arrange:'Arranging', review:'Reviewing'};
let state = createState();
let tool = 'select';
let view = 'perspective';
let scene;

function targetName(target) {
  if (target.kind === 'object') return `Panel ${target.panelId.toUpperCase()}`;
  const {minX,maxX} = target.rect;
  if (maxX <= 0) return 'the left area';
  if (minX >= 0) return 'the right area';
  return 'the marked area';
}
function rendererBoundary(boundary) {
  if (!boundary) return null;
  const t = boundary.target;
  const target = t.kind === 'object' ? {type:'object', id:t.panelId} : {type:'region',x1:t.rect.minX,x2:t.rect.maxX,z1:t.rect.minZ,z2:t.rect.maxZ};
  return {...boundary, target};
}
function selectedName() { return `Panel ${state.selected.toUpperCase()}`; }
function notify(text) { $('#scene-feedback').textContent = text; }
function act(action, message) {
  const previous = state;
  state = dispatch(state, action);
  render();
  if (state !== previous && message) notify(message);
  return state !== previous;
}
function select(id) {
  if (state.draftBoundary) { notify('Confirm or cancel the boundary before selecting another panel.'); return; }
  act({type:'SELECT',id}, `Panel ${id.toUpperCase()} selected. Pin it, or try a suggestion for this panel.`);
}
function setView(next) {
  if (scene?.fallback) next='plan';
  view = next;
  scene?.setView(next);
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.view === next)));
  $('#scene-mode').textContent = `EXHIBITION / ${next === 'plan' ? 'PLAN' : 'PERSPECTIVE'}`;
  updateInstructions();
}
function updateInstructions() {
  $('#scene-instruction').textContent=tool==='region'?'Drag on the floor to mark an area. Release to review your boundary.':view==='plan'?'Select a panel, or choose Pause area to draw on the floor.':'Drag to turn the room. Click a panel to select it.';
}
function setTool(next) {
  tool = next;
  scene?.setTool(next);
  if (next === 'region') setView('plan');
  $('#select-tool').setAttribute('aria-pressed',String(next === 'select'));
  $('#region-tool').setAttribute('aria-pressed',String(next === 'region'));
  $('#select-tool').classList.toggle('active',next === 'select');
  $('#region-tool').classList.toggle('active',next === 'region');
  $('#region-access').hidden = next !== 'region';
  updateInstructions();
}
function draft(target) {
  act({type:'DRAFT_BOUNDARY', target, action:$('#boundary-action').value, duration:$('#boundary-duration').value}, 'Review the target, the kind of help and its duration. Confirm to set the boundary.');
}
function showCandidate(panelId, candidateType) {
  if (state.draftBoundary) { notify('Confirm or cancel the boundary first.'); return; }
  if (state.suggestion) state = dispatch(state,{type:'DISMISS_SUGGESTION'});
  const matched = suggestionCatalogue.find(item => item.panelId === panelId && item.type === candidateType);
  if (!matched) { notify('Choose A or B to try an explanatory hint.'); render(); return; }
  act({type:'TRY_SUGGESTION',panelId,candidateType});
  announceOutcome();
}
function announceOutcome() {
  const outcome = state.lastOutcome;
  if (!outcome) return;
  const panel = `Panel ${outcome.candidate.panelId.toUpperCase()}`;
  if (outcome.kind === 'suppressed') notify(`${panel}: this ${outcome.candidate.type === 'layout' ? 'layout suggestion' : 'hint'} is paused by your boundary. Other help remains available.`);
  else notify(outcome.candidate.type === 'layout' ? `${panel}: a translucent alternative is visible. Apply it, or leave the original in place.` : `${panel}: an explanatory hint is available. The panels stay in place.`);
}
function eventText(entry) {
  const panel = entry.candidate ? `Panel ${entry.candidate.panelId.toUpperCase()}` : '';
  switch(entry.type) {
    case 'suggestion-offered': return `${entry.candidate.type === 'layout' ? 'Preview offered' : 'Hint offered'} · ${panel}`;
    case 'suggestion-suppressed': return `Suggestion paused · ${panel}. ${entry.ruleReason}`;
    case 'suggestion-accepted': return `${entry.candidate.type === 'layout' ? 'Layout applied' : 'Hint acknowledged'} · ${panel}`;
    case 'suggestion-dismissed': return `Dismissed · ${panel}. No new rule.`;
    case 'boundary-confirmed': return `Boundary confirmed · ${boundaryReason(entry.boundary)}${entry.replaced ? ' Replaced the previous boundary.' : ''}`;
    case 'boundary-removed': return 'Boundary removed. Suggestions are available here again.';
    case 'stage-changed': return `Stage changed · ${stageNames[entry.from]} → ${stageNames[entry.to]}.${entry.expiredBoundary ? ' Stage boundary expired.' : ''}`;
    case 'undo': return 'Undid the last confirmed change.';
    case 'reset': return 'Exhibition reset. The reset can be undone.';
    default: return entry.type;
  }
}
function renderLog() {
  $('#log-count').textContent = `${state.events.length} events ＋`;
  $('#event-list').replaceChildren(...state.events.slice().reverse().map(entry => {
    const li = document.createElement('li');
    const number = document.createElement('time');
    number.textContent = String(entry.id).padStart(3,'0');
    const text = document.createElement('span');
    text.textContent = eventText(entry);
    li.append(number,text);
    return li;
  }));
}
function render() {
  scene?.update({...state,boundary:rendererBoundary(state.boundary),draftBoundary:rendererBoundary(state.draftBoundary)});
  const name = selectedName();
  const pending = Boolean(state.draftBoundary);
  document.querySelectorAll('[data-panel]').forEach(button => {
    button.setAttribute('aria-pressed',String(button.dataset.panel === state.selected));
    button.disabled = pending;
  });
  $('#selection-name').textContent = name.toUpperCase();
  $('#pin-object').innerHTML = `<span aria-hidden="true">⌖</span> Pin ${name} <small>固定对象</small>`;
  $('#pin-object').disabled = pending;
  $('#try-selected').textContent = `Try a layout suggestion for ${state.selected.toUpperCase()} ↗`;
  $('#try-selected').disabled = pending;
  const hasHint = suggestionCatalogue.some(c => c.panelId === state.selected && c.type === 'hint');
  $('#try-hint').textContent = `Try a hint for ${hasHint ? state.selected.toUpperCase() : 'A'} ↗`;
  $('#try-hint').disabled = pending;
  $('#next-suggestion').disabled = pending;
  $('#region-tool').disabled = pending;
  $('#select-tool').disabled = pending;
  $('#stage-label').textContent = `${state.stage === 'arrange' ? '01' : '02'} / ${stageNames[state.stage]}`;
  $('#change-stage').textContent = state.stage === 'arrange' ? 'Begin review ↗' : 'Arrange again ↗';
  $('#change-stage').disabled = pending;
  $('#boundary-editor').hidden = !pending;
  if (pending) {
    $('#draft-target').textContent = `Protect ${targetName(state.draftBoundary.target)}`;
    $('#replace-note').hidden = !state.boundary;
    $('#boundary-action').value = state.draftBoundary.action;
    $('#boundary-duration').value = state.draftBoundary.duration;
  }
  const boundary = state.boundary;
  $('#boundary-summary').classList.toggle('active',Boolean(boundary));
  $('#rule-title').textContent = boundary ? `${boundary.action === 'layout' ? 'Layout' : 'Hints'} paused for ${targetName(boundary.target)}.` : 'No boundary set.';
  $('#rule-description').textContent = boundary ? `${boundary.duration === 'stage' ? `Until ${stageNames[boundary.stage].toLowerCase()} ends.` : 'Until you remove it, reset or leave this page.'} ${boundary.action === 'layout' ? 'Explanatory hints remain available.' : 'Layout suggestions remain available.'} ${boundary.target.kind === 'region' ? 'The rule checks panel centres inside the marked floor area.' : 'Other panels remain available.'}` : 'Suggestions are available across the exhibition.';
  $('#remove-boundary').hidden = !boundary;
  $('#remove-boundary').disabled = pending;
  $('#undo').disabled = !state.history.length || pending;
  const candidate = state.suggestion;
  const outcome = state.lastOutcome;
  $('#suggestion-index').textContent = candidate?.type === 'hint' ? '01 / AN EXPLANATORY HINT' : '01 / A SUGGESTION';
  $('#suggestion-title').textContent = candidate ? candidate.title : outcome?.kind === 'suppressed' ? 'This part stays yours.' : 'Ready when you are.';
  $('#suggestion-why').textContent = candidate ? `${candidate.why}${candidate.type === 'layout' ? ' The translucent panel is a preview; the original stays in place.' : ' This is an explanation, so nothing moves.'}` : outcome?.kind === 'suppressed' ? `The candidate for Panel ${outcome.candidate.panelId.toUpperCase()} matches your boundary. No preview is offered and nothing moves.` : 'Try another suggestion, or mark a part of the exhibition you want to keep as it is.';
  $('#accept-suggestion').disabled = !candidate || pending;
  $('#accept-suggestion').textContent = candidate?.type === 'hint' ? 'Got it ✓' : 'Apply preview ↗';
  $('#dismiss-suggestion').disabled = !candidate || pending;
  $('#outcome-note').hidden = outcome?.kind !== 'suppressed';
  if (outcome?.kind === 'suppressed') { $('#outcome-note').textContent = outcome.ruleReason; $('#outcome-note').dataset.kind = outcome.kind; }
  renderLog();
}

try {
  scene = new BoundaryScene($('#boundary-canvas'),{
    onSelect: select,
    onRegion: region => draft({type:'region',...region}),
    onMessage: notify
  });
  if(scene.fallback){setView('plan');document.querySelector('[data-view="perspective"]').disabled=true;}
} catch (error) {
  notify('The 3D view could not start. Use the panel buttons and named area controls to try the boundary interaction.');
}

document.querySelectorAll('[data-panel]').forEach(button => button.addEventListener('click',()=>select(button.dataset.panel)));
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click',()=>{
  if (tool === 'region' && button.dataset.view !== 'plan') setTool('select');
  setView(button.dataset.view);
}));
$('#reset-view').addEventListener('click',()=>{scene?.resetView();if(tool==='region')setView('plan');else setView('perspective');});
$('#select-tool').addEventListener('click',()=>setTool('select'));
$('#region-tool').addEventListener('click',()=>{setTool('region');notify('Drag a rectangle on the floor, or choose the left or right half below.');});
document.querySelectorAll('[data-region]').forEach(button => button.addEventListener('click',()=>draft({type:'region',x1:button.dataset.region==='left'?-4:0,x2:button.dataset.region==='left'?0:4,z1:-2.6,z2:2.6})));
$('#pin-object').addEventListener('click',()=>draft({type:'object',id:state.selected}));
for (const id of ['boundary-action','boundary-duration']) $(
  `#${id}`).addEventListener('change',()=>{if(state.draftBoundary)draft(state.draftBoundary.target);});
$('#confirm-boundary').addEventListener('click',()=>{
  act({type:'CONFIRM_BOUNDARY'},'Boundary confirmed. Try a suggestion here, then compare with another panel.');
  setTool('select');
});
$('#cancel-boundary').addEventListener('click',()=>{act({type:'CANCEL_DRAFT'},'Boundary cancelled. The previous rule and your layout are unchanged.');setTool('select');});
$('#remove-boundary').addEventListener('click',()=>act({type:'REMOVE_BOUNDARY'},'Boundary removed. Try a suggestion here again.'));
$('#try-selected').addEventListener('click',()=>showCandidate(state.selected,'layout'));
$('#try-hint').addEventListener('click',()=>{
  const id = suggestionCatalogue.some(c=>c.panelId===state.selected&&c.type==='hint')?state.selected:'a';
  showCandidate(id,'hint');
});
$('#next-suggestion').addEventListener('click',()=>{
  if (state.suggestion) state=dispatch(state,{type:'DISMISS_SUGGESTION'});
  act({type:'NEXT_SUGGESTION'});announceOutcome();
});
$('#accept-suggestion').addEventListener('click',()=>{
  const kind=state.suggestion?.type;
  act({type:'ACCEPT_SUGGESTION'},kind==='hint'?'Hint acknowledged. The layout stays in place.':'Preview applied. Undo restores the previous layout.');
});
$('#dismiss-suggestion').addEventListener('click',()=>act({type:'DISMISS_SUGGESTION'},'Suggestion dismissed. No boundary or preference was created.'));
$('#undo').addEventListener('click',()=>act({type:'UNDO'},'Restored the previous confirmed state.'));
$('#reset-workspace').addEventListener('click',()=>{$('#boundary-action').value='layout';$('#boundary-duration').value='stage';act({type:'RESET'},'Exhibition reset. Undo can restore your previous layout and boundary.');setTool('select');setView('perspective');});
const dialog=$('#stage-dialog');
$('#change-stage').addEventListener('click',()=>{
  const next=state.stage==='arrange'?'review':'arrange';
  $('#stage-dialog-title').textContent=next==='review'?'Begin review?':'Arrange again?';
  $('#stage-confirm').textContent=next==='review'?'Begin review':'Begin arranging';
  $('#stage-dialog-copy').textContent=`The current stage will end.${state.boundary?.duration==='stage'?' Your current boundary will expire.':state.boundary?' Your boundary stays active until you remove it.':' No boundary is active.'} Any open preview will close. Undo can restore this stage.`;
  dialog.showModal();
});
$('#stage-confirm').addEventListener('click',()=>{act({type:'CHANGE_STAGE'},'Stage changed. Check the rule summary to see which boundaries remain.');dialog.close();});
$('#stage-cancel').addEventListener('click',()=>dialog.close());
$('#export-log').addEventListener('click',()=>{
  const record={prototype:'Boundaries',version:1,exportedAt:new Date().toISOString(),note:'Local, fixed-catalogue browser interaction. No camera, model inference or participant study.',stage:state.stage,panels:state.panels,boundary:state.boundary,events:state.events};
  const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='boundaries-interaction.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
window.addEventListener('pagehide',event=>{if(!event.persisted)scene?.dispose();});
state=dispatch(state,{type:'NEXT_SUGGESTION'});
render();
