import { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { loadBudget, saveBudget, lsSave } from "./api.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const USERS = { emily: { name: "Emily", color: "#8b5cf6" }, louis: { name: "Louis", color: "#3b82f6" } };
const CATS  = { savings: { label: "Savings", color: "#10b981" }, essentials: { label: "Essentials", color: "#3b82f6" }, luxury: { label: "Luxury", color: "#8b5cf6" }, random: { label: "Random", color: "#f59e0b" } };
const CK    = ["savings", "essentials", "luxury", "random"];
const SK    = ["shared", "emily", "louis"];
const SL    = { shared: "Shared", emily: "Emily", louis: "Louis" };

// ── Utilities ─────────────────────────────────────────────────────────────────

const uid    = () => Math.random().toString(36).slice(2, 9);
const clone  = x  => JSON.parse(JSON.stringify(x));
const fmt      = n  => "£" + Math.abs(+n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const pct    = (n, t) => t > 0 ? Math.round(n / t * 100) : 0;
const mLabel = k  => { const [y, m] = k.split("-"); return new Date(+y, +m - 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" }); };
const mShort = k  => { const [y, m] = k.split("-"); return new Date(+y, +m - 1).toLocaleDateString("en-GB", { month: "short" }); };
const nextMK = k  => { const [y, m] = k.split("-").map(Number); const d = new Date(y, m); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

// ── Data helpers ──────────────────────────────────────────────────────────────

const catSum = c => c.items.reduce((s, i) => s + (+i.amount || 0), 0);
const secSum = s => CK.reduce((a, k) => a + catSum(s[k]), 0);
const mSpend = m => SK.reduce((a, k) => a + secSum(m.sections[k]), 0);
const mInc   = m => SK.reduce((a, k) => a + (+m.income[k] || 0), 0);
const mLeft  = m => mInc(m) - mSpend(m);
const mSav   = m => SK.reduce((a, k) => a + catSum(m.sections[k].savings), 0);

// ── End-date helpers ──────────────────────────────────────────────────────────

const edSt  = d => { if (!d) return null; const e = new Date(d), n = new Date(), diff = (e.getFullYear()-n.getFullYear())*12+(e.getMonth()-n.getMonth()); return diff<0?"exp":diff<=1?"soon":diff<=3?"end":"ok"; };
const edCol = s => s==="exp"?"var(--red)":(s==="soon"||s==="end")?"var(--amber)":"var(--green)";
const edBg  = s => s==="exp"?"var(--red-bg)":(s==="soon"||s==="end")?"var(--amber-bg)":"transparent";
const edBd  = s => s==="exp"?"var(--red)":(s==="soon"||s==="end")?"var(--amber-bd)":"var(--border)";
const edLbl = s => s==="exp"?"Expired":s==="soon"?"Ending soon":s==="end"?"Ending":"";
const fmtED = d => d ? new Date(d).toLocaleDateString("en-GB",{month:"short",year:"numeric"}) : null;

// ── Default data ──────────────────────────────────────────────────────────────

const mk = (name, amount, isOneOff=false, addedBy="emily", endDate=null) =>
  ({ id: uid(), name, amount, isOneOff, addedBy, endDate });

const blankMonth = () => ({
  income: { shared: 5000, emily: 800, louis: 800 },
  sections: {
    shared: {
      savings:    { items: [mk("Joint savings pot", 400)] },
      essentials: { items: [mk("Mortgage", 1200), mk("Utilities", 180), mk("Groceries", 350), mk("Internet", 40)] },
      luxury:     { items: [mk("Date night", 80, false, "louis")] },
      random:     { items: [] },
    },
    emily: {
      savings:    { items: [mk("Personal savings", 50)] },
      essentials: { items: [mk("Train pass", 120)] },
      luxury:     { items: [mk("Gym", 45), mk("Coffee", 40)] },
      random:     { items: [mk("Sarah's birthday", 50, true)] },
    },
    louis: {
      savings:    { items: [] },
      essentials: { items: [mk("Phone bill", 35, false, "louis")] },
      luxury:     { items: [mk("Streaming", 25, false, "louis"), mk("Xbox Game Pass", 15, false, "louis")] },
      random:     { items: [] },
    },
  },
});

const carryFwd = (src, nk) => {
  const next = clone(src);
  const [y, m] = nk.split("-").map(Number);
  const start = new Date(y, m-1, 1);
  SK.forEach(s => CK.forEach(c => {
    next.sections[s][c].items = next.sections[s][c].items.filter(
      i => !i.isOneOff && (!i.endDate || new Date(i.endDate) >= start)
    );
  }));
  return next;
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, val, sub, color, big }) {
  return (
    <div style={{ background:"var(--surface)", borderRadius:8, padding:"14px 16px" }}>
      <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:500 }}>{label}</div>
      <div style={{ fontSize:big?24:20, fontWeight:500, fontFamily:"'JetBrains Mono',monospace", color:color||"var(--text)" }}>{val}</div>
      {sub && <div style={{ fontSize:11, color:"var(--text-faint)", marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function ItemRow({ item, sec, cat, updFn, delFn }) {
  const [showD, setShowD] = useState(!!item.endDate);
  const st = edSt(item.endDate);
  return (
    <div className="irow">
      <div style={{ display:"flex", alignItems:"center", gap:6, width:"100%" }}>
        <div title={`Added by ${USERS[item.addedBy]?.name||item.addedBy}`} style={{ width:20, height:20, borderRadius:"50%", background:USERS[item.addedBy]?.color||"#888", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"white", fontWeight:500, flexShrink:0 }}>
          {(USERS[item.addedBy]?.name||"?")[0].toUpperCase()}
        </div>
        <input type="text" value={item.name} onChange={e=>updFn(sec,cat,item.id,"name",e.target.value)} placeholder="Item name" className="bn" style={{ flex:1, minWidth:0 }} />
        <button onClick={()=>updFn(sec,cat,item.id,"isOneOff",!item.isOneOff)} title="One-off" style={{ fontSize:12, background:item.isOneOff?"var(--amber-bg)":"transparent", border:"0.5px solid "+(item.isOneOff?"var(--amber-bd)":"var(--border)"), borderRadius:4, padding:"2px 5px", cursor:"pointer", color:item.isOneOff?"var(--amber)":"var(--text-faint)", flexShrink:0 }}>⚡</button>
        <button onClick={()=>{ setShowD(v=>!v); if(showD&&item.endDate) updFn(sec,cat,item.id,"endDate",null); }} title="End date" style={{ fontSize:11, background:item.endDate?edBg(st):"transparent", border:"0.5px solid "+(item.endDate?edBd(st):"var(--border)"), borderRadius:4, padding:"2px 6px", cursor:"pointer", color:item.endDate?edCol(st):"var(--text-faint)", flexShrink:0 }}>📅</button>
        <div style={{ display:"flex", alignItems:"center", gap:2, flexShrink:0 }}>
          <span style={{ fontSize:12, color:"var(--text-faint)" }}>£</span>
          <input type="number" value={item.amount} onChange={e=>updFn(sec,cat,item.id,"amount",e.target.value)} className="bi" style={{ width:76 }} />
        </div>
        <button onClick={()=>delFn(sec,cat,item.id)} className="bb bbd" style={{ padding:"2px 6px", fontSize:16, border:"none", flexShrink:0 }}>×</button>
      </div>
      {(showD||item.endDate)&&(
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:7, paddingLeft:26 }}>
          <span style={{ fontSize:11, color:"var(--text-muted)" }}>Ends:</span>
          <input type="month" value={item.endDate?item.endDate.slice(0,7):""} onChange={e=>updFn(sec,cat,item.id,"endDate",e.target.value?e.target.value+"-01":null)} className="bd" />
          {st&&st!=="ok"&&<span style={{ fontSize:11, color:edCol(st), fontWeight:500 }}>{edLbl(st)}</span>}
          {item.endDate&&<button onClick={()=>{ updFn(sec,cat,item.id,"endDate",null); setShowD(false); }} style={{ fontSize:11, color:"var(--text-faint)", background:"transparent", border:"none", cursor:"pointer", padding:0 }}>Clear</button>}
        </div>
      )}
    </div>
  );
}

function CatCard({ cat, items, sec, updFn, addFn, delFn, baseTot }) {
  const tot=catSum({items}); const diff=baseTot!==undefined?tot-baseTot:null;
  return (
    <div style={{ background:"var(--surface)", borderRadius:12, padding:14, border:`0.5px solid ${CATS[cat].color}33` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <span style={{ fontSize:13, fontWeight:500, color:CATS[cat].color }}>{CATS[cat].label}</span>
        <div>
          <span style={{ fontSize:14, fontFamily:"'JetBrains Mono',monospace", fontWeight:500 }}>{fmt(tot)}</span>
          {diff!==null&&diff!==0&&<span style={{ fontSize:11, marginLeft:6, color:diff>0?"var(--red)":"var(--green)" }}>{diff>0?"+":""}{fmt(diff)}</span>}
        </div>
      </div>
      {items.map(item=><ItemRow key={item.id} item={item} sec={sec} cat={cat} updFn={updFn} delFn={delFn} />)}
      <button onClick={()=>addFn(sec,cat)} className="bb" style={{ fontSize:12, width:"100%", justifyContent:"center", marginTop:6 }}>+ Add item</button>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({ md, months, data, savings, setSavCur }) {
  const [metric, setMetric] = useState("categories");
  const income=mInc(md),total=mSpend(md),left=mLeft(md),savAmt=mSav(md);
  const savPct=Math.min(100,pct(savings.current,savings.target));
  const pieData=CK.map(k=>({name:CATS[k].label,color:CATS[k].color,value:SK.reduce((a,s)=>a+catSum(md.sections[s][k]),0)})).filter(d=>d.value>0);
  const trendData=months.map(mk2=>{ const m=data.months[mk2]; return { month:mShort(mk2), Savings:Math.round(SK.reduce((a,s)=>a+catSum(m.sections[s].savings),0)), Essentials:Math.round(SK.reduce((a,s)=>a+catSum(m.sections[s].essentials),0)), Luxury:Math.round(SK.reduce((a,s)=>a+catSum(m.sections[s].luxury),0)), Random:Math.round(SK.reduce((a,s)=>a+catSum(m.sections[s].random),0)), Leftover:Math.round(mLeft(m)), "Savings %":pct(mSav(m),mInc(m)) }; });
  const lines={ categories:[{k:"Savings",c:"#10b981"},{k:"Essentials",c:"#3b82f6"},{k:"Luxury",c:"#8b5cf6"},{k:"Random",c:"#f59e0b"}], leftover:[{k:"Leftover",c:"#10b981"}], savings:[{k:"Savings %",c:"#10b981"}] };
  const alerts=SK.flatMap(s=>CK.flatMap(c=>md.sections[s][c].items.filter(i=>i.endDate&&["exp","soon","end"].includes(edSt(i.endDate))).map(i=>({...i,s,c}))));
  const DTip=({active,payload})=>{ if(!active||!payload?.length) return null; const d=payload[0].payload; return <div style={{ background:"var(--bg)", border:"0.5px solid var(--border-mid)", borderRadius:8, padding:"8px 12px", fontSize:12 }}><div style={{ color:d.color, fontWeight:500, marginBottom:2 }}>{d.name}</div><div>{fmt(d.value)} · {pct(d.value,total)}%</div></div>; };
  const CTip=({active,payload,label})=>{ if(!active||!payload?.length) return null; return <div style={{ background:"var(--bg)", border:"0.5px solid var(--border-mid)", borderRadius:8, padding:"8px 12px", fontSize:12 }}><div style={{ fontWeight:500, marginBottom:6 }}>{label}</div>{payload.map(p=><div key={p.name} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:2 }}><div style={{ width:8, height:8, borderRadius:2, background:p.color }} /><span style={{ color:"var(--text-muted)" }}>{p.name}:</span><span style={{ fontFamily:"'JetBrains Mono',monospace" }}>{metric==="savings"?`${p.value}%`:fmt(p.value)}</span></div>)}</div>; };

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        <StatCard label="Combined income" val={fmt(income)} />
        <StatCard label="Total spend"     val={fmt(total)}  sub={`${pct(total,income)}% of income`} />
        <StatCard label="Monthly savings" val={fmt(savAmt)} color="var(--green)" />
        <StatCard label="Left over"       val={fmt(left)}   color={left<0?"var(--red)":"var(--green)"} big />
      </div>

      <div style={{ background:"var(--surface)", borderRadius:8, padding:"16px 20px", marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div><div style={{ fontSize:13, fontWeight:500, marginBottom:2 }}>Joint savings pot</div><div style={{ fontSize:11, color:"var(--text-muted)" }}>Target: £10,000</div></div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:12, color:"var(--text-muted)" }}>Saved so far: £</span>
            <input type="number" value={savings.current} onChange={e=>setSavCur(e.target.value)} className="bi" style={{ width:90 }} />
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:500, color:"var(--green)", fontSize:16 }}>{savPct}%</span>
          </div>
        </div>
        <div style={{ height:14, background:"var(--border)", borderRadius:7, overflow:"hidden" }}><div style={{ width:`${savPct}%`, height:"100%", background:"var(--green)", borderRadius:7, transition:"width .5s ease" }} /></div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:11, color:"var(--text-muted)" }}><span>{fmt(savings.current)} saved</span><span>{fmt(savings.target-savings.current)} to go</span></div>
      </div>

      {alerts.length>0&&<div style={{ background:"var(--amber-bg)", border:"0.5px solid var(--amber-bd)", borderRadius:8, padding:"12px 16px", marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:500, color:"var(--amber)", marginBottom:8 }}>Bills ending soon or expired</div>
        {alerts.map(item=><div key={item.id} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"var(--text-muted)", marginBottom:3 }}><span><span style={{ color:CATS[item.c].color }}>{CATS[item.c].label}</span> · {item.name}</span><span style={{ color:edCol(edSt(item.endDate)), fontWeight:500 }}>{edSt(item.endDate)==="exp"?"Expired":`Ends ${fmtED(item.endDate)}`}</span></div>)}
      </div>}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
        <div style={{ background:"var(--surface)", borderRadius:8, padding:"16px 20px" }}>
          <div style={{ fontSize:11, fontWeight:500, color:"var(--text-muted)", marginBottom:12, textTransform:"uppercase", letterSpacing:"0.06em" }}>Spend by category</div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <ResponsiveContainer width={150} height={150}><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">{pieData.map((d,i)=><Cell key={i} fill={d.color} />)}</Pie><Tooltip content={<DTip />} /></PieChart></ResponsiveContainer>
            <div style={{ flex:1 }}>{CK.map(k=>{ const val=SK.reduce((a,s)=>a+catSum(md.sections[s][k]),0); const p=pct(val,total); return <div key={k} style={{ marginBottom:10 }}><div style={{ display:"flex", justifyContent:"space-between", marginBottom:3, fontSize:12 }}><span style={{ color:CATS[k].color, fontWeight:500 }}>{CATS[k].label}</span><span style={{ fontFamily:"'JetBrains Mono',monospace" }}>{p}%</span></div><div style={{ height:5, background:"var(--border)", borderRadius:3, overflow:"hidden" }}><div style={{ width:`${p}%`, height:"100%", background:CATS[k].color, borderRadius:3 }} /></div><div style={{ fontSize:11, color:"var(--text-faint)", marginTop:2 }}>{fmt(val)}</div></div>; })}</div>
          </div>
        </div>
        <div style={{ background:"var(--surface)", borderRadius:8, padding:"16px 20px", overflowY:"auto", maxHeight:280 }}>
          <div style={{ fontSize:11, fontWeight:500, color:"var(--text-muted)", marginBottom:12, textTransform:"uppercase", letterSpacing:"0.06em" }}>All items breakdown</div>
          {CK.map(k=>{ const items=SK.flatMap(s=>md.sections[s][k].items.map(i=>({...i,s}))); if(!items.length) return null; const ct=items.reduce((a,i)=>a+(+i.amount||0),0); return <div key={k} style={{ marginBottom:14 }}><div style={{ fontSize:11, color:CATS[k].color, fontWeight:500, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>{CATS[k].label}</div>{items.map(item=><div key={item.id} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}><div style={{ width:56, height:4, background:"var(--border)", borderRadius:2, overflow:"hidden", flexShrink:0 }}><div style={{ width:`${pct(+item.amount,ct)}%`, height:"100%", background:CATS[k].color, opacity:.7, borderRadius:2 }} /></div><span style={{ fontSize:12, color:"var(--text-muted)", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name||"Unnamed"}{item.isOneOff?" ⚡":""}{item.endDate?` · ${fmtED(item.endDate)}`:""}</span><div style={{ width:16, height:16, borderRadius:"50%", background:USERS[item.addedBy]?.color||"#888", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:"white", flexShrink:0 }}>{(USERS[item.addedBy]?.name||"?")[0].toUpperCase()}</div><span style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", minWidth:58, textAlign:"right", flexShrink:0 }}>{fmt(item.amount)}</span></div>)}</div>; })}
        </div>
      </div>

      <div style={{ background:"var(--surface)", borderRadius:8, padding:"16px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
          <span style={{ fontSize:11, fontWeight:500, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.06em", marginRight:4 }}>Trends</span>
          {[{k:"categories",l:"Category spend"},{k:"leftover",l:"Left over"},{k:"savings",l:"Savings rate"}].map(o=><button key={o.k} className={`tb${metric===o.k?" on":""}`} onClick={()=>setMetric(o.k)} style={{ fontSize:12, padding:"4px 10px" }}>{o.l}</button>)}
        </div>
        {months.length<2?<div style={{ textAlign:"center", padding:"32px 0", color:"var(--text-faint)", fontSize:13 }}>Add more months in the Budget tab to see trends</div>:(
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} margin={{ top:5, right:10, bottom:5, left:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize:11, fill:"var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:11, fill:"var(--text-muted)", fontFamily:"'JetBrains Mono',monospace" }} axisLine={false} tickLine={false} tickFormatter={v=>metric==="savings"?`${v}%`:`£${v}`} width={50} />
              <Tooltip content={<CTip />} />
              {lines[metric].map(l=><Line key={l.k} type="monotone" dataKey={l.k} stroke={l.c} strokeWidth={2} dot={{ r:3, fill:l.c }} />)}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── Budget ────────────────────────────────────────────────────────────────────

function Budget({ md, months, setInc, updItem, addItem, delItem, addMonth }) {
  const [sec,setSec]=useState("shared");
  const sect=md.sections[sec],si=md.income[sec],st=secSum(sect),nk=nextMK(months[months.length-1]);
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        {SK.map(s=><button key={s} className={`tb${sec===s?" on":""}`} onClick={()=>setSec(s)}>{s==="shared"?"Shared":USERS[s]?.name||s}</button>)}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:12, color:"var(--text-muted)" }}>Section income: £</span>
          <input type="number" value={si} onChange={e=>setInc(sec,e.target.value)} className="bi" style={{ width:90 }} />
          <span style={{ fontSize:12, color:"var(--text-muted)" }}>Spend: <span style={{ fontFamily:"'JetBrains Mono',monospace", color:st>si?"var(--red)":"var(--text)" }}>{fmt(st)}</span></span>
        </div>
      </div>
      <div style={{ fontSize:11, color:"var(--text-faint)", marginBottom:14 }}>⚡ one-offs and 📅 items past their end date will not carry forward to next month.</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:24 }}>
        {CK.map(cat=><CatCard key={cat} cat={cat} items={sect[cat].items} sec={sec} updFn={updItem} addFn={addItem} delFn={delItem} />)}
      </div>
      <div style={{ borderTop:"0.5px solid var(--border)", paddingTop:16, display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={addMonth} className="bb bbp">+ Add {mLabel(nk)}</button>
        <span style={{ fontSize:12, color:"var(--text-faint)" }}>Copies from {mLabel(months[months.length-1])}, dropping one-offs and expired bills</span>
      </div>
    </div>
  );
}

// ── Scenarios ─────────────────────────────────────────────────────────────────

function Scenarios({ data, month, months, user, scenId, setScenId, createScen, updSI, addSI, delSI, updSInc, commitScen, delScen, renScen }) {
  const [creating,setCreating]=useState(false),[newName,setNewName]=useState(""),[newBase,setNewBase]=useState(month),[sec,setSec]=useState("shared"),[view,setView]=useState("edit");
  const scens=Object.values(data.scenarios),cs=scenId?data.scenarios[scenId]:null,bm=cs?data.months[cs.baseKey]:null;
  const doCreate=()=>{ if(!newName.trim()) return; createScen(newName.trim(),newBase); setCreating(false); setNewName(""); };
  const rows=cs&&bm?SK.flatMap(s=>CK.map(c=>{ const base=catSum(bm.sections[s][c]); const scen=catSum(cs.overrides.sections[s][c]); return {s,c,base,scen,diff:scen-base}; })).filter(r=>r.base>0||r.scen>0):[];
  const tBase=rows.reduce((a,r)=>a+r.base,0),tScen=rows.reduce((a,r)=>a+r.scen,0);
  return (
    <div style={{ display:"grid", gridTemplateColumns:"220px 1fr", gap:20 }}>
      <div>
        <div style={{ fontSize:11, fontWeight:500, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:10 }}>Saved scenarios</div>
        {scens.length===0&&!creating&&<div style={{ fontSize:13, color:"var(--text-faint)", marginBottom:10 }}>No scenarios yet</div>}
        {scens.map(s=><div key={s.id} onClick={()=>setScenId(s.id)} style={{ padding:"10px 12px", borderRadius:8, marginBottom:6, cursor:"pointer", background:scenId===s.id?"var(--blue-bg)":"var(--surface)", border:`0.5px solid ${scenId===s.id?"var(--blue-bd)":"var(--border)"}` }}><div style={{ fontSize:13, fontWeight:500, color:scenId===s.id?"var(--blue)":"var(--text)", marginBottom:2 }}>{s.name}</div><div style={{ fontSize:11, color:"var(--text-faint)" }}>vs {mLabel(s.baseKey)}</div><div style={{ fontSize:11, color:"var(--text-faint)", display:"flex", alignItems:"center", gap:4, marginTop:2 }}><div style={{ width:12, height:12, borderRadius:"50%", background:USERS[s.createdBy]?.color||"#888", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"white" }}>{(USERS[s.createdBy]?.name||"?")[0].toUpperCase()}</div>{USERS[s.createdBy]?.name}</div></div>)}
        {creating?(<div style={{ background:"var(--surface)", borderRadius:8, padding:12, border:"0.5px solid var(--border)", marginTop:8 }}>
          <div style={{ fontSize:12, color:"var(--text-muted)", marginBottom:5 }}>Scenario name</div>
          <input type="text" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. New car finance" className="bn" style={{ marginBottom:10 }} autoFocus onKeyDown={e=>e.key==="Enter"&&doCreate()} />
          <div style={{ fontSize:12, color:"var(--text-muted)", marginBottom:5 }}>Based on</div>
          <select value={newBase} onChange={e=>setNewBase(e.target.value)} style={{ marginBottom:10, width:"100%" }}>{months.map(m=><option key={m} value={m}>{mLabel(m)}</option>)}</select>
          <div style={{ display:"flex", gap:6 }}><button onClick={doCreate} className="bb bbp" style={{ fontSize:12, flex:1, justifyContent:"center" }}>Create</button><button onClick={()=>{ setCreating(false); setNewName(""); }} className="bb" style={{ fontSize:12 }}>Cancel</button></div>
        </div>):<button onClick={()=>setCreating(true)} className="bb" style={{ width:"100%", justifyContent:"center", fontSize:13, marginTop:8 }}>+ New scenario</button>}
      </div>
      {!cs?<div style={{ display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-faint)", fontSize:13 }}>Select or create a scenario to get started</div>:(
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <input type="text" value={cs.name} onChange={e=>renScen(scenId,e.target.value)} className="bn" style={{ fontSize:17, fontWeight:500, flex:1 }} />
            <span style={{ fontSize:12, color:"var(--text-faint)", whiteSpace:"nowrap" }}>vs {mLabel(cs.baseKey)}</span>
            <button onClick={commitScen} className="bb bbp" style={{ fontSize:12, whiteSpace:"nowrap" }}>✓ Commit as next month ↗</button>
            <button onClick={()=>delScen(scenId)} className="bb bbd" style={{ fontSize:13 }}>🗑</button>
          </div>
          <div style={{ display:"flex", gap:6, marginBottom:14 }}>{["edit","compare"].map(v=><button key={v} className={`tb${view===v?" on":""}`} onClick={()=>setView(v)} style={{ textTransform:"capitalize" }}>{v}</button>)}</div>
          {view==="edit"&&<><div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:14 }}>{SK.map(s=><button key={s} className={`tb${sec===s?" on":""}`} onClick={()=>setSec(s)}>{s==="shared"?"Shared":USERS[s]?.name||s}</button>)}<div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6 }}><span style={{ fontSize:12, color:"var(--text-muted)" }}>Income: £</span><input type="number" value={cs.overrides.income[sec]} onChange={e=>updSInc(sec,e.target.value)} className="bi" style={{ width:90 }} /></div></div><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>{CK.map(cat=><CatCard key={cat} cat={cat} items={cs.overrides.sections[sec][cat].items} sec={sec} updFn={updSI} addFn={addSI} delFn={delSI} baseTot={catSum(bm.sections[sec][cat])} />)}</div></>}
          {view==="compare"&&<div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}><StatCard label="Base total spend" val={fmt(tBase)} /><StatCard label="Scenario total" val={fmt(tScen)} /><StatCard label="Difference" val={`${tScen-tBase>=0?"+":""}${fmt(tScen-tBase)}`} color={tScen>tBase?"var(--red)":"var(--green)"} /></div>
            <div style={{ background:"var(--surface)", borderRadius:8, overflow:"hidden" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}><thead><tr style={{ borderBottom:"0.5px solid var(--border)" }}>{["Section · Category","Base","Scenario","Change"].map((h,i)=><th key={h} style={{ padding:"10px 14px", textAlign:i===0?"left":"right", fontWeight:500, fontSize:11, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i} style={{ borderBottom:"0.5px solid var(--border)" }}><td style={{ padding:"8px 14px" }}><span style={{ color:CATS[r.c].color, fontWeight:500, marginRight:4 }}>●</span><span style={{ color:"var(--text-muted)", marginRight:4 }}>{SL[r.s]}</span>{CATS[r.c].label}</td><td style={{ padding:"8px 14px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace" }}>{fmt(r.base)}</td><td style={{ padding:"8px 14px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace" }}>{fmt(r.scen)}</td><td style={{ padding:"8px 14px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:r.diff>0?"var(--red)":r.diff<0?"var(--green)":"var(--text-faint)" }}>{r.diff===0?"—":`${r.diff>0?"+":""}${fmt(r.diff)}`}</td></tr>)}<tr style={{ borderTop:"0.5px solid var(--border-mid)" }}><td style={{ padding:"10px 14px", fontWeight:500 }}>Total</td><td style={{ padding:"10px 14px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", fontWeight:500 }}>{fmt(tBase)}</td><td style={{ padding:"10px 14px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", fontWeight:500 }}>{fmt(tScen)}</td><td style={{ padding:"10px 14px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", fontWeight:500, color:tScen>tBase?"var(--red)":"var(--green)" }}>{tScen===tBase?"—":`${tScen>tBase?"+":""}${fmt(tScen-tBase)}`}</td></tr></tbody></table></div>
          </div>}
        </div>
      )}
    </div>
  );
}

// ── Sync indicator ────────────────────────────────────────────────────────────

function SyncDot({ status }) {
  const map = { idle:{c:"var(--green)",l:"Synced",p:false}, saving:{c:"var(--amber)",l:"Saving…",p:true}, saved:{c:"var(--green)",l:"Saved",p:false}, error:{c:"var(--red)",l:"Sync error",p:false} };
  const { c, l, p } = map[status] || map.idle;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"var(--text-faint)" }}>
      <div className={p?"pulse":""} style={{ width:6, height:6, borderRadius:"50%", background:c }} />
      {l}
    </div>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────

export default function App() {
  const [tab,    setTab]    = useState("dashboard");
  const [user,   setUser]   = useState("emily");
  const [month,  setMonth]  = useState("2026-05");
  const [scenId, setScenId] = useState(null);
  const [data,   setData]   = useState(null);
  const [ready,  setReady]  = useState(false);
  const [syncSt, setSyncSt] = useState("idle");

  const saveTimer = useRef(null);
  const isSaving  = useRef(false);
  const dataRef   = useRef(null);
  useEffect(() => { dataRef.current = data; }, [data]);

  // ── Initial load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const remote = await loadBudget();
      if (remote && Object.keys(remote).length > 0) {
        setData(remote);
        setMonth(Object.keys(remote.months).sort().pop());
        if (remote.currentUser) setUser(remote.currentUser);
      } else {
        const init = { currentUser:"emily", savings:{ target:10000, current:0 }, months:{ "2026-05":blankMonth() }, scenarios:{} };
        setData(init);
        saveBudget(init).catch(() => {});
      }
      setReady(true);
    })();
  }, []);

  // ── Polling for changes (every 30s, only when tab is visible) ────────────────
  useEffect(() => {
    if (!ready) return;
    const poll = async () => {
      if (document.visibilityState !== "visible" || isSaving.current) return;
      try {
        const remote = await loadBudget();
        if (remote && JSON.stringify(remote) !== JSON.stringify(dataRef.current)) {
          setData(remote);
        }
      } catch {}
    };
    const id = setInterval(poll, 30000);
    document.addEventListener("visibilitychange", poll);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", poll); };
  }, [ready]);

  // ── Save (debounced 1s) ───────────────────────────────────────────────────────
  const save = (d) => {
    setData(d);
    setSyncSt("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      isSaving.current = true;
      try {
        await saveBudget(d);
        setSyncSt("saved");
        setTimeout(() => setSyncSt("idle"), 2500);
      } catch {
        setSyncSt("error");
        lsSave(d); // already saved locally inside saveBudget
      } finally {
        setTimeout(() => { isSaving.current = false; }, 2000);
      }
    }, 1000);
  };

  const switchUser = u => { const n=clone(data); n.currentUser=u; setUser(u); save(n); };

  if (!ready||!data) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh", color:"var(--text-muted)", fontSize:14, gap:10 }}>
      <div className="pulse" style={{ width:8, height:8, borderRadius:"50%", background:"var(--blue)" }} /> Loading your budget…
    </div>
  );

  const md=data.months[month], months=Object.keys(data.months).sort();

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const mutM=fn=>{ const n=clone(data); fn(n.months[month]); save(n); };
  const setInc  =(s,v)         =>mutM(m=>{ m.income[s]=+v||0; });
  const updItem =(s,c,id,f,v)  =>mutM(m=>{ const it=m.sections[s][c].items.find(i=>i.id===id); if(it) it[f]=f==="amount"?(+v||0):v; });
  const addItem =(s,c)         =>mutM(m=>m.sections[s][c].items.push({ id:uid(), name:"", amount:0, isOneOff:false, addedBy:user, endDate:null }));
  const delItem =(s,c,id)      =>mutM(m=>{ m.sections[s][c].items=m.sections[s][c].items.filter(i=>i.id!==id); });
  const addMonth=()=>{ const nk=nextMK(months[months.length-1]); if(data.months[nk]) return; const n=clone(data); n.months[nk]=carryFwd(n.months[months[months.length-1]],nk); save(n); setMonth(nk); };
  const setSavCur=v=>{ const n=clone(data); n.savings.current=+v||0; save(n); };

  const mutS=fn=>{ if(!scenId) return; const n=clone(data); fn(n.scenarios[scenId]); save(n); };
  const createScen=(name,bk)=>{ const n=clone(data); const id=uid(); n.scenarios[id]={ id, name, baseKey:bk, overrides:clone(n.months[bk]), createdBy:user }; save(n); setScenId(id); };
  const updSI  =(s,c,id,f,v)=>mutS(sc=>{ const it=sc.overrides.sections[s][c].items.find(i=>i.id===id); if(it) it[f]=f==="amount"?(+v||0):v; });
  const addSI  =(s,c)       =>mutS(sc=>sc.overrides.sections[s][c].items.push({ id:uid(), name:"New item", amount:0, isOneOff:false, addedBy:user, endDate:null }));
  const delSI  =(s,c,id)    =>mutS(sc=>{ sc.overrides.sections[s][c].items=sc.overrides.sections[s][c].items.filter(i=>i.id!==id); });
  const updSInc=(s,v)       =>mutS(sc=>{ sc.overrides.income[s]=+v||0; });
  const renScen=(id,name)   =>{ const n=clone(data); if(n.scenarios[id]) n.scenarios[id].name=name; save(n); };
  const commitScen=()=>{ if(!scenId) return; const sc=data.scenarios[scenId]; const nk=nextMK(months[months.length-1]); const n=clone(data); n.months[nk]=clone(sc.overrides); save(n); setMonth(nk); setTab("budget"); setScenId(null); };
  const delScen=id=>{ const n=clone(data); delete n.scenarios[id]; save(n); if(scenId===id) setScenId(null); };

  return (
    <div>
      <div style={{ borderBottom:"0.5px solid var(--border)", paddingBottom:12, marginBottom:28 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          <span style={{ fontWeight:600, fontSize:15, marginRight:8 }}>💷 Emily &amp; Louis</span>
          {["dashboard","budget","scenarios"].map(t=><button key={t} className={`tb${tab===t?" on":""}`} onClick={()=>setTab(t)} style={{ textTransform:"capitalize" }}>{t}</button>)}
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:12 }}>
            <SyncDot status={syncSt} />
            <div style={{ display:"flex", borderRadius:8, border:"0.5px solid var(--border-mid)", overflow:"hidden" }}>
              {Object.entries(USERS).map(([k,u])=><button key={k} onClick={()=>switchUser(k)} style={{ padding:"5px 14px", fontSize:13, fontFamily:"'Inter',sans-serif", cursor:"pointer", border:"none", background:user===k?u.color:"transparent", color:user===k?"white":"var(--text-muted)", transition:"all .15s" }}>{u.name}</button>)}
            </div>
            <select value={month} onChange={e=>setMonth(e.target.value)}>{months.map(m=><option key={m} value={m}>{mLabel(m)}</option>)}</select>
          </div>
        </div>
      </div>
      {tab==="dashboard"&&<Dashboard md={md} months={months} data={data} savings={data.savings} setSavCur={setSavCur} />}
      {tab==="budget"   &&<Budget    md={md} months={months} setInc={setInc} updItem={updItem} addItem={addItem} delItem={delItem} addMonth={addMonth} />}
      {tab==="scenarios"&&<Scenarios data={data} month={month} months={months} user={user} scenId={scenId} setScenId={setScenId} createScen={createScen} updSI={updSI} addSI={addSI} delSI={delSI} updSInc={updSInc} commitScen={commitScen} delScen={delScen} renScen={renScen} />}
    </div>
  );
}
