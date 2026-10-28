/** A small, self-contained room. Every lighting state changes its materials. */
let roomSequence = 0;

const MOOD_LABELS = {
  normal: 'A quiet study with a desk, laptop, window and floor lamp.',
  calm: 'The study is dimmed, with soft blue light and a low amber lamp.',
  warm: 'Warm evening light fills the study. The floor lamp is on.',
  bright: 'The study is brightly lit, with a clear window and illuminated desk.',
};

export class AssistantRoom {
  constructor(container) {
    if (!container || typeof container.replaceChildren !== 'function') {
      throw new TypeError('AssistantRoom needs a container element.');
    }
    this.container = container;
    this.disposed = false;
    this.mood = 'normal';
    this.focused = false;
    const id = `assistant-room-${++roomSequence}`;
    const ref = name => `url(#${id}-${name})`;
    const slats = Array.from({ length: 22 }, (_, i) => {
      const x = 104 + i * 8;
      const y = 261.25 - x * .4583;
      return `<path d="M${x} ${y + 8}v191" stroke="var(--room-slat)" stroke-width="3"/><path d="M${x + 2} ${y + 8}v191" stroke="#000" stroke-opacity=".16" stroke-width="2"/>`;
    }).join('');
    const template = document.createElement('template');
    template.innerHTML = `
      <svg class="assistant-room-svg" viewBox="0 0 900 650" role="img" data-mood="normal"
        aria-label="${MOOD_LABELS.normal}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .assistant-room-svg {
            display:block;width:100%;height:100%;overflow:visible;
            --room-wall-left:#35414b;--room-wall-right:#293440;
            --room-floor:#29333e;--room-floor-edge:#18212b;--room-grid:#49535d;
            --room-slat:#596269;--room-timber:#555a5d;--room-timber-edge:#353c43;
            --room-desk:#637077;--room-desk-edge:#35434c;--room-metal:#9daeb7;
            --room-shade:#33444e;--room-seat:#3b4b54;--room-seat-edge:#26343e;
            --room-sky-top:#344a67;--room-sky-bottom:#b28d86;--room-city:#334258;
            --room-window:#9fbac6;--room-window-light:.08;
            --room-lamp:#f5c88b;--room-lamp-light:.28;--room-lamp-pool:.34;
            --room-screen:#84becb;--room-screen-page:#adcbd0;--room-screen-ink:#466b7b;
            --room-plant:#617e74;--room-leaf-light:#8fa499;--room-rug:#3b4651;
            --room-book:#aeafa1;--room-pot:#8b7970;--room-focused:0;
            --room-focus-light:0;--room-desk-work:#78929b;
          }
          .assistant-room-svg[data-mood="calm"] {
            --room-wall-left:#28323d;--room-wall-right:#202a38;
            --room-floor:#202b38;--room-floor-edge:#131c28;--room-grid:#374658;
            --room-slat:#434e5b;--room-timber:#404a54;--room-timber-edge:#2b333d;
            --room-desk:#485967;--room-desk-edge:#293845;--room-metal:#7e929f;
            --room-shade:#283846;--room-seat:#2e4050;--room-seat-edge:#1d2a37;
            --room-sky-top:#1b2744;--room-sky-bottom:#697493;--room-city:#273750;
            --room-window:#7f95b5;--room-window-light:.025;
            --room-lamp:#ddb17b;--room-lamp-light:.12;--room-lamp-pool:.16;
            --room-screen:#5a829b;--room-screen-page:#8eafc1;--room-screen-ink:#3d617d;
            --room-plant:#455f5f;--room-leaf-light:#6a8383;--room-rug:#2f3b4c;
            --room-book:#7e8c95;--room-pot:#655f63;--room-desk-work:#617e94;
          }
          .assistant-room-svg[data-mood="warm"] {
            --room-wall-left:#635446;--room-wall-right:#51463f;
            --room-floor:#4a413c;--room-floor-edge:#2b2b2e;--room-grid:#786251;
            --room-slat:#89705a;--room-timber:#8c735b;--room-timber-edge:#57493f;
            --room-desk:#99866d;--room-desk-edge:#615547;--room-metal:#c8ba9f;
            --room-shade:#776249;--room-seat:#605d54;--room-seat-edge:#3a3d3d;
            --room-sky-top:#4e5368;--room-sky-bottom:#df9b74;--room-city:#4e5265;
            --room-window:#c9a58a;--room-window-light:.14;
            --room-lamp:#ffd498;--room-lamp-light:.46;--room-lamp-pool:.54;
            --room-screen:#a3c3c6;--room-screen-page:#d1d7cc;--room-screen-ink:#5c797d;
            --room-plant:#7a896e;--room-leaf-light:#b6b894;--room-rug:#615c55;
            --room-book:#d4c4a0;--room-pot:#ae8972;--room-desk-work:#b5ac90;
          }
          .assistant-room-svg[data-mood="bright"] {
            --room-wall-left:#84949e;--room-wall-right:#6c7f8e;
            --room-floor:#697983;--room-floor-edge:#3e525f;--room-grid:#97a4ab;
            --room-slat:#a5afa9;--room-timber:#b4ac94;--room-timber-edge:#807a70;
            --room-desk:#c1c6bc;--room-desk-edge:#828e90;--room-metal:#dbe5e4;
            --room-shade:#879795;--room-seat:#80938f;--room-seat-edge:#526b71;
            --room-sky-top:#8ab2ca;--room-sky-bottom:#d7d8c2;--room-city:#758fa5;
            --room-window:#d4e2dc;--room-window-light:.24;
            --room-lamp:#fff1ce;--room-lamp-light:.4;--room-lamp-pool:.43;
            --room-screen:#b4dfdf;--room-screen-page:#e4eee5;--room-screen-ink:#6b999f;
            --room-plant:#89a18a;--room-leaf-light:#c2d4ac;--room-rug:#87959a;
            --room-book:#e1dbc2;--room-pot:#b4a598;--room-desk-work:#d5dfcf;
          }
          .assistant-room-svg[data-focus="true"] {
            --room-focused:1;--room-focus-light:.25;
            --room-screen:#bfe5e8;--room-screen-page:#eff6e9;--room-screen-ink:#53858f;
          }
          .assistant-room-svg path,.assistant-room-svg polygon,.assistant-room-svg rect,
          .assistant-room-svg ellipse,.assistant-room-svg circle,.assistant-room-svg stop {
            transition:fill 850ms ease,stroke 850ms ease,opacity 850ms ease,stop-color 850ms ease;
          }
          .assistant-room-svg .room-work-page {opacity:var(--room-focused)}
          @media(prefers-reduced-motion:reduce) {
            .assistant-room-svg * {transition:none!important}
          }
        </style>
        <defs>
          <linearGradient id="${id}-sky" x1="0" x2="0" y1="0" y2="1">
            <stop stop-color="var(--room-sky-top)"/><stop offset="1" stop-color="var(--room-sky-bottom)"/>
          </linearGradient>
          <linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="1">
            <stop stop-color="#fff" stop-opacity=".15"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/>
            <stop offset=".75" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#fff" stop-opacity=".12"/>
          </linearGradient>
          <linearGradient id="${id}-lamp-beam" x1="0" y1="0" x2="0" y2="1">
            <stop stop-color="var(--room-lamp)" stop-opacity=".55"/><stop offset="1" stop-color="var(--room-lamp)" stop-opacity="0"/>
          </linearGradient>
          <radialGradient id="${id}-pool">
            <stop stop-color="var(--room-lamp)" stop-opacity=".75"/><stop offset=".5" stop-color="var(--room-lamp)" stop-opacity=".3"/>
            <stop offset="1" stop-color="var(--room-lamp)" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="${id}-contact"><stop stop-color="#030a14" stop-opacity=".65"/><stop offset="1" stop-color="#030a14" stop-opacity="0"/></radialGradient>
          <linearGradient id="${id}-shade" x1="0" x2="1"><stop stop-color="#fff" stop-opacity=".14"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>
          <filter id="${id}-shadow" x="-.4" y="-.8" width="1.8" height="2.6"><feGaussianBlur stdDeviation="14"/></filter>
          <clipPath id="${id}-window"><path d="M534 139 745 236 745 333 534 236Z"/></clipPath>
        </defs>

        <!-- A shallow architectural model: the thickness remains visible. -->
        <ellipse cx="460" cy="550" rx="354" ry="47" fill="#020914" opacity=".3" filter="${ref('shadow')}"/>
        <path d="M90 430 450 595 810 430V443L450 608 90 443Z" fill="var(--room-floor-edge)"/>
        <path d="M90 430 450 265 810 430 450 595Z" fill="var(--room-floor)"/>
        <path d="M90 220 450 55V265L90 430Z" fill="var(--room-wall-left)"/>
        <path d="M450 55 810 220V430L450 265Z" fill="var(--room-wall-right)"/>
        <path d="M90 220 450 55 810 220M450 55V265M90 430 450 265 810 430" fill="none" stroke="#e7f3f4" stroke-opacity=".12" stroke-width="1"/>
        <path d="M90 422 450 257 810 422" fill="none" stroke="#101e2c" stroke-opacity=".45" stroke-width="5"/>
        <path d="M162 463 522 298M234 496 594 331M306 529 666 364M378 562 738 397M162 397 522 562M234 364 594 529M306 331 666 496M378 298 738 463" fill="none" stroke="var(--room-grid)" stroke-opacity=".24" stroke-width=".7"/>
        <g>${slats}</g>

        <!-- Window glass, deep sill, and a quiet evening skyline. -->
        <path d="M521 120 757 228V350L521 242Z" fill="#122330"/>
        <path d="M527 127 750 230V341L527 239Z" fill="var(--room-window)" opacity=".3"/>
        <path d="M534 139 745 236V333L534 236Z" fill="${ref('sky')}"/>
        <g clip-path="${ref('window')}">
          <path d="M527 200V259L755 363V281L726 268V246L712 240V272L691 262V244L675 237V225L663 220V248L642 239V208L621 198V229L604 221V204L587 196V217L567 208V189L548 181V209Z" fill="var(--room-city)" opacity=".7"/>
          <path d="m549 201 12 5m44 7 12 5m53 20 12 5m37 14 12 5" stroke="#f5cb98" stroke-opacity=".3" stroke-width="2"/>
          <path d="M534 139 745 236V333L534 236Z" fill="${ref('glass')}"/>
          <path d="M581 159 648 303M609 172 676 316" stroke="#dce8e5" stroke-opacity=".09" stroke-width="17"/>
        </g>
        <path d="M639 187V284M534 211 745 308" stroke="#1d303e" stroke-width="5"/>
        <path d="M521 242 757 350 768 344 532 236Z" fill="var(--room-metal)"/>
        <path d="M521 242 757 350V356L521 248Z" fill="#233541"/>
        <path d="M534 242 730 332 579 473 379 382Z" fill="var(--room-window)" opacity="var(--room-window-light)"/>
        <path d="m593 270-153 140m202-118-151 140m201-117-149 139" stroke="var(--room-floor)" stroke-width="4" opacity="var(--room-window-light)"/>

        <!-- A framed line drawing, rather than an arbitrary decorative widget. -->
        <path d="M322 137 408 98V211L322 251Z" fill="#142330"/>
        <path d="M327 141 403 106V207L327 242Z" fill="#b1b3a7"/>
        <g fill="none" stroke="#59676d" stroke-width="1.2" opacity=".8">
          <path d="M340 223V167L389 145V201L340 223Zm0-32 49-22m-33 47v-56m17 49v-56M337 162l55-25m-48 9 40-18"/>
          <path d="M349 202v-14l15-7v14Zm19-8v-14l14-6v14Z"/>
        </g>

        <!-- Low timber cabinet, open books and a ceramic vessel. -->
        <ellipse cx="272" cy="391" rx="139" ry="33" fill="${ref('contact')}"/>
        <path d="M155 349 324 272 376 296 207 374Z" fill="var(--room-timber)"/>
        <path d="M207 374 376 296V353L207 431Z" fill="var(--room-timber-edge)"/>
        <path d="M155 349 207 374V431L155 407Z" fill="var(--room-timber)"/>
        <path d="M211 380 371 307V348L211 421Z" fill="var(--room-timber)" opacity=".65"/>
        <path d="M263 356V402m53-70v46" stroke="#15232d" stroke-opacity=".4"/>
        <path d="m254 383 7-3m46-22 7-3" stroke="var(--room-metal)" stroke-width="1.5"/>
        <path d="M164 404v13m197-58v13m-145 59v11" stroke="#1a2832" stroke-width="5"/>
        <path d="m174 344 37-17 25 11-37 17Z" fill="var(--room-book)"/>
        <path d="m174 344v7l25 11v-7m0 7 37-17v-7" fill="#c3c6ba" stroke="#87908e" stroke-width="1"/>
        <path d="m180 338 36-16 21 10-36 16Z" fill="#526d77"/>
        <path d="m180 338v5l21 10v-5m0 5 36-16v-5" fill="#9aa7a9"/>
        <ellipse cx="310" cy="308" rx="13" ry="7" fill="#14232e" opacity=".3"/>
        <path d="M302 285Q298 300 301 308Q310 314 319 308Q323 299 318 285Z" fill="var(--room-book)"/>
        <ellipse cx="310" cy="285" rx="8" ry="3" fill="#596767"/>
        <path d="M311 287q-8-28-19-39m18 30q9-28 18-34" fill="none" stroke="var(--room-plant)" stroke-width="2"/>
        <path d="M296 254q-19-1-15-16 15 0 15 16m26 1q0-16 16-20 3 14-16 20" fill="var(--room-leaf-light)"/>

        <!-- A woven rug with a restrained light edge. -->
        <path d="M287 435 477 348 688 445 498 533Z" fill="#0c1b28" opacity=".22"/>
        <path d="M284 429 474 342 685 439 495 527Z" fill="var(--room-rug)"/>
        <path d="M300 429 475 349 669 439 494 520Z" fill="none" stroke="#e1e5df" stroke-opacity=".13"/>
        <path d="m312 443 176 81m-150-94 177 81m-151-94 177 81m-151-94 177 81m-151-94 177 81m-151-94 177 81m-151-94 177 81" stroke="#d7e1dc" stroke-opacity=".045" stroke-width="8"/>

        <!-- Light is emitted by a physical lamp, then falls on real surfaces. -->
        <path d="M280 264 186 443 380 443Z" fill="${ref('lamp-beam')}" opacity="var(--room-lamp-light)"/>
        <ellipse cx="282" cy="431" rx="130" ry="51" fill="${ref('pool')}" opacity="var(--room-lamp-pool)"/>
        <path d="M199 379 367 302 374 337 214 411Z" fill="var(--room-lamp)" opacity="var(--room-lamp-light)"/>
        <ellipse cx="282" cy="423" rx="30" ry="14" fill="#142431"/>
        <ellipse cx="282" cy="418" rx="29" ry="13" fill="var(--room-metal)"/>
        <ellipse cx="282" cy="416" rx="23" ry="9" fill="var(--room-shade)"/>
        <path d="M282 415V247" stroke="#142432" stroke-width="7"/>
        <path d="M281 414V247" stroke="var(--room-metal)" stroke-width="3"/>
        <path d="M262 224Q282 214 302 224L318 261Q282 280 246 261Z" fill="var(--room-shade)"/>
        <path d="M262 224Q282 214 302 224L318 261Q282 280 246 261Z" fill="${ref('shade')}"/>
        <ellipse cx="282" cy="260" rx="36" ry="13" fill="#1b2c36"/>
        <ellipse cx="282" cy="259" rx="30" ry="9" fill="var(--room-lamp)"/>
        <path d="M249 261Q282 275 315 261" fill="none" stroke="var(--room-metal)" stroke-width="1"/>

        <!-- The desk is open underneath; its legs meet the floor plane. -->
        <ellipse cx="592" cy="439" rx="167" ry="45" fill="${ref('contact')}"/>
        <path d="M454 374v78l9 4v-78m263-46v82l9-4v-82m-169 91v83l9 4v-83m64-133v75l8 4v-75" fill="var(--room-desk-edge)"/>
        <path d="M440 365 628 279 748 334 560 420Z" fill="var(--room-desk)"/>
        <path d="M440 365 560 420V429L440 374Z" fill="var(--room-desk-edge)"/>
        <path d="M560 420 748 334V343L560 429Z" fill="var(--room-desk-edge)"/>
        <path d="M444 365 629 281 744 334 559 418Z" fill="none" stroke="#edf3e8" stroke-opacity=".18"/>
        <path d="M470 368 590 314 698 364 578 419Z" fill="var(--room-desk-work)" opacity="var(--room-focus-light)"/>
        <path d="m650 345 32-15 30 14-32 15Z" fill="var(--room-book)"/>
        <path d="m650 345v6l30 14v-6m0 6 32-15v-6" fill="#bdc1b4"/>
        <path d="m654 339 31-14 27 12-31 14Z" fill="#607c83"/>
        <path d="m654 339v5l27 12v-5m0 5 31-14v-5" fill="#bac8c4"/>
        <path d="m663 337 21-9 17 8-21 10Z" fill="none" stroke="#b8cac7" stroke-width=".7"/>
        <ellipse cx="681" cy="319" rx="11" ry="5" fill="#152832" opacity=".3"/>
        <path d="M674 300v14q0 6 8 6t8-6v-14" fill="var(--room-book)"/>
        <ellipse cx="682" cy="300" rx="8" ry="4" fill="#354d58"/>
        <path d="M691 304q11 0 5 10l-6 1" fill="none" stroke="var(--room-book)" stroke-width="3"/>

        <!-- A recognisable laptop: keyboard, hinge, screen, and useful work. -->
        <path d="M525 361 551 349 622 382 596 394Z" fill="#233541"/>
        <path d="M525 358 551 346 622 379 596 391Z" fill="var(--room-metal)"/>
        <path d="M541 357 554 351 611 377 598 383Z" fill="#546f7d"/>
        <path d="m552 356 46 21m-38-24 46 21m-60-15 46 21m-31-23-8 4m17 0-8 4m17 0-8 4m17 0-8 4" stroke="#c5d5d5" stroke-width=".7" opacity=".6"/>
        <path d="M553 345 621 377V325L553 293Z" fill="#0e202d"/>
        <path d="M557 339 617 367V328L557 300Z" fill="var(--room-screen)"/>
        <path d="M562 309 612 332V357L562 334Z" fill="var(--room-screen-page)" opacity=".85"/>
        <path d="m567 317 22 10m-22-5 38 17m-38-12 33 15m-33-9 19 9" stroke="var(--room-screen-ink)" stroke-width="1.6"/>
        <path d="m607 347 5 2" stroke="var(--room-screen-ink)" stroke-width="2"/>
        <g class="room-work-page">
          <path d="M562 309 612 332V357L562 334Z" fill="var(--room-screen-page)"/>
          <path d="m567 317 34 16m-34-10 23 11m-23-5 37 17" stroke="var(--room-screen-ink)" stroke-width="1.5"/>
          <path d="m568 335 3 4 6-3m6 9 13 6" fill="none" stroke="#5b9a8e" stroke-width="1.7"/>
        </g>
        <path d="m554 346 66 31" stroke="#b4cbce" stroke-opacity=".45"/>

        <!-- Upholstered task chair with a continuous back and five-arm base. -->
        <ellipse cx="474" cy="487" rx="66" ry="18" fill="${ref('contact')}"/>
        <path d="m477 450-2 38m0-2-39-10m39 10 41-8m-41 8-9 19m9-19 24 16m-24-16-15-23" stroke="var(--room-metal)" stroke-width="4" fill="none" stroke-linecap="round"/>
        <g fill="#13232f"><ellipse cx="435" cy="477" rx="5" ry="3"/><ellipse cx="516" cy="479" rx="5" ry="3"/><ellipse cx="466" cy="505" rx="5" ry="3"/><ellipse cx="500" cy="503" rx="5" ry="3"/></g>
        <path d="M441 421Q450 411 465 405L509 425Q516 431 504 439L480 451Q472 455 461 450L441 440Z" fill="var(--room-seat-edge)"/>
        <path d="M440 417Q447 409 463 403L508 423Q520 430 504 437L480 448Q473 451 463 447L443 438Q437 434 440 417Z" fill="var(--room-seat)"/>
        <path d="M440 417 432 366Q429 356 439 351L462 340Q474 335 478 347L485 394Q487 403 478 408L453 420Q444 424 440 417Z" fill="var(--room-seat-edge)"/>
        <path d="M445 411 438 367Q436 359 444 355L462 347Q469 344 471 352L479 394Q481 401 473 404L453 414Q448 417 445 411Z" fill="var(--room-seat)"/>
        <path d="m445 359 20-9" stroke="#d5e0db" stroke-opacity=".15" stroke-width="1.5"/>
        <path d="M431 408v21m0-21 22 10m44 17 15-7v-18m-15 9 15-9" fill="none" stroke="var(--room-metal)" stroke-width="3" stroke-linecap="round"/>

        <!-- A living plant anchors the room's near edge. -->
        <ellipse cx="211" cy="475" rx="46" ry="16" fill="${ref('contact')}"/>
        <path d="M189 442 195 474Q212 486 229 474L235 442Z" fill="var(--room-pot)"/>
        <path d="M189 442 195 474Q205 482 213 481V445Z" fill="#000" opacity=".12"/>
        <ellipse cx="212" cy="442" rx="23" ry="10" fill="#263a41"/>
        <ellipse cx="212" cy="443" rx="19" ry="7" fill="#3a3c36"/>
        <path d="M212 446Q213 402 198 369m15 60q17-46 33-61m-33 68q-18-27-36-32m36 8q-2-38 5-62m-7 60q25-11 43-12" fill="none" stroke="var(--room-plant)" stroke-width="3"/>
        <path d="M199 376Q165 372 174 348Q196 350 199 376ZM215 380Q199 356 220 339Q235 362 215 380ZM232 389Q234 359 263 361Q260 384 232 389ZM195 422Q165 430 158 403Q183 394 195 422ZM224 418Q245 393 267 407Q255 429 224 418Z" fill="var(--room-plant)"/>
        <path d="M198 376Q179 362 174 348m41 32 5-41m12 50 31-28m-68 61-37-19m66 15 43-11" fill="none" stroke="var(--room-leaf-light)" stroke-width="1.2" opacity=".7"/>
        <path d="M198 376Q178 362 174 348Q197 352 198 376m34 13q10-23 31-28-6 23-31 28m-8 29q24-7 43-11-12 21-43 11" fill="var(--room-leaf-light)" opacity=".35"/>
        <path d="M90 430 450 595 810 430" fill="none" stroke="#d9e4df" stroke-opacity=".16" stroke-width="1"/>
      </svg>`;
    this.svg = template.content.firstElementChild;
    this.svg.dataset.focus = 'false';
    container.replaceChildren(this.svg);
  }

  setMood(mood = 'normal') {
    if (!(mood in MOOD_LABELS)) throw new TypeError(`Unknown room mood: ${mood}`);
    if (this.disposed) return this;
    this.mood = mood;
    this.svg.dataset.mood = mood;
    this.updateLabel();
    return this;
  }

  setFocus(focused) {
    if (this.disposed) return this;
    this.focused = Boolean(focused);
    this.svg.dataset.focus = String(this.focused);
    this.updateLabel();
    return this;
  }

  updateLabel() {
    this.svg.setAttribute('aria-label', `${MOOD_LABELS[this.mood]}${this.focused ? ' Focus mode is on: the laptop and work surface are highlighted.' : ''}`);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.svg.remove();
    this.svg = null;
    this.container = null;
  }
}
