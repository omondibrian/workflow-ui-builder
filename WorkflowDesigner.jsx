import { useState, useRef, useCallback } from "react";

const NW = 172, NH = 58;
const TYPES = {
  trigger:  { color:"#10b981", label:"Trigger",  outs:1 },
  task:     { color:"#3b82f6", label:"Task",     outs:1 },
  decision: { color:"#f59e0b", label:"Decision", outs:2 },
  parallel: { color:"#a855f7", label:"Parallel", outs:1 },
  end:      { color:"#ef4444", label:"End",      outs:0 },
};
const ICONS = { trigger:"▶", task:"◉", decision:"◆", parallel:"⊞", end:"■" };
const DESCS = { trigger:"start event", task:"action step", decision:"if/else", parallel:"concurrent", end:"completion" };

const DEMO_N = [
  { id:"n1", type:"trigger",  label:"Invoice Created",  x:60,  y:210, config:{ triggerType:"API Call" } },
  { id:"n2", type:"task",     label:"Validate Invoice", x:295, y:210, config:{ actionType:"Call API", endpoint:"/api/validate" } },
  { id:"n3", type:"decision", label:"Amount > $10k?",   x:530, y:210, config:{ condition:"amount > 10000" } },
  { id:"n4", type:"task",     label:"Manager Approval", x:765, y:105, config:{ actionType:"Send Email", endpoint:"manager@corp.com" } },
  { id:"n5", type:"task",     label:"Auto Approve",     x:765, y:325, config:{ actionType:"Create Record", endpoint:"/api/approve" } },
  { id:"n6", type:"task",     label:"Post to Ledger",   x:1000,y:210, config:{ actionType:"Call API", endpoint:"/api/ledger" } },
  { id:"n7", type:"end",      label:"Complete",         x:1220,y:210, config:{} },
];
const DEMO_C = [
  { id:"c1", from:"n1", to:"n2", port:0, label:"" },
  { id:"c2", from:"n2", to:"n3", port:0, label:"" },
  { id:"c3", from:"n3", to:"n4", port:0, label:"Yes" },
  { id:"c4", from:"n3", to:"n5", port:1, label:"No"  },
  { id:"c5", from:"n4", to:"n6", port:0, label:"" },
  { id:"c6", from:"n5", to:"n6", port:0, label:"" },
  { id:"c7", from:"n6", to:"n7", port:0, label:"" },
];
const INIT_CTX = {
  invoice_id:"INV-2024-0847", amount:14500, currency:"USD",
  vendor:"Acme Corp", submitted_by:"alice@corp.com",
  timestamp:"2024-03-13T09:22:00Z",
};

const uid  = () => Math.random().toString(36).slice(2,7);
const ts   = () => new Date().toISOString().slice(11,23);
const BTN  = { background:"transparent", border:"1px solid #30363d", color:"#8b949e", padding:"4px 11px", borderRadius:4, cursor:"pointer", fontFamily:"monospace", fontSize:11 };
const INP  = { width:"100%", background:"#0d1117", border:"1px solid #30363d", color:"#e6edf3", padding:"4px 8px", borderRadius:4, fontSize:11, fontFamily:"monospace", boxSizing:"border-box", outline:"none" };
const SEL  = { ...INP, padding:"4px 6px" };
const STAT = { pending:"#484f58", running:"#22d3ee", done:"#10b981", error:"#f85149", paused:"#f59e0b" };

function outP(n,p){ const o=TYPES[n.type].outs; return {x:n.x+NW,y:o>1?n.y+(p===0?NH*0.3:NH*0.7):n.y+NH/2}; }
function inP(n){ return {x:n.x,y:n.y+NH/2}; }
function bez(a,b){ const c=Math.max(Math.abs(b.x-a.x)*0.45,52); return `M${a.x},${a.y} C${a.x+c},${a.y} ${b.x-c},${b.y} ${b.x},${b.y}`; }

export default function App() {
  const [nodes,    setNodes]    = useState(DEMO_N);
  const [conns,    setConns]    = useState(DEMO_C);
  const [sel,      setSel]      = useState(null);
  const [drag,     setDrag]     = useState(null);
  const [conn,     setConn]     = useState(null);
  const [pan,      setPan]      = useState(null);
  const [off,      setOff]      = useState({x:20,y:20});
  const [mxy,      setMxy]      = useState({x:0,y:0});
  const [hover,    setHover]    = useState(null);
  const [wfName,   setWfName]   = useState("Invoice Approval");

  // debugger
  const [dbgOpen,  setDbgOpen]  = useState(true);
  const [dbgTab,   setDbgTab]   = useState("log");
  const [debugMode,setDebugMode]= useState(false);
  const [breakpts, setBreakpts] = useState(new Set(["n3"]));
  const [simState, setSimState] = useState("idle");
  const [simNodes, setSimNodes] = useState({});
  const [simConns, setSimConns] = useState(new Set());
  const [activeNid,setActiveNid]= useState(null);
  const [execCtx,  setExecCtx]  = useState({...INIT_CTX});
  const [execLog,  setExecLog]  = useState([]);
  const [callStack,setCallStack]= useState([]);

  const pauseRef = useRef(false);
  const stepRef  = useRef(null);
  const stopRef  = useRef(false);
  const logR     = useRef([]);
  const ctxR     = useRef({...INIT_CTX});
  const snR      = useRef({});
  const scR      = useRef(new Set());
  const stackR   = useRef([]);
  const canvasRef= useRef(null);

  const log = useCallback((level,msg,nodeId=null)=>{
    const e={id:uid(),ts:ts(),level,msg,nodeId};
    logR.current=[...logR.current,e];
    setExecLog([...logR.current]);
  },[]);

  const mutCtx = useCallback((patch)=>{
    ctxR.current={...ctxR.current,...patch};
    setExecCtx({...ctxR.current});
  },[]);

  const setNS = useCallback((id,status,extra={})=>{
    snR.current={...snR.current,[id]:{status,...extra}};
    setSimNodes({...snR.current});
    if(status==="running") setActiveNid(id);
    else setActiveNid(p=>p===id?null:p);
  },[]);

  const sleepMs = ms=>new Promise(r=>{ if(!stopRef.current) setTimeout(r,ms); else r(); });

  const execNode = useCallback(async(nid,nds,css)=>{
    if(stopRef.current) return;
    const node=nds.find(n=>n.id===nid);
    if(!node) return;

    stackR.current=[...stackR.current,{id:nid,label:node.label,type:node.type,entered:ts()}];
    setCallStack([...stackR.current]);

    // breakpoint check
    if(debugMode && breakpts.has(nid)){
      setNS(nid,"paused");
      pauseRef.current=true;
      log("breakpoint",`⬡ Breakpoint hit → "${node.label}"`,nid);
      setSimState("paused");
      await new Promise(r=>{stepRef.current=r;});
      if(stopRef.current) return;
      setSimState("running");
    }

    // pause check
    if(pauseRef.current){
      setNS(nid,"paused");
      setSimState("paused");
      await new Promise(r=>{stepRef.current=r;});
      if(stopRef.current) return;
      setSimState("running");
    }

    setNS(nid,"running");
    log("info",`→ enter "${node.label}"`,nid);
    const t0=Date.now();
    const delay={trigger:500,task:800,decision:550,parallel:350,end:400}[node.type]||600;
    await sleepMs(delay);
    if(stopRef.current) return;

    // simulate side effects
    if(node.type==="trigger"){
      mutCtx({_trigger:node.label,_workflow_started:new Date().toISOString()});
      log("info",`Trigger payload bound to context`,nid);
    } else if(node.type==="task"){
      const act=node.config?.actionType||"Call API";
      const ep =node.config?.endpoint||"(none)";
      log("info",`${act} → ${ep}`,nid);
      if(/validate/i.test(node.label)) mutCtx({validated:true,validation_score:0.98});
      if(/approve/i.test(node.label))  mutCtx({approved:true,approved_at:new Date().toISOString()});
      if(/ledger/i.test(node.label))   mutCtx({ledger_id:`LDG-${Math.floor(Math.random()*9000+1000)}`,posted:true});
      log("success",`Task OK — ${Date.now()-t0}ms`,nid);
    } else if(node.type==="decision"){
      const cond=node.config?.condition||"true";
      const key=cond.split(/[ ><=!]/)[0].trim();
      const val=ctxR.current[key]??ctxR.current.amount;
      let result=false;
      try{ result=Function("ctx",`with(ctx){return ${cond};`)(ctxR.current); }catch{}
      log("info",`eval: ${cond}`,nid);
      log("info",`  ${key} = ${val}`,nid);
      log(result?"success":"warn",`  → ${result?"YES (port 0)":"NO (port 1)"}`,nid);
      mutCtx({_last_decision:cond,_decision_result:result});
    } else if(node.type==="parallel"){
      log("info","Spawning parallel branches",nid);
    } else if(node.type==="end"){
      mutCtx({_status:"COMPLETED",_ended:new Date().toISOString()});
      log("success","✓ Workflow completed",nid);
    }

    setNS(nid,"done",{duration:Date.now()-t0});
    stackR.current=stackR.current.filter(s=>s.id!==nid);
    setCallStack([...stackR.current]);

    const outs=css.filter(c=>c.from===nid);
    if(!outs.length) return;

    if(node.type==="decision"){
      const cond=node.config?.condition||"true";
      let result=false;
      try{ result=Function("ctx",`with(ctx){return ${cond};`)(ctxR.current); }catch{}
      const pick=outs.find(c=>c.port===(result?0:1))||outs[0];
      scR.current=new Set([...scR.current,pick.id]);
      setSimConns(new Set(scR.current));
      await sleepMs(180);
      await execNode(pick.to,nds,css);
    } else if(node.type==="parallel"){
      for(const c of outs){scR.current.add(c.id);}
      setSimConns(new Set(scR.current));
      await sleepMs(120);
      await Promise.all(outs.map(c=>execNode(c.to,nds,css)));
    } else {
      for(const c of outs){
        scR.current.add(c.id);
        setSimConns(new Set(scR.current));
        await sleepMs(160);
        await execNode(c.to,nds,css);
      }
    }
  },[breakpts,debugMode,log,mutCtx,setNS]);

  const startSim=useCallback(async()=>{
    stopRef.current=false; pauseRef.current=false; stepRef.current=null;
    logR.current=[]; snR.current={}; scR.current=new Set(); stackR.current=[];
    ctxR.current={...INIT_CTX};
    setSimNodes({}); setSimConns(new Set()); setActiveNid(null); setCallStack([]);
    setExecCtx({...INIT_CTX}); setExecLog([]);
    setSimState("running"); setDbgOpen(true);
    const start=nodes.find(n=>n.type==="trigger");
    if(!start){ log("error","No trigger node found"); setSimState("error"); return; }
    log("info",`=== ${wfName} started ===`);
    log("info",`Debug: ${debugMode?"ON — breakpoints active":"OFF"}`);
    try{
      await execNode(start.id,nodes,conns);
      if(!stopRef.current){ setSimState("done"); log("info","=== Execution complete ==="); }
    }catch(e){ setSimState("error"); log("error",`Error: ${e.message}`); }
  },[nodes,conns,wfName,debugMode,log,execNode]);

  const stopSim=()=>{
    stopRef.current=true;
    if(stepRef.current){stepRef.current();stepRef.current=null;}
    pauseRef.current=false;
    setSimState("idle"); setSimNodes({}); setSimConns(new Set()); setActiveNid(null); setCallStack([]);
    log("warn","=== Stopped ===");
  };
  const stepNext=()=>{
    if(stepRef.current){ pauseRef.current=false; const f=stepRef.current; stepRef.current=null; f(); }
  };
  const pauseResume=()=>{
    if(simState==="running"){
      pauseRef.current=true; setSimState("paused"); log("warn","Paused");
    } else if(simState==="paused"){
      pauseRef.current=false; setSimState("running"); log("info","Resumed");
      if(stepRef.current){const f=stepRef.current;stepRef.current=null;f();}
    }
  };
  const toggleBP=id=>setBreakpts(bp=>{const n=new Set(bp);n.has(id)?n.delete(id):n.add(id);return n;});

  // canvas
  const onMove=e=>{
    if(drag){const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;setNodes(ns=>ns.map(n=>n.id===drag.id?{...n,x:Math.max(0,drag.ox+dx),y:Math.max(0,drag.oy+dy)}:n));}
    if(pan) setOff({x:pan.ox+e.clientX-pan.sx,y:pan.oy+e.clientY-pan.sy});
    if(conn){const r=canvasRef.current.getBoundingClientRect();setMxy({x:e.clientX-r.left-off.x,y:e.clientY-r.top-off.y});}
  };
  const onUp=()=>{setDrag(null);setPan(null);setConn(null);};
  const onDown=e=>{
    if(!e.target.closest("[data-node]")&&!e.target.closest("[data-port]")){
      setSel(null);setPan({sx:e.clientX,sy:e.clientY,ox:off.x,oy:off.y});
    }
  };
  const startDrag=(e,n)=>{e.stopPropagation();setSel(n.id);setDrag({id:n.id,sx:e.clientX,sy:e.clientY,ox:n.x,oy:n.y});};
  const startConn=(e,n,p)=>{
    e.stopPropagation();e.preventDefault();
    setConn({fromId:n.id,port:p,sp:outP(n,p)});
    const r=canvasRef.current.getBoundingClientRect();setMxy({x:e.clientX-r.left-off.x,y:e.clientY-r.top-off.y});
  };
  const endConn=(e,tn)=>{
    e.stopPropagation();
    if(!conn||conn.fromId===tn.id){setConn(null);return;}
    if(!conns.some(c=>c.from===conn.fromId&&c.to===tn.id&&c.port===conn.port)){
      const fn=nodes.find(n=>n.id===conn.fromId);
      const lbl=TYPES[fn.type].outs>1?(conn.port===0?"Yes":"No"):"";
      setConns(cs=>[...cs,{id:uid(),from:conn.fromId,to:tn.id,port:conn.port,label:lbl}]);
    }
    setConn(null);
  };
  const delNode=id=>{setNodes(ns=>ns.filter(n=>n.id!==id));setConns(cs=>cs.filter(c=>c.from!==id&&c.to!==id));if(sel===id)setSel(null);};
  const addNode=(type,x,y)=>{const id=uid();setNodes(ns=>[...ns,{id,type,label:TYPES[type].label,x,y,config:{}}]);setSel(id);};
  const onDrop=e=>{
    const type=e.dataTransfer.getData("type");if(!type)return;
    const r=canvasRef.current.getBoundingClientRect();
    addNode(type,e.clientX-r.left-off.x-NW/2,e.clientY-r.top-off.y-NH/2);
  };
  const exportJSON=()=>{
    const d={workflow:wfName,version:"1.0",nodes,connections:conns,lastContext:execCtx};
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:"application/json"}));a.download="workflow.json";a.click();
  };

  const selN=nodes.find(n=>n.id===sel);
  const gX=((off.x%24)+24)%24, gY=((off.y%24)+24)%24;
  const simRunning=simState==="running"||simState==="paused";
  const LC={info:"#8b949e",success:"#10b981",warn:"#f59e0b",error:"#f85149",breakpoint:"#f59e0b"};
  const LI={info:"·",success:"✓",warn:"⚠",error:"✕",breakpoint:"⬡"};

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",fontFamily:"monospace",background:"#0d1117",color:"#e6edf3",overflow:"hidden",userSelect:"none"}}>

      {/* Toolbar */}
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 14px",background:"#161b22",borderBottom:"1px solid #30363d",flexShrink:0,flexWrap:"wrap"}}>
        <span style={{color:"#10b981",fontSize:11,letterSpacing:3,opacity:0.8}}>⬡ WF</span>
        <input value={wfName} onChange={e=>setWfName(e.target.value)} onMouseDown={e=>e.stopPropagation()}
          style={{background:"transparent",border:"none",borderBottom:"1px solid #30363d44",color:"#e6edf3",fontFamily:"monospace",fontSize:13,fontWeight:"bold",width:180,outline:"none",padding:"2px 0"}}/>
        <div style={{flex:1}}/>
        <button onClick={()=>setDebugMode(d=>!d)} style={{...BTN,borderColor:debugMode?"#f59e0b":"#30363d",color:debugMode?"#f59e0b":"#8b949e",background:debugMode?"#1a130a":"transparent"}}>
          {debugMode?"⬡ DEBUG":"○ DEBUG"}
        </button>
        <button style={BTN} onClick={()=>{setNodes(DEMO_N);setConns(DEMO_C);setSel(null);stopSim();}}>Reset</button>
        <button style={BTN} onClick={()=>{setNodes([]);setConns([]);setSel(null);stopSim();}}>Clear</button>
        <button style={BTN} onClick={exportJSON}>Export</button>
        {!simRunning&&<button onClick={startSim} style={{...BTN,borderColor:"#10b981",color:"#10b981",background:"#0a1f13"}}>▶ RUN</button>}
        {simRunning&&<>
          <button onClick={pauseResume} style={{...BTN,borderColor:"#f59e0b",color:"#f59e0b",background:"#1a130a"}}>
            {simState==="paused"?"▶ RESUME":"⏸ PAUSE"}
          </button>
          {simState==="paused"&&<button onClick={stepNext} style={{...BTN,borderColor:"#3b82f6",color:"#3b82f6",background:"#0a1220"}}>→ STEP</button>}
          <button onClick={stopSim} style={{...BTN,borderColor:"#f85149",color:"#f85149",background:"#1a0808"}}>■ STOP</button>
        </>}
        {simState==="done"&&<span style={{fontSize:10,color:"#10b981"}}>✓ DONE</span>}
        {simState==="error"&&<span style={{fontSize:10,color:"#f85149"}}>✕ ERROR</span>}
        <button onClick={()=>setDbgOpen(o=>!o)} style={{...BTN,borderColor:dbgOpen?"#3b82f6":"#30363d",color:dbgOpen?"#3b82f6":"#8b949e"}}>
          {dbgOpen?"▼ PANEL":"▲ PANEL"}
        </button>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* Palette */}
        <div style={{width:170,background:"#161b22",borderRight:"1px solid #30363d",padding:"10px 8px",flexShrink:0,overflowY:"auto"}}>
          <div style={{fontSize:9,color:"#484f58",marginBottom:8,letterSpacing:2}}>NODES</div>
          {Object.entries(TYPES).map(([type,t])=>(
            <div key={type} draggable onDragStart={e=>e.dataTransfer.setData("type",type)}
              onClick={()=>addNode(type,240-off.x+Math.random()*60,200-off.y+Math.random()*80)}
              style={{display:"flex",alignItems:"center",gap:7,padding:"6px 9px",marginBottom:4,borderRadius:5,cursor:"grab",background:"#0d1117",border:`1px solid ${t.color}28`}}>
              <span style={{color:t.color,fontSize:13}}>{ICONS[type]}</span>
              <div>
                <div style={{fontSize:10,color:t.color,fontWeight:"bold"}}>{t.label}</div>
                <div style={{fontSize:8,color:"#484f58"}}>{DESCS[type]}</div>
              </div>
            </div>
          ))}
          {debugMode&&breakpts.size>0&&(
            <div style={{marginTop:14}}>
              <div style={{fontSize:9,color:"#484f58",marginBottom:6,letterSpacing:2}}>BREAKPOINTS</div>
              {nodes.filter(n=>breakpts.has(n.id)).map(n=>(
                <div key={n.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:9,color:"#f59e0b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:112}}>⬡ {n.label}</span>
                  <button onMouseDown={e=>{e.stopPropagation();toggleBP(n.id);}} style={{background:"transparent",border:"none",color:"#f85149",cursor:"pointer",fontSize:9,padding:0}}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Canvas + debug panel column */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

          {/* Canvas */}
          <div ref={canvasRef}
            style={{flex:1,position:"relative",overflow:"hidden",cursor:drag||pan?"grabbing":conn?"crosshair":"default"}}
            onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onMouseDown={onDown}
            onDragOver={e=>e.preventDefault()} onDrop={onDrop}>

            <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
              <defs>
                <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform={`translate(${gX},${gY})`}>
                  <path d="M24 0L0 0 0 24" fill="none" stroke="#1c2128" strokeWidth="0.5"/>
                </pattern>
                <marker id="arr"  markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#2d333b"/></marker>
                <marker id="arrA" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#22d3ee"/></marker>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)"/>
            </svg>

            <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",overflow:"visible",pointerEvents:"none"}}>
              <g transform={`translate(${off.x},${off.y})`}>
                {conns.map(c=>{
                  const fn=nodes.find(n=>n.id===c.from),tn=nodes.find(n=>n.id===c.to);
                  if(!fn||!tn) return null;
                  const fp=outP(fn,c.port),tp=inP(tn),act=simConns.has(c.id);
                  const mx=(fp.x+tp.x)/2,my=(fp.y+tp.y)/2;
                  return (
                    <g key={c.id}>
                      <path d={bez(fp,tp)} fill="none" stroke={act?"#22d3ee":"#2d333b"} strokeWidth={act?2.2:1.5} strokeDasharray={act?"none":"5,4"} markerEnd={act?"url(#arrA)":"url(#arr)"}/>
                      {act&&<circle r="4" fill="#22d3ee" opacity="0.85"><animateMotion dur="0.55s" repeatCount="indefinite" path={bez(fp,tp)}/></circle>}
                      {c.label&&<text x={mx} y={my-7} textAnchor="middle" fontSize="10" fontFamily="monospace" fill={act?"#67e8f9":"#484f58"}>{c.label}</text>}
                    </g>
                  );
                })}
                {conn&&<path d={bez(conn.sp,mxy)} fill="none" stroke="#60a5fa88" strokeWidth="1.5" strokeDasharray="5,4"/>}
              </g>
            </svg>

            <div style={{position:"absolute",inset:0,pointerEvents:"none"}}>
              <div style={{position:"absolute",transform:`translate(${off.x}px,${off.y}px)`,pointerEvents:"none"}}>
                {nodes.map(n=>{
                  const t=TYPES[n.type],ns=simNodes[n.id],status=ns?.status||"idle";
                  const isActive=activeNid===n.id,isS=sel===n.id,isH=hover===n.id,isBP=debugMode&&breakpts.has(n.id);
                  return (
                    <div key={n.id} data-node="1"
                      style={{
                        position:"absolute",left:n.x,top:n.y,width:NW,height:NH,
                        background:isActive?"#081a0e":status==="paused"?"#1a130a":status==="done"?"#0a1a0a":"#161b22",
                        border:`1px solid ${isActive?"#22d3ee":isS?"#388bfd":isBP?"#f59e0b55":t.color+"38"}`,
                        borderLeft:`3px solid ${status==="running"||isActive?"#22d3ee":status==="paused"?"#f59e0b":status==="done"?t.color:status==="error"?"#f85149":t.color}`,
                        borderRadius:5,pointerEvents:"auto",
                        display:"flex",alignItems:"center",gap:8,padding:"0 8px 0 10px",
                        transition:"background 0.2s,border 0.2s",
                      }}
                      onMouseDown={e=>startDrag(e,n)} onMouseUp={e=>endConn(e,n)}
                      onMouseEnter={()=>setHover(n.id)} onMouseLeave={()=>setHover(null)}>
                      <span style={{color:t.color,fontSize:13,flexShrink:0}}>{ICONS[n.type]}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <span style={{fontSize:9,color:t.color,letterSpacing:1,opacity:0.75}}>{t.label.toUpperCase()}</span>
                          {ns?.duration&&<span style={{fontSize:8,color:"#10b981"}}>{ns.duration}ms</span>}
                        </div>
                        <div style={{fontSize:11,color:"#e6edf3",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{n.label}</div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,flexShrink:0}}>
                        {debugMode&&(
                          <div data-port="1" title={isBP?"Remove breakpoint":"Add breakpoint"}
                            onMouseDown={e=>{e.stopPropagation();toggleBP(n.id);}}
                            style={{width:10,height:10,borderRadius:"50%",background:isBP?"#f59e0b":"#21262d",border:`1px solid ${isBP?"#f59e0b44":"#30363d"}`,cursor:"pointer"}}/>
                        )}
                        {status!=="idle"&&(
                          <span style={{fontSize:9,color:STAT[status]||"#484f58"}}>
                            {status==="running"?"▶":status==="done"?"✓":status==="paused"?"⏸":status==="error"?"✕":""}
                          </span>
                        )}
                        {isH&&!simRunning&&(
                          <button data-port="1" onMouseDown={e=>{e.stopPropagation();delNode(n.id);}}
                            style={{background:"transparent",border:"none",color:"#f85149",cursor:"pointer",fontSize:11,padding:0,lineHeight:1}}>✕</button>
                        )}
                      </div>
                      {n.type!=="trigger"&&(
                        <div data-port="1" style={{position:"absolute",left:-5,top:NH/2-5,width:10,height:10,borderRadius:"50%",background:"#0d1117",border:"1.5px solid #484f58",cursor:"crosshair",pointerEvents:"auto",zIndex:10}}
                          onMouseUp={e=>endConn(e,n)}/>
                      )}
                      {Array.from({length:TYPES[n.type].outs}).map((_,i)=>{
                        const py=TYPES[n.type].outs>1?(i===0?NH*0.3:NH*0.7):NH/2;
                        return <div key={i} data-port="1" style={{position:"absolute",right:-5,top:py-5,width:10,height:10,borderRadius:"50%",background:t.color,border:"1.5px solid #0d1117",cursor:"crosshair",pointerEvents:"auto",zIndex:10}}
                          onMouseDown={e=>startConn(e,n,i)}/>;
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
            {nodes.length===0&&(
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
                <div style={{fontSize:32,opacity:0.1}}>⬡</div>
                <div style={{fontSize:12,color:"#484f58",marginTop:8}}>Drop nodes here or click from the palette</div>
              </div>
            )}
          </div>

          {/* Debugger Panel */}
          {dbgOpen&&(
            <div style={{height:248,background:"#0d1117",borderTop:"1px solid #30363d",display:"flex",flexDirection:"column",flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",borderBottom:"1px solid #21262d",padding:"0 10px",flexShrink:0}}>
                {[["log","EXEC LOG"],["context","CONTEXT"],["stack","CALL STACK"],["nodes","NODE STATUS"]].map(([tab,lbl])=>(
                  <button key={tab} onClick={()=>setDbgTab(tab)}
                    style={{background:"transparent",border:"none",borderBottom:`2px solid ${dbgTab===tab?"#3b82f6":"transparent"}`,
                    color:dbgTab===tab?"#e6edf3":"#484f58",fontFamily:"monospace",fontSize:10,padding:"6px 10px",cursor:"pointer",letterSpacing:1}}>
                    {lbl}{tab==="log"&&execLog.length>0&&<span style={{marginLeft:5,background:"#21262d",borderRadius:8,padding:"1px 5px",fontSize:9,color:"#8b949e"}}>{execLog.length}</span>}
                  </button>
                ))}
                <div style={{flex:1}}/>
                {simState==="paused"&&(
                  <span style={{fontSize:9,color:"#f59e0b",marginRight:8}}>⏸ PAUSED</span>
                )}
                <button onClick={()=>{logR.current=[];setExecLog([]);}} style={{...BTN,fontSize:9,padding:"2px 8px"}}>Clear</button>
              </div>

              {/* LOG */}
              {dbgTab==="log"&&(
                <div style={{flex:1,overflowY:"auto",padding:"6px 12px",display:"flex",flexDirection:"column",gap:2}}>
                  {execLog.length===0&&<span style={{fontSize:10,color:"#484f58",marginTop:8}}>No log yet. Press RUN.</span>}
                  {execLog.map(e=>(
                    <div key={e.id} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                      <span style={{fontSize:9,color:"#484f58",flexShrink:0,minWidth:82,paddingTop:1}}>{e.ts}</span>
                      <span style={{fontSize:10,color:LC[e.level]||"#8b949e",flexShrink:0}}>{LI[e.level]}</span>
                      <span style={{fontSize:10,color:LC[e.level]||"#8b949e",flex:1,wordBreak:"break-all"}}>{e.msg}</span>
                      {e.nodeId&&(
                        <span style={{fontSize:8,color:"#484f58",flexShrink:0,cursor:"pointer",whiteSpace:"nowrap"}}
                          onMouseDown={ev=>{ev.stopPropagation();setSel(e.nodeId);}}>
                          [{nodes.find(n=>n.id===e.nodeId)?.label||e.nodeId}]
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* CONTEXT */}
              {dbgTab==="context"&&(
                <div style={{flex:1,overflowY:"auto",padding:"8px 12px"}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:5}}>
                    {Object.entries(execCtx).map(([k,v])=>(
                      <div key={k} style={{background:"#161b22",border:"1px solid #21262d",borderRadius:4,padding:"5px 8px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                        <span style={{fontSize:9,color:k.startsWith("_")?"#6e7681":"#484f58",fontStyle:k.startsWith("_")?"italic":"normal",flexShrink:0,minWidth:90}}>{k}</span>
                        <span style={{fontSize:10,color:typeof v==="boolean"?(v?"#10b981":"#f85149"):typeof v==="number"?"#f59e0b":k.startsWith("_")?"#22d3ee":"#e6edf3",textAlign:"right",wordBreak:"break-all",maxWidth:160}}>
                          {String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CALL STACK */}
              {dbgTab==="stack"&&(
                <div style={{flex:1,overflowY:"auto",padding:"8px 12px"}}>
                  {callStack.length===0&&<span style={{fontSize:10,color:"#484f58"}}>Call stack is empty.</span>}
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {[...callStack].reverse().map((f,i)=>(
                      <div key={f.id+f.entered} style={{display:"flex",alignItems:"center",gap:10,background:"#161b22",border:`1px solid ${i===0?"#3b82f644":"#21262d"}`,borderLeft:`3px solid ${i===0?"#3b82f6":TYPES[f.type].color}`,borderRadius:4,padding:"5px 10px"}}>
                        <span style={{fontSize:9,color:"#484f58",minWidth:16}}>#{callStack.length-i}</span>
                        <span style={{fontSize:10,color:TYPES[f.type].color}}>{ICONS[f.type]}</span>
                        <span style={{fontSize:11,color:"#e6edf3",flex:1}}>{f.label}</span>
                        <span style={{fontSize:8,color:"#484f58"}}>{f.type}</span>
                        <span style={{fontSize:8,color:"#484f58"}}>{f.entered}</span>
                        {i===0&&<span style={{fontSize:9,color:"#3b82f6"}}>← active</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* NODE STATUS */}
              {dbgTab==="nodes"&&(
                <div style={{flex:1,overflowY:"auto",padding:"4px 0"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
                    <thead>
                      <tr style={{borderBottom:"1px solid #21262d"}}>
                        {["Node","Type","Status","Duration","BP"].map(h=>(
                          <th key={h} style={{padding:"4px 12px",color:"#484f58",fontWeight:"normal",textAlign:"left",fontSize:9,letterSpacing:1}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {nodes.map(n=>{
                        const ns=simNodes[n.id],status=ns?.status||"pending",isBP=breakpts.has(n.id);
                        return (
                          <tr key={n.id} style={{borderBottom:"1px solid #161b22",background:n.id===activeNid?"#0a1a0a":"transparent",cursor:"pointer"}}
                            onMouseDown={e=>{e.stopPropagation();setSel(n.id);}}>
                            <td style={{padding:"4px 12px",color:"#e6edf3"}}>{n.label}</td>
                            <td style={{padding:"4px 12px",color:TYPES[n.type].color}}>{TYPES[n.type].label}</td>
                            <td style={{padding:"4px 12px"}}>
                              <span style={{color:STAT[status]||"#484f58",fontSize:9}}>
                                {status==="running"?"▶ running":status==="done"?"✓ done":status==="paused"?"⏸ paused":status==="error"?"✕ error":"· pending"}
                              </span>
                            </td>
                            <td style={{padding:"4px 12px",color:ns?.duration?"#10b981":"#484f58"}}>{ns?.duration?`${ns.duration}ms`:"—"}</td>
                            <td style={{padding:"4px 12px"}}>
                              {debugMode?(
                                <button onMouseDown={e=>{e.stopPropagation();toggleBP(n.id);}}
                                  style={{background:isBP?"#1a130a":"transparent",border:`1px solid ${isBP?"#f59e0b44":"#30363d"}`,color:isBP?"#f59e0b":"#484f58",fontFamily:"monospace",fontSize:9,padding:"2px 6px",borderRadius:3,cursor:"pointer"}}>
                                  {isBP?"⬡":"○"}
                                </button>
                              ):<span style={{color:"#484f58",fontSize:9}}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Properties panel */}
        {selN&&(
          <div style={{width:210,background:"#161b22",borderLeft:"1px solid #30363d",padding:12,flexShrink:0,overflowY:"auto"}}>
            <div style={{fontSize:9,color:"#484f58",marginBottom:12,letterSpacing:2}}>PROPERTIES</div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:9,color:"#484f58",marginBottom:4,letterSpacing:1}}>TYPE</div>
              <span style={{color:TYPES[selN.type].color,fontSize:12}}>{ICONS[selN.type]} {TYPES[selN.type].label}</span>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:9,color:"#484f58",marginBottom:4,letterSpacing:1}}>LABEL</div>
              <input value={selN.label} onMouseDown={e=>e.stopPropagation()}
                onChange={e=>setNodes(ns=>ns.map(n=>n.id===selN.id?{...n,label:e.target.value}:n))} style={INP}/>
            </div>
            {selN.type==="decision"&&(
              <div style={{marginBottom:10}}>
                <div style={{fontSize:9,color:"#484f58",marginBottom:4,letterSpacing:1}}>CONDITION</div>
                <input placeholder="amount > 10000" onMouseDown={e=>e.stopPropagation()}
                  defaultValue={selN.config?.condition||""}
                  onChange={e=>setNodes(ns=>ns.map(n=>n.id===selN.id?{...n,config:{...n.config,condition:e.target.value}}:n))}
                  style={INP}/>
                <div style={{fontSize:8,color:"#484f58",marginTop:3}}>Evaluates against execution context</div>
              </div>
            )}
            {selN.type==="trigger"&&(
              <div style={{marginBottom:10}}>
                <div style={{fontSize:9,color:"#484f58",marginBottom:4,letterSpacing:1}}>TRIGGER TYPE</div>
                <select onMouseDown={e=>e.stopPropagation()} style={SEL}>
                  {["API Call","Webhook","Timer","User Action","DB Event"].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            )}
            {selN.type==="task"&&<>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:9,color:"#484f58",marginBottom:4,letterSpacing:1}}>ACTION TYPE</div>
                <select onMouseDown={e=>e.stopPropagation()} style={SEL}>
                  {["Send Email","Call API","Create Record","Generate Report","Send Notification","Log Audit"].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:9,color:"#484f58",marginBottom:4,letterSpacing:1}}>ENDPOINT</div>
                <input placeholder="https://..." onMouseDown={e=>e.stopPropagation()} style={INP}/>
              </div>
            </>}

            {simNodes[selN.id]&&(
              <div style={{marginBottom:10,background:"#0d1117",border:"1px solid #21262d",borderRadius:4,padding:8}}>
                <div style={{fontSize:9,color:"#484f58",marginBottom:5,letterSpacing:1}}>RUNTIME</div>
                <div style={{fontSize:9,color:STAT[simNodes[selN.id]?.status]||"#484f58",marginBottom:3}}>
                  Status: {simNodes[selN.id]?.status}
                </div>
                {simNodes[selN.id]?.duration&&<div style={{fontSize:9,color:"#10b981"}}>Duration: {simNodes[selN.id].duration}ms</div>}
              </div>
            )}

            {debugMode&&(
              <div style={{marginBottom:10}}>
                <div style={{fontSize:9,color:"#484f58",marginBottom:5,letterSpacing:1}}>BREAKPOINT</div>
                <button onMouseDown={e=>{e.stopPropagation();toggleBP(selN.id);}}
                  style={{width:"100%",background:breakpts.has(selN.id)?"#1a130a":"transparent",border:`1px solid ${breakpts.has(selN.id)?"#f59e0b44":"#30363d"}`,color:breakpts.has(selN.id)?"#f59e0b":"#8b949e",fontFamily:"monospace",fontSize:11,padding:"5px 0",borderRadius:4,cursor:"pointer"}}>
                  {breakpts.has(selN.id)?"⬡ Remove Breakpoint":"○ Set Breakpoint"}
                </button>
              </div>
            )}

            <div style={{borderTop:"1px solid #21262d",paddingTop:8,marginBottom:8}}>
              <div style={{fontSize:9,color:"#484f58",marginBottom:5,letterSpacing:1}}>CONNECTIONS</div>
              {conns.filter(c=>c.from===selN.id||c.to===selN.id).length===0
                ?<div style={{fontSize:9,color:"#484f58"}}>None</div>
                :conns.filter(c=>c.from===selN.id||c.to===selN.id).map(c=>{
                  const other=nodes.find(n=>n.id===(c.from===selN.id?c.to:c.from));
                  return (
                    <div key={c.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:9,color:"#8b949e",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:150}}>
                        {c.from===selN.id?"→":"←"} {other?.label||"?"}{c.label?` (${c.label})`:""}
                      </span>
                      <button onMouseDown={e=>{e.stopPropagation();delConn(c.id);}} style={{background:"transparent",border:"none",color:"#f85149",cursor:"pointer",fontSize:9,padding:0}}>✕</button>
                    </div>
                  );
                })
              }
            </div>
            <button onMouseDown={e=>{e.stopPropagation();delNode(selN.id);}}
              style={{width:"100%",background:"#1a0808",border:"1px solid #f8514944",color:"#f85149",padding:"5px 0",borderRadius:4,cursor:"pointer",fontFamily:"monospace",fontSize:11}}>
              Delete Node
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
