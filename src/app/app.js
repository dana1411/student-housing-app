import qrcode from 'qrcode-generator';
import { saveFile, openExternal, closeExternal, initNative, setStatusBar } from '../native.js';

export async function start(B){
'use strict';
const STORE='lodgely-ui-v1', DAY=864e5;
let FEE=3000, COMM=0.10, TERM=360, SHIFT=0, HOLD_MIN=15, OFFER_H=48;
const DEMO=B.mode==='demo';
let ME=null, READY=false, clockOffset=0;
const MYID=()=>ME?ME.id:null;
const LOGGED=()=>!!ME&&ME.role==='student';
const $=s=>document.querySelector(s);
const app=$('#app'), mroot=$('#modal'), troot=$('#toast'), tourRoot=$('#tour');
let S;
const loadedViews=new Set(), pendingViews=new Map();
let themeOpen=false, tourState=null;

/* ---------- icons ---------- */
const ICONS={
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
 heart:'<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
 home:'<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>',
 key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9m-3 3 2.5 2.5M14 9l2 2"/>',
 chat:'<path d="M4 5h16v11H9.5L5 20z"/>',
 wallet:'<path d="M4 7.5V18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5.5A1.5 1.5 0 0 1 4 6.5 1.5 1.5 0 0 1 5.5 5H17"/><circle cx="16" cy="13.5" r="1.2"/>',
 bell:'<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
 back:'<path d="M15 5l-7 7 7 7"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
 lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
 shield:'<path d="M12 3 5 6v5.2c0 4.3 3 7.9 7 9.8 4-1.9 7-5.5 7-9.8V6z"/><path d="m9.2 12 2 2 3.8-3.8"/>',
 clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
 flag:'<path d="M5 21V4h11l-2 4 2 4H5"/>',
 list:'<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
 map:'<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>',
 more:'<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
 chart:'<path d="M4 20h16M7 16v-5M12 16V7M17 16v-8"/>',
 users:'<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2c1.9.8 3 2.7 3 5.8"/>',
 card:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10.5h18M7 15h3"/>',
 alert:'<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.2M12 17v.2"/>',
 calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
 x:'<path d="M6 6l12 12M18 6 6 18"/>',
 pin:'<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.2"/>',
 send:'<path d="M4.5 12 20 4.5 15.5 20l-3.2-6.3z"/>',
 door:'<path d="M6 20V4h12v16M4 20h16M14.5 12h.01"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
 moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
 monitor:'<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20h7M12 16.5V20"/>',
 walk:'<circle cx="13" cy="4.5" r="1.8"/><path d="m9.5 21 2.2-6.2L14 17v4M8 12.5l1.6-4.3 3.6-.7 2.3 3.5 2.5 1M11.7 14.8l1.1-4.6"/>',
 keke:'<path d="M3 16.5V10a3 3 0 0 1 3-3h8.5l4 5H20a1 1 0 0 1 1 1v3.5"/><path d="M11 7v5h7.5"/><circle cx="7" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/><path d="M9 17.5h6"/>',
 down:'<path d="m6 9 6 6 6-6"/>',
 qr:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/>',
 right:'<path d="m9 5 7 7-7 7"/>'
};
const ic=(n,s=20)=>`<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]||''}</svg>`;
const KEYMARK=`<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><circle cx="8.5" cy="13" r="6.5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M15 13h10M20 13v4.5M23.5 13v3" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;

/* ---------- utils ---------- */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>'₦'+Math.round(n).toLocaleString('en-NG');
const fmtK=n=>n>=1e6?'₦'+(+(n/1e6).toFixed(2))+'m':'₦'+Math.round(n/1000)+'k';
const p2=n=>String(n).padStart(2,'0');
const now=()=>Date.now()+clockOffset;
const uid=p=>p+Math.random().toString(36).slice(2,9);
const payRef=()=>'PAY-'+Math.random().toString(36).slice(2,8).toUpperCase()+Math.floor(10+Math.random()*90);
// All dates and times are shown and computed in Nigeria time (WAT, UTC+1), whatever the phone is set to.
const TZ='Africa/Lagos',WAT=36e5;
const fmtDate=t=>new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:TZ});
const fmtSlot=t=>new Date(t).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:TZ})+' · '+new Date(t).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:TZ});
const t12=s=>{const [h,m]=s.split(':').map(Number);return ((h%12)||12)+':'+p2(m)+(h<12?' AM':' PM');};
const rel=t=>{const s=(now()-t)/1000; if(s<60)return 'just now'; if(s<3600)return Math.floor(s/60)+' min ago'; if(s<86400)return Math.floor(s/3600)+' h ago'; const d=Math.floor(s/86400); return d<30?d+' d ago':fmtDate(t);};
const isoDate=t=>{const d=new Date(t+WAT);return d.getUTCFullYear()+'-'+p2(d.getUTCMonth()+1)+'-'+p2(d.getUTCDate());};
const initials=n=>n.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
const sum=(L,f)=>L.reduce((a,x)=>a+f(x),0);
function genKey(){const A='ABCDEFGHJKMNPQRSTUVWXYZ23456789';const b=new Uint8Array(12);crypto.getRandomValues(b);let s='';for(let i=0;i<12;i++){s+=A[b[i]%A.length];if(i%4===3&&i<11)s+='-';}return 'LDG-'+s;}
function slotAt(base,dayOff,hour,min=0){const d=new Date(base+dayOff*DAY+WAT);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),hour,min)-WAT;}
function getPath(p){return p.split('.').reduce((o,k)=>o==null?o:o[k],S);}
function setPath(p,v){const ks=p.split('.');let o=S;for(let i=0;i<ks.length-1;i++){if(o[ks[i]]==null)o[ks[i]]={};o=o[ks[i]];}o[ks[ks.length-1]]=v;}

/* ---------- data: server state + local UI state ---------- */
const DATA_KEYS=['houses','keys','payments','inspections','ballots','threads','complaints','notes','students','agents','favs','savings','support'];
const UI_KEYS=['v','role','nav','f','payFilter','compFilter','boardFilter','screen','page','pageFrom','ld','myWait','slow','lstF','usrF','payF2','seen','ct'];
let PAYMODE='simulated';
function uiDefaults(){
 return {v:1,role:'student',nav:{student:{tab:'explore',stack:[]},agent:{tab:'home',stack:[]},admin:{tab:'overview',stack:[]}},
  f:{q:'',area:'All',max:'Any',type:'Any',am:[],sort:'rec',view:'list'},payFilter:'all',compFilter:'public',boardFilter:'all',
  vk:null,draft:null,modal:null,screen:'landing',ld:{school:'oau',type:'Any',max:'Any'},myWait:[],seen:{},slow:false,
  waitSeed:DEMO?{ui:38,unilorin:26,uniosun:21,futa:17,fuoye:12,lautech:9,eksu:7}:{},
  houses:[],keys:[],payments:[],inspections:[],ballots:[],threads:[],complaints:[],notes:[],students:{},agents:{},favs:[],
  savings:{goal:{name:'Next session rent',target:300000,due:'2027-01-01',mode:'flexible',sched:'none',schedAmt:0},txns:[]},support:[],waitlist:[]};
}
function loadUI(){try{const o=JSON.parse(localStorage.getItem(STORE)||'null');if(o&&o.v===1){const u={};UI_KEYS.forEach(k=>{if(o[k]!==undefined)u[k]=o[k];});return u;}}catch(e){}return {};}
function applyState(st){
 ME=st.me||null;
 const c=st.cfg||{};FEE=c.fee;COMM=+c.comm;TERM=c.term;SHIFT=+c.shift||0;HOLD_MIN=c.holdMin||15;OFFER_H=c.offerHours||48;PAYMODE=c.paymentMode||'simulated';
 clockOffset=(+st.now)-Date.now();
 DATA_KEYS.forEach(k=>{S[k]=st[k];});
 S.waitlist=ME&&ME.role==='admin'?st.waitlist:(S.myWait||[]);
 if(ME&&ME.role!==S.role)S.role=ME.role;
 if(!DEMO&&!ME&&S.role!=='student')S.role='student';
 READY=true;
 if(S.screen==='app'&&!S.modal)renewPrompt();
}
let refreshing=null,refreshAgain=false;
function refresh(){
 if(refreshing){refreshAgain=true;return refreshing;}
 refreshing=(async()=>{do{refreshAgain=false;applyState(await B.state());}while(refreshAgain);})().finally(()=>{refreshing=null;});
 return refreshing;
}
// Re-render after a background update without wiping what the person is typing.
let staleView=false;
function bgRender(){
 const a=document.activeElement,typing=a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName);
 if(typing){staleView=true;return;}
 render();if(S.modal&&!S.modal.stage)renderModal();else if(!S.modal)renderModal();
}
document.addEventListener('focusout',()=>{if(staleView)setTimeout(()=>{const a=document.activeElement;if(staleView&&!(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName))){staleView=false;render();}},50);});
// Run a server action, refresh, re-render. Errors show in the open form (errTo) or as a toast.
let busy=false;
async function run(fn,args,o={}){
 if(busy)return null;busy=true;document.body.classList.add('busy');
 const m=S.modal;
 try{
  const r=await B.call(fn,args||{});
  if(o.close!==false&&S.modal===m&&m)S.modal=null;
  await refresh();save();render();renderModal();
  if(o.ok)toast(typeof o.ok==='function'?o.ok(r||{}):o.ok);
  return r||{};
 }catch(e){
  if(o.errTo&&S.modal===m&&m){m.err=e.message;renderModal();}else toast(e.message);
  return null;
 }finally{busy=false;document.body.classList.remove('busy');}
}
// Time-based renewal prompt: show once for each new 60/30/7/1-day mark on my key.
function renewPrompt(){
 if(!LOGGED())return;
 for(const k of S.keys){
  if(k.studentId!==MYID()||k.status!=='active'||!(k.shown&&k.shown.length))continue;
  const seen=S.seen[k.code]||[],fresh=k.shown.filter(x=>!seen.includes(x));
  if(!fresh.length)continue;
  S.seen[k.code]=k.shown.slice();save();
  if(!S.ballots.some(x=>x.keyCode===k.code&&(x.status==='drawn'||x.status==='filled')))S.modal={type:'renew',code:k.code,t:Math.min(...fresh)};
  return;
 }
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ---------- model helpers ---------- */
const house=id=>S.houses.find(h=>h.id===id);
const room=(h,rid)=>h&&h.rooms.find(r=>r.id===rid);
const agent=id=>S.agents[id]||{id,name:'Agent',biz:'',status:'unknown',rating:0,ratings:0,trust:0,inspDone:0,phone:'',docs:[]};
const stu=id=>S.students[id]||{name:'Student',dept:''};
const holdActive=r=>!!(r.payHold&&r.payHold.until>now());
const roomState=r=>r.paused?'paused':r.occ.length>=r.cap?'taken':r.hold?'reserved':holdActive(r)?'pending':'open';
const openRooms=h=>h.rooms.filter(r=>roomState(r)==='open');
const isLive=h=>h.mod==='live'&&!h.deleted&&agent(h.agentId).status==='verified'&&!h.paused;
const visible=h=>isLive(h)&&openRooms(h).length>0;
const minPrice=h=>Math.min(...(openRooms(h).length?openRooms(h):h.rooms).map(r=>r.price));
const savBal=()=>sum(S.savings.txns,t=>t.type==='deposit'?t.amt:-t.amt);
const myKeys=()=>S.keys.filter(k=>k.studentId===MYID());
const activeKeys=()=>myKeys().filter(k=>k.status==='active');
const inspDone=hid=>S.inspections.some(i=>i.houseId===hid&&i.studentId===MYID()&&i.status==='completed');
const inspOpen=hid=>S.inspections.find(i=>i.houseId===hid&&i.studentId===MYID()&&i.status==='booked');
const myH=()=>S.houses.filter(h=>h.agentId===MYID()&&!h.deleted);
const myHAll=()=>S.houses.filter(h=>h.agentId===MYID());
const WEEKDAYS=[[1,'Mon'],[2,'Tue'],[3,'Wed'],[4,'Thu'],[5,'Fri'],[6,'Sat'],[0,'Sun']];
const daysLabel=ds=>{const s=WEEKDAYS.filter(([n])=>ds.includes(n)).map(([,l])=>l);return s.length===7?'Every day':s.length===6&&!ds.includes(0)?'Monday to Saturday':s.join(', ');};
const keyOf=c=>S.keys.find(k=>k.code===c);
const curKeys=r=>r.occ.map(keyOf).filter(k=>k&&k.status==='active'&&k.start<=now());
const roomEnd=r=>{const ks=curKeys(r);return ks.length?Math.min(...ks.map(k=>k.end)):0;};
const houseEnd=h=>{const e=h.rooms.map(roomEnd).filter(Boolean);return e.length?Math.min(...e):0;};
const ballotsOf=r=>S.ballots.filter(b=>b.roomId===r.id&&(b.status==='open'||b.status==='drawn'));
const ballotForKey=c=>S.ballots.find(b=>b.keyCode===c&&b.status!=='cancelled');
const openBallotsH=h=>S.ballots.filter(b=>b.houseId===h.id&&b.status==='open');
const isTakenListing=h=>isLive(h)&&openRooms(h).length===0;
const startForBallot=b=>{const k=keyOf(b.keyCode);return Math.max(now(),k&&k.status==='active'?k.end:0);};
const meId=()=>S.role==='student'?MYID():S.role==='agent'?MYID():'admin';
const nav=()=>S.nav[S.role];
const PHONE_RE=/^\+?\d[\d\s]{9,16}$/,EMAIL_RE=/^\S+@\S+\.\S+$/;
const genCode=()=>String(Math.floor(100000+Math.random()*900000));
const cur=()=>{const s=nav().stack;return s[s.length-1];};
function save(){try{const o={};UI_KEYS.forEach(k=>{o[k]=S[k];});localStorage.setItem(STORE,JSON.stringify(o));}catch(e){}}
function slotsFor(h){const out=[],base=now(),days=h.days&&h.days.length?h.days:[1,2,3,4,5,6],times=h.times&&h.times.length?h.times:['10:00'];for(let d=1;d<=14&&out.length<6;d++){const day=new Date(base+d*DAY+WAT);if(!days.includes(day.getUTCDay()))continue;times.forEach(t=>{const [hh,mm]=t.split(':').map(Number);out.push(slotAt(base,d,hh,mm));});}return out.slice(0,6);}
function cdText(end){let ms=Math.max(0,end-now());const d=Math.floor(ms/DAY);ms-=d*DAY;const h=Math.floor(ms/36e5);ms-=h*36e5;const m=Math.floor(ms/6e4);const s=Math.floor((ms-m*6e4)/1000);return {d,h:p2(h),m:p2(m),s:p2(s),str:`${d}d ${p2(h)}:${p2(m)}:${p2(s)}`};}

/* ---------- illustrations ---------- */
const WALLS=['#E9CFA8','#D8B48C','#C8D2BE','#E6D8C3','#BCC7DB','#E7C2B3','#D6C9E0'];
const ROOFS=['#8A3A28','#5B4636','#34446A','#7A5230','#4E5B3A'];
function art(h,cls='art'){
 if(h.photos&&h.photos.length)return `<div class="${cls}"><img src="${h.photos[0]}" alt="Photo of ${esc(h.title)}"></div>`;
 return `<div class="${cls}">${frontSvg(h)}</div>`;
}
function frontSvg(h){
 const a=h.art, w=WALLS[a.wall%WALLS.length], r=ROOFS[a.roof%ROOFS.length];
 const floors=a.kind==='bungalow'?1:a.kind==='storey'?2:3, bw=floors===1?200:150, fh=34, bx=(320-bw)/2-10, by=150-floors*fh;
 let s=`<rect width="320" height="180" style="fill:var(--sky)"/><circle cx="272" cy="36" r="15" style="fill:var(--sun)"/><rect y="150" width="320" height="30" style="fill:var(--ground)"/>`;
 s+=`<rect x="${bx}" y="${by}" width="${bw}" height="${floors*fh}" fill="${w}"/>`;
 let ty;
 if(floors<3){s+=`<path d="M${bx-10} ${by}L${bx+26} ${by-26}H${bx+bw-26}L${bx+bw+10} ${by}Z" fill="${r}"/>`;ty=by-26-22;}
 else{s+=`<rect x="${bx-4}" y="${by-8}" width="${bw+8}" height="8" fill="${r}"/>`;ty=by-8-22;}
 const tx=bx+bw-44;
 s+=`<rect x="${tx-3}" y="${ty+20}" width="24" height="3" fill="#5D6270"/><rect x="${tx}" y="${ty}" width="18" height="20" rx="4" fill="#2A2F3B"/><rect x="${tx}" y="${ty+6}" width="18" height="1.5" fill="#444B5C"/>`;
 const n=Math.floor((bw-16)/34), door=Math.floor(n/2);
 for(let f=0;f<floors;f++){const y=by+f*fh+9;for(let i=0;i<n;i++){const x=bx+12+i*34;
  if(f===floors-1&&i===door){s+=`<rect x="${x+2}" y="${y-2}" width="16" height="27" fill="#5B3A22"/><circle cx="${x+15}" cy="${y+12}" r="1.2" fill="#E7B451"/>`;continue;}
  s+=`<rect x="${x}" y="${y}" width="20" height="16" fill="#38445E"/>`;for(let l=0;l<4;l++)s+=`<rect x="${x+1}" y="${y+2+l*3.6}" width="18" height="1.2" fill="#8FA0C2" opacity=".55"/>`;}}
 const tr=bx+bw+28;
 s+=`<rect x="${tr-2}" y="118" width="4" height="33" fill="#6B4B2E"/><circle cx="${tr}" cy="110" r="16" fill="#4F7A45"/><circle cx="${tr-9}" cy="118" r="9" fill="#5E8A50"/>`;
 return `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Front of ${esc(h.title)}">${s}</svg>`;
}
const RWALL=['#F1E3CC','#EAD9C2','#E1E8DA','#EFE6D8','#DCE3EF','#F0DCD3','#E6DEEC'],RFLOOR=['#C9B79F','#B9A68C','#CFC6B8','#BDB3A6','#D4C2A8'],SHEETS=['#3E6FB0','#B5462E','#4F7A45','#7A4E9C','#C58A2B'];
const svgWrap=(s,label)=>`<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${label}">${s}</svg>`;
function roomSvg(h){
 const a=h.art,wall=RWALL[a.wall%7],floor=RFLOOR[a.roof%5],sheet=SHEETS[(a.wall+a.roof)%5],curtain=SHEETS[(a.wall+2)%5];
 const furn=h.rooms.some(r=>r.furnished)||h.amenities.includes('Furnished');
 let s=`<rect width="320" height="180" fill="${wall}"/><rect y="132" width="320" height="48" fill="${floor}"/><rect y="128" width="320" height="5" fill="#000" opacity=".08"/>`;
 for(let x=40;x<320;x+=40)s+=`<rect x="${x}" y="132" width="1.5" height="48" fill="#000" opacity=".08"/>`;
 s+=`<rect y="155" width="320" height="1.5" fill="#000" opacity=".08"/>`;
 s+=`<rect x="34" y="30" width="78" height="60" fill="#F7F7F4"/><rect x="39" y="35" width="68" height="50" fill="#BFD9EE"/>`;
 for(let x=45;x<107;x+=9)s+=`<rect x="${x}" y="35" width="2" height="50" fill="#555B69"/>`;
 s+=`<rect x="39" y="58" width="68" height="2" fill="#555B69"/><rect x="24" y="24" width="98" height="4" rx="2" fill="#6B5A48"/><rect x="26" y="27" width="12" height="68" rx="3" fill="${curtain}"/><rect x="108" y="27" width="12" height="68" rx="3" fill="${curtain}"/>`;
 s+=`<rect x="199" y="0" width="2" height="14" fill="#4A4F5C"/><rect x="194" y="12" width="12" height="7" rx="2" fill="#4A4F5C"/><ellipse cx="176" cy="17" rx="22" ry="3" fill="#F2F2EE" stroke="#000" stroke-opacity=".15"/><ellipse cx="224" cy="17" rx="22" ry="3" fill="#F2F2EE" stroke="#000" stroke-opacity=".15"/>`;
 s+=`<rect x="18" y="104" width="64" height="6" rx="2" fill="#8B623E"/><rect x="22" y="110" width="4" height="26" fill="#6E4C2E"/><rect x="74" y="110" width="4" height="26" fill="#6E4C2E"/><rect x="26" y="96" width="18" height="8" fill="#2F5D8A"/><rect x="28" y="91" width="14" height="5" fill="#B5462E"/><rect x="56" y="88" width="3" height="16" fill="#4A4F5C"/><path d="M50 88h15l-3-8h-9z" fill="#E7B451"/>`;
 s+=`<rect x="88" y="98" width="4" height="38" fill="#5A3A22"/><rect x="84" y="114" width="22" height="5" rx="2" fill="#6E4C2E"/><rect x="102" y="119" width="4" height="17" fill="#5A3A22"/>`;
 if(furn)s+=`<rect x="118" y="56" width="38" height="78" rx="2" fill="#9A7350"/><rect x="136.5" y="58" width="1.5" height="74" fill="#7A5434"/><circle cx="133" cy="96" r="1.6" fill="#E7B451"/><circle cx="141" cy="96" r="1.6" fill="#E7B451"/>`;
 s+=`<rect x="160" y="80" width="10" height="56" rx="3" fill="#6B4528"/><rect x="168" y="112" width="132" height="22" rx="3" fill="#7A5434"/><rect x="170" y="100" width="128" height="16" rx="5" fill="#F4F1EA"/><rect x="204" y="100" width="94" height="16" rx="4" fill="${sheet}"/><rect x="174" y="93" width="26" height="10" rx="5" fill="#FFFFFF"/><rect x="172" y="134" width="4" height="6" fill="#5A3A22"/><rect x="292" y="134" width="4" height="6" fill="#5A3A22"/>`;
 s+=`<rect x="302" y="62" width="8" height="12" rx="1.5" fill="#FAFAF8" stroke="#000" stroke-opacity=".2"/>`;
 return svgWrap(s,`Room at ${esc(h.title)}`);
}
function kitchenSvg(h){
 const shared=h.type==='Single room';
 let s=`<rect width="320" height="180" fill="#EEF1F3"/>`;
 for(let x=20;x<320;x+=20)s+=`<rect x="${x}" y="0" width="1" height="132" fill="#C9D2DA"/>`;
 for(let y=20;y<132;y+=20)s+=`<rect x="0" y="${y}" width="320" height="1" fill="#C9D2DA"/>`;
 s+=`<rect y="132" width="320" height="48" fill="#C7C2B8"/>`;
 for(let x=0;x<320;x+=32)s+=`<rect x="${x}" y="132" width="1.2" height="48" fill="#000" opacity=".08"/>`;
 s+=`<rect x="176" y="0" width="8" height="180" fill="#D9D4CA"/>`;
 s+=`<rect x="16" y="20" width="140" height="30" rx="2" fill="#B98E62"/><rect x="85" y="20" width="1.5" height="30" fill="#8B623E"/><rect x="10" y="98" width="160" height="8" fill="#8D8A84"/><rect x="14" y="106" width="152" height="30" fill="#A87C52"/><rect x="52" y="106" width="1.5" height="30" fill="#8B623E"/><rect x="90" y="106" width="1.5" height="30" fill="#8B623E"/><rect x="128" y="106" width="1.5" height="30" fill="#8B623E"/>`;
 s+=`<rect x="28" y="92" width="40" height="8" rx="2" fill="#C9D0D6"/><path d="M48 92V82h8" stroke="#9AA3AB" stroke-width="3" fill="none" stroke-linecap="round"/>`;
 s+=`<rect x="100" y="88" width="50" height="10" rx="2" fill="#2E3240"/><circle cx="114" cy="88" r="5" fill="#555B69"/><circle cx="136" cy="88" r="5" fill="#555B69"/><rect x="104" y="72" width="20" height="14" rx="3" fill="#9AA3AB"/><rect x="101" y="72" width="26" height="3" rx="1.5" fill="#7D858D"/>`;
 s+=`<path d="M272 0v30h-18" stroke="#9AA3AB" stroke-width="3" fill="none"/><path d="M246 30h14l-3 6h-8z" fill="#9AA3AB"/><path d="M249 40l-2 12M253 40v12M257 40l2 12" stroke="#7FB2E0" stroke-width="1.5" stroke-dasharray="3 3" fill="none"/>`;
 s+=`<rect x="286" y="96" width="22" height="20" rx="3" fill="#FFFFFF" stroke="#000" stroke-opacity=".15"/><path d="M276 116h40l-6 18h-28z" fill="#FFFFFF" stroke="#000" stroke-opacity=".15"/>`;
 s+=`<path d="M204 116h24l-3 20h-18z" fill="#2F7DC6"/><path d="M204 116c2-8 22-8 24 0" stroke="#2A5E92" stroke-width="1.5" fill="none"/>`;
 return svgWrap(s,`${shared?'Shared kitchen and bathroom':'Kitchen and bathroom'} at ${esc(h.title)}`);
}
function compoundSvg(h){
 const a=h.art,am=h.amenities.join(' ').toLowerCase(),wall=WALLS[a.wall%WALLS.length],roof=ROOFS[a.roof%ROOFS.length];
 let s=`<rect width="320" height="180" style="fill:var(--sky)"/>`;
 s+=`<rect x="40" y="58" width="150" height="40" fill="${wall}"/><path d="M30 60 70 34h80l40 26z" fill="${roof}"/>`;
 if(/solar/.test(am))s+=`<path d="M80 52l10-12h26l-10 12z" fill="#2B4C8C"/><path d="M110 52l10-12h26l-10 12z" fill="#2B4C8C"/><path d="M85 46h26M115 46h26" stroke="#9BB3E0" stroke-width="1"/>`;
 s+=`<circle cx="18" cy="66" r="20" fill="#4F7A45"/><rect x="16" y="80" width="4" height="16" fill="#6B4B2E"/>`;
 if(/water|borehole|well|tank/.test(am))s+=`<path d="M246 98V46M286 98V46M246 72h40M246 46l40 26M286 46l-40 26" stroke="#6B7080" stroke-width="3" fill="none"/><rect x="240" y="42" width="52" height="5" fill="#6B7080"/><path d="M244 42V20c0-7 44-7 44 0v22z" fill="#1F2430"/><path d="M244 28h44M244 35h44" stroke="#353B4A" stroke-width="1.5"/>`;
 s+=`<rect x="0" y="96" width="320" height="54" fill="#D8CDBA"/><rect x="0" y="92" width="320" height="6" fill="#BFB29C"/>`;
 for(let x=0;x<=320;x+=40)s+=`<rect x="${x-4}" y="88" width="8" height="62" fill="#C7BAA3"/>`;
 s+=`<rect x="122" y="100" width="72" height="50" fill="#2E3240"/>`;
 for(let x=128;x<190;x+=8)s+=`<rect x="${x}" y="104" width="2.5" height="44" fill="#4C5366"/>`;
 s+=`<rect x="157" y="100" width="2" height="50" fill="#1C1F29"/>`;
 if(/meter/.test(am))s+=`<rect x="54" y="108" width="22" height="28" rx="2" fill="#F4F4F0" stroke="#000" stroke-opacity=".2"/><rect x="58" y="113" width="14" height="7" fill="#9FD3A8"/><circle cx="65" cy="128" r="2" fill="#D9462F"/>`;
 if(/guard|security|gated|fenced/.test(am))s+=`<rect x="90" y="108" width="24" height="42" fill="#E9E2D3"/><rect x="86" y="102" width="32" height="7" fill="${roof}"/><rect x="95" y="116" width="14" height="10" fill="#38445E"/>`;
 s+=`<rect y="148" width="320" height="32" style="fill:var(--ground)"/>`;
 if(/generator/.test(am))s+=`<rect x="208" y="130" width="28" height="20" rx="2" fill="#E2A72E"/><rect x="212" y="134" width="12" height="6" fill="#3A3F4C"/>`;
 return svgWrap(s,`Compound at ${esc(h.title)}`);
}
function travel(h){const w=Math.round(h.km*1000/80);if(w<=30)return {mode:'walk',min:w,label:`${w} min walk`};const k=Math.round(h.km/18*60)+4;return {mode:'keke',min:k,label:`${k} min by keke`};}
function slidesFor(h){
 if(h.photos&&h.photos.length)return h.photos.map((p,i)=>({html:`<img src="${p}" alt="Photo ${i+1} of ${esc(h.title)}" loading="lazy">`,cap:'Photo '+(i+1)}));
 return [{html:frontSvg(h),cap:'Front'},{html:roomSvg(h),cap:'Room'},{html:kitchenSvg(h),cap:h.type==='Single room'?'Shared kitchen & bath':'Kitchen & bath'},{html:compoundSvg(h),cap:'Compound'}];
}
function gallery(h,o={}){
 const sl=slidesFor(h),t=travel(h);
 return `<div class="gal${o.big?' big':''}">
  <div class="gal-track" aria-label="Photos of ${esc(h.title)}. Swipe for more.">${sl.map((x,i)=>`<div class="gal-slide" aria-roledescription="slide" aria-label="${i+1} of ${sl.length}: ${esc(x.cap)}">${x.html}${o.big?`<span class="gcap">${esc(x.cap)} · ${i+1}/${sl.length}</span>`:''}</div>`).join('')}</div>
  ${o.badges?`<span class="gbadge type">${esc(h.type)}</span><span class="gbadge walk">${ic(t.mode,14)} ${t.label}</span>`:''}
  ${sl.length>1?`<button class="gal-nav prev" data-act="gal" data-dir="-1" aria-label="Previous photo">${ic('back',18)}</button><button class="gal-nav next" data-act="gal" data-dir="1" aria-label="Next photo">${ic('right',18)}</button><div class="gal-dots" aria-hidden="true">${sl.map((_,i)=>`<i class="${i?'':'on'}"></i>`).join('')}</div>`:''}
 </div>`;
}
function setDots(g,i){if(!g)return;g.querySelectorAll('.gal-dots i').forEach((d,j)=>d.classList.toggle('on',j===i));}
function keyArt(code,cls=''){
 let hs=0;for(const c of code)hs=(hs*31+c.charCodeAt(0))>>>0;
 let d='M70 44H232L242 52L232 60';let x=226;
 for(let i=0;i<6;i++){const dep=6+((hs>>(i*4))&7)*2.2;d+=`L${x} 60L${x-6} ${(60+dep).toFixed(1)}L${x-14} ${(60+dep).toFixed(1)}L${x-20} 60`;x-=24;}
 d+='L70 60Z';
 return `<svg class="keyart ${cls}" viewBox="0 0 250 100" role="img" aria-label="Key with cuts unique to this code"><circle cx="40" cy="52" r="30" style="fill:var(--brass)"/><circle cx="40" cy="52" r="11" style="fill:var(--brass-soft)"/><path d="${d}" style="fill:var(--brass)"/><rect x="72" y="49" width="148" height="3" rx="1.5" style="fill:var(--key-groove)"/></svg>`;
}
const AREAS={Asherifa:[95,74],Damico:[160,128],Modomo:[212,66],Parakin:[300,56],Mayfair:[262,112],'Oduduwa Estate':[222,192],Fajuyi:[340,146],Lagere:[302,204]};
const AREA_NAMES=Object.keys(AREAS);
function mapView(L){
 let pins='';
 L.forEach((h,i)=>{const [x,y]=AREAS[h.area]||[200,140];const k=L.slice(0,i).filter(o=>o.area===h.area).length;const px=x+k*22,py=y-k*4;
  pins+=`<g class="pin" data-act="push" data-v="house" data-id="${h.id}" tabindex="0" role="link" aria-label="${esc(h.title)}, from ${fmtK(minPrice(h))} a year"><path d="M${px} ${py}c-8-11-13-15-13-22a13 13 0 0 1 26 0c0 7-5 11-13 22z" style="fill:var(--primary)"/><text x="${px}" y="${py-19.5}" text-anchor="middle" font-size="8.6" font-weight="700" font-family="Hanken Grotesk,system-ui,sans-serif" style="fill:var(--on-primary)">${fmtK(minPrice(h)).replace('₦','')}</text></g>`;});
 const labels=AREA_NAMES.map(a=>{const [x,y]=AREAS[a];return `<text x="${x}" y="${y+13}" text-anchor="middle" font-size="9.5" font-weight="600" font-family="Hanken Grotesk,system-ui,sans-serif" style="fill:var(--muted)">${a}</text>`;}).join('');
 const road=d=>`<path d="${d}" fill="none" stroke-width="10" stroke-linecap="round" style="stroke:var(--map-edge)"/><path d="${d}" fill="none" stroke-width="7" stroke-linecap="round" style="stroke:var(--map-road)"/>`;
 return `<div class="map"><svg viewBox="0 0 400 260" role="group" aria-label="Schematic map of areas around OAU with listing pins">
  <rect width="400" height="260" style="fill:var(--map-land)"/>
  <path d="M8 150Q40 122 112 140Q150 158 138 222Q108 262 34 256Q4 236 8 150Z" style="fill:var(--map-campus)"/>
  <text x="70" y="206" text-anchor="middle" font-size="11" font-weight="700" font-family="Archivo,system-ui,sans-serif" style="fill:var(--ok)">OAU campus</text>
  ${road('M134 158C200 140 270 128 396 118')}${road('M60 10C110 50 160 90 162 126')}${road('M262 112C280 150 296 180 304 252')}${road('M200 30C206 80 214 140 222 190')}
  <circle cx="134" cy="158" r="5" style="fill:var(--ok)"/><text x="128" y="176" text-anchor="end" font-size="9" font-weight="700" font-family="Hanken Grotesk,system-ui,sans-serif" style="fill:var(--ok)">Main gate</text>
  <text x="392" y="108" text-anchor="end" font-size="9" font-family="Hanken Grotesk,system-ui,sans-serif" style="fill:var(--muted)">To town centre →</text>
  ${labels}${pins}
  <text x="392" y="252" text-anchor="end" font-size="8.5" font-family="Hanken Grotesk,system-ui,sans-serif" style="fill:var(--muted)">Schematic, not to scale</text>
 </svg></div>`;
}

/* ---------- small renderers ---------- */
const chip=(t,k='')=>`<span class="chip ${k}">${t}</span>`;
const roomChip=r=>({open:chip('Available','ok'),taken:chip('Taken','bad'),reserved:chip('Reserved','warn'),pending:chip('Pending payment','warn'),paused:chip('Paused')})[roomState(r)];
const statusChip=s=>({open:chip('Open','warn'),review:chip('Under review','info'),resolved:chip('Resolved','ok')})[s]||'';
const VISIT_CUT=12*36e5,NOSHOW_AFTER=36e5;
const inspChip=i=>{
 const ag=S.role==='agent';
 if(i.status==='cancelled')return chip(i.byAdmin?'Cancelled by Lodgely · refunded':ag?'You cancelled · refunded':'Agent cancelled · refunded');
 if(i.status==='stuCancelled')return chip((ag?'Student cancelled':'You cancelled')+(i.refunded?' · refunded':' · fee kept'));
 if(i.status==='noshow')return chip(ag?'Marked no-show · refunded':"Agent didn't show · refunded",'bad');
 if(i.status==='missed')return chip(ag?"Student didn't come":'Missed · fee kept','warn');
 return ({booked:chip('Booked','info'),completed:chip('Completed','ok')})[i.status]||'';
};
const visitWhen=i=>{const t=now();return {before:i.slot-t,free:i.slot-t>=VISIT_CUT,over:t-i.slot>=NOSHOW_AFTER};};
const modChip=h=>({live:chip('Live','ok'),pending:chip('Awaiting admin review','warn'),rejected:chip('Rejected','bad'),removed:chip('Taken down by Lodgely','bad')})[h.mod]||'';
const head=(eb,t,extra='')=>`<div class="page-head"><p class="eyebrow">${eb}</p><h1>${t}</h1>${extra}</div>`;
const backRow=l=>`<div class="backrow"><button class="iconbtn plain" data-act="back" aria-label="Back">${ic('back')}</button><span class="eyebrow">${l}</span></div>`;
const empty=(t,label,act,attrs='')=>`<div class="empty">${ic('home',28)}<p>${t}</p>${label?`<button class="btn sm" data-act="${act}" ${attrs}>${label}</button>`:''}</div>`;
const stat=(v,l)=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`;
const mhead=t=>`<div class="mhead"><h2>${t}</h2><button class="iconbtn plain" data-act="closeModal" aria-label="Close">${ic('x')}</button></div>`;
const gone=()=>`<div class="empty"><p>This page is no longer available.</p><button class="btn sm" data-act="back">Go back</button></div>`;
const verBadge=a=>a.status==='verified'?`<span class="chip ver">${ic('shield',13)} Verified</span>`:a.status==='pending'?chip('Verification pending','warn'):a.status==='suspended'?chip('Suspended','bad'):chip('Not verified','bad');
const cdBlocks=end=>{const c=cdText(end);return `<span><b data-u="d">${c.d}</b><small>days</small></span><span><b data-u="h">${c.h}</b><small>hrs</small></span><span><b data-u="m">${c.m}</b><small>min</small></span><span><b data-u="s">${c.s}</b><small>sec</small></span>`;};
function progress(k){if(k.start>now())return `<div class="stack" style="gap:6px"><div class="prog"><i style="width:0"></i></div><p class="muted small">Starts ${fmtDate(k.start)} · ends ${fmtDate(k.end)}</p></div>`;const total=Math.round((k.end-k.start)/DAY);const day=Math.min(total,Math.max(1,Math.ceil((now()-k.start)/DAY)));return `<div class="stack" style="gap:6px"><div class="prog"><i style="width:${(day/total*100).toFixed(1)}%"></i></div><p class="muted small">Day ${day} of ${total} · ends ${fmtDate(k.end)}</p></div>`;}
function sel(id,path,opts,label,rr='results'){const val=getPath(path);return `<div class="field"><label for="${id}">${label}</label><select id="${id}" class="in" data-bind="${path}" data-rerender="${rr}">${opts.map(o=>{const [v,t]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}" ${String(val)===String(v)?'selected':''}>${esc(t)}</option>`;}).join('')}</select></div>`;}

/* ---------- student: explore ---------- */
const AMEN={
 'Steady water':h=>h.amenities.some(a=>/water|borehole|well/i.test(a)),
 'Prepaid meter':h=>h.amenities.some(a=>/meter/i.test(a)),
 'Security':h=>h.amenities.some(a=>/guard|security|gated|fenced/i.test(a)),
 'Wi-Fi':h=>h.amenities.some(a=>/wi-?fi/i.test(a)),
 'Furnished':h=>h.rooms.some(r=>r.furnished)||h.amenities.includes('Furnished'),
 'Power backup':h=>h.amenities.some(a=>/solar|generator|inverter/i.test(a)),
 'Shared rooms':h=>h.shared
};
function filtered(pred=visible){
 const f=S.f,q=f.q.trim().toLowerCase();
 let L=S.houses.filter(pred);
 if(q)L=L.filter(h=>(h.title+' '+h.area+' '+h.address+' '+h.type+' '+h.rooms.map(r=>r.name).join(' ')+' oau obafemi awolowo university ife').toLowerCase().includes(q));
 if(f.area!=='All')L=L.filter(h=>h.area===f.area);
 if(f.max!=='Any')L=L.filter(h=>minPrice(h)<=+f.max);
 if(f.type!=='Any')L=L.filter(h=>h.type===f.type||openRooms(h).some(r=>r.name.toLowerCase().includes(f.type.toLowerCase())));
 f.am.forEach(a=>{if(AMEN[a])L=L.filter(AMEN[a]);});
 const sorts={price:(a,b)=>minPrice(a)-minPrice(b),dist:(a,b)=>a.km-b.km,new:(a,b)=>(b.created||0)-(a.created||0),rec:(a,b)=>(agent(b.agentId).trust-agent(a.agentId).trust)||(a.km-b.km)};
 return L.sort(sorts[f.sort]||sorts.rec);
}
function card(h){
 const a=agent(h.agentId),n=openRooms(h).length,fav=S.favs.includes(h.id),ob=openBallotsH(h).length,he=houseEnd(h);
 return `<article class="card" data-act="push" data-v="house" data-id="${h.id}" tabindex="0" role="link" aria-label="${esc(h.title)}">
  ${gallery(h,{badges:true})}
  <button class="fav ${fav?'on':''}" data-act="fav" data-id="${h.id}" aria-label="${fav?'Remove from':'Save to'} favourites" aria-pressed="${fav}">${ic('heart',18)}</button>
  <div class="card-b">
   <div class="card-top"><h3>${esc(h.title)}</h3><span class="price">from <b>${fmtK(minPrice(h))}</b>/yr</span></div>
   <p class="meta">${ic('pin',14)} ${esc(h.area)} · ${h.km} km to OAU gate</p>
   <div class="chips">${n?chip(n+' free','ok'):chip(he?'Taken until '+fmtDate(he):'Fully let','bad')}${ob?chip(n?ob+' opening soon':'Ballot open','brass'):''}${h.shared?chip('Shared rooms','brass'):''}${a.status==='verified'?`<span class="chip ver">${ic('shield',13)} Verified agent</span>`:''}</div>
  </div>
 </article>`;
}
function results(){
 if(pendingViews.has('student_explore'))return skelCards(6,true);
 const L=filtered(visible),T=filtered(isTakenListing),rooms=sum(L,h=>openRooms(h).length);
 const c=`<p class="count">${rooms} room${rooms===1?'':'s'} free in ${L.length} house${L.length===1?'':'s'}${T.length?` · ${T.length} fully let`:''}</p>`;
 const main=!L.length?empty('No free rooms match these filters. Try a wider budget or another area.','Clear filters','clearf'):(S.f.view==='map'?mapView(L):`<div class="grid">${L.map(card).join('')}</div>`);
 const taken=T.length?`<section class="block" style="margin-top:18px"><div class="page-head"><h2>Taken right now</h2><p class="muted small">These are let, so there's no need to call the agent. Rooms that free up in the next 60 days take ballot entries from students who have inspected.</p></div><div class="grid">${T.map(card).join('')}</div></section>`:'';
 return c+main+taken;
}
const V={};
V.student_explore=()=>{
 const f=S.f;
 return `<section class="hero-s">
  <p class="eyebrow">Ile-Ife · 2026/2027 session</p>
  <h1>Find a lodge near OAU. Inspect it. Pay safely.</h1>
  <label class="search">${ic('search',18)}<input id="q" type="search" placeholder="Area, house or school" aria-label="Search houses" value="${esc(f.q)}" data-bind="f.q" data-live="results" autocomplete="off"></label>
  <div class="filters">
   ${sel('f-area','f.area',[['All','All areas'],...AREA_NAMES],'Area')}
   ${sel('f-max','f.max',[['Any','Any price'],['150000','Up to ₦150k'],['300000','Up to ₦300k'],['500000','Up to ₦500k'],['1000000','Up to ₦1m']],'Budget per year')}
   ${sel('f-type','f.type',[['Any','Any type'],'Single room','Self-contain','Room & parlour','Flat'],'Type')}
   ${sel('f-sort','f.sort',[['rec','Recommended'],['price','Lowest price'],['new','Newest'],['dist','Closest to campus']],'Sort')}
  </div>
  <div class="amen" role="group" aria-label="Amenities">${Object.keys(AMEN).map(a=>`<button class="tog ${f.am.includes(a)?'on':''}" data-act="am" data-a="${a}" aria-pressed="${f.am.includes(a)}">${a}</button>`).join('')}</div>
 </section>
 <div class="scam">${ic('shield',18)}<span>Pay only inside Lodgely. Agents who ask for direct transfers are removed.</span></div>
 <div class="row-between">
  <div class="seg2" role="group" aria-label="Show results as"><button class="${f.view==='list'?'on':''}" data-act="view" data-view="list" aria-pressed="${f.view==='list'}">${ic('list',16)} List</button><button class="${f.view==='map'?'on':''}" data-act="view" data-view="map" aria-pressed="${f.view==='map'}">${ic('map',16)} Map</button></div>
  <button class="link" data-act="push" data-v="board">${ic('flag',15)} Complaints board</button>
 </div>
 <div id="results">${results()}</div>`;
};

/* ---------- student: house detail ---------- */
function publicComplaintsFor(h){return S.complaints.filter(c=>c.kind==='public'&&!c.removed&&((c.houseId===h.id&&c.about!=='tenant')||(c.about==='agent'&&c.agentId===h.agentId)));}
function authorRole(c){if(c.authorRole==='owner')return 'House owner';return S.keys.some(k=>k.studentId===c.authorId&&k.houseId===c.houseId&&k.status==='active')?'Current tenant':'Former tenant';}
function complaintCard(c,mode='public'){
 const h=house(c.houseId);
 const about=c.about==='tenant'?`About tenant ${esc(c.tenantName)}`:c.about==='agent'?`About agent ${esc(agent(c.agentId).name)}`:`About ${esc(h?h.title:'a house')}`;
 const kind=c.kind==='public'?authorRole(c):c.kind==='mismatch'?'Listing mismatch report · private':'Dispute · private';
 let extra='';
 if(mode==='agent'&&!c.reply&&c.authorId!==MYID()&&c.kind==='public')extra=`<div class="btns"><button class="btn sm ghost" data-act="reply" data-id="${c.id}">Reply publicly</button></div>`;
 if(mode!=='admin'&&S.role==='student'&&LOGGED()&&c.kind==='public'&&c.about==='tenant'&&c.tenantId===MYID()&&!c.reply)extra=`<div class="btns"><button class="btn sm ghost" data-act="reply" data-id="${c.id}">Reply publicly</button></div>`;
 if(mode==='admin'){
  const p=c.payId?S.payments.find(x=>x.id===c.payId):null;
  const t=S.threads.find(x=>x.houseId===c.houseId&&x.studentId===c.authorId);
  extra=`${p?`<p class="small muted">Payment ${esc(p.ref)} · ${fmt(p.amount)} · ${p.status==='held'?'held in escrow':p.status}</p>`:''}
  <div class="modrow">${['open','review','resolved'].map(s=>`<button class="tog ${c.status===s?'on':''}" data-act="setStatus" data-id="${c.id}" data-s="${s}">${{open:'Open',review:'Under review',resolved:'Resolved'}[s]}</button>`).join('')}</div>
  <div class="btns">${t?`<button class="btn sm ghost" data-act="push" data-v="thread" data-id="${t.id}" data-ro="1">${ic('chat',15)} Read chat</button>`:''}${p&&p.status==='held'?`<button class="btn sm ghost" data-act="refund" data-id="${p.id}">Refund student</button>`:''}${c.kind==='public'?`<button class="btn sm ghost danger-t" data-act="removeComplaint" data-id="${c.id}">${c.removed?'Restore post':'Remove post'}</button>`:''}</div>`;
 }
 return `<article class="comp"${c.removed?' style="opacity:.6"':''}>
  <div class="comp-h"><div><b>${esc(c.authorName)}</b><span class="muted small">${kind} · ${rel(c.t)}${c.removed?' · removed by admin':''}</span></div>${statusChip(c.status)}</div>
  <p class="small strong">${about}${c.reason?` · ${esc(c.reason)}`:''}</p>
  <p>${esc(c.text)}</p>
  ${c.reply?`<div class="reply"><span class="small strong">Reply from ${esc(c.replyBy||'the agent')}</span><span>${esc(c.reply)}</span></div>`:''}
  ${extra}
 </article>`;
}
function agentStrip(a,h){return `<section class="agent-strip">
 ${avatarHTML(a.name,a.photo)}
 <div class="agent-info"><button class="link" data-act="push" data-v="agent" data-id="${a.id}">${esc(a.name)}</button><span class="muted small">${esc(a.biz)} · replies ${a.resp}</span>
  <div class="chips">${verBadge(a)}${a.ratings?chip('★ '+a.rating.toFixed(1)+' ('+a.ratings+')','brass'):''}${a.trust?chip('Trust score '+a.trust):''}</div></div>
 <button class="btn sm ghost" data-act="message" data-h="${h.id}">${ic('chat',16)} Message</button>
</section>`;}
function visitButtons(i){
 const w=visitWhen(i);
 return `<button class="btn sm" data-act="enterCode" data-id="${i.id}">${ic('door',16)} Enter door code</button>`+
  (w.over?`<button class="btn sm ghost danger-t" data-act="reportNoShow" data-id="${i.id}">The agent didn't show up</button>`:
  `${w.free&&!(i.moves>0)?`<button class="btn sm ghost" data-act="book" data-h="${i.houseId}" data-resched="${i.id}">Reschedule</button>`:''}<button class="btn sm ghost" data-act="cancelVisit" data-id="${i.id}">Cancel visit</button>`);
}
function visitRule(i){
 const w=visitWhen(i);
 if(w.over)return 'If the agent never came, report it and Lodgely refunds your fee.';
 if(w.free)return `Free to cancel until ${fmtSlot(i.slot-VISIT_CUT)}. ${i.moves>0?'You have already moved this visit once.':'You can move it once before then.'}`;
 return 'Less than 12 hours to go, so cancelling now keeps the fee with the agent.';
}
function inspectionBlock(h){
 const full=!openRooms(h).length,ob=openBallotsH(h).length;
 if(inspDone(h.id))return `<section class="insp ok-tone">${ic('check',22)}<div><b>Inspection completed</b><p class="small">${full?(ob?'Every room is let right now. You can join the ballot below.':'Rent unlocks here as soon as a room frees up.'):'Rent payment is unlocked for this house. Pick a room below.'}</p></div></section>`;
 const ins=inspOpen(h.id);
 if(ins)return `<section class="insp">${ic('calendar',22)}<div><b>Visit booked · ${fmtSlot(ins.slot)}</b>
  <p class="small">Meet ${esc(agent(h.agentId).name)} at ${esc(h.address)}. At the door, the agent shows a 4-digit code on their app. Enter it to confirm the visit.</p>
  <div class="btns">${visitButtons(ins)}</div>
  <p class="small muted">${visitRule(ins)}</p>
  ${DEMO&&ins.code?`<p class="hint">Demo: the agent's code is <b class="mono">${ins.code}</b></p>`:''}</div></section>`;
 if(full&&!ob)return `<section class="insp">${ic('clock',22)}<div><b>All rooms are let</b><p class="small">${houseEnd(h)?'Taken until '+fmtDate(houseEnd(h))+'. ':''}Save this house. A ballot opens here 60 days before a room frees up.</p></div></section>`;
 if(full)return `<section class="insp">${ic('users',22)}<div><b>All rooms are let, and one opens soon</b>
  <p class="small">Inspect now (${fmt(FEE)}) to join the ballot. The winner is drawn at random from students who inspected.</p>
  <div class="btns"><button class="btn sm" data-act="book" data-h="${h.id}">Book inspection · ${fmt(FEE)}</button></div></div></section>`;
 return `<section class="insp">${ic('calendar',22)}<div><b>Inspection required before rent</b>
  <p class="small">Book a visit and pay the standard ${fmt(FEE)} inspection fee. If the agent cancels or does not show up, you get it back.</p>
  <div class="btns"><button class="btn sm" data-act="book" data-h="${h.id}">Book inspection · ${fmt(FEE)}</button></div></div></section>`;
}
function roomRow(h,r){
 const st=roomState(r),left=Math.max(0,r.cap-r.occ.length),end=roomEnd(r);let action='',extra='';
 const myHold=st==='pending'&&r.payHold.by===MYID()&&LOGGED();
 if(st==='open'||myHold)action=inspDone(h.id)?`<button class="btn sm" data-act="rent" data-h="${h.id}" data-r="${r.id}">${myHold?'Continue payment':'Rent this room'}</button>`:`<button class="btn sm ghost" data-act="needInsp">${ic('lock',15)} Inspect first</button>`;
 if(myHold)extra+=`<span class="small" style="color:var(--warn)">Held for you for <b class="mono" data-hold="${r.payHold.until}">15:00</b> · <button class="link small" data-act="releaseRoom" data-h="${h.id}" data-r="${r.id}">Release it</button></span>`;
 if(st==='pending'&&!myHold)extra+=`<span class="small" style="color:var(--warn)">Another student is paying for this room. It opens again if they don't finish within 15 minutes.</span>`;
 ballotsOf(r).forEach(b=>{extra+=ballotLine(h,r,b);});
 const mine=S.keys.find(k=>k.studentId===MYID()&&k.roomId===r.id&&k.status==='active'&&k.start>now());
 if(mine)extra+=`<span class="small" style="color:var(--ok);font-weight:700">${ic('key',13)} Yours from ${fmtDate(mine.start)}</span>`;
 const sub=`${fmt(r.price)} a year${r.cap>1?` per person · ${left} of ${r.cap} spaces left`:''}${r.furnished?' · Furnished':''}${st==='taken'&&end?` · taken until ${fmtDate(end)}`:''}`;
 return `<li class="room"><div class="room-main"><b>${esc(r.name)}</b><span class="muted small">${sub}</span>${extra}</div><div class="room-side">${roomChip(r)}${action}</div></li>`;
}
function ballotLine(h,r,b){
 const n=b.entrants.length,inB=b.entrants.includes(MYID()),k=keyOf(b.keyCode);
 if(b.status==='open'){
  const when=k&&b.drawAt>=k.end?`when it frees up on ${fmtDate(b.drawAt)}`:`on ${fmtDate(b.drawAt)} (tenant is not renewing)`;
  let act='';
  if(S.role==='student'){
   if(inB)act=`${chip(ic('check',13)+' You are in','ok')}<button class="link small" data-act="leaveBallot" data-id="${b.id}">Leave</button>`;
   else if(inspDone(h.id))act=`<button class="btn sm brass" data-act="joinBallot" data-id="${b.id}">Join ballot</button>`;
   else act=`<span class="small">Inspect the house to join.</span>`;
  }
  return `<div class="ballot"><span class="small"><b>Ballot open</b> · ${n} entered · draw ${when}</span>${act?`<div class="btns">${act}</div>`:''}</div>`;
 }
 const pos=b.order.indexOf(MYID()),offered=b.order[b.offerIdx],until=fmtSlot(b.offerAt+48*36e5);
 if(S.role==='student'&&offered===MYID())return `<div class="ballot win"><span class="small"><b>You won the ballot.</b> Pay by ${until} to secure it from ${fmtDate(startForBallot(b))}.</span><div class="btns"><button class="btn sm brass" data-act="rentBallot" data-id="${b.id}">Pay rent · ${fmt(r.price)}</button></div></div>`;
 if(S.role==='student'&&pos>b.offerIdx)return `<div class="ballot"><span class="small"><b>Ballot drawn.</b> You are number ${pos-b.offerIdx+1} in line. If the people ahead don't pay within 48 hours, it comes to you.</span></div>`;
 if(S.role!=='student')return `<div class="ballot"><span class="small"><b>Ballot drawn.</b> ${esc(stu(offered).name)} has until ${until} to pay.</span></div>`;
 return `<div class="ballot"><span class="small"><b>Ballot drawn.</b> Reserved for the winner while they pay.</span></div>`;
}
V.house=({id})=>{
 const h=house(id);if(!h||h.deleted)return gone();
 const a=agent(h.agentId),fav=S.favs.includes(id),comps=publicComplaintsFor(h);
 return `<div class="detail-art">${gallery(h,{big:true})}
   <button class="iconbtn float l" data-act="back" aria-label="Back">${ic('back')}</button>
   <button class="iconbtn float r fav ${fav?'on':''}" data-act="fav" data-id="${id}" aria-label="${fav?'Remove from':'Save to'} favourites" aria-pressed="${fav}">${ic('heart')}</button></div>
  <div class="detail-head"><p class="eyebrow">${esc(h.type)} · ${esc(h.area)}</p><h1>${esc(h.title)}</h1><p class="meta">${ic('pin',14)} ${esc(h.address)} · ${h.km} km to OAU main gate, about ${travel(h).label}</p></div>
  ${agentStrip(a,h)}
  ${S.role==='student'?inspectionBlock(h):''}
  <section class="block"><h2>Rooms</h2><ul class="rooms">${h.rooms.map(r=>roomRow(h,r)).join('')}</ul>
   ${h.shared?`<p class="note">${ic('users',16)} The owner allows shared rooms here. Each roommate pays their own share and gets their own key.</p>`:''}</section>
  <section class="block"><h2>About this house</h2><p>${esc(h.desc)}</p><p class="small muted">${h.baths||1} bathroom${(h.baths||1)>1?'s':''} · ${h.availFrom&&new Date(h.availFrom+'T00:00:00+01:00').getTime()>now()?'Available from '+fmtDate(new Date(h.availFrom+'T00:00:00+01:00')):'Available now'} · Visits: ${daysLabel(h.days||[1,2,3,4,5,6])}</p><div class="chips">${h.amenities.map(x=>chip(esc(x))).join('')}</div>
   <h3 class="sub">House rules</h3><ul class="rules">${h.rules.map(r=>`<li>${esc(r)}</li>`).join('')}</ul></section>
  <section class="block"><h2>Location</h2>${miniMap(h)}<p class="muted small">${esc(h.address)} · ${h.km} km to the OAU main gate, about ${travel(h).label}. Schematic map. The live app uses a street map with directions.</p></section>
  <section class="block"><div class="row-between"><h2>Complaints <span class="count-pill">${comps.length}</span></h2><button class="btn sm ghost" data-act="lodgeComplaint" data-id="${id}">${ic('flag',15)} Lodge a complaint</button></div>
   <p class="muted small">Posted only by people who rented through Lodgely. Read them before you inspect or pay.</p>
   ${comps.length?comps.map(c=>complaintCard(c)).join(''):`<p class="muted">No complaints from past tenants.</p>`}</section>`;
};
V.agent=({id})=>{
 const a=agent(id);if(!a)return gone();
 const hs=S.houses.filter(h=>h.agentId===id&&isLive(h));
 const comps=S.complaints.filter(c=>c.kind==='public'&&!c.removed&&c.about!=='tenant'&&(c.agentId===id));
 return `${backRow('Agent profile')}
 <div class="agent-strip" style="grid-template-columns:auto 1fr">${avatarHTML(a.name,a.photo)}<div class="agent-info"><h2>${esc(a.name)}</h2><span class="muted small">${esc(a.biz)} · on Lodgely since ${a.since}</span><div class="chips">${verBadge(a)}</div></div></div>
 <p>${esc(a.bio)}</p>
 <div class="stats">${stat(a.trust||'—','Trust score')}${stat(a.ratings?'★ '+a.rating.toFixed(1):'—','Rating from '+a.ratings+' visits')}${stat(a.inspDone,'Inspections completed')}${stat(a.disputes,'Disputes lost')}</div>
 <p class="muted small">The trust score updates as things happen. It goes up with good ratings from students who inspected and with completed visits. It goes down with cancelled visits, listing mismatch reports and lost disputes.</p>
 <section class="block"><h2>Live listings</h2>${hs.length?`<div class="grid">${hs.map(card).join('')}</div>`:'<p class="muted">No live listings.</p>'}</section>
 <section class="block"><h2>Complaints <span class="count-pill">${comps.length}</span></h2>${comps.length?comps.map(c=>complaintCard(c)).join(''):'<p class="muted">No complaints.</p>'}</section>`;
};
V.board=()=>{
 const f=S.boardFilter;
 const L=S.complaints.filter(c=>c.kind==='public'&&!c.removed&&(f==='all'||c.about===f)).sort((a,b)=>b.t-a.t);
 return `${backRow('Complaints board')}
 ${head('Public','Complaints from real rentals','<p class="muted">Former tenants post about houses and agents. House owners post about tenants. Every post is tied to a rental on Lodgely, and the person named can reply.</p>')}
 <div class="amen">${[['all','All'],['house','Houses'],['agent','Agents'],['tenant','Tenants']].map(([k,l])=>`<button class="tog ${f===k?'on':''}" data-act="boardF" data-f="${k}">${l}</button>`).join('')}</div>
 <div class="stack">${L.length?L.map(c=>complaintCard(c)).join(''):'<p class="muted">Nothing here.</p>'}</div>`;
};

/* ---------- chat ---------- */
const SCAM=/(account\s*(no|number|details)|acct\s*no|send\s+(it|the\s+money|money)\s+to|pay\s+(?:\w+\s+)?(directly|outside|in\s+cash|cash)|transfer\s+(it\s+)?to\s+(my|me)|\b\d{10}\b)/i;
function threadList(L){
 if(!L.length)return empty('No chats yet. Message an agent from any listing.');
 return `<div class="rows">${L.map(t=>{const h=house(t.houseId),last=t.msgs[t.msgs.length-1];const other=S.role==='agent'?stu(t.studentId).name:agent(t.agentId).name;const mine=S.role==='agent'?'a':'s';const unread=t.msgs.filter(m=>m.from!==mine&&!m.read).length;
  return `<button class="rowi" data-act="push" data-v="thread" data-id="${t.id}"><div class="avatar sm">${initials(other)}</div><div class="grow"><div class="row-between"><b>${esc(other)}</b><span class="muted small">${last?rel(last.t):''}</span></div><span class="muted small">${esc(h.title)}</span><span class="clip"${unread?' style="font-weight:700"':''}>${last?esc(last.text):'No messages yet'}</span></div>${unread?`<span class="chip info">${unread}</span>`:''}</button>`;}).join('')}</div>`;
}
V.thread=({id,ro})=>{
 const t=S.threads.find(x=>x.id===id);if(!t)return gone();
 const h=house(t.houseId),me=S.role==='agent'?'a':'s';
 const other=me==='a'?stu(t.studentId).name:agent(t.agentId).name;
 const msgs=t.msgs.map(m=>{const mine=!ro&&m.from===me;const who=m.from==='a'?agent(t.agentId).name:stu(t.studentId).name;
  return `<div class="msg ${mine?'me':''}">${ro?`<span class="who">${esc(who)}</span>`:''}<p>${esc(m.text)}</p><time>${rel(m.t)}${mine&&m.read?' · Read':''}</time>${m.flag?`<span class="flag">${ic('alert',13)} Possible request to pay outside Lodgely. Flagged for the safety team.</span>`:''}</div>`;}).join('');
 return `<div class="thread-head"><button class="iconbtn plain" data-act="back" aria-label="Back">${ic('back')}</button><div class="avatar sm">${initials(ro?h.title:other)}</div>
   <div class="grow"><b>${esc(ro?stu(t.studentId).name+' and '+agent(t.agentId).name:other)}</b>${S.role==='student'?`<button class="link small" data-act="push" data-v="house" data-id="${h.id}">${esc(h.title)}</button>`:`<span class="muted small">${esc(h.title)}</span>`}</div>
   ${ro?'':`<button class="btn sm ghost" data-act="report" data-id="${t.id}">${ic('flag',15)} Report</button>`}</div>
  <div class="scam small">${ic('shield',16)}<span>Keep payments inside Lodgely. Never send rent or fees to a personal account.</span></div>
  <div class="msgs">${msgs||'<p class="muted">Say hello and ask anything about the house.</p>'}</div>
  ${ro?'<p class="fine">Admin view of this chat. Read-only.</p>':t.blocked?`<p class="note">${(t.blockedBy||'student')===(S.role==='agent'?'agent':'student')?'You blocked this chat. Lodgely\'s safety team has the report.':`${S.role==='agent'?'The student':'The agent'} blocked this chat. Lodgely's safety team is reviewing it.`}</p>`:`<div class="composer"><input id="msg-in" class="in" placeholder="Write a message" aria-label="Message" autocomplete="off" data-enter="send" data-id="${t.id}"><button class="btn" data-act="send" data-id="${t.id}" aria-label="Send">${ic('send',18)}</button></div>`}`;
};
async function autoReply(tid,text){
 if(!DEMO)return;
 try{await B.call('demo_reply',{id:tid,text});await refresh();}catch(e){return;}
 const c=cur();
 if(S.role==='student'&&c&&c.v==='thread'&&c.id===tid){const v=$('#msg-in')?$('#msg-in').value:'';render();const i=$('#msg-in');if(i)i.value=v;scrollTo(0,document.body.scrollHeight);B.call('mark_thread_read',{id:tid}).catch(()=>{});}
 else bgRender();
}

/* ---------- student: lodge, key, saved, savings ---------- */
function escrowLine(k,p){
 if(!p)return '';
 if(p.status==='held')return `<p class="note warn-t">${ic('shield',16)} <span>${fmt(p.amount)} held by Lodgely. It goes to the agent when you confirm move-in, or automatically on ${fmtDate(k.start+7*DAY)}.</span></p>`;
 if(p.status==='released')return `<p class="note ok-t">${ic('check',16)} <span>Rent released to the agent${k.movedIn?' after move-in':''}.</span></p>`;
 return '';
}
function keySummary(k){
 const h=house(k.houseId),r=room(h,k.roomId),p=S.payments.find(x=>x.id===k.payId),fut=k.start>now();
 return `<article class="keycard">
  <div class="kc-top"><div><p class="eyebrow">Subscription key · ${fut?'starts '+fmtDate(k.start):'active'}</p><h2>${esc(h.title)}</h2><p class="muted small">${esc(r.name)}${fut?' · won by ballot':''}</p></div>${keyArt(k.code)}</div>
  ${fut?'<p class="small strong">Time until you move in</p>':''}<div class="cd" data-cd="${fut?k.start:k.end}" data-full="1">${cdBlocks(fut?k.start:k.end)}</div>
  ${priorityPanel(k)}
  ${progress(k)}
  <div class="kc-code">${k.code}</div>
  ${escrowLine(k,p)}
  <div class="btns"><button class="btn sm" data-act="push" data-v="key" data-code="${k.code}">${ic('key',16)} Open key</button>${!k.movedIn?`<button class="btn sm brass" data-act="moveIn" data-code="${k.code}">Confirm move-in</button>`:''}<button class="btn sm ghost" data-act="renew" data-code="${k.code}">Renew</button></div>
 </article>`;
}
function priorityPanel(k){
 if(k.status!=='active'||k.studentId!==MYID()||k.start>now())return '';
 const b=S.ballots.find(x=>x.keyCode===k.code&&(x.status==='open'||x.status==='drawn'||x.status==='filled'));
 if(!b)return '';
 if(b.status!=='open')return `<div class="ballot"><span class="small"><b>The ballot for this room has been drawn.</b> Your stay ends ${fmtDate(k.end)} and the next tenant moves in after you.</span></div>`;
 return `<div class="ballot"><span class="small"><b>You have first right to renew.</b> ${b.entrants.length} student${b.entrants.length===1?' has':'s have'} entered the ballot for this room. ${k.notRenewing?`You said you're not renewing, so the draw is on ${fmtDate(b.drawAt)}.`:`If you don't renew by ${fmtDate(k.end)}, a winner is drawn at random.`}</span>${k.notRenewing?'':`<div class="btns"><button class="btn sm ghost" data-act="notRenewing" data-code="${k.code}">I'm not renewing</button></div>`}</div>`;
}
function inspRowStudent(i){
 const h=house(i.houseId);
 return `<div class="rowi"><div class="grow"><div class="row-between"><b>${esc(h.title)}</b>${inspChip(i)}</div><span class="muted small">${fmtSlot(i.slot)} · fee ${fmt(i.fee)}</span>
  ${i.status==='booked'?`<div class="btns" style="margin-top:6px">${visitButtons(i)}<button class="btn sm ghost" data-act="push" data-v="house" data-id="${h.id}">View house</button></div><span class="small muted">${visitRule(i)}</span>`:''}
  ${i.status==='completed'?`<div class="rate"><span class="small">${i.rating?'Your rating':'Rate this visit'}</span>${[1,2,3,4,5].map(n=>`<button class="star ${i.rating>=n?'on':''}" data-act="rate" data-id="${i.id}" data-n="${n}" aria-label="${n} star${n>1?'s':''}">★</button>`).join('')}${i.mismatch?chip('Mismatch reported','warn'):`<button class="link small" data-act="mismatch" data-id="${i.id}">Report mismatch</button>`}</div>`:''}
 </div></div>`;
}
function payRow(p,admin){
 const h=house(p.houseId);const lbl={inspection:'Inspection fee',rent:'Rent',renewal:'Renewal'}[p.kind];
 const st={held:chip('Held until move-in','warn'),released:chip(admin?(p.paidOutAt?'Sent to agent':'Released to agent'):'Paid to agent','ok'),refunded:chip(p.refundNeeded&&admin?'Refund to send':'Refunded',p.refundNeeded&&admin?'warn':'info'),paid:chip('Paid','ok'),failed:chip(p.refundNeeded?'Failed · refund to send':'Failed','bad')}[p.status];
 let act='';
 if(admin){
  if(p.status==='held')act=`<div class="btns" style="margin-top:6px"><button class="btn sm ghost" data-act="release" data-id="${p.id}">Release to agent</button><button class="btn sm ghost danger-t" data-act="refund" data-id="${p.id}">Refund</button></div>`;
  else if(p.kind==='inspection'&&p.status==='paid'&&S.inspections.some(i=>i.payId===p.id&&i.status==='booked'))act=`<div class="btns" style="margin-top:6px"><button class="btn sm ghost danger-t" data-act="refund" data-id="${p.id}">Refund fee</button></div>`;
  if((p.status==='released'||(p.status==='paid'&&p.kind==='inspection'&&!S.inspections.some(i=>i.payId===p.id&&i.status==='booked')))&&!p.paidOutAt&&PAYMODE==='paystack')act+=`<div class="btns" style="margin-top:6px"><button class="btn sm ghost" data-act="paidOut" data-id="${p.id}">Mark as sent to agent</button></div>`;
 }
 return `<div class="rowi"><div class="grow"><div class="row-between"><b>${lbl}${admin?' · '+esc(stu(p.studentId).name):''}</b><b class="num">${fmt(p.amount)}</b></div>
  <span class="muted small">${esc(h?h.title:'')} · ${fmtDate(p.time)} · ${esc(p.method)}${p.savingsUsed?` · ${fmt(p.savingsUsed)} from savings`:''}</span>
  <div class="row-between"><span class="mono small muted">${p.ref}</span>${st}</div>${act}${admin?'':`<button class="link small" data-act="push" data-v="receipt" data-id="${p.id}">View receipt</button>`}</div></div>`;
}
V.student_lodge=()=>{
 const ks=myKeys().sort((a,b)=>b.start-a.start),act=ks.filter(k=>k.status==='active'),past=ks.filter(k=>k.status!=='active');
 const ins=S.inspections.filter(i=>i.studentId===MYID()).sort((a,b)=>b.slot-a.slot);
 const pays=S.payments.filter(p=>p.studentId===MYID()).sort((a,b)=>b.time-a.time);
 const mine=S.complaints.filter(c=>c.authorId===MYID());
 const myB=S.ballots.filter(b=>b.entrants.includes(MYID())).sort((a,b)=>b.created-a.created);
 const bRow=b=>{const h=house(b.houseId),r=room(h,b.roomId),pos=b.order.indexOf(MYID());let st;
  if(b.status==='open')st=chip('Draw '+fmtDate(b.drawAt),'brass');
  else if(b.status==='drawn')st=b.order[b.offerIdx]===MYID()?chip('You won · pay now','ok'):pos>b.offerIdx?chip('Number '+(pos-b.offerIdx+1)+' in line','info'):chip('Offer expired','bad');
  else if(b.status==='filled')st=b.winnerKey&&keyOf(b.winnerKey)&&keyOf(b.winnerKey).studentId===MYID()?chip('Won · secured','ok'):chip('Not selected');
  else if(b.status==='cancelled')st=chip('Tenant renewed');else st=chip('Closed');
  return `<button class="rowi" data-act="push" data-v="house" data-id="${h.id}"><div class="grow"><b>${esc(h.title)}</b><span class="muted small">${esc(r.name)} · ${b.entrants.length} entries</span></div>${st}</button>`;};
 return `${head(esc(stu(MYID()).name)+' · '+esc(S.students[MYID()].dept||''),'My lodge','<div class="btns"><button class="btn sm ghost" data-act="push" data-v="settings">Profile and settings</button><button class="btn sm ghost" data-act="logout">Log out</button></div>')}
 ${act.length?act.map(keySummary).join(''):empty('No lodge yet. Pick a house, inspect it, then pay rent here to get your subscription key.','Find a house','tab','data-t="explore"')}
 ${past.length?`<section class="block"><h2>Past keys</h2><div class="rows">${past.map(k=>{const h=house(k.houseId);return `<button class="rowi" data-act="push" data-v="key" data-code="${k.code}"><div class="grow"><b>${esc(h.title)}</b><span class="muted small">${fmtDate(k.start)} to ${fmtDate(k.end)}</span></div>${chip(k.status==='expired'?'Expired':'Cancelled','bad')}</button>`;}).join('')}</div></section>`:''}
 ${myB.length?`<section class="block"><h2>Ballots</h2><p class="muted small">Winners are drawn at random. A winner has 48 hours to pay, then the room passes to the next name.</p><div class="rows">${myB.map(bRow).join('')}</div></section>`:''}
 <section class="block"><h2>Inspections</h2>${ins.length?`<div class="rows">${ins.map(inspRowStudent).join('')}</div>`:'<p class="muted">No visits booked yet.</p>'}</section>
 <section class="block"><h2>Payment history</h2>${pays.length?`<div class="rows">${pays.map(p=>payRow(p,false)).join('')}</div>`:'<p class="muted">No payments yet.</p>'}</section>
 ${(()=>{const ab=S.complaints.filter(c=>c.kind==='public'&&!c.removed&&c.about==='tenant'&&c.tenantId===MYID());return ab.length?`<section class="block"><h2>Complaints about you</h2><p class="muted small">Posted by a house owner you rented from. Your reply shows under the complaint.</p><div class="stack">${ab.map(c=>complaintCard(c)).join('')}</div></section>`:'';})()}
 ${mine.length?`<section class="block"><h2>Your complaints and disputes</h2><div class="stack">${mine.map(c=>complaintCard(c)).join('')}</div></section>`:''}`;
};
V.key=({code})=>{
 const k=S.keys.find(x=>x.code===code);if(!k)return gone();
 const h=house(k.houseId),r=room(h,k.roomId),p=S.payments.find(x=>x.id===k.payId),active=k.status==='active';
 return `${backRow('Subscription key')}
 <article class="keycard">
  ${keyArt(k.code,'lg')}
  <div class="row-between"><div class="kc-code">${k.code}</div><button class="btn sm ghost" data-act="copy" data-v="${k.code}">Copy</button></div>
  ${active?`<div class="qrwrap"><div class="qrbox" data-qr="${k.code}" role="img" aria-label="QR code for key ${k.code}"></div><p class="small muted">The agent scans this, or types the code, to check your key before handing over the room.</p></div>`:''}
  <div><h2>${esc(h.title)}</h2><p class="muted small">${esc(r.name)} · ${esc(h.address)}</p></div>
  ${active?`${k.start>now()?'<p class="small strong">Time until you move in</p>':''}<div class="cd" data-cd="${k.start>now()?k.start:k.end}" data-full="1">${cdBlocks(k.start>now()?k.start:k.end)}</div>${progress(k)}${priorityPanel(k)}`:chip(k.status==='expired'?'Expired':'Cancelled','bad')}
  <dl class="dl">
   <div><dt>Tenant</dt><dd>${esc(stu(k.studentId).name)}</dd></div>
   <div><dt>Start</dt><dd>${fmtDate(k.start)}</dd></div>
   <div><dt>End</dt><dd>${fmtDate(k.end)}</dd></div>
   <div><dt>Payment reference</dt><dd class="mono">${p?p.ref:'—'}</dd></div>
   <div><dt>Rent paid</dt><dd>${p?fmt(p.amount):'—'}</dd></div>
   <div><dt>Escrow</dt><dd>${p?({held:'Held until move-in',released:'Released to agent',refunded:'Refunded'}[p.status]||'—'):'—'}</dd></div>
   ${k.renewals?`<div><dt>Renewals</dt><dd>${k.renewals}</dd></div>`:''}
  </dl>
  <div class="btns">${p?`<button class="btn sm ghost" data-act="push" data-v="receipt" data-id="${p.id}">${ic('card',16)} Receipt</button>`:''}<button class="btn sm ghost" data-act="push" data-v="agreement" data-code="${k.code}">${ic('list',16)} Tenancy agreement</button></div>
  ${active?`<div class="setting"><div><b>Auto-renew from savings</b><span class="muted">Renews on the end date if your savings cover the rent.</span></div><button class="sw ${k.autoRenew?'on':''}" role="switch" aria-checked="${k.autoRenew}" aria-label="Auto-renew from savings" data-act="autoRenew" data-code="${k.code}"></button></div>
  <div class="btns">${!k.movedIn?`<button class="btn sm brass" data-act="moveIn" data-code="${k.code}">Confirm move-in</button>`:''}<button class="btn sm" data-act="renew" data-code="${k.code}">Renew for ${fmt(r.price)}</button><button class="btn sm ghost" data-act="dispute" data-code="${k.code}">Raise a dispute</button><button class="btn sm ghost" data-act="lodgeComplaint" data-id="${h.id}">Lodge a complaint</button></div>`:''}
 </article>
 <p class="fine">The agent checks this key by its code before handing over the room. In the live app the server decides whether a key is valid; this demo checks it in your browser.</p>`;
};
V.student_saved=()=>{
 const L=S.favs.map(house).filter(h=>h&&!h.deleted);
 return `${head('Favourites','Saved houses')}${L.length?`<div class="grid">${L.map(card).join('')}</div>`:empty('Tap the heart on a listing to save it here.','Explore houses','tab','data-t="explore"')}`;
};
V.student_messages=()=>`${head('In-app messages','Chats')}${threadList(S.threads.filter(t=>t.studentId===MYID()).sort((a,b)=>(b.msgs.length?b.msgs[b.msgs.length-1].t:0)-(a.msgs.length?a.msgs[a.msgs.length-1].t:0)))}`;
V.student_savings=()=>{
 const g=S.savings.goal,bal=savBal(),left=Math.max(0,g.target-bal),pct=Math.min(100,bal/g.target*100);
 const due=new Date(g.due+'T00:00:00+01:00').getTime(),days=Math.max(0,Math.ceil((due-now())/DAY)),locked=g.mode==='locked'&&now()<due;
 const tx=S.savings.txns.slice().sort((a,b)=>b.t-a.t);
 return `${head('Rent savings',esc(g.name))}
 <article class="savecard">
  <div class="sv-top"><div><span class="muted small">Saved so far</span><b class="big-num">${fmt(bal)}</b></div>${g.mode==='locked'?chip(`${ic('lock',13)} ${locked?'Locked until '+fmtDate(due):'Lock ended'}`,'brass'):chip('Flexible','info')}</div>
  <div class="prog lg blue"><i style="width:${pct.toFixed(1)}%"></i></div>
  <div class="sv-stats"><div><b>${fmt(left)}</b><span>left to target</span></div><div><b>${fmt(g.target)}</b><span>target</span></div><div><b>${days}</b><span>days to ${fmtDate(due)}</span></div></div>
  <div class="btns"><button class="btn sm" data-act="deposit">${ic('plus',16)} Add money</button><button class="btn sm ghost" data-act="withdraw">Withdraw</button><button class="btn sm ghost" data-act="goal">Edit goal</button></div>
 </article>
 ${g.sched!=='none'&&g.schedAmt>0?`<p class="note">${ic('clock',16)} <span>Automatic ${g.sched} deposit of ${fmt(g.schedAmt)} from your mobile money wallet. ${g.nextAuto&&g.nextAuto<=due?`Next one on ${fmtDate(g.nextAuto)}.`:'It stopped on your due date.'}</span></p>`:''}
 ${activeKeys().map(k=>{const h=house(k.houseId);return `<div class="setting" style="padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--surface)"><div><b>Auto-renew ${esc(h.title)}</b><span class="muted">Pays the renewal from savings on ${fmtDate(k.end)} if the balance covers it.</span></div><button class="sw ${k.autoRenew?'on':''}" role="switch" aria-checked="${k.autoRenew}" aria-label="Auto-renew ${esc(h.title)} from savings" data-act="autoRenew" data-code="${k.code}"></button></div>`;}).join('')}
 <section class="block"><h2>Withdrawal rules</h2><ul class="rules"><li><b>Flexible:</b> withdraw any amount at any time, no fee.</li><li><b>Locked:</b> withdrawals open on your goal date. You can still use the money for rent before then.</li><li>Savings apply to rent in one tap at checkout or renewal.</li></ul>
  <p class="muted small">Savings are held by a licensed partner institution, not by Lodgely. Partner still to be confirmed.</p></section>
 <section class="block"><h2>History</h2><div class="rows">${tx.map(t=>`<div class="rowi"><div class="grow"><div class="row-between"><b>${{deposit:'Deposit',withdrawal:'Withdrawal',applied:'Used for rent'}[t.type]}</b><b class="num" style="color:var(--${t.type==='deposit'?'ok':'ink'})">${t.type==='deposit'?'+':'−'}${fmt(t.amt)}</b></div><span class="muted small">${esc(t.note||'')} · ${fmtDate(t.t)}</span></div></div>`).join('')}</div></section>`;
};

/* ---------- agent ---------- */
V.agent_home=()=>{
 const a=agent(MYID()),ids=myHAll().map(h=>h.id);
 const ten=S.keys.filter(k=>ids.includes(k.houseId)&&k.status==='active'&&k.start<=now()).sort((x,y)=>x.end-y.end);
 const rp=S.payments.filter(p=>ids.includes(p.houseId)&&p.kind!=='inspection');
 const held=sum(rp.filter(p=>p.status==='held'),p=>p.amount),paid=sum(rp.filter(p=>p.status==='released'),p=>p.amount*(1-COMM));
 const fees=sum(S.payments.filter(p=>p.kind==='inspection'&&p.status==='paid'&&ids.includes(p.houseId)),p=>p.amount*(1-COMM));
 const soon=S.ballots.filter(b=>ids.includes(b.houseId)&&(b.status==='open'||b.status==='drawn'));
 const visits=S.inspections.filter(i=>ids.includes(i.houseId)&&i.status==='booked').sort((x,y)=>x.slot-y.slot);
 const hr=new Date(now()+WAT).getUTCHours(),greet=hr<12?'Good morning':hr<17?'Good afternoon':'Good evening';
 return `${head(esc(a.biz),`${greet}, ${a.name.split(' ')[0]}`,`<div class="chips">${verBadge(a)}${chip('Trust score '+a.trust)}${chip('★ '+a.rating.toFixed(1),'brass')}</div>`)}
 <div class="stats four">${stat(fmt(fees),'Inspection fees earned')}${stat(fmt(paid),'Rent paid out to you')}${stat(fmt(held),'Rent held until move-in')}${stat(visits.length,'Visits booked')}</div>
 <div class="btns"><button class="btn sm ghost" data-act="push" data-v="payouts">${ic('wallet',16)} See payouts</button></div>
 ${soon.length?`<section class="block"><h2>Opening in the next 60 days</h2><div class="rows">${soon.map(b=>{const h=house(b.houseId),r=room(h,b.roomId),k=keyOf(b.keyCode);return `<button class="rowi" data-act="push" data-v="ahouse" data-id="${h.id}"><div class="grow"><div class="row-between"><b>${esc(h.title)} · ${esc(r.name)}</b>${b.status==='open'?chip(b.entrants.length+' in ballot','brass'):chip('Drawn','info')}</div><span class="muted small">Frees up ${k?fmtDate(k.end):'soon'} · ${b.status==='open'?(k&&k.notRenewing?'tenant not renewing, draw '+fmtDate(b.drawAt):'tenant can still renew'):esc(stu(b.order[b.offerIdx]).name)+' is paying'}</span></div></button>`;}).join('')}</div></section>`:''}
 <section class="block"><h2>Active tenants <span class="count-pill">${ten.length}</span></h2>${ten.length?`<div class="rows">${ten.map(k=>{const h=house(k.houseId),r=room(h,k.roomId),p=S.payments.find(x=>x.id===k.payId);return `<div class="rowi"><div class="avatar sm">${initials(stu(k.studentId).name)}</div><div class="grow"><div class="row-between"><b>${esc(stu(k.studentId).name)}</b>${p&&p.status==='held'?chip('Awaiting move-in','warn'):chip('Moved in','ok')}</div><span class="muted small">${esc(h.title)} · ${esc(r.name)}</span><span class="mono small">${ic('clock',13)} <span data-cd="${k.end}">${cdText(k.end).str}</span> left</span></div></div>`;}).join('')}</div>`:'<p class="muted">No active tenants yet.</p>'}</section>
 <section class="block"><div class="row-between"><h2>Upcoming visits</h2><button class="link" data-act="tab" data-t="inspections">All visits</button></div>${visits.length?`<div class="rows">${visits.slice(0,3).map(agentInspRow).join('')}</div>`:'<p class="muted">No visits booked.</p>'}</section>
 <p class="note">${ic('card',16)} <span>${a.payout&&a.payout!=='Not added'?`Payouts go to ${esc(a.payout)}.`:'Add a payout account under Account so we can pay you.'} You keep ${100-COMM*100}% of every ${fmt(FEE)} inspection fee as soon as a visit is booked, and ${100-COMM*100}% of rent once the tenant moves in. If you cancel a visit, the student gets the fee back.</span></p>`;
};
function agentInspRow(i){
 const h=house(i.houseId);
 return `<div class="rowi"><div class="grow"><div class="row-between"><b>${esc(stu(i.studentId).name)}</b>${inspChip(i)}</div><span class="muted small">${esc(h.title)} · ${fmtSlot(i.slot)}</span>
  ${i.status==='booked'?`<span class="doorcode">Door code <b class="mono">${i.code}</b> · ${fmt(i.fee*(1-COMM))} to you</span><div class="btns" style="margin-top:4px">${i.slot-now()<=36e5?`<button class="btn sm" data-act="completeInsp" data-id="${i.id}">Mark visit done</button>`:''}${visitWhen(i).over?`<button class="btn sm ghost" data-act="markMissed" data-id="${i.id}">Student didn't come</button>`:`<button class="btn sm ghost danger-t" data-act="cancelInsp" data-id="${i.id}">Cancel</button>`}</div>`:''}${i.status==='noshow'?`<span class="small" style="color:var(--bad)">The student reported you didn't show up. This lowers your trust score.</span>`:''}</div></div>`;
}
V.agent_listings=()=>{
 const hs=myH().sort((a,b)=>(b.created||0)-(a.created||0));
 return `${head('Oladipo Properties','My listings','<div class="btns"><button class="btn sm" data-act="push" data-v="newlisting">'+ic('plus',16)+' New listing</button></div>')}
 <div class="grid">${hs.map(h=>{const free=openRooms(h).length,taken=h.rooms.filter(r=>roomState(r)==='taken').length;return `<button class="lcard" data-act="push" data-v="ahouse" data-id="${h.id}">${art(h)}<div><b>${esc(h.title)}</b><span class="muted small">${esc(h.area)} · ${h.rooms.length} room${h.rooms.length>1?'s':''}</span><div class="chips">${modChip(h)}${h.paused?chip('Paused'):''}${chip(free+' free','ok')}${taken?chip(taken+' taken','bad'):''}</div></div></button>`;}).join('')}</div>`;
};
V.ahouse=({id})=>{
 const h=house(id);if(!h)return gone();
 return `${backRow('Listing')}
 <div class="ah-head">${art(h)}<div><p class="eyebrow">${esc(h.area)} · ${esc(h.type)}</p><h1>${esc(h.title)}</h1><div class="chips">${modChip(h)}${h.paused?chip('Paused'):''}</div></div></div>
 <div class="btns"><button class="btn sm" data-act="editListing" data-id="${h.id}">Edit listing</button><button class="btn sm ghost" data-act="pauseListing" data-id="${h.id}">${h.paused?'Resume listing':'Pause listing'}</button><button class="btn sm ghost danger-t" data-act="deleteListing" data-id="${h.id}">Delete</button></div>
 ${h.mod==='pending'?`<p class="note warn-t">${ic('clock',16)} <span>Students cannot see this listing until an admin approves it.</span></p>`:''}
 ${h.mod==='rejected'?`<p class="note warn-t">${ic('alert',16)} <span>Admin did not approve this listing. Edit it and save to send it for review again.</span></p>`:''}
 ${h.mod==='removed'?`<p class="note warn-t">${ic('alert',16)} <span>Lodgely took this listing down: ${esc(h.removedReason||'')}${h.removedNote?'. '+esc(h.removedNote):''}. Current tenants are not affected. Contact support to appeal.</span></p>`:''}
 ${h.paused?`<p class="note">${ic('clock',16)} <span>Paused. Students can't find or book this house. Current tenants and their keys are not affected.</span></p>`:''}
 <section class="block"><h2>Details</h2><dl class="dl"><div><dt>Address</dt><dd>${esc(h.address)}</dd></div><div><dt>To OAU main gate</dt><dd>${h.km} km · ${travel(h).label}</dd></div><div><dt>Bathrooms</dt><dd>${h.baths||1}</dd></div><div><dt>Available</dt><dd>${h.availFrom&&new Date(h.availFrom+'T00:00:00+01:00').getTime()>now()?'From '+fmtDate(new Date(h.availFrom+'T00:00:00+01:00')):'Now'}</dd></div><div><dt>Amenities</dt><dd>${h.amenities.length?esc(h.amenities.join(', ')):'None listed'}</dd></div></dl></section>
 <section class="block"><h2>Rooms</h2><ul class="rooms">${h.rooms.map(r=>{const ten=r.occ.map(c=>S.keys.find(k=>k.code===c)).filter(Boolean);
  return `<li class="room"><div class="room-main"><b>${esc(r.name)}</b><span class="muted small">${fmt(r.price)} a year${r.cap>1?` per person · ${Math.min(r.cap,curKeys(r).length)} of ${r.cap} taken`:''}</span>${ten.map(k=>k.start>now()?`<span class="small">${ic('key',13)} Next: ${esc(stu(k.studentId).name)} moves in ${fmtDate(k.start)} · <button class="link small" data-act="push" data-v="agreement" data-code="${k.code}">Agreement</button></span>`:`<span class="small">${ic('key',13)} ${esc(stu(k.studentId).name)} · <span class="mono" data-cd="${k.end}">${cdText(k.end).str}</span> · <button class="link small" data-act="push" data-v="agreement" data-code="${k.code}">Agreement</button></span>`).join('')}${holdActive(r)?`<span class="small" style="color:var(--warn)">${esc(stu(r.payHold.by).name)} is paying now · held until ${new Date(r.payHold.until).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</span>`:''}${ballotsOf(r).map(b=>ballotLine(h,r,b)).join('')}</div>
  <div class="room-side">${h.shared?`<span class="stepper" role="group" aria-label="Spaces in ${esc(r.name)}"><button data-act="cap" data-h="${h.id}" data-r="${r.id}" data-d="-1" aria-label="Fewer spaces">−</button><span>${r.cap} space${r.cap>1?'s':''}</span><button data-act="cap" data-h="${h.id}" data-r="${r.id}" data-d="1" aria-label="More spaces">+</button></span>`:''}${roomChip(r)}${(r.occ.length<r.cap||r.paused)?`<button class="btn sm ghost" data-act="pauseRoom" data-h="${h.id}" data-r="${r.id}">${r.paused?'Resume':'Pause'}</button>`:''}</div></li>`;}).join('')}</ul></section>
 <section class="block"><div class="setting"><div><b>Allow shared rooms</b><span class="muted">Roommates split a room and each pays their own share.</span></div><button class="sw ${h.shared?'on':''}" role="switch" aria-checked="${h.shared}" aria-label="Allow shared rooms" data-act="toggleShared" data-id="${h.id}"></button></div></section>
 <section class="block"><div class="row-between"><h2>Inspection times</h2><button class="btn sm ghost" data-act="editListing" data-id="${h.id}" data-focus="times">Change</button></div><p class="small strong">${daysLabel(h.days||[1,2,3,4,5,6])}</p><div class="chips">${h.times.map(t=>chip(t12(t))).join('')}</div><p class="muted small">Students pick from these days and times over the next two weeks. Lodgely sets the inspection fee at ${fmt(FEE)} for every agent, and you keep ${fmt(FEE*(1-COMM))} of each one.</p></section>`;
};
function ledger(){
 const ids=myHAll().map(h=>h.id);
 return S.payments.filter(p=>ids.includes(p.houseId)).map(p=>{
  const h=house(p.houseId),r=p.roomId?room(h,p.roomId):null,k=S.keys.find(x=>x.payId===p.id),gross=p.amount,comm=Math.round(gross*COMM);
  const st=p.status==='refunded'?'refunded':p.status==='held'?'held':'paid';
  const when=st==='held'?(k?k.start:p.time)+7*DAY:st==='paid'?(p.releasedAt||p.time):p.time;
  return {p,h,r,gross,comm,net:gross-comm,st,when,label:{inspection:'Inspection fee',rent:'Rent',renewal:'Renewal'}[p.kind]};
 }).sort((a,b)=>b.when-a.when);
}
V.payouts=()=>{
 const a=agent(MYID()),L=ledger(),f=S.payF2||'all',F=L.filter(x=>f==='all'||x.st===f);
 const paid=sum(L.filter(x=>x.st==='paid'),x=>x.net),held=sum(L.filter(x=>x.st==='held'),x=>x.net),comm=sum(L.filter(x=>x.st==='paid'),x=>x.comm);
 return `${backRow('Earnings')}
 ${head(esc(a.biz),'Payouts')}
 <div class="stats three">${stat(fmt(paid),'Paid out to you')}${stat(fmt(held),'Waiting for move-in')}${stat(fmt(comm),'Lodgely commission so far')}</div>
 <div class="setting" style="padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--surface)"><div><b>${esc(a.payout)}</b><span class="muted">${a.payoutName?esc(a.payoutName)+' · ':''}Money is sent here the day it's released.</span></div><button class="btn sm ghost" data-act="payoutForm">${a.payout==='Not added'?'Add account':'Change'}</button></div>
 <div class="amen">${[['all','All'],['paid','Paid out'],['held','Waiting for move-in'],['refunded','Refunded']].map(([k,l])=>`<button class="tog ${f===k?'on':''}" data-act="payF2" data-f="${k}">${l}</button>`).join('')}</div>
 ${F.length?`<div class="rows">${F.map(x=>`<div class="rowi"><div class="grow">
  <div class="row-between"><b>${x.label} · ${esc(x.h.title)}</b><b class="num">${x.st==='refunded'?'₦0':fmt(x.net)}</b></div>
  <span class="muted small">${x.r?esc(x.r.name)+' · ':''}${esc(stu(x.p.studentId).name)} · ${x.st==='held'?'Expected '+fmtDate(x.when):fmtDate(x.when)}</span>
  <div class="row-between"><span class="small muted num">${fmt(x.gross)} less ${fmt(x.comm)} commission</span>${{paid:chip('Paid out','ok'),held:chip('Waiting for move-in','warn'),refunded:chip('Refunded to student')}[x.st]}</div>
  <span class="mono small muted">${x.p.ref}</span></div></div>`).join('')}</div>`:'<p class="muted">Nothing here yet.</p>'}
 <p class="muted small">Inspection fees are paid out as soon as a student books. Rent is paid out when the tenant confirms move-in, or 7 days after they pay.</p>`;
};
function newDraft(){return {title:'',area:'Damico',address:'',type:'Self-contain',km:'1.5',desc:'',am:{},rules:'',shared:false,rooms:[{name:'Room 1',price:'250000',cap:'1'}],times:{'10:00':true,'16:00':true},days:{1:true,2:true,3:true,4:true,5:true,6:true},baths:'1',avail:isoDate(now()),photos:[],err:''};}
function draftFromHouse(h){
 return {editId:h.id,title:h.title,area:h.area,address:h.address.replace(/,\s*Ile-Ife$/,''),type:h.type,km:String(h.km),desc:h.desc,
  am:Object.fromEntries(h.amenities.map(a=>[a,true])),rules:h.rules.join('\n'),shared:!!h.shared,
  rooms:h.rooms.map(r=>({id:r.id,name:r.name,price:String(r.price),cap:String(r.cap),locked:r.occ.length>0||!!r.hold||ballotsOf(r).length>0})),
  times:Object.fromEntries((h.times||[]).map(t=>[t,true])),days:Object.fromEntries((h.days||[1,2,3,4,5,6]).map(d=>[d,true])),
  baths:String(h.baths||1),avail:h.availFrom||isoDate(now()),photos:(h.photos||[]).slice(),err:''};
}
const DRAFT_AM=['Borehole water','Well and tank','Prepaid meter','Night guard','Fenced compound','Solar backup','Wi-Fi','Furnished','Kitchenette'];
const DRAFT_TIMES=['09:00','10:00','12:00','14:00','16:00','17:30'];
V.newlisting=()=>{
 const d=S.draft||(S.draft=newDraft()),ed=d.editId?house(d.editId):null;
 const amList=[...new Set([...DRAFT_AM,...Object.keys(d.am)])],tList=[...new Set([...DRAFT_TIMES,...Object.keys(d.times)])].sort();
 return `${backRow(ed?'Edit listing':'New listing')}
 ${ed?head(esc(ed.area),'Edit '+esc(ed.title),`<p class="muted">${ed.mod==='live'?'Changes show to students as soon as you save.':ed.mod==='rejected'?'Saving sends this listing to admin for review again.':'This listing is waiting for admin review.'}</p>`):head('New listing','Add a house','<p class="muted">Your listing goes to admin for review before students can see it.</p>')}
 <form class="form" data-form="listing" novalidate>
  <div class="field"><label for="nl-title">House name</label><input id="nl-title" class="in" value="${esc(d.title)}" data-bind="draft.title" placeholder="e.g. Sunrise Lodge"></div>
  <div class="grid2">${sel('nl-area','draft.area',AREA_NAMES,'Area','none')}${sel('nl-type','draft.type',['Single room','Self-contain','Room & parlour','Flat'],'Main type','none')}</div>
  <div class="grid2"><div class="field"><label for="nl-addr">Street address</label><input id="nl-addr" class="in" value="${esc(d.address)}" data-bind="draft.address" placeholder="House number and street"></div><div class="field"><label for="nl-km">Km to OAU gate</label><input id="nl-km" class="in" inputmode="decimal" value="${esc(d.km)}" data-bind="draft.km"></div></div>
  <div class="field"><label for="nl-desc">Description</label><textarea id="nl-desc" class="in" rows="3" data-bind="draft.desc" placeholder="What students should know">${esc(d.desc)}</textarea></div>
  <div class="grid2"><div class="field"><label for="nl-baths">Bathrooms in the house</label><input id="nl-baths" class="in" inputmode="numeric" value="${esc(d.baths)}" data-bind="draft.baths"></div><div class="field"><label for="nl-avail">Available from</label><input id="nl-avail" class="in" type="date" value="${esc(d.avail)}" data-bind="draft.avail"></div></div>
  <div class="field"><span class="lbl">Amenities</span><div class="checks">${amList.map((a,i)=>`<label><input type="checkbox" id="nl-am-${i}" data-bind="draft.am.${a}" ${d.am[a]?'checked':''}>${esc(a)}</label>`).join('')}</div></div>
  <div class="field"><label for="nl-rules">House rules (one per line)</label><textarea id="nl-rules" class="in" rows="3" data-bind="draft.rules">${esc(d.rules)}</textarea></div>
  <div class="setting"><div><b>Allow shared rooms</b><span class="muted">Lets you set more than one space per room.</span></div><button type="button" class="sw ${d.shared?'on':''}" role="switch" aria-checked="${d.shared}" aria-label="Allow shared rooms" data-act="draftShared"></button></div>
  <div class="field"><span class="lbl">Rooms (each is rented, paid and timed separately)</span>
   ${d.rooms.map((r,i)=>`<div class="room-edit ${d.shared?'cap':''}"><div class="field"><label for="nl-r${i}n">Room name</label><input id="nl-r${i}n" class="in" value="${esc(r.name)}" data-bind="draft.rooms.${i}.name"></div><div class="field"><label for="nl-r${i}p">Price / year (₦)</label><input id="nl-r${i}p" class="in" inputmode="numeric" value="${esc(r.price)}" data-bind="draft.rooms.${i}.price"></div>${d.shared?`<div class="field"><label for="nl-r${i}c">Spaces</label><input id="nl-r${i}c" class="in" inputmode="numeric" value="${esc(r.cap)}" data-bind="draft.rooms.${i}.cap"></div>`:''}<button type="button" class="iconbtn plain" data-act="delRoom" data-i="${i}" aria-label="${r.locked?'This room has tenants or a ballot, so it cannot be removed':'Remove room'}" title="${r.locked?'Has tenants or a ballot':'Remove room'}" ${d.rooms.length<2||r.locked?'disabled':''}>${ic('x',18)}</button></div>`).join('')}
   ${ed?`<p class="muted small">Rooms with tenants or a running ballot can't be removed. New prices apply to new tenants and renewals.</p>`:''}
   <div><button type="button" class="btn sm ghost" data-act="addRoom">${ic('plus',16)} Add room</button></div></div>
  <div class="field" id="nl-visits"><span class="lbl">Inspection days</span><div class="checks">${WEEKDAYS.map(([n,l])=>`<label><input type="checkbox" id="nl-d${n}" data-bind="draft.days.${n}" ${d.days[n]?'checked':''}>${l}</label>`).join('')}</div></div>
  <div class="field"><span class="lbl">Inspection times</span><div class="checks">${tList.map((t,i)=>`<label><input type="checkbox" id="nl-t${i}" data-bind="draft.times.${t}" ${d.times[t]?'checked':''}>${t12(t)}</label>`).join('')}</div></div>
  <div class="field"><label for="nl-photos">Photos (up to 3, compressed for slow connections)</label><input id="nl-photos" class="in" type="file" accept="image/*" multiple>
   ${d.photos.length?`<div class="photos">${d.photos.map(p=>`<figure><img src="${p}" alt=""><figcaption>${Math.round(p.length*.75/1024)} KB</figcaption></figure>`).join('')}</div><div><button type="button" class="btn sm ghost danger-t" data-act="clearPhotos">Remove photos</button></div>`:''}</div>
  ${d.err?`<p class="err">${esc(d.err)}</p>`:''}
  <button type="button" class="btn block" data-act="submitListing">${ed?'Save changes':'Send for review'}</button>
 </form>`;
};
V.agent_inspections=()=>{
 const ids=myH().map(h=>h.id);
 const L=S.inspections.filter(i=>ids.includes(i.houseId)).sort((a,b)=>((a.status==='booked'?0:1)-(b.status==='booked'?0:1))||(a.status==='booked'?a.slot-b.slot:b.slot-a.slot));
 return `${head('Inspections','Visits')}
 <p class="note">${ic('clock',16)} <span>Students get reminders 24 hours and 1 hour before. Show the door code when they arrive. Entering it confirms the visit and unlocks rent payment.</span></p>
 ${L.length?`<div class="rows">${L.map(agentInspRow).join('')}</div>`:empty('No visits yet.')}`;
};
V.agent_messages=()=>`${head('In-app messages','Chats')}${threadList(S.threads.filter(t=>t.agentId===MYID()).sort((a,b)=>(b.msgs.length?b.msgs[b.msgs.length-1].t:0)-(a.msgs.length?a.msgs[a.msgs.length-1].t:0)))}`;
function vkResult(){
 if(!S.vk)return '';
 const q=S.vk.q,k=S.keys.find(x=>x.code===q);
 if(!k)return `<div class="vk-res bad"><b>${ic('alert',16)} No key with this code</b><p>Do not hand over the room. Ask the student to open the key in their Lodgely app.</p></div>`;
 const h=house(k.houseId),r=room(h,k.roomId);
 if(h.agentId!==MYID())return `<div class="vk-res warn"><b>This key is for another agent's house</b><p>${esc(h.title)}.</p></div>`;
 if(k.status!=='active')return `<div class="vk-res warn"><b>Key ${k.status}</b><p>${esc(stu(k.studentId).name)} · ${esc(h.title)}, ${esc(r.name)}. Ended ${fmtDate(k.end)}.</p></div>`;
 return `<div class="vk-res ok"><b>${ic('check',16)} Valid key</b><p>${esc(stu(k.studentId).name)} · ${esc(h.title)}, ${esc(r.name)}</p><p>${fmtDate(k.start)} to ${fmtDate(k.end)} · <span class="mono" data-cd="${k.end}">${cdText(k.end).str}</span> left</p></div>`;
}
V.agent_more=()=>{
 const a=agent(MYID()),ids=myH().map(h=>h.id);
 const about=S.complaints.filter(c=>c.kind==='public'&&!c.removed&&c.about!=='tenant'&&(c.agentId===MYID()||ids.includes(c.houseId)));
 const mine=S.complaints.filter(c=>c.authorId===MYID());
 const sample=S.keys.find(k=>ids.includes(k.houseId)&&k.status==='active');
 return `${head('Account',esc(a.name),`<div class="chips">${verBadge(a)}</div><div class="btns"><button class="btn sm ghost" data-act="push" data-v="settings">Profile and settings</button><button class="btn sm ghost" data-act="page" data-p="help">Help centre</button></div>`)}
 <section class="block"><h2>Verification</h2><ul class="steps-v"><li>${ic('check',18)} ID document uploaded</li><li>${ic('check',18)} Phone ${esc(a.phone)} confirmed</li><li>${ic('check',18)} Proof of authority to let</li><li>${ic('check',18)} Approved by Lodgely admin</li></ul></section>
 <section class="block"><div class="row-between"><h2>Payouts</h2><div class="btns"><button class="btn sm ghost" data-act="payoutForm">${a.payout==='Not added'?'Add account':'Change account'}</button><button class="btn sm" data-act="push" data-v="payouts">See payouts</button></div></div><div class="dl"><div><dt>Account</dt><dd>${esc(a.payout)}</dd></div><div><dt>Commission</dt><dd>${COMM*100}% of rent and inspection fees</dd></div><div><dt>Paid out when</dt><dd>Tenant confirms move-in, or 7 days after payment</dd></div></div></section>
 <section class="block"><h2>Verify a subscription key</h2><p class="muted small">Ask the student for their key code before you hand over the room.</p>
  <div class="vk"><input id="vk" class="in mono" placeholder="LDG-XXXX-XXXX-XXXX" aria-label="Key code" value="${esc(S.vk?S.vk.q:'')}" autocapitalize="characters" data-enter="verifyKey"><button class="btn" data-act="verifyKey">Check</button></div>
  <div class="btns"><label class="btn sm ghost" for="vk-scan">${ic('qr',16)} Scan the QR code</label><input id="vk-scan" type="file" accept="image/*" capture="environment" class="sr"></div>
  ${DEMO&&sample?`<p class="hint">Demo: try <button class="link mono" data-act="fillKey" data-v="${sample.code}">${sample.code}</button></p>`:''}
  ${vkResult()}</section>
 <section class="block"><h2>Complaints about your houses <span class="count-pill">${about.length}</span></h2>${about.length?about.map(c=>complaintCard(c,'agent')).join(''):'<p class="muted">None.</p>'}</section>
 <section class="block"><div class="row-between"><h2>Complaints you posted</h2><button class="btn sm ghost" data-act="tcomplaint">${ic('flag',15)} About a tenant</button></div>${mine.length?mine.map(c=>complaintCard(c)).join(''):'<p class="muted">You have not posted any complaints.</p>'}</section>`;
};

/* ---------- admin ---------- */
V.admin_overview=()=>{
 const ag=Object.values(S.agents),live=S.houses.filter(isLive);
 const spaces=sum(live,h=>sum(h.rooms,r=>r.cap)),let_=sum(live,h=>sum(h.rooms,r=>Math.min(r.cap,curKeys(r).length)));
 const held=sum(S.payments.filter(p=>p.status==='held'),p=>p.amount);
 const comm=sum(S.payments.filter(p=>p.kind!=='inspection'&&p.status==='released'),p=>p.amount*COMM);
 const fees=sum(S.payments.filter(p=>p.kind==='inspection'&&p.status==='paid'),p=>p.amount*COMM);
 const bl=S.ballots.filter(b=>b.status==='open'||b.status==='drawn');
 const pendA=ag.filter(a=>a.status==='pending').length,pendL=S.houses.filter(h=>h.mod==='pending').length,openC=S.complaints.filter(c=>!c.removed&&c.status!=='resolved').length;
 const by={};live.forEach(h=>{const a=by[h.area]||(by[h.area]={t:0,n:0});h.rooms.forEach(r=>{a.t+=r.cap;a.n+=Math.min(r.cap,curKeys(r).length);});});
 const q=[];
 if(pendA)q.push(`<button class="qitem" data-act="tab" data-t="users">${ic('shield',18)}<span>${pendA} agent${pendA>1?'s':''} waiting for verification</span>${ic('back',16).replace('M15 5l-7 7 7 7','M9 5l7 7-7 7')}</button>`);
 if(pendL)q.push(`<button class="qitem" data-act="tab" data-t="listings">${ic('home',18)}<span>${pendL} listing${pendL>1?'s':''} waiting for review</span>${ic('back',16).replace('M15 5l-7 7 7 7','M9 5l7 7-7 7')}</button>`);
 if(openC)q.push(`<button class="qitem" data-act="tab" data-t="complaints">${ic('flag',18)}<span>${openC} complaint${openC>1?'s':''} or dispute${openC>1?'s':''} open</span>${ic('back',16).replace('M15 5l-7 7 7 7','M9 5l7 7-7 7')}</button>`);
 return `${head('Lodgely admin','Overview')}
 ${q.length?`<div class="queue">${q.join('')}</div>`:''}
 <div class="stats three">${stat(Object.keys(S.students).length,'Students')}${stat(ag.filter(a=>a.status==='verified').length+' / '+ag.length,'Verified agents')}${stat(live.length,'Live listings')}${stat(let_+' / '+spaces,'Spaces let')}${stat(fmt(held),'Held in escrow')}${stat(fmt(comm+fees),'Platform revenue')}</div>
 <p class="muted small">Revenue is ${fmt(comm)} commission on released rent plus ${fmt(fees)}, the ${COMM*100}% share of inspection fees. Agents keep the rest of each fee.</p>
 <section class="block"><h2>Ballots <span class="count-pill">${bl.length}</span></h2>${bl.length?`<div class="rows">${bl.map(b=>{const h=house(b.houseId),r=room(h,b.roomId);return `<div class="rowi"><div class="grow"><div class="row-between"><b>${esc(h.title)} · ${esc(r.name)}</b>${b.status==='open'?chip('Open','brass'):chip('Drawn','info')}</div><span class="muted small">${b.entrants.length} entries · ${b.status==='open'?'draw '+fmtDate(b.drawAt):'offered to '+esc(stu(b.order[b.offerIdx]).name)+' until '+fmtSlot(b.offerAt+48*36e5)}</span><div class="btns" style="margin-top:6px">${b.status==='open'?`<button class="btn sm ghost" data-act="runDraw" data-id="${b.id}">Run draw now</button>`:`<button class="btn sm ghost" data-act="passBallot" data-id="${b.id}">Winner didn't pay, offer to next</button>`}</div></div></div>`;}).join('')}</div>`:'<p class="muted">No ballots running.</p>'}</section>
 <section class="block"><h2>Spaces let by area</h2><div class="bars">${Object.entries(by).map(([k,v])=>`<div class="bar-row"><span>${k}</span><div class="bar"><i style="width:${(v.n/v.t*100).toFixed(0)}%"></i></div><b class="num">${v.n}/${v.t}</b></div>`).join('')}</div></section>
 <section class="block"><h2>Look up a key</h2><p class="muted small">Check any subscription key, for example when a student and an agent disagree about a room.</p>
  <div class="vk"><input id="akq" class="in mono" placeholder="LDG-XXXX-XXXX-XXXX" aria-label="Key code" value="${esc(S.akq||'')}" autocapitalize="characters" data-enter="adminKey"><button class="btn" data-act="adminKey">Look up</button></div>
  ${(()=>{const k=S.keys.find(x=>x.status==='active');return DEMO&&k?`<p class="hint">Demo: try <button class="link mono" data-act="adminKeyFill" data-v="${k.code}">${k.code}</button></p>`:'';})()}
  ${S.akq?adminKeyResult(S.akq):''}</section>
 ${(()=>{const wl=SCHOOLS.filter(s=>!s.live).map(s=>({s,n:(S.waitSeed[s.id]||0)+S.waitlist.filter(w=>w.school===s.id).length})).sort((a,b)=>b.n-a.n),mx=Math.max(1,...wl.map(x=>x.n));
  return `<section class="block"><h2>Waitlist demand</h2><p class="muted small">Students and agents asking for Lodgely at other schools. Use it to pick the next campus.</p><div class="bars">${wl.map(x=>`<div class="bar-row"><span>${x.s.code}</span><div class="bar"><i style="width:${(x.n/mx*100).toFixed(0)}%"></i></div><b class="num">${x.n}</b></div>`).join('')}</div></section>`;})()}
 <section class="block"><div class="row-between"><h2>Latest payments</h2><button class="link" data-act="tab" data-t="payments">All payments</button></div><div class="rows">${S.payments.slice().sort((a,b)=>b.time-a.time).slice(0,4).map(p=>payRow(p,true)).join('')}</div></section>`;
};
function pendingListingCard(h){const a=agent(h.agentId);return `<div class="comp"><div class="sum-h">${art(h,'art thumb')}<div><b>${esc(h.title)}</b><span class="muted small">${esc(h.area)} · by ${esc(a.name)} · ${h.rooms.length} rooms from ${fmtK(Math.min(...h.rooms.map(r=>r.price)))}</span></div></div><p class="small">${esc(h.desc)}</p>${a.status!=='verified'?`<p class="note warn-t">${ic('alert',16)} <span>Agent not verified yet. The listing stays hidden until the agent is approved too.</span></p>`:''}<div class="btns"><button class="btn sm" data-act="approveListing" data-id="${h.id}">Approve listing</button><button class="btn sm ghost danger-t" data-act="rejectListing" data-id="${h.id}">Reject</button></div></div>`;}
function pendingAgentCard(a){return `<div class="comp"><div class="comp-h"><div><b>${esc(a.name)}</b><span class="muted small">${esc(a.biz)} · applied ${a.since}</span></div>${chip('Pending','warn')}</div><ul class="steps-v">${(a.docs||[]).map(x=>`<li>${ic('check',18)} ${esc(x)}</li>`).join('')}</ul>${(a.docFiles||[]).length&&!DEMO?`<div class="btns">${a.docFiles.map((f,i)=>`<button class="btn sm ghost" data-act="viewDoc" data-path="${esc(f)}">Open document ${i+1}</button>`).join('')}</div>`:''}<div class="btns"><button class="btn sm" data-act="approveAgent" data-id="${a.id}">Approve and verify</button><button class="btn sm ghost danger-t" data-act="rejectAgent" data-id="${a.id}">Reject</button></div></div>`;}
function adminListHTML(){
 const f=S.lstF||'live',q=(S.lstQ||'').trim().toLowerCase();
 const L=S.houses.filter(h=>!h.deleted&&h.mod===f).filter(h=>!q||(h.title+' '+h.area+' '+agent(h.agentId).name).toLowerCase().includes(q));
 if(!L.length)return '<p class="muted">No listings here.</p>';
 return L.map(h=>{
  const a=agent(h.agentId),free=openRooms(h).length,comps=S.complaints.filter(c=>c.houseId===h.id&&!c.removed&&c.kind==='public'&&c.about!=='tenant').length,mm=S.complaints.filter(c=>c.houseId===h.id&&c.kind==='mismatch').length,flags=S.threads.filter(t=>t.houseId===h.id&&t.msgs.some(m=>m.flag)).length;
  return `<div class="comp"><div class="sum-h">${art(h,'art thumb')}<div><b>${esc(h.title)}</b><span class="muted small">${esc(h.area)} · ${esc(a.name)}${a.status==='suspended'?' (suspended)':''} · ${h.rooms.length} room${h.rooms.length>1?'s':''}, ${free} free</span></div></div>
   <div class="chips">${modChip(h)}${h.paused?chip('Paused by agent'):''}${comps?chip(comps+' complaint'+(comps>1?'s':''),'warn'):''}${mm?chip(mm+' mismatch report'+(mm>1?'s':''),'bad'):''}${flags?chip(flags+' flagged chat'+(flags>1?'s':''),'bad'):''}</div>
   ${h.mod==='removed'?`<p class="small"><b>Reason:</b> ${esc(h.removedReason||'')}${h.removedNote?' · '+esc(h.removedNote):''}${h.removedAt?' · '+fmtDate(h.removedAt):''}</p>`:''}
   <div class="btns">${h.mod==='live'?`<button class="btn sm ghost danger-t" data-act="takeDown" data-id="${h.id}">Take down</button>`:h.mod==='removed'?`<button class="btn sm ghost" data-act="restoreListing" data-id="${h.id}">Put back live</button>`:''}</div></div>`;
 }).join('');
}
V.admin_listings=()=>{
 const pl=S.houses.filter(h=>h.mod==='pending'&&!h.deleted),f=S.lstF||'live',cnt=k=>S.houses.filter(h=>!h.deleted&&h.mod===k).length;
 return `${head('Trust and safety','Listings')}
 <section class="stack"><h2>Waiting for review <span class="count-pill">${pl.length}</span></h2>${pl.length?pl.map(pendingListingCard).join(''):'<p class="muted">No listings waiting.</p>'}</section>
 <section class="block"><h2>All listings</h2>
  <label class="search">${ic('search',18)}<input id="lst-q" type="search" placeholder="House, area or agent" aria-label="Search listings" value="${esc(S.lstQ||'')}" data-bind="lstQ" data-live="adminList" autocomplete="off"></label>
  <div class="amen">${[['live','Live'],['removed','Taken down'],['rejected','Rejected']].map(([k,l])=>`<button class="tog ${f===k?'on':''}" data-act="lstF" data-f="${k}">${l} (${cnt(k)})</button>`).join('')}</div>
  <div id="admin-list" class="stack">${adminListHTML()}</div></section>`;
};
function allUsers(){
 const st=Object.entries(S.students).map(([id,s])=>({id,kind:'student',name:s.name,sub:s.dept,status:s.suspended?'suspended':'active',reason:s.suspendReason,
  info:`${S.keys.filter(k=>k.studentId===id&&k.status==='active').length} active key${S.keys.filter(k=>k.studentId===id&&k.status==='active').length===1?'':'s'} · ${(n=>n+' visit'+(n===1?'':'s'))(S.inspections.filter(i=>i.studentId===id).length)}`,
  flags:S.threads.filter(t=>t.studentId===id&&t.reported&&t.reportedBy==='agent').length+S.complaints.filter(c=>c.tenantId===id&&!c.removed).length}));
 const ag=Object.values(S.agents).filter(a=>a.status!=='pending').map(a=>({id:a.id,kind:'agent',name:a.name,sub:a.biz,status:a.status==='verified'?'active':a.status,reason:a.suspendReason,
  info:`${S.houses.filter(h=>h.agentId===a.id&&!h.deleted).length} listings · trust ${a.trust||'new'}${a.noShows?` · ${a.noShows} no-show${a.noShows>1?'s':''}`:''}`,
  flags:S.threads.filter(t=>t.agentId===a.id&&t.reported&&t.reportedBy==='student').length+S.complaints.filter(c=>c.agentId===a.id&&c.about!=='tenant'&&!c.removed&&c.kind==='public').length+(a.noShows||0)}));
 return ag.concat(st);
}
function userListHTML(){
 const f=S.usrF||'all',q=(S.usrQ||'').trim().toLowerCase();
 const L=allUsers().filter(u=>f==='all'||(f==='suspended'?u.status==='suspended':u.kind===f)).filter(u=>!q||(u.name+' '+u.sub).toLowerCase().includes(q));
 if(!L.length)return '<p class="muted">No users here.</p>';
 return `<div class="rows">${L.map(u=>`<div class="rowi"><div class="avatar sm">${initials(u.name)}</div><div class="grow">
  <div class="row-between"><b>${esc(u.name)}</b><div class="chips">${chip(u.kind==='agent'?'Agent':'Student',u.kind==='agent'?'info':'')}${u.status==='suspended'?chip('Suspended','bad'):u.status==='rejected'?chip('Rejected'):''}${u.flags?chip(u.flags+' report'+(u.flags>1?'s':''),'warn'):''}</div></div>
  <span class="muted small">${esc(u.sub)} · ${u.info}</span>
  ${u.status==='suspended'&&u.reason?`<span class="small"><b>Suspended:</b> ${esc(u.reason)}</span>`:''}
  <div class="btns" style="margin-top:4px">${u.kind==='agent'?`<button class="btn sm ghost" data-act="push" data-v="agent" data-id="${u.id}">Profile</button>`:''}${u.status==='suspended'?`<button class="btn sm ghost" data-act="restoreUser" data-k="${u.kind}" data-id="${u.id}">Lift suspension</button>`:u.status==='active'?`<button class="btn sm ghost danger-t" data-act="suspendUser" data-k="${u.kind}" data-id="${u.id}">Suspend</button>`:''}</div>
 </div></div>`).join('')}</div>`;
}
V.admin_users=()=>{
 const pa=Object.values(S.agents).filter(a=>a.status==='pending'),f=S.usrF||'all';
 return `${head('Trust and safety','Users')}
 <section class="stack"><h2>Agents waiting for verification <span class="count-pill">${pa.length}</span></h2>${pa.length?pa.map(pendingAgentCard).join(''):'<p class="muted">No agents waiting.</p>'}</section>
 <section class="block"><h2>Everyone</h2>
  <label class="search">${ic('search',18)}<input id="usr-q" type="search" placeholder="Name, business or department" aria-label="Search users" value="${esc(S.usrQ||'')}" data-bind="usrQ" data-live="userList" autocomplete="off"></label>
  <div class="amen">${[['all','All'],['student','Students'],['agent','Agents'],['suspended','Suspended']].map(([k,l])=>`<button class="tog ${f===k?'on':''}" data-act="usrF" data-f="${k}">${l}</button>`).join('')}</div>
  <div id="user-list">${userListHTML()}</div></section>`;
};
function adminKeyResult(code){
 const k=S.keys.find(x=>x.code===code);
 if(!k)return `<div class="vk-res bad"><b>${ic('alert',16)} No key with this code</b><p>Check the code with the student. Keys start with LDG- and have three groups of four.</p></div>`;
 const h=house(k.houseId),r=room(h,k.roomId),p=S.payments.find(x=>x.id===k.payId),s=S.students[k.studentId]||{},a=agent(h.agentId),fut=k.start>now();
 const st=k.status==='active'?(fut?['Starts '+fmtDate(k.start),'warn']:['Active','ok']):[k.status==='expired'?'Expired':'Cancelled','bad'];
 return `<div class="vk-res ${st[1]}"><b>${st[0]} · ${esc(h.title)}, ${esc(r?r.name:'')}</b>
  <dl class="dl"><div><dt>Tenant</dt><dd>${esc(stu(k.studentId).name)}${s.suspended?' (suspended)':''}</dd></div><div><dt>Agent</dt><dd>${esc(a.name)}</dd></div><div><dt>Dates</dt><dd>${fmtDate(k.start)} to ${fmtDate(k.end)}</dd></div>
  ${k.status==='active'&&!fut?`<div><dt>Time left</dt><dd class="mono" data-cd="${k.end}">${cdText(k.end).str}</dd></div>`:''}
  <div><dt>Payment</dt><dd>${p?`${fmt(p.amount)} · ${p.ref}`:'—'}</dd></div><div><dt>Escrow</dt><dd>${p?({held:'Held until move-in',released:'Released to agent',refunded:'Refunded'}[p.status]||'—'):'—'}</dd></div><div><dt>Moved in</dt><dd>${k.movedIn?'Yes':'Not yet'}</dd></div></dl></div>`;
}
V.admin_payments=()=>{
 const f=S.payFilter,L=S.payments.filter(p=>f==='all'||p.status===f||(f==='released'&&p.status==='paid')).sort((a,b)=>b.time-a.time);
 return `${head('Money','Payments and refunds')}
 <div class="amen">${[['all','All'],['held','Held in escrow'],['released','Released or paid'],['refunded','Refunded']].map(([k,l])=>`<button class="tog ${f===k?'on':''}" data-act="payF" data-f="${k}">${l}</button>`).join('')}</div>
 ${L.length?`<div class="rows">${L.map(p=>payRow(p,true)).join('')}</div>`:'<p class="muted">No payments in this view.</p>'}`;
};
function reportCard(t){
 const h=house(t.houseId),byA=t.reportedBy==='agent',by=byA?agent(t.agentId).name:stu(t.studentId).name,other=byA?stu(t.studentId).name:agent(t.agentId).name;
 return `<article class="comp"><div class="comp-h"><div><b>${esc(by)} reported ${esc(other)}</b><span class="muted small">Chat about ${esc(h.title)}${t.reportedAt?' · '+rel(t.reportedAt):''}${t.blocked?' · blocked':''}</span></div>${t.reportStatus==='reviewed'?chip('Reviewed','ok'):chip('Open','warn')}</div>
  <p class="small strong">Reason: ${esc(t.reportReason||'Not given')}</p>
  ${t.msgs.some(m=>m.flag)?`<p class="note warn-t">${ic('alert',16)} <span>This chat also has messages flagged for asking to pay outside Lodgely.</span></p>`:''}
  <div class="btns"><button class="btn sm ghost" data-act="push" data-v="thread" data-id="${t.id}" data-ro="1">${ic('chat',15)} Read chat</button><button class="btn sm ghost" data-act="reviewReport" data-id="${t.id}">${t.reportStatus==='reviewed'?'Reopen':'Mark reviewed'}</button></div></article>`;
}
V.admin_complaints=()=>{
 const f=S.compFilter,reps=S.threads.filter(t=>t.reported).sort((a,b)=>(b.reportedAt||0)-(a.reportedAt||0));
 const tabs=[['public','Public complaints'],['mismatch','Mismatch reports'],['dispute','Disputes']].map(([k,l])=>[k,l,S.complaints.filter(c=>c.kind===k).length]).concat([['reported','Reported chats',reps.length],['support','Support messages',S.support.length]]);
 const L=S.complaints.filter(c=>c.kind===f).sort((a,b)=>b.t-a.t);
 return `${head('Moderation','Complaints and disputes')}
 <div class="amen">${tabs.map(([k,l,n])=>`<button class="tog ${f===k?'on':''}" data-act="compF" data-f="${k}">${l} (${n})</button>`).join('')}</div>
 <div class="stack">${f==='support'?supportHTML():f==='reported'?(reps.length?reps.map(reportCard).join(''):'<p class="muted">No chats have been reported.</p>'):(L.length?L.map(c=>complaintCard(c,'admin')).join(''):'<p class="muted">Nothing here yet.</p>')}</div>`;
};

/* ---------- shell ---------- */
const TABS={
 student:[['explore','Explore','search'],['saved','Saved','heart'],['lodge','My lodge','key'],['savings','Savings','wallet'],['messages','Chats','chat']],
 agent:[['home','Home','home'],['listings','Listings','list'],['inspections','Visits','calendar'],['messages','Chats','chat'],['more','Account','more']],
 admin:[['overview','Overview','chart'],['listings','Listings','home'],['users','Users','users'],['payments','Payments','card'],['complaints','Complaints','flag']]
};
const WIDE=['student_explore','student_saved','agent_listings'];
const THEME_KEY='lodgely-theme',root=document.documentElement;
let themePref=null;try{themePref=localStorage.getItem(THEME_KEY);}catch(e){}
const THEMES=[['light','Light','sun'],['dark','Dark','moon'],['system','System','monitor']];
const themeMode=()=>['light','dark','system'].includes(themePref)?themePref:(root.getAttribute('data-theme')||'system');
function themeCtl(){
 const m=themeMode(),c=THEMES.find(t=>t[0]===m)||THEMES[2];
 return `<div class="theme-wrap"><button class="iconbtn" data-act="themeMenu" aria-haspopup="menu" aria-expanded="${themeOpen}" aria-label="Theme: ${c[1]}" title="Theme: ${c[1]}">${ic(c[2],21)}</button>${themeOpen?`<div class="tmenu" role="menu" aria-label="Theme">${THEMES.map(([k,l,i])=>`<button role="menuitemradio" aria-checked="${k===m}" data-act="setTheme" data-mode="${k}">${ic(i,18)}<span>${l}${k==='system'?'<small>Follows your device</small>':''}</span>${k===m?ic('check',16):''}</button>`).join('')}</div>`:''}</div>`;
}
function syncTheme(){const w=document.querySelector('.theme-wrap');if(w)w.outerHTML=themeCtl();}

/* loading placeholders */
const skLine=(w,cls='')=>`<div class="sk sk-l ${cls}" style="width:${w}"></div>`;
function skelCards(n,count){return `<div aria-busy="true"><p class="sr" role="status">Loading houses</p>${count?`<div style="margin-bottom:12px">${skLine('40%')}</div>`:''}<div class="grid">${Array.from({length:n},()=>`<div class="sk-card"><div class="sk sk-img"></div><div class="sk-b">${skLine('62%','h')}${skLine('80%')}<div class="chips">${skLine('70px')}${skLine('96px')}</div></div></div>`).join('')}</div></div>`;}
function skelRows(n){return `<div class="rows" aria-busy="true">${Array.from({length:n},()=>`<div class="sk-row"><div class="sk sk-av"></div><div class="grow">${skLine('55%')}${skLine('85%')}</div></div>`).join('')}</div>`;}
const skelHead=()=>`<div class="page-head">${skLine('120px')}${skLine('60%','h')}</div>`;
function skelFor(k){
 const st='<p class="sr" role="status">Loading</p>';
 if(k==='house'||k==='ahouse')return st+`<div class="sk sk-big"></div><div class="stack">${skLine('30%')}${skLine('75%','h')}${skLine('60%')}</div>${skelRows(3)}`;
 if(['student_saved','agent_listings','agent'].includes(k))return st+skelHead()+skelCards(3);
 if(k==='student_lodge'||k==='key')return st+skelHead()+`<div class="sk sk-key"></div>${skelRows(3)}`;
 if(k==='agent_home'||k==='admin_overview')return st+skelHead()+`<div class="stats four">${Array.from({length:4},()=>`<div class="stat">${skLine('60%','h')}${skLine('80%')}</div>`).join('')}</div>${skelRows(3)}`;
 return st+skelHead()+skelRows(4);
}
function viewKey(){if(S.screen==='landing')return 'landing';if(S.screen==='page')return 'page:'+S.page;const c=cur();return c?c.v+':'+(c.id||c.code||''):S.role+'_'+nav().tab;}
function viewLoading(){
 const k=viewKey();if(k==='landing'||k.startsWith('page:'))return false;
 if(!READY)return true;
 if(!S.slow||k.startsWith('newlisting')||k.startsWith('settings')||loadedViews.has(k))return false;
 if(!pendingViews.has(k))pendingViews.set(k,setTimeout(()=>{pendingViews.delete(k);loadedViews.add(k);if(viewKey()===k)afterLoad(k);},S.slow?2200:450));
 return true;
}
function afterLoad(k){const a=document.activeElement;if(k==='student_explore'&&a&&/INPUT|SELECT|TEXTAREA/.test(a.tagName)&&$('#results'))$('#results').innerHTML=results();else render();maybeTour();}
function navTo(){if(S.slow)loadedViews.delete(viewKey());}
function header(){
 const unread=S.notes.filter(n=>n.to===meId()&&!n.read).length;
 return `<header class="band"><div class="band-in">
  <button class="brand" data-act="landing" aria-label="Lodgely home page">${KEYMARK}<span>Lodgely</span><em>OAU · Ile-Ife</em></button>
  <div class="hd">${themeCtl()}${S.role==='student'&&!LOGGED()?'<button class="demo-btn" data-act="login">Log in</button>':''}<button class="iconbtn" data-act="notes" ${S.role==='student'&&!LOGGED()?'hidden':''} aria-label="Notifications${unread?', '+unread+' unread':''}">${ic('bell',21)}${unread?`<b class="dot">${unread}</b>`:''}</button>${ME&&ME.role!=='student'?`<button class="iconbtn" data-act="logout" aria-label="Log out" title="Log out">${ic('door',21)}</button>`:''}${DEMO?`<button class="demo-btn" data-act="demo" aria-label="Demo guide">${ic('clock',16)}<span class="dlbl"> Demo</span></button>`:''}</div>
 </div></header>`;
}
function tabbar(){
 const n=nav();
 const badge={users:S.role==='admin'?Object.values(S.agents).filter(a=>a.status==='pending').length:0,listings:S.role==='admin'?S.houses.filter(h=>h.mod==='pending'&&!h.deleted).length:0,
  inspections:S.role==='agent'?S.inspections.filter(i=>myH().some(h=>h.id===i.houseId)&&i.status==='booked').length:0,
  complaints:S.role==='admin'?S.complaints.filter(c=>!c.removed&&c.status==='open').length+S.threads.filter(t=>t.reported&&t.reportStatus!=='reviewed').length+S.support.filter(x=>x.status==='new').length:0};
 return `<nav class="tabbar" aria-label="Sections"><div class="tabbar-in">${TABS[S.role].map(([k,l,i])=>`<button class="tab ${n.tab===k?'on':''}" data-act="tab" data-t="${k}" ${n.tab===k?'aria-current="page"':''}>${ic(i,22)}<span>${l}</span>${badge[k]?`<b class="tb">${badge[k]}</b>`:''}</button>`).join('')}</div></nav>`;
}
function body(){
 const c=cur();
 let clock=SHIFT?`<div class="clockbar">${ic('clock',16)}<span>Demo clock: ${fmtDate(now())} (${SHIFT>0?'+':''}${Math.round(SHIFT/DAY)} days)</span><button class="link" data-act="today">Back to today</button></div>`:'';
 if(S.role==='student'&&!LOGGED()&&!c&&SIGNED_OUT[nav().tab]){const [t,d]=SIGNED_OUT[nav().tab];return clock+`<div class="narrow">${head('Not logged in',t)}<div class="empty">${ic('lock',28)}<p>${d}</p><div class="btns" style="justify-content:center"><button class="btn sm" data-act="signup">Create an account</button><button class="btn sm ghost" data-act="login">Log in</button></div></div></div>`;}
 const susp=S.role==='student'&&LOGGED()&&ME.suspended?`<div class="clockbar" style="background:var(--bad-soft);color:var(--bad)">${ic('alert',16)}<span>Your account is suspended: ${esc((S.students[MYID()]||{}).suspendReason||'')}. You can't book, pay or message.</span></div>`:S.role==='agent'&&agent(MYID()).status==='suspended'?`<div class="clockbar" style="background:var(--bad-soft);color:var(--bad)">${ic('alert',16)}<span>Your account is suspended: ${esc(agent(MYID()).suspendReason||'')}. Your houses are hidden from students.</span></div>`:'';
 const testPay=!DEMO&&ME&&ME.role==='admin'&&PAYMODE==='simulated'?`<div class="clockbar" style="background:var(--warn-soft,var(--brass-soft));color:var(--ink)">${ic('alert',16)}<span>Payments are in test mode, so nobody is charged. Finish the Paystack setup (docs/SETUP.md, part 4) before opening to students.</span></div>`:'';
 clock=testPay+susp+clock;
 const loading=viewLoading();
 if(S.role==='agent'&&ME&&ME.role==='agent'&&!['verified','suspended'].includes(agent(MYID()).status)&&!c&&!loading)return clock+`<div class="narrow">${V.pending({id:MYID()})}</div>`;
 if(c){if(loading)return clock+`<div class="narrow">${skelFor(c.v)}</div>`;const f=V[c.v];return clock+`<div class="narrow">${f?f(c):gone()}</div>`;}
 const key=S.role+'_'+nav().tab,f=V[key];
 if(loading&&key!=='student_explore'){const sk=skelFor(key);return clock+(WIDE.includes(key)?sk:`<div class="narrow">${sk}</div>`);}
 const html=f?f():gone();
 return clock+(WIDE.includes(key)?html:`<div class="narrow">${html}</div>`);
}
let LOAD_ERR='';
function render(){
 if(!READY){app.innerHTML=LOAD_ERR?`<div class="boot"><h1>Can't load Lodgely</h1><p>${esc(LOAD_ERR)}</p><button class="btn" data-act="retryLoad">Try again</button></div>`:'<div class="boot" aria-busy="true"><div class="boot-mark"></div><p>Loading Lodgely…</p></div>';return;}
 if(S.screen==='landing'){app.innerHTML=landingHeader()+`<main id="main" class="land">${landing()}</main>`;return;}
 if(S.screen==='page'){app.innerHTML=landingHeader()+`<main id="main" class="land">${pageView()}</main>`;return;}
 app.innerHTML=header()+`<main class="wrap" id="main">${body()}</main>`+tabbar();
 hydrate();
}
function renderModal(){
 if(!S.modal){mroot.innerHTML='';document.body.classList.remove('locked');return;}
 const f=MODALS[S.modal.type];if(!f){S.modal=null;mroot.innerHTML='';return;}
 mroot.innerHTML=`<div class="scrim" data-act="closeModal"></div><div class="sheet" role="dialog" aria-modal="true">${f(S.modal)}</div>`;
 document.body.classList.add('locked');
}
let toastT;
function toast(msg){troot.innerHTML=`<div class="toast-box">${esc(msg)}</div>`;clearTimeout(toastT);toastT=setTimeout(()=>{troot.innerHTML='';},3200);}
function go(v){nav().stack.push(v);navTo();save();render();scrollTo(0,0);}
function enterApp(role,tab){S.screen='app';S.role=role;S.nav[role].tab=tab;S.nav[role].stack=[];S.modal=null;navTo();save();render();renderModal();scrollTo(0,0);maybeTour();}

/* ---------- modals ---------- */
const MODALS={};
function methodPicker(m){
 return `<div class="methods" role="radiogroup" aria-label="Payment method">
  <label class="opt"><input type="radio" name="pm" value="bank" data-bind="modal.method" data-rerender="modal" ${m.method==='bank'?'checked':''}><span><b>Bank transfer</b><small>Send to a one-time account number</small></span></label>
  <label class="opt"><input type="radio" name="pm" value="momo" data-bind="modal.method" data-rerender="modal" ${m.method==='momo'?'checked':''}><span><b>Mobile money</b><small>OPay, PalmPay or MoMo PSB</small></span></label></div>
  ${m.method==='bank'?`<div class="acct"><div><span class="muted">Account number</span><b class="mono">9912 403 551</b></div><div><span class="muted">Account name</span><b>Lodgely Escrow (test)</b></div><div><span class="muted">Valid for</span><b>30 minutes</b></div></div>`
  :`<div class="grid2"><div class="field"><label for="wal">Wallet</label><select id="wal" class="in" data-bind="modal.wallet">${['OPay','PalmPay','MoMo PSB'].map(w=>`<option ${m.wallet===w?'selected':''}>${w}</option>`).join('')}</select></div><div class="field"><label for="ph">Phone number</label><input id="ph" class="in" inputmode="tel" value="${esc(m.phone)}" data-bind="modal.phone"></div></div>`}`;
}
function providerView(m){return `<div class="proc"><div class="spinner" role="status" aria-label="Waiting for payment"></div><h2>Finish paying on Paystack</h2><p class="muted">A secure Paystack page opened. Pay there with card, bank transfer or USSD. This screen updates by itself when the payment is confirmed.</p>
 <div class="btns" style="justify-content:center"><button class="btn sm" data-act="payCheck">I've paid. Check now</button><button class="btn sm ghost" data-act="payCancel">Cancel payment</button></div><p class="fine mono">Reference ${esc(m.ref||'')}</p></div>`;}
const testNote=()=>PAYMODE==='paystack'?'Payments are processed securely by Paystack.':'Test mode: no real money moves.';
MODALS.checkout=m=>{
 const h=house(m.houseId);
 if(m.stage==='provider')return providerView(m);
 const title={inspection:'Pay inspection fee',rent:'Pay rent',renewal:'Renew your key'}[m.kind];
 if(m.stage==='processing')return `<div class="proc"><div class="spinner" role="status" aria-label="Confirming"></div><h2>${PAYMODE==='paystack'?'Opening Paystack':'Confirming payment'}</h2><p class="muted">${PAYMODE==='paystack'?'One moment...':`Waiting for ${m.method==='bank'?'your bank transfer':esc(m.wallet)} to confirm.`}</p></div>`;
 if(m.stage==='done')return doneView(m);
 const bal=savBal(),canSav=m.kind!=='inspection'&&bal>0,sv=canSav&&m.useSav?Math.min(bal,m.amount):0,toPay=m.amount-sv;
 const bal0=m.ballotId?S.ballots.find(x=>x.id===m.ballotId):null;
 const item=m.kind==='inspection'?`Visit on ${fmtSlot(m.slot)}`:`${room(h,m.roomId).name} · ${TERM} days${bal0?' from '+fmtDate(startForBallot(bal0))+' · ballot win':''}`;
 return `${mhead(title)}
  <div class="sum"><div class="sum-h">${art(h,'art thumb')}<div><b>${esc(h.title)}</b><span class="muted small">${esc(item)}</span></div></div>
   <dl class="dl"><div><dt>${m.kind==='inspection'?'Standard inspection fee':'Rent for one academic year'}</dt><dd>${fmt(m.amount)}</dd></div>
   ${canSav?`<div><dt><label class="chk"><input type="checkbox" data-bind="modal.useSav" data-rerender="modal" ${m.useSav?'checked':''}> Use rent savings (${fmt(bal)})</label></dt><dd>${sv?'− '+fmt(sv):'—'}</dd></div>`:''}
   <div class="tot"><dt>To pay now</dt><dd>${fmt(toPay)}</dd></div></dl></div>
  ${toPay>0?(PAYMODE==='paystack'?`<p class="note">${ic('card',16)} <span>You'll pay on Paystack's secure page: card, bank transfer or USSD.</span></p>`:methodPicker(m)):`<p class="note ok-t">${ic('check',16)} <span>Your savings cover the full amount.</span></p>`}
  ${m.err?`<p class="err">${esc(m.err)}</p>`:''}
  ${m.kind==='rent'&&!m.ballotId&&m.holdUntil?`<p class="note warn-t">${ic('clock',16)} <span>Held for you for <b class="mono" data-hold="${m.holdUntil}">15:00</b>. Other students see this room as pending payment until then. <button class="link small" data-act="releaseRoom" data-h="${m.houseId}" data-r="${m.roomId}">Release the room</button></span></p>`:''}
  <p class="note">${ic('shield',16)} <span>${m.kind==='rent'?'Lodgely holds your rent until you confirm move-in. If the room is not handed over, raise a dispute and admin steps in.':m.kind==='inspection'?'The fee goes to the agent. You get it back if they cancel or do not show up.':`Your key extends by ${TERM} days from its current end date.`}</span></p>
  <button class="btn block" data-act="pay">${toPay<=0?'Pay with savings':PAYMODE==='paystack'?`Pay ${fmt(toPay)} with Paystack`:m.method==='bank'?`I've sent ${fmt(toPay)}`:`Pay ${fmt(toPay)}`}</button>
  <p class="fine">${testNote()}</p>`;
};
function doneView(m){
 const r=m.result||{};
 if(r.error)return `${mhead('Payment not completed')}<p>${esc(r.error)}</p><button class="btn block" data-act="closeModal">Close</button>`;
 const ok=`<div class="okmark">${ic('check',28)}</div>`;
 if(m.kind==='inspection')return `<div class="done">${ok}<h2>Visit booked</h2><p class="muted">${fmtSlot(m.slot)} at ${esc(house(m.houseId).address)}. Reminders go out 24 hours and 1 hour before. The agent's contact is in your chat.</p><p class="mono small muted">Receipt ${esc(r.ref)}</p><button class="btn block" data-act="closeModal">Done</button></div>`;
 if(m.kind==='rent'){const k=S.keys.find(x=>x.code===r.key);return `<div class="done">${ok}<h2>Payment confirmed</h2><p class="muted">Your room is secured and has left the search results.</p>${k?`<div class="keycard">${keyArt(k.code,'lg')}<div class="kc-code" style="text-align:center">${k.code}</div><p class="muted small" style="text-align:center">Valid ${fmtDate(k.start)} to ${fmtDate(k.end)}</p></div>`:''}<p class="mono small muted">Receipt ${esc(r.ref)}</p><button class="btn block brass" data-act="doneCheckout">Open my key</button></div>`;}
 const k=S.keys.find(x=>x.code===m.code);
 return `<div class="done">${ok}<h2>Key renewed</h2><p class="muted">New end date ${k?fmtDate(k.end):''}.</p><p class="mono small muted">Receipt ${esc(r.ref)}</p><button class="btn block" data-act="closeModal">Done</button></div>`;
}
MODALS.book=m=>{
 const h=house(m.h),sl=slotsFor(h);
 return `${mhead(m.resched?'Reschedule visit':'Book an inspection')}
  <div class="sum-h">${art(h,'art thumb')}<div><b>${esc(h.title)}</b><span class="muted small">${esc(h.address)}</span></div></div>
  <div class="field"><span class="lbl">Pick a time</span><div class="slots" role="radiogroup" aria-label="Time slots">${sl.map(t=>`<label class="opt"><input type="radio" name="slot" value="${t}" data-bind="modal.slot" ${String(m.slot)===String(t)?'checked':''}><span>${fmtSlot(t)}</span></label>`).join('')}</div></div>
  ${m.err?`<p class="err">${m.err}</p>`:''}
  <p class="note">${ic('shield',16)} <span>${m.resched?`You can move a visit once, up to 12 hours before it.`:`Standard fee ${fmt(FEE)}, the same for every agent and paid to the agent. Free to cancel, or move once, up to 12 hours before. If the agent cancels or doesn't show up, you get it back.`}</span></p>
  <button class="btn block" data-act="bookNext">${m.resched?'Move my visit':'Continue to payment'}</button>`;
};
MODALS.code=m=>`${mhead('Enter door code')}<p class="muted">The agent shows a 4-digit code on their Lodgely app when you arrive. Entering it confirms you attended.</p>
 <input id="code-in" class="in mono" style="font-size:28px;letter-spacing:.4em;text-align:center" inputmode="numeric" maxlength="4" autocomplete="one-time-code" aria-label="Door code" value="${esc(m.val)}" data-bind="modal.val" data-enter="checkCode" placeholder="0000">
 ${m.err?`<p class="err">${m.err}</p>`:''}<button class="btn block" data-act="checkCode">Confirm visit</button>`;
MODALS.mismatch=m=>`${mhead('Report a mismatch')}<p class="muted">Tell admin what did not match the listing. This report is private and counts toward the agent's trust score.</p>
 <div class="field"><label for="mm">What was different?</label><textarea id="mm" class="in" rows="4" data-bind="modal.text" placeholder="e.g. No overhead tank, room smaller than the photos">${esc(m.text)}</textarea></div>${m.err?`<p class="err">${m.err}</p>`:''}<button class="btn block" data-act="sendMismatch">Send report</button>`;
MODALS.dispute=m=>`${mhead('Raise a dispute')}<p class="muted">Disputes are private. Admin can read your chat with the agent and the payment record, and can refund money still held in escrow.</p>
 <div class="field"><label for="dr">Reason</label><select id="dr" class="in" data-bind="modal.reason">${['Money or refund','Damage','Agent did not hand over the room','Other'].map(o=>`<option ${m.reason===o?'selected':''}>${o}</option>`).join('')}</select></div>
 <div class="field"><label for="dt">What happened?</label><textarea id="dt" class="in" rows="4" data-bind="modal.text">${esc(m.text)}</textarea></div>${m.err?`<p class="err">${m.err}</p>`:''}<button class="btn block" data-act="sendDispute">Send to Lodgely</button>`;
MODALS.complaint=m=>{
 const h=house(m.houseId);
 if(!m.can)return `${mhead('Lodge a complaint')}<p>Only people who rented through Lodgely can post complaints, so other students can trust them.</p><p class="muted">You have not rented at ${esc(h.title)}. If you inspected it and it did not match the listing, report a mismatch from My lodge, under Inspections.</p><button class="btn block" data-act="closeModal">Got it</button>`;
 return `${mhead('Lodge a complaint')}<p class="muted">Your complaint shows on this listing and on the agent's profile. The agent can reply, and admin removes false or abusive posts. Money, damage and no-show problems belong in a private dispute instead.</p>
  <div class="field"><span class="lbl">About</span><div class="opts2"><label class="opt"><input type="radio" name="ab" value="house" data-bind="modal.about" ${m.about==='house'?'checked':''}><span>This house</span></label><label class="opt"><input type="radio" name="ab" value="agent" data-bind="modal.about" ${m.about==='agent'?'checked':''}><span>The agent</span></label></div></div>
  <div class="field"><label for="ct">What happened?</label><textarea id="ct" class="in" rows="4" data-bind="modal.text" placeholder="Describe the problem and when it happened.">${esc(m.text)}</textarea></div>
  ${m.err?`<p class="err">${m.err}</p>`:''}<button class="btn block" data-act="sendComplaint">Post complaint</button>`;
};
MODALS.tcomplaint=m=>{
 const ids=myH().map(h=>h.id),ks=S.keys.filter(k=>ids.includes(k.houseId));
 return `${mhead('Complaint about a tenant')}<p class="muted">You can only post about tenants who rented one of your rooms on Lodgely. The tenant can reply.</p>
  <div class="field"><label for="tk">Tenant</label><select id="tk" class="in" data-bind="modal.code"><option value="">Choose a tenant</option>${ks.map(k=>`<option value="${k.code}" ${m.code===k.code?'selected':''}>${esc(stu(k.studentId).name)} · ${esc(house(k.houseId).title)}</option>`).join('')}</select></div>
  <div class="field"><label for="tt">What happened?</label><textarea id="tt" class="in" rows="4" data-bind="modal.text">${esc(m.text)}</textarea></div>${m.err?`<p class="err">${m.err}</p>`:''}<button class="btn block" data-act="sendTComplaint">Post complaint</button>`;
};
MODALS.reply=m=>`${mhead('Reply publicly')}<p class="muted">Your reply shows under the complaint for everyone to read.</p><div class="field"><label for="rp">Your reply</label><textarea id="rp" class="in" rows="4" data-bind="modal.text">${esc(m.text)}</textarea></div>${m.err?`<p class="err">${m.err}</p>`:''}<button class="btn block" data-act="sendReply">Post reply</button>`;
const REPORT_REASONS=['Asked to pay outside Lodgely','Abusive or threatening messages','Fake or misleading listing','Something else'];
MODALS.report=m=>`${mhead('Report this chat')}<p class="muted">Lodgely's safety team will read the chat and can suspend the other person.</p>
 <div class="field"><span class="lbl">What happened?</span><div class="methods" role="radiogroup" aria-label="Reason">${REPORT_REASONS.map((r,i)=>`<label class="opt"><input type="radio" name="rr" value="${r}" data-bind="modal.reason" ${m.reason===r||(!m.reason&&i===0)?'checked':''}><span>${r}</span></label>`).join('')}</div></div>
 <div class="btns end"><button class="btn ghost" data-act="reportYes" data-block="1">Report and block</button><button class="btn" data-act="reportYes">Report</button></div>`;
MODALS.confirm=m=>`${mhead(m.title)}<p class="muted">${m.text}</p><div class="btns end"><button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn ${m.danger?'danger':''}" data-act="${m.act}">${m.ok}</button></div>`;
MODALS.renew=m=>{
 const k=S.keys.find(x=>x.code===m.code);if(!k)return mhead('Renewal');
 const h=house(k.houseId),r=room(h,k.roomId),bal=savBal(),cov=Math.min(bal,r.price),pct=Math.round(cov/r.price*100);
 const bo=S.ballots.find(x=>x.keyCode===k.code&&x.status==='open');
 return `<div class="renew-pop"><div class="row-between"><div class="rp-days"><b>${m.t}</b><span>day${m.t>1?'s':''} left</span></div><button class="iconbtn plain" data-act="later" aria-label="Close">${ic('x')}</button></div>
  <h2>Your lodge at ${esc(h.title)} ends on ${fmtDate(k.end)}</h2><p class="muted">${esc(r.name)}. Renewal is ${fmt(r.price)} for another ${TERM} days.</p>
  ${bo?`<p class="note">${ic('users',16)} <span>${bo.entrants.length} students are in the ballot for your room. You keep first right to renew until ${fmtDate(k.end)}.</span></p>`:''}
  ${bal>0?`<div class="cover"><div class="row-between"><span>Your savings cover</span><b>${fmt(cov)} · ${pct}%</b></div><div class="prog lg"><i style="width:${pct}%"></i></div></div>`:`<p class="note">${ic('wallet',16)} <span>Start a rent savings goal to spread the cost.</span></p>`}
  <div class="setting"><div><b>Auto-renew from savings</b><span class="muted">Renews on the end date if savings cover the rent.</span></div><button class="sw ${k.autoRenew?'on':''}" role="switch" aria-checked="${k.autoRenew}" aria-label="Auto-renew from savings" data-act="autoRenew" data-code="${k.code}"></button></div>
  <button class="btn block" data-act="renew" data-code="${k.code}">Renew now</button><button class="btn block ghost" data-act="later">Remind me later</button></div>`;
};
MODALS.goal=m=>{
 const favs=S.favs.map(house).filter(Boolean),g0=S.savings.goal,due0=new Date(g0.due+'T00:00:00+01:00').getTime(),lk=g0.mode==='locked'&&now()<due0;
 return `${mhead('Edit savings goal')}
 ${favs.length?`<div class="field"><span class="lbl">Save for a house you liked</span><div class="amts">${favs.map(h=>`<button class="tog" data-act="goalHouse" data-id="${h.id}">${esc(h.title)} · ${fmtK(minPrice(h))}</button>`).join('')}</div></div>`:''}
 <div class="field"><label for="gn">Goal name</label><input id="gn" class="in" value="${esc(m.name)}" data-bind="modal.name"></div>
 <div class="grid2"><div class="field"><label for="gt">Target (₦)</label><input id="gt" class="in" inputmode="numeric" value="${esc(m.target)}" data-bind="modal.target"></div><div class="field"><label for="gd">Rent due date</label><input id="gd" class="in" type="date" value="${esc(m.due)}" data-bind="modal.due"></div></div>
 <div class="field"><span class="lbl">Withdrawals</span><div class="opts2"><label class="opt"><input type="radio" name="gm" value="flexible" data-bind="modal.mode" ${m.mode==='flexible'?'checked':''} ${lk?'disabled':''}><span><b>Flexible</b><small>Withdraw any time</small></span></label><label class="opt"><input type="radio" name="gm" value="locked" data-bind="modal.mode" ${m.mode==='locked'?'checked':''}><span><b>Locked</b><small>Until the due date</small></span></label></div>${lk?`<p class="note">${ic('lock',16)} <span>Locked until ${fmtDate(due0)}. You chose this when you set the goal, so you can switch to flexible only after that date. You can move the date later, not earlier.</span></p>`:''}</div>
 <div class="grid2"><div class="field"><label for="gs">Auto-save</label><select id="gs" class="in" data-bind="modal.sched">${[['none','Off'],['weekly','Weekly'],['monthly','Monthly']].map(([v,l])=>`<option value="${v}" ${m.sched===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="field"><label for="ga">Amount each time (₦)</label><input id="ga" class="in" inputmode="numeric" value="${esc(m.schedAmt)}" data-bind="modal.schedAmt"></div></div>
 ${m.err?`<p class="err">${m.err}</p>`:''}<button class="btn block" data-act="saveGoal">Save goal</button>`;
};
MODALS.deposit=m=>{
 if(m.stage==='provider')return providerView(m);
 if(m.stage==='processing')return `<div class="proc"><div class="spinner" role="status" aria-label="Processing"></div><h2>Adding to your savings</h2></div>`;
 if(m.stage==='done')return `<div class="done"><div class="okmark">${ic('check',28)}</div><h2>Added ${fmt(+m.amt)}</h2><p class="muted">Your savings balance is now ${fmt(savBal())}.</p><button class="btn block" data-act="closeModal">Done</button></div>`;
 return `${mhead('Add to rent savings')}<div class="amts">${[5000,10000,20000,50000].map(v=>`<button class="tog ${+m.amt===v?'on':''}" data-act="depAmt" data-v="${v}">${fmt(v)}</button>`).join('')}</div>
  <div class="field"><label for="dep">Amount (₦)</label><input id="dep" class="in" inputmode="numeric" value="${esc(m.amt)}" data-bind="modal.amt"></div>
  <div class="field"><span class="lbl">From</span><div class="opts2"><label class="opt"><input type="radio" name="dm" value="momo" data-bind="modal.method" ${m.method==='momo'?'checked':''}><span>Mobile money</span></label><label class="opt"><input type="radio" name="dm" value="bank" data-bind="modal.method" ${m.method==='bank'?'checked':''}><span>Bank transfer</span></label></div></div>
  ${m.err?`<p class="err">${esc(m.err)}</p>`:''}<button class="btn block" data-act="doDeposit">Add money</button><p class="fine">${testNote()}</p>`;
};
MODALS.withdraw=m=>{
 const g=S.savings.goal,due=new Date(g.due+'T00:00:00+01:00').getTime(),bal=savBal();
 if(g.mode==='locked'&&now()<due)return `${mhead('Withdraw')}<p>${ic('lock',16)} Your savings are locked until <b>${fmtDate(due)}</b>.</p><p class="muted">You chose a lock when you set this goal. You can still use the money for rent at checkout, or switch the goal to flexible for future deposits.</p><button class="btn block" data-act="closeModal">Got it</button>`;
 return `${mhead('Withdraw')}<p class="muted">Flexible savings: withdraw any amount, no fee. Balance ${fmt(bal)}.</p><div class="field"><label for="wd">Amount (₦)</label><input id="wd" class="in" inputmode="numeric" value="${esc(m.amt)}" data-bind="modal.amt"></div>${m.err?`<p class="err">${m.err}</p>`:''}<button class="btn block" data-act="doWithdraw">Withdraw</button>${PAYMODE==='paystack'?'<p class="fine">Withdrawals reach your bank or wallet within 24 hours.</p>':''}`;
};
MODALS.notes=m=>{
 const L=S.notes.filter(n=>n.to===meId()).slice(0,25);
 return `${mhead('Notifications')}<div class="notes">${L.length?L.map(n=>`<div class="${m.fresh.includes(n.id)?'new':''}"><span>${esc(n.text)}</span><span class="muted small">${rel(n.t)}</span></div>`).join(''):'<p class="muted">Nothing yet.</p>'}</div>`;
};
MODALS.demo=()=>{
 const k=activeKeys()[0];
 return `${mhead('Demo guide')}
 <ol class="steps">
  <li><b>As the student:</b> open Gold House Annex and book an inspection (${fmt(FEE)}).</li>
  <li>Enter the door code shown on the booking. Rent unlocks.</li>
  <li>Pay rent. You get a subscription key, the timer starts, and the room leaves search.</li>
  <li><b>As the agent:</b> see the new tenant, the held rent and the timer. Back as the student, confirm move-in to release rent minus ${COMM*100}%.</li>
  <li>Use the time machine below to trigger renewal pop-ups with savings coverage.</li>
  <li><b>As the admin:</b> approve Bisi Akande in Users, then her Fajuyi listing in Listings. Take down a listing, suspend a user, look up a key, or refund a payment.</li>
  <li><b>Ballot:</b> in Explore, scroll to Taken right now and open Modomo Court. Inspect it, join the ballot, then run the draw below.</li>
 </ol>
 <h3 class="sub">Sample accounts</h3>
 <p class="muted small">Each person only sees their own side of the app. To try another side, log in as one of the sample accounts. ${ME?`You are logged in as <b>${esc(ME.name)}</b>.`:'You are browsing as a visitor.'}</p>
 <div class="jump">${[['student','Tolu (student)'],['agent','Kunle (agent)'],['admin','Admin']].map(([r,l])=>`<button class="btn sm ${ME&&ME.id===(B.people||{})[r]?'':'ghost'}" data-act="demoAs" data-r="${r}">${l}</button>`).join('')}</div>
 <h3 class="sub">Ballots</h3>
 <p class="muted small">Runs every open draw now instead of waiting for the date. If you are not drawn first, use Admin, Overview, "Winner didn't pay" to pass the offer down the line.</p>
 <div class="jump"><button class="btn sm ghost" data-act="runDraws" ${S.ballots.some(b=>b.status==='open')?'':'disabled'}>Run ballot draws now</button></div>
 <h3 class="sub">Time machine</h3>
 <p class="muted small">${k?`Moves the demo clock relative to your key for ${esc(house(k.houseId).title)}.`:'Rent a room first. The time machine moves the clock relative to your key.'}</p>
 <div class="jump">${[60,30,7,1].map(n=>`<button class="btn sm ghost" data-act="jump" data-n="${n}" ${k?'':'disabled'}>${n} day${n>1?'s':''} left</button>`).join('')}<button class="btn sm ghost" data-act="jump" data-n="-1" ${k?'':'disabled'}>Past end date</button>${SHIFT?`<button class="btn sm" data-act="today">Back to today</button>`:''}</div>
 <h3 class="sub">Look and feel</h3>
 <div class="setting"><div><b>Simulate a slow connection</b><span class="muted">Shows the loading placeholders for 2 seconds on every page.</span></div><button class="sw ${S.slow?'on':''}" role="switch" aria-checked="${!!S.slow}" aria-label="Simulate a slow connection" data-act="slowToggle"></button></div>
 <div class="jump"><button class="btn sm ghost" data-act="tourReplay">Replay the tour</button><button class="btn sm ghost" data-act="landing">Open the landing page</button><button class="btn sm ghost" data-act="${LOGGED()?'logout':'demoLogin'}">${LOGGED()?'Log out to see the visitor view':'Log in as Tolu'}</button></div>
 ${(()=>{const ap=Object.values(S.agents).filter(a=>a.id!==MYID()&&a.id!=='a2'&&(a.status==='pending'||a.status==='rejected'||a.docs));return ap.length?`<h3 class="sub">Agent applications</h3><p class="muted small">See the status screen an applicant sees while admin checks their documents.</p><div class="jump">${ap.map(a=>`<button class="btn sm ghost" data-act="viewApplication" data-id="${a.id}">${esc(a.name)} · ${a.status==='verified'?'approved':a.status}</button>`).join('')}</div>`:'';})()}
 <h3 class="sub">Visit reminders</h3>
 ${(()=>{const v=S.inspections.filter(i=>i.studentId===MYID()&&i.status==='booked').sort((a,b)=>a.slot-b.slot)[0];return `<p class="muted small">${v?`Moves the clock to just before your visit to ${esc(house(v.houseId).title)}.`:'Book an inspection first. Reminders go out 24 hours and 1 hour before a visit.'}</p><div class="jump"><button class="btn sm ghost" data-act="jumpVisit" data-h="23" ${v?'':'disabled'}>23 hours before</button><button class="btn sm ghost" data-act="jumpVisit" data-h="0.8" ${v?'':'disabled'}>50 minutes before</button><button class="btn sm ghost" data-act="jumpVisit" data-h="-1.2" ${v?'':'disabled'}>Just after (agent no-show)</button></div>`;})()}
 <h3 class="sub">Assumptions for the open questions</h3>
 <ul class="rules small"><li>Inspection fee ${fmt(FEE)}, paid to the agent minus ${COMM*100}% for Lodgely.</li><li>Fully let houses stay in search as "Taken until [date]".</li><li>Ballot entries open 60 days before a room frees up, for students who inspected. The tenant can renew until the end date. The draw runs then, or 2 days after the tenant says they're not renewing. The winner has 48 hours to pay before it passes to the next name.</li><li>Escrow releases on move-in confirmation, or automatically after 7 days.</li><li>Key term is ${TERM} days from payment.</li><li>${COMM*100}% commission on rent and on inspection fees, taken from the agent's payout.</li><li>Complaints go live at once. Admin can review, resolve or remove them, and the person named can reply.</li><li>Savings partner not chosen yet.</li><li>No listing fee for agents.</li><li>Edits to a live listing show to students straight away, and admin gets a note. Changing the name, address, area or photos sends it back for review.</li><li>A listing with tenants, booked visits or a running ballot can be paused but not deleted.</li><li>Students can cancel a visit for free, or move it once, up to 12 hours before. Later cancellations keep the fee with the agent. An hour after the slot, the student can report an agent no-show for a full refund, or the agent can mark that the student didn't come.</li><li>Opening rent checkout holds the room for 15 minutes. Other students see it as pending payment. The student can continue paying or release it, and it opens again by itself when the time runs out.</li><li>Suspending an agent hides their houses and cancels their booked visits with refunds. Taking down a listing does the same for that house. Current tenants keep their keys.</li></ul>
 <button class="btn block ghost danger-t" data-act="reset">Reset demo data</button>`;
};

MODALS.waitlist=m=>{
 const s=SCHOOLS.find(x=>x.id===m.school)||SCHOOLS[1];
 return `${mhead('Join the '+s.code+' waitlist')}<p class="muted">Lodgely isn't open at ${esc(s.name)} yet. Leave your email or WhatsApp number and we'll tell you when it opens.</p>
 <div class="field"><label for="wl-c">Email or WhatsApp number</label><input id="wl-c" class="in" value="${esc(m.contact)}" data-bind="modal.contact" data-enter="joinWaitlist" autocomplete="email"></div>
 <div class="field"><span class="lbl">I am a</span><div class="opts2"><label class="opt"><input type="radio" name="wlw" value="student" data-bind="modal.who" ${m.who==='student'?'checked':''}><span>Student</span></label><label class="opt"><input type="radio" name="wlw" value="agent" data-bind="modal.who" ${m.who==='agent'?'checked':''}><span>Agent or caretaker</span></label></div></div>
 ${m.err?`<p class="err">${esc(m.err)}</p>`:''}<button class="btn block" data-act="joinWaitlist">Join the waitlist</button><button class="btn block ghost" data-act="waitlistOau">Explore OAU instead</button>`;
};
const ID_TYPES=['NIN slip','International passport',"Driver's licence","Voter's card"],PROOF_TYPES=['Letter of authority from the owner','Certificate of occupancy','Property management agreement','Recent utility bill for the property'];
MODALS.agentSignup=m=>{
 const stepLbl=n=>`<p class="eyebrow">Step ${n} of 3</p>`;
 if(m.stage==='done')return `<div class="done"><div class="okmark">${ic('check',28)}</div><h2>Application received</h2><p class="muted">Admin checks your ID and documents within 12 to 24 hours. You can add houses once you're verified.</p>${DEMO?`<p class="hint" style="justify-self:center">Demo: your application is waiting in Admin, Users. Log in as admin to approve it, or continue as Kunle Oladipo, a verified agent.</p>`:''}<button class="btn block" data-act="viewApplication">See your application status</button>${DEMO?'<button class="btn block ghost" data-act="agentSignupContinue">Continue as Kunle (sample agent)</button>':''}</div>`;
 if(m.stage==='code')return `${mhead('Confirm your email')}${stepLbl(2)}<p class="muted">We sent a 6-digit code to ${esc(m.email)}. Check spam if you can't see it.</p>
  <input id="as-otp" class="in mono" style="font-size:26px;letter-spacing:.35em;text-align:center" inputmode="numeric" maxlength="6" autocomplete="one-time-code" aria-label="6-digit code" data-enter="verifyAgentCode" placeholder="000000">
  ${m.err?`<p class="err">${esc(m.err)}</p>`:''}<button class="btn block" data-act="verifyAgentCode">Confirm</button>
  ${DEMO&&m.code?`<p class="hint" style="justify-self:center">Demo: the code is <b class="mono">${m.code}</b></p>`:''}<p class="fine"><button class="link small" data-act="resendAgentCode">Send a new code</button></p>`;
 if(m.stage==='docs')return `${mhead('Upload your documents')}${stepLbl(3)}<p class="muted">Admin compares these with your details before your houses can go live. Photos or PDFs up to 10 MB.</p>
  <div class="grid2">${sel('as-idtype','modal.idType',ID_TYPES,'ID document','none')}<div class="field"><label for="as-idfile">Upload ID</label><input id="as-idfile" class="in" type="file" accept="image/*,.pdf"></div></div>
  ${m.idFile?`<p class="note ok-t">${ic('check',16)} <span>${esc(m.idFile)}</span></p>`:''}
  <div class="grid2">${sel('as-prooftype','modal.proofType',PROOF_TYPES,'Proof you can let the property','none')}<div class="field"><label for="as-prooffile">Upload proof</label><input id="as-prooffile" class="in" type="file" accept="image/*,.pdf"></div></div>
  ${m.proofFile?`<p class="note ok-t">${ic('check',16)} <span>${esc(m.proofFile)}</span></p>`:''}
  ${m.err?`<p class="err">${esc(m.err)}</p>`:''}<button class="btn block" data-act="submitAgentDocs" ${m.sending?'disabled':''}>${m.sending?'Uploading...':'Send application'}</button><p class="fine">${DEMO?'Demo: files stay in your browser and are not uploaded anywhere.':'Only Lodgely admins can see these documents.'}</p>`;
 return `${mhead('Register as an agent')}${stepLbl(1)}<p class="muted">Tell us who you are. Next you'll confirm your email and upload your ID and proof that you can let the property.</p>
 <div class="field"><label for="as-name">Full name (as on your ID)</label><input id="as-name" class="in" value="${esc(m.name)}" data-bind="modal.name" autocomplete="name"></div>
 <div class="field"><label for="as-biz">Business or property name</label><input id="as-biz" class="in" value="${esc(m.biz)}" data-bind="modal.biz"></div>
 <div class="grid2"><div class="field"><label for="as-phone">WhatsApp number</label><input id="as-phone" class="in" inputmode="tel" value="${esc(m.phone)}" data-bind="modal.phone" placeholder="0803 123 4567"></div><div class="field"><label for="as-email">Email</label><input id="as-email" class="in" type="email" value="${esc(m.email)}" data-bind="modal.email"></div></div>
 <div class="grid2">${sel('as-btype','modal.btype',['Individual caretaker','Registered agency','Property management company'],'Business type','none')}${sel('as-rel','modal.rel',['Caretaker','Property owner','Managing agent','Representative'],'Relationship to the property','none')}</div>
 <div class="field"><label for="as-pw">Password</label><input id="as-pw" class="in" type="password" autocomplete="new-password" placeholder="At least 8 characters"></div>
 ${m.err?`<p class="err">${esc(m.err)}</p>`:''}<button class="btn block" data-act="submitAgentSignup">Continue</button><p class="fine">Already registered? <button class="link small" data-act="login" data-w="agent">Log in</button></p>`;
};

const TAKEDOWN_REASONS=['Fake or misleading listing','Reports of payment outside Lodgely','Duplicate of another listing','Owner or agent asked','Something else'];
const SUSPEND_AGENT=['Asked students to pay outside Lodgely','Repeated no-shows','Fake or misleading listings','Abusive behaviour','Something else'];
const SUSPEND_STUDENT=['Asked to pay outside Lodgely','Abusive behaviour','Fake reports or complaints','Something else'];
MODALS.takedown=m=>{const h=house(m.id),nv=S.inspections.filter(i=>i.houseId===h.id&&i.status==='booked').length;
 return `${mhead('Take down '+esc(h.title)+'?')}<p class="muted">Students won't find it or be able to book it. ${nv?`${nv} booked visit${nv>1?'s':''} will be cancelled and refunded. `:''}Current tenants keep their keys. The agent is told why.</p>
 <div class="field"><span class="lbl">Reason</span><div class="methods" role="radiogroup" aria-label="Reason">${TAKEDOWN_REASONS.map(r=>`<label class="opt"><input type="radio" name="tdr" value="${r}" data-bind="modal.reason" ${m.reason===r?'checked':''}><span>${r}</span></label>`).join('')}</div></div>
 <div class="field"><label for="td-note">Note for the agent (optional)</label><textarea id="td-note" class="in" rows="2"></textarea></div>
 <div class="btns end"><button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn danger" data-act="takeDownYes">Take down</button></div>`;};
MODALS.suspend=m=>{const ag=m.k==='agent',name=ag?agent(m.id).name:stu(m.id).name,list=ag?SUSPEND_AGENT:SUSPEND_STUDENT;
 return `${mhead('Suspend '+esc(name)+'?')}<p class="muted">${ag?'Their houses disappear from search and their booked visits are cancelled and refunded. Current tenants keep their keys, and rent already held stays held.':'They can still log in and see their key and payments, but they can\'t book visits, pay, message or post complaints. They are removed from any open ballots.'}</p>
 <div class="field"><span class="lbl">Reason</span><div class="methods" role="radiogroup" aria-label="Reason">${list.map(r=>`<label class="opt"><input type="radio" name="sur" value="${r}" data-bind="modal.reason" ${m.reason===r?'checked':''}><span>${r}</span></label>`).join('')}</div></div>
 <div class="field"><label for="su-note">Details (shown to them)</label><textarea id="su-note" class="in" rows="2"></textarea></div>
 <div class="btns end"><button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn danger" data-act="suspendYes">Suspend</button></div>`;};
const BANKS=['Access Bank','Ecobank','Fidelity Bank','First Bank','FCMB','GTBank','Kuda','Moniepoint','OPay','PalmPay','Stanbic IBTC','Sterling Bank','UBA','Union Bank','Wema Bank','Zenith Bank'];
MODALS.payout=m=>`${mhead('Payout account')}<p class="muted">Lodgely pays your share of rent and inspection fees into this account. It must be in your name or your business's name.</p>
 ${sel('po-bank','modal.bank',BANKS,'Bank','none')}
 <div class="field"><label for="po-acct">Account number</label><input id="po-acct" class="in mono" inputmode="numeric" maxlength="10" value="${esc(m.acct)}" data-bind="modal.acct" placeholder="10 digits" data-enter="payoutCheck"></div>
 ${m.name?`<p class="note ok-t">${ic('check',16)} <span>Account name: <b>${esc(m.name)}</b></span></p>`:''}
 ${m.err?`<p class="err">${esc(m.err)}</p>`:''}
 ${m.name?`<button class="btn block" data-act="savePayout">Save payout account</button>`:`<button class="btn block" data-act="payoutCheck">Check account</button>`}
 <p class="fine">Demo: the name check is simulated. In the live app it comes from the bank through the payment provider.</p>`;
MODALS.info=m=>`${mhead(m.title)}<p class="muted">${esc(m.text)}</p><div class="btns end">${m.act?`<button class="btn ghost" data-act="${m.act}" data-id="${m.id}">${m.actLabel}</button>`:''}<button class="btn" data-act="closeModal">OK</button></div>`;
const GATED={fav:'save houses',message:'message agents',book:'book an inspection',rent:'pay rent',rentBallot:'pay rent',joinBallot:'join a ballot',lodgeComplaint:'post a complaint',enterCode:'confirm a visit'};
const SIGNED_OUT={saved:['Saved houses','Log in to keep a list of houses you like.'],lodge:['My lodge','Your subscription key, visits and payments show up here once you log in.'],savings:['Rent savings','Log in to save toward next year\'s rent, bit by bit.'],messages:['Chats','Log in to message agents about a house.']};
async function afterLogin(){
 const p=S.pendingAct;S.pendingAct=null;S.modal=null;
 try{await refresh();}catch(e){toast(e.message);}
 if(!ME){renderModal();render();return;}
 const hi='Logged in as '+ME.name+'.';
 if(ME.role!=='student'){renderModal();enterApp(ME.role,ME.role==='agent'?'home':'overview');toast(hi);return;}
 save();
 if(S.screen==='landing'&&!p){renderModal();enterApp('student','explore');toast(hi);return;}
 render();renderModal();toast(hi);
 if(p&&ACT[p.act])ACT[p.act]({dataset:p.data,closest:()=>null});
}
MODALS.auth=m=>{
 const err=m.err?`<p class="err">${esc(m.err)}</p>`:'',hint=t=>`<p class="hint" style="justify-self:center">${t}</p>`;
 if(m.step==='gate')return `${mhead('Sign up to '+m.why)}<p class="muted">Anyone can browse houses. To ${m.why}, you need a free Lodgely account. It keeps your payments, key and chats in one place.</p>
  <button class="btn block" data-act="authGo" data-s="signup">Create an account</button><button class="btn block ghost" data-act="authGo" data-s="login">Log in</button>
  ${DEMO?hint(`Demo: <button class="link" data-act="demoLogin">continue as Tolu, a sample student</button>`):''}`;
 if(m.step==='signup')return `${mhead('Create your account')}
  <div class="field"><label for="su-name">Full name</label><input id="su-name" class="in" value="${esc(m.name)}" autocomplete="name"></div>
  <div class="grid2"><div class="field"><label for="su-phone">Phone number</label><input id="su-phone" class="in" inputmode="tel" value="${esc(m.phone)}" placeholder="0812 345 6789" autocomplete="tel"></div><div class="field"><label for="su-email">Email</label><input id="su-email" class="in" type="email" value="${esc(m.email)}" autocomplete="email"></div></div>
  <div class="grid2"><div class="field"><label for="su-school">School</label><select id="su-school" class="in">${SCHOOLS.map(s=>`<option value="${s.id}" ${m.school===s.id?'selected':''}>${s.code}${s.live?'':' (coming soon)'}</option>`).join('')}</select></div><div class="field"><label for="su-dept">Department and level</label><input id="su-dept" class="in" value="${esc(m.dept)}" placeholder="e.g. Law, 200L"></div></div>
  <div class="field"><label for="su-pw">Password</label><input id="su-pw" class="in" type="password" autocomplete="new-password" placeholder="At least 8 characters"></div>
  ${err}<button class="btn block" data-act="doSignup">Create account</button><p class="fine">Already have an account? <button class="link small" data-act="authGo" data-s="login">Log in</button></p>`;
 if(m.step==='code')return `${mhead('Confirm your email')}<p class="muted">We sent a 6-digit code to ${esc(m.email)}. Enter it to confirm the address is yours. Check spam if you can't see it.</p>
  <input id="otp" class="in mono" style="font-size:26px;letter-spacing:.35em;text-align:center" inputmode="numeric" maxlength="6" autocomplete="one-time-code" aria-label="6-digit code" data-enter="verifyCode" placeholder="000000">
  ${err}<button class="btn block" data-act="verifyCode">Confirm</button>${DEMO&&m.code?hint(`Demo: the code is <b class="mono">${m.code}</b>`):''}<p class="fine"><button class="link small" data-act="resendCode">Send a new code</button></p>`;
 if(m.step==='done')return `<div class="done"><div class="okmark">${ic('check',28)}</div><h2>Welcome, ${esc((m.name||'').split(' ')[0])}</h2><p class="muted">Your account is ready and your email is confirmed.</p><button class="btn block" data-act="authDone">Continue</button></div>`;
 if(m.step==='login')return `${mhead('Log in')}<div class="seg2" role="group" aria-label="I am a" style="justify-self:start">${[['student','Student'],['agent','Agent']].map(([k,l])=>`<button class="${(m.who||'student')===k?'on':''}" data-act="authWho" data-w="${k}" aria-pressed="${(m.who||'student')===k}">${l}</button>`).join('')}</div>
  <div class="field"><label for="li-id">${DEMO?'Email or phone number':'Email'}</label><input id="li-id" class="in" value="${esc(m.id)}" autocomplete="username"></div>
  <div class="field"><div class="row-between"><label for="li-pw">Password</label><button class="link small" data-act="authGo" data-s="forgot">Forgot password?</button></div><input id="li-pw" class="in" type="password" autocomplete="current-password" data-enter="doLogin"></div>
  ${err}<button class="btn block" data-act="doLogin">Log in</button>
  ${(m.who||'student')==='student'?`<p class="fine">New to Lodgely? <button class="link small" data-act="authGo" data-s="signup">Create an account</button></p>`:`<p class="fine">New agent? <button class="link small" data-act="agentSignup">Register as an agent</button></p>`}
  ${DEMO?hint(`Demo: sample accounts are tolu@example.com (student), kunle@example.com (agent) and admin@example.com, with any password. Accounts you create here work too.`):''}`;
 if(m.step==='forgot')return `${mhead('Reset your password')}<p class="muted">Enter the email address on your account and we'll send you a 6-digit code.</p>
  <div class="field"><label for="fp-id">Email or phone number</label><input id="fp-id" class="in" value="${esc(m.id)}" data-enter="sendReset"></div>
  ${err}<button class="btn block" data-act="sendReset">Send code</button><p class="fine"><button class="link small" data-act="authGo" data-s="login">Back to log in</button></p>`;
 if(m.step==='reset')return `${mhead('Choose a new password')}<p class="muted">We sent a code to ${esc(m.id)}.</p>
  <div class="field"><label for="rs-code">6-digit code</label><input id="rs-code" class="in mono" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div>
  <div class="field"><label for="rs-pw">New password</label><input id="rs-pw" class="in" type="password" autocomplete="new-password" placeholder="At least 8 characters"></div>
  <div class="field"><label for="rs-pw2">Repeat new password</label><input id="rs-pw2" class="in" type="password" autocomplete="new-password"></div>
  ${err}<button class="btn block" data-act="doReset">Save new password</button>${DEMO&&m.code?hint(`Demo: the code is <b class="mono">${m.code}</b>`):''}`;
 if(m.step==='resetDone')return `<div class="done"><div class="okmark">${ic('check',28)}</div><h2>Password changed</h2><p class="muted">Log in with your new password.</p><button class="btn block" data-act="authGo" data-s="login">Log in</button></div>`;
 return mhead('Account');
};

/* ---------- checkout ---------- */
const methodLabel=m=>m.method==='bank'?'Bank transfer':m.method==='card'?'Card':(m.wallet||'Mobile money');
// Start a payment; simulated mode confirms it here, Paystack mode opens Paystack's page.
async function startPay(m){
 m.stage='processing';m.err='';renderModal();
 try{
  const co=await B.call('start_checkout',{kind:m.kind,houseId:m.houseId,roomId:m.roomId,slot:m.slot,ballotId:m.ballotId,keyCode:m.code,amount:m.amount,useSav:!!m.useSav,method:methodLabel(m)});
  m.ref=co.ref;
  let res=co.result;
  if(!res&&co.mode==='simulated'){await sleep(1100);res=await B.call('simulate_pay',{ref:co.ref});}
  if(!res&&co.mode==='paystack'){res=await providerPay(m,co);if(!res)return;}
  await refresh();
  if(S.modal!==m){save();render();if(res&&!res.error)toast('Payment confirmed.');return;}
  if(res.error){m.stage='form';m.err=res.error;}else{m.result=res;m.stage='done';}
  save();render();renderModal();
 }catch(e){if(S.modal===m){m.stage='form';m.err=e.message;renderModal();}else toast(e.message);try{await refresh();render();}catch(_){}}
}
// Paystack: open the hosted checkout, then wait for the server to confirm.
async function providerPay(m,co){
 m.stage='provider';renderModal();
 let base='';try{base=(import.meta.env.VITE_PUBLIC_URL||'')||(location.protocol.startsWith('http')&&!/localhost/.test(location.host)?location.origin+location.pathname:'');}catch(e){}
 const {url}=await B.providerCheckout(co.ref,base?base+'?pay='+encodeURIComponent(co.ref):'');
 let closed=false;
 await openExternal(url,()=>{closed=true;});
 const t0=Date.now();
 while(S.modal===m&&m.stage==='provider'&&Date.now()-t0<20*6e4){
  await sleep(closed?800:3000);
  let st=await B.call('payment_status',{ref:co.ref});
  if(st.status==='pending'&&(closed||m.check||Date.now()-t0>15000)){try{await B.providerVerify(co.ref);}catch(e){}st=await B.call('payment_status',{ref:co.ref});}
  m.check=false;
  if(st.status!=='pending'){closeExternal();return st.result||{error:st.status==='expired'?'The payment was cancelled.':'The payment did not go through. You have not been charged.'};}
  if(closed&&Date.now()-t0>4000){closed=false;}
 }
 return null;
}

/* ---------- actions ---------- */
const closeAll=()=>{S.modal=null;save();render();renderModal();};
const ACT={
 noop:()=>{},
 retryLoad:async()=>{LOAD_ERR='';render();try{await refresh();}catch(e){LOAD_ERR=e.message||'Check your connection.';}render();renderModal();},
 themeMenu:()=>{themeOpen=!themeOpen;syncTheme();if(themeOpen){const b=document.querySelector('.tmenu [aria-checked="true"]');if(b)b.focus();}},
 setTheme:el=>{const m=el.dataset.mode;themePref=m;try{localStorage.setItem(THEME_KEY,m);}catch(e){}if(m==='system')root.removeAttribute('data-theme');else root.setAttribute('data-theme',m);themeOpen=false;syncTheme();toast(m==='system'?'Theme now follows your device.':m==='dark'?'Dark mode on.':'Light mode on.');},
 gal:el=>{const g=el.closest('.gal'),t=g&&g.querySelector('.gal-track');if(!t)return;const n=t.children.length,w=t.clientWidth||1;let i=Math.round(t.scrollLeft/w)+(+el.dataset.dir);if(i<0)i=n-1;if(i>=n)i=0;let rm=false;try{rm=matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){}if(t.scrollTo)t.scrollTo({left:i*w,behavior:rm?'auto':'smooth'});else t.scrollLeft=i*w;setDots(g,i);},
 landing:()=>{tourEnd(false,true);S.screen='landing';S.modal=null;save();render();renderModal();scrollTo(0,0);},
 ldTop:()=>scrollTo(0,0),
 ldScroll:el=>{const t=document.getElementById(el.dataset.to);if(t&&t.scrollIntoView)t.scrollIntoView({block:'start'});},
 openApp:()=>enterApp(ME?ME.role:'student',ME&&ME.role==='agent'?'home':ME&&ME.role==='admin'?'overview':'explore'),
 viewAgent:()=>{if(ME&&ME.role==='agent'){enterApp('agent','home');return;}S.modal={type:'auth',step:'login',who:'agent',id:''};renderModal();},
 ldFind:()=>{
  const ld=S.ld;
  if(ld.school!=='oau'){S.modal={type:'waitlist',school:ld.school,contact:'',who:'student'};renderModal();return;}
  Object.assign(S.f,{q:'',area:'All',am:[],type:ld.type,max:ld.max});
  enterApp('student','explore');
  const n=filtered(visible).length;toast(n?`${n} house${n===1?'':'s'} with free rooms match your search.`:'No free rooms match yet. Try a wider budget.');
 },
 waitlist:el=>{S.modal={type:'waitlist',school:el.dataset.s,contact:'',who:'student'};renderModal();setTimeout(()=>{const i=$('#wl-c');if(i)i.focus();},60);},
 joinWaitlist:async()=>{
  const m=S.modal,i=$('#wl-c'),c=((i?i.value:m.contact)||'').trim();m.contact=c;
  if(!(EMAIL_RE.test(c)||PHONE_RE.test(c))){m.err='Enter an email address or a phone number like 0803 123 4567.';renderModal();return;}
  const s=SCHOOLS.find(x=>x.id===m.school),school=m.school;
  const r=await run('join_waitlist',{school,contact:c,who:m.who},{errTo:true});if(!r)return;
  if(!S.myWait.some(w=>w.school===school))S.myWait.push({school,t:now()});if(!(ME&&ME.role==='admin'))S.waitlist=S.myWait;save();render();
  toast(`You're on the ${s.code} waitlist. We'll message you when Lodgely opens there.`);
 },
 waitlistOau:()=>enterApp('student','explore'),
 agentSignup:()=>{S.modal={type:'agentSignup',stage:'form',name:'',biz:'',phone:'',email:'',btype:'Individual caretaker',rel:'Caretaker'};renderModal();},
 submitAgentSignup:async()=>{
  const m=S.modal;['name','biz','phone','email'].forEach(k=>{const i=$('#as-'+k);if(i)m[k]=i.value.trim();});
  const pw=($('#as-pw')||{}).value||'';
  if(!m.name||!m.biz||!PHONE_RE.test(m.phone)||!EMAIL_RE.test(m.email)){m.err='Add your name, business name, a phone number like 0803 123 4567 and an email address.';renderModal();return;}
  if(pw.length<8){m.err='Use a password with at least 8 characters.';renderModal();return;}
  if(busy)return;busy=true;
  try{const r=await B.auth.signUp({role:'agent',name:m.name,biz:m.biz,phone:m.phone,email:m.email,btype:m.btype,rel:m.rel,school:'oau',password:pw});m.code=r.demoCode;m.stage='code';m.err='';}
  catch(e){m.err=e.message;}finally{busy=false;}
  renderModal();setTimeout(()=>{const i=$('#as-otp');if(i)i.focus();},60);
 },
 verifyAgentCode:async()=>{const m=S.modal,v=(($('#as-otp')||{}).value||'').trim();
  try{await B.auth.verify({code:v,email:m.email});await refresh();}catch(e){m.err=e.message;renderModal();return;}
  m.stage='docs';m.err='';m.idType=m.idType||ID_TYPES[0];m.proofType=m.proofType||PROOF_TYPES[0];renderModal();},
 resendAgentCode:async()=>{try{const r=await B.auth.resend({email:S.modal.email});S.modal.code=r.demoCode;S.modal.err='';renderModal();toast('New code sent.');}catch(e){toast(e.message);}},
 submitAgentDocs:async()=>{
  const m=S.modal;if(!m.idFile||!m.proofFile){m.err=!m.idFile?'Upload your ID document.':'Upload proof that you can let the property.';renderModal();return;}
  if(busy)return;m.err='';m.sending=true;renderModal();
  let files=[];
  try{files=await Promise.all([['id',m.idFile],['proof',m.proofFile]].map(([k,n])=>FILES[k]?B.upload(FILES[k],{kind:'doc'}):Promise.resolve(n)));}
  catch(e){m.sending=false;m.err=e.message;renderModal();return;}
  m.sending=false;
  const r=await run('submit_agent_docs',{idType:m.idType,idFile:m.idFile,proofType:m.proofType,proofFile:m.proofFile,btype:m.btype,rel:m.rel,files},{errTo:true,close:!!m.resubmitId,ok:m.resubmitId?'New documents sent. Admin checks them within 12 to 24 hours.':null});
  if(!r)return;FILES.id=FILES.proof=null;
  if(!m.resubmitId){m.newId=MYID();m.stage='done';m.err='';S.modal=m;renderModal();}
 },
 agentSignupContinue:async()=>{if(DEMO){await B.auth.signInAs('agent');await refresh();enterApp('agent','home');toast('Demo: you continue as Kunle Oladipo. Your application is waiting in Admin, Users.');return;}enterApp('agent','home');},
 slowToggle:()=>{S.slow=!S.slow;save();renderModal();toast(S.slow?'Slow connection on. Pages show loading placeholders for 2 seconds.':'Slow connection off.');},
 tourNext:()=>{if(!tourState)return;if(tourState.i>=TOUR.length-1){tourEnd(true);return;}tourState.i++;showStep();},
 tourBack:()=>{if(tourState&&tourState.i>0){tourState.i--;showStep();}},
 tourSkip:()=>tourEnd(false),
 tourReplay:()=>{try{localStorage.removeItem('lodgely-tour');}catch(e){}window.__lodgelyTour=false;enterApp('student','explore');},
 demoAs:async el=>{if(!DEMO)return;const r=el.dataset.r;try{await B.auth.signInAs(r);S.visitor=false;}catch(e){toast(e.message);return;}S.modal=null;renderModal();S.pendingAct=null;await afterLogin();},
 role:async el=>{const r=el.dataset.r;if(!DEMO)return;S.modal=null;
  try{if(r==='student'){if(S.visitor){if(ME)await B.auth.signOut();}else if(!ME||ME.role!=='student')await B.auth.signInAs('student');}else if(!ME||ME.role!==r||(r==='agent'&&ME.id!==B.people.agent))await B.auth.signInAs(r);await refresh();}catch(e){toast(e.message);}
  S.role=r;navTo();save();render();renderModal();scrollTo(0,0);},
 tab:el=>{const n=nav();n.tab=el.dataset.t;n.stack=[];if(S.modal){S.modal=null;renderModal();}navTo();save();render();scrollTo(0,0);},
 push:el=>{
  if(S.screen==='landing'){S.screen='app';S.role=ME?ME.role:'student';S.nav[S.role].tab=S.nav[S.role].tab||'explore';S.nav[S.role].stack=[];}
  const v={v:el.dataset.v};if(el.dataset.id)v.id=el.dataset.id;if(el.dataset.code)v.code=el.dataset.code;if(el.dataset.ro)v.ro=true;
  if(v.v==='newlisting')S.draft=newDraft();
  if(v.v==='thread'&&!v.ro){const t=S.threads.find(x=>x.id===v.id);const me=S.role==='agent'?'a':'s';if(t&&t.msgs.some(m=>m.from!==me&&!m.read)){t.msgs.forEach(m=>{if(m.from!==me)m.read=true;});B.call('mark_thread_read',{id:t.id}).catch(()=>{});}}
  if(S.modal){S.modal=null;renderModal();}
  go(v);
 },
 back:()=>{nav().stack.pop();navTo();save();render();scrollTo(0,0);},
 fav:el=>run('toggle_fav',{houseId:el.dataset.id},{close:false,ok:r=>r.saved?'Saved to favourites.':'Removed from favourites.'}),
 am:el=>{const a=el.dataset.a;S.f.am=S.f.am.includes(a)?S.f.am.filter(x=>x!==a):[...S.f.am,a];save();render();},
 view:el=>{S.f.view=el.dataset.view;save();render();},
 clearf:()=>{Object.assign(S.f,{q:'',area:'All',max:'Any',type:'Any',am:[]});save();render();},
 boardF:el=>{S.boardFilter=el.dataset.f;render();},
 payF:el=>{S.payFilter=el.dataset.f;render();},
 compF:el=>{S.compFilter=el.dataset.f;render();},
 message:async el=>{
  const r=await run('open_thread',{houseId:el.dataset.h},{close:false});if(!r)return;
  go({v:'thread',id:r.id});setTimeout(()=>{const i=$('#msg-in');if(i)i.focus();},60);
 },
 send:async el=>{
  const id=el.dataset.id,inp=$('#msg-in'),text=(inp&&inp.value||'').trim();if(!text)return;
  if(inp)inp.value='';
  const r=await run('send_message',{id,text},{close:false});
  if(!r){const i=$('#msg-in');if(i)i.value=text;return;}
  if(r.flag)toast('Never pay outside Lodgely. This message was flagged for the safety team.');
  scrollTo(0,document.body.scrollHeight);const i=$('#msg-in');if(i)i.focus();
  if(S.role==='student'&&DEMO)setTimeout(()=>autoReply(id,text),1400);
 },
 report:el=>{S.modal={type:'report',id:el.dataset.id};renderModal();},
 reportYes:el=>run('report_thread',{id:S.modal.id,reason:S.modal.reason||REPORT_REASONS[0],block:!!el.dataset.block},{ok:el.dataset.block?'Reported and blocked.':'Reported. The safety team will review this chat.'}),
 book:el=>{
  if(el.dataset.resched){const i=S.inspections.find(x=>x.id===el.dataset.resched),w=visitWhen(i);if(i.moves>0){toast('You can move a visit once. Cancel it instead if the new time doesn\'t work.');return;}if(!w.free){toast('Visits can\'t be moved within 12 hours. You can still cancel.');return;}}
  S.modal={type:'book',h:el.dataset.h,resched:el.dataset.resched||null,slot:null};renderModal();
 },
 bookNext:()=>{
  const m=S.modal;if(!m.slot){m.err='Pick a time slot.';renderModal();return;}
  if(m.resched){run('reschedule_visit',{id:m.resched,slot:+m.slot},{errTo:true,ok:r=>'Visit moved to '+fmtSlot(r.slot)+'.'});return;}
  S.modal={type:'checkout',kind:'inspection',houseId:m.h,amount:FEE,slot:+m.slot,method:'momo',wallet:'OPay',phone:(ME&&ME.phone)||'',useSav:false,stage:'form'};renderModal();
 },
 rent:async el=>{const h=house(el.dataset.h),r=room(h,el.dataset.r);
  const res=await run('hold_room',{roomId:r.id},{close:false});if(!res)return;
  S.modal={type:'checkout',kind:'rent',houseId:h.id,roomId:r.id,holdUntil:res.until,amount:r.price,method:'bank',wallet:'OPay',phone:(ME&&ME.phone)||'',useSav:savBal()>0,stage:'form'};renderModal();},
 joinBallot:el=>{const b=S.ballots.find(x=>x.id===el.dataset.id);if(!b||b.status!=='open')return;if(!inspDone(b.houseId)){toast('Inspect the house first. Only students who inspected can enter.');return;}
  run('join_ballot',{id:b.id},{close:false,ok:r=>`You're in. The draw is on ${fmtDate(r.drawAt)}.`});},
 leaveBallot:el=>run('leave_ballot',{id:el.dataset.id},{close:false,ok:'You left the ballot.'}),
 rentBallot:el=>{const b=S.ballots.find(x=>x.id===el.dataset.id);if(!b)return;const h=house(b.houseId),r=room(h,b.roomId);S.modal={type:'checkout',kind:'rent',houseId:h.id,roomId:r.id,ballotId:b.id,amount:r.price,method:'bank',wallet:'OPay',phone:(ME&&ME.phone)||'',useSav:savBal()>0,stage:'form'};renderModal();},
 notRenewing:el=>{S.modal={type:'confirm',title:'Not renewing this room?',text:'The ballot for your room will be drawn in 2 days, and the winner moves in after your stay ends. You can still renew until the draw.',ok:"I'm not renewing",act:'notRenewingYes',code:el.dataset.code};renderModal();},
 notRenewingYes:()=>run('not_renewing',{code:S.modal.code},{ok:r=>'Noted. The ballot draw is on '+fmtDate(r.drawAt)+'.'}),
 runDraws:()=>run('run_draw',{},{ok:r=>r.drawn?`Ran ${r.drawn} ballot draw${r.drawn>1?'s':''}. Check your notifications.`:'No ballots are open.'}),
 runDraw:el=>run('run_draw',{id:el.dataset.id},{close:false,ok:'Ballot drawn.'}),
 passBallot:el=>run('pass_offer',{id:el.dataset.id},{close:false,ok:r=>r.status==='drawn'?'Offer passed to '+r.to+'.':'Nobody left in line. The room is open to everyone.'}),
 renew:el=>{const k=S.keys.find(x=>x.code===el.dataset.code);const h=house(k.houseId),r=room(h,k.roomId);
  if(S.ballots.some(x=>x.keyCode===k.code&&(x.status==='drawn'||x.status==='filled'))){toast('Renewal closed when the ballot for this room was drawn.');return;}S.modal={type:'checkout',kind:'renewal',code:k.code,houseId:h.id,roomId:r.id,amount:r.price,method:'momo',wallet:'OPay',phone:(ME&&ME.phone)||'',useSav:savBal()>0,stage:'form'};renderModal();},
 pay:()=>{const m=S.modal;if(!m||m.stage==='processing'||m.stage==='provider')return;startPay(m);},
 payCheck:()=>{const m=S.modal;if(m&&m.stage==='provider'){m.check=true;toast('Checking with the bank...');}},
 payCancel:async()=>{const m=S.modal;if(!m)return;try{await B.call('cancel_checkout',{ref:m.ref});}catch(e){}closeExternal();m.stage='form';m.err='Payment cancelled. You have not been charged.';renderModal();refresh().then(bgRender).catch(()=>{});},
 doneCheckout:()=>{const m=S.modal;S.modal=null;renderModal();if(m&&m.result&&m.result.key){S.nav.student.tab='lodge';S.nav.student.stack=[{v:'key',code:m.result.key}];}save();render();scrollTo(0,0);},
 closeModal:()=>{if(S.modal&&(S.modal.stage==='processing'||S.modal.stage==='provider'||S.modal.sending))return;const held=S.modal&&S.modal.type==='checkout'&&S.modal.kind==='rent'&&S.modal.stage==='form'&&S.modal.holdUntil;S.modal=null;save();renderModal();if(held){render();toast('The room stays held for you until the timer runs out. Tap Continue payment to finish.');}},
 later:()=>{S.modal=null;save();renderModal();},
 needInsp:()=>toast('Book and complete an inspection first. Rent unlocks after the visit.'),
 enterCode:el=>{S.modal={type:'code',id:el.dataset.id,val:''};renderModal();setTimeout(()=>{const i=$('#code-in');if(i)i.focus();},60);},
 checkCode:async()=>{
  const m=S.modal,inp=$('#code-in');const v=(inp?inp.value:m.val||'').trim();m.val=v;
  if(busy)return;busy=true;
  try{const r=await B.call('confirm_visit',{id:m.id,code:v});if(r&&r.error){m.err=r.error;renderModal();return;}
   if(S.modal===m)S.modal=null;await refresh();save();render();renderModal();toast('Visit confirmed. Rent payment is unlocked.');}
  catch(e){m.err=e.message;renderModal();}finally{busy=false;}
 },
 rate:el=>run('rate_visit',{id:el.dataset.id,n:+el.dataset.n},{close:false,ok:r=>`Thanks. ${r.name} is now rated ${(+r.rating).toFixed(1)} from ${r.ratings} visits, with a trust score of ${r.trust}.`}),
 mismatch:el=>{S.modal={type:'mismatch',id:el.dataset.id,text:''};renderModal();},
 sendMismatch:()=>{const m=S.modal;if(!(m.text||'').trim()){m.err='Describe what was different.';renderModal();return;}run('report_mismatch',{id:m.id,text:m.text},{errTo:true,ok:'Report sent to admin.'});},
 moveIn:el=>{S.modal={type:'confirm',title:'Confirm you have moved in?',text:'Lodgely will release your rent to the agent. Confirm only once you have the room and it matches the listing.',ok:'Yes, I have moved in',act:'moveInYes',code:el.dataset.code};renderModal();},
 moveInYes:()=>run('confirm_move_in',{code:S.modal.code},{ok:'Move-in confirmed. Rent released to the agent.'}),
 autoRenew:el=>run('toggle_auto_renew',{code:el.dataset.code},{close:false,ok:r=>r.on?'Auto-renew from savings is on.':'Auto-renew is off.'}),
 dispute:el=>{S.modal={type:'dispute',code:el.dataset.code,reason:'Money or refund',text:''};renderModal();},
 sendDispute:()=>{
  const m=S.modal;if(!(m.text||'').trim()){m.err='Describe what went wrong.';renderModal();return;}
  run('raise_dispute',{code:m.code,reason:m.reason,text:m.text},{errTo:true,ok:'Dispute sent. Admin can see your chat and payment record.'});
 },
 lodgeComplaint:el=>{const h=house(el.dataset.id);S.modal={type:'complaint',houseId:h.id,can:myKeys().some(k=>k.houseId===h.id),about:'house',text:''};renderModal();},
 sendComplaint:()=>{const m=S.modal;if(!(m.text||'').trim()){m.err='Write what happened before posting.';renderModal();return;}run('post_complaint',{houseId:m.houseId,about:m.about,text:m.text},{errTo:true,ok:'Complaint posted.'});},
 tcomplaint:()=>{S.modal={type:'tcomplaint',code:'',text:''};renderModal();},
 sendTComplaint:()=>{const m=S.modal;if(!m.code||!(m.text||'').trim()){m.err='Choose a tenant and write what happened.';renderModal();return;}run('post_tenant_complaint',{code:m.code,text:m.text},{errTo:true,ok:'Complaint posted. The tenant can reply.'});},
 reply:el=>{S.modal={type:'reply',id:el.dataset.id,text:''};renderModal();},
 sendReply:()=>{const m=S.modal;if(!(m.text||'').trim()){m.err='Write a reply first.';renderModal();return;}run('reply_complaint',{id:m.id,text:m.text},{errTo:true,ok:'Reply posted.'});},
 goal:()=>{const g=S.savings.goal;S.modal=Object.assign({type:'goal'},g,{target:String(g.target),schedAmt:String(g.schedAmt)});renderModal();},
 goalHouse:el=>{const h=house(el.dataset.id);S.modal.target=String(minPrice(h));S.modal.name='Rent for '+h.title;renderModal();},
 saveGoal:()=>{
  const m=S.modal,tg=+String(m.target).replace(/[^\d]/g,'');
  if(!(tg>0)||!m.due||!String(m.name||'').trim()){m.err='Add a name, a target and a due date.';renderModal();return;}
  run('save_goal',{name:m.name,target:m.target,due:m.due,mode:m.mode,sched:m.sched,schedAmt:m.schedAmt},{errTo:true,ok:'Savings goal updated.'});
 },
 deposit:()=>{S.modal={type:'deposit',amt:'20000',method:'momo',stage:'form'};renderModal();},
 depAmt:el=>{S.modal.amt=el.dataset.v;renderModal();},
 doDeposit:()=>{const m=S.modal;const a=+String(m.amt).replace(/[^\d]/g,'');if(!(a>=100)){m.err='Enter at least ₦100.';renderModal();return;}m.amt=String(a);m.kind='deposit';m.amount=a;startPay(m);},
 withdraw:()=>{S.modal={type:'withdraw',amt:''};renderModal();},
 doWithdraw:()=>{const m=S.modal;const a=+String(m.amt).replace(/[^\d]/g,'');if(!(a>0)||a>savBal()){m.err=`Enter an amount up to ${fmt(savBal())}.`;renderModal();return;}
  run('withdraw_savings',{amount:a,to:'To your bank or wallet'},{errTo:true,ok:r=>PAYMODE==='simulated'?fmt(r.amount)+' sent to your wallet.':`Withdrawal of ${fmt(r.amount)} requested. It reaches your account within 24 hours.`});},
 copy:el=>{const v=el.dataset.v;const fail=()=>toast('Copy is blocked here. Long-press the code to copy it.');try{navigator.clipboard.writeText(v).then(()=>toast('Key code copied.'),fail);}catch(e){fail();}},
 notes:()=>{const mine=S.notes.filter(n=>n.to===meId());const fresh=mine.filter(n=>!n.read).map(n=>n.id);mine.forEach(n=>n.read=true);S.modal={type:'notes',fresh};render();renderModal();if(fresh.length)B.call('mark_notes_read',{}).catch(()=>{});},
 demo:()=>{S.modal={type:'demo'};renderModal();},
 jump:el=>{
  const k=activeKeys()[0];if(!k){toast('Rent a room first, then come back to fast-forward.');return;}
  const n=+el.dataset.n,target=n<0?k.end+6e4:k.end-n*DAY+6e4;
  run('demo_set_clock',{shift:Math.max(SHIFT,target-Date.now())},{ok:()=>S.modal?null:(n<0?'Jumped past the end date.':`Jumped to ${n} day${n>1?'s':''} before the key ends.`)}).then(()=>{if(S.modal)renderModal();});
 },
 today:()=>run('demo_set_clock',{shift:0},{ok:'Demo clock is back to today.'}),
 reset:()=>{S.modal={type:'confirm',title:'Reset the demo?',text:'This clears every booking, payment, message and listing you made and restores the sample data.',ok:'Reset demo',act:'resetYes',danger:true};renderModal();},
 resetYes:()=>{S.modal=null;renderModal();toast('Resetting the demo...');try{localStorage.removeItem(STORE);}catch(e){}B.reset();},
 /* agent */
 cancelVisit:el=>{
  const i=S.inspections.find(x=>x.id===el.dataset.id),w=visitWhen(i);
  S.modal={type:'confirm',title:'Cancel this visit?',text:w.free?`You get the ${fmt(FEE)} fee back, and ${agent(house(i.houseId).agentId).name} is told.`:`It's less than 12 hours to your visit, so the ${fmt(FEE)} fee stays with the agent for the time they set aside.`,ok:w.free?'Cancel and get a refund':'Cancel anyway',act:'cancelVisitYes',id:i.id,danger:true};renderModal();
 },
 cancelVisitYes:()=>run('cancel_visit',{id:S.modal.id},{ok:r=>r.refunded?`Visit cancelled. ${fmt(FEE)} refunded.`:'Visit cancelled. The fee stays with the agent.'}),
 reportNoShow:el=>{S.modal={type:'confirm',title:"Report that the agent didn't show up?",text:`Lodgely refunds your ${fmt(FEE)} now and tells the agent. Agents who miss visits lose trust score and can be suspended.`,ok:'Report and get a refund',act:'noShowYes',id:el.dataset.id,danger:true};renderModal();},
 noShowYes:()=>run('report_no_show',{id:S.modal.id},{ok:r=>`Refunded ${fmt(FEE)}. ${r.name}'s trust score is now ${r.trust}.`}),
 markMissed:el=>{S.modal={type:'confirm',title:"Mark that the student didn't come?",text:`You keep your ${fmt(FEE*(1-COMM))} from the fee. The student is told and can book again.`,ok:"Student didn't come",act:'missedYes',id:el.dataset.id};renderModal();},
 missedYes:()=>run('mark_missed',{id:S.modal.id},{ok:'Marked as missed. You keep the fee.'}),
 completeInsp:el=>run('agent_complete_visit',{id:el.dataset.id},{close:false,ok:'Visit marked as done. The student can now pay rent.'}),
 cancelInsp:el=>{S.modal={type:'confirm',title:'Cancel this visit?',text:`The student gets the ${fmt(FEE)} fee back, so you lose your ${fmt(FEE*(1-COMM))}, and cancellations lower your trust score.`,ok:'Cancel visit',act:'cancelInspYes',id:el.dataset.id,danger:true};renderModal();},
 cancelInspYes:()=>run('agent_cancel_visit',{id:S.modal.id},{ok:'Visit cancelled and fee refunded.'}),
 pauseRoom:el=>run('toggle_room_pause',{houseId:el.dataset.h,roomId:el.dataset.r},{close:false,ok:r=>r.paused?'Room paused. Students cannot rent it.':'Room is available again.'}),
 toggleShared:el=>run('toggle_shared',{houseId:el.dataset.id},{close:false,ok:r=>r.shared?'Shared rooms allowed. Use + and − on each room to set its spaces.':'Shared rooms off. Rooms with free spaces now take one tenant each.'}),
 cap:el=>{const h=house(el.dataset.h);if(!h||!h.shared)return;run('set_room_cap',{houseId:el.dataset.h,roomId:el.dataset.r,d:+el.dataset.d},{close:false});},
 draftShared:()=>{S.draft.shared=!S.draft.shared;render();},
 addRoom:()=>{S.draft.rooms.push({name:'Room '+(S.draft.rooms.length+1),price:'',cap:'1'});render();const i=$(`#nl-r${S.draft.rooms.length-1}n`);if(i)i.focus();},
 delRoom:el=>{S.draft.rooms.splice(+el.dataset.i,1);render();},
 submitListing:async()=>{
  const d=S.draft,price=r=>+String(r.price).replace(/[^\d]/g,''),rooms=d.rooms.filter(r=>String(r.name).trim()&&price(r)>0);
  if(!d.title.trim()||!d.address.trim()||!rooms.length){d.err='Add a house name, a street address and at least one room with a price.';render();return;}
  const times=Object.keys(d.times).filter(k=>d.times[k]).sort(),days=Object.keys(d.days||{}).filter(k=>d.days[k]).map(Number);
  if(!times.length||!days.length){d.err='Pick at least one day and one time for inspections.';render();return;}
  if(busy)return;
  let photos=d.photos||[];
  if(!DEMO&&photos.some(x=>x.startsWith('data:'))){toast('Uploading photos...');try{photos=await Promise.all(photos.map((x,i)=>x.startsWith('data:')?B.upload(dataUrlFile(x,'photo-'+(i+1)+'.jpg')):x));}catch(e){d.err=e.message;render();return;}}
  const addr=d.address.trim(),payload={editId:d.editId||null,title:d.title.trim(),area:d.area,address:/ile-?ife/i.test(addr)?addr:addr+', Ile-Ife',km:+d.km||1,type:d.type,desc:d.desc.trim(),amenities:Object.keys(d.am).filter(k=>d.am[k]),rules:d.rules.split('\n').map(x=>x.trim()).filter(Boolean),shared:!!d.shared,furnished:!!d.am.Furnished,photos,times,days,baths:Math.max(1,Math.min(30,Math.round(+d.baths||1))),availFrom:d.avail||null,
   rooms:d.rooms.map(r=>({id:r.id||null,name:String(r.name).trim(),price:String(r.price),cap:+r.cap||1}))};
  const r=await run('save_listing',payload,{close:false});
  if(!r){return;}
  S.draft=null;
  if(d.editId){nav().stack.pop();save();render();scrollTo(0,0);toast(r.mod==='live'?'Changes saved. Students see them straight away.':r.resubmitted?'Sent to admin for review again.':'Changes saved.');return;}
  nav().stack=[];nav().tab='listings';save();render();scrollTo(0,0);toast('Sent for review. It goes live once an admin approves it.');
 },
 editListing:el=>{const h=house(el.dataset.id);S.draft=draftFromHouse(h);go({v:'newlisting'});if(el.dataset.focus==='times')setTimeout(()=>{const t=$('#nl-visits');if(t&&t.scrollIntoView)t.scrollIntoView({block:'center'});},60);},
 clearPhotos:()=>{S.draft.photos=[];render();},
 pauseListing:el=>run('toggle_listing_pause',{id:el.dataset.id},{ok:r=>r.paused?'Listing paused. Students can no longer find or book it.':'Listing is visible to students again.'}),
 deleteListing:el=>{
  const h=house(el.dataset.id),busy=[];
  if(S.keys.some(k=>k.houseId===h.id&&k.status==='active'))busy.push('current or upcoming tenants');
  if(S.inspections.some(i=>i.houseId===h.id&&i.status==='booked'))busy.push('booked visits');
  if(S.ballots.some(b=>b.houseId===h.id&&(b.status==='open'||b.status==='drawn')))busy.push('a running ballot');
  if(busy.length){S.modal={type:'info',title:`You can't delete ${h.title} yet`,text:`It has ${busy.join(', ').replace(/, ([^,]*)$/,' and $1')}. ${h.paused?'It is already paused, so no new students can book it.':'Pause it instead to stop new bookings. You can delete it once those finish.'}`,act:h.paused?'':'pauseListing',actLabel:'Pause listing',id:h.id};renderModal();return;}
  S.modal={type:'confirm',title:`Delete ${h.title}?`,text:'Students will no longer see it, and it disappears from their saved houses. Payment records stay in your payouts. You cannot undo this.',ok:'Delete listing',act:'deleteListingYes',id:h.id,danger:true};renderModal();
 },
 deleteListingYes:async()=>{const id=S.modal.id,h=house(id),t=h?h.title:'Listing';const r=await run('delete_listing',{id},{ok:`${t} deleted.`});if(r){nav().stack=[];nav().tab='listings';save();render();scrollTo(0,0);}},
 payoutForm:()=>{S.modal={type:'payout',bank:'GTBank',acct:'',name:'',checked:'',err:''};renderModal();},
 payoutCheck:async()=>{const m=S.modal,b=$('#po-bank'),v=(($('#po-acct')||{}).value||'').replace(/\D/g,'');if(b)m.bank=b.value;m.acct=v;if(v.length!==10){m.err='Enter the 10-digit account number.';m.name='';renderModal();return;}
  try{const r=PAYMODE==='paystack'&&B.resolveAccount?await B.resolveAccount(m.bank,v,false):await B.call('check_payout',{acct:v});m.name=r.name;m.checked=m.bank+'|'+v;m.err='';}catch(e){m.name='';m.err=e.message;}renderModal();},
 savePayout:async()=>{const m=S.modal,b=$('#po-bank'),v=(($('#po-acct')||{}).value||m.acct).replace(/\D/g,'');if(b)m.bank=b.value;m.acct=v;if(m.checked!==m.bank+'|'+v){m.name='';m.err='The bank or account number changed. Check the account again.';renderModal();return;}
  if(PAYMODE==='paystack'&&B.resolveAccount){try{await B.resolveAccount(m.bank,v,true);await refresh();S.modal=null;render();renderModal();toast('Payout account saved.');}catch(e){m.err=e.message;renderModal();}return;}
  run('save_payout',{bank:m.bank,acct:v},{errTo:true,ok:'Payout account saved.'});},
 payF2:el=>{S.payF2=el.dataset.f;render();},
 verifyKey:()=>{const v=($('#vk').value||'').trim().toUpperCase();S.vk=v?{q:v}:null;render();},
 fillKey:el=>{S.vk={q:el.dataset.v};render();},
 /* admin */
 approveAgent:el=>run('approve_agent',{id:el.dataset.id},{close:false,ok:r=>r.name+' is verified.'}),
 jumpVisit:el=>{
  const v=S.inspections.filter(i=>i.studentId===MYID()&&i.status==='booked').sort((a,b)=>a.slot-b.slot)[0];if(!v)return;
  const target=v.slot-(+el.dataset.h)*36e5;if(target<=now()){toast('That time has already passed on the demo clock.');return;}
  run('demo_set_clock',{shift:target-Date.now()},{ok:'Clock moved. Check the bell for the reminder.'});
 },
 login:el=>{S.modal={type:'auth',step:'login',who:(el&&el.dataset&&el.dataset.w)||(S.role==='agent'?'agent':'student'),id:''};renderModal();},
 signup:()=>{S.modal={type:'auth',step:'signup',name:'',phone:'',email:'',school:'oau',dept:''};renderModal();},
 authGo:el=>{const m=S.modal&&S.modal.type==='auth'?S.modal:{type:'auth'};S.modal=Object.assign({who:'student',id:'',name:'',phone:'',email:'',school:'oau',dept:''},m,{type:'auth',step:el.dataset.s,err:''});renderModal();},
 authWho:el=>{S.modal.who=el.dataset.w;S.modal.err='';renderModal();},
 doSignup:async()=>{
  const m=S.modal;['name','phone','email','dept'].forEach(k=>{const i=$('#su-'+k);if(i)m[k]=i.value.trim();});const sc=$('#su-school');if(sc)m.school=sc.value;
  const pw=($('#su-pw')||{}).value||'',sch=SCHOOLS.find(s=>s.id===m.school);
  const err=m.name.split(/\s+/).filter(Boolean).length<2?'Enter your first and last name.':!PHONE_RE.test(m.phone)?'Enter a phone number like 0812 345 6789.':!EMAIL_RE.test(m.email)?'Enter a valid email address.':pw.length<8?'Use a password with at least 8 characters.':(sch&&!sch.live)?`Lodgely isn't open at ${sch.code} yet. Pick OAU, or join the ${sch.code} waitlist from the home page.`:'';
  if(err){m.err=err;renderModal();return;}
  if(busy)return;busy=true;
  try{const r=await B.auth.signUp({role:'student',name:m.name,phone:m.phone,email:m.email,dept:m.dept,school:m.school,password:pw});m.code=r.demoCode;m.step='code';m.err='';}
  catch(e){m.err=e.message;}finally{busy=false;}
  renderModal();setTimeout(()=>{const i=$('#otp');if(i)i.focus();},60);
 },
 verifyCode:async()=>{const m=S.modal,v=(($('#otp')||{}).value||'').trim();try{await B.auth.verify({code:v,email:m.email});S.visitor=false;await refresh();}catch(e){m.err=e.message;renderModal();return;}m.step='done';m.err='';renderModal();},
 resendCode:async()=>{try{const r=await B.auth.resend({email:S.modal.email});S.modal.code=r.demoCode;S.modal.err='';renderModal();toast('New code sent.');}catch(e){toast(e.message);}},
 authDone:()=>afterLogin(),
 doLogin:async()=>{const m=S.modal,id=(($('#li-id')||{}).value||'').trim(),pw=($('#li-pw')||{}).value||'';m.id=id;if(!id||!pw){m.err='Enter your email or phone number and your password.';renderModal();return;}if(!(EMAIL_RE.test(id)||PHONE_RE.test(id))){m.err='That doesn\'t look like an email address or phone number.';renderModal();return;}
  if(busy)return;busy=true;try{await B.auth.signIn({id,password:pw});S.visitor=false;}catch(e){m.err=e.message;renderModal();return;}finally{busy=false;}
  afterLogin();},
 demoLogin:async()=>{if(!DEMO)return;await B.auth.signInAs('student');S.visitor=false;afterLogin();},
 sendReset:async()=>{const m=S.modal,id=(($('#fp-id')||{}).value||'').trim();m.id=id;if(!(EMAIL_RE.test(id)||PHONE_RE.test(id))){m.err='Enter the email address or phone number on your account.';renderModal();return;}
  try{const r=await B.auth.sendReset({id});m.code=r.demoCode;}catch(e){m.err=e.message;renderModal();return;}m.step='reset';m.err='';renderModal();},
 doReset:async()=>{
  const m=S.modal,c=(($('#rs-code')||{}).value||'').trim(),p1=($('#rs-pw')||{}).value||'',p2=($('#rs-pw2')||{}).value||'';
  const err=!/^\d{6}$/.test(c)?'Enter the 6-digit code.':p1.length<8?'Use a password with at least 8 characters.':p1!==p2?'The two passwords don\'t match.':'';
  if(err){m.err=err;renderModal();return;}
  try{await B.auth.doReset({code:c,password:p1});}catch(e){m.err=e.message;renderModal();return;}
  m.step='resetDone';m.err='';renderModal();
 },
 logout:async()=>{tourEnd(false,true);try{await B.auth.signOut();}catch(e){}S.visitor=true;S.pendingAct=null;S.nav.student={tab:'explore',stack:[]};S.role='student';S.modal=null;try{await refresh();}catch(e){}save();render();renderModal();scrollTo(0,0);toast('Logged out. You can still browse houses.');},
 lstF:el=>{S.lstF=el.dataset.f;render();},
 usrF:el=>{S.usrF=el.dataset.f;render();},
 adminKey:()=>{const v=(($('#akq')||{}).value||'').trim().toUpperCase();S.akq=v||null;render();},
 adminKeyFill:el=>{S.akq=el.dataset.v;render();},
 takeDown:el=>{S.modal={type:'takedown',id:el.dataset.id,reason:TAKEDOWN_REASONS[0],note:''};renderModal();},
 takeDownYes:()=>{const m=S.modal;m.note=(($('#td-note')||{}).value||'').trim();
  run('take_down_listing',{id:m.id,reason:m.reason,note:m.note},{ok:r=>`${r.title} taken down.${r.visits?` ${r.visits} booked visit${r.visits>1?'s':''} cancelled and refunded.`:''}`});},
 restoreListing:el=>run('restore_listing',{id:el.dataset.id},{close:false,ok:r=>`${r.title} is live again.`}),
 suspendUser:el=>{S.modal={type:'suspend',k:el.dataset.k,id:el.dataset.id,reason:(el.dataset.k==='agent'?SUSPEND_AGENT:SUSPEND_STUDENT)[0]};renderModal();},
 suspendYes:()=>{const m=S.modal,n=(($('#su-note')||{}).value||'').trim();
  run('suspend_user',{k:m.k,id:m.id,reason:m.reason,note:n},{ok:r=>m.k==='agent'?`${r.name} suspended. Their houses are hidden.${r.visits?` ${r.visits} visit${r.visits>1?'s':''} refunded.`:''}`:`${r.name} suspended.`});},
 restoreUser:el=>run('restore_user',{k:el.dataset.k,id:el.dataset.id},{close:false,ok:r=>`${r.name} is active again.`}),
 reviewReport:el=>run('review_report',{id:el.dataset.id},{close:false,ok:r=>r.status==='reviewed'?'Report marked as reviewed.':'Report reopened.'}),
 approveListing:el=>run('approve_listing',{id:el.dataset.id},{close:false,ok:r=>r.title+(r.agentVerified?' is live.':' approved. It shows once the agent is verified.')}),
 rejectListing:el=>run('reject_listing',{id:el.dataset.id},{close:false,ok:'Listing rejected.'}),
 release:el=>run('release_payment',{id:el.dataset.id},{close:false,ok:'Released to the agent.'}),
 viewDoc:async el=>{try{const u=await B.fileUrl(el.dataset.path);if(u)openExternal(u);}catch(e){toast(e.message);}},
 paidOut:el=>run('mark_paid_out',{id:el.dataset.id},{close:false,ok:'Marked as sent to the agent.'}),
 refund:el=>{S.modal={type:'confirm',title:'Refund this payment?',text:'The student gets the money back. For rent, the key is cancelled and the room returns to Available.',ok:'Refund',act:'refundYes',id:el.dataset.id,danger:true};renderModal();},
 refundYes:()=>run('refund_payment',{id:S.modal.id},{ok:PAYMODE==='paystack'?'Marked as refunded. Send the money back from your Paystack dashboard.':'Refunded.'}),
 setStatus:el=>run('set_complaint_status',{id:el.dataset.id,status:el.dataset.s,upheld:el.dataset.s==='resolved'&&!!el.dataset.upheld},{close:false}),
 removeComplaint:el=>run('toggle_complaint_removed',{id:el.dataset.id},{close:false,ok:r=>r.removed?'Post removed from public view.':'Post restored.'})
};

/* ---------- events ---------- */
const FILES={id:null,proof:null};
function dataUrlFile(u,name){const [h,b]=u.split(',');const mime=(h.match(/data:([^;]+)/)||[])[1]||'image/jpeg';const bin=atob(b);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new File([a],name,{type:mime});}
document.addEventListener('click',e=>{
 if(themeOpen&&!e.target.closest('.theme-wrap')){themeOpen=false;syncTheme();}
 const el=e.target.closest('[data-act]');if(!el)return;
 const f=ACT[el.dataset.act];if(!f)return;
 if(GATED[el.dataset.act]&&el.dataset.act!=='fav'&&S.role==='student'&&LOGGED()&&ME.suspended){
  e.preventDefault();e.stopPropagation();S.modal={type:'info',title:'Your account is suspended',text:`You can't ${GATED[el.dataset.act]} while your account is suspended. Reason: ${(S.students[MYID()]||{}).suspendReason||'not given'}. Contact Lodgely support to appeal.`};renderModal();return;
 }
 if(GATED[el.dataset.act]&&(S.screen==='landing'||S.role==='student')&&!LOGGED()){
  e.preventDefault();e.stopPropagation();
  S.pendingAct={act:el.dataset.act,data:Object.assign({},el.dataset)};
  S.modal={type:'auth',step:'gate',why:GATED[el.dataset.act]};renderModal();return;
 }
 e.preventDefault();e.stopPropagation();f(el);
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&tourState){tourEnd(false);return;}
 if(e.key==='Escape'&&themeOpen){themeOpen=false;syncTheme();const b=document.querySelector('[data-act="themeMenu"]');if(b)b.focus();return;}
 if(e.key==='Escape'&&S.modal&&S.modal.stage!=='processing'&&S.modal.stage!=='provider'&&!S.modal.sending){S.modal=null;save();renderModal();render();return;}
 const t=e.target;
 if(e.key==='Enter'&&t.dataset&&t.dataset.enter&&ACT[t.dataset.enter]){e.preventDefault();if(t.dataset.bind)setPath(t.dataset.bind,t.value);ACT[t.dataset.enter](t);return;}
 if((e.key==='Enter'||e.key===' ')&&t.matches&&t.matches('[role="link"][data-act]')){e.preventDefault();t.click();}
});
document.addEventListener('input',e=>{
 const el=e.target;if(!el.dataset||!el.dataset.bind)return;
 setPath(el.dataset.bind,el.type==='checkbox'?el.checked:el.value);
 if(el.dataset.live==='results'){const r=$('#results');if(r)r.innerHTML=results();}
 else if(el.dataset.live==='adminList'){const r=$('#admin-list');if(r)r.innerHTML=adminListHTML();}
 else if(el.dataset.live==='userList'){const r=$('#user-list');if(r)r.innerHTML=userListHTML();}
 else if(el.dataset.live==='help'){const r=$('#help-list');if(r)r.innerHTML=helpListHTML();}
 save();
});
document.addEventListener('change',e=>{
 const el=e.target;
 if(el.id==='nl-photos'){handlePhotos(el);return;}
 if(el.id==='pf-photo'){handleAvatar(el);return;}
 if(el.id==='vk-scan'){scanQR(el);return;}
 if((el.id==='as-idfile'||el.id==='as-prooffile')&&S.modal){const f=el.files&&el.files[0];if(f){if(f.size>10*1024*1024){S.modal.err='That file is bigger than 10 MB. Use a smaller photo or PDF.';renderModal();return;}const k=el.id==='as-idfile'?'id':'proof';FILES[k]=f;S.modal[k+'File']=f.name;S.modal.err='';renderModal();}return;}
 if(!el.dataset||!el.dataset.bind)return;
 setPath(el.dataset.bind,el.type==='checkbox'?el.checked:el.value);
 const rr=el.dataset.rerender;
 if(rr==='results'){const r=$('#results');if(r)r.innerHTML=results();}
 else if(rr==='modal')renderModal();
 else if(rr==='page')render();
 else if(rr==='ldgo'){const b=$('#ld-go');if(b)b.textContent=S.ld.school==='oau'?'Find a room':'Join the waitlist';}
 save();
});
function handlePhotos(input){
 const files=[...input.files].slice(0,3);if(!files.length||!S.draft)return;
 S.draft.photos=[];let left=files.length;
 files.forEach(f=>{const url=URL.createObjectURL(f),img=new Image();
  img.onload=()=>{const c=document.createElement('canvas'),w=Math.min(720,img.naturalWidth);c.width=w;c.height=Math.round(img.naturalHeight*w/img.naturalWidth);c.getContext('2d').drawImage(img,0,0,c.width,c.height);S.draft.photos.push(c.toDataURL('image/jpeg',.72));URL.revokeObjectURL(url);if(--left===0)render();};
  img.onerror=()=>{URL.revokeObjectURL(url);if(--left===0)render();};img.src=url;});
}
function tick(){
 let expired=false;
 document.querySelectorAll('[data-hold]').forEach(el=>{const ms=Math.max(0,+el.dataset.hold-now());if(ms===0&&!el.dataset.over){el.dataset.over='1';expired=true;}el.textContent=p2(Math.floor(ms/6e4))+':'+p2(Math.floor(ms/1000)%60);});
 document.querySelectorAll('[data-cd]').forEach(el=>{const c=cdText(+el.dataset.cd);if(el.dataset.full){['d','h','m','s'].forEach(u=>{const b=el.querySelector(`[data-u="${u}"]`);if(b)b.textContent=c[u];});}else el.textContent=c.str;});
 if(expired)refresh().then(bgRender).catch(()=>{});
}

/* ---------- public landing page ---------- */
const SCHOOLS=[
 {id:'oau',code:'OAU',name:'Obafemi Awolowo University',city:'Ile-Ife',live:true},
 {id:'ui',code:'UI',name:'University of Ibadan',city:'Ibadan'},
 {id:'unilorin',code:'UNILORIN',name:'University of Ilorin',city:'Ilorin'},
 {id:'uniosun',code:'UNIOSUN',name:'Osun State University',city:'Osogbo'},
 {id:'futa',code:'FUTA',name:'Federal University of Technology, Akure',city:'Akure'},
 {id:'fuoye',code:'FUOYE',name:'Federal University Oye-Ekiti',city:'Oye-Ekiti'},
 {id:'lautech',code:'LAUTECH',name:'Ladoke Akintola University of Technology',city:'Ogbomoso'},
 {id:'eksu',code:'EKSU',name:'Ekiti State University',city:'Ado-Ekiti'}
];
const LD_STEPS=[
 ['search','Find a room','Filter by area, budget and must-haves like steady water and a prepaid meter. Taken houses show the date they free up.'],
 ['door','Inspect it',`Book a visit for ${fmt(FEE)}. At the door the agent shows a code. Enter it and rent payment unlocks.`],
 ['shield','Pay safely','Pay by bank transfer or mobile money. Lodgely holds the rent until you confirm you have moved in.'],
 ['key','Get your key','Your subscription key proves the room is yours and counts down your 360 days. Renew in one tap.']
];
const LD_BENS=[
 ['users','Serious students only','Nobody visits without paying the inspection fee first.'],
 ['card','One fixed fee',`${fmt(FEE)} for every visit, the same everywhere. No haggling.`],
 ['wallet','Paid before you move',`${fmt(FEE*(1-COMM))} of each fee is yours as soon as a student books.`],
 ['home','No more "is it still available?"','Taken rooms show as taken, with the date they free up.'],
 ['calendar','Fill rooms early','Rooms opening in the next 60 days take ballot entries.'],
 ['lock','Rent secured','Locked in when the student pays and released to you at move-in.']
];
const LD_FAQ=[
 ['Why do I pay for an inspection?',`It's a fixed ${fmt(FEE)} for every house and every agent, so there's no haggling. It pays the agent for their time. If the agent cancels or doesn't show up, you get it back.`],
 ['Is my rent safe?','You pay inside Lodgely by bank transfer or mobile money. Lodgely holds the rent until you confirm you have moved in, or for 7 days. If the room isn\'t handed over, raise a dispute and admin can refund you.'],
 ['What is a subscription key?','Proof that you have paid for and secured a room. It has a unique code the agent checks, and a countdown to the end of your 360-day stay.'],
 ['The house I want is taken. What now?','Taken houses show the date they free up. Sixty days before that, students who have inspected can join a ballot and a winner is drawn at random. The current tenant can renew first.'],
 ['How are agents checked?','Every agent sends ID, confirms their phone number and shows they are allowed to let the property. Admin approves them before their houses appear. Ratings and complaints from real tenants are public.'],
 ['Can I save toward rent?','Yes. Set a goal in Rent savings, add money whenever you can, and use it at checkout or renewal in one tap.']
];
function landingHeader(){
 return `<header class="band"><div class="lhd">
  <button class="brand" data-act="${S.screen==='landing'?'ldTop':'landing'}" aria-label="${S.screen==='landing'?'Lodgely, back to top':'Lodgely home page'}">${KEYMARK}<span>Lodgely</span><em>OAU · Ile-Ife</em></button>
  <nav class="lnav" aria-label="${S.screen==='landing'?'Page sections':'Pages'}">${S.screen==='landing'?[['how','How it works'],['schools','Schools'],['agents','For agents'],['faq','FAQ']].map(([k,l])=>`<button data-act="ldScroll" data-to="ld-${k}">${l}</button>`).join(''):[['about','About'],['help','Help'],['contact','Contact']].map(([k,l])=>`<button data-act="page" data-p="${k}" ${S.page===k?'aria-current="page"':''}>${l}</button>`).join('')}</nav>
  <div class="lhd-act">${themeCtl()}${LOGGED()?'':'<button class="btn sm ghost onband-g" data-act="login">Log in</button>'}<button class="btn sm onband" data-act="openApp"><span class="lbl-w">Open the app</span><span class="lbl-n">Open app</span></button></div>
 </div></header>`;
}
function landing(){
 const L=S.houses.filter(visible),free=sum(L,h=>openRooms(h).length),areas=new Set(L.map(h=>h.area)).size,ld=S.ld;
 const top=L.slice().sort((a,b)=>(agent(b.agentId).trust-agent(a.agentId).trust)||(a.km-b.km)).slice(0,3);
 let k=S.keys.find(x=>x.status==='active'&&x.start<=now()&&house(x.houseId));
 if(!k)k={code:'LDG-7K3M-QX9P-2HTD',houseId:'h1',roomId:'h1r2',start:now()-90*DAY,end:now()+270*DAY};
 const kh=house(k.houseId),kr=room(kh,k.roomId);
 const schoolOpts=SCHOOLS.map(s=>[s.id,`${s.code} · ${s.city}${s.live?' (live)':' (coming soon)'}`]);
 return `<section class="lhero"><div class="lwrap">
  <div class="lhero-copy">
   <p class="eyebrow">Student housing · OAU, Ile-Ife</p>
   <h1 class="lh1">Rent your lodge near OAU <span class="hl">without the runaround.</span></h1>
   <p class="lsub">Every agent is verified. Inspections cost a fixed ${fmt(FEE)}, refunded if the agent doesn't show. Your rent stays with Lodgely until you move in.</p>
   <div class="lsearch">
    <div class="lsearch-f">${sel('ld-school','ld.school',schoolOpts,'School','ldgo')}${sel('ld-type','ld.type',[['Any','Any type'],'Single room','Self-contain','Room & parlour','Flat'],'Room type','none')}${sel('ld-max','ld.max',[['Any','Any price'],['150000','Up to ₦150k'],['300000','Up to ₦300k'],['500000','Up to ₦500k'],['1000000','Up to ₦1m']],'Budget per year','none')}</div>
    <button id="ld-go" class="btn block" data-act="ldFind">${ld.school==='oau'?'Find a room':'Join the waitlist'}</button>
    <p class="lfree">${free} room${free===1?'':'s'} free right now across ${areas} areas near OAU</p>
   </div>
   <div class="ltrust"><span>${ic('shield',16)} Verified agents</span><span>${ic('lock',16)} Rent held until move-in</span><span>${ic('key',16)} A key for every paid room</span></div>
  </div>
  <div class="lkey">
   <article class="keycard"><div class="kc-top"><div><p class="eyebrow">Subscription key · example</p><h2>${esc(kh.title)}</h2><p class="muted small">${esc(kr?kr.name:'')}</p></div>${keyArt(k.code)}</div>
    <div class="cd" data-cd="${k.end}" data-full="1">${cdBlocks(k.end)}</div>${progress(k)}<div class="kc-code">${k.code}</div></article>
   <p class="lkey-cap">Every paid room comes with a key like this. The countdown is live.</p>
  </div>
 </div></section>
 <section class="lsec"><div class="lwrap">
  <div class="lsec-h"><p class="eyebrow">Near OAU</p><h2 class="lh2">Free rooms right now</h2><p>Swipe the photos, check the walk to the gate, then book an inspection.</p></div>
  <div class="lgrid">${top.map(card).join('')}</div>
  <div class="lmore"><button class="btn ghost" data-act="openApp">See all ${L.length} houses ${ic('right',16)}</button></div>
 </div></section>
 <section class="lsec alt" id="ld-how"><div class="lwrap">
  <div class="lsec-h"><p class="eyebrow">How it works</p><h2 class="lh2">From search to keys in four steps</h2></div>
  <ol class="lsteps">${LD_STEPS.map(([i,t,d],n)=>`<li class="lstep"><div class="lstep-n">${ic(i,22)}<b>Step ${n+1}</b></div><h3>${t}</h3><p>${d}</p></li>`).join('')}</ol>
 </div></section>
 <section class="lsec" id="ld-schools"><div class="lwrap">
  <div class="lsec-h"><p class="eyebrow">Schools</p><h2 class="lh2">Live at OAU. More schools soon.</h2><p>Join the waitlist and we'll tell you when Lodgely opens at your school.</p></div>
  <div class="lschools">${SCHOOLS.map(s=>{const on=S.waitlist.some(w=>w.school===s.id);
   return `<div class="lschool ${s.live?'live':''}"><div><div class="lschool-top"><span class="lschool-code">${s.code}</span>${s.live?chip('Live','ok'):chip('Coming soon')}</div><h3>${esc(s.name)}</h3><p>${esc(s.city)}</p></div>${s.live?`<button class="btn sm" data-act="openApp">${free} rooms free</button>`:on?`<span class="chip ok" style="justify-self:start">${ic('check',13)} On the waitlist</span>`:`<button class="btn sm ghost" data-act="waitlist" data-s="${s.id}">Join waitlist</button>`}</div>`;}).join('')}</div>
 </div></section>
 <section class="lsec" id="ld-agents" style="padding-top:0"><div class="lwrap"><div class="lagent">
  <div class="lsec-h"><p class="eyebrow">For agents and caretakers</p><h2 class="lh2">Get paid for every visit</h2><p>You pay nothing to list. Lodgely sends you serious students, keeps their money safe and takes ${COMM*100}% when you get paid.</p>
   <div class="btns" style="margin-top:10px"><button class="btn brass" data-act="agentSignup">Register as an agent</button><button class="btn ghost onband-g" data-act="viewAgent">Agent log in</button></div></div>
  <ul class="lbens">${LD_BENS.map(([i,t,d])=>`<li class="lben">${ic(i,20)}<div><b>${t}</b><span>${d}</span></div></li>`).join('')}</ul>
 </div></div></section>
 <section class="lsec alt" id="ld-faq"><div class="lwrap">
  <div class="lsec-h"><p class="eyebrow">Questions</p><h2 class="lh2">What students and agents ask</h2></div>
  <div class="lfaq">${LD_FAQ.map(([q,a],i)=>`<details${i===0?' open':''}><summary>${q}${ic('down',18)}</summary><p>${a}</p></details>`).join('')}</div>
  <p style="margin-top:18px"><button class="link" data-act="page" data-p="help">More answers in the Help centre ${ic('right',14)}</button></p>
 </div></section>
 ${landingFooter()}`;
}

/* ---------- public pages ---------- */
const draftNote=extra=>`<p class="note warn-t">${ic('alert',16)} <span>Draft for the demo, not legal advice. A lawyer should review it before launch.${extra?' '+extra:''}</span></p>`;
const HELP=[
 ['Getting started',[
  ['Do I need an account to look at houses?','No. Anyone can browse houses and open listings. You need a free account to save houses, message agents, book a visit or pay.'],
  ['How do I create an account?','Tap Log in, then Create an account. Enter your name, phone, email, school and a password, then type the 6-digit code we send to your phone.'],
  ['I forgot my password','On the log in screen, tap Forgot password. Enter your email or phone and we send a code. Type the code and choose a new password.']]],
 ['Visits',[
  ['Why do I pay to inspect a house?',`Every visit costs a fixed ${fmt(FEE)}. It pays the agent for their time, so only serious students book, and nobody can ask you for more.`],
  ['What happens at the visit?','The agent shows a 4-digit door code on their Lodgely app. Enter it on the listing or in My lodge to confirm you visited. That unlocks rent payment for the house.'],
  ['Can I cancel or move a visit?','Yes. Cancelling is free up to 12 hours before the visit, and you get the fee back. You can also move a visit once, up to 12 hours before. After that, cancelling keeps the fee with the agent.'],
  ["The agent didn't show up",`An hour after your visit time, tap "The agent didn't show up" on the listing or in My lodge. Lodgely refunds your ${fmt(FEE)} and the agent's trust score drops.`]]],
 ['Paying rent',[
  ['How do I pay?','After your visit, pick a room and pay by bank transfer or mobile money (OPay, PalmPay or MoMo PSB). You can also use your rent savings.'],
  ['Who holds my money?',`Lodgely holds your rent until you confirm you have moved in. If you don't confirm, it goes to the agent 7 days after you paid. The agent receives the rent minus Lodgely's ${COMM*100}% commission.`],
  ['The room was not handed over','Before your rent is released, open your key and tap Raise a dispute. Admin reads your chat and payment record and can refund you.']]],
 ['Your key',[
  ['What is a subscription key?',`It proves you paid for and secured a room. It has a code the agent checks, and a countdown to the end of your ${TERM}-day stay.`],
  ['How do I renew?','Lodgely reminds you 60, 30, 7 and 1 days before your key ends. Tap Renew now, or turn on auto-renew to pay from your rent savings on the end date.'],
  ['The house I want is taken',"Taken houses show the date they free up. Sixty days before, students who inspected can join a ballot. The current tenant can renew first. If they don't, a winner is drawn at random and has 48 hours to pay."]]],
 ['Rent savings',[
  ['Flexible or locked?',"Flexible savings can be withdrawn any time. Locked savings stay put until your due date, though you can still use them for rent. Once locked, you can't switch back to flexible early."],
  ['How does auto-save work?','Choose weekly or monthly and an amount. Lodgely adds it from your mobile money wallet until your due date.']]],
 ['For agents',[
  ['How do I get verified?','Register as an agent, confirm your phone with a code, then upload your ID and proof that you can let the property. Admin checks them within 12 to 24 hours.'],
  ['How and when am I paid?',`You keep ${fmt(FEE*(1-COMM))} of every ${fmt(FEE)} visit as soon as a student books, and ${100-COMM*100}% of rent once the tenant moves in or 7 days after they pay. Payouts go to the bank account in Account, Payouts.`],
  ['Can I edit or remove a listing?','Yes. Open the listing to edit it, pause it, or delete it. A listing with tenants, booked visits or a running ballot can be paused but not deleted.'],
  ['What is the trust score?','It rises with good ratings and completed visits, and falls with cancelled visits, no-shows, mismatch reports and lost disputes. Students see it on your listings.']]],
 ['Safety',[
  ['Someone asked me to pay outside Lodgely',"Don't pay. Report the chat with the Report button. Lodgely flags these messages automatically and can suspend the account."],
  ['How do complaints work?','People who rented through Lodgely can post a public complaint about a house, an agent or a tenant. The person named can reply, and admin removes false or abusive posts.']]]
];
function helpListHTML(){
 const q=(S.helpQ||'').trim().toLowerCase();let n=0;
 const html=HELP.map(([g,items])=>{const L=items.filter(([qq,a])=>!q||(qq+' '+a).toLowerCase().includes(q));n+=L.length;return L.length?`<section class="hgroup"><h2>${g}</h2><div class="lfaq">${L.map(([qq,a])=>`<details${q?' open':''}><summary>${esc(qq)}${ic('down',18)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>`:'';}).join('');
 return n?html:`<div class="empty"><p>No answers match "${esc(S.helpQ)}". Try other words, or send us a message.</p><button class="btn sm" data-act="page" data-p="contact">Contact us</button></div>`;
}
function pageAbout(){return `<p class="eyebrow">About</p><h1 class="lh2">Student housing near OAU, without the runaround</h1>
 <p class="lead">Finding a room near campus usually means days of calls, trips to houses that are already taken, and agents asking for money upfront. Lodgely puts the whole process in one place: search, a paid visit, safe payment, and a key that proves the room is yours.</p>
 <h2>What we do differently</h2><ul class="rules">
  <li><b>Verified agents.</b> Every agent sends ID and proof they can let the property before their houses go live.</li>
  <li><b>One fixed visit fee.</b> ${fmt(FEE)} for every inspection, paid in the app and refunded if the agent doesn't show.</li>
  <li><b>Rent held until move-in.</b> Lodgely keeps your money until you confirm you have the room.</li>
  <li><b>A key for every paid room.</b> A unique code and a live countdown to the end of your stay.</li>
  <li><b>No wasted trips.</b> Taken houses show when they free up, and rooms opening soon take ballot entries.</li></ul>
 <h2>Where we work</h2><p>Lodgely is starting with students at Obafemi Awolowo University in Ile-Ife. Students at other schools can join the waitlist on the home page.</p>
 <div class="btns"><button class="btn" data-act="openApp">Find a room</button><button class="btn ghost" data-act="page" data-p="help">Help centre</button><button class="btn ghost" data-act="page" data-p="contact">Contact us</button></div>`;}
function pageHelp(){return `<p class="eyebrow">Support</p><h1 class="lh2">Help centre</h1>
 <label class="search">${ic('search',18)}<input id="help-q" type="search" placeholder="Search for an answer, e.g. refund" aria-label="Search the help centre" value="${esc(S.helpQ||'')}" data-bind="helpQ" data-live="help" autocomplete="off"></label>
 <div id="help-list">${helpListHTML()}</div>
 <div class="insp">${ic('chat',22)}<div><b>Still need help?</b><p class="small">Send us a message and we usually reply within one working day.</p><div class="btns"><button class="btn sm" data-act="page" data-p="contact">Contact us</button></div></div></div>`;}
function pageContact(){
 const c=S.ct||(S.ct={name:'',contact:'',who:'Student',topic:'A house or a visit',msg:''});
 if(S.ctSent)return `<p class="eyebrow">Support</p><h1 class="lh2">Message sent</h1><div class="insp ok-tone">${ic('check',22)}<div><b>Thanks, ${esc((c.name||'').split(' ')[0])}</b><p class="small">We usually reply within one working day, by ${EMAIL_RE.test(c.contact)?'email':'SMS'} to ${esc(c.contact)}.</p><div class="btns"><button class="btn sm ghost" data-act="contactAgain">Send another message</button><button class="btn sm ghost" data-act="page" data-p="help">Help centre</button></div></div></div>`;
 return `<p class="eyebrow">Support</p><h1 class="lh2">Contact us</h1>
 <p class="lead">Questions about a house, a payment or your account? Send us a message. Many answers are already in the <button class="link" data-act="page" data-p="help">Help centre</button>.</p>
 <div class="form">
  <div class="grid2"><div class="field"><label for="ct-name">Your name</label><input id="ct-name" class="in" value="${esc(c.name)}" data-bind="ct.name" autocomplete="name"></div><div class="field"><label for="ct-contact">Email or phone</label><input id="ct-contact" class="in" value="${esc(c.contact)}" data-bind="ct.contact" autocomplete="email"></div></div>
  <div class="grid2">${sel('ct-who','ct.who',['Student','Agent or caretaker','Parent or guardian','Other'],'I am a','none')}${sel('ct-topic','ct.topic',['A house or a visit','A payment or refund','My key or renewal','My account','Agent verification','Report a scam','Something else'],'Topic','none')}</div>
  <div class="field"><label for="ct-msg">Message</label><textarea id="ct-msg" class="in" rows="5" data-bind="ct.msg" placeholder="Tell us what happened. Include the house name or payment reference if you have one.">${esc(c.msg)}</textarea></div>
  ${S.ctErr?`<p class="err">${esc(S.ctErr)}</p>`:''}<div><button class="btn" data-act="sendContact">Send message</button></div></div>
 <p class="muted small">Email and WhatsApp support lines will be listed here at launch.</p>`;
}
function pageTerms(){return `<p class="eyebrow">Legal</p><h1 class="lh2">Terms of use</h1>${draftNote()}
 <p class="lead">These terms explain how Lodgely works for students and agents, and what each side can expect. By creating an account you agree to them.</p>
 <h2>1. Who can use Lodgely</h2><p>Students and anyone looking for a room near a school where Lodgely operates, and agents, caretakers and owners who are allowed to let a property. If you are under 18, a parent or guardian must agree to these terms for you. Keep your account details accurate and your password private.</p>
 <h2>2. Agents and listings</h2><p>Agents must pass verification before their houses appear. Listings must be accurate, including price, rooms, water, power and house rules. Agents must not ask students to pay outside Lodgely. Lodgely can take down a listing or suspend an account that breaks these rules.</p>
 <h2>3. Inspections</h2><p>Every visit costs a fixed ${fmt(FEE)}, paid in the app. The agent receives ${fmt(FEE*(1-COMM))} and Lodgely keeps ${fmt(FEE*COMM)}. Students can cancel for a full refund, or move a visit once, up to 12 hours before it. Later cancellations are not refunded. If the agent cancels or does not show up, the student is refunded in full. A completed visit is needed before rent can be paid.</p>
 <h2>4. Rent, escrow and keys</h2><p>Rent for one academic year (${TERM} days) is paid in full in the app. Lodgely holds it until the student confirms move-in, or for 7 days after payment, then releases it to the agent minus a ${COMM*100}% commission. Each paid room comes with a subscription key showing the start and end dates. Lodgely's servers, not the student's phone, decide whether a key is valid.</p>
 <h2>5. Refunds and disputes</h2><p>If a room is not handed over or does not match the listing, the student can raise a dispute before the rent is released. Admin reviews the chat and payment record and decides. The refund rule for a student who cancels after paying but before moving in is still being decided.</p>
 <h2>6. Renewals and ballots</h2><p>Tenants get renewal reminders before their key ends and keep the first right to renew. Rooms freeing up within 60 days can take ballot entries from students who inspected the house. Winners are drawn at random and have 48 hours to pay.</p>
 <h2>7. Rent savings</h2><p>Savings are held by a licensed partner, to be named before launch. Flexible savings can be withdrawn at any time. Locked savings can be withdrawn after the goal date and used for rent at any time.</p>
 <h2>8. Complaints and reviews</h2><p>Only people who rented or let through Lodgely can post complaints, and only students who inspected can rate a visit. Posts must be true and respectful. The person named can reply, and Lodgely removes false or abusive posts.</p>
 <h2>9. Suspension</h2><p>Lodgely can suspend accounts for payment requests outside the app, repeated no-shows, fake listings or abuse. Suspended agents' houses are hidden and their booked visits refunded. Current tenants keep their keys.</p>
 <h2>10. Changes and questions</h2><p>We will tell you in the app before these terms change. Questions? <button class="link" data-act="page" data-p="contact">Contact us</button>.</p>`;}
function pagePrivacy(){return `<p class="eyebrow">Legal</p><h1 class="lh2">Privacy policy</h1>${draftNote('This demo keeps everything in your own browser and sends nothing anywhere.')}
 <p class="lead">This explains what personal data Lodgely collects, why, and the choices you have.</p>
 <h2>What we collect</h2><ul class="rules">
  <li><b>Account details:</b> name, phone, email, school and department.</li>
  <li><b>Agent verification:</b> ID documents, proof of authority to let, business details and payout account.</li>
  <li><b>Bookings and payments:</b> visits, payment references and amounts. Card and bank details are handled by our payment provider, not stored by Lodgely.</li>
  <li><b>Messages:</b> chats between students and agents, which are checked automatically for requests to pay outside the app.</li>
  <li><b>Device information:</b> basic data such as browser type and errors, to keep the service working.</li></ul>
 <h2>Why we use it</h2><p>To run bookings, payments, keys and renewals; to verify agents; to keep people safe from scams; and to send the reminders and notifications you choose in your settings.</p>
 <h2>Who we share it with</h2><p>Our payment provider, the licensed partner that holds rent savings, and the email and SMS services that send notifications. Agents see the name and contact number of students who book their houses. We share data with authorities only when the law requires it. We never sell personal data.</p>
 <h2>How long we keep it</h2><p>We keep payment and tenancy records for as long as the law requires. Other data is deleted when you delete your account, unless we need it to settle a dispute.</p>
 <h2>Your rights</h2><p>Under the Nigeria Data Protection Act 2023, you can ask to see, correct or delete your data, and object to how it is used. If you are not happy with our answer, you can complain to the Nigeria Data Protection Commission.</p>
 <h2>Security</h2><p>Passwords are stored encrypted, connections use HTTPS, and keys are checked on our servers.</p>
 <h2>Questions</h2><p><button class="link" data-act="page" data-p="contact">Contact us</button> about anything in this policy.</p>`;}
function pageView(){
 const f={about:pageAbout,help:pageHelp,contact:pageContact,terms:pageTerms,privacy:pagePrivacy}[S.page]||pageAbout;
 return `<section class="lsec page"><div class="lwrap pwrap"><div><button class="link small" data-act="pageBack">${ic('back',16)} Back</button></div>${f()}</div></section>${landingFooter()}`;
}
function landingFooter(){return `<footer class="lfoot"><div class="lwrap"><div class="brand">${KEYMARK}<span>Lodgely</span></div><nav class="flinks" aria-label="Footer">${[['about','About'],['help','Help centre'],['contact','Contact'],['terms','Terms'],['privacy','Privacy']].map(([k,l])=>`<button class="link small" data-act="page" data-p="${k}">${l}</button>`).join('')}</nav><p>Student housing for OAU, Ile-Ife.${DEMO?' This is a demo: payments are simulated and your data stays in this browser.':''}</p><button class="btn sm ghost" data-act="openApp">Open the app</button></div></footer>`;}

/* ---------- profile settings ---------- */
const NOTIF_CATS={student:[['messages','Messages from agents'],['visits','Visit reminders'],['payments','Payments and keys'],['renewals','Renewal reminders'],['ballots','Ballots']],agent:[['messages','Messages from students'],['bookings','New visit bookings'],['payouts','Payouts'],['tenants','Tenants and renewals'],['complaints','Complaints about your houses']]};
const meKind=()=>S.role==='agent'?'agent':'student';
const me=()=>S.role==='agent'?agent(MYID()):(S.students[MYID()]||{name:ME?ME.name:'',prefs:null});
function prefsOf(p,kind){const pr=Object.assign({},p.prefs||{});NOTIF_CATS[kind].forEach(([k])=>{if(!pr[k])pr[k]={email:true,sms:['visits','renewals','bookings','payouts','payments'].includes(k)};});return pr;}
const avatarHTML=(name,photo,cls='')=>`<div class="avatar ${cls}">${photo?`<img src="${photo}" alt="">`:initials(name)}</div>`;
V.settings=()=>{
 const ag=S.role==='agent',p=me(),kind=meKind(),pr=prefsOf(p,kind);
 return `${backRow('Profile and settings')}
 <section class="pf-head">${avatarHTML(p.name,p.photo,'lg')}<div class="stack" style="gap:6px"><h1>${esc(p.name)}</h1><p class="muted">${ag?esc(p.biz):esc(p.dept||'')+' · OAU'}</p><div class="btns"><label class="btn sm ghost" for="pf-photo">${p.photo?'Change photo':'Add photo'}</label><input id="pf-photo" type="file" accept="image/*" class="sr">${p.photo?'<button class="btn sm ghost danger-t" data-act="removePhoto">Remove</button>':''}</div></div></section>
 <section class="block"><h2>Your details</h2>
  <dl class="dl"><div><dt>${ag?'Name on your ID':'Name'}</dt><dd>${esc(p.name)}</dd></div>${ag?`<div><dt>Business</dt><dd>${esc(p.biz)}</dd></div>`:'<div><dt>School</dt><dd>Obafemi Awolowo University</dd></div>'}<div><dt>Phone</dt><dd>${esc(p.phone||'')} · <button class="link small" data-act="changePhone">Change</button></dd></div></dl>
  <p class="muted small">${ag?'Your name and business name match your verification documents. Contact support to change them.':'Your name matches your account and your keys. Contact support to change it.'}</p>
  <div class="form">${ag?`<div class="field"><label for="pf-bio">About you (shown on your profile)</label><textarea id="pf-bio" class="in" rows="3">${esc(p.bio||'')}</textarea></div>`:`<div class="field"><label for="pf-dept">Department and level</label><input id="pf-dept" class="in" value="${esc(p.dept||'')}"></div>`}
   <div class="field"><label for="pf-email">Email (your login)</label><input id="pf-email" class="in" type="email" value="${esc(p.email||(ME&&ME.email)||'')}" readonly aria-readonly="true"><span class="small muted">Contact support to change the email on your account.</span></div>
   <div><button class="btn sm" data-act="saveProfile">Save details</button></div></div></section>
 <section class="block"><h2>Notifications</h2><p class="muted small">You always get notifications in the app. Choose what also comes by email or SMS.</p>
  <div class="ntable" role="table" aria-label="Notification settings"><div class="nrow nh" role="row"><span role="columnheader">Notification</span><span role="columnheader">Email</span><span role="columnheader">SMS</span></div>
  ${NOTIF_CATS[kind].map(([k,l])=>`<div class="nrow" role="row"><span role="cell">${l}</span>${['email','sms'].map(ch=>`<span role="cell"><button class="sw ${pr[k][ch]?'on':''}" role="switch" aria-checked="${pr[k][ch]}" aria-label="${l} by ${ch==='sms'?'SMS':'email'}" data-act="prefToggle" data-c="${k}" data-ch="${ch}"></button></span>`).join('')}</div>`).join('')}</div></section>
 <section class="block"><h2>Security</h2><div class="btns"><button class="btn sm ghost" data-act="changePassword">Change password</button><button class="btn sm ghost" data-act="logout">Log out</button>${ag?'<button class="btn sm ghost" data-act="push" data-v="agent" data-id="a1">View your public profile</button>':''}</div></section>
 <section class="block"><h2>Help and legal</h2><div class="btns">${[['help','Help centre'],['contact','Contact support'],['terms','Terms of use'],['privacy','Privacy policy']].map(([k,l])=>`<button class="btn sm ghost" data-act="page" data-p="${k}">${l}</button>`).join('')}</div></section>
 <section class="block"><h2>Delete account</h2><p class="muted small">${ag?'To close an agent account, contact support. Your listings, tenants and payouts need to be settled first.':"This removes your account. You can't delete it while you have an active key, money held by Lodgely or a booked visit."}</p><div>${ag?'<button class="btn sm ghost" data-act="page" data-p="contact">Contact support</button>':'<button class="btn sm ghost danger-t" data-act="deleteAccount">Delete my account</button>'}</div></section>`;
};
function handleAvatar(input){
 const f=input.files&&input.files[0];if(!f)return;const url=URL.createObjectURL(f),img=new Image();
 img.onload=()=>{const c=document.createElement('canvas'),s=Math.min(img.naturalWidth,img.naturalHeight),z=240;c.width=z;c.height=z;c.getContext('2d').drawImage(img,(img.naturalWidth-s)/2,(img.naturalHeight-s)/2,s,s,0,0,z,z);const d=c.toDataURL('image/jpeg',.8);URL.revokeObjectURL(url);
  (async()=>{let photo=d;if(!DEMO){try{photo=await B.upload(dataUrlFile(d,'avatar.jpg'));}catch(e){toast(e.message);return;}}run('save_profile',{photo},{close:false,ok:'Photo updated.'});})();};
 img.onerror=()=>{URL.revokeObjectURL(url);toast("That file isn't an image we can read.");};img.src=url;
}
MODALS.phone=m=>{const err=m.err?`<p class="err">${esc(m.err)}</p>`:'';return m.stage==='code'?`${mhead('Confirm your new number')}<p class="muted">We sent a 6-digit code to ${esc(m.phone)}.</p><input id="ph-otp" class="in mono" style="font-size:26px;letter-spacing:.35em;text-align:center" inputmode="numeric" maxlength="6" autocomplete="one-time-code" aria-label="6-digit code" data-enter="phoneVerify" placeholder="000000">${err}<button class="btn block" data-act="phoneVerify">Confirm</button><p class="hint" style="justify-self:center">Demo: the code is <b class="mono">${m.code}</b></p>`
 :`${mhead('Change phone number')}<div class="field"><label for="ph-new">New phone number</label><input id="ph-new" class="in" inputmode="tel" value="${esc(m.phone)}" placeholder="0812 345 6789" data-enter="phoneSend"></div>${err}<button class="btn block" data-act="phoneSend">Send code</button>`;};
MODALS.password=m=>`${mhead('Change password')}<div class="field"><label for="pw-cur">Current password</label><input id="pw-cur" class="in" type="password" autocomplete="current-password"></div><div class="field"><label for="pw-new">New password</label><input id="pw-new" class="in" type="password" autocomplete="new-password" placeholder="At least 8 characters"></div><div class="field"><label for="pw-new2">Repeat new password</label><input id="pw-new2" class="in" type="password" autocomplete="new-password" data-enter="savePassword"></div>${m.err?`<p class="err">${esc(m.err)}</p>`:''}<button class="btn block" data-act="savePassword">Change password</button>`;

/* ---------- agent applicant screen ---------- */
const REJECT_REASONS=["ID document is unclear or doesn't match the name","Proof of authority is missing or not valid","Phone or email could not be confirmed",'Something else'];
V.pending=({id})=>{
 const a=agent(id||MYID());if(!a)return gone();
 const st=a.status,okI=ic('check',18),waitI=ic('clock',18).replace('class="ic"','class="ic" style="color:var(--warn)"'),badI=ic('x',18).replace('class="ic"','class="ic" style="color:var(--bad)"');
 const hasDocs=(a.docs||[]).length>0;
 const steps=[['Account created',okI],['Email confirmed',okI],['Documents uploaded',hasDocs?okI:waitI],['Admin review',st==='verified'?okI:st==='rejected'?badI:waitI]];
 return `${cur()?backRow('Your application'):''}
 ${head(esc(a.biz),st==='verified'?"You're verified":st==='rejected'?'Your application needs changes':'Verification in progress')}
 ${st==='pending'&&!hasDocs?`<div class="insp">${ic('alert',22)}<div><b>Upload your documents</b><p class="small">Send your ID and proof that you can let the property. Admin checks them within 12 to 24 hours.</p><div class="btns"><button class="btn sm" data-act="resubmitDocs" data-id="${a.id}">Upload documents</button></div></div></div>`
  :st==='pending'?`<div class="insp">${ic('clock',22)}<div><b>Admin is checking your documents</b><p class="small">This usually takes 12 to 24 hours. You'll get a notification and an SMS when it's done. You can't add houses until then.</p></div></div>`
  :st==='verified'?`<div class="insp ok-tone">${ic('check',22)}<div><b>Approved</b><p class="small">Your account is verified. You can now add houses and set up your payout account.</p></div></div>`
  :st==='rejected'?`<div class="insp" style="background:var(--bad-soft)">${ic('alert',22)}<div><b>What to fix</b><p class="small">${esc(a.rejectReason||'Admin did not give a reason.')}</p><div class="btns"><button class="btn sm" data-act="resubmitDocs" data-id="${a.id}">Upload new documents</button></div></div></div>`:''}
 <section class="block"><h2>Progress</h2><ul class="steps-v">${steps.map(([l,i])=>`<li>${i} ${l}</li>`).join('')}</ul></section>
 <section class="block"><h2>What you sent</h2><dl class="dl"><div><dt>Name</dt><dd>${esc(a.name)}</dd></div><div><dt>Business</dt><dd>${esc(a.biz)}</dd></div><div><dt>Phone</dt><dd>${esc(a.phone)}</dd></div></dl><ul class="rules small">${(a.docs||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>
 <div class="btns"><button class="btn sm ghost" data-act="page" data-p="help">Read the agent guide</button><button class="btn sm ghost" data-act="push" data-v="settings">Profile and settings</button><button class="btn sm ghost" data-act="logout">Log out</button></div>`;
};
MODALS.rejectAgent=m=>{const a=agent(m.id);return `${mhead('Reject '+esc(a.name)+'?')}<p class="muted">They'll see the reason and can upload new documents.</p>
 <div class="field"><span class="lbl">Reason</span><div class="methods" role="radiogroup" aria-label="Reason">${REJECT_REASONS.map(r=>`<label class="opt"><input type="radio" name="rjr" value="${esc(r)}" data-bind="modal.reason" ${m.reason===r?'checked':''}><span>${esc(r)}</span></label>`).join('')}</div></div>
 <div class="field"><label for="rj-note">Details for the agent (optional)</label><textarea id="rj-note" class="in" rows="2"></textarea></div>
 <div class="btns end"><button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn danger" data-act="rejectAgentYes">Reject</button></div>`;};
function supportHTML(){
 if(!S.support.length)return '<p class="muted">No support messages yet.</p>';
 return S.support.map(x=>`<article class="comp"><div class="comp-h"><div><b>${esc(x.name)}</b><span class="muted small">${esc(x.who)} · ${esc(x.topic)} · ${rel(x.t)}</span></div>${x.status==='answered'?chip('Answered','ok'):chip('New','warn')}</div><p>${esc(x.msg)}</p><p class="small muted">Reply to ${esc(x.contact)}</p><div class="btns"><button class="btn sm ghost" data-act="supportDone" data-id="${x.id}">${x.status==='answered'?'Mark as new':'Mark answered'}</button></div></article>`).join('');
}
Object.assign(ACT,{
 page:el=>{const p=el.dataset.p;tourEnd(false,true);if(S.screen!=='page')S.pageFrom=S.screen;S.screen='page';S.page=p;S.modal=null;
  if(p==='contact'&&!S.ctSent){const c=S.ct||(S.ct={name:'',contact:'',who:'Student',topic:'A house or a visit',msg:''});if(!c.name){if(S.pageFrom==='app'&&S.role==='agent'){c.name=agent(MYID()).name;c.contact=agent(MYID()).email||'';c.who='Agent or caretaker';}else if(LOGGED()){c.name=stu(MYID()).name;c.contact=S.students[MYID()].email||'';}}}
  save();render();renderModal();scrollTo(0,0);},
 pageBack:()=>{S.screen=S.pageFrom||'landing';S.ctSent=false;save();render();scrollTo(0,0);},
 sendContact:async()=>{
  const c=S.ct;['name','contact','msg'].forEach(k=>{const i=$('#ct-'+k);if(i)c[k]=i.value.trim();});
  S.ctErr=!c.name?'Add your name.':!(EMAIL_RE.test(c.contact)||PHONE_RE.test(c.contact))?'Add an email address or phone number so we can reply.':c.msg.length<10?'Tell us a little more in your message.':'';
  if(S.ctErr){render();return;}
  try{await B.call('contact_support',{name:c.name,contact:c.contact,who:c.who,topic:c.topic,msg:c.msg});}catch(e){S.ctErr=e.message;render();return;}
  S.ctSent=true;save();refresh().catch(()=>{});render();scrollTo(0,0);
 },
 contactAgain:()=>{S.ctSent=false;S.ct.msg='';render();},
 supportDone:el=>run('toggle_support_done',{id:el.dataset.id},{close:false}),
 removePhoto:()=>run('save_profile',{photo:''},{close:false,ok:'Photo removed.'}),
 saveProfile:()=>{const email=(($('#pf-email')||{}).value||'').trim();if(email&&!EMAIL_RE.test(email)){toast('Enter a valid email address.');return;}
  const a={};if(S.role==='agent')a.bio=(($('#pf-bio')||{}).value||'').trim();else a.dept=(($('#pf-dept')||{}).value||'').trim();
  run('save_profile',a,{close:false,ok:'Details saved.'});},
 prefToggle:el=>{const pr=JSON.parse(JSON.stringify(prefsOf(me(),meKind()))),c=el.dataset.c,ch=el.dataset.ch;pr[c][ch]=!pr[c][ch];run('save_prefs',{prefs:pr},{close:false});},
 changePhone:()=>{S.modal={type:'phone',stage:'enter',phone:''};renderModal();},
 phoneSend:()=>{const m=S.modal,v=(($('#ph-new')||{}).value||'').trim();m.phone=v;if(!PHONE_RE.test(v)){m.err='Enter a phone number like 0812 345 6789.';renderModal();return;}
  if(!DEMO){run('set_phone',{phone:v},{errTo:true,ok:'Phone number updated.'});return;}
  m.code=genCode();m.stage='code';m.err='';renderModal();},
 phoneVerify:()=>{const m=S.modal,v=(($('#ph-otp')||{}).value||'').trim();if(v!==m.code){m.err='That code is not right.';renderModal();return;}run('set_phone',{phone:m.phone},{errTo:true,ok:'Phone number updated.'});},
 changePassword:()=>{S.modal={type:'password'};renderModal();},
 savePassword:async()=>{const m=S.modal,c=($('#pw-cur')||{}).value||'',n1=($('#pw-new')||{}).value||'',n2=($('#pw-new2')||{}).value||'';const err=!c?'Enter your current password.':n1.length<8?'Use at least 8 characters for the new password.':n1!==n2?"The new passwords don't match.":n1===c?'Choose a different password from your current one.':'';if(err){m.err=err;renderModal();return;}
  try{await B.auth.changePassword({current:c,next:n1});}catch(e){m.err=e.message;renderModal();return;}
  run('note_password_changed',{},{ok:'Password changed.'});},
 deleteAccount:async()=>{
  let busyL=[];try{busyL=(await B.call('delete_account_check',{})).busy||[];}catch(e){toast(e.message);return;}
  if(busyL.length){S.modal={type:'info',title:"You can't delete your account yet",text:`You have ${busyL.join(', ').replace(/, ([^,]*)$/,' and $1')}. Once those are finished, you can delete your account here.`};renderModal();return;}
  S.modal={type:'confirm',title:'Delete your account?',text:'Your profile, saved houses and savings goal are removed. Payment records are kept as the law requires.'+(DEMO&&Object.values(B.people||{}).includes(MYID())?' Demo: this sample account is only logged out, so the sample data stays.':''),ok:'Delete account',act:'deleteAccountYes',danger:true};renderModal();
 },
 deleteAccountYes:async()=>{if(DEMO&&Object.values(B.people||{}).includes(MYID())){await ACT.logout();toast('Demo: you were logged out and the sample data was kept.');return;}
  const r=await run('delete_account',{},{});if(!r)return;await ACT.logout();toast('Account deleted.');},
 viewApplication:()=>{S.modal=null;renderModal();enterApp('agent','home');},
 rejectAgent:el=>{S.modal={type:'rejectAgent',id:el.dataset.id,reason:REJECT_REASONS[0]};renderModal();},
 rejectAgentYes:()=>{const m=S.modal,n=(($('#rj-note')||{}).value||'').trim();run('reject_agent',{id:m.id,reason:m.reason,note:n},{ok:r=>`${r.name} was asked to fix their application.`});},
 resubmitDocs:el=>{const a=agent(el.dataset.id||MYID());S.modal={type:'agentSignup',stage:'docs',resubmitId:a.id,name:a.name,biz:a.biz,phone:a.phone,email:'',btype:a.btype||'',rel:a.rel||'',idType:ID_TYPES[0],proofType:PROOF_TYPES[0]};renderModal();}
});

/* ---------- payment hold, QR, documents, location map ---------- */
const syncBar=()=>setStatusBar(true);
function hydrate(){
 document.querySelectorAll('[data-qr]:not([data-done])').forEach(el=>{
  el.setAttribute('data-done','1');
  try{const q=qrcode(0,'M');q.addData(el.dataset.qr);q.make();el.innerHTML=q.createSvgTag({cellSize:4,margin:2,scalable:true,alt:'QR code for '+el.dataset.qr});}
  catch(e){el.classList.add('qr-off');el.innerHTML='<p class="small">The QR code could not be drawn. The key code above works too.</p>';}
 });
}
const DL={save:({filename,data})=>saveFile(filename,data)};
function scanQR(input){
 const f=input.files&&input.files[0];if(!f)return;toast('Reading the QR code...');
 Promise.all([import('jsqr').then(m=>{window.jsQR=m.default;}),new Promise((res,rej)=>{const url=URL.createObjectURL(f),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);res(img);};img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('img'));};img.src=url;})])
  .then(([,img])=>{
   const sc=Math.min(1,1200/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*sc);c.height=Math.round(img.naturalHeight*sc);
   const x=c.getContext('2d');x.drawImage(img,0,0,c.width,c.height);const d=x.getImageData(0,0,c.width,c.height);const r=window.jsQR(d.data,c.width,c.height);
   if(!r||!r.data){toast('No QR code found in that photo. Try again closer, or type the code.');return;}
   S.vk={q:r.data.trim().toUpperCase()};render();toast('QR code read.');
  }).catch(()=>toast("Couldn't read that photo. Check your connection, or type the code."));
 input.value='';
}
function receiptDoc(p){
 const h=house(p.houseId),r=p.roomId?room(h,p.roomId):null,k=S.keys.find(x=>x.payId===p.id),a=agent(h.agentId);
 const kind={inspection:'Inspection fee',rent:'Rent',renewal:'Renewal'}[p.kind];
 const rows=[['Receipt number',p.ref],['Date',`${fmtDate(p.time)}, ${new Date(p.time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:TZ})}`],['Paid by',stu(p.studentId).name],['Paid to',`${a.biz} (${a.name}), through Lodgely`],['For',`${kind} · ${h.title}${r?', '+r.name:''}`],['Address',h.address]];
 if(p.kind==='inspection'){const i=S.inspections.find(x=>x.payId===p.id);if(i)rows.push(['Visit',fmtSlot(i.slot)]);}
 if(p.kind==='rent'&&k)rows.push(['Period',`${fmtDate(k.start)} to ${fmtDate(k.start+TERM*DAY)}`]);
 if(p.kind==='renewal')rows.push(['Period',`Another ${TERM} days`]);
 rows.push(['Amount',fmt(p.amount)]);
 if(p.savingsUsed)rows.push(['From rent savings',fmt(p.savingsUsed)],['Paid now',fmt(p.amount-p.savingsUsed)]);
 rows.push(['Method',p.method],['Status',{held:'Paid. Held by Lodgely until move-in',released:'Paid. Released to the agent',refunded:'Refunded to you',paid:'Paid'}[p.status]||p.status]);
 if(k&&p.kind!=='inspection')rows.push(['Subscription key',k.code]);
 return {title:'Payment receipt',file:`Lodgely receipt ${p.ref}.pdf`,rows,notes:['Keep this receipt. If something goes wrong, contact Lodgely support with the receipt number.',PAYMODE==='simulated'?'Test receipt. No real money moved.':'Payment processed by Paystack.']};
}
function agreementDoc(k){
 const h=house(k.houseId),r=room(h,k.roomId),a=agent(h.agentId),s=S.students[k.studentId]||{},p=S.payments.find(x=>x.id===k.payId);
 return {title:'Tenancy agreement',file:`Lodgely tenancy agreement ${k.code}.pdf`,sections:[
  {h:'1. The parties',rows:[['Tenant',`${stu(k.studentId).name}${s.dept?', '+s.dept:''}`],['Agent',`${a.name}, ${a.biz} (verified by Lodgely)`]]},
  {h:'2. The room',rows:[['House',h.title],['Room',r.name],['Address',h.address]]},
  {h:'3. The term',rows:[['Starts',fmtDate(k.start)],['Ends',fmtDate(k.end)],['Length',`${Math.round((k.end-k.start)/DAY)} days`],['Subscription key',k.code]]},
  {h:'4. Rent',rows:[['Rent',`${fmt(p?p.amount:r.price)} for the term, paid in full`],['Payment reference',p?p.ref:'Not available']],paras:[`Lodgely holds the rent until the tenant confirms move-in, or for 7 days after payment, and then pays it to the agent less a ${COMM*100}% commission.`]},
  {h:'5. House rules',list:h.rules.length?h.rules:['No house rules were listed.']},
  {h:'6. What each side agrees to',list:['The agent hands over the room on the start date, in the condition shown on the listing.','The agent keeps water, power and security working as described on the listing, and gives notice before entering the room.','The tenant keeps the room in good condition, follows the house rules and does not sublet the room.','Neither side asks for or makes payments for this room outside Lodgely.']},
  {h:'7. Ending and renewal',paras:['The tenancy ends on the end date unless the tenant renews in the app. The tenant has the first right to renew. If they do not, the room may go to a ballot winner.']},
  {h:'8. Disputes',paras:['Either side can raise a dispute in Lodgely. While rent is still held, Lodgely can refund the tenant after reviewing the chat and payment record.']},
  {h:'9. Acceptance',paras:[`Accepted in the Lodgely app by ${stu(k.studentId).name} on ${fmtDate(p?p.time:k.start)}, when the rent was paid. ${a.name} accepted Lodgely's listing terms when ${h.title} was published.`]}],
  notes:['Sample agreement for the demo. A lawyer should prepare the final version before launch.']};
}
const docFor=(kind,id)=>kind==='receipt'?receiptDoc(S.payments.find(x=>x.id===id)):agreementDoc(S.keys.find(x=>x.code===id));
const dlRows=rows=>`<dl class="dl">${rows.map(([l,v])=>`<div><dt>${esc(l)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
function docHTML(d){
 return `<article class="docpaper"><div class="doc-h"><div class="brand doc-brand">${KEYMARK}<span>Lodgely</span></div><p class="eyebrow">${esc(d.title)}</p></div>
 ${d.rows?dlRows(d.rows):''}
 ${(d.sections||[]).map(s=>`<section class="doc-s"><h3>${esc(s.h)}</h3>${s.rows?dlRows(s.rows):''}${(s.paras||[]).map(x=>`<p>${esc(x)}</p>`).join('')}${s.list?`<ul class="rules">${s.list.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</section>`).join('')}
 ${d.notes.map(n=>`<p class="small muted">${esc(n)}</p>`).join('')}</article>`;
}
function docText(d){
 const L=[`Lodgely · ${d.title}`,''];(d.rows||[]).forEach(([l,v])=>L.push(`${l}: ${v}`));
 (d.sections||[]).forEach(s=>{L.push('',s.h);(s.rows||[]).forEach(([l,v])=>L.push(`${l}: ${v}`));(s.paras||[]).forEach(x=>L.push(x));(s.list||[]).forEach(x=>L.push('- '+x));});
 L.push('');d.notes.forEach(n=>L.push(n));return L.join('\n');
}
function docActions(kind,id){return `<div class="btns">${DL?`<button class="btn sm" data-act="docPdf" data-k="${kind}" data-id="${esc(id)}">Download PDF</button>`:''}<button class="btn sm ghost" data-act="docCopy" data-k="${kind}" data-id="${esc(id)}">Copy details</button></div>${DL?'':`<p class="muted small">Downloading isn't available in this view, so you can copy the details instead.</p>`}`;}
V.receipt=({id})=>{const p=S.payments.find(x=>x.id===id);if(!p)return gone();return `${backRow('Receipt')}${docActions('receipt',id)}${docHTML(receiptDoc(p))}`;};
V.agreement=({code})=>{const k=S.keys.find(x=>x.code===code);if(!k)return gone();return `${backRow('Tenancy agreement')}${docActions('agreement',code)}${docHTML(agreementDoc(k))}`;};
async function docPdfBlob(d){
 const {jsPDF}=await import('jspdf');const doc=new jsPDF({unit:'pt',format:'a4'});
 const T=s=>String(s).replace(/₦/g,'NGN ').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/−/g,'-');
 const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),M=48;let y=0;
 const need=h=>{if(y+h>H-M){doc.addPage();y=M;}};
 doc.setFillColor(27,42,107);doc.rect(0,0,W,66,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(20);doc.text('Lodgely',M,42);doc.setFont('helvetica','normal');doc.setFontSize(11);doc.text(T(d.title),W-M,42,{align:'right'});y=100;
 const rowsOut=rows=>rows.forEach(([l,v])=>{const lines=doc.splitTextToSize(T(v),W-M*2-150);need(lines.length*14+6);doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(89,96,131);doc.text(T(l),M,y);doc.setTextColor(21,25,51);doc.setFont('helvetica','bold');doc.text(lines,M+150,y);y+=lines.length*14+6;});
 const para=(s,o={})=>{doc.setFont('helvetica',o.bold?'bold':'normal');doc.setFontSize(o.size||10);const lines=doc.splitTextToSize(T(s),W-M*2-(o.indent||0));need(lines.length*14+4);doc.text(lines,M+(o.indent||0),y);y+=lines.length*14+4;};
 if(d.rows)rowsOut(d.rows);
 (d.sections||[]).forEach(s=>{y+=8;need(30);doc.setTextColor(36,56,138);para(s.h,{bold:true,size:12});doc.setTextColor(21,25,51);if(s.rows)rowsOut(s.rows);(s.paras||[]).forEach(x=>para(x));(s.list||[]).forEach(x=>para('•  '+x,{indent:8}));});
 y+=12;doc.setTextColor(89,96,131);d.notes.forEach(n=>para(n,{size:9}));
 return doc.output('blob');
}
function miniMap(h){
 const [x,y]=AREAS[h.area]||[200,140],gx=134,gy=158;
 const road=d=>`<path d="${d}" fill="none" stroke-width="10" stroke-linecap="round" style="stroke:var(--map-edge)"/><path d="${d}" fill="none" stroke-width="7" stroke-linecap="round" style="stroke:var(--map-road)"/>`;
 const font='font-family="Hanken Grotesk,system-ui,sans-serif"';
 const labels=AREA_NAMES.filter(a=>a!==h.area).map(a=>{const [ax,ay]=AREAS[a];return `<text x="${ax}" y="${ay+4}" text-anchor="middle" font-size="9" ${font} opacity=".75" style="fill:var(--muted)">${a}</text>`;}).join('');
 const anchor=x>300?'end':x<90?'start':'middle',lx=anchor==='end'?x+16:anchor==='start'?x-16:x,ly=y<80?y+16:y-52;
 return `<div class="map"><svg viewBox="0 0 400 260" role="img" aria-label="Schematic map: ${esc(h.title)} in ${esc(h.area)}, ${h.km} km from the OAU main gate">
  <rect width="400" height="260" style="fill:var(--map-land)"/>
  <path d="M8 150Q40 122 112 140Q150 158 138 222Q108 262 34 256Q4 236 8 150Z" style="fill:var(--map-campus)"/>
  <text x="70" y="206" text-anchor="middle" font-size="11" font-weight="700" font-family="Archivo,system-ui,sans-serif" style="fill:var(--ok)">OAU campus</text>
  ${road('M134 158C200 140 270 128 396 118')}${road('M60 10C110 50 160 90 162 126')}${road('M262 112C280 150 296 180 304 252')}${road('M200 30C206 80 214 140 222 190')}
  ${labels}
  <path d="M${x} ${y}L${gx} ${gy}" stroke-width="2.5" stroke-dasharray="6 5" fill="none" style="stroke:var(--link)"/>
  <circle cx="${gx}" cy="${gy}" r="6" style="fill:var(--ok)"/><text x="${gx-8}" y="${gy+18}" text-anchor="end" font-size="9.5" font-weight="700" ${font} style="fill:var(--ok)">Main gate</text>
  <path d="M${x} ${y}c-11-15-18-20-18-30a18 18 0 0 1 36 0c0 10-7 15-18 30z" style="fill:var(--primary)"/><circle cx="${x}" cy="${y-30}" r="6" style="fill:var(--on-primary)"/>
  <text x="${lx}" y="${ly}" text-anchor="${anchor}" font-size="11" font-weight="700" ${font} paint-order="stroke" stroke-width="4" stroke-linejoin="round" style="fill:var(--ink);stroke:var(--map-land)">${esc(h.title)}</text>
 </svg></div>`;
}
Object.assign(ACT,{
 docPdf:async el=>{
  const d=docFor(el.dataset.k,el.dataset.id);
  let blob;try{toast('Preparing the PDF...');blob=await docPdfBlob(d);}catch(e){toast("Couldn't build the PDF. Try again.");return;}
  try{await DL.save({filename:d.file,data:blob});toast('PDF ready.');}
  catch(e){const c=e&&e.code;toast(c==='declined'?'Download cancelled.':c==='rate_limited'?'Another download is already waiting for your answer.':"Couldn't save the file here.");}
 },
 releaseRoom:el=>run('release_room',{roomId:el.dataset.r},{ok:'Room released. Other students can rent it now.'}),
 docCopy:el=>{const t=docText(docFor(el.dataset.k,el.dataset.id)),fail=()=>toast("Copying isn't available here. Select the text on the page instead.");try{navigator.clipboard.writeText(t).then(()=>toast('Details copied.'),fail);}catch(e){fail();}}
});

/* ---------- guided tour ---------- */
const TOUR=[
 {sel:'.search',t:'Search near OAU',d:'Type an area like Damico or Asherifa, or the name of a house.'},
 {sel:'.filters',t:'Narrow it down',d:'Set your budget, room type and area. The buttons below add must-haves like steady water or a prepaid meter.'},
 {sel:'#results .card',t:'Read a listing at a glance',d:'Swipe the photos. The badges show the room type and the walk to the gate. Tap the heart to save it.'},
 {sel:'.tab[data-t="lodge"]',t:'Your key lives here',d:'Inspect a house and pay rent, and your subscription key and countdown appear in My lodge. Lodgely holds the rent until you move in.'},
 {sel:'.tab[data-t="messages"]',t:'Chat inside Lodgely',d:'Message agents here. Never send money outside the app. Lodgely flags messages that ask for it.'}
];
function tourDone(){try{return localStorage.getItem('lodgely-tour')==='done';}catch(e){return !!window.__lodgelyTour;}}
function maybeTour(){if(tourState||tourDone()||S.screen!=='app'||S.role!=='student'||S.modal||nav().tab!=='explore'||nav().stack.length)return;startTour();}
function startTour(){
 tourState={i:0};let tries=0;
 const wait=()=>{if(!tourState)return;if($('#results .card')||tries>40){showStep();return;}tries++;setTimeout(wait,100);};
 wait();
}
function showStep(){
 if(!tourState)return;
 const st=TOUR[tourState.i],el=$(st.sel);
 if(!el){if(tourState.i<TOUR.length-1){tourState.i++;showStep();}else tourEnd(true);return;}
 if(!el.closest('.tabbar')&&!el.closest('.band')&&el.scrollIntoView)el.scrollIntoView({block:'center'});
 const last=tourState.i===TOUR.length-1;
 tourRoot.innerHTML=`<div class="t-block" data-act="noop"></div><div class="t-spot"></div><div class="t-card" role="dialog" aria-modal="true" aria-labelledby="t-title">
  <div class="t-prog" aria-hidden="true">${TOUR.map((_,j)=>`<i class="${j<=tourState.i?'on':''}"></i>`).join('')}</div>
  <p class="eyebrow">Step ${tourState.i+1} of ${TOUR.length}</p><h3 id="t-title">${st.t}</h3><p>${st.d}</p>
  <div class="t-foot"><button class="link small" data-act="tourSkip">Skip tour</button><div class="btns">${tourState.i?'<button class="btn sm ghost" data-act="tourBack">Back</button>':''}<button class="btn sm" id="t-next" data-act="tourNext">${last?'Start exploring':'Next'}</button></div></div></div>`;
 placeTour();
 const n=$('#t-next');if(n)n.focus({preventScroll:true});
}
function placeTour(){
 if(!tourState)return;
 const el=$(TOUR[tourState.i].sel),spot=tourRoot.querySelector('.t-spot'),cd=tourRoot.querySelector('.t-card');if(!el||!spot||!cd)return;
 const r=el.getBoundingClientRect(),p=6,vw=innerWidth,vh=innerHeight;
 Object.assign(spot.style,{top:(r.top-p)+'px',left:(r.left-p)+'px',width:(r.width+p*2)+'px',height:(r.height+p*2)+'px'});
 const cw=cd.offsetWidth,ch=cd.offsetHeight;let top=r.bottom+14;if(top+ch>vh-12)top=Math.max(12,r.top-ch-14);
 const left=Math.min(Math.max(16,r.left+r.width/2-cw/2),Math.max(16,vw-cw-16));
 Object.assign(cd.style,{top:top+'px',left:left+'px'});
}
function tourEnd(done,silent){
 if(!tourState)return;tourState=null;tourRoot.innerHTML='';
 try{localStorage.setItem('lodgely-tour','done');}catch(e){window.__lodgelyTour=true;}
 if(!silent)toast(done?'You are all set. Tap Demo any time for the full walkthrough.':'Tour skipped. You can replay it from Demo.');
}
/* ---------- boot ---------- */
S=Object.assign(uiDefaults(),loadUI());S.modal=null;
if(themePref==='light'||themePref==='dark')root.setAttribute('data-theme',themePref);else if(themePref==='system')root.removeAttribute('data-theme');
try{new MutationObserver(()=>{const a=root.getAttribute('data-theme'),want=(themePref==='light'||themePref==='dark')?themePref:null;if(a!==want)themePref=a||'system';syncTheme();syncBar();}).observe(root,{attributes:true,attributeFilter:['data-theme']});}catch(e){}
document.addEventListener('scroll',e=>{const t=e.target;if(t&&t.classList&&t.classList.contains('gal-track'))setDots(t.parentNode,Math.round(t.scrollLeft/(t.clientWidth||1)));},true);
addEventListener('resize',placeTour);
addEventListener('scroll',()=>{if(tourState)requestAnimationFrame(placeTour);},{passive:true});
loadedViews.add(viewKey());
render();
try{await refresh();}catch(e){LOAD_ERR=e.message||'Check your connection.';}
// returning from Paystack in a browser tab: ?pay=REF
try{const q=new URLSearchParams(location.search),ref=q.get('pay');if(ref){history.replaceState(null,'',location.pathname);
 if(B.user()){try{await B.providerVerify(ref);}catch(e){}const st=await B.call('payment_status',{ref});await refresh();S.screen='app';
  S.modal={type:'info',title:st.status==='pending'?'Payment still processing':st.result&&st.result.error?'Payment not completed':'Payment received',text:st.status==='pending'?'We have not heard from the bank yet. This page updates by itself, and you will get a notification.':st.result&&st.result.error?st.result.error:'You can close this tab and go back to the app, or carry on here.'};}}}catch(e){}
render();renderModal();maybeTour();syncBar();
B.onChange(async()=>{try{await refresh();bgRender();}catch(e){}});
initNative({onBack:()=>{if(S.modal&&S.modal.stage!=='processing'){ACT.closeModal();return true;}if(S.screen==='page'){ACT.pageBack();return true;}if(S.screen==='app'&&nav().stack.length){ACT.back();return true;}return false;},onResume:()=>refresh().then(bgRender).catch(()=>{})});
setInterval(tick,1000);
}
