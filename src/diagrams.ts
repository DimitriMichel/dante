/** Parameterized diagrams. Coordinates stay inside the 100-unit wrap circle. */
export const diagramKinds = {
  orbit: 'Orbits', sphere: 'Celestial sphere', solar: 'Planetary orbits', lens: 'Lens rays', field: 'Magnetic field', pendulum: 'Pendulum',
  waves: 'Waves', rosette: 'Rosette', lissajous: 'Lissajous', spiral: 'Logarithmic spiral', sine: 'Sine waves', gaussian: 'Bell curves',
} as const;
export type DiagramKind = keyof typeof diagramKinds;
export const diagramCategories: Record<DiagramKind, 'science' | 'math'> = {
  orbit:'science', sphere:'science', solar:'science', lens:'science', field:'science', pendulum:'science',
  waves:'math', rosette:'math', lissajous:'math', spiral:'math', sine:'math', gaussian:'math',
};
const tau = Math.PI * 2;
const trace = (sample: (t:number)=>[number,number], steps=240) => Array.from({length:steps+1},(_,i)=>{
  const [x,y]=sample(i/steps);return `${i?'L':'M'}${x.toFixed(3)},${y.toFixed(3)}`;
}).join(' ');
const polar = (sample:(t:number)=>[number,number],turns=1) => trace(t=>{const [x,y]=sample(t*tau*turns);return [50+x,50+y];});
const ellipse = (rx:number,ry:number,angle=0,cx=50,cy=50) => trace(t=>{
  const x=rx*Math.cos(t*tau),y=ry*Math.sin(t*tau);return [cx+x*Math.cos(angle)-y*Math.sin(angle),cy+x*Math.sin(angle)+y*Math.cos(angle)];
});
const points = (...p:[number,number][]) => p.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(3)},${y.toFixed(3)}`).join(' ');
export function diagramPaths(g: {kind:DiagramKind;lines:number}):string[] {
  const n=g.lines;
  switch(g.kind) {
    case 'orbit':return [...Array.from({length:n},(_,i)=>ellipse(44,15+i*1.3,i*Math.PI/n-.3)),ellipse(8,8),'M47 50 L53 50 M50 47 L50 53'];
    case 'waves':return Array.from({length:n},(_,i)=>polar(t=>{const r=13+i*(29/Math.max(1,n-1))+2.4*Math.sin(5*t+i*.75);return [r*Math.cos(t),r*Math.sin(t)];}));
    case 'rosette':return [polar(t=>{const r=30+13*Math.cos(n*t);return [r*Math.cos(t),r*Math.sin(t)];}),ellipse(10,10),ellipse(45,45)];
    case 'sphere': {
      const project=(x:number,y:number,z:number):[number,number]=>[50+43*x,50+43*(y*Math.cos(.38)-z*Math.sin(.38))];
      return [ellipse(43,43),...Array.from({length:n},(_,i)=>trace(t=>{const a=i*Math.PI/n;return project(Math.sin(a)*Math.cos(t*tau),Math.sin(t*tau),Math.cos(a)*Math.cos(t*tau));})),...Array.from({length:n},(_,i)=>trace(t=>{const a=(i+1)*Math.PI/(n+1)-Math.PI/2;return project(Math.cos(a)*Math.cos(t*tau),Math.sin(a),Math.cos(a)*Math.sin(t*tau));}))];
    }
    case 'solar':return [ellipse(3.5,3.5),...Array.from({length:n},(_,i)=>{
      const r=12+31*i/(n-1);return ellipse(r,r*.58,-.28);
    }),...Array.from({length:n},(_,i)=>{
      const r=12+31*i/(n-1),a=i*2.399+.3,x=r*Math.cos(a),y=r*.58*Math.sin(a);return ellipse(1.5,1.5,0,50+x*Math.cos(-.28)-y*Math.sin(-.28),50+x*Math.sin(-.28)+y*Math.cos(-.28));
    })];
    case 'lens':return ['M50 19 Q35 50 50 81 Q65 50 50 19','M9 50 L91 50',...Array.from({length:n},(_,i)=>{
      const y=30+40*i/(n-1);return points([14,y],[50,y],[85,50+(50-y)*11/24]);
    }),'M26 47 L26 53 M74 47 L74 53'];
    case 'field':return [...Array.from({length:n},(_,i)=>polar(t=>{const r=(12+31*i/(n-1))*Math.sin(t)**2;return [r*Math.sin(t),r*Math.cos(t)];})), 'M47 42 L53 42 M50 39 L50 45 M47 58 L53 58'];
    case 'pendulum':return ['M35 15 L65 15',...Array.from({length:n},(_,i)=>{
      const a=-.7+1.4*i/(n-1),x=50+62*Math.sin(a),y=16+62*Math.cos(a);return points([50,16],[x,y]);
    }),...Array.from({length:n},(_,i)=>{const a=-.7+1.4*i/(n-1);return ellipse(2.4,2.4,0,50+62*Math.sin(a),16+62*Math.cos(a));}),trace(t=>{const a=-.7+1.4*t;return [50+54*Math.sin(a),16+54*Math.cos(a)];})];
    case 'lissajous':return [polar(t=>[38*Math.sin(Math.max(2,n-2)*t+.4),27*Math.sin((Math.max(2,n-2)+1)*t)])];
    case 'spiral':return [trace(t=>{const a=t*tau*(1+n/5),r=2*Math.exp(Math.log(43/2)*t);return [50+r*Math.cos(a),50+r*Math.sin(a)];}), 'M47 50 L53 50 M50 47 L50 53'];
    case 'sine':return ['M9 50 L91 50 M50 16 L50 84 M88 47 L91 50 L88 53 M47 19 L50 16 L53 19',...Array.from({length:Math.max(1,Math.round(n/3))},(_,i)=>trace(t=>[12+76*t,50-(23-i*3)*Math.sin(t*tau*(i+1))]))];
    case 'gaussian':return ['M11 74 L89 74 M50 13 L50 80 M86 71 L89 74 L86 77',...Array.from({length:Math.max(2,Math.round(n/2))},(_,i)=>trace(t=>{const x=-36+72*t,sigma=8+i*4;return [50+x,73-53*Math.exp(-x*x/(2*sigma*sigma))];}))];
  }
}
export function diagramLabels(kind:DiagramKind): {text:string;x:number;y:number}[] {
  if(kind==='lens')return [{text:'F₁',x:26,y:61},{text:'F₂',x:74,y:61}];
  if(kind==='field')return [{text:'N',x:50,y:34},{text:'S',x:50,y:72}];
  if(kind==='sine')return [{text:'x',x:87,y:60},{text:'y',x:60,y:23}];
  if(kind==='gaussian')return [{text:'μ',x:50,y:89},{text:'σ',x:70,y:86}];
  if(kind==='pendulum')return [{text:'θ',x:50,y:39}];
  return [];
}
