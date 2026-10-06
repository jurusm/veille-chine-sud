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
const FRAMES={sud:[97,17.3,123.5,33.6],delta:[111.9,21.4,115.1,24.0]};

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
  vs:null,k0:1,zs:1,frame:"sud",groupMode:"base",prevVisit:null,read:new Set(),synthId:null};
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
const fmtD=(iso,o={day:"numeric",month:"long",year:"numeric"})=>{if(!iso)return"";const d=new Date(iso.length<=10?iso+"T12:00:00":iso);return isNaN(d)?iso:new Intl.DateTimeFormat("fr-FR",o).format(d).replace(/(^|\s)1(?=\s[a-zéû])/g,"$11er");};
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
function applyTheme(t){document.documentElement.setAttribute("data-theme",t);const b=$("#btn-theme");const dark=t!=="light";b.innerHTML=dark?ICON_SUN:ICON_MOON;b.setAttribute("aria-label",dark?"Passer en mode clair":"Passer en mode sombre");b.title=dark?"Mode clair":"Mode sombre";}
applyTheme(store.get("vcs.theme")==="light"?"light":"dark");
$("#btn-theme").addEventListener("click",()=>{const t=document.documentElement.getAttribute("data-theme")==="light"?"dark":"light";store.set("vcs.theme",t);applyTheme(t);});

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
/* zones et types : un clic isole la valeur, un clic sur la seule valeur cochée rétablit tout */
const solo=(set,v,vis,full)=>()=>{full=full||vis;if(vis.every(x=>set.has(x))){set.clear();set.add(v);}else if(set.has(v)&&set.size===1){full.forEach(x=>set.add(x));}else{set.has(v)?set.delete(v):set.add(v);if(!vis.some(x=>set.has(x)))full.forEach(x=>set.add(x));}rerender();};
function chip(label,pressed,onclick,lead,title){return el("button",{class:"chip","aria-pressed":pressed?"true":"false",onclick,title,type:"button"},lead||null,label);}
const PERIODS=[["7","7 j"],["30","30 j"],["90","90 j"],["all","Tout"]];

/* ---------- Header ---------- */
function renderHeader(){ $("#cnt-fil").textContent=published().length||""; }
function datelineEl(){
  const m=S.meta;
  return el("div",{class:"dateline"},
    el("span",{},new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long"}).format(today)+", semaine "+isoWeek(today)),
    m&&m.derniereCollecte?el("span",{},"Collecte ",el("b",{},fmtD(m.derniereCollecte,{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}))):null,
    m&&m.tauxEURCNY?el("span",{},"1 EUR = "+String(m.tauxEURCNY).replace(".",",")+" CNY"):null,
    S.snapshot?el("span",{class:"snap"},"Instantané"+(typeof S.snapshot==="string"?" du "+fmtD(S.snapshot,{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"")):null);
}

/* ---------- Left panel: the morning point ---------- */
function stateMsg(){
  if(S.dbState==="pending") return el("div",{class:"empty"},el("b",{},"Chargement de la veille…"),"Les brèves s'affichent dès que les données répondent.");
  return el("div",{class:"empty"},el("b",{},"Les données de la veille ne sont pas disponibles"),"Ni la base partagée ni l'instantané publié avec la page n'ont pu être lus. Rechargez la page dans quelques instants.");
}
function renderMorning(){
  const host=$("#morning"); host.replaceChildren();
  if(S.dbState!=="ready"){put(host,el("div",{class:"phead"},datelineEl()),stateMsg());return;}
  const pub=published(), first=!S.prevVisit;
  const fresh=sorted(first?pub.filter(i=>daysAgo(i.date)<=1.5):S.items.filter(i=>isNew(i)&&i.statut!=="rejete"));
  const nNew=fresh.filter(i=>i.statut==="publie").length, nOpp=fresh.filter(i=>i.type==="opportunite").length, nPend=fresh.filter(i=>i.statut==="a_confirmer").length;
  const day=S.syntheses.filter(x=>x.periode==="jour").sort((a,b)=>(b.fin||"").localeCompare(a.fin||""))[0];
  const up=S.agenda.filter(a=>(a.fin||a.date)>=dayKey(today)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4);
  put(host,
    el("div",{class:"phead"},
      datelineEl(),
      el("p",{class:"plabel"},first?"Dernières 24 heures":"Depuis votre dernière visite, "+fmtD(S.prevVisit,{weekday:"long",hour:"2-digit",minute:"2-digit"})),
      el("div",{class:"since"},
        el("div",{},el("b",{class:nNew?"hot":null},nNew),el("span",{},nNew>1?"nouvelles brèves":"nouvelle brève")),
        el("div",{},el("b",{class:nOpp?"hot":null},nOpp),el("span",{},nOpp>1?"opportunités":"opportunité")),
        el("div",{},el("b",{},nPend),el("span",{},"à confirmer")))),
    el("div",{class:"pscroll"},
      fresh.length?el("ul",{class:"newlist"},...fresh.slice(0,6).map(it=>el("li",{},el("button",{type:"button",onclick:()=>openFiche(it)},isUnread(it)?el("i",{class:"unread",title:"Non lue"}):swatch(it.type),el("span",{},it.titre,el("span",{class:"meta"},fmtShort(it.date)+", "+(baseCity(it.ville)||"national"))))))):el("div",{class:"empty"},"Rien de nouveau pour l'instant. La prochaine collecte a lieu demain à 7 h."),
      day?el("div",{class:"psec"},
        el("p",{class:"plabel"},"Synthèse du jour, "+fmtShort(day.fin)),
        el("h2",{class:"headline"},day.titre),
        el("p",{class:"lede"},clip(day.lead,220)),
        el("div",{},el("button",{class:"linkbtn",type:"button",onclick:()=>{S.synthP="jour";S.synthId=day.id;setView("syntheses");}},"Lire la synthèse"))):null,
      el("div",{class:"psec"},
        el("p",{class:"plabel"},"À venir"),
        up.length?el("ul",{class:"agenda-mini"},...up.map(a=>{const j=daysTo(a.date);return el("li",{title:(a.ville?a.ville+" : ":"")+a.titre},el("span",{class:"when"},j>0?"J-"+j:"en cours"),el("span",{class:"what"},a.url?el("a",{href:a.url,target:"_blank",rel:"noopener"},a.titre):a.titre,el("span",{class:"meta",style:"display:block;font-family:var(--f-mono);font-size:11px;color:var(--ink-3)"},a.fin&&a.fin!==a.date?fmtShort(a.date)+" – "+fmtShort(a.fin):fmtShort(a.date))));})):el("p",{class:"muted"},"Aucun événement daté.")),
      el("div",{class:"psec"},el("p",{class:"plabel"},"Activité, 26 semaines"),el("div",{class:"timeline",id:"timeline"}),el("span",{class:"basemap-note",id:"basemap-note"},basemapNote()))));
  renderTimeline();
}

/* ---------- Brief card ---------- */
function briefCard(it){
  const t=TYPES[it.type]||TYPES.fait;
  return el("article",{class:"brief t-"+it.type,"data-id":it.id,tabindex:"0",role:"button","aria-label":"Ouvrir la fiche : "+it.titre,
      onclick:()=>openFiche(it),onkeydown:e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openFiche(it);}},
      onmouseenter:()=>hilite(it,true),onmouseleave:()=>hilite(it,false)},
    el("div",{class:"btop"},el("span",{class:"tpill"},el("i",{class:"sw "+t.sw}),t.lab),
      ...(it.filieres||[]).map(x=>el("span",{class:"fil"},FIL[x]||x)),
      it.interetFrance?el("span",{class:"fr",title:"Intérêt pour une entreprise ou une implantation française"},"Intérêt France"):null,
      it.statut==="a_confirmer"?el("span",{class:"pending"},"À confirmer"):null,
      el("span",{class:"bdate"},isUnread(it)?el("i",{class:"unread",title:"Non lue"}):null,fmtShort(it.date)),noteBtn(it)),
    el("h3",{class:"btitle"},it.titre),
    el("p",{class:"bbody"},it.corps),
    (it.drapeaux||[]).length?el("div",{class:"flag"},"⚑ "+it.drapeaux.join(" ; ")):null,
    el("div",{class:"bmeta"},el("span",{class:"rel "+it.fiabilite},relLabel(it.fiabilite))),
    el("div",{class:"bsrc"},"Source : ",el("a",{href:it.source&&it.source.url,target:"_blank",rel:"noopener",onclick:e=>e.stopPropagation()},(it.source&&it.source.emetteur)||"lien"),it.source&&it.source.date?", "+fmtShort(it.source.date):""));
}
function hilite(it,on){
  $$("#g-marks .sat").forEach(s=>s.classList.toggle("lit",on&&s.dataset.id===it.id));
  if(!it.ville) return;
  $$("#g-marks .pos.mkpos").forEach(g=>{const c=g.dataset.city;g.querySelector(".mk")?.classList.toggle("hover",on&&(inCity(it,c)||c===it.ville));});
}

/* ---------- Right panel: briefs or city dossier ---------- */
function renderSide(){
  const host=$("#side"); const prev=host.querySelector(".pscroll"); const keep=prev&&host.dataset.mode===(S.city||"")?prev.scrollTop:0;
  host.replaceChildren(); host.dataset.mode=S.city||"";
  requestAnimationFrame(()=>{const l=host.querySelector(".pscroll"); if(l&&keep) l.scrollTop=keep;});
  if(S.city){renderDossier(host);return;}
  const f=S.f;
  const head=el("div",{class:"phead"},
    el("div",{class:"prow"},el("h2",{class:"ptitle"},"Brèves"),el("span",{class:"muted"},summaryText()),el("button",{class:"linkbtn",style:"margin-left:auto;font-size:12.5px",type:"button",onclick:resetFilters},"Réinitialiser")),
    el("div",{class:"chiprow",role:"group","aria-label":"Zone, type et période"},
      ...["CAN","CHE","NAT"].map(z=>chip(ZONES[z],f.zones.has(z),solo(f.zones,z,["CAN","CHE","NAT"],["CAN","CHE","NAT","HKM"]))),
      el("span",{class:"sep"}),
      ...TYPE_ORDER.map(k=>chip(TYPES[k].lab,f.types.has(k),solo(f.types,k,TYPE_ORDER),swatch(k))),
      el("span",{class:"sep"}),
      ...PERIODS.map(([v,l])=>chip(l,f.period===v,()=>{f.period=v;rerender();}))),
    el("div",{class:"chiprow",role:"group","aria-label":"Filières et affichage"},
      chip("Intérêt France",f.fr,()=>{f.fr=!f.fr;rerender();}),
      chip("À confirmer ("+nPending()+")",f.statut==="a_confirmer",()=>{f.statut=f.statut==="a_confirmer"?"publie":"a_confirmer";rerender();}),
      el("span",{class:"sep"}),
      ...Object.keys(FIL).map(k=>chip(FIL[k],f.fils.has(k),tog(f.fils,k)))));
  const list=el("div",{class:"pscroll"});
  put(host,head,list);
  if(S.dbState!=="ready"){put(list,stateMsg());return;}
  const items=sorted(S.items.filter(i=>passes(i)));
  if(!items.length){put(list,el("div",{class:"empty"},el("b",{},"Aucune brève pour ces filtres"),"Élargissez la période ou réactivez un type d'information."));return;}
  items.forEach(it=>put(list,briefCard(it)));
}
function sparkline(items,weeks){
  const w=300,h=36,start=new Date(today);start.setDate(start.getDate()-7*weeks);
  const c=new Array(weeks).fill(0);
  items.forEach(it=>{const k=Math.floor((new Date(it.date+"T12:00:00")-start)/(7*864e5));if(k>=0&&k<weeks)c[k]++;});
  const max=Math.max(1,...c), x=i=>i*(w/(weeks-1)), y=v=>h-3-(h-8)*v/max;
  const pts=c.map((v,i)=>x(i).toFixed(1)+","+y(v).toFixed(1));
  const s=svgEl("svg",{class:"spark",viewBox:"0 0 "+w+" "+h,preserveAspectRatio:"none",role:"img","aria-label":"Brèves par semaine sur "+weeks+" semaines"});
  const defs=svgEl("defs"); const lg=svgEl("linearGradient",{id:"sparkgrad",x1:0,y1:0,x2:0,y2:1});
  put(lg,svgEl("stop",{offset:"0","stop-color":"var(--red)","stop-opacity":".45"}),svgEl("stop",{offset:"1","stop-color":"var(--red)","stop-opacity":"0"}));put(defs,lg);
  put(s,defs,svgEl("path",{class:"a",d:"M0,"+h+" L"+pts.join(" L")+" L"+w+","+h+" Z"}),svgEl("polyline",{class:"l",points:pts.join(" ")}),svgEl("circle",{class:"e",cx:x(weeks-1),cy:y(c[weeks-1]),r:2.8}));
  return s;
}
const cityItems=c=>sorted(S.items.filter(i=>i.statut!=="rejete"&&inCity(i,c)&&(S.f.statut!=="publie"||i.statut==="publie")));
function renderDossier(host){
  const c=S.city, all=cityItems(c), one=all[0]||{};
  const fc={}; all.forEach(i=>(i.filieres||[]).forEach(x=>fc[x]=(fc[x]||0)+1));
  const fl=Object.entries(fc).sort((a,b)=>b[1]-a[1]).slice(0,5); const fmax=Math.max(1,...fl.map(x=>x[1]));
  const head=el("div",{class:"phead"},
    el("button",{class:"back",type:"button",onclick:()=>unfocusCity()},"← Toutes les brèves"),
    el("div",{class:"prow"},el("h2",{class:"ptitle",style:"font-size:22px"},c),one.villeZh?el("span",{class:"zh muted",lang:"zh"},one.villeZh):null,el("span",{class:"muted"},one.province||"")),
    el("div",{class:"dossier-stats"},
      el("div",{},el("b",{},all.length),el("span",{},"brèves")),
      el("div",{},el("b",{},all.filter(i=>daysAgo(i.date)<=30).length),el("span",{},"sur 30 jours")),
      el("div",{},el("b",{style:"color:var(--red)"},all.filter(i=>i.type==="opportunite").length),el("span",{},"opportunités")),
      el("div",{},el("b",{},all.filter(i=>i.interetFrance).length),el("span",{},"intérêt France"))),
    el("div",{},el("p",{class:"plabel",style:"margin-bottom:4px"},"Activité, 26 semaines"),sparkline(all,26)),
    fl.length?el("div",{class:"filbars"},...fl.map(([k,n])=>el("div",{class:"filbar"},el("span",{},FIL[k]||k),el("span",{},el("i",{style:"width:"+(100*n/fmax)+"%"})),el("span",{class:"n"},n)))):null);
  const list=el("div",{class:"pscroll"});
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
  }
  const bn=$("#basemap-note"); if(bn) bn.textContent=basemapNote();
  put(land,svgEl("path",{class:"tropic",d:"M-600,"+py(23.44)+"H"+(W+900)}));
  const tr=svgEl("text",{class:"tropiclab",x:px(121.5),y:py(23.44)-5,"text-anchor":"middle"});tr.textContent="Tropique du Cancer";put(land,tr);
  for(const [n,lon,lat,inS] of PROV_LABELS){const t=svgEl("text",{class:"provlab"+(inS?" in":""),x:px(lon),y:py(lat),"text-anchor":"middle"});t.textContent=n;put(land,t);}
  svg.append(svgEl("g",{id:"g-cities"}),svgEl("g",{id:"g-marks"}));
  applyView();
}

/* ---------- Map: view (centre + scale) ---------- */
function freeRect(){
  const box=$("#mapbox").getBoundingClientRect();
  const wide=window.innerWidth>1060;
  const L=wide?($("#morning").offsetWidth+40):12, T=wide?110:56, R=wide?($("#side").offsetWidth+40):12, B=wide?90:60;
  return {w:box.width,h:box.height,x0:L,y0:T,fw:Math.max(160,box.width-L-R),fh:Math.max(160,box.height-T-B)};
}
function fitView(bb){const r=freeRect();const k=Math.min(r.fw/(bb[2]-bb[0]),r.fh/(bb[3]-bb[1]));return {cx:(bb[0]+bb[2])/2,cy:(bb[1]+bb[3])/2,k};}
function applyView(){
  const svg=$("#map"), r=freeRect(); if(!r.w) return;
  S.k0=fitView(frameBox(FRAMES.sud)).k;
  if(!S.vs) S.vs=fitView(frameBox(FRAMES[S.frame]));
  const {cx,cy,k}=S.vs, fcx=r.x0+r.fw/2, fcy=r.y0+r.fh/2;
  svg.setAttribute("viewBox",[(cx-fcx/k).toFixed(2),(cy-fcy/k).toFixed(2),(r.w/k).toFixed(2),(r.h/k).toFixed(2)].join(" "));
  S.zr=k/S.k0; S.zs=1/k; svg.style.setProperty("--zs",S.zs.toFixed(5)); svg.classList.toggle("zoomed",S.zr>1.7);
  $$("#map .pos:not(.mkpos)").forEach(g=>g.setAttribute("transform","translate("+g.dataset.x+" "+g.dataset.y+") scale("+S.zs.toFixed(5)+")"));
  const mode=S.zr<1.8?"base":"full"; if(mode!==S.groupMode){S.groupMode=mode;drawMarks();} else layoutMarks();
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
$$("#frames button").forEach(b=>b.addEventListener("click",()=>{if(S.city){S.city=null;preFocus=null;clearBurst();renderSide();markSel();}setFrame(b.dataset.f);}));
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
  svg.addEventListener("click",e=>{if(moved){e.stopPropagation();e.preventDefault();moved=false;return;}},true);
  svg.addEventListener("click",e=>{if(S.city&&!e.target.closest(".mk,.sat"))unfocusCity();});
})();

/* ---------- Map: city glyphs ---------- */
const posG=(x,y,cls,city)=>{const g=svgEl("g",{class:"pos"+(cls?" "+cls:""),"data-x":x.toFixed(2),"data-y":y.toFixed(2),transform:"translate("+x.toFixed(2)+" "+y.toFixed(2)+") scale("+S.zs.toFixed(5)+")"});if(city)g.dataset.city=city;return g;};
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
  put(g,svgEl("circle",{class:"glow",r:r+4}),svgEl("circle",{class:"halo",r:r+5}));
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
  S.animMarks=false; layoutMarks(); markSel(); if(S.city) burst(S.city,false);
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
  for(const q of P){q.g.setAttribute("transform","translate("+q.x.toFixed(2)+" "+q.y.toFixed(2)+") scale("+z.toFixed(5)+")");
    const ln=q.g.querySelector(".leader"); const lx=(q.tx-q.x)/z, ly=(q.ty-q.y)/z, far=Math.hypot(lx,ly)>2;
    ln.setAttribute("x2",lx.toFixed(2));ln.setAttribute("y2",ly.toFixed(2));ln.style.display=far?"":"none";
    const an=q.g.querySelector(".anchor"); an.setAttribute("cx",lx.toFixed(2)); an.setAttribute("cy",ly.toFixed(2)); an.style.display=far?"":"none";}
}
function markSel(){const svg=$("#map");svg.classList.toggle("focusing",!!S.city);$$("#g-marks .pos").forEach(g=>{const c=g.dataset.city;g.classList.toggle("sel",!!S.city&&(c===S.city||baseCity(c)===S.city));});}
function showTip(e,name,items){
  const tip=$("#tip"),wrap=$("#mapbox").getBoundingClientRect(),r=(e.currentTarget||e.target).getBoundingClientRect();
  const cnt=TYPE_ORDER.map(t=>[t,items.filter(i=>i.type===t).length]).filter(x=>x[1]).map(([t,n])=>n+" "+TYPES[t].lab.toLowerCase()+(n>1&&t!=="conjoncture"?"s":"")).join(", ");
  tip.replaceChildren(el("b",{},name),el("div",{},cnt),...sorted(items).slice(0,3).map(i=>el("div",{},"· "+clip(i.titre.replace(/^[^:]+:\s*/,""),70))),el("div",{class:"hint"},"Cliquer pour ouvrir le dossier"));
  tip.style.left=Math.min(Math.max(r.left+r.width/2-wrap.left,150),wrap.width-150)+"px"; tip.style.top=(r.top-wrap.top)+"px"; tip.style.opacity=1;
}
let preFocus=null;
function focusCity(name,c){
  if(!S.city) preFocus={vs:{...S.vs},frame:S.frame};
  S.city=name;
  $("#tip").style.opacity=0;
  clearBurst();
  const k=Math.min(S.k0*9,Math.max(S.vs.k*1.5,S.k0*2.2));
  clearFramePressed(); animateTo({cx:px(c.lon),cy:py(c.lat),k},700); renderSide(); markSel();
  clearTimeout(burstT); burstT=setTimeout(()=>{if(S.city===name||baseCity(name)===S.city)burst(S.city,true);},reduce?0:520);
}
let burstT;
function unfocusCity(){clearTimeout(burstT);clearBurst();S.city=null;renderSide();markSel();if(preFocus){const p=preFocus;preFocus=null;if(p.frame){setFrame(p.frame);}else animateTo(p.vs);}}
/* ---------- City burst: one satellite per brief, with its filière pictogram ---------- */
const ICONS={
  BAT:'<rect x="-4.6" y="-2.6" width="8" height="5.2" rx="1"/><rect class="f" x="3.6" y="-1.2" width="1.3" height="2.4" rx=".4"/><path d="M-1.6 -1.6 L-2.6 .3 H-.6 L-1.4 1.8"/>',
  MOB:'<path d="M-4.8 1.4 V-.2 L-3.4 -2.6 H3 L4.8 -.2 V1.4 Z"/><circle class="f" cx="-2.6" cy="2" r="1.1"/><circle class="f" cx="2.6" cy="2" r="1.1"/>',
  ROB:'<rect x="-3.8" y="-2.6" width="7.6" height="6" rx="1.6"/><path d="M0 -2.6 V-4.4"/><circle class="f" cx="0" cy="-4.6" r=".8"/><circle class="f" cx="-1.5" cy=".2" r=".9"/><circle class="f" cx="1.5" cy=".2" r=".9"/>',
  ENR:'<circle cx="0" cy="0" r="2.2"/><path d="M0 -4.6 V-3.4 M0 3.4 V4.6 M-4.6 0 H-3.4 M3.4 0 H4.6 M-3.3 -3.3 L-2.4 -2.4 M2.4 2.4 L3.3 3.3 M-3.3 3.3 L-2.4 2.4 M2.4 -2.4 L3.3 -3.3"/>',
  SAN:'<path class="f" d="M-1.3 -4.3 H1.3 V-1.3 H4.3 V1.3 H1.3 V4.3 H-1.3 V1.3 H-4.3 V-1.3 H-1.3 Z"/>',
  CON:'<path d="M-3.8 -1.2 H3.8 L3.1 4.2 H-3.1 Z"/><path d="M-1.8 -1.2 V-2.2 A1.8 1.8 0 0 1 1.8 -2.2 V-1.2"/>',
  NUM:'<rect x="-2.8" y="-2.8" width="5.6" height="5.6" rx=".8"/><rect class="f" x="-1.1" y="-1.1" width="2.2" height="2.2"/><path d="M-1.2 -2.8 V-4.4 M1.2 -2.8 V-4.4 M-1.2 2.8 V4.4 M1.2 2.8 V4.4 M-2.8 -1.2 H-4.4 M-2.8 1.2 H-4.4 M2.8 -1.2 H4.4 M2.8 1.2 H4.4"/>',
  FRC:'<path class="f" d="M0 -4.6 L1.2 -1.5 L4.4 -1.4 L1.9 .6 L2.8 3.8 L0 2 L-2.8 3.8 L-1.9 .6 L-4.4 -1.4 L-1.2 -1.5 Z"/>',
  ECO:'<path d="M-4.4 4 H4.4"/><rect class="f" x="-3.6" y=".4" width="1.9" height="3"/><rect class="f" x="-.95" y="-1.6" width="1.9" height="5"/><rect class="f" x="1.7" y="-3.6" width="1.9" height="7"/>'
};
function clearBurst(){ $$("#g-marks .burst").forEach(b=>b.remove()); }
function burst(name,animate){
  clearBurst(); if(!name) return;
  const pg=$$("#g-marks .pos.mkpos").find(g=>g.dataset.city===name)||$$("#g-marks .pos.mkpos").find(g=>baseCity(g.dataset.city)===name);
  if(!pg) return;
  const items=cityItems(name).filter(i=>passes(i,{ignorePeriod:true})).slice(0,18);
  if(!items.length) return;
  const r=+pg.dataset.r, n=items.length, ring1=Math.min(n,8);
  pg.parentNode.appendChild(pg);
  const g=svgEl("g",{class:"burst"}); pg.insertBefore(g,pg.querySelector(".mk"));
  items.forEach((it,i)=>{
    const inner=i<ring1, idx=inner?i:i-ring1, cnt=inner?ring1:n-ring1, R=inner?r+30:r+56;
    const a=-Math.PI/2+(cnt===1?0:2*Math.PI*idx/cnt)+(inner?0:Math.PI/cnt);
    const x=Math.cos(a)*R, y=Math.sin(a)*R;
    const sp=svgEl("line",{class:"spoke",x1:0,y1:0,x2:x.toFixed(1),y2:y.toFixed(1),pathLength:"1","stroke-dasharray":"1","stroke-dashoffset":"1"}); put(g,sp);
    const s=svgEl("g",{class:"sat t-"+it.type,"data-id":it.id,tabindex:"0",role:"button","aria-label":it.titre});
    put(s,svgEl("circle",{class:"sring",r:14}),svgEl("circle",{class:"sd",r:11}));
    const ic=svgEl("g",{class:"ic"}); ic.innerHTML=ICONS[(it.filieres||[])[0]]||ICONS.ECO; put(s,ic);
    s.addEventListener("click",e=>{e.stopPropagation();openFiche(it);});
    s.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openFiche(it);}});
    s.addEventListener("mouseenter",e=>{showSatTip(e,it);const c=$('#side article.brief[data-id="'+it.id+'"]');if(c){c.classList.add("lit");if(innerWidth>1060)c.scrollIntoView({block:"nearest",behavior:reduce?"auto":"smooth"});}});
    s.addEventListener("mouseleave",()=>{$("#tip").style.opacity=0;$$("#side article.brief.lit").forEach(c=>c.classList.remove("lit"));});
    put(g,s);
    if(reduce||!animate||!s.animate){s.setAttribute("transform","translate("+x.toFixed(1)+" "+y.toFixed(1)+")");sp.setAttribute("stroke-dashoffset","0");return;}
    s.setAttribute("transform","translate("+x.toFixed(1)+" "+y.toFixed(1)+")");
    s.animate([{transform:"translate(0px,0px) scale(.15)",opacity:0},{transform:"translate("+x.toFixed(1)+"px,"+y.toFixed(1)+"px) scale(1)",opacity:1}],{duration:560,delay:80+i*45,easing:"cubic-bezier(.34,1.56,.64,1)",fill:"both"});
    sp.animate([{strokeDashoffset:1},{strokeDashoffset:0}],{duration:380,delay:60+i*45,easing:"ease-out",fill:"both"});
  });
}
function showSatTip(e,it){
  const tip=$("#tip"),wrap=$("#mapbox").getBoundingClientRect(),r=(e.currentTarget||e.target).getBoundingClientRect();
  tip.replaceChildren(el("b",{},TYPES[it.type].lab+", "+fmtShort(it.date)),el("div",{},clip(it.titre,120)),el("div",{class:"hint"},"Ouvrir la fiche"));
  tip.style.left=Math.min(Math.max(r.left+r.width/2-wrap.left,160),wrap.width-160)+"px"; tip.style.top=(r.top-wrap.top)+"px"; tip.style.opacity=1;
}

/* ---------- Timeline ---------- */
function basemapNote(){return geoReady?"Fond : limites provinciales (ECharts 4.9), projection Mercator.":window.__chinaGeoError?"Fond de carte indisponible : seules les villes sont placées.":"Fond de carte en cours de chargement…";}
function renderTimeline(){
  const host=$("#timeline"); if(!host) return; host.replaceChildren();
  const weeks=26,start=new Date(today);start.setDate(start.getDate()-7*weeks);
  const counts=new Array(weeks).fill(0);
  for(const it of S.items.filter(i=>passes(i,{ignorePeriod:true}))){const k=Math.floor((new Date(it.date+"T12:00:00")-start)/(7*864e5));if(k>=0&&k<weeks)counts[k]++;}
  const max=Math.max(1,...counts),w=800,bw=w/weeks, lim=S.f.period==="all"?1e9:Number(S.f.period==="1"?1.5:S.f.period);
  const s=svgEl("svg",{viewBox:"0 0 "+w+" 36",preserveAspectRatio:"none",role:"img","aria-label":"Brèves par semaine sur 26 semaines"});
  counts.forEach((c,k)=>{const hgt=c?4+18*c/max:1.5;const wkEnd=new Date(start.getTime()+(k+1)*7*864e5);put(s,svgEl("rect",{class:"bar"+((today-wkEnd)/864e5<lim?" on":""),x:k*bw+3,y:23-hgt,width:bw-6,height:hgt,rx:2}));});
  [0,13,25].forEach(k=>{const d=new Date(start.getTime()+k*7*864e5);const t=svgEl("text",{class:"axis",x:k===25?w-2:k*bw+2,y:35,"text-anchor":k===25?"end":"start"});t.textContent=fmtShort(dayKey(d));put(s,t);});
  put(host,s);
}

/* ---------- Shared reading pieces ---------- */
const byId=id=>S.items.find(i=>i.id===id);
const refBtn=id=>{const it=byId(id);return it?el("button",{class:"ref",type:"button",onclick:()=>openFiche(it)},"Voir la brève"):null;};
const refList=ids=>{const its=(ids||[]).map(byId).filter(Boolean); if(!its.length) return null;
  if(its.length===1) return el("span",{class:"refs"},refBtn(its[0].id));
  const nm=it=>baseCity(it.ville||"National"); const dup=it=>its.filter(x=>nm(x)===nm(it)).length>1;
  return el("span",{class:"refs"},"Brèves : ",...its.flatMap((it,k)=>[k?", ":null,el("button",{class:"ref",type:"button",title:it.titre,onclick:()=>openFiche(it)},nm(it)+(dup(it)?" ("+fmtShort(it.date)+")":""))]));};
const rankedList=pts=>el("ol",{class:"ranked"},...pts.map((p,i)=>el("li",{},el("span",{class:"rk"},String(i+1)),el("div",{},el("span",{class:"tx"},p.texte),refList(p.items)))));
const figBox=c=>el("div",{class:"fig"},el("div",{class:"v"},c.valeur),el("div",{class:"l"},c.libelle),c.item&&byId(c.item)?el("div",{class:"s"},(baseCity(byId(c.item).ville)||"National")+", ",refBtn(c.item)):null);
const words=s=>(s||"").split(/\s+/).filter(Boolean).length;
function agendaList(days){const lim=new Date(today.getTime()+days*864e5);const it=S.agenda.filter(a=>(a.fin||a.date)>=dayKey(today)&&a.date<=dayKey(lim)).sort((a,b)=>a.date.localeCompare(b.date));
  if(!it.length)return el("p",{class:"note"},"Aucun événement daté dans les sept prochains jours.");
  return el("ul",{class:"agenda-mini"},...it.map(a=>{const j=daysTo(a.date);return el("li",{},el("span",{class:"when"},j>0?"J-"+j:"en cours"),el("span",{class:"what"},(a.ville?a.ville+" : ":"")+a.titre));}));}

/* ---------- 5 minutes band (below the map) ---------- */
function renderCinq(){
  const host=$("#cinq-body"); host.replaceChildren();
  if(S.dbState!=="ready"){put(host,el("div",{class:"glass card"},stateMsg()));return;}
  const c=S.cinq.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
  if(!c){put(host,el("div",{class:"glass card"},el("div",{class:"empty"},el("b",{},"L'essentiel en 5 minutes n'a pas encore été rédigé"),"Il est produit chaque matin avec la synthèse du jour.")));return;}
  const w=words([c.titre,c.faitDuJour,...(c.faits||[]).map(f=>f.texte),...(c.opportunites||[]).map(o=>o.texte),c.vigilance].join(" ")),sec=Math.round(w/230*60);
  put(host,el("div",{class:"band-in"},
    el("div",{class:"glass card"},
      el("div",{class:"kick"},el("span",{},"L'essentiel en 5 minutes, "+fmtD(c.date,{weekday:"long",day:"numeric",month:"long"})),el("span",{class:"readtime"},Math.max(1,Math.round(sec/60))+" min de lecture")),
      el("h2",{class:"display"},c.titre), el("p",{class:"lead"},c.faitDuJour),
      (c.opportunites||[]).length?el("h3",{class:"ctitle"},"Opportunités"):null,
      ...(c.opportunites||[]).map(o=>el("div",{class:"opp"},el("div",{class:"due"},o.echeance),el("p",{},o.texte),refList(o.items)))),
    el("div",{class:"glass card"},
      el("h3",{class:"ctitle"},"Cinq faits à retenir",el("small",{},"par ordre d'importance")),
      rankedList(c.faits||[])),
    el("div",{class:"side-stack"},
      el("div",{class:"figs"},...(c.chiffres||[]).map(figBox)),
      c.vigilance?el("div",{class:"alert"},el("h3",{class:"ctitle"},"Point de vigilance"),el("p",{},c.vigilance)):null,
      el("div",{class:"glass card"},el("h3",{class:"ctitle"},"Sept prochains jours"),agendaList(7)))));
}

/* ---------- Syntheses page ---------- */
const PER_LAB={jour:"Synthèse du jour",semaine:"Synthèse de la semaine",mois:"Synthèse du mois",trimestre:"Synthèse du trimestre"};
const PER_ORDER=["jour","semaine","mois","trimestre"];
const PER_TAB={jour:"Jour",semaine:"Semaine",mois:"Mois",trimestre:"Trimestre"};
const PER_NEXT={jour:"demain matin, après la collecte de 7 h",semaine:"vendredi, avec la collecte du matin",mois:"le premier jour ouvré du mois prochain",trimestre:"le premier jour ouvré du prochain trimestre"};
const PER_MIN={jour:10,semaine:8,mois:6,trimestre:4};
const qOf=iso=>{const d=new Date(iso+"T12:00:00");return "T"+(Math.floor(d.getMonth()/3)+1)+" "+d.getFullYear();};
const isoD=d=>{const z=n=>String(n).padStart(2,"0");return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate());};
const dAt=iso=>new Date(iso+"T12:00:00");
const mondayOf=iso=>{const d=dAt(iso);d.setDate(d.getDate()-((d.getDay()+6)%7));return isoD(d);};
function perSpan(x){
  if(!x)return"";
  if(x.periode==="trimestre"&&x.fin)return qOf(x.fin)+" · "+fmtD(x.debut||x.fin,{month:"short"})+" – "+fmtD(x.fin,{month:"short"});
  if(x.periode==="mois"&&x.fin){const m=fmtD(x.fin,{month:"long",year:"numeric"});return m.charAt(0).toUpperCase()+m.slice(1);}
  if(x.debut&&x.debut!==x.fin)return fmtShort(x.debut)+" – "+fmtShort(x.fin);
  return fmtD(x.fin,{weekday:"long",day:"numeric",month:"long"});
}
function perLong(s){
  if(s.periode==="trimestre")return {T1:"premier",T2:"deuxième",T3:"troisième",T4:"quatrième"}[qOf(s.fin).slice(0,2)]+" trimestre "+s.fin.slice(0,4)+", du "+fmtD(s.debut,{day:"numeric",month:"long"})+" au "+fmtD(s.fin);
  if(s.periode==="mois")return perSpan(s).toLowerCase();
  return s.debut&&s.debut!==s.fin?"du "+fmtD(s.debut,{day:"numeric",month:"long"})+" au "+fmtD(s.fin):fmtD(s.fin);
}
/* slot key of a synthesis, per period type */
function slotKey(p,s){
  if(p==="jour")return s.fin;
  if(p==="semaine")return mondayOf(s.debut||s.fin);
  if(p==="mois")return (s.fin||"").slice(0,7);
  return qOf(s.fin);
}
/* calendar of slots for the timeline: every period between the earliest synthesis (or a minimum window) and the latest */
function makeSlots(p,list){
  if(!list.length)return[];
  const by=new Map(list.map(s=>[slotKey(p,s),s]));
  const keys=[...by.keys()].sort(); const last=keys[keys.length-1], first=keys[0];
  const out=[];
  if(p==="jour"||p==="semaine"){
    const step=p==="jour"?1:7; const end=dAt(last); const start=dAt(last); start.setDate(start.getDate()-step*(PER_MIN[p]-1));
    const f=dAt(first); const s0=f<start?f:start;
    for(const d=new Date(s0);d<=end;d.setDate(d.getDate()+step)){const k=isoD(d);out.push({k,s:by.get(k)||null,d:k});}
  }else if(p==="mois"){
    const [ly,lm]=last.split("-").map(Number),[fy,fm]=first.split("-").map(Number);
    let y=ly,m=lm-(PER_MIN.mois-1); while(m<1){m+=12;y--;} if(fy*12+fm<y*12+m){y=fy;m=fm;}
    while(y*12+m<=ly*12+lm){const k=y+"-"+String(m).padStart(2,"0");out.push({k,s:by.get(k)||null,d:k+"-15"});m++;if(m>12){m=1;y++;}}
  }else{
    const qn=k=>{const [t,y]=k.split(" ");return Number(y)*4+Number(t.slice(1))-1;};
    const L=qn(last),F=Math.min(qn(first),L-(PER_MIN.trimestre-1));
    for(let n=F;n<=L;n++){const k="T"+(n%4+1)+" "+Math.floor(n/4);out.push({k,s:by.get(k)||null,d:Math.floor(n/4)+"-"+String((n%4)*3+2).padStart(2,"0")+"-15"});}
  }
  return out;
}
function slotLabel(p,x,i,all){
  if(p==="jour"){const d=dAt(x.d);const prev=i?dAt(all[i-1].d):null;return (!prev||prev.getMonth()!==d.getMonth()||d.getDate()===1)?fmtShort(x.d):String(d.getDate());}
  if(p==="semaine")return fmtShort(x.d);
  if(p==="mois")return fmtD(x.d,{month:"short"});
  return x.k.replace(" "," ");
}
const SB={p:null,slots:[],avail:[],list:[]};
const ARROW=d=>{const s=svgEl("svg",{viewBox:"0 0 24 24","aria-hidden":"true"});s.append(svgEl("path",{d:d<0?"M15 5l-7 7 7 7":"M9 5l7 7-7 7"}));return s;};
function renderSynth(){
  const host=$("#synth-body"); host.replaceChildren();
  if(S.dbState!=="ready"){put(host,el("div",{class:"glass card",style:"grid-column:1/-1"},stateMsg()));return;}
  const byP=p=>S.syntheses.filter(x=>x.periode===p).sort((a,b)=>(b.fin||"").localeCompare(a.fin||""));
  const list=byP(S.synthP);
  let s=list.find(x=>x.id===S.synthId)||list[0]||null;
  SB.p=S.synthP; SB.list=list; SB.slots=makeSlots(S.synthP,list); SB.avail=SB.slots.map((x,i)=>x.s?i:-1).filter(i=>i>=0);
  const tabs=el("div",{class:"pseg",role:"tablist","aria-label":"Période de la synthèse"},...PER_ORDER.map(p=>{const n=byP(p).length;
    return el("button",{type:"button",role:"tab","aria-selected":S.synthP===p?"true":"false",onclick:()=>{if(S.synthP===p)return;S.synthP=p;S.synthId=null;renderSynth();}},
      PER_TAB[p],el("span",{class:"pc"},n));}));
  const bar=el("div",{class:"synthbar glass"},tabs);
  if(SB.slots.length){
    const n=SB.slots.length, pct=i=>n>1?(i/(n-1))*100:50;
    const tl=el("div",{class:"tl",id:"tl",role:"slider",tabindex:"0","aria-label":"Faire défiler les "+PER_TAB[S.synthP].toLowerCase()+"s","aria-valuemin":"1","aria-valuemax":String(SB.avail.length)});
    const rail=el("div",{class:"tl-rail"},el("div",{class:"tl-fill",id:"tl-fill"}));
    put(tl,rail);
    SB.slots.forEach((x,i)=>{
      const lab=slotLabel(S.synthP,x,i,SB.slots);
      if(x.s){put(tl,el("button",{type:"button",class:"tl-slot",tabindex:"-1","data-i":i,style:"left:"+pct(i)+"%",title:perSpan(x.s)+" : "+clip(x.s.titre,110),"aria-label":perSpan(x.s),onclick:e=>{e.stopPropagation();pickSlot(i);}}),
        el("span",{class:"tl-lab on","data-i":i,style:"left:"+pct(i)+"%"},lab));}
      else{put(tl,el("span",{class:"tl-tick",style:"left:"+pct(i)+"%"}));
        if(i===0||i===n-1||(S.synthP==="jour"&&/\D/.test(lab)))put(tl,el("span",{class:"tl-lab","data-i":i,style:"left:"+pct(i)+"%"},lab));}
    });
    put(tl,el("div",{class:"tl-thumb",id:"tl-thumb"},el("span",{id:"tl-cap"})));
    /* drag / click / keys */
    const nearest=cx=>{const r=tl.getBoundingClientRect();const f=Math.min(1,Math.max(0,(cx-r.left)/r.width));let best=SB.avail[0],bd=1e9;for(const i of SB.avail){const d=Math.abs(pct(i)/100-f);if(d<bd){bd=d;best=i;}}return best;};
    let drag=false;
    tl.addEventListener("pointerdown",e=>{drag=true;tl.setPointerCapture(e.pointerId);tl.classList.add("drag");pickSlot(nearest(e.clientX));});
    tl.addEventListener("pointermove",e=>{if(drag)pickSlot(nearest(e.clientX));});
    const end=()=>{drag=false;tl.classList.remove("drag");};
    tl.addEventListener("pointerup",end);tl.addEventListener("pointercancel",end);
    tl.addEventListener("keydown",e=>{const m={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1}[e.key];if(m){e.preventDefault();stepSynth(m);}
      if(e.key==="Home"){e.preventDefault();pickSlot(SB.avail[0]);}if(e.key==="End"){e.preventDefault();pickSlot(SB.avail[SB.avail.length-1]);}});
    put(bar,el("div",{class:"tl-wrap"},tl),
      el("div",{class:"tl-arrows"},
        el("button",{type:"button",class:"dbtn",id:"syn-prev","aria-label":"Synthèse précédente",title:"Synthèse précédente",onclick:()=>stepSynth(-1)},ARROW(-1)),
        el("button",{type:"button",class:"dbtn",id:"syn-next","aria-label":"Synthèse suivante",title:"Synthèse suivante",onclick:()=>stepSynth(1)},ARROW(1))));
  }
  put(host,bar,el("div",{id:"synth-sheet",class:"synth-sheet"}));
  if(!s){put($("#synth-sheet"),el("div",{class:"sheet glass"},el("div",{class:"empty"},el("b",{},"Pas encore de "+PER_LAB[S.synthP].toLowerCase()),"La prochaine sera rédigée "+PER_NEXT[S.synthP]+".")));return;}
  selectSynth(s,0,true);
}
function curSlot(){return SB.slots.findIndex(x=>x.s&&x.s.id===S.synthId);}
function pickSlot(i){const x=SB.slots[i];if(!x||!x.s||x.s.id===S.synthId)return;const c=curSlot();selectSynth(x.s,i>c?1:-1);}
function stepSynth(d){const c=SB.avail.indexOf(curSlot());const j=SB.avail[c+d];if(j!=null)pickSlot(j);}
function selectSynth(s,dir,first){
  S.synthId=s.id;
  const i=curSlot(), n=SB.slots.length, pct=n>1?(i/(n-1))*100:50, k=SB.avail.indexOf(i);
  const th=$("#tl-thumb"); if(th){th.style.left=pct+"%";$("#tl-cap").textContent=perSpan(s);$("#tl-fill").style.width=pct+"%";
    th.classList.toggle("edge-l",pct<12);th.classList.toggle("edge-r",pct>88);
    const tl=$("#tl");tl.setAttribute("aria-valuenow",String(k+1));tl.setAttribute("aria-valuetext",perSpan(s));
    $$("#tl .tl-slot").forEach(b=>b.classList.toggle("cur",+b.dataset.i===i));$$("#tl .tl-lab").forEach(b=>b.classList.toggle("cur",+b.dataset.i===i));
    $("#syn-prev").disabled=k<=0;$("#syn-next").disabled=k>=SB.avail.length-1;}
  renderSheet(s,dir);
}
const kfig=c=>el("div",{class:"kfig"},el("div",{class:"v"},c.valeur),el("div",{class:"l"},c.libelle),c.item&&byId(c.item)?el("div",{class:"s"},(baseCity(byId(c.item).ville)||"National")+", ",refBtn(c.item)):null);
function renderSheet(s,dir){
  const sh=$("#synth-sheet"); if(!sh)return; sh.replaceChildren();
  const list=SB.list, j=list.indexOf(s), older=list[j+1], newer=list[j-1];
  const nb=new Set((s.points||[]).flatMap(p=>p.items||[])).size;
  const shn=(x,d)=>x?el("button",{type:"button",class:"shn "+(d<0?"prev":"next"),onclick:()=>{selectSynth(x,d);$("#synth-body").scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"});}},
      el("span",{class:"shn-k"},d<0?"← Précédente":"Suivante →"),el("span",{class:"shn-d"},perSpan(x)),el("span",{class:"shn-t"},clip(x.titre,96))):el("span");
  const art=el("article",{class:"sheet glass"+(dir?" in-"+(dir>0?"r":"l"):"")},
    el("div",{class:"sh-grid"},
      el("div",{class:"sh-main"},
        el("div",{class:"kick"},el("span",{},PER_LAB[s.periode]+", "+perLong(s)),el("span",{class:"readtime"},(s.points||[]).length+" points · "+nb+" brève"+(nb>1?"s":"")+" citée"+(nb>1?"s":""))),
        el("h2",{class:"display"},s.titre),
        el("p",{class:"lead"},s.lead),
        el("h3",{class:"ctitle sh-h"},"Points clés",el("small",{},"par ordre d'importance pour le service")),
        s.points&&s.points.length?rankedList(s.points):el("p",{class:"note"},"Aucun point.")),
      el("aside",{class:"sh-aside"},
        s.chiffres&&s.chiffres.length?el("div",{class:"kfigs"},el("h3",{class:"ctitle"},"Chiffres clés"),...s.chiffres.map(kfig)):null,
        s.surveiller?el("div",{class:"watch"},el("h3",{class:"ctitle"},"À surveiller"),el("p",{},s.surveiller)):null,
        el("p",{class:"note"},(s.note?s.note+" ":"")+"Chaque point renvoie à une brève sourcée."))),
    (older||newer)?el("nav",{class:"sh-nav","aria-label":"Autres synthèses"},shn(older,-1),shn(newer,1)):null);
  put(sh,art);
}

/* ---------- Brèves page ---------- */
function filterGroups(){
  const f=S.f, g=(lab,...chips)=>el("div",{class:"fgroup"},el("span",{},lab),el("div",{class:"chips"},...chips));
  return [
    g("Zone",...["CAN","CHE","NAT"].map(z=>chip(ZONES[z],f.zones.has(z),solo(f.zones,z,["CAN","CHE","NAT"],["CAN","CHE","NAT","HKM"])))),
    g("Type",...TYPE_ORDER.map(k=>chip(TYPES[k].lab,f.types.has(k),solo(f.types,k,TYPE_ORDER),swatch(k)))),
    g("Période",...[["1","Jour"],...PERIODS].map(([v,l])=>chip(l,f.period===v,()=>{f.period=v;rerender();}))),
    g("Affichage",chip("Intérêt France",f.fr,()=>{f.fr=!f.fr;rerender();}),chip("À confirmer ("+nPending()+")",f.statut==="a_confirmer",()=>{f.statut=f.statut==="a_confirmer"?"publie":"a_confirmer";rerender();})),
    g("Filière",...Object.keys(FIL).map(k=>chip(FIL[k],f.fils.has(k),tog(f.fils,k))))
  ];
}
function renderFil(){
  const rail=$("#filters-fil"); rail.replaceChildren();
  put(rail,el("div",{class:"fsum"},el("b",{style:"font-size:16px"},"Filtres"),el("button",{class:"linkbtn",type:"button",onclick:resetFilters},"Réinitialiser")),...filterGroups());
  const host=$("#fil-list"); host.replaceChildren();
  if(S.dbState!=="ready"){put(host,stateMsg());renderOverview([]);return;}
  const list=sorted(S.items.filter(i=>passes(i)));
  $("#fil-meta").textContent=list.length+" brève"+(list.length>1?"s":"");
  renderOverview(list);
  if(!list.length){put(host,el("div",{class:"empty"},el("b",{},"Aucune brève pour ces filtres"),"Élargissez la période ou réinitialisez les filtres."));return;}
  let groups;
  if(S.groupBy==="date"){const m=new Map();list.forEach(i=>{if(!m.has(i.date))m.set(i.date,[]);m.get(i.date).push(i);});groups=[...m].map(([k,v])=>[fmtD(k,{weekday:"long",day:"numeric",month:"long",year:"numeric"}),v]);}
  else if(S.groupBy==="rubrique"){groups=RUBRIQUES.map(r=>[r,list.filter(i=>i.rubrique===r)]).filter(g=>g[1].length);const o=list.filter(i=>!RUBRIQUES.includes(i.rubrique));if(o.length)groups.push(["Autres",o]);}
  else groups=["CAN","CHE","HKM","NAT"].map(z=>[z==="NAT"?"Cadre national":"Circonscription de "+ZONES[z],list.filter(i=>i.zone===z)]).filter(g=>g[1].length);
  for(const [h,v] of groups){put(host,el("div",{class:"group-h"},h.charAt(0).toUpperCase()+h.slice(1)));v.forEach(i=>put(host,briefCard(i)));}
}
function renderOverview(list){
  const host=$("#overview"); host.replaceChildren();
  const fc={}; list.forEach(i=>(i.filieres||[]).forEach(x=>fc[x]=(fc[x]||0)+1));
  const fl=Object.entries(fc).sort((a,b)=>b[1]-a[1]); const fmax=Math.max(1,...fl.map(x=>x[1]));
  const z=k=>list.filter(i=>i.zone===k).length;
  put(host,
    el("div",{},el("p",{class:"plabel"},"Sélection"),el("div",{class:"ov-n"},list.length),el("span",{class:"muted"},"brèves, "+new Set(list.filter(i=>i.ville).map(i=>baseCity(i.ville))).size+" villes")),
    el("div",{class:"ov-split"},...TYPE_ORDER.map(t=>el("div",{},el("b",{style:t==="opportunite"?"color:var(--red)":null},list.filter(i=>i.type===t).length),el("span",{},TYPES[t].lab)))),
    el("div",{class:"ov-split"},el("div",{},el("b",{},z("CAN")),el("span",{},"Canton")),el("div",{},el("b",{},z("CHE")),el("span",{},"Chengdu")),el("div",{},el("b",{},z("NAT")),el("span",{},"National"))),
    el("div",{style:"display:grid;gap:8px"},el("p",{class:"plabel"},"Par filière"),el("div",{class:"filbars"},...fl.map(([k,n])=>el("div",{class:"filbar"},el("span",{},FIL[k]||k),el("span",{},el("i",{style:"width:"+(100*n/fmax)+"%"})),el("span",{class:"n"},n))))),
    el("div",{style:"display:grid;gap:6px"},el("p",{class:"plabel"},"Activité, 26 semaines"),sparkline(list,26)));
}

/* ---------- Sources page ---------- */
function renderSources(){
  const sum=$("#src-sum"),tb=$("#src-table"); sum.replaceChildren(); tb.replaceChildren();
  if(S.dbState!=="ready"){put(sum,stateMsg());return;}
  const src=S.sources.slice().sort((a,b)=>(a.num||0)-(b.num||0)); const c=k=>src.filter(s=>s.statut===k).length;
  const kinds=[["ok","opérationnelles","var(--good)"],["partiel","partielles","var(--warn)"],["echec","en échec","var(--bad)"]];
  const ZL={CAN:"Circonscription de Canton",CHE:"Circonscription de Chengdu",NAT:"Chine, national",Chine:"Chine, national",Bourse:"Bourses",France:"France",UE:"Union européenne",International:"International"};
  const zones={}; src.forEach(s=>{const z=ZL[s.zone]||s.zone||"Autre";zones[z]=(zones[z]||0)+1;});
  put(sum,
    el("div",{},el("p",{class:"plabel"},"Sources suivies"),el("div",{class:"ov-n"},src.length)),
    el("div",{class:"srcbig"},...kinds.map(([k,l,col])=>el("div",{},el("b",{style:"color:"+col},c(k)),el("span",{},l)))),
    el("div",{class:"srcbar"},...kinds.map(([k,,col])=>el("i",{style:"width:"+(100*c(k)/Math.max(1,src.length))+"%;background:"+col}))),
    el("div",{style:"display:grid;gap:8px"},el("p",{class:"plabel"},"Par origine"),el("ul",{class:"zonelist"},...Object.entries(zones).sort((a,b)=>b[1]-a[1]).map(([z,n])=>el("li",{},el("span",{},z),el("b",{},n))))),
    el("p",{class:"note"},"Brèves retenues sur 30 jours : "+S.items.filter(i=>daysAgo(i.date)<=30).length+". Chaque source est testée par la collecte du matin."));
  const lab={ok:"Opérationnelle",partiel:"Partielle",echec:"Échec",non_teste:"Non testée"};
  put(tb,el("thead",{},el("tr",{},...["#","Source","Origine","Mode de collecte","État","Dernier essai","Brèves","Note"].map(h=>el("th",{},h)))));
  put(tb,el("tbody",{},...src.map(s=>el("tr",{},el("td",{class:"num"},s.num),el("td",{},s.url?el("a",{href:s.url,target:"_blank",rel:"noopener"},s.nom):s.nom),el("td",{},s.zone||""),el("td",{},s.mode||""),el("td",{},el("span",{class:"st "+(s.statut||"non_teste")},lab[s.statut]||"Non testée")),el("td",{},s.dernierEssai?fmtShort(s.dernierEssai):"—"),el("td",{class:"num"},s.items||0),el("td",{},s.note||"")))));
}

/* ---------- Fiche ---------- */
const briefText=it=>{const s=it.source||{};return it.titre+"\n\n"+it.corps+"\n\nSource : "+(s.emetteur||"")+(s.titre?", « "+s.titre+" »":"")+(s.date?", "+fmtD(s.date):"")+" — "+(s.url||"");};
function ctxFor(it){const v=$("#view-"+S.view);let ids=v?[...new Set([...v.querySelectorAll("article.brief[data-id]")].map(a=>a.dataset.id))]:[];
  if(!ids.includes(it.id))ids=sorted(S.items.filter(i=>i.statut!=="rejete")).map(i=>i.id);return ids;}
function navFiche(d){if(!S.current||!S.ctx)return;const id=S.ctx[S.ctx.indexOf(S.current.id)+d];const it=id&&byId(id);if(it)openFiche(it,d);}
function openFiche(it,nav){
  if(!nav)S.ctx=ctxFor(it);
  S.current=it; markRead(it); const b=$("#fiche-body"); b.replaceChildren(); const t=TYPES[it.type]||TYPES.fait; const s=it.source||{};
  put(b,
    el("div",{class:"btop"},el("span",{class:"tpill"},el("i",{class:"sw "+t.sw}),t.lab),...(it.filieres||[]).map(x=>el("span",{class:"fil"},FIL[x]||x)),el("span",{class:"rel "+it.fiabilite},relLabel(it.fiabilite)),it.interetFrance?el("span",{class:"fr"},"Intérêt France"):null,it.statut==="a_confirmer"?el("span",{class:"pending"},"À confirmer"):null,el("span",{class:"bdate"},fmtD(it.date))),
    el("h2",{id:"fiche-title",tabindex:"-1"},it.titre), el("p",{class:"corps"},it.corps),
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
  const ci=S.ctx.indexOf(it.id); $("#d-pos").textContent=S.ctx.length>1&&ci>=0?(ci+1)+" / "+S.ctx.length:""; $("#d-prev").disabled=ci<=0; $("#d-next").disabled=ci<0||ci>=S.ctx.length-1;
  $$("article.brief.cur").forEach(a=>a.classList.remove("cur")); $$('article.brief[data-id="'+it.id+'"]').forEach(a=>a.classList.add("cur"));
  const p=$("#panier"); if(p.open)p.close();
  const d=$("#fiche"); const y=window.scrollY; if(!d.open) d.show();
  b.scrollTop=0; const h=$("#fiche-title"); if(h) h.focus({preventScroll:true});
  if(window.scrollY!==y) window.scrollTo(0,y);
  if(nav){b.classList.remove("swap-l","swap-r");void b.offsetWidth;b.classList.add(nav>0?"swap-r":"swap-l");
    const c=$('#view-'+S.view+' article.brief[data-id="'+it.id+'"]'); if(c&&innerWidth>1060){const r=c.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight)c.scrollIntoView({block:"nearest",behavior:reduce?"auto":"smooth"});}}
  syncNote();
}
$("#btn-close").addEventListener("click",()=>$("#fiche").close());
$("#d-prev").addEventListener("click",()=>navFiche(-1));
$("#d-next").addEventListener("click",()=>navFiche(1));
$("#fiche").addEventListener("close",()=>{$$("article.brief.cur").forEach(a=>a.classList.remove("cur"));if(S.view==="today"){renderMorning();renderSide();drawMarks();}else if(S.view==="fil")renderFil();});
$("#btn-copy").addEventListener("click",async()=>{const it=S.current;if(!it)return;const txt=briefText(it);
  try{await navigator.clipboard.writeText(txt);$("#fiche-status").textContent="Brève copiée.";}
  catch(e){const ta=el("textarea",{style:"position:fixed;left:-9999px"});ta.value=txt;document.body.append(ta);ta.select();try{document.execCommand("copy");$("#fiche-status").textContent="Brève copiée.";}catch(_){$("#fiche-status").textContent="Copie refusée : sélectionnez le texte à la main.";}ta.remove();}});
async function setStatut(st){const it=S.current;if(!it||!DB)return;$("#fiche-status").textContent="Enregistrement…";
  try{await DB.doc("items/"+it.id).update({statut:st});$("#fiche-status").textContent=st==="publie"?"Brève validée et publiée.":"Brève rejetée.";$("#btn-validate").hidden=true;$("#btn-reject").hidden=true;}
  catch(e){$("#fiche-status").textContent="Enregistrement refusé ("+(e&&e.code||"erreur")+"). Seuls les éditeurs de la page peuvent valider.";}}
$("#btn-validate").addEventListener("click",()=>setStatut("publie"));
$("#btn-reject").addEventListener("click",()=>setStatut("rejete"));

/* ---------- Note interne (panier d'export) ---------- */
let NOTE=[]; try{NOTE=JSON.parse(store.get("vcs.note")||"[]");if(!Array.isArray(NOTE))NOTE=[];}catch(e){NOTE=[];}
let noteObjet=""; let noteGroup=store.get("vcs.noteGroup")!=="0";
const inNote=id=>NOTE.includes(id);
const noteItems=()=>NOTE.map(byId).filter(Boolean);
const ICON_ADD='<svg class="i-add" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><svg class="i-on" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function noteBtn(it){const on=inNote(it.id);
  const b=el("button",{type:"button",class:"addnote","data-note":it.id,"aria-pressed":on?"true":"false",title:on?"Retirer de la note":"Ajouter à la note","aria-label":(on?"Retirer de la note : ":"Ajouter à la note : ")+it.titre,
    onclick:e=>{e.stopPropagation();toggleNote(it.id);},onkeydown:e=>e.stopPropagation()});
  b.innerHTML=ICON_ADD;return b;}
function saveNote(){store.set("vcs.note",JSON.stringify(NOTE));syncNote();}
function toggleNote(id){const i=NOTE.indexOf(id);if(i>=0)NOTE.splice(i,1);else{NOTE.push(id);bumpNote();maybeBubble();}saveNote();}
function bumpNote(){const b=$("#btn-note");b.classList.remove("bump");void b.offsetWidth;b.classList.add("bump");}
function syncNote(){
  const n=noteItems().length; $("#note-count").textContent=n; $("#btn-note").classList.toggle("has",n>0);
  $$("[data-note]").forEach(b=>{const on=inNote(b.dataset.note);b.setAttribute("aria-pressed",on?"true":"false");b.title=on?"Retirer de la note":"Ajouter à la note";});
  if(S.current){const on=inNote(S.current.id),a=$("#btn-addnote");a.textContent=on?"Retirer de la note":"Ajouter à la note";a.classList.toggle("on",on);}
  if($("#panier").open)renderPanier();
}
/* bulle d'aide : affichée au premier ajout, puis via le bouton i */
function placeBubble(){const r=$("#btn-note").getBoundingClientRect(),bb=$("#note-bubble");bb.style.top=(r.bottom+12)+"px";bb.style.right=Math.max(12,innerWidth-r.right-8)+"px";bb.style.setProperty("--ax",Math.max(18,Math.min(300,innerWidth-r.right-Math.max(12,innerWidth-r.right-8)+r.width/2))+"px");}
function maybeBubble(){if(store.get("vcs.noteTip"))return;showBubble();}
function showBubble(){const bb=$("#note-bubble");placeBubble();bb.hidden=false;bb.classList.remove("in");void bb.offsetWidth;bb.classList.add("in");}
function hideBubble(){store.set("vcs.noteTip","1");$("#note-bubble").hidden=true;}
$("#bubble-ok").addEventListener("click",hideBubble);
$("#bubble-open").addEventListener("click",()=>{hideBubble();openPanier();});
window.addEventListener("resize",()=>{if(!$("#note-bubble").hidden)placeBubble();});

function defaultObjet(its){if(!its.length)return"Veille économique Chine du Sud";const ds=its.map(i=>i.date).sort(),a=ds[0],b=ds[ds.length-1];
  const sm=a.slice(0,7)===b.slice(0,7), sy=a.slice(0,4)===b.slice(0,4);
  return "Veille économique Chine du Sud : sélection de brèves "+(a===b?"du "+fmtD(b):"du "+fmtD(a,sm?{day:"numeric"}:sy?{day:"numeric",month:"long"}:undefined).replace(/^1$/,"1er")+" au "+fmtD(b));}
const SVGP=d=>{const s=svgEl("svg",{viewBox:"0 0 24 24","aria-hidden":"true"});d.split("|").forEach(x=>s.append(svgEl("path",{d:x})));return s;};
function renderPanier(){
  const b=$("#panier-body"); b.replaceChildren(); const its=noteItems(); const info=$("#panier-info");
  const showHint=!its.length||info.getAttribute("aria-expanded")==="true";
  const hint=el("div",{class:"hint"},
    el("p",{},"La note rassemble les brèves choisies avec le bouton ",el("span",{class:"kbd"},"+"),", sur la carte, dans le fil ou depuis une fiche. Rangez-les ici puis exportez-les en Word : une note interne en Times New Roman, brèves classées par rubrique, source en pied de chacune, prête à relire et à transmettre."),
    el("p",{class:"muted"},"La sélection reste enregistrée dans ce navigateur."));
  hint.hidden=!showHint; info.setAttribute("aria-expanded",showHint&&its.length?"true":"false");
  put(b,hint);
  ["#panier-export","#panier-copy","#panier-clear"].forEach(s=>$(s).disabled=!its.length);
  if(!its.length){put(b,el("div",{class:"empty"},el("b",{},"La note est vide"),"Ouvrez une brève et choisissez « Ajouter à la note », ou utilisez le bouton + d'une carte."));return;}
  const inp=el("input",{type:"text",id:"note-objet",value:noteObjet||defaultObjet(its),oninput:e=>{noteObjet=e.target.value;}});
  const chk=el("input",{type:"checkbox",id:"note-group",onchange:e=>{noteGroup=e.target.checked;store.set("vcs.noteGroup",noteGroup?"1":"0");}}); chk.checked=noteGroup;
  const words=its.reduce((n,i)=>n+(i.corps||"").split(/\s+/).length+(i.titre||"").split(/\s+/).length,0);
  put(b,
    el("label",{class:"field"},el("span",{},"Objet"),inp),
    el("label",{class:"switch"},chk,el("span",{class:"sw-ui","aria-hidden":"true"}),el("span",{},"Classer par rubrique dans le document (sinon, ordre de la liste)")),
    el("div",{class:"nhead"},el("span",{},its.length+" brève"+(its.length>1?"s":"")),el("span",{class:"muted"},"environ "+Math.round(words/10)*10+" mots, "+Math.max(1,Math.round(words/380))+" page"+(Math.round(words/380)>1?"s":""))),
    el("ol",{class:"nlist"},...its.map((it,i)=>el("li",{},
      el("span",{class:"nrk"},String(i+1)),
      el("div",{class:"ntx"},el("button",{type:"button",class:"ntitle",onclick:()=>openFiche(it)},it.titre),
        el("span",{class:"nmeta"},(baseCity(it.ville)||"National")+" · "+fmtShort(it.date)+" · "+(it.rubrique||"Sans rubrique"))),
      el("div",{class:"nctl"},
        el("button",{type:"button",class:"dbtn sm","aria-label":"Monter",title:"Monter",disabled:i===0?true:null,onclick:()=>moveNote(i,-1)},SVGP("M6 15l6-6 6 6")),
        el("button",{type:"button",class:"dbtn sm","aria-label":"Descendre",title:"Descendre",disabled:i===its.length-1?true:null,onclick:()=>moveNote(i,1)},SVGP("M6 9l6 6 6-6")),
        el("button",{type:"button",class:"dbtn sm","aria-label":"Retirer",title:"Retirer de la note",onclick:()=>{NOTE=NOTE.filter(x=>x!==it.id);saveNote();}},SVGP("M6 6l12 12|M18 6L6 18")))))));
}
function moveNote(i,d){const ids=noteItems().map(x=>x.id);const j=i+d;if(j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];NOTE=ids;saveNote();}
function openPanier(){const f=$("#fiche");if(f.open)f.close();hideBubbleSilently();const p=$("#panier");renderPanier();$("#panier-status").textContent="";if(!p.open)p.show();$("#panier-title").focus({preventScroll:true});}
function hideBubbleSilently(){if(!$("#note-bubble").hidden)hideBubble();}
$("#panier-title").setAttribute("tabindex","-1");
$("#btn-note").addEventListener("click",()=>{const p=$("#panier");if(p.open)p.close();else openPanier();});
$("#panier-close").addEventListener("click",()=>$("#panier").close());
$("#panier-info").addEventListener("click",e=>{const b=e.currentTarget,on=b.getAttribute("aria-expanded")!=="true";b.setAttribute("aria-expanded",on?"true":"false");const h=$("#panier-body .hint");if(h)h.hidden=!on&&noteItems().length>0;});
$("#panier-clear").addEventListener("click",()=>{if(!NOTE.length)return;const keep=NOTE.slice();NOTE=[];noteObjet="";saveNote();
  const st=$("#panier-status");st.replaceChildren("Note vidée. ",el("button",{class:"linkbtn",type:"button",onclick:()=>{NOTE=keep;saveNote();st.textContent="";}},"Annuler"));});
$("#btn-addnote").addEventListener("click",()=>{if(S.current)toggleNote(S.current.id);});

/* texte brut */
function noteGroups(its){
  if(!noteGroup)return[[null,its]];
  const g=RUBRIQUES.map(r=>[r,its.filter(i=>i.rubrique===r)]).filter(x=>x[1].length);
  const o=its.filter(i=>!RUBRIQUES.includes(i.rubrique)); if(o.length)g.push(["Autres informations",o]);
  return g;
}
const srcLine=it=>{const s=it.source||{};return "Source : "+(s.emetteur||"")+(s.titre?", « "+s.titre+" »":"")+(s.date?", "+fmtD(s.date):"")+".";};
function noteText(){
  const its=noteItems(), obj=($("#note-objet")&&$("#note-objet").value)||defaultObjet(its);
  const out=["NOTE","Objet : "+obj,"Canton, le "+fmtD(isoD(new Date())),"","Résumé"];
  noteGroups(its).flatMap(g=>g[1]).forEach(i=>out.push("– "+i.titre));
  noteGroups(its).forEach(([r,l],k)=>{out.push("");if(r)out.push((k+1)+". "+r,"");l.forEach(i=>{out.push(i.titre,i.corps);if((i.drapeaux||[]).length)out.push("À vérifier : "+i.drapeaux.join(" ; ")+".");out.push(srcLine(i)+(i.source&&i.source.url?" "+i.source.url:""),"");});});
  return out.join("\n");
}
$("#panier-copy").addEventListener("click",async()=>{const t=noteText(),st=$("#panier-status");
  try{await navigator.clipboard.writeText(t);st.textContent="Texte copié.";}
  catch(e){const ta=el("textarea",{style:"position:fixed;left:-9999px"});ta.value=t;document.body.append(ta);ta.select();try{document.execCommand("copy");st.textContent="Texte copié.";}catch(_){st.textContent="Copie refusée par le navigateur.";}ta.remove();}});

/* ---------- Générateur .docx autonome (zip sans compression + WordprocessingML) ---------- */
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
const crc32=u=>{let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRC[(c^u[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
function zipStore(files){
  const enc=new TextEncoder(), parts=[], central=[]; let off=0;
  const dt=new Date(), dosT=(dt.getHours()<<11)|(dt.getMinutes()<<5)|(dt.getSeconds()>>1), dosD=((dt.getFullYear()-1980)<<9)|((dt.getMonth()+1)<<5)|dt.getDate();
  for(const f of files){
    const name=enc.encode(f.name), data=typeof f.data==="string"?enc.encode(f.data):f.data, crc=crc32(data);
    const h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint16(10,dosT,true);h.setUint16(12,dosD,true);
    h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);h.setUint16(28,0,true);
    parts.push(new Uint8Array(h.buffer),name,data);
    const c=new DataView(new ArrayBuffer(46));
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,0,true);c.setUint16(12,dosT,true);c.setUint16(14,dosD,true);
    c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,off,true);
    central.push(new Uint8Array(c.buffer),name);
    off+=30+name.length+data.length;
  }
  const csz=central.reduce((n,u)=>n+u.length,0), e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,csz,true);e.setUint32(16,off,true);
  return new Blob([...parts,...central,new Uint8Array(e.buffer)],{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
}
const xe=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"");
function buildDocx(){
  const its=noteItems(), obj=($("#note-objet")&&$("#note-objet").value.trim())||defaultObjet(its);
  const links=[]; const link=u=>{links.push(u);return "rIdL"+links.length;};
  const run=(t,o={})=>'<w:r>'+(o.b||o.i||o.sz||o.color||o.caps?'<w:rPr>'+(o.b?'<w:b/>':'')+(o.i?'<w:i/>':'')+(o.caps?'<w:caps/>':'')+(o.color?'<w:color w:val="'+o.color+'"/>':'')+(o.sz?'<w:sz w:val="'+o.sz+'"/><w:szCs w:val="'+o.sz+'"/>':'')+'</w:rPr>':'')+'<w:t xml:space="preserve">'+xe(t)+'</w:t></w:r>';
  const para=(runs,o={})=>'<w:p><w:pPr>'+(o.style?'<w:pStyle w:val="'+o.style+'"/>':'')+(o.keep?'<w:keepNext/>':'')+(o.border?'<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="6" w:color="999999"/></w:pBdr>':'')+(o.tabs?'<w:tabs><w:tab w:val="right" w:pos="9070"/></w:tabs>':'')+(o.ind?'<w:ind w:left="'+o.ind+'" w:hanging="'+o.ind+'"/>':'')+(o.after!=null||o.before!=null?'<w:spacing'+(o.before!=null?' w:before="'+o.before+'"':'')+(o.after!=null?' w:after="'+o.after+'"':'')+'/>':'')+(o.jc?'<w:jc w:val="'+o.jc+'"/>':'')+'</w:pPr>'+runs+'</w:p>';
  const hl=(u,t)=>'<w:hyperlink r:id="'+link(u)+'" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">'+xe(t)+'</w:t></w:r></w:hyperlink>';
  const m=S.meta||{}; const dateTxt="Canton, le "+fmtD(isoD(new Date()));
  let body='';
  body+=para(run("Veille économique Chine du Sud",{sz:20,color:"555555"})+'<w:r><w:tab/></w:r>'+run(dateTxt,{sz:20,color:"555555"}),{tabs:true,after:480});
  body+=para(run("NOTE",{b:true,sz:32}),{jc:"center",after:360});
  body+=para(run("Objet : ",{b:true})+run(obj),{border:true,after:300});
  body+=para(run("Résumé",{b:true}),{keep:true,after:120});
  noteGroups(its).flatMap(g=>g[1]).forEach(i=>{body+=para(run("–")+'<w:r><w:tab/></w:r>'+run(i.titre),{ind:284,after:60,style:"Resume"});});
  noteGroups(its).forEach(([r,l],k)=>{
    if(r)body+=para(run((k+1)+". "+r,{b:true}),{style:"Rubrique",keep:true});
    else if(k===0)body+=para("",{after:120});
    l.forEach(i=>{
      body+=para(run(i.titre,{b:true}),{style:"BreveTitre",keep:true});
      body+=para(run(i.corps),{style:"BreveCorps"});
      if((i.drapeaux||[]).length)body+=para(run("À vérifier : "+i.drapeaux.join(" ; ")+".",{i:true,sz:20}),{style:"Source"});
      const s=i.source||{};
      body+=para(run(srcLine(i)+(s.url?" ":""),{sz:18,color:"555555"})+(s.url?hl(s.url,s.url):""),{style:"Source"});
    });
  });
  body+=para(run("Document de travail établi à partir de la Veille économique Chine du Sud (projet expérimental) ; chaque chiffre renvoie à la source citée."+(m.tauxEURCNY?" Conversions au taux de 1 EUR = "+String(m.tauxEURCNY).replace(".",",")+" CNY (BCE"+(m.tauxDate?", "+fmtD(m.tauxDate):"")+").":""),{sz:18,color:"666666"}),{before:360,style:"Source"});
  const sect='<w:sectPr><w:footerReference w:type="default" r:id="rIdF"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>';
  const NS='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document '+NS+'><w:body>'+body+sect+'</w:body></w:document>';
  const font='<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="SimSun"/>';
  const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles '+NS+'>'+
    '<w:docDefaults><w:rPrDefault><w:rPr>'+font+'<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="fr-FR" w:eastAsia="zh-CN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'+
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'+
    '<w:style w:type="paragraph" w:styleId="Rubrique"><w:name w:val="Rubrique"/><w:basedOn w:val="Normal"/><w:next w:val="BreveTitre"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>'+
    '<w:style w:type="paragraph" w:styleId="BreveTitre"><w:name w:val="Brève – titre"/><w:basedOn w:val="Normal"/><w:next w:val="BreveCorps"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="60"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>'+
    '<w:style w:type="paragraph" w:styleId="BreveCorps"><w:name w:val="Brève – corps"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/><w:jc w:val="both"/></w:pPr></w:style>'+
    '<w:style w:type="paragraph" w:styleId="Source"><w:name w:val="Brève – source"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>'+
    '<w:style w:type="paragraph" w:styleId="Resume"><w:name w:val="Résumé"/><w:basedOn w:val="Normal"/></w:style>'+
    '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>'+
    '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="1F4E99"/><w:u w:val="single"/></w:rPr></w:style>'+
    '</w:styles>';
  const footer='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr '+NS+'><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr>'+
    '<w:r><w:t xml:space="preserve">– </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r><w:r><w:t xml:space="preserve"> –</w:t></w:r></w:p></w:ftr>';
  const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+
    '<Relationship Id="rIdF" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'+
    links.map((u,k)=>'<Relationship Id="rIdL'+(k+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="'+xe(u)+'" TargetMode="External"/>').join('')+'</Relationships>';
  const now=new Date().toISOString().replace(/\.\d+Z$/,"Z");
  const core='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>'+xe(obj)+'</dc:title><dc:creator>Veille économique Chine du Sud</dc:creator><dc:language>fr-FR</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">'+now+'</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">'+now+'</dcterms:modified></cp:coreProperties>';
  const ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
  const root='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>';
  return zipStore([{name:"[Content_Types].xml",data:ct},{name:"_rels/.rels",data:root},{name:"word/document.xml",data:doc},{name:"word/styles.xml",data:styles},{name:"word/footer1.xml",data:footer},{name:"word/_rels/document.xml.rels",data:rels},{name:"docProps/core.xml",data:core}]);
}
window.__vcsDocx=buildDocx;
$("#panier-export").addEventListener("click",async()=>{
  const st=$("#panier-status"); if(!noteItems().length)return;
  const blob=buildDocx(), name="note-veille-chine-sud-"+isoD(new Date())+".docx";
  let dl=null; try{dl=window.claude&&window.claude.use?await window.claude.use("downloads"):null;}catch(e){dl=null;}
  if(dl){try{await dl.save({filename:name,data:blob});st.textContent="Note exportée.";}
    catch(e){const c=e&&e.code;st.textContent=c==="declined"?"Export annulé.":c==="rate_limited"?"Une demande d'enregistrement est déjà ouverte.":"L'export n'est pas disponible dans cette vue.";}
    return;}
  const u=URL.createObjectURL(blob), a=el("a",{href:u,download:name,style:"display:none"}); document.body.append(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(u);a.remove();},1500);
  st.textContent="Note exportée.";
});

/* ---------- Views, about, entrance ---------- */
function setView(v,first){S.view=v;store.set("vcs.view",v);
  $$("nav.tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.view===v?"true":"false"));
  for(const id of VIEWS){const n=$("#view-"+id);n.hidden=id!==v;if(id===v&&!first&&id!=="today"){n.classList.remove("view-in");void n.offsetWidth;n.classList.add("view-in");}}
  if(v==="today") requestAnimationFrame(()=>applyView());
  renderAll(); if(!first) window.scrollTo({top:0,behavior:"auto"});}
$$("nav.tabs button").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
$$("[data-go]").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();setView(a.dataset.go);}));
$$("#groupby button").forEach(b=>b.addEventListener("click",()=>{S.groupBy=b.dataset.g;$$("#groupby button").forEach(x=>x.setAttribute("aria-pressed",x===b?"true":"false"));renderFil();}));
$("#scrollcue").addEventListener("click",()=>$("#cinq-body").scrollIntoView({behavior:reduce?"auto":"smooth"}));
window.addEventListener("scroll",()=>$("#topbar").classList.toggle("scrolled",window.scrollY>40),{passive:true});
let rz; window.addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(()=>{if(S.frame)S.vs=fitView(frameBox(FRAMES[S.frame]));applyView();},120);});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&S.city&&!$("#fiche").open&&!$("#about").open&&S.view==="today")unfocusCity();});
document.addEventListener("keydown",e=>{const f=$("#fiche"),p=$("#panier"),ae=document.activeElement,typing=ae&&/INPUT|TEXTAREA|SELECT/.test(ae.tagName);
  if(e.key==="Escape"){if(!$("#note-bubble").hidden){hideBubble();return;}if(f.open){f.close();e.preventDefault();return;}if(p.open){p.close();e.preventDefault();return;}}
  if(f.open&&!typing&&!$("#about").open&&!(ae&&ae.id==="tl")){if(e.key==="ArrowLeft"){e.preventDefault();navFiche(-1);}else if(e.key==="ArrowRight"){e.preventDefault();navFiche(1);}}});
const about=$("#about");
function openAbout(){if(!about.open)about.showModal();}
$("#btn-about").addEventListener("click",openAbout);
$$("[data-about]").forEach(b=>b.addEventListener("click",openAbout));
$("#btn-enter").addEventListener("click",()=>about.close());
about.addEventListener("close",()=>{store.set("vcs.introSeen","1");play();});
about.addEventListener("cancel",()=>store.set("vcs.introSeen","1"));
let played=false;
function play(){if(played)return;played=true;const app=$("#app");app.classList.remove("hold");if(reduce)return;app.classList.add("play");S.animMarks=true;coastDrawn=false;drawBase();drawMarks();setTimeout(()=>app.classList.remove("play"),3200);}

function renderAll(){
  renderHeader();
  if(S.view==="today"){renderMorning();renderSide();drawMarks();renderCinq();}
  if(S.view==="fil")renderFil();
  if(S.view==="syntheses")renderSynth();
  if(S.view==="sources")renderSources();
  syncNote();
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

const firstVisit=store.get("vcs.introSeen")!=="1";
if(!reduce&&S.view==="today") $("#app").classList.add("hold");
drawBase(); setView(S.view,true);
let tries=0; const gw=setInterval(()=>{tries++; if(window.__chinaGeo||window.__chinaGeoError||tries>40){clearInterval(gw); if(!played&&firstVisit)return; S.animMarks=true; drawBase(); drawMarks();}},150);
if(firstVisit) setTimeout(openAbout,350); else setTimeout(play,150);
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
