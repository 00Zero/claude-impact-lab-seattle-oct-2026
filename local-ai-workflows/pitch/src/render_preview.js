// Preview mirror generated from build_deck.js itself: a recording stand-in for
// pptxgenjs captures every addText/addShape call, then each slide is drawn as SVG.
// Text uses wrapping HTML boxes at the PPTX box width, so overflow and overlap show up.
// This is still an approximation of PowerPoint's renderer, not a PPTX render.
const fs=require('fs'), path=require('path'), Module=require('module');
const dir=path.join(__dirname,'..','output');
const PX=120, PT=PX/72; // 1600x900 for a 13.333x7.5 in slide

const masters={}, slides=[];
class FakePptx {
  constructor(){ this.ShapeType={rect:'rect',roundRect:'roundRect',line:'line',ellipse:'ellipse',arc:'arc'}; }
  defineSlideMaster(m){ masters[m.title]=m; }
  addSlide(master){
    const m=masters[master]||{}, items=[];
    (m.objects||[]).forEach(o=>o.text&&items.push({kind:'text',text:o.text.text,o:o.text.options}));
    const s={bg:(m.background||{}).color||'FFFFFF',items,
      addText(text,o){items.push({kind:'text',text,o})},
      addShape(type,o){items.push({kind:type,o})},
      addNotes(){}};
    slides.push(s); return s;
  }
  async writeFile(){}
}
const load=Module._load;
Module._load=function(req,...rest){ return req==='pptxgenjs'?FakePptx:load.call(this,req,...rest); };
require('./build_deck.js');
Module._load=load;

const esc=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const col=c=>'#'+c;
function stroke(line){ if(!line||line.transparency===100) return 'stroke="none"';
  const w=(line.width||1)*PT, dash=line.dashType==='dash'?` stroke-dasharray="${w*1.6} ${w*1.2}"`:'';
  return `stroke="${col(line.color)}" stroke-width="${w}"${dash}`; }
function fill(f){ return !f||f.transparency===100?'fill="none"':`fill="${col(f.color)}"`; }
function arcPath(x,y,w,h,[a0,a1]=[270,0]){
  const rx=w/2, ry=h/2, cx=x+rx, cy=y+ry, r=d=>d*Math.PI/180;
  const sweep=((a1-a0)%360+360)%360||360;
  const p=a=>[cx+rx*Math.cos(r(a)), cy+ry*Math.sin(r(a))];
  const [x0,y0]=p(a0), [x1,y1]=p(a0+sweep);
  return `M${x0} ${y0} A${rx} ${ry} 0 ${sweep>180?1:0} 1 ${x1} ${y1}`;
}
function draw(it){
  const o=it.o, x=o.x*PX, y=o.y*PX, w=o.w*PX, h=o.h*PX;
  const rot=o.rotate?` transform="rotate(${o.rotate} ${x+w/2} ${y+h/2})"`:'';
  if(it.kind==='text'){
    const fs=(o.fontSize||16)*PT, va={top:'flex-start',mid:'center',bottom:'flex-end'}[o.valign||'mid'];
    const st=`width:${w}px;height:${h}px;display:flex;flex-direction:column;justify-content:${va};`+
      `font-family:${o.fontFace||'Arial'};font-size:${fs}px;line-height:1.2;color:${col(o.color||'000000')};`+
      `font-weight:${o.bold?700:400};font-style:${o.italic?'italic':'normal'};text-align:${o.align||'left'};`+
      `letter-spacing:${(o.charSpacing||0)*PT}px;white-space:pre-wrap;overflow:visible;`;
    return `<foreignObject x="${x}" y="${y}" width="${w}" height="${h}" overflow="visible"><div xmlns="http://www.w3.org/1999/xhtml" style="${st}"><div>${esc(it.text)}</div></div></foreignObject>`;
  }
  if(it.kind==='line') return `<path d="M${x} ${y} L${x+w} ${y+h}" ${stroke(o.line)} fill="none"/>`;
  if(it.kind==='ellipse') return `<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" ${fill(o.fill)} ${stroke(o.line)}/>`;
  if(it.kind==='arc') return `<path d="${arcPath(x,y,w,h,o.angleRange)}" fill="none" ${stroke(o.line)}${rot}/>`;
  const rx=it.kind==='roundRect'?Math.min((o.rectRadius||0)*PX,w/2,h/2):0;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ${fill(o.fill)} ${stroke(o.line)}${rot}/>`;
}
const pages=slides.map(s=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900"><rect width="1600" height="900" fill="${col(s.bg)}"/>${s.items.map(draw).join('')}</svg>`);
const html=`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:13.333in 7.5in;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0}.slide{width:13.333in;height:7.5in;page-break-after:always;break-after:page}.slide:last-child{page-break-after:auto;break-after:auto}.slide svg{width:100%;height:100%;display:block}</style></head><body>${pages.map(s=>`<section class="slide">${s}</section>`).join('')}</body></html>`;
fs.writeFileSync(path.join(dir,'preview.html'),html);
pages.forEach((p,i)=>{fs.writeFileSync(path.join(dir,`slide-${i+1}.svg`),p);fs.writeFileSync(path.join(dir,`slide-${i+1}.html`),`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:1600px;height:900px;overflow:hidden}svg{width:1600px;height:900px;display:block}</style>${p}`)});
console.log(`rendered ${pages.length} slides`);
