(function(){
"use strict";

/* ---------- Reference data ---------- */
const FIL={BAT:"Batteries et matériaux",MOB:"Mobilité électrique",ROB:"Robotique et industrie",ENR:"Solaire et éolien",SAN:"Santé",CON:"Consommation et agroalimentaire",NUM:"Numérique",FRC:"France–Chine / UE–Chine",ECO:"Économie générale"};
const TYPES={conjoncture:{lab:"Conjoncture",sw:"sw-cj",seg:"seg-cj"},fait:{lab:"Fait marquant",sw:"sw-fm",seg:"seg-fm"},opportunite:{lab:"Opportunité",sw:"sw-op",seg:"seg-op"}};
const TYPE_ORDER=["conjoncture","fait","opportunite"];
const ZONES={CAN:"Canton",CHE:"Chengdu",HKM:"Hong Kong et Macao",NAT:"National"};
const RUBRIQUES=["Conjoncture","Banque et finance","Échanges et politique commerciale","Industrie et numérique","Développement durable, énergie et transports"];
const PROV_ZONE={"广东":"can","福建":"can","广西":"can","海南":"can","四川":"che","重庆":"che","贵州":"che","云南":"che","香港":"hkm","澳门":"hkm"};
const PROV_LABELS=[["Guangdong",113.6,24.4,true],["Fujian",118.0,26.2,true],["Guangxi",108.6,23.9,true],["Hainan",109.8,19.1,true],["Sichuan",102.6,30.6,true],["Chongqing",107.6,30.2,true],["Guizhou",106.8,27.0,true],["Yunnan",101.3,24.4,true],["Hunan",111.6,27.6,false],["Jiangxi",115.8,27.4,false],["Hubei",112.3,31.0,false],["Zhejiang",120.0,29.1,false]];
const SEA_LABELS=[["Mer de Chine méridionale",114.5,19.0],["Golfe du Tonkin",107.6,20.3],["Détroit de Taïwan",119.9,24.0]];
const KEYCITIES={Canton:[113.26,23.13],Shenzhen:[114.06,22.54],Xiamen:[118.09,24.48],Fuzhou:[119.30,26.07],Nanning:[108.37,22.82],Haikou:[110.32,20.04],Chengdu:[104.07,30.57],Chongqing:[106.55,29.56],Guiyang:[106.63,26.65],Kunming:[102.71,25.04],"Hong Kong":[114.17,22.32]};
const MINORCITIES={Dongguan:[113.75,23.02],Foshan:[113.12,23.02],Zhuhai:[113.58,22.27],Macao:[113.55,22.20],Huizhou:[114.42,23.11],Zhongshan:[113.39,22.52],Jiangmen:[113.08,22.58],Quanzhou:[118.68,24.87],Ningde:[119.55,26.66],Putian:[119.01,25.45],Zhangzhou:[117.65,24.51],Mianyang:[104.68,31.47],Deyang:[104.40,31.13],Leshan:[103.77,29.55],Yibin:[104.63,28.77],Zigong:[104.78,29.34]};
const FRAMES={sud:[97,17.3,123.5,33.6],delta:[111.9,21.4,115.1,24.0],fujian:[116.4,23.4,120.6,27.6],sichuan:[102.4,28.2,108.8,32.4]};

/* Mercator over 97°E–123.5°E, 17.3°N–33.6°N in an 800-unit-wide space. */
const LON0=97,LON1=123.5,LAT0=17.3,LAT1=33.6,W=800;
const mY=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))*180/Math.PI;
const K=W/(LON1-LON0), H=Math.round((mY(LAT1)-mY(LAT0))*K);
const px=lon=>(lon-LON0)*K, py=lat=>(mY(LAT1)-mY(lat))*K;
const frameBox=f=>[px(f[0]),py(f[3]),px(f[2]),py(f[1])];

/* ---------- State ---------- */
const reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
const store={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
const defaultFilters=()=>({zones:new Set(["CAN","CHE","NAT","HKM"]),types:new Set(TYPE_ORDER),fils:new Set(),period:"90",fr:false,statut:"publie"});
const S={items:[],syntheses:[],cinq:[],agenda:[],sources:[],meta:null,dbState:"pending",snapshot:null,
  f:defaultFilters(),city:null,view:"today",groupBy:"date",synthP:"jour",canEdit:false,current:null,animMarks:true,filOpen:true,
  vs:null,k0:1,zs:1,frame:"sud",groupMode:"base",prevVisit:null,read:new Set()};
const VIEWS=["today","syntheses","fil","sources"];
{const v=store.get("vcs.view"); if(VIEWS.includes(v)) S.view=v;
 const h=(location.hash||"").replace("#",""); if(VIEWS.includes(h)) S.view=h;
 if(store.get("vcs.filOpen")==="0") S.filOpen=false;
 S.prevVisit=store.get("vcs.lastVisit");
 try{S.read=new Set(JSON.parse(store.get("vcs.read")||"[]"));}catch(e){}}

/* ---------- Helpers ---------- */
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const el=(tag,attrs={},...kids)=>{const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(v==null||v===false)continue;if(k==="class")n.className=v;else if(k.startsWith("on"))n.addEventListener(k.slice(2),v);else n.setAttribute(k,v===true?"":v);}for(const k of kids.flat()){if(k==null||k===false)continue;n.append(k.nodeType?k:document.createTextNode(String(k)));}return n;};
const put=(n,...k)=>n.append(...k.flat().filter(x=>x!=null&&x!==false));
const svgEl=(tag,attrs={})=>{const n=document.createElementNS("http://www.w3.org/2000/svg",tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n;};
const fmtD=(iso,o={day:"numeric",month:"long",year:"numeric"})=>{if(!iso)return"";const d=new Date(iso.length<=10?iso+"T12:00:00":iso);return isNaN(d)?iso:new Intl.DateTimeFormat("fr-FR",o).format(d);};
const fmtShort=iso=>fmtD(iso,{day:"numeric",month:"short"});
const dayKey=d=>d.toISOString().slice(0,10);
const today=new Date();
const daysAgo=iso=>(today-new Date(iso+"T12:00:00"))/864e5;
const daysTo=iso=>Math.ceil((new Date(iso+"T00:00:00")-new Date(dayKey(today)+"T00:00:00"))/864e5);
const isoWeek=d=>{const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const n=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-n);const y=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil(((t-y)/864e5+1)/7);};
const clip=(t,n)=>{t=t||"";if(t.length<=n)return t;const c=t.slice(0,n);const i=c.lastIndexOf(" ");return (i>n*0.6?c.slice(0,i):c).replace(/[\s,;:–-]+$/,"")+"…";};
const baseCity=v=>(v||"").replace(/\s*\(.*\)\s*$/,"");
const relLabel=r=>({A:"Fiabilité A, émetteur primaire",B:"Fiabilité B, média de référence",C:"Fiabilité C, à recouper"}[r]||("Fiabilité "+r));
const sorted=arr=>arr.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")||(a.titre||"").localeCompare(b.titre||""));
const published=()=>S.items.filter(i=>i.statut==="publie");
const isNew=it=>S.prevVisit&&it.collecte&&it.collecte>S.prevVisit;
const isUnread=it=>isNew(it)&&!S.read.has(it.id);
const markRead=it=>{if(!it||S.read.has(it.id))return;S.read.add(it.id);store.set("vcs.read",JSON.stringify([...S.read].slice(-600)));};
const swatch=t=>el("i",{class:"sw "+(TYPES[t]||TYPES.fait).sw});

/* ---------- Theme ---------- */
const ICON_MOON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
const ICON_SUN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
function applyTheme(t){document.documentElement.setAttribute("data-theme",t);const b=$("#btn-theme");const dark=t==="dark";b.innerHTML=dark?ICON_SUN:ICON_MOON;b.setAttribute("aria-label",dark?"Passer en mode clair":"Passer en mode sombre");b.title=dark?"Mode clair":"Mode sombre";}
applyTheme(store.get("vcs.theme")==="dark"?"dark":"light");
$("#btn-theme").addEventListener("click",()=>{const t=document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";store.set("vcs.theme",t);applyTheme(t);});

/* ---------- Filtering ---------- */
function passes(it,o={}){
  const f=S.f;
  if(f.statut==="publie"&&it.statut!=="publie")return false;
  if(f.statut==="a_confirmer"&&it.statut!=="a_confirmer")return false;
  if(!f.zones.has(it.zone))return false;
  if(!f.types.has(it.type))return false;
  if(f.fils.size&&!(it.filieres||[]).some(x=>f.fils.has(x)))return false;
  if(f.fr&&!it.interetFrance)return false;
  if(!o.ignorePeriod&&f.period!=="all"){const lim=f.period==="1"?1.5:Number(f.period); if(daysAgo(it.date)>lim)return false;}
  return true;
}
const inCity=(it,c)=>it.ville&&(it.ville===c||baseCity(it.ville)===c);
const nPending=()=>S.items.filter(i=>i.statut==="a_confirmer").length;
function summaryText(){const n=S.items.filter(i=>passes(i));const c=new Set(n.filter(i=>i.ville).map(i=>baseCity(i.ville)));return n.length+" brève"+(n.length>1?"s":"")+", "+c.size+" ville"+(c.size>1?"s":"");}
function activeText(){const f=S.f,p=[];
  p.push(["CAN","CHE","NAT"].every(z=>f.zones.has(z))?"Toutes zones":["CAN","CHE","NAT"].filter(z=>f.zones.has(z)).map(z=>ZONES[z]).join(", ")||"Aucune zone");
  p.push(f.types.size===3?"Tous types":[...f.types].map(t=>TYPES[t].lab).join(", ")||"Aucun type");
  p.push(f.fils.size?[...f.fils].map(k=>FIL[k]).join(", "):"Toutes filières");
  p.push({"1":"Jour","7":"7 jours","30":"30 jours","90":"90 jours","all":"Toute la période"}[f.period]);
  if(f.fr)p.push("Intérêt France"); if(f.statut==="a_confirmer")p.push("À confirmer");
  return p.join(" · ");}
function resetFilters(){S.f=defaultFilters();S.animMarks=true;renderAll();}
const rerender=()=>{S.animMarks=true;renderAll();};
const tog=(set,v)=>()=>{set.has(v)?set.delete(v):set.add(v);rerender();};
function chip(label,pressed,onclick,lead,title){return el("button",{class:"chip","aria-pressed":pressed?"true":"false",onclick,title,type:"button"},lead||null,label);}
const PERIODS=[["7","7 j"],["30","30 j"],["90","90 j"],["all","Tout"]];

/* ---------- Header ---------- */
function renderHeader(){
  $("#dl-today").textContent=new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long"}).format(today)+", semaine "+isoWeek(today);
  const m=S.meta;
  $("#dl-collect").textContent=m&&m.derniereCollecte?fmtD(m.derniereCollecte,{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"—";
  $("#dl-fx").textContent=m&&m.tauxEURCNY?"1 EUR = "+String(m.tauxEURCNY).replace(".",",")+" CNY (BCE, "+fmtShort(m.tauxDate)+")":"";
  $("#dl-snap").hidden=!S.snapshot; if(S.snapshot) $("#dl-snap").textContent="Instantané"+(typeof S.snapshot==="string"?" du "+fmtD(S.snapshot,{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"");
  $("#cnt-fil").textContent=published().length||"";
}

/* ---------- Morning view ---------- */
function stateMsg(){
  if(S.dbState==="pending") return el("div",{class:"empty"},el("b",{},"Chargement de la veille…"),"Les brèves s'affichent dès que les données répondent.");
  return el("div",{class:"empty"},el("b",{},"Les données de la veille ne sont pas disponibles"),"Ni la base partagée ni l'instantané publié avec la page n'ont pu être lus. Rechargez la page dans quelques instants.");
}
function renderMorning(){
  const host=$("#morning"); host.replaceChildren();
  if(S.dbState!=="ready"){put(host,el("div",{class:"paper mcard"},stateMsg()));return;}
  const pub=published();
  const first=!S.prevVisit;
  const fresh=sorted(first?pub.filter(i=>daysAgo(i.date)<=1.5):S.items.filter(i=>isNew(i)&&i.statut!=="rejete"));
  const nNew=fresh.filter(i=>i.statut==="publie").length, nOpp=fresh.filter(i=>i.type==="opportunite").length, nPend=fresh.filter(i=>i.statut==="a_confirmer").length;
  const day=S.syntheses.filter(x=>x.periode==="jour").sort((a,b)=>(b.fin||"").localeCompare(a.fin||""))[0];
  const kick=first?"Dernières 24 heures":"Depuis votre dernière visite, "+fmtD(S.prevVisit,{weekday:"long",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
  const left=el("div",{class:"paper mcard"},
    el("div",{class:"kicker"},nNew?el("span",{class:"dot"}):null,kick),
    el("div",{class:"since"},
      el("span",{},el("b",{class:nNew?"hot":null},nNew),nNew>1?"nouvelles brèves":"nouvelle brève"),
      el("span",{},el("b",{},nOpp),nOpp>1?"opportunités":"opportunité"),
      el("span",{},el("b",{},nPend),"à confirmer")),
    fresh.length?el("ul",{class:"newlist"},...fresh.slice(0,5).map(it=>el("li",{},el("button",{type:"button",onclick:()=>openFiche(it)},isUnread(it)?el("i",{class:"unread",title:"Non lue"}):swatch(it.type),el("span",{class:"t"},it.titre),el("span",{class:"d"},fmtShort(it.date)))))):el("p",{class:"lede"},"Rien de nouveau pour l'instant. La prochaine collecte a lieu demain à 7 h."),
    day?el("div",{style:"display:grid;gap:6px;border-top:1px solid var(--line);padding-top:12px;margin-top:2px"},
      el("div",{class:"h3"},"Synthèse du jour, "+fmtShort(day.fin)),
      el("h2",{class:"headline"},day.titre),
      el("p",{class:"lede"},clip(day.lead,260)),
      el("div",{},el("button",{class:"linkbtn",type:"button",onclick:()=>{S.synthP="jour";setView("syntheses");}},"Lire la synthèse du jour →"))):null);
  const d30=pub.filter(i=>daysAgo(i.date)<=30).length;
  const villes=new Set(pub.filter(i=>i.ville&&daysAgo(i.date)<=90).map(i=>baseCity(i.ville))).size;
  const opp=pub.filter(i=>i.type==="opportunite"&&daysAgo(i.date)<=60).length;
  const up=S.agenda.filter(a=>(a.fin||a.date)>=dayKey(today)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4);
  const right=el("div",{class:"paper mcard"},
    el("div",{class:"kpis"},...[[d30,"brèves, 30 jours"],[villes,"villes, 90 jours"],[opp,"opportunités ouvertes"]].map(([v,l])=>el("div",{class:"kpi"},el("div",{class:"v"},v),el("div",{class:"l"},l)))),
    el("div",{class:"h3"},"À venir"),
    up.length?el("ul",{class:"agenda-mini"},...up.map(a=>{const j=daysTo(a.date);return el("li",{title:(a.ville?a.ville+" : ":"")+a.titre},el("span",{class:"when"},a.fin&&a.fin!==a.date?fmtShort(a.date)+" – "+fmtShort(a.fin):fmtShort(a.date)),el("span",{class:"what"},a.url?el("a",{href:a.url,target:"_blank",rel:"noopener"},a.titre):a.titre),el("span",{class:"jx"},j>0?"J-"+j:"en cours"));})):el("p",{class:"muted"},"Aucun événement daté."),
    el("div",{},el("button",{class:"linkbtn",type:"button",onclick:()=>$("#cinq-body").scrollIntoView({behavior:reduce?"auto":"smooth"})},"L'essentiel en 5 minutes ↓")));
  put(host,left,right);
}

/* ---------- Brief card ---------- */
function briefCard(it){
  const t=TYPES[it.type]||TYPES.fait;
  return el("article",{class:"brief t-"+it.type,tabindex:"0",role:"button","aria-label":"Ouvrir la fiche : "+it.titre,
      onclick:()=>openFiche(it),onkeydown:e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openFiche(it);}},
      onmouseenter:()=>hilite(it,true),onmouseleave:()=>hilite(it,false)},
    el("div",{class:"btop"},el("span",{class:"tpill"},el("i",{class:"sw "+t.sw}),t.lab),
      ...(it.filieres||[]).map(x=>el("span",{class:"fil"},FIL[x]||x)),
      it.interetFrance?el("span",{class:"fr",title:"Intérêt pour une entreprise ou une implantation française"},"Intérêt France"):null,
      it.statut==="a_confirmer"?el("span",{class:"pending"},"À confirmer"):null,
      el("span",{class:"bdate"},isUnread(it)?el("i",{class:"unread",title:"Non lue"}):null,fmtShort(it.date))),
    el("h3",{class:"btitle"},it.titre),
    el("p",{class:"bbody"},it.corps),
    (it.drapeaux||[]).length?el("div",{class:"flag"},"⚑ "+it.drapeaux.join(" ; ")):null,
    el("div",{class:"bmeta"},el("span",{class:"rel "+it.fiabilite},relLabel(it.fiabilite))),
    el("div",{class:"bsrc"},"Source : ",el("a",{href:it.source&&it.source.url,target:"_blank",rel:"noopener",onclick:e=>e.stopPropagation()},(it.source&&it.source.emetteur)||"lien"),it.source&&it.source.date?", "+fmtShort(it.source.date):""));
}
function hilite(it,on){ if(!it.ville) return; $$("#g-marks .pos").forEach(g=>{ const c=g.dataset.city; if(inCity(it,c)||c===it.ville) g.classList.toggle("hov",on); g.querySelector(".mk")?.classList.toggle("hover",on&&(inCity(it,c)||c===it.ville)); }); }

/* ---------- Side panel ---------- */
function renderSide(){
  const host=$("#side"); const prev=host.querySelector(".list"); const keep=prev&&host.dataset.mode===(S.city||"")?prev.scrollTop:0; host.replaceChildren(); host.dataset.mode=S.city||"";
  requestAnimationFrame(()=>{const l=host.querySelector(".list"); if(l&&keep) l.scrollTop=keep;});
  if(S.city){renderDossier(host);return;}
  const f=S.f;
  const head=el("header",{},
    el("div",{class:"hrow"},el("h2",{},"Brèves"),el("span",{class:"muted"},summaryText()),el("button",{class:"linkbtn",style:"margin-left:auto;font-size:12.5px",type:"button",onclick:resetFilters},"Réinitialiser")),
    el("div",{class:"chiprow",role:"group","aria-label":"Zone, type et période"},
      ...["CAN","CHE","NAT"].map(z=>chip(ZONES[z],f.zones.has(z),tog(f.zones,z))),
      el("span",{class:"sep"}),
      ...TYPE_ORDER.map(k=>chip(TYPES[k].lab,f.types.has(k),tog(f.types,k),swatch(k))),
      el("span",{class:"sep"}),
      ...PERIODS.map(([v,l])=>chip(l,f.period===v,()=>{f.period=v;rerender();}))),
    el("div",{class:"chiprow",role:"group","aria-label":"Filières et affichage"},
      chip("Intérêt France",f.fr,()=>{f.fr=!f.fr;rerender();}),
      chip("À confirmer ("+nPending()+")",f.statut==="a_confirmer",()=>{f.statut=f.statut==="a_confirmer"?"publie":"a_confirmer";rerender();}),
      el("span",{class:"sep"}),
      ...Object.keys(FIL).map(k=>chip(FIL[k],f.fils.has(k),tog(f.fils,k)))));
  const list=el("div",{class:"list"});
  put(host,head,list);
  if(S.dbState!=="ready"){put(list,stateMsg());return;}
  const items=sorted(S.items.filter(i=>passes(i)));
  if(!items.length){put(list,el("div",{class:"empty"},el("b",{},"Aucune brève pour ces filtres"),"Élargissez la période ou réactivez un type d'information."));return;}
  items.forEach(it=>put(list,briefCard(it)));
}
function sparkline(items,weeks){
  const w=300,h=34,start=new Date(today);start.setDate(start.getDate()-7*weeks);
  const c=new Array(weeks).fill(0);
  items.forEach(it=>{const k=Math.floor((new Date(it.date+"T12:00:00")-start)/(7*864e5));if(k>=0&&k<weeks)c[k]++;});
  const max=Math.max(1,...c), x=i=>i*(w/(weeks-1)), y=v=>h-3-(h-8)*v/max;
  const pts=c.map((v,i)=>x(i).toFixed(1)+","+y(v).toFixed(1));
  const s=svgEl("svg",{class:"spark",viewBox:"0 0 "+w+" "+h,preserveAspectRatio:"none",role:"img","aria-label":"Brèves par semaine sur "+weeks+" semaines"});
  put(s,svgEl("path",{class:"a",d:"M0,"+h+" L"+pts.join(" L")+" L"+w+","+h+" Z"}),svgEl("polyline",{class:"l",points:pts.join(" ")}),svgEl("circle",{class:"e",cx:x(weeks-1),cy:y(c[weeks-1]),r:2.6}));
  return s;
}
function renderDossier(host){
  const c=S.city;
  const all=sorted(S.items.filter(i=>i.statut!=="rejete"&&inCity(i,c)&&(S.f.statut!=="publie"||i.statut==="publie")));
  const one=all[0]||{};
  const fc={}; all.forEach(i=>(i.filieres||[]).forEach(x=>fc[x]=(fc[x]||0)+1));
  const fl=Object.entries(fc).sort((a,b)=>b[1]-a[1]).slice(0,5); const fmax=Math.max(1,...fl.map(x=>x[1]));
  const n90=all.filter(i=>daysAgo(i.date)<=90).length, nOpp=all.filter(i=>i.type==="opportunite").length, nFr=all.filter(i=>i.interetFrance).length;
  const head=el("header",{},
    el("button",{class:"back",type:"button",onclick:()=>unfocusCity()},"← Toutes les brèves"),
    el("div",{class:"hrow"},el("h2",{},c),one.villeZh?el("span",{class:"zh muted",lang:"zh"},baseCity(one.villeZh)===one.villeZh?one.villeZh:one.villeZh):null,el("span",{class:"muted"},one.province||"")),
    el("div",{class:"dossier-stats"},el("span",{},el("b",{},all.length),"brèves"),el("span",{},el("b",{},n90),"sur 90 jours"),el("span",{},el("b",{},nOpp),"opportunités"),el("span",{},el("b",{},nFr),"intérêt France")),
    el("div",{},el("div",{class:"h3",style:"margin:0 0 4px"},"Activité, 26 semaines"),sparkline(all,26)),
    fl.length?el("div",{class:"filbars"},...fl.map(([k,n])=>el("div",{class:"filbar"},el("span",{},FIL[k]||k),el("span",{},el("i",{style:"width:"+(100*n/fmax)+"%"})),el("span",{class:"n"},n)))):null);
  const list=el("div",{class:"list"});
  put(host,head,list);
  if(!all.length){put(list,el("div",{class:"empty"},el("b",{},"Aucune brève publiée pour cette ville")));return;}
  all.forEach(it=>put(list,briefCard(it)));
}

/* ---------- Map: base ---------- */
let geoReady=false, coastDrawn=false;
function decodeGeo(json){
  const scale=json.UTF8Scale||1024;
  const dec=(str,off)=>{const out=[];let x0=off[0],y0=off[1];for(let i=0;i<str.length;i+=2){let x=str.charCodeAt(i)-64,y=str.charCodeAt(i+1)-64;x=(x>>1)^(-(x&1));y=(y>>1)^(-(y&1));x+=x0;y+=y0;x0=x;y0=y;out.push([x/scale,y/scale]);}return out;};
  for(const f of json.features||[]){const g=f.geometry;if(!g||!g.encodeOffsets)continue;
    if(g.type==="Polygon")g.coordinates=g.coordinates.map((r,i)=>typeof r==="string"?dec(r,g.encodeOffsets[i]):r);
    else if(g.type==="MultiPolygon")g.coordinates=g.coordinates.map((p,i)=>p.map((r,j)=>typeof r==="string"?dec(r,g.encodeOffsets[i][j]):r));}
  return json;
}
const ringPath=r=>{let d="";r.forEach((p,i)=>{d+=(i?"L":"M")+px(p[0]).toFixed(1)+","+py(p[1]).toFixed(1);});return d+"Z";};
const featPath=g=>g.type==="Polygon"?g.coordinates.map(ringPath).join(""):g.type==="MultiPolygon"?g.coordinates.map(p=>p.map(ringPath).join("")).join(""):"";
function drawBase(){
  const svg=$("#map"); svg.replaceChildren();
  const g=svgEl("g"); svg.append(g);
  for(let lon=95;lon<=125;lon+=5){put(g,svgEl("line",{class:"grat",x1:px(lon),x2:px(lon),y1:-600,y2:H+600}));const t=svgEl("text",{class:"gratlab",x:px(lon)+4,y:H+14});t.textContent=lon+"° E";put(g,t);}
  for(let lat=15;lat<=35;lat+=5){put(g,svgEl("line",{class:"grat",x1:-600,x2:W+900,y1:py(lat),y2:py(lat)}));const t=svgEl("text",{class:"gratlab",x:-4,y:py(lat)-4,"text-anchor":"end"});t.textContent=lat+"° N";put(g,t);}
  for(const [n,lon,lat] of SEA_LABELS){const t=svgEl("text",{class:"sealab",x:px(lon),y:py(lat),"text-anchor":"middle"});t.textContent=n;put(g,t);}
  const land=svgEl("g",{id:"g-land"}); svg.append(land);
  const geo=window.__chinaGeo;
  if(geo&&!geoReady){try{decodeGeo(geo);geoReady=true;}catch(e){geoReady=false;}}
  if(geoReady){
    const feats=geo.features.filter(f=>f.properties&&f.properties.name!=="南海诸岛");
    const all=feats.map(f=>featPath(f.geometry)).join("");
    const anim=!reduce&&!coastDrawn;
    const waters=svgEl("g",{class:"waters"+(anim?" anim":"")}); put(land,waters);
    [[28,.12],[18,.22],[10,.36],[4,.6]].forEach(([w,o])=>put(waters,svgEl("path",{class:"waterline",d:all,"stroke-width":w,"stroke-opacity":o})));
    const fills=svgEl("g",{class:"fills"+(anim?" anim":"")}); put(land,fills);
    for(const f of feats){const z=PROV_ZONE[f.properties.name]||"out";put(fills,svgEl("path",{class:"prov "+z,d:featPath(f.geometry)}));}
    put(land,svgEl("path",{class:"coast"+(anim?" anim":""),d:all,pathLength:"1"}));
    coastDrawn=true;
    $("#basemap-note").textContent="Fond : limites provinciales (jeu ECharts 4.9), projection Mercator.";
  } else $("#basemap-note").textContent=window.__chinaGeoError?"Fond de carte indisponible : seules les villes sont placées.":"Fond de carte en cours de chargement…";
  put(land,svgEl("path",{class:"tropic",d:"M-600,"+py(23.44)+"H"+(W+900)}));
  const tr=svgEl("text",{class:"tropiclab",x:px(121.5),y:py(23.44)-5,"text-anchor":"middle"});tr.textContent="Tropique du Cancer";put(land,tr);
  for(const [n,lon,lat,inS] of PROV_LABELS){const t=svgEl("text",{class:"provlab"+(inS?" in":""),x:px(lon),y:py(lat),"text-anchor":"middle"});t.textContent=n;put(land,t);}
  svg.append(svgEl("g",{id:"g-cities"}),svgEl("g",{id:"g-marks"}));
  applyView();
}

/* ---------- Map: view (centre + scale) ---------- */
function freeRect(){
  const box=$("#mapbox").getBoundingClientRect();
  const wide=window.innerWidth>1000;
  const L=wide?20:12, T=wide?70:56, R=wide?($("#side").offsetWidth+40):12, B=wide?($("#legend-panel").offsetHeight+30):12;
  return {w:box.width,h:box.height,x0:L,y0:T,fw:Math.max(160,box.width-L-R),fh:Math.max(160,box.height-T-B)};
}
function fitView(bb){const r=freeRect();const k=Math.min(r.fw/(bb[2]-bb[0]),r.fh/(bb[3]-bb[1]));return {cx:(bb[0]+bb[2])/2,cy:(bb[1]+bb[3])/2,k};}
function applyView(){
  const svg=$("#map"), r=freeRect(); if(!r.w) return;
  S.k0=fitView(frameBox(FRAMES.sud)).k;
  if(!S.vs) S.vs=fitView(frameBox(FRAMES[S.frame]));
  const {cx,cy,k}=S.vs, fcx=r.x0+r.fw/2, fcy=r.y0+r.fh/2;
  svg.setAttribute("viewBox",[(cx-fcx/k).toFixed(2),(cy-fcy/k).toFixed(2),(r.w/k).toFixed(2),(r.h/k).toFixed(2)].join(" "));
  S.zs=S.k0/k; svg.style.setProperty("--zs",S.zs.toFixed(4)); svg.classList.toggle("zoomed",S.zs<0.6);
  $$("#map .pos:not(.mkpos)").forEach(g=>g.setAttribute("transform","translate("+g.dataset.x+" "+g.dataset.y+") scale("+S.zs.toFixed(4)+")"));
  const mode=S.zs>0.55?"base":"full"; if(mode!==S.groupMode){S.groupMode=mode;drawMarks();} else layoutMarks();
}
let anim=0;
function animateTo(target,dur=750){
  const from=S.vs||target; const id=++anim;
  if(reduce){S.vs=target;applyView();return;}
  const t0=performance.now(), ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2, lk0=Math.log(from.k), lk1=Math.log(target.k);
  const step=t=>{if(id!==anim)return;const p=Math.min(1,(t-t0)/dur),e=ease(p);
    S.vs={cx:from.cx+(target.cx-from.cx)*e,cy:from.cy+(target.cy-from.cy)*e,k:Math.exp(lk0+(lk1-lk0)*e)};applyView();if(p<1)requestAnimationFrame(step);};
  requestAnimationFrame(step);
}
function setFrame(f){S.frame=f;$$("#frames button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.f===f?"true":"false"));$("#tip").style.opacity=0;animateTo(fitView(frameBox(FRAMES[f])));}
function clearFramePressed(){S.frame=null;$$("#frames button").forEach(b=>b.setAttribute("aria-pressed","false"));}
const clampK=k=>Math.min(S.k0*16,Math.max(S.k0*0.7,k));
function screenToMap(sx,sy){const r=freeRect(),{cx,cy,k}=S.vs;return [cx+(sx-(r.x0+r.fw/2))/k,cy+(sy-(r.y0+r.fh/2))/k];}
function zoomAt(sx,sy,factor){anim++;const r=freeRect(),{k}=S.vs,k2=clampK(k*factor);const [mx,my]=screenToMap(sx,sy);
  S.vs={k:k2,cx:mx-(sx-(r.x0+r.fw/2))/k2,cy:my-(sy-(r.y0+r.fh/2))/k2};clearFramePressed();applyView();}
$$("#frames button").forEach(b=>b.addEventListener("click",()=>{if(S.city){S.city=null;renderSide();markSel();}setFrame(b.dataset.f);}));
$("#zoom-in").addEventListener("click",()=>{const r=freeRect();const t={...S.vs,k:clampK(S.vs.k*1.6)};clearFramePressed();animateTo(t,350);});
$("#zoom-out").addEventListener("click",()=>{const t={...S.vs,k:clampK(S.vs.k/1.6)};clearFramePressed();animateTo(t,350);});
(function interactions(){
  const box=$("#mapbox"), svg=$("#map"); let hintT;
  const local=e=>{const b=box.getBoundingClientRect();return [e.clientX-b.left,e.clientY-b.top];};
  box.addEventListener("wheel",e=>{
    if(!(e.ctrlKey||e.metaKey)){const h=$("#zoomhint");h.classList.add("on");clearTimeout(hintT);hintT=setTimeout(()=>h.classList.remove("on"),1100);return;}
    e.preventDefault();const [x,y]=local(e);zoomAt(x,y,Math.exp(-e.deltaY*0.0075));},{passive:false});
  const ptrs=new Map(); let drag=null, pinch=null, moved=false;
  svg.addEventListener("pointerdown",e=>{if(e.button!==0&&e.pointerType==="mouse")return;ptrs.set(e.pointerId,local(e));moved=false;
    if(ptrs.size===1){drag={start:local(e),vs:{...S.vs}};}
    else if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),mid:[(a[0]+b[0])/2,(a[1]+b[1])/2]};drag=null;}});
  svg.addEventListener("pointermove",e=>{if(!ptrs.has(e.pointerId))return;ptrs.set(e.pointerId,local(e));
    if(pinch&&ptrs.size===2){const [a,b]=[...ptrs.values()];const d=Math.hypot(a[0]-b[0],a[1]-b[1]);zoomAt(pinch.mid[0],pinch.mid[1],d/pinch.d);pinch.d=d;moved=true;return;}
    if(drag){const [x,y]=local(e),dx=x-drag.start[0],dy=y-drag.start[1];if(!moved&&Math.hypot(dx,dy)<4)return;
      if(!moved){moved=true;svg.classList.add("panning");try{svg.setPointerCapture(e.pointerId);}catch(_){}}
      anim++;S.vs={k:drag.vs.k,cx:drag.vs.cx-dx/drag.vs.k,cy:drag.vs.cy-dy/drag.vs.k};clearFramePressed();applyView();$("#tip").style.opacity=0;}});
  const end=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;if(!ptrs.size){drag=null;svg.classList.remove("panning");}};
  svg.addEventListener("pointerup",end);svg.addEventListener("pointercancel",end);
  svg.addEventListener("click",e=>{if(moved){e.stopPropagation();e.preventDefault();moved=false;}},true);
})();

/* ---------- Map: city glyphs ---------- */
const posG=(x,y,cls,city)=>{const g=svgEl("g",{class:"pos"+(cls?" "+cls:""),"data-x":x.toFixed(2),"data-y":y.toFixed(2),transform:"translate("+x.toFixed(2)+" "+y.toFixed(2)+") scale("+S.zs.toFixed(4)+")"});if(city)g.dataset.city=city;return g;};
function cityGroups(vis){
  const m=new Map();
  for(const it of vis){if(it.lat==null||it.lon==null||!it.ville)continue;
    const key=S.groupMode==="base"?baseCity(it.ville):it.ville;
    if(!m.has(key)){const kc=KEYCITIES[key]||MINORCITIES[key];m.set(key,{lon:kc?kc[0]:it.lon,lat:kc?kc[1]:it.lat,items:[]});}
    const g=m.get(key); if(it.ville===key&&!(KEYCITIES[key]||MINORCITIES[key])){g.lon=it.lon;g.lat=it.lat;}
    g.items.push(it);}
  return m;
}
function glyph(c,name,anim,k){
  const g=svgEl("g",{class:"mk"+(anim?" anim":"")+(c.items.some(isUnread)?" new":""),tabindex:"0",role:"button","aria-label":name+" : "+c.items.length+" brève"+(c.items.length>1?"s":""),style:anim?"animation-delay:"+(1.1+k*0.05)+"s":""});
  const n=c.items.length, r=8+3*Math.sqrt(n), sw=3.4;
  put(g,svgEl("circle",{class:"halo",r:r+5}));
  put(g,svgEl("circle",{class:"disc",r:r}));
  const circ=2*Math.PI*(r-sw/2); let off=0;
  for(const t of TYPE_ORDER){const m=c.items.filter(i=>i.type===t).length;if(!m)continue;const len=circ*m/n;
    put(g,svgEl("circle",{class:"ring "+TYPES[t].seg,r:(r-sw/2).toFixed(2),"stroke-width":sw,"stroke-dasharray":(Math.max(0,len-(n>1&&m<n?1.2:0))).toFixed(2)+" "+circ.toFixed(2),"stroke-dashoffset":(-off).toFixed(2),transform:"rotate(-90)"}));off+=len;}
  if(c.items.every(i=>i.niveau==="province")) put(g,svgEl("circle",{class:"provring",r:r+2.5}));
  const t=svgEl("text",{class:"cnt"});t.textContent=n;put(g,t);
  if(c.items.some(isUnread)) put(g,svgEl("circle",{class:"newdot",cx:(r*.72).toFixed(1),cy:(-r*.72).toFixed(1),r:3.2}));
  const lab=svgEl("text",{class:"citylab",x:r+6,y:4});lab.textContent=name;put(g,lab);
  return g;
}
function drawMarks(){
  const gC=$("#g-cities"),gM=$("#g-marks"); if(!gC)return; gC.replaceChildren(); gM.replaceChildren();
  const vis=S.items.filter(i=>passes(i));
  const groups=cityGroups(vis);
  const taken=new Set([...groups.keys()].map(baseCity));
  const dot=(name,lon,lat,minor)=>{const g=posG(px(lon),py(lat),minor?"minor":null);put(g,svgEl("circle",{class:"citydot",r:1.8}));const t=svgEl("text",{class:"keylab",x:4,y:3});t.textContent=name;put(g,t);put(gC,g);};
  for(const [n,[lon,lat]] of Object.entries(KEYCITIES)) if(!taken.has(n)) dot(n,lon,lat,false);
  for(const [n,[lon,lat]] of Object.entries(MINORCITIES)) if(!taken.has(n)) dot(n,lon,lat,true);
  const animOn=S.animMarks&&!reduce; let k=0;
  for(const [name,c] of [...groups].sort((a,b)=>b[1].lat-a[1].lat)){
    const pg=posG(px(c.lon),py(c.lat),"mkpos",name);
    pg.dataset.r=(8+3*Math.sqrt(c.items.length)).toFixed(2);
    put(pg,svgEl("line",{class:"leader",x1:0,y1:0,x2:0,y2:0}),svgEl("circle",{class:"anchor",r:1.8}));
    const g=glyph(c,name,animOn,k++);
    const show=e=>showTip(e,name,c.items),hide=()=>{$("#tip").style.opacity=0;};
    g.addEventListener("mouseenter",show);g.addEventListener("mousemove",show);g.addEventListener("mouseleave",hide);g.addEventListener("focus",show);g.addEventListener("blur",hide);
    const pick=()=>{focusCity(name,c);};
    g.addEventListener("click",pick);g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();pick();}});
    put(pg,g); put(gM,pg);
  }
  S.animMarks=false; layoutMarks(); markSel();
}
/* Overlapping glyphs are pushed apart (a few relaxation passes in map units), with a hairline leader back to the true position. */
function layoutMarks(){
  const gs=$$("#g-marks .pos.mkpos"); const z=S.zs;
  const P=gs.map(g=>({g,tx:+g.dataset.x,ty:+g.dataset.y,x:+g.dataset.x,y:+g.dataset.y,r:(+g.dataset.r+2.5)*z}));
  for(let it=0;it<60;it++){let moved=false;
    for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){const a=P[i],b=P[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);const m=a.r+b.r;
      if(d<m){if(d<1e-6){dx=1;dy=0;d=1;}const push=(m-d)/2;a.x-=dx/d*push;a.y-=dy/d*push;b.x+=dx/d*push;b.y+=dy/d*push;moved=true;}}
    for(const q of P){q.x+=(q.tx-q.x)*0.04;q.y+=(q.ty-q.y)*0.04;}
    if(!moved)break;}
  for(const q of P){const lab=q.g.querySelector(".citylab"); if(!lab) continue; const r=+q.g.dataset.r, lw=(q.g.dataset.city||"").length*6.6+r+8;
    const clash=P.some(o=>o!==q&&(o.x-q.x)/z>0&&(o.x-q.x)/z<lw&&Math.abs(o.y-q.y)/z<15);
    lab.setAttribute("x",clash?-(r+6):r+6); lab.setAttribute("text-anchor",clash?"end":"start");}
  for(const q of P){q.g.setAttribute("transform","translate("+q.x.toFixed(2)+" "+q.y.toFixed(2)+") scale("+z.toFixed(4)+")");
    const ln=q.g.querySelector(".leader"); const lx=(q.tx-q.x)/z, ly=(q.ty-q.y)/z, far=Math.hypot(lx,ly)>2;
    ln.setAttribute("x2",lx.toFixed(2));ln.setAttribute("y2",ly.toFixed(2));ln.style.display=far?"":"none";
    const an=q.g.querySelector(".anchor"); an.setAttribute("cx",lx.toFixed(2)); an.setAttribute("cy",ly.toFixed(2)); an.style.display=far?"":"none";}
}
function markSel(){const svg=$("#map");svg.classList.toggle("focusing",!!S.city);$$("#g-marks .pos").forEach(g=>{const c=g.dataset.city;g.classList.toggle("sel",!!S.city&&(c===S.city||baseCity(c)===S.city));});}
function showTip(e,name,items){
  const tip=$("#tip"),wrap=$("#mapbox").getBoundingClientRect(),r=(e.currentTarget||e.target).getBoundingClientRect();
  const cnt=TYPE_ORDER.map(t=>[t,items.filter(i=>i.type===t).length]).filter(x=>x[1]).map(([t,n])=>n+" "+TYPES[t].lab.toLowerCase()+(n>1&&t!=="conjoncture"?"s":"")).join(", ");
  tip.replaceChildren(el("b",{},name),el("div",{},cnt),...sorted(items).slice(0,3).map(i=>el("div",{},"· "+clip(i.titre.replace(/^[^:]+:\s*/,""),70))),el("div",{style:"margin-top:4px;color:var(--accent)"},"Cliquer pour le dossier"));
  tip.style.left=Math.min(Math.max(r.left+r.width/2-wrap.left,150),wrap.width-150)+"px"; tip.style.top=(r.top-wrap.top)+"px"; tip.style.opacity=1;
}
let preFocus=null;
function focusCity(name,c){
  if(!S.city) preFocus={vs:{...S.vs},frame:S.frame};
  S.city=name;
  $("#tip").style.opacity=0;
  const lon=c.lon,lat=c.lat, span=1.1;
  const target=fitView([px(lon-span),py(lat+span*0.75),px(lon+span),py(lat-span*0.75)]);
  target.k=Math.max(target.k,S.vs.k);
  clearFramePressed(); animateTo(target,800); renderSide(); markSel();
}
function unfocusCity(){S.city=null;renderSide();markSel();if(preFocus){const p=preFocus;preFocus=null;if(p.frame){setFrame(p.frame);}else animateTo(p.vs);}}

/* ---------- Timeline (legend panel) ---------- */
function renderTimeline(){
  const host=$("#timeline"); host.replaceChildren();
  const weeks=26,start=new Date(today);start.setDate(start.getDate()-7*weeks);
  const counts=new Array(weeks).fill(0);
  for(const it of S.items.filter(i=>passes(i,{ignorePeriod:true}))){const k=Math.floor((new Date(it.date+"T12:00:00")-start)/(7*864e5));if(k>=0&&k<weeks)counts[k]++;}
  const max=Math.max(1,...counts),w=800,bw=w/weeks, lim=S.f.period==="all"?1e9:Number(S.f.period==="1"?1.5:S.f.period);
  const s=svgEl("svg",{viewBox:"0 0 "+w+" 36",preserveAspectRatio:"none",role:"img","aria-label":"Brèves par semaine sur 26 semaines"});
  counts.forEach((c,k)=>{const hgt=c?4+18*c/max:1.5;const wkEnd=new Date(start.getTime()+(k+1)*7*864e5);put(s,svgEl("rect",{class:"bar"+((today-wkEnd)/864e5<lim?" on":""),x:k*bw+2,y:23-hgt,width:bw-4,height:hgt,rx:1.5}));});
  [0,13,25].forEach(k=>{const d=new Date(start.getTime()+k*7*864e5);const t=svgEl("text",{class:"axis",x:k===25?w-2:k*bw+2,y:35,"text-anchor":k===25?"end":"start"});t.textContent=fmtShort(dayKey(d));put(s,t);});
  put(host,s);
}

/* ---------- 5 minutes (landing) and syntheses ---------- */
const byId=id=>S.items.find(i=>i.id===id);
const refBtn=id=>{const it=byId(id);return it?el("button",{class:"ref",type:"button",onclick:()=>openFiche(it)},"voir la brève"):null;};
const refList=ids=>{const its=(ids||[]).map(byId).filter(Boolean); if(!its.length) return null;
  if(its.length===1) return el("span",{class:"refs"},refBtn(its[0].id));
  const nm=it=>baseCity(it.ville||"National"); const dup=it=>its.filter(x=>nm(x)===nm(it)).length>1;
  return el("span",{class:"refs"},"Brèves : ",...its.flatMap((it,k)=>[k?" · ":null,el("button",{class:"ref",type:"button",title:it.titre,onclick:()=>openFiche(it)},nm(it)+(dup(it)?" ("+fmtShort(it.date)+")":""))]));};
const pointLi=p=>el("li",{},p.texte+" ",refList(p.items));
const figBox=c=>el("div",{class:"fig"},el("div",{class:"v"},c.valeur),el("div",{class:"l"},c.libelle),c.item&&byId(c.item)?el("div",{class:"s"},(baseCity(byId(c.item).ville)||"National")+", ",refBtn(c.item)):null);
const words=s=>(s||"").split(/\s+/).filter(Boolean).length;
function agendaList(days){const lim=new Date(today.getTime()+days*864e5);const it=S.agenda.filter(a=>(a.fin||a.date)>=dayKey(today)&&a.date<=dayKey(lim)).sort((a,b)=>a.date.localeCompare(b.date));
  if(!it.length)return el("p",{},"Aucun événement daté dans les sept prochains jours.");
  return el("ul",{},...it.map(a=>el("li",{},fmtShort(a.date)+(a.fin&&a.fin!==a.date?" – "+fmtShort(a.fin):"")+" : "+(a.ville?a.ville+", ":"")+a.titre)));}
function renderCinq(){
  const host=$("#cinq-body"); host.replaceChildren();
  if(S.dbState!=="ready"){put(host,stateMsg());return;}
  const c=S.cinq.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
  if(!c){put(host,el("div",{class:"empty"},el("b",{},"L'essentiel en 5 minutes n'a pas encore été rédigé"),"Il est produit chaque matin avec la synthèse du jour."));return;}
  const w=words([c.titre,c.faitDuJour,...(c.faits||[]).map(f=>f.texte),...(c.opportunites||[]).map(o=>o.texte),c.vigilance].join(" ")),sec=Math.round(w/230*60);
  put(host,
    el("div",{class:"rkicker"},el("span",{},"L'essentiel en 5 minutes"),el("span",{},fmtD(c.date,{weekday:"long",day:"numeric",month:"long"})),el("span",{class:"readtime"},w+" mots, environ "+Math.floor(sec/60)+" min "+String(sec%60).padStart(2,"0"))),
    el("h2",{class:"big"},c.titre), el("p",{class:"lead"},c.faitDuJour),
    el("h3",{},"Cinq faits à retenir"), el("ol",{},...(c.faits||[]).map(pointLi)),
    el("h3",{},"Trois chiffres"), el("div",{class:"figs"},...(c.chiffres||[]).map(figBox)),
    el("h3",{},"Opportunités"), el("div",{style:"display:grid;gap:10px"},...(c.opportunites||[]).map(o=>el("div",{class:"opp"},el("div",{class:"due"},o.echeance),el("p",{},o.texte," ",refList(o.items))))),
    c.vigilance?el("h3",{},"Point de vigilance"):null, c.vigilance?el("p",{},c.vigilance):null,
    el("h3",{},"Agenda des sept prochains jours"), agendaList(7),
    el("div",{class:"foot"},"Rédigé à partir des brèves publiées dans la base ; aucune information nouvelle n'y est introduite."));
}
function renderSynth(){
  const host=$("#synth-body"); host.replaceChildren();
  $$("#synth-seg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.p===S.synthP?"true":"false"));
  if(S.dbState!=="ready"){put(host,stateMsg());return;}
  const s=S.syntheses.filter(x=>x.periode===S.synthP).sort((a,b)=>(b.fin||"").localeCompare(a.fin||""))[0];
  if(!s){const next={jour:"demain matin, après la collecte de 7 h",semaine:"vendredi, avec la collecte du matin",mois:"le premier jour ouvré du mois prochain"}[S.synthP];
    put(host,el("div",{class:"empty"},el("b",{},"Pas encore de synthèse "+({jour:"du jour",semaine:"de la semaine",mois:"du mois"}[S.synthP])),"La prochaine sera rédigée "+next+"."));return;}
  put(host,
    el("div",{class:"rkicker"},el("span",{},({jour:"Synthèse du jour",semaine:"Synthèse de la semaine",mois:"Synthèse du mois"})[s.periode]),el("span",{},s.debut&&s.debut!==s.fin?"du "+fmtD(s.debut)+" au "+fmtD(s.fin):fmtD(s.fin))),
    el("h2",{class:"big"},s.titre), el("p",{class:"lead"},s.lead),
    s.points&&s.points.length?el("h3",{},"Points clés"):null, s.points&&s.points.length?el("ol",{},...s.points.map(pointLi)):null,
    s.chiffres&&s.chiffres.length?el("h3",{},"Chiffres"):null, s.chiffres&&s.chiffres.length?el("div",{class:"figs"},...s.chiffres.map(figBox)):null,
    s.surveiller?el("h3",{},"À surveiller"):null, s.surveiller?el("p",{},s.surveiller):null,
    el("div",{class:"foot"},(s.note?s.note+" ":"")+"Chaque point renvoie à une brève sourcée de la base."));
}

/* ---------- Fil ---------- */
function filterGroups(){
  const f=S.f;
  return [
    el("div",{class:"fgroup"},el("span",{},"Zone"),...["CAN","CHE","NAT"].map(z=>chip(ZONES[z],f.zones.has(z),tog(f.zones,z)))),
    el("div",{class:"fgroup"},el("span",{},"Type"),...TYPE_ORDER.map(k=>chip(TYPES[k].lab,f.types.has(k),tog(f.types,k),swatch(k)))),
    el("div",{class:"fgroup fg-fil"},el("span",{},"Filière"),...Object.keys(FIL).map(k=>chip(FIL[k],f.fils.has(k),tog(f.fils,k)))),
    el("div",{class:"fgroup"},el("span",{},"Période"),...[["1","Jour"],...PERIODS].map(([v,l])=>chip(l,f.period===v,()=>{f.period=v;rerender();}))),
    el("div",{class:"fgroup"},el("span",{},"Affichage"),chip("Intérêt France",f.fr,()=>{f.fr=!f.fr;rerender();}),chip("À confirmer ("+nPending()+")",f.statut==="a_confirmer",()=>{f.statut=f.statut==="a_confirmer"?"publie":"a_confirmer";rerender();}))
  ];
}
function renderFilFilters(){
  const host=$("#filters-fil"); host.replaceChildren();
  put(host,el("div",{class:"fbar"},el("h2",{},"Filtres"),S.filOpen?null:el("span",{class:"factive"},activeText()),
    el("div",{class:"fsum"},summaryText(),el("button",{class:"linkbtn",type:"button",onclick:resetFilters},"Réinitialiser")),
    el("button",{class:"chip fold",type:"button","aria-expanded":S.filOpen?"true":"false","aria-controls":"fgrid",onclick:()=>{S.filOpen=!S.filOpen;store.set("vcs.filOpen",S.filOpen?"1":"0");renderFilFilters();}},S.filOpen?"Replier":"Déplier")));
  if(S.filOpen) put(host,el("div",{class:"fgrid",id:"fgrid"},...filterGroups()));
}
function renderFil(){
  renderFilFilters();
  const host=$("#fil-list"); host.replaceChildren();
  if(S.dbState!=="ready"){put(host,stateMsg());return;}
  const list=sorted(S.items.filter(i=>passes(i)));
  $("#fil-meta").textContent=list.length+" brève"+(list.length>1?"s":"");
  if(!list.length){put(host,el("div",{class:"empty"},el("b",{},"Aucune brève pour ces filtres"),"Élargissez la période ou réinitialisez les filtres."));return;}
  let groups;
  if(S.groupBy==="date"){const m=new Map();list.forEach(i=>{if(!m.has(i.date))m.set(i.date,[]);m.get(i.date).push(i);});groups=[...m].map(([k,v])=>[fmtD(k,{weekday:"long",day:"numeric",month:"long",year:"numeric"}),v]);}
  else if(S.groupBy==="rubrique"){groups=RUBRIQUES.map(r=>[r,list.filter(i=>i.rubrique===r)]).filter(g=>g[1].length);const o=list.filter(i=>!RUBRIQUES.includes(i.rubrique));if(o.length)groups.push(["Autres",o]);}
  else groups=["CAN","CHE","HKM","NAT"].map(z=>[z==="NAT"?"Cadre national":"Circonscription de "+ZONES[z],list.filter(i=>i.zone===z)]).filter(g=>g[1].length);
  for(const [h,v] of groups){put(host,el("div",{class:"group-h"},h.charAt(0).toUpperCase()+h.slice(1)));v.forEach(i=>put(host,briefCard(i)));}
}

/* ---------- Sources ---------- */
function renderSources(){
  const sum=$("#src-sum"),tb=$("#src-table"); sum.replaceChildren(); tb.replaceChildren();
  if(S.dbState!=="ready"){put(sum,stateMsg());return;}
  const src=S.sources.slice().sort((a,b)=>(a.num||0)-(b.num||0)); const c=k=>src.filter(s=>s.statut===k).length;
  const kinds=[["ok","opérationnelles","var(--good)"],["partiel","partielles","var(--warn)"],["echec","en échec","var(--bad)"],["non_teste","non testées","var(--ink-3)"]].filter(([k])=>k!=="non_teste"||c(k));
  put(sum,...kinds.map(([k,l])=>el("span",{},el("b",{},c(k)),l)),el("span",{style:"margin-left:auto"},"Brèves retenues sur 30 jours : ",el("b",{},S.items.filter(i=>daysAgo(i.date)<=30).length)),
    el("div",{class:"srcbar"},...kinds.map(([k,,col])=>el("i",{style:"width:"+(100*c(k)/Math.max(1,src.length))+"%;background:"+col}))));
  const lab={ok:"Opérationnelle",partiel:"Partielle",echec:"Échec",non_teste:"Non testée"};
  put(tb,el("thead",{},el("tr",{},...["#","Source","Zone","Mode de collecte","État","Dernier essai","Brèves","Note"].map(h=>el("th",{},h)))));
  put(tb,el("tbody",{},...src.map(s=>el("tr",{},el("td",{class:"num"},s.num),el("td",{},s.url?el("a",{href:s.url,target:"_blank",rel:"noopener"},s.nom):s.nom),el("td",{},s.zone||""),el("td",{},s.mode||""),el("td",{},el("span",{class:"st "+(s.statut||"non_teste")},lab[s.statut]||"Non testée")),el("td",{},s.dernierEssai?fmtShort(s.dernierEssai):"—"),el("td",{class:"num"},s.items||0),el("td",{},s.note||"")))));
}

/* ---------- Fiche ---------- */
const briefText=it=>{const s=it.source||{};return it.titre+"\n\n"+it.corps+"\n\nSource : "+(s.emetteur||"")+(s.titre?", « "+s.titre+" »":"")+(s.date?", "+fmtD(s.date):"")+" — "+(s.url||"");};
function openFiche(it){
  S.current=it; markRead(it); const b=$("#fiche-body"); b.replaceChildren(); const t=TYPES[it.type]||TYPES.fait; const s=it.source||{};
  put(b,
    el("div",{class:"btop"},el("span",{class:"tpill"},el("i",{class:"sw "+t.sw}),t.lab),...(it.filieres||[]).map(x=>el("span",{class:"fil"},FIL[x]||x)),el("span",{class:"rel "+it.fiabilite},relLabel(it.fiabilite)),it.interetFrance?el("span",{class:"fr"},"Intérêt France"):null,it.statut==="a_confirmer"?el("span",{class:"pending"},"À confirmer"):null,el("span",{class:"bdate"},fmtD(it.date))),
    el("h2",{id:"fiche-title"},it.titre), el("p",{class:"corps"},it.corps),
    it.action?el("div",{class:"opp"},el("div",{class:"due"},"Piste d'action"),el("p",{},it.action)):null,
    (it.drapeaux||[]).length?el("div",{class:"flag"},"⚑ "+it.drapeaux.join(" ; ")):null,
    el("dl",{},
      el("dt",{},"Source"),el("dd",{},el("a",{href:s.url,target:"_blank",rel:"noopener"},s.emetteur||s.url),s.titre?el("span",{}," — ",el("span",{class:s.langue==="zh"?"zh":null,lang:s.langue||null},s.titre)):null,s.date?", "+fmtD(s.date):""),
      ...(it.recoupements&&it.recoupements.length?[el("dt",{},"Recoupements"),el("dd",{},...it.recoupements.map((r,k)=>el("span",{},k?" ; ":"",el("a",{href:r.url,target:"_blank",rel:"noopener"},r.emetteur))))]:[]),
      ...(it.original&&it.original.titre?[el("dt",{},"Titre original"),el("dd",{class:it.original.langue==="zh"?"zh":null,lang:it.original.langue||null},it.original.titre)]:[]),
      el("dt",{},"Lieu"),el("dd",{},it.ville?it.ville+(it.villeZh?" ("+it.villeZh+")":"")+", "+it.province:"Niveau national (hors carte)",it.niveau==="province"?", information provinciale":""),
      el("dt",{},"Classement"),el("dd",{},t.lab+" ; "+(it.filieres||[]).map(x=>FIL[x]).join(", ")+" ; rubrique « "+(it.rubrique||"—")+" »"),
      ...(it.chiffre?[el("dt",{},"Chiffre clé"),el("dd",{},it.chiffre.valeur+" — "+it.chiffre.libelle)]:[]),
      ...(it.dateFait&&it.dateFait!==it.date?[el("dt",{},"Date du fait"),el("dd",{},fmtD(it.dateFait))]:[]),
      el("dt",{},"Collecte"),el("dd",{},it.collecte?fmtD(it.collecte,{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—")));
  const pend=it.statut==="a_confirmer"&&S.canEdit; $("#btn-validate").hidden=!pend; $("#btn-reject").hidden=!pend; $("#fiche-status").textContent="";
  const d=$("#fiche"); if(!d.open) d.showModal();
}
$("#btn-close").addEventListener("click",()=>$("#fiche").close());
$("#fiche").addEventListener("click",e=>{if(e.target===e.currentTarget)e.currentTarget.close();});
$("#fiche").addEventListener("close",()=>{if(S.view==="today"){renderMorning();renderSide();drawMarks();}else if(S.view==="fil")renderFil();});
$("#btn-copy").addEventListener("click",async()=>{const it=S.current;if(!it)return;const txt=briefText(it);
  try{await navigator.clipboard.writeText(txt);$("#fiche-status").textContent="Brève copiée.";}
  catch(e){const ta=el("textarea",{style:"position:fixed;left:-9999px"});ta.value=txt;document.body.append(ta);ta.select();try{document.execCommand("copy");$("#fiche-status").textContent="Brève copiée.";}catch(_){$("#fiche-status").textContent="Copie refusée : sélectionnez le texte à la main.";}ta.remove();}});
async function setStatut(st){const it=S.current;if(!it||!DB)return;$("#fiche-status").textContent="Enregistrement…";
  try{await DB.doc("items/"+it.id).update({statut:st});$("#fiche-status").textContent=st==="publie"?"Brève validée et publiée.":"Brève rejetée.";$("#btn-validate").hidden=true;$("#btn-reject").hidden=true;}
  catch(e){$("#fiche-status").textContent="Enregistrement refusé ("+(e&&e.code||"erreur")+"). Seuls les éditeurs de la page peuvent valider.";}}
$("#btn-validate").addEventListener("click",()=>setStatut("publie"));
$("#btn-reject").addEventListener("click",()=>setStatut("rejete"));

/* ---------- Views ---------- */
function setView(v,first){S.view=v;store.set("vcs.view",v);
  $$("nav.tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.view===v?"true":"false"));
  for(const id of VIEWS){const n=$("#view-"+id);n.hidden=id!==v;if(id===v&&!first){n.classList.remove("view-in");void n.offsetWidth;n.classList.add("view-in");}}
  if(v==="today") requestAnimationFrame(()=>applyView());
  renderAll(); if(!first) window.scrollTo({top:0,behavior:"auto"});}
$$("nav.tabs button").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
$$("#groupby button").forEach(b=>b.addEventListener("click",()=>{S.groupBy=b.dataset.g;$$("#groupby button").forEach(x=>x.setAttribute("aria-pressed",x===b?"true":"false"));renderFil();}));
$$("#synth-seg button").forEach(b=>b.addEventListener("click",()=>{S.synthP=b.dataset.p;renderSynth();}));
let rz; window.addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(()=>{if(S.frame)S.vs=fitView(frameBox(FRAMES[S.frame]));applyView();},120);});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&S.city&&!$("#fiche").open&&S.view==="today")unfocusCity();});

function renderAll(light){
  renderHeader();
  if(S.view==="today"){renderMorning();renderSide();drawMarks();renderTimeline();if(!light)renderCinq();}
  if(S.view==="fil")renderFil();
  if(S.view==="syntheses")renderSynth();
  if(S.view==="sources")renderSources();
}

/* ---------- Data: live shared database when reachable, otherwise data.json ---------- */
let DB=null;
async function loadSnapshot(){
  try{const r=await fetch("data.json",{cache:"no-store"}); if(!r.ok) throw 0; const d=await r.json();
    S.items=d.items||[];S.syntheses=d.syntheses||[];S.cinq=d.cinqmin||[];S.agenda=d.agenda||[];S.sources=d.sources||[];S.meta=d.meta||null;
    S.snapshot=d.exporte||true; S.dbState="ready"; S.animMarks=true; S.canEdit=false; renderAll(); return true;
  }catch(e){ return false; }
}
function stampVisit(){setTimeout(()=>store.set("vcs.lastVisit",new Date().toISOString()),4000);}

if(!reduce) document.getElementById("app").classList.add("intro");
drawBase(); setView(S.view,true);
let tries=0; const gw=setInterval(()=>{tries++; if(window.__chinaGeo||window.__chinaGeoError||tries>40){clearInterval(gw); S.animMarks=true; drawBase(); drawMarks();}},150);
setTimeout(()=>document.getElementById("app").classList.remove("intro"),3000);
(async()=>{
  const fallback=async()=>{ if(!(await loadSnapshot())){S.dbState="absent";renderAll();} };
  if(!window.claude||!window.claude.use){await fallback();stampVisit();return;}
  let db=null; try{db=await window.claude.use("db");}catch(e){db=null;}
  if(!db){await fallback();stampVisit();return;}
  DB=db;
  try{const u=await window.claude.use("user");S.canEdit=u?!!(await u.canEdit()):false;}catch(e){S.canEdit=false;}
  let pending=5, failed=false; const done=()=>{if(failed)return; if(--pending<=0&&S.dbState!=="ready"){S.dbState="ready";S.animMarks=true;stampVisit();} renderAll();};
  const fail=()=>{ if(failed) return; failed=true; DB=null; S.canEdit=false; fallback().then(stampVisit); };
  const sub=(col,key)=>{let first=true;db.collection(col).onSnapshot(snap=>{if(failed)return;S[key]=snap.docs.map(d=>Object.assign({id:d.id},d.data()));if(first){first=false;done();}else renderAll();},fail);};
  sub("items","items");sub("syntheses","syntheses");sub("cinqmin","cinq");sub("agenda","agenda");sub("sources","sources");
  db.doc("meta/config").onSnapshot(s=>{if(failed)return;S.meta=s.exists?s.data():null;renderHeader();},()=>{});
})();
})();
