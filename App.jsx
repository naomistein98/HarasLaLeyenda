import { useState, useMemo, useEffect } from "react";

const SUPABASE_URL = "https://xmiygmcczqlvovdwlfov.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtaXlnbWNjenFsdm92ZHdsZm92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjQwOTIsImV4cCI6MjA5NDM0MDA5Mn0._Fp6Ah-pg2Kp9qbemzNZJ7RQj6w34WJRZsWNvVDtYJA";

async function sbFetch(table, method = "GET", body = null, filters = "", token = null) {
  const key = token || SUPABASE_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${filters}`, {
    method,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "return=minimal" : "",
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

const sbSelect = (table, filters = "") => sbFetch(table, "GET", null, `?order=id${filters}`);
const sbUpsert = (table, data) => sbFetch(table, "POST", data, "?on_conflict=id");
const sbUpdate = (table, id, data) => sbFetch(table, "PATCH", data, `?id=eq.${id}`);
const sbDelete = (table, id) => sbFetch(table, "DELETE", null, `?id=eq.${id}`);

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.ok ? await res.json() : null;
}

function fmt(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function hoy() {
  return new Date().toISOString().split("T")[0];
}

function diasDesde(fecha) {
  if (!fecha) return null;
  const diff = new Date() - new Date(fecha);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ── STYLES ──────────────────────────────────────────────────────────────────
const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: #f5f3ef; color: #1a1410; }
  .app { display: flex; min-height: 100vh; }
  .sidebar { width: 240px; background: #1a1410; color: #f5f3ef; display: flex; flex-direction: column; padding: 24px 16px; gap: 8px; min-height: 100vh; }
  .sidebar h1 { font-family: 'Playfair Display', serif; font-size: 20px; color: #c9a84c; margin-bottom: 4px; }
  .sidebar p { font-size: 11px; color: #888; margin-bottom: 16px; letter-spacing: 1px; text-transform: uppercase; }
  .nav-btn { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; border: none; background: none; color: #ccc; font-size: 14px; cursor: pointer; text-align: left; width: 100%; transition: background 0.15s; }
  .nav-btn:hover { background: #2a2420; color: #fff; }
  .nav-btn.active { background: #c9a84c22; color: #c9a84c; font-weight: 600; }
  .sidebar-footer { margin-top: auto; font-size: 12px; color: #666; }
  .main { flex: 1; padding: 32px; overflow-y: auto; }
  .search-hero { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 20px; }
  .search-hero h2 { font-family: 'Playfair Display', serif; font-size: 28px; color: #1a1410; }
  .search-bar { width: 100%; max-width: 580px; display: flex; gap: 0; }
  .search-bar input { flex: 1; padding: 16px 20px; font-size: 16px; border: 2px solid #c9a84c; border-right: none; border-radius: 12px 0 0 12px; outline: none; background: #fff; }
  .search-bar button { padding: 16px 24px; background: #c9a84c; color: #fff; border: none; border-radius: 0 12px 12px 0; font-size: 16px; cursor: pointer; font-weight: 600; }
  .results { width: 100%; max-width: 720px; }
  .card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,.08); margin-bottom: 16px; }
  .card h3 { font-family: 'Playfair Display', serif; font-size: 20px; margin-bottom: 4px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; background: #f0e8d0; color: #8B6000; }
  .badge.verde { background: #e8f5e8; color: #2d5a00; }
  .mov-list { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
  .mov-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: #f9f7f3; border-radius: 8px; font-size: 14px; }
  .mov-fecha { color: #888; font-size: 12px; min-width: 80px; }
  .mov-arrow { color: #c9a84c; font-weight: 700; }
  .mov-lote { font-weight: 600; }
  .mov-motivo { color: #888; font-size: 12px; margin-left: auto; }
  .table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .table th { text-align: left; padding: 10px 12px; border-bottom: 2px solid #e8e4dc; color: #888; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }
  .table td { padding: 10px 12px; border-bottom: 1px solid #f0ece4; vertical-align: middle; }
  .table tr:hover td { background: #faf8f4; }
  .btn { padding: 8px 16px; border-radius: 8px; border: 1px solid #e0ddd8; background: #fff; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s; }
  .btn:hover { background: #f5f3ef; }
  .btn-primary { background: #c9a84c; color: #fff; border-color: #c9a84c; }
  .btn-primary:hover { background: #b8962a; }
  .btn-danger { background: #fff; color: #cc2222; border-color: #e0a0a0; }
  .btn-sm { padding: 4px 10px; font-size: 12px; }
  .input { padding: 10px 14px; border: 1px solid #e0ddd8; border-radius: 8px; font-size: 14px; width: 100%; outline: none; background: #fff; }
  .input:focus { border-color: #c9a84c; }
  .label { font-size: 13px; font-weight: 600; color: #555; margin-bottom: 4px; display: block; }
  .form-row { display: flex; gap: 12px; flex-wrap: wrap; }
  .form-group { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 140px; }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
  .modal { background: #fff; border-radius: 16px; padding: 28px; max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto; }
  .modal h3 { font-family: 'Playfair Display', serif; font-size: 20px; margin-bottom: 16px; }
  .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .section-header h2 { font-family: 'Playfair Display', serif; font-size: 24px; }
  .empty { text-align: center; color: #aaa; padding: 32px; }
  .tag { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .tag-baja { background: #fde8e8; color: #cc2222; }
  .lluvia-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .lluvia-card { background: #fff; border-radius: 12px; padding: 16px 20px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .lluvia-card .num { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700; }
  .lluvia-card .lbl { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .5px; margin-top: 2px; }
  @media (max-width: 700px) {
    .app { flex-direction: column; }
    .sidebar { width: 100%; min-height: unset; flex-direction: row; flex-wrap: wrap; padding: 12px; }
    .main { padding: 16px; }
    .search-hero { min-height: 50vh; }
  }
`;

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function HarasApp() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [view, setView] = useState("buscar");
  const [caballos, setCaballos] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [lluvias, setLluvias] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [busqueda, setBusqueda] = useState("");
  const [busquedaActiva, setBusquedaActiva] = useState("");
  const [selCaballo, setSelCaballo] = useState(null);

  // Modals
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");

  // Movement form
  const [movForm, setMovForm] = useState({ fecha: hoy(), loteOrigen: "", loteDestino: "", motivo: "", caballoId: "" });

  // Lluvia form
  const [lluviaForm, setLluviaForm] = useState({ fecha: hoy(), mm: "" });

  // Lote filter
  const [loteSearch, setLoteSearch] = useState("");

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // ── AUTH ──
  async function handleLogin(e) {
    e.preventDefault();
    const data = await signIn(email, password);
    if (data?.access_token) {
      setSession(data);
      setLoginError("");
    } else {
      setLoginError("Email o contraseña incorrectos");
    }
  }

  // ── LOAD DATA ──
  useEffect(() => {
    if (!session) return;
    async function load() {
      setLoading(true);
      const [cab, lot, mov, lluv] = await Promise.all([
        sbSelect("caballos", "&baja=neq.true"),
        sbSelect("lotes"),
        sbFetch("movimientos", "GET", null, "?order=fecha.desc"),
        sbFetch("lluvias_campo", "GET", null, "?order=fecha.desc"),
      ]);
      if (cab) setCaballos(cab.map(c => ({
        id: c.id, nombre: c.nombre, categoria: c.categoria,
        loteId: c.lote_id, fechaIngreso: c.fecha_ingreso,
        baja: c.baja, fechaBaja: c.fecha_baja,
      })));
      if (lot) setLotes(lot.map(l => ({ id: l.id, nombre: l.nombre, hectareas: l.hectareas })));
      if (mov) setMovimientos(mov.map(m => ({
        id: m.id, fecha: m.fecha, caballoId: m.caballo_id,
        caballoNombre: m.caballo_nombre, loteOrigen: m.lote_origen,
        loteDestino: m.lote_destino, motivo: m.motivo, tipo: m.tipo,
      })));
      if (lluv) setLluvias(lluv.map(l => ({ id: l.id, fecha: l.fecha, mm: parseFloat(l.mm) })));
      setLoading(false);
    }
    load();
  }, [session]);

  // ── SEARCH ──
  const resultados = useMemo(() => {
    if (!busquedaActiva) return [];
    const q = busquedaActiva.toLowerCase();
    return caballos.filter(c => c.nombre?.toLowerCase().includes(q));
  }, [caballos, busquedaActiva]);

  function buscar() {
    setBusquedaActiva(busqueda.trim());
    setSelCaballo(null);
  }

  function getLoteNombre(id) {
    return lotes.find(l => l.id === id)?.nombre || id || "—";
  }

  function getMovsCaballo(caballoId) {
    return movimientos.filter(m => m.caballoId === caballoId).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  // ── SAVE MOVEMENT ──
  async function saveMovimiento() {
    const { fecha, loteOrigen, loteDestino, motivo, caballoId } = movForm;
    if (!loteDestino || !caballoId) return;
    const id = "MOV" + Date.now();
    const cab = caballos.find(c => c.id === caballoId);
    const newMov = { id, fecha, caballoId, caballoNombre: cab?.nombre, loteOrigen: loteOrigen || null, loteDestino, motivo, tipo: "individual" };
    setMovimientos(prev => [newMov, ...prev]);
    setCaballos(prev => prev.map(c => c.id === caballoId ? { ...c, loteId: loteDestino } : c));
    await sbUpsert("movimientos", [{
      id, fecha, caballo_id: caballoId, caballo_nombre: cab?.nombre,
      lote_origen: loteOrigen || null, lote_destino: loteDestino,
      motivo, tipo: "individual",
    }]);
    await sbUpdate("caballos", caballoId, { lote_id: loteDestino });
    setModal(null);
    setMovForm({ fecha: hoy(), loteOrigen: "", loteDestino: "", motivo: "", caballoId: "" });
    showToast("✓ Movimiento registrado");
  }

  // ── SAVE LLUVIA ──
  async function saveLluvia() {
    if (!lluviaForm.mm) return;
    const id = "LG" + Date.now();
    const nueva = { id, fecha: lluviaForm.fecha, mm: parseFloat(lluviaForm.mm) };
    setLluvias(prev => [nueva, ...prev]);
    await sbUpsert("lluvias_campo", [{ id, fecha: nueva.fecha, mm: nueva.mm }]);
    setModal(null);
    setLluviaForm({ fecha: hoy(), mm: "" });
    showToast("✓ Lluvia registrada");
  }

  // ── LLUVIA STATS ──
  const lluviaStats = useMemo(() => {
    const hoyStr = hoy();
    const inicioAnio = `${hoyStr.slice(0, 4)}-01-01`;
    const hace21 = new Date(); hace21.setDate(hace21.getDate() - 21);
    const hace21str = hace21.toISOString().split("T")[0];
    const desdeEnero = Math.round(lluvias.filter(l => l.fecha >= inicioAnio).reduce((s, l) => s + l.mm, 0) * 10) / 10;
    const ultimos21 = Math.round(lluvias.filter(l => l.fecha >= hace21str).reduce((s, l) => s + l.mm, 0) * 10) / 10;
    const ultima = lluvias[0];
    const sinLluvia = ultima ? diasDesde(ultima.fecha) : null;
    return { desdeEnero, ultimos21, sinLluvia };
  }, [lluvias]);

  // ── LOTES FILTRADOS ──
  const lotesFiltrados = useMemo(() => {
    if (!loteSearch) return lotes;
    return lotes.filter(l => l.nombre?.toLowerCase().includes(loteSearch.toLowerCase()));
  }, [lotes, loteSearch]);

  function cabsDe(loteId) {
    return caballos.filter(c => c.loteId === loteId && !c.baja);
  }

  // ── LOGIN SCREEN ──
  if (!session) {
    return (
      <>
        <style>{css}</style>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f5f3ef" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 36, width: 360, boxShadow: "0 4px 20px rgba(0,0,0,.1)" }}>
            <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: 24, color: "#c9a84c", marginBottom: 4 }}>Haras Manager</h1>
            <p style={{ color: "#888", fontSize: 13, marginBottom: 24 }}>Haras La Leyenda</p>
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="label">Contraseña</label>
                <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              {loginError && <div style={{ color: "#cc2222", fontSize: 13 }}>{loginError}</div>}
              <button type="submit" className="btn btn-primary" style={{ marginTop: 4 }}>Entrar</button>
            </form>
          </div>
        </div>
      </>
    );
  }

  // ── MAIN LAYOUT ──
  return (
    <>
      <style>{css}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

      <div className="app">
        {/* SIDEBAR */}
        <div className="sidebar">
          <h1>Haras Manager</h1>
          <p>La Leyenda</p>
          {[
            { id: "buscar", icon: "🔍", label: "Buscar caballo" },
            { id: "lotes", icon: "▦", label: "Lotes" },
            { id: "movimientos", icon: "⇄", label: "Movimientos" },
            { id: "lluvia", icon: "🌧", label: "Lluvia" },
            { id: "bajas", icon: "↓", label: "Bajas" },
          ].map(n => (
            <button key={n.id} className={`nav-btn${view === n.id ? " active" : ""}`} onClick={() => { setView(n.id); setBusquedaActiva(""); setSelCaballo(null); }}>
              <span>{n.icon}</span> {n.label}
            </button>
          ))}
          <div className="sidebar-footer">
            <div style={{ color: "#c9a84c", fontSize: 12, marginBottom: 4 }}>● Conectada</div>
            <button onClick={() => setSession(null)} style={{ background: "none", border: "none", color: "#888", fontSize: 12, cursor: "pointer" }}>Salir</button>
          </div>
        </div>

        {/* MAIN */}
        <div className="main">
          {loading && <div className="empty">Cargando datos...</div>}

          {/* ── BUSCAR ── */}
          {!loading && view === "buscar" && (
            <div className="search-hero">
              <h2>¿Qué caballo buscás?</h2>
              <div className="search-bar" style={{position:"relative"}}>
                <div style={{position:"relative",flex:1}}>
                  <input
                    value={busqueda}
                    onChange={e => { setBusqueda(e.target.value); setBusquedaActiva(""); }}
                    onKeyDown={e => { if(e.key==="Enter") buscar(); if(e.key==="Escape") setBusqueda(""); }}
                    placeholder="Nombre del caballo..."
                    autoFocus
                    style={{width:"100%",padding:"16px 20px",fontSize:16,border:"2px solid #c9a84c",borderRight:"none",borderRadius:"12px 0 0 12px",outline:"none",background:"#fff"}}
                  />
                  {busqueda.length>1 && !busquedaActiva && (()=>{
                    const sugs = caballos.filter(c=>c.nombre?.toLowerCase().includes(busqueda.toLowerCase())).slice(0,8);
                    if(!sugs.length) return null;
                    return(
                      <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid #e0ddd8",borderTop:"none",borderRadius:"0 0 12px 12px",boxShadow:"0 4px 12px rgba(0,0,0,.1)",zIndex:100,maxHeight:300,overflowY:"auto"}}>
                        {sugs.map(c=>(
                          <div key={c.id} style={{padding:"10px 16px",cursor:"pointer",borderBottom:"1px solid #f5f3ef",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                            onMouseDown={()=>{ setBusqueda(c.nombre); setBusquedaActiva(c.nombre); setSelCaballo(c); }}>
                            <span style={{fontWeight:600,fontSize:14}}>{c.nombre}</span>
                            <span style={{fontSize:12,color:"#888"}}>{c.categoria} {c.loteId ? "· "+getLoteNombre(c.loteId):""}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <button onClick={buscar} style={{padding:"16px 24px",background:"#c9a84c",color:"#fff",border:"none",borderRadius:"0 12px 12px 0",fontSize:16,cursor:"pointer",fontWeight:600}}>Buscar</button>
              </div>

              {busquedaActiva && (
                <div className="results">
                  {resultados.length === 0 && <div className="empty">No se encontró ningún caballo con ese nombre.</div>}
                  {resultados.map(c => (
                    <div key={c.id} className="card" style={{ cursor: "pointer" }} onClick={() => setSelCaballo(selCaballo?.id === c.id ? null : c)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <h3>{c.nombre}</h3>
                          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                            {c.categoria && <span className="badge">{c.categoria}</span>}
                            {c.loteId && <span className="badge verde">📍 {getLoteNombre(c.loteId)}</span>}
                          </div>
                        </div>
                        <span style={{ color: "#c9a84c", fontSize: 20 }}>{selCaballo?.id === c.id ? "▲" : "▼"}</span>
                      </div>

                      {selCaballo?.id === c.id && (
                        <div style={{ marginTop: 16 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".5px" }}>Historial de movimientos</div>
                          {getMovsCaballo(c.id).length === 0
                            ? <div style={{ color: "#aaa", fontSize: 13 }}>Sin movimientos registrados.</div>
                            : <div className="mov-list">
                              {getMovsCaballo(c.id).map(m => (
                                <div key={m.id} className="mov-item">
                                  <span className="mov-fecha">{fmt(m.fecha)}</span>
                                  <span className="mov-lote">{m.loteOrigen ? getLoteNombre(m.loteOrigen) : "—"}</span>
                                  <span className="mov-arrow">→</span>
                                  <span className="mov-lote">{m.loteDestino ? getLoteNombre(m.loteDestino) : <span className="tag tag-baja">Baja</span>}</span>
                                  {m.motivo && <span className="mov-motivo">{m.motivo}</span>}
                                </div>
                              ))}
                            </div>
                          }
                          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={e => { e.stopPropagation(); setMovForm(f => ({ ...f, caballoId: c.id, loteOrigen: c.loteId || "" })); setModal("mov"); }}>
                            + Registrar movimiento
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── LOTES ── */}
          {!loading && view === "lotes" && (
            <div>
              <div className="section-header">
                <h2>Lotes</h2>
                <span style={{ color: "#888", fontSize: 14 }}>{lotes.length} lotes</span>
              </div>
              <input className="input" value={loteSearch} onChange={e => setLoteSearch(e.target.value)} placeholder="Buscar lote..." style={{ marginBottom: 16, maxWidth: 320 }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {lotesFiltrados.map(l => {
                  const hs = cabsDe(l.id);
                  return (
                    <div key={l.id} className="card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <h3 style={{ fontSize: 18 }}>{l.nombre}</h3>
                        <span style={{ fontFamily: "Playfair Display, serif", fontSize: 22, color: hs.length > 0 ? "#2d5a00" : "#aaa", fontWeight: 700 }}>{hs.length}</span>
                      </div>
                      {l.hectareas && <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>{l.hectareas} ha</div>}
                      {hs.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {hs.slice(0, 5).map(h => (
                            <div key={h.id} style={{ fontSize: 13, color: "#333", display: "flex", justifyContent: "space-between" }}>
                              <span>{h.nombre}</span>
                              {h.categoria && <span style={{ color: "#888", fontSize: 11 }}>{h.categoria}</span>}
                            </div>
                          ))}
                          {hs.length > 5 && <div style={{ fontSize: 12, color: "#aaa" }}>+{hs.length - 5} más</div>}
                        </div>
                      )}
                      {hs.length === 0 && <div style={{ fontSize: 13, color: "#aaa" }}>Sin animales</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── MOVIMIENTOS ── */}
          {!loading && view === "movimientos" && (
            <div>
              <div className="section-header">
                <h2>Movimientos</h2>
                <button className="btn btn-primary" onClick={() => { setMovForm({ fecha: hoy(), loteOrigen: "", loteDestino: "", motivo: "", caballoId: "" }); setModal("mov"); }}>+ Registrar</button>
              </div>
              <div className="card">
                <table className="table">
                  <thead><tr><th>Fecha</th><th>Caballo</th><th>Desde</th><th>Hasta</th><th>Motivo</th></tr></thead>
                  <tbody>
                    {movimientos.slice(0, 100).map(m => (
                      <tr key={m.id}>
                        <td>{fmt(m.fecha)}</td>
                        <td style={{ fontWeight: 600 }}>{m.caballoNombre || "—"}</td>
                        <td>{m.loteOrigen ? getLoteNombre(m.loteOrigen) : "—"}</td>
                        <td>{m.loteDestino ? getLoteNombre(m.loteDestino) : <span className="tag tag-baja">Baja</span>}</td>
                        <td style={{ color: "#888" }}>{m.motivo || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── LLUVIA ── */}
          {!loading && view === "lluvia" && (
            <div>
              <div className="section-header">
                <h2>Lluvia</h2>
                <button className="btn btn-primary" onClick={() => setModal("lluvia")}>+ Registrar</button>
              </div>
              <div className="lluvia-grid">
                <div className="lluvia-card">
                  <div className="num" style={{ color: "#1a5fa8" }}>{lluviaStats.desdeEnero} mm</div>
                  <div className="lbl">Desde 1° de enero</div>
                </div>
                <div className="lluvia-card">
                  <div className="num" style={{ color: "#2d7a2d" }}>{lluviaStats.ultimos21} mm</div>
                  <div className="lbl">Últimos 21 días</div>
                </div>
                <div className="lluvia-card">
                  <div className="num" style={{ color: lluviaStats.sinLluvia > 10 ? "#cc2222" : "#888" }}>{lluviaStats.sinLluvia ?? "—"} días</div>
                  <div className="lbl">Sin lluvia</div>
                </div>
              </div>
              <div className="card">
                <table className="table">
                  <thead><tr><th>Fecha</th><th>mm</th></tr></thead>
                  <tbody>
                    {lluvias.map(l => (
                      <tr key={l.id}>
                        <td>{fmt(l.fecha)}</td>
                        <td style={{ fontWeight: 600 }}>{l.mm} mm</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── BAJAS ── */}
          {!loading && view === "bajas" && (
            <div>
              <div className="section-header"><h2>Bajas</h2></div>
              <div className="card">
                {caballos.filter(c => c.baja).length === 0
                  ? <div className="empty">Sin bajas registradas.</div>
                  : <table className="table">
                    <thead><tr><th>Nombre</th><th>Categoría</th><th>Fecha baja</th></tr></thead>
                    <tbody>
                      {caballos.filter(c => c.baja).map(c => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                          <td>{c.categoria || "—"}</td>
                          <td>{fmt(c.fechaBaja)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL MOVIMIENTO ── */}
      {modal === "mov" && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <h3>Registrar movimiento</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label className="label">Caballo *</label>
                <select className="input" value={movForm.caballoId} onChange={e => {
                  const cab = caballos.find(c => c.id === e.target.value);
                  setMovForm(f => ({ ...f, caballoId: e.target.value, loteOrigen: cab?.loteId || "" }));
                }}>
                  <option value="">— Seleccionar —</option>
                  {[...caballos].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="label">Lote origen</label>
                  <select className="input" value={movForm.loteOrigen} onChange={e => setMovForm(f => ({ ...f, loteOrigen: e.target.value }))}>
                    <option value="">— Ingreso nuevo —</option>
                    {lotes.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Lote destino *</label>
                  <select className="input" value={movForm.loteDestino} onChange={e => setMovForm(f => ({ ...f, loteDestino: e.target.value }))}>
                    <option value="">— Seleccionar —</option>
                    {lotes.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="label">Fecha</label>
                  <input className="input" type="date" value={movForm.fecha} onChange={e => setMovForm(f => ({ ...f, fecha: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="label">Motivo</label>
                  <input className="input" value={movForm.motivo} onChange={e => setMovForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Ej: Rotación" />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveMovimiento} disabled={!movForm.loteDestino || !movForm.caballoId}>✓ Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL LLUVIA ── */}
      {modal === "lluvia" && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <h3>Registrar lluvia</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label className="label">Fecha</label>
                <input className="input" type="date" value={lluviaForm.fecha} onChange={e => setLluviaForm(f => ({ ...f, fecha: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">Milímetros</label>
                <input className="input" type="number" step="0.5" value={lluviaForm.mm} onChange={e => setLluviaForm(f => ({ ...f, mm: e.target.value }))} placeholder="Ej: 25" />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveLluvia} disabled={!lluviaForm.mm}>✓ Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d5a00", color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14, boxShadow: "0 4px 12px rgba(0,0,0,.2)", zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </>
  );
}
