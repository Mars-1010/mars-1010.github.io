import { createState, dispatch, suggestionCatalogue, boundaryReason } from './boundary-model.mjs';
import { BoundaryScene } from './boundary-scene.js?v=20261028-guide';

const $ = selector => document.querySelector(selector);
const stageNames = {arrange:'Arranging', review:'Reviewing'};
let state = createState();
let tool = 'select';
let view = 'perspective';
let scene;
const guide={active:true,phase:0};
const guideCopy=[
  ['Move Panel A.','The solid panel shows its current position. The purple panel is a preview; A moves only when you apply it.','','Move A to the preview ↗',''],
  ['Keep A in this position.','A has moved. If this position works for you, pin the panel to pause further layout suggestions.','','Keep A here ⌖',''],
  ['Protect A for this stage.','Pause layout suggestions for A until arranging ends. B, C and D can still receive help.','','Confirm the boundary ✓',''],
  ['Try another suggestion for A.','The brass pin marks the protected panel. Ask for another layout suggestion to see what the boundary does.','','Test A again ↗',''],
  ['A stays in place.','No new purple preview appears for A. Now check whether the assistant can still suggest a position for B.','','Try a suggestion for B ↗',''],
  ['A is protected. B can still move.','Your boundary pauses only A’s layout suggestions. Next, try drawing a pause area, undoing a change or changing the duration.','','Explore on your own ↗','']
];
function advanceGuide(action, next) {
  if(!guide.active)return;
  const a=next.suggestion;
  if(guide.phase===0&&action.type==='ACCEPT_SUGGESTION'&&next.events.at(-1)?.candidate?.panelId==='a')guide.phase=1;
  else if(guide.phase===1&&action.type==='DRAFT_BOUNDARY'&&next.draftBoundary?.target.panelId==='a')guide.phase=2;
  else if(guide.phase===2&&action.type==='CONFIRM_BOUNDARY'&&next.boundary?.target.panelId==='a'&&next.boundary.action==='layout')guide.phase=3;
  else if(guide.phase===3&&action.type==='TRY_SUGGESTION'&&next.lastOutcome?.kind==='suppressed'&&next.lastOutcome.candidate.panelId==='a')guide.phase=4;
  else if(guide.phase===4&&action.type==='TRY_SUGGESTION'&&a?.panelId==='b'&&next.boundary?.target.panelId==='a')guide.phase=5;
}
function renderGuide() {
  document.body.dataset.guided=String(guide.active);
  document.body.dataset.guidePhase=String(guide.phase);
  const copy=guide.active?guideCopy[guide.phase]:['Arrange the exhibition.','Select a panel to see its suggestion. Pin an object, or draw an area where suggestions should pause.','','',''];
  $('#guide-title').textContent=copy[0];$('#guide-copy').textContent=copy[1];$('#guide-english').textContent=copy[2];$('#guide-english').hidden=!copy[2];
  $('#guide-action').replaceChildren(document.createTextNode(copy[3]));
  if(copy[4]){const sub=document.createElement('small');sub.textContent=copy[4];$('#guide-action').append(sub);}
  $('#guide-action').hidden=!guide.active;
  $('#guide-switch').textContent=guide.active?'Skip guide ↗':'Restart guide ↺';
  $('#guide-proof').hidden=!(guide.active&&guide.phase===5);
  const current=guide.phase===0?0:guide.phase<3?1:2;
  document.querySelectorAll('[data-guide-step]').forEach(li=>{const n=Number(li.dataset.guideStep);li.classList.toggle('complete',n<current);if(n===current)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
  $('#scene-callout').hidden=!guide.active;
  if(guide.active){
    const label=guide.phase===0?'Purple A = proposed position':guide.phase<3?'A moved. Keep this position.':guide.phase<5?'Brass pin = protected panel':'A is protected. B can still receive help.';
    $('#scene-callout').textContent=label;
  }
  updateInstructions();
}

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
  advanceGuide(action,state);
  render();
  if (state !== previous && message) notify(message);
  return state !== previous;
}
function select(id) {
  if (state.draftBoundary) { notify('Confirm or cancel the boundary before selecting another panel.'); return; }
  if(guide.active&&!(guide.phase===4&&id==='b')){notify('Follow the current step above, or choose Skip guide.');return;}
  state=dispatch(state,{type:'SELECT',id});
  showCandidate(id,'layout');
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
  $('#scene-instruction').textContent=guide.active?'Follow the step above. Drag to look around.':tool==='region'?'Drag on the floor to mark an area. Release to review your boundary.':view==='plan'?'Select a panel, or choose Pause area to draw on the floor.':'Drag to turn the room. Click a panel to select it.';
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
    button.disabled = pending||(guide.active&&!(guide.phase===4&&button.dataset.panel==='b'));
  });
  $('#selection-name').textContent = name.toUpperCase();
  $('#pin-object').innerHTML = `<span aria-hidden="true">⌖</span> Keep Panel ${state.selected.toUpperCase()} here`;
  $('#pin-object').disabled = pending||(guide.active&&guide.phase!==1);
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
  const focusId=(candidate||outcome?.candidate)?.panelId;
  $('#suggestion-index').textContent = focusId?`${(candidate||outcome?.candidate)?.type==='hint'?'HINT':'SUGGESTION'} FOR ${focusId.toUpperCase()}`:'ASSISTANCE';
  $('#suggestion-title').textContent = candidate ? candidate.title : outcome?.kind === 'suppressed' ? `Panel ${outcome.candidate.panelId.toUpperCase()} stays in place.` : 'Choose what to try next.';
  $('#suggestion-why').textContent = candidate ? `${candidate.type==='layout'?'The purple panel previews a position. Apply it to move the panel.':'This hint explains the content; it does not move the panel.'} ${candidate.why}` : outcome?.kind === 'suppressed' ? `Your boundary pauses ${outcome.candidate.type==='layout'?'layout suggestions':'explanatory hints'} here. No new suggestion appears; nothing changes.` : 'Pin a panel to keep its position, or select another panel to see its suggestion.';
  $('#accept-suggestion').disabled = !candidate || pending || (guide.active&&guide.phase!==0);
  $('#accept-suggestion').textContent = candidate?.type === 'hint' ? 'Got it ✓' : 'Apply this position ↗';
  $('#dismiss-suggestion').disabled = !candidate || pending;
  $('#outcome-note').hidden = outcome?.kind !== 'suppressed';
  if (outcome?.kind === 'suppressed') { $('#outcome-note').textContent = outcome.ruleReason; $('#outcome-note').dataset.kind = outcome.kind; }
  renderLog();
  renderGuide();
}

function restartGuide(){
  guide.active=true;guide.phase=0;
  $('#boundary-action').value='layout';$('#boundary-duration').value='stage';
  state=dispatch(state,{type:'RESET'});state=dispatch(state,{type:'NEXT_SUGGESTION'});
  setTool('select');setView('perspective');scene?.resetView();render();
  notify('Start with Move A to the preview above.');
}
$('#guide-switch').addEventListener('click',()=>{if(guide.active){guide.active=false;render();notify('Select a panel to see its suggestion.');}else restartGuide();});
$('#guide-action').addEventListener('click',()=>{
  switch(guide.phase){
    case 0: act({type:'ACCEPT_SUGGESTION'},'A moved. Next, pin it to keep this position.');break;
    case 1: draft({type:'object',id:'a'});break;
    case 2: act({type:'CONFIRM_BOUNDARY'},'A is pinned. Try another suggestion for A to test the boundary.');setTool('select');break;
    case 3: showCandidate('a','layout');break;
    case 4: state=dispatch(state,{type:'SELECT',id:'b'});showCandidate('b','layout');break;
    default: guide.active=false;render();notify('Select a panel, or draw a pause area to explore on your own.');
  }
});

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
  state=dispatch(state,{type:'NEXT_SUGGESTION'});
  if(state.lastOutcome)state=dispatch(state,{type:'SELECT',id:state.lastOutcome.candidate.panelId});
  render();announceOutcome();
});
$('#accept-suggestion').addEventListener('click',()=>{
  const kind=state.suggestion?.type;
  act({type:'ACCEPT_SUGGESTION'},kind==='hint'?'Hint acknowledged. The layout stays in place.':'Preview applied. Undo restores the previous layout.');
});
$('#dismiss-suggestion').addEventListener('click',()=>act({type:'DISMISS_SUGGESTION'},'Suggestion dismissed. No boundary or preference was created.'));
$('#undo').addEventListener('click',()=>act({type:'UNDO'},'Restored the previous confirmed state.'));
$('#reset-workspace').addEventListener('click',restartGuide);
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
