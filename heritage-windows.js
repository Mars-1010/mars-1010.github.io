const MOTIFS = [
  { name: 'A window within a window', cn: '复合花心', kind: 'composite', family: 'Curved and straight members / 曲直相织', copy: 'A horizontal rail divides the panel; small openwork details sit inside a larger lattice.', unit: 'One opening, framed by curved members / 曲线围合的花心' },
  { name: 'Sixfold rosette', cn: '六瓣攒簇', kind: 'rosette', family: 'Sixfold repetition / 六向重复', copy: 'Follow one sixfold unit, then see how neighbouring units share the same slender members.', unit: 'A sixfold repeating unit / 六向放射的重复单元' },
  { name: 'A denser rhythm', cn: '密簇六瓣', kind: 'dense', family: 'Closely repeated rosettes / 花心密排', copy: 'The same rhythm becomes finer as the repeating units move closer together.', unit: 'A small rosette and its neighbours / 花心与相邻单元' },
  { name: 'Flowers on the diagonal', cn: '斜格团花', kind: 'flower', family: 'Diagonal members / 斜向窗棂', copy: 'Diagonal lines frame small rounded openings. Light reveals both the lattice and the space between it.', unit: 'A rounded opening inside a diagonal grid / 斜格中的曲线开口' },
  { name: 'Crossed in eight directions', cn: '四交八斜', kind: 'eight', family: 'Horizontal, vertical, diagonal / 横、竖与斜向', copy: 'Trace the straight members in three directions. Their crossings create a network of small triangular openings.', unit: 'A crossing of straight members / 三向窗棂的交会' },
  { name: 'An open diagonal', cn: '斜格窗棂', kind: 'diamond', family: 'An open diagonal rhythm / 疏朗斜格', copy: 'A simpler diagonal rhythm makes the changing shadows easier to read.', unit: 'One diamond-shaped opening / 一组菱形开口' }
];

const memberInfo = {
  petal: ['Rosette / 花心', 'A sixfold repeating unit / 六向放射的重复单元'],
  diagonal: ['Diagonal / 斜棂', 'Slender diagonal members connect the pattern / 斜向木条串联纹样'],
  horizontal: ['Horizontal / 横棂', 'Horizontal members hold the rhythm across the panel / 横向木条组织节奏'],
  vertical: ['Vertical / 竖棂', 'Vertical members divide the openwork / 竖向木条分隔开口'],
  curved: ['Curved member / 曲棂', 'Curves soften the space inside a straight lattice / 曲线围出柔和的空隙']
};

function n(v) { return Number(v.toFixed(2)); }
function point(r, angle) { return [n(Math.cos(angle) * r), n(Math.sin(angle) * r)]; }
function poly(points, close = true) { return points.map((p, i) => `${i ? 'L' : 'M'}${n(p[0])},${n(p[1])}`).join(' ') + (close ? ' Z' : ''); }
function path(d, family = 'diagonal') { return `<g class="wl-member" data-family="${family}"><path class="wl-member-edge" d="${d}"/><path class="wl-member-face" d="${d}"/><path class="wl-member-glint" d="${d}"/></g>`; }

function rosette(radius, dense = false) {
  const a = -Math.PI / 2;
  const outside = Array.from({ length: 6 }, (_, i) => point(radius, a + i * Math.PI / 3));
  const star = Array.from({ length: 12 }, (_, i) => point(i % 2 ? radius * .40 : radius * .87, a + i * Math.PI / 6));
  let out = path(poly(outside), 'diagonal') + path(poly(star), 'petal');
  for (let i = 0; i < 6; i++) {
    const p = point(radius * .4, a + Math.PI / 6 + i * Math.PI / 3);
    const q = point(radius, a + i * Math.PI / 3);
    const r = point(radius, a + (i + 1) * Math.PI / 3);
    out += path(poly([q, p, r], false), 'petal');
  }
  if (!dense) out += path(poly(Array.from({ length: 6 }, (_, i) => point(radius * .18, a + i * Math.PI / 3))), 'petal');
  return out;
}

function flower(radius) {
  let d = '';
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const p = point(radius * .62, a - Math.PI / 4);
    const q = point(radius * 1.1, a);
    const r = point(radius * .62, a + Math.PI / 4);
    const t = point(radius * .22, a + Math.PI / 2);
    d += `M${p} Q${q} ${r} Q${t} ${p} `;
  }
  return path(d, 'curved') + path(poly([[-radius, 0], [0, -radius], [radius, 0], [0, radius]]), 'diagonal');
}

function unitsFor(kind) {
  const units = [];
  const add = (x, y, body, family = 'diagonal') => units.push({ x, y, body, family });
  if (kind === 'rosette' || kind === 'dense') {
    const pitch = kind === 'dense' ? 42 : 62;
    const row = pitch * Math.sqrt(3) / 2;
    for (let y = -270, iy = 0; y <= 280; y += row, iy++) {
      for (let x = -225 + (iy % 2) * pitch / 2; x <= 240; x += pitch) add(x, y, rosette(pitch / Math.sqrt(3), kind === 'dense'), 'petal');
    }
  } else if (kind === 'flower') {
    const pitch = 67;
    for (let y = -270, iy = 0; y <= 300; y += pitch, iy++) {
      for (let x = -230 + (iy % 2) * pitch / 2; x <= 250; x += pitch) add(x, y, flower(pitch * .49), 'curved');
    }
  } else if (kind === 'composite') {
    for (let y = -250; y <= 280; y += 83) {
      for (let x = -208; x <= 240; x += 83) {
        let body = flower(38);
        body += path('M-25,0 Q-14,-28 0,0 Q14,28 25,0 M0,-25 Q28,-14 0,0 Q-28,14 0,25', 'curved');
        add(x, y, body, 'curved');
      }
    }
  } else {
    const pitch = kind === 'eight' ? 61 : 46;
    for (let y = -275; y <= 300; y += pitch) {
      for (let x = -225; x <= 250; x += pitch) {
        let body = path(`M${-pitch / 2},${-pitch / 2} L${pitch / 2},${pitch / 2} M${pitch / 2},${-pitch / 2} L${-pitch / 2},${pitch / 2}`, 'diagonal');
        if (kind === 'eight') body += path(`M${-pitch / 2},0 H${pitch / 2}`, 'horizontal') + path(`M0,${-pitch / 2} V${pitch / 2}`, 'vertical');
        else body += path(`M${-pitch / 2 + 7},${-pitch / 2} L${pitch / 2},${pitch / 2 - 7} M${pitch / 2 - 7},${-pitch / 2} L${-pitch / 2},${pitch / 2 - 7}`, 'diagonal');
        add(x, y, body);
      }
    }
  }
  return units;
}

function referencePath(index) { return `assets/heritage/window-${String(index + 1).padStart(2, '0')}.jpg`; }

/** Interactive motif study based on the Geyuan Temple survey-board photographs. */
export function initWindowLab(container) {
  if (!container) return { destroy() {} };
  container._windowLab?.destroy();
  const uid = `wl-${Math.random().toString(36).slice(2, 9)}`;
  const controller = new AbortController();
  const signal = controller.signal;
  let index = 1;
  let spread = 0;
  let light = -24;
  let parts = false;
  let reference = false;
  let units = [];
  let selectedUnit = -1;
  let raf = 0;
  container.classList.add('window-lab');
  container.innerHTML = `
    <div class="wl-topline"><span>GEYUAN · WENSHU HALL / 阁院寺 · 文殊殿</span><span>LIGHT & OPENWORK / 光与花窗</span></div>
    <div class="wl-layout">
      <div class="wl-stage" id="${uid}-panel" tabindex="0" role="tabpanel" aria-labelledby="${uid}-tab-${index}">
        <svg class="wl-svg" viewBox="0 0 900 760" role="img" aria-label="An interactive sixfold wooden lattice, with a changing cast shadow">
          <defs>
            <linearGradient id="${uid}-wood" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c39c74"/><stop offset=".28" stop-color="#8b6246"/><stop offset=".64" stop-color="#6b4633"/><stop offset="1" stop-color="#a37b58"/></linearGradient>
            <linearGradient id="${uid}-frame" x1="0" y1="0" x2="1" y2=".1"><stop stop-color="#6c4937"/><stop offset=".3" stop-color="#af845f"/><stop offset=".55" stop-color="#7c543c"/><stop offset="1" stop-color="#5a3c2f"/></linearGradient>
            <radialGradient id="${uid}-light"><stop stop-color="#fffcf0"/><stop offset="1" stop-color="#d3c8bd"/></radialGradient>
            <filter id="${uid}-shadow" x="-50%" y="-50%" width="200%" height="200%"><feColorMatrix type="matrix" values="0 0 0 0 .18 0 0 0 0 .12 0 0 0 0 .08 0 0 0 1 0"/><feGaussianBlur stdDeviation="2.1"/></filter>
            <clipPath id="${uid}-clip"><rect x="-185" y="-258" width="370" height="516"/></clipPath>
          </defs>
          <g class="wl-panel" transform="translate(432 366) rotate(-5)">
            <rect class="wl-backlight" x="-210" y="-283" width="420" height="566" rx="1" fill="url(#${uid}-light)"/>
            <g class="wl-cast-shadow" filter="url(#${uid}-shadow)" transform="translate(30 26)"><use href="#${uid}-lattice"/></g>
            <g class="wl-lattice" id="${uid}-lattice" clip-path="url(#${uid}-clip)" style="--wl-wood:url(#${uid}-wood)"></g>
            <g class="wl-frame" fill="url(#${uid}-frame)" stroke="#4c342b" stroke-width="1">
              <rect x="-211" y="-284" width="26" height="568"/><rect x="185" y="-284" width="26" height="568"/>
              <rect x="-211" y="-284" width="422" height="26"/><rect x="-211" y="258" width="422" height="26"/>
              <path class="wl-inner-bead" fill="none" stroke="#c49c76" stroke-width="1.3" d="M-187,260 V-260 H187 V260 Z"/>
              <path class="wl-frame-grain" fill="none" stroke="#422e26" stroke-opacity=".28" stroke-width=".7" d="M-202,-271 V272 M-196,-270 V270 M195,-270 V270 M203,-272 V272 M-198,-277 H198 M-197,-265 H197 M-200,267 H198 M-198,277 H200"/>
            </g>
          </g>
        </svg>
        <div class="wl-stage-caption"><span class="wl-readout">Sixfold repetition / 六向重复</span><span>Drag light → follow the shadow<br>移动光线，观察窗影</span></div>
        <button type="button" class="wl-reference-toggle" aria-pressed="false">Survey detail / 测绘细部 <span>↗</span></button>
        <figure class="wl-reference" hidden><img src="${referencePath(index)}" alt="Original photographed Geyuan Temple wooden lattice from the architectural survey board"><figcaption>Survey-board detail / 原测绘展板细部</figcaption></figure>
        <div class="wl-hover-caption" aria-hidden="true"><span>◎</span><p>Hover to follow one repeating unit<br>移入纹样，查看重复单元</p></div>
      </div>
      <div class="wl-controls">
        <p class="wl-index">02 / 06</p>
        <h3 class="wl-title">Sixfold<br>rosette.</h3>
        <p class="wl-cn">六瓣攒簇</p>
        <p class="wl-copy">${MOTIFS[index].copy}</p>
        <div class="wl-view-controls"><button type="button" class="wl-parts" aria-pressed="false"><span>＋</span> Trace the members / 看窗棂</button></div>
        <label class="wl-range"><span>Separate the units <small>拆看纹样</small><output class="wl-spread-output">0%</output></span><input class="wl-spread" type="range" min="0" max="100" value="0" aria-label="Separate the repeating units"><span class="wl-range-ends"><small>Joined / 组合</small><small>Apart / 分开</small></span></label>
        <label class="wl-range"><span>Light angle <small>光线角度</small><output class="wl-light-output">−24°</output></span><input class="wl-light" type="range" min="-70" max="70" value="-24" aria-label="Light angle"><span class="wl-range-ends"><small>←</small><small>→</small></span></label>
        <p class="wl-unit-caption">${MOTIFS[index].unit}</p>
        <p class="wl-keyboard">← → Select a unit · Esc clear<br>方向键选择单元，Esc 取消</p>
      </div>
    </div>
    <div class="wl-motif-list" role="tablist" aria-label="Window patterns from the Geyuan Temple survey board">${MOTIFS.map((m, i) => `<button class="wl-motif${i === index ? ' active' : ''}" type="button" role="tab" id="${uid}-tab-${i}" aria-controls="${uid}-panel" aria-selected="${i === index}" tabindex="${i === index ? 0 : -1}" data-motif="${i}"><span class="wl-motif-thumb"><img src="${referencePath(i)}" alt="" loading="lazy"></span><span class="wl-motif-number">0${i + 1}</span><span class="wl-motif-name">${m.cn}</span></button>`).join('')}</div>
    <p class="wl-note">The survey records six families of window patterns. These interactive studies explore their repeating geometry; the photographs retain the original detail.<br>测绘记录将花窗归为六类。互动图形用于观察纹样的重复关系，细部以原始照片为参照。</p>`;

  const svg = container.querySelector('.wl-svg');
  const lattice = container.querySelector('.wl-lattice');
  const stage = container.querySelector('.wl-stage');
  const sourceImage = container.querySelector('.wl-reference img');
  const readout = container.querySelector('.wl-readout');
  const caption = container.querySelector('.wl-unit-caption');
  const hoverCaption = container.querySelector('.wl-hover-caption p');
  const spreadInput = container.querySelector('.wl-spread');
  const lightInput = container.querySelector('.wl-light');
  const shadow = container.querySelector('.wl-cast-shadow');

  function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); }
  function update() {
    const s = spread / 100;
    const members = lattice.querySelectorAll('.wl-unit');
    members.forEach((unit, i) => {
      const source = units[i];
      const lift = s * 38;
      const dx = source.x * s * .42;
      const dy = source.y * s * .3;
      unit.setAttribute('transform', `translate(${n(source.x + dx)} ${n(source.y + dy)}) rotate(${n((i % 2 ? -1 : 1) * lift * .2)})`);
      unit.classList.toggle('wl-unit-selected', i === selectedUnit);
    });
    const lx = Math.sin(light * Math.PI / 180);
    shadow.setAttribute('transform', `translate(${n(lx * 83)} ${n(12 + Math.abs(lx) * 22)})`);
    shadow.style.opacity = String(.22 + Math.abs(lx) * .24);
    container.style.setProperty('--wl-light-x', `${50 - lx * 38}%`);
    container.classList.toggle('wl-trace-parts', parts);
    container.classList.toggle('wl-separated', s > .03);
    container.querySelector('.wl-spread-output').value = `${spread}%`;
    container.querySelector('.wl-light-output').value = `${light < 0 ? '−' : ''}${Math.abs(light)}°`;
  }

  function selectUnit(next) {
    selectedUnit = next;
    if (next >= 0) {
      caption.textContent = MOTIFS[index].unit;
      hoverCaption.innerHTML = `${MOTIFS[index].unit.split(' / ').join('<br>')}`;
      stage.classList.add('wl-has-selection');
    } else {
      caption.textContent = MOTIFS[index].unit;
      hoverCaption.innerHTML = 'Hover to follow one repeating unit<br>移入纹样，查看重复单元';
      stage.classList.remove('wl-has-selection');
    }
    schedule();
  }

  function setMotif(next) {
    index = Math.max(0, Math.min(MOTIFS.length - 1, Number(next) || 0));
    const motif = MOTIFS[index];
    stage.setAttribute('aria-labelledby', `${uid}-tab-${index}`);
    units = unitsFor(motif.kind);
    lattice.innerHTML = units.map((u, i) => `<g class="wl-unit" data-unit="${i}" transform="translate(${n(u.x)} ${n(u.y)})">${u.body}</g>`).join('');
    container.querySelector('.wl-index').textContent = `0${index + 1} / 06`;
    const title = container.querySelector('.wl-title');
    title.textContent = motif.name + '.';
    container.querySelector('.wl-cn').textContent = motif.cn;
    container.querySelector('.wl-copy').textContent = motif.copy;
    readout.textContent = motif.family;
    caption.textContent = motif.unit;
    svg.setAttribute('aria-label', `Interactive wooden window motif: ${motif.name}. Change the light angle to see its cast shadow.`);
    sourceImage.src = referencePath(index);
    container.querySelectorAll('.wl-motif').forEach((button, i) => {
      button.classList.toggle('active', i === index);
      button.setAttribute('aria-selected', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
    });
    selectUnit(-1);
    update();
  }

  container.querySelectorAll('.wl-motif').forEach(button => {
    button.addEventListener('click', () => setMotif(button.dataset.motif), { signal });
    button.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? 5 : (index + (e.key === 'ArrowRight' ? 1 : -1) + 6) % 6;
      setMotif(next);
      container.querySelector(`[data-motif="${next}"]`).focus();
    }, { signal });
  });
  spreadInput.addEventListener('input', () => { spread = Number(spreadInput.value); schedule(); }, { signal });
  lightInput.addEventListener('input', () => { light = Number(lightInput.value); schedule(); }, { signal });
  container.querySelector('.wl-parts').addEventListener('click', e => {
    parts = !parts;
    e.currentTarget.setAttribute('aria-pressed', String(parts));
    e.currentTarget.querySelector('span').textContent = parts ? '−' : '＋';
    schedule();
  }, { signal });
  container.querySelector('.wl-reference-toggle').addEventListener('click', e => {
    reference = !reference;
    e.currentTarget.setAttribute('aria-pressed', String(reference));
    container.querySelector('.wl-reference').hidden = !reference;
    e.currentTarget.innerHTML = reference ? 'Back to lattice / 返回窗棂 <span>×</span>' : 'Survey detail / 测绘细部 <span>↗</span>';
    stage.classList.toggle('wl-show-reference', reference);
  }, { signal });
  lattice.addEventListener('pointerover', e => {
    const unit = e.target.closest('[data-unit]');
    if (!unit) return;
    selectUnit(Number(unit.dataset.unit));
    const family = e.target.closest('[data-family]')?.dataset.family;
    if (family && parts) {
      const info = memberInfo[family];
      hoverCaption.textContent = info[0];
      caption.textContent = info[1];
    }
  }, { signal });
  lattice.addEventListener('pointerleave', () => selectUnit(-1), { signal });
  stage.addEventListener('keydown', e => {
    if (e.target !== stage) return;
    if (e.key === 'Escape') { e.preventDefault(); selectUnit(-1); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const direction = e.key === 'ArrowRight' ? 1 : -1;
      selectUnit((selectedUnit + direction + units.length) % units.length);
    }
  }, { signal });
  setMotif(index);
  const api = {
    setMotif,
    getState: () => ({ motif: index, spread, light, parts, reference }),
    destroy() {
      controller.abort();
      cancelAnimationFrame(raf);
      if (container._windowLab === api) delete container._windowLab;
    }
  };
  container._windowLab = api;
  return api;
}
