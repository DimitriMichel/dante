import { prepareParagraph, wrapParagraph, textSlots, clearFlowCache } from '../src/flow';
import { InkRenderer, type Op } from '../src/render';
import { fontOptions } from '../src/fonts';
import { PrintEngine } from '../src/print-engine';
import { printDefaults } from '../src/print-settings';
import type { Graphic } from '../src/graphics';
const output = document.querySelector('#results')!;
const results: {name:string; detail?:unknown}[] = [];
function check(ok: unknown, message: string) { if (!ok) throw new Error(message); }
const segmenter = new Intl.Segmenter(undefined, { granularity:'grapheme' });
const settings = {baseline:72,lineHeight:42,size:28,left:72,right:648,graphics:[] as Graphic[]};
const graphic: Graphic = {id:'qa',kind:'orbit',x:250,y:150,size:220,lines:5,weight:1.2,gap:18};
function glyphs(text:string) { return Array.from(segmenter.segment(text), g=>({text:g.segment,start:g.index,end:g.index+g.segment.length,style:g.index%5===0?'italic':g.index%3===0?'bold':'normal',ink:g.index%7===0?'clean':'42,55'})); }
try {
  await Promise.all(Object.values(fontOptions).flatMap(f=>['normal 400','italic 400','normal 700','italic 700'].map(s=>document.fonts.load(`${s} 28px ${f.family}`))));
  clearFlowCache();
  for (const font of Object.values(fontOptions)) {
    const fontFor = (g:ReturnType<typeof glyphs>[number])=>`${g.style==='italic'?'italic':'normal'} ${g.style==='bold'?700:400} 28px ${font.family}`;
    for (const text of [
      '  A  little more human.   Keep all spaces.\tAnd tabs.  ',
      'Café e\u0301 👨‍👩‍👧‍👦 👋🏽 — Bold within astronomical words. '.repeat(8),
      'x'.repeat(160), '   ', '\t\t', '\u200b\u200b', 'A\u200b B\r\nC',
      'Non\u00a0breaking hyphen-words soft\u00adhyphens and https://example.com/a-long-link '.repeat(4),
    ]) {
      const items=glyphs(text), prepared=prepareParagraph(items,fontFor);
      for(const graphics of [[],[graphic],[{...graphic,x:72,size:320},{...graphic,id:'two',x:328,size:320}]]) {
        const r=wrapParagraph(items,prepared,{...settings,graphics});
        check(r.lines.flatMap(l=>l.items).every((g,i)=>g===items[i])&&r.lines.flatMap(l=>l.items).length===items.length,`Source/formatting lost: ${font.label} ${text}`);
        check(r.baseline<12000,'Layout failed to advance');
        for(const row of r.lines) {
          const slots=textSlots(row.baseline-31,row.baseline+11.4,72,648,graphics);
          check(slots.some(s=>row.left>=s.left&&row.right<=s.right),'Text collides with illustration');
          check(row.width<=row.right-row.left+1,'Line exceeds available width');
        }
      }
    }
    results.push({name:`${font.label}: spaces, tabs, graphemes, styles, long words, overlapping contours`});
  }
  const items=glyphs('There is a certain beauty in the things that refuse to be perfect. '.repeat(20));
  const fontFor = ()=>'normal 400 28px "EB Garamond"';
  const prepared=prepareParagraph(items,fontFor);
  check(prepareParagraph(items.map(g=>({...g,ink:'clean'})),fontFor)===prepared,'Ink changes invalidated font measurement');
  const originalMeasure=CanvasRenderingContext2D.prototype.measureText;
  let measures=0;
  CanvasRenderingContext2D.prototype.measureText=function(text){measures++;return originalMeasure.call(this,text);};
  const start=performance.now();
  for(let i=0;i<300;i++) wrapParagraph(items,prepareParagraph(items,fontFor),{...settings,graphics:[{...graphic,x:72+i%300,y:100+i%400}]});
  CanvasRenderingContext2D.prototype.measureText=originalMeasure;
  check(measures===0,'Dragging remeasured fonts');
  results.push({name:'300 cached reflows without Canvas measurement',detail:{milliseconds:performance.now()-start,measures}});
  clearFlowCache();check(prepareParagraph(items,fontFor)!==prepared,'Font load failed to invalidate prepared cache');
  const renderer=new InkRenderer(document.querySelector('#proof')!);
  const ops:Op[]=[{insert:'A little more human.'},{insert:'\n',attributes:{header:1}},{insert:'\nThere is a certain beauty in the things that refuse to be perfect. '.repeat(3)},{insert:'Let the ink wander.',attributes:{italic:true}},{insert:' Keep these clean.',attributes:{bold:true,ink:'clean'}},{insert:'\n'}];
  const options={family:fontOptions.garamond.family,size:28,leading:1.5,spread:43,variation:94,seed:55,paper:'none',original:false,graphics:[graphic]};
  renderer.render(ops,options);
  for (const node of renderer.root.querySelectorAll<SVGTextElement>('text')) {
    const baseline=Number(node.getAttribute('y')), size=Number(node.getAttribute('font-size')), x=Number(node.getAttribute('x'));
    const slots=textSlots(baseline-size-3,baseline+size*.3+3,72,648,[graphic]);
    check(slots.some(slot=>x>=slot.left-.5&&x+node.getComputedTextLength()<=slot.right+1), 'SVG text exceeds its Pretext slot');
  }
  check(renderer.cells.some(c=>c.attrs.ink==='clean')&&renderer.cells.some(c=>c.attrs.italic),'Ink and italic cells missing');
  check(renderer.cells.map(c=>c.text).join('')===ops.map(o=>o.insert).join('').replaceAll('\n',''),'Renderer lost source characters');
  const engine=new PrintEngine(message=>{output.textContent=JSON.stringify({results,status:message},null,2);});
  const makeJob=(preview:boolean)=>({...printDefaults,...options,preview,key:String(preview),font:'garamond',label:'EB Garamond',root:renderer.root,width:renderer.width,height:renderer.height,cells:renderer.cells,selection:{index:5,length:15},roughness:20,wear:40,wave:15,pageTurn:90 as const});
  const full=await engine.render(makeJob(false));
  const fast=await engine.render(makeJob(true));
  check(fast.width<full.width&&fast.graphics.length===1,'Interactive print resolution or geometry missing');
  check(fast.pixels.some((x,i)=>i%4===3&&x===0)&&fast.pixels.some((x,i)=>i%4===3&&x>0),'Transparent interactive ink missing');
  check(fast.selection.some(x=>x>0),'Interactive selection highlight missing');
  results.push({name:'Full and interactive ocrodeg print, transparent ink, page rotation, selection',detail:{fullMs:full.elapsed,interactiveMs:fast.elapsed,fullWidth:full.width,interactiveWidth:fast.width}});
  engine.stop();
  output.textContent=JSON.stringify({passed:true,results},null,2);
} catch(error) { output.textContent=JSON.stringify({passed:false,results,error:String(error),stack:(error as Error).stack},null,2); }
