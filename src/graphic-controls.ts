import { graphicKinds, graphicSvg, makeGraphic, moveGraphic, type Graphic, type GraphicKind, type GraphicPlacement } from './graphics';
export const graphicsMarkup = `
  <div class="graphics-intro"><h2>Graphics</h2><p>Add a little geometry to your impression.</p></div>
  <div class="graphic-gallery" aria-label="Add a graphic">${Object.entries(graphicKinds).map(([kind, name]) => `<button type="button" data-add-graphic="${kind}" aria-label="Add ${name.toLowerCase()}"><span class="graphic-sample"></span><span>${name}</span></button>`).join('')}</div>
  <div id="graphic-editor" hidden>
    <div class="graphic-field"><label for="graphic-choice">On this page</label><select id="graphic-choice" aria-label="Selected graphic"></select></div>
    <p class="graphic-help" id="graphic-help">Drag on the paper to place. Use arrow keys for small moves.</p>
    ${[['size', 'Size', 100, 320, 5], ['lines', 'Detail', 3, 12, 1], ['weight', 'Line weight', .6, 3, .1], ['gap', 'Text gap', 8, 40, 1]].map(([key, label, min, max, step]) => `<div class="slider-row"><label for="graphic-${key}">${label}</label><output id="graphic-${key}-value" for="graphic-${key}"></output><input id="graphic-${key}" type="range" min="${min}" max="${max}" step="${step}" aria-label="Graphic ${String(label).toLowerCase()}"></div>`).join('')}
    <div class="graphic-actions"><button id="duplicate-graphic" class="subtle" type="button">Duplicate</button><button id="remove-graphic" class="text-button" type="button">Remove graphic</button></div>
  </div>
  <p class="graphic-help">Text follows each shape. Your ink and print effects apply to the graphics too.</p>`;

type Geometry = { width: number; height: number; placements: GraphicPlacement[]; printedGraphics: Graphic[] };
export class GraphicControls {
  selectedId: string | null = null;
  private dragging = false;
  private readonly buttons = new Map<string, HTMLButtonElement>();
  constructor(private panel: HTMLElement, private overlay: HTMLElement, private graphics: () => Graphic[], private geometry: () => Geometry, private change: () => void, private open: () => void) {
    for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-add-graphic]')) {
      button.querySelector('.graphic-sample')!.append(graphicSvg({ kind: button.dataset.addGraphic as GraphicKind, lines: 5, weight: 1.1 }));
      button.addEventListener('click', () => {
        const items = this.graphics();
        if (items.length >= 8) return;
        const g = makeGraphic(button.dataset.addGraphic as GraphicKind, items.length);
        moveGraphic(g, g.x, g.y, this.geometry().height);
        items.push(g); this.selectedId = g.id; this.change(); this.sync();
        this.buttons.get(g.id)?.focus({ preventScroll: true });
      });
    }
    panel.querySelector('#graphic-choice')!.addEventListener('change', event => { this.selectedId = (event.target as HTMLSelectElement).value; this.sync(); });
    for (const key of ['size', 'lines', 'weight', 'gap'] as const) {
      panel.querySelector(`#graphic-${key}`)!.addEventListener('input', event => {
        const g = this.selected(); if (!g) return;
        g[key] = Number((event.target as HTMLInputElement).value);
        moveGraphic(g, g.x, g.y, this.geometry().height);
        this.change(); this.sync();
      });
    }
    panel.querySelector('#remove-graphic')!.addEventListener('click', () => this.remove());
    panel.querySelector('#duplicate-graphic')!.addEventListener('click', () => {
      const g = this.selected(); if (!g || this.graphics().length >= 8) return;
      const copy = { ...g, id: crypto.randomUUID() };
      moveGraphic(copy, g.x - 36, g.y + 48, this.geometry().height);
      this.graphics().push(copy); this.selectedId = copy.id; this.change(); this.sync();
    });
  }
  private selected() { return this.graphics().find(g => g.id === this.selectedId); }
  private remove() {
    const items = this.graphics(), index = items.findIndex(g => g.id === this.selectedId);
    if (index < 0) return;
    items.splice(index, 1); this.selectedId = items[Math.min(index, items.length - 1)]?.id || null;
    this.change(); this.sync();
    (this.buttons.get(this.selectedId || '') || this.panel.querySelector<HTMLButtonElement>('[data-add-graphic]'))?.focus({ preventScroll: true });
  }
  sync() {
    const items = this.graphics();
    if (!items.some(g => g.id === this.selectedId)) this.selectedId = items[0]?.id || null;
    this.panel.querySelector<HTMLElement>('#graphic-editor')!.hidden = !items.length;
    const choice = this.panel.querySelector<HTMLSelectElement>('#graphic-choice')!;
    choice.replaceChildren(...items.map((g, i) => new Option(`${graphicKinds[g.kind]} ${i + 1}`, g.id)));
    choice.value = this.selectedId || '';
    this.panel.querySelectorAll<HTMLButtonElement>('[data-add-graphic], #duplicate-graphic').forEach(button => button.disabled = items.length >= 8);
    const g = this.selected();
    if (g) for (const key of ['size', 'lines', 'weight', 'gap'] as const) {
      const input = this.panel.querySelector<HTMLInputElement>(`#graphic-${key}`)!;
      input.value = String(g[key]);
      input.style.setProperty('--range', `${100 * (g[key] - Number(input.min)) / (Number(input.max) - Number(input.min))}%`);
      this.panel.querySelector(`#graphic-${key}-value`)!.textContent = key === 'weight' ? g[key].toFixed(1) : String(Math.round(g[key]));
    }
    this.syncOverlay();
  }
  private placement(g: Graphic) {
    const geometry = this.geometry();
    const placement = geometry.placements.find(p => p.id === g.id);
    const printed = geometry.printedGraphics.find(p => p.id === g.id);
    if (!placement || !printed) return { id: g.id, x: g.x, y: g.y, width: g.size, height: g.size, inverse: [1, 0, 0, 1] };
    const [a, b, c, d] = placement.inverse;
    const det = a * d - b * c;
    const dx = g.x - printed.x, dy = g.y - printed.y;
    return { ...placement, x: placement.x + (d * dx - b * dy) / det, y: placement.y + (-c * dx + a * dy) / det, width: placement.width * g.size / printed.size, height: placement.height * g.size / printed.size };
  }
  syncOverlay() {
    const items = this.graphics(), geometry = this.geometry();
    for (const [id, button] of this.buttons) if (!items.some(g => g.id === id)) { button.remove(); this.buttons.delete(id); }
    for (const g of items) {
      let button = this.buttons.get(g.id);
      if (!button) {
        button = document.createElement('button'); button.type = 'button'; button.className = 'graphic-handle';
        button.dataset.graphicId = g.id;
        button.setAttribute('aria-describedby', 'graphic-help');
        button.addEventListener('click', () => { this.selectedId = g.id; this.open(); this.sync(); });
        button.addEventListener('pointerdown', event => this.startDrag(event, g, button!));
        button.addEventListener('keydown', event => {
          if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); event.stopPropagation(); this.selectedId = g.id; this.remove(); return; }
          const direction: Record<string, number[]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
          const delta = direction[event.key]; if (!delta) return;
          event.preventDefault(); this.selectedId = g.id;
          const step = event.shiftKey ? 10 : 2, [a, b, c, d] = this.placement(g).inverse;
          moveGraphic(g, g.x + step * (a * delta[0] + b * delta[1]), g.y + step * (c * delta[0] + d * delta[1]), this.geometry().height);
          this.change(); this.sync();
        });
        this.buttons.set(g.id, button); this.overlay.append(button);
      }
      const p = this.placement(g);
      button.setAttribute('aria-label', `Move ${graphicKinds[g.kind].toLowerCase()} graphic`);
      button.setAttribute('aria-pressed', String(this.selectedId === g.id));
      button.style.left = `${100 * p.x / geometry.width}%`; button.style.top = `${100 * p.y / geometry.height}%`;
      button.style.width = `${100 * p.width / geometry.width}%`; button.style.height = `${100 * p.height / geometry.height}%`;
    }
  }
  private startDrag(event: PointerEvent, g: Graphic, button: HTMLButtonElement) {
    if (event.button !== 0 || this.dragging) return;
    event.preventDefault(); this.selectedId = g.id; this.open(); this.sync(); button.focus({ preventScroll: true });
    this.dragging = true; button.classList.add('is-dragging'); button.setPointerCapture(event.pointerId);
    const startX = event.clientX, startY = event.clientY, origin = { x: g.x, y: g.y };
    const geometry = this.geometry(), rect = this.overlay.getBoundingClientRect();
    const inverse = this.placement(g).inverse;
    const move = (e: PointerEvent) => {
      const dx = (e.clientX - startX) * geometry.width / rect.width, dy = (e.clientY - startY) * geometry.height / rect.height;
      moveGraphic(g, origin.x + inverse[0] * dx + inverse[1] * dy, origin.y + inverse[2] * dx + inverse[3] * dy, geometry.height);
      this.syncOverlay();
    };
    const finish = (e: PointerEvent) => {
      if (e.type === 'pointercancel' || e.type === 'lostpointercapture') { g.x = origin.x; g.y = origin.y; }
      this.dragging = false; button.classList.remove('is-dragging');
      button.removeEventListener('pointermove', move); button.removeEventListener('pointerup', finish); button.removeEventListener('pointercancel', finish); button.removeEventListener('lostpointercapture', finish);
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      this.change(); this.sync();
    };
    button.addEventListener('pointermove', move); button.addEventListener('pointerup', finish); button.addEventListener('pointercancel', finish); button.addEventListener('lostpointercapture', finish);
  }
}
