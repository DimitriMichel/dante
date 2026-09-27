/** Parameterized diagrams. Coordinates stay inside the 100-unit wrap circle. */
export const diagramKinds = {
  orbit: 'Orbits', sphere: 'Celestial sphere', solar: 'Planetary orbits', lens: 'Lens rays', field: 'Magnetic field', pendulum: 'Pendulum',
  helix: 'Double helix', interference: 'Wave interference', prism: 'Prism rays', eclipse: 'Solar eclipse', diffraction: 'Diffraction', resonance: 'Resonance modes',
  waves: 'Waves', rosette: 'Rosette', lissajous: 'Lissajous', spiral: 'Logarithmic spiral', sine: 'Sine waves', gaussian: 'Bell curves',
  cardioid: 'Cardioid', lemniscate: 'Figure eight', spirograph: 'Spirograph', parabola: 'Parabolas', hyperbola: 'Hyperbolas', rose: 'Polar rose',
} as const;
export type DiagramKind = keyof typeof diagramKinds;
export const diagramCategories: Record<DiagramKind, 'science' | 'math'> = {
  orbit:'science', sphere:'science', solar:'science', lens:'science', field:'science', pendulum:'science',
  helix:'science', interference:'science', prism:'science', eclipse:'science', diffraction:'science', resonance:'science',
  waves:'math', rosette:'math', lissajous:'math', spiral:'math', sine:'math', gaussian:'math',
  cardioid:'math', lemniscate:'math', spirograph:'math', parabola:'math', hyperbola:'math', rose:'math',
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
const gcd = (a:number,b:number):number => b ? gcd(b,a%b) : a;
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
    case 'helix': {
      const turns = 1.5 + n / 6;
      return [
        ...[-1,1].map(side=>trace(t=>[50+side*16*Math.sin(t*tau*turns),12+76*t])),
        ...Array.from({length:n+6},(_,i)=>{const t=(i+.5)/(n+6),dx=16*Math.sin(t*tau*turns),y=12+76*t;return points([50-dx,y],[50+dx,y]);}),
      ];
    }
    case 'interference':return [
      ...[40,60].flatMap(x=>Array.from({length:n},(_,i)=>ellipse(6+i*26/(n-1),6+i*26/(n-1),0,x,50))),
      ellipse(1.6,1.6,0,40,50),ellipse(1.6,1.6,0,60,50),
    ];
    case 'prism': {
      const rays=Math.max(3,Math.round(n*.6));
      return [points([46,20],[28,72],[68,72],[46,20]),points([12,45],[37.3,45],[57.8,53]),
        ...Array.from({length:rays},(_,i)=>points([57.8,53],[86,39+28*i/(rays-1)]))];
    }
    case 'eclipse':return [
      ellipse(12,12,0,25,50),ellipse(4,4,0,49,50),ellipse(10,10,0,78,50),
      points([29,39],[49,46],[67,52]),points([29,61],[49,54],[67,48]),
      ...Array.from({length:n+3},(_,i)=>{const a=tau*i/(n+3);return points([25+14*Math.cos(a),50+14*Math.sin(a)],[25+18*Math.cos(a),50+18*Math.sin(a)]);}),
    ];
    case 'diffraction':return [
      points([34,20],[34,45]),points([34,55],[34,80]),
      ...[35,50,65].map(y=>points([13,y],[29,y])),
      ...Array.from({length:n},(_,i)=>trace(t=>{const a=-Math.PI/2+Math.PI*t,r=7+31*i/(n-1);return [35+r*Math.cos(a),50+r*Math.sin(a)];})),
    ];
    case 'resonance': {
      const rows=Math.min(5,Math.max(3,Math.round(n/2)));
      return Array.from({length:rows},(_,i)=>{
        const y=26+48*i/(rows-1),mode=i+1;
        return [points([20,y],[80,y]),...[-1,1].map(side=>trace(t=>[20+60*t,y+side*7*Math.sin(t*Math.PI*mode)])),
          ...Array.from({length:mode+1},(_,j)=>ellipse(1,1,0,20+60*j/mode,y))];
      }).flat();
    }
    case 'cardioid':return Array.from({length:Math.max(1,Math.round(n/3))},(_,i)=>polar(t=>{
      const r=(21-i*3)*(1-Math.cos(t));return [r*Math.cos(t),r*Math.sin(t)];
    }));
    case 'lemniscate':return Array.from({length:Math.max(1,Math.round(n/3))},(_,i)=>polar(t=>{
      const a=43-i*6,d=1+Math.sin(t)**2;return [a*Math.cos(t)/d,a*Math.sin(t)*Math.cos(t)/d];
    }));
    case 'spirograph': {
      const outer=30,inner=n+3,offset=10,turns=inner/gcd(outer,inner),scale=43/(outer-inner+offset);
      return [trace(t=>{const a=t*tau*turns,b=(outer-inner)/inner*a;return [50+scale*((outer-inner)*Math.cos(a)+offset*Math.cos(b)),50+scale*((outer-inner)*Math.sin(a)-offset*Math.sin(b))];},Math.max(480,turns*160))];
    }
    case 'parabola':return [
      points([12,74],[88,74]),points([50,13],[50,80]),
      ...Array.from({length:Math.max(2,Math.round(n/2))},(_,i)=>trace(t=>{const x=-34+68*t;return [50+x,73-(46-i*6)*(x/34)**2];})),
    ];
    case 'hyperbola':return [
      points([12,50],[88,50]),points([50,12],[50,88]),points([24,82],[76,18]),points([24,18],[76,82]),
      ...[-1,1].flatMap(side=>Array.from({length:Math.max(1,Math.round(n/3))},(_,i)=>trace(t=>{const y=-29+58*t,a=9+i*3;return [50+side*a*Math.sqrt(1+(y/22)**2),50+y];}))),
    ];
    case 'rose':return [polar(t=>{const r=43*Math.cos(n*t);return [r*Math.cos(t),r*Math.sin(t)];})];
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
