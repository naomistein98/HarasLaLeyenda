import { useState, useMemo, useEffect, useCallback } from "react";

const SUPABASE_URL = "https://xmiygmcczqlvovdwlfov.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtaXlnbWNjenFsdm92ZHdsZm92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjQwOTIsImV4cCI6MjA5NDM0MDA5Mn0._Fp6Ah-pg2Kp9qbemzNZJ7RQj6w34WJRZsWNvVDtYJA";

async function sbFetch(table, method="GET", body=null, filters="") {
  const tryFetch = async (token) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${filters}`, {
      method,
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Prefer": method==="POST"?"return=minimal":"",
      },
      body: body ? JSON.stringify(body) : null,
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  };
  // Try with user token first, fallback to anon key
  const userToken = getStoredToken();
  if(userToken){
    const result = await tryFetch(userToken);
    if(result !== null) return result;
  }
  return await tryFetch(SUPABASE_KEY);
}

// ── Auth helpers ──────────────────────────────────────────────────────────
async function signIn(email, password){
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method:"POST",
    headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({email,password}),
  });
  const data = await res.json();
  if(data.access_token){
    localStorage.setItem("sb_token", data.access_token);
    localStorage.setItem("sb_user", JSON.stringify({email:data.user?.email, id:data.user?.id}));
    return {ok:true, user:data.user};
  }
  return {ok:false, error:data.error_description||"Error al iniciar sesión"};
}

async function signOut(){
  const token = localStorage.getItem("sb_token");
  if(token){
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method:"POST",
      headers:{"apikey":SUPABASE_KEY,"Authorization":`Bearer ${token}`},
    });
  }
  localStorage.removeItem("sb_token");
  localStorage.removeItem("sb_user");
}

function getStoredUser(){
  try{ return JSON.parse(localStorage.getItem("sb_user")); } catch{ return null; }
}
function getStoredToken(){ return localStorage.getItem("sb_token"); }

async function sbSelect(table) {
  const order = table==="lluvias_campo" ? "fecha" : "id";
  return await sbFetch(table, "GET", null, `?select=*&order=${order}`);
}
async function sbUpsert(table, data) { 
  const result = await sbFetch(table, "POST", data, "?on_conflict=id");
  return result !== null ? result : null;
}
async function sbDelete(table, id) { return await sbFetch(table, "DELETE", null, `?id=eq.${id}`); }


const CATEGORIAS = ["Yegua madre", "Yegua vacía", "Potrillos 2025", "Potrillos 2024", "Padrillo"];
const ALIMENTOS  = ["Heno de alfalfa","Heno de pastura","Grano de maíz","Avena","Pellet comercial","Suplemento proteico","Sal mineral"];

// Consumo neto de pasto por categoría (kg MS/día por animal)
const CONSUMO_CATEGORIA = {
  "yegua madre":  10,
  "yegua preñada": 10,
  "con cría":     10,
  "yegua vacía":  5.8,
  "sin cría":     5.8,
  "potrillos":    7.5,
  "potrillo":     7.5,
  "potrancas":    7.5,
  "potranca":     7.5,
  "destete":      8,
  "yegua ama":    10,
};

function getConsumoCategoria(catStr){
  if(!catStr) return null;
  const c = catStr.toLowerCase();
  for(const key of Object.keys(CONSUMO_CATEGORIA)){
    if(c.includes(key)) return CONSUMO_CATEGORIA[key];
  }
  return null;
}

// Get total daily consumption for a lote (named + unnamed animals)
function getConsumoDiarioLote(lid, caballos){
  let total = 0;
  // Named horses
  const named = caballos.filter(c=>c.loteId===lid);
  for(const c of named){
    const cons = getConsumoCategoria(c.categoria);
    if(cons) total += cons;
  }
  // Unnamed animals from STOCK_HISTORIAL
  const hist = STOCK_HISTORIAL[lid];
  if(hist && hist.length>0){
    const namedCount = named.length;
    const lastEntry = [...hist].sort((a,b)=>b.f.localeCompare(a.f)).find(x=>x.tot!==null);
    const totalAnimals = lastEntry ? lastEntry.tot : 0;
    const unnamedCount = Math.max(0, totalAnimals - namedCount);
    if(unnamedCount > 0){
      // Find category from historial description
      const lastCat = lastEntry ? lastEntry.cat : "";
      const cons = getConsumoCategoria(lastCat);
      if(cons) total += cons * unnamedCount;
      else total += 8.5 * unnamedCount; // default
    }
  }
  return total > 0 ? Math.round(total*10)/10 : null;
}

// Tasas de crecimiento kg MS / ha / día por cultivo y mes
const TASAS_CRECIMIENTO = {
  // cultivo keyword → {mes(1-12): tasa}
  "pastura":  {1:10,2:12,3:14,4:13,5:12,6:7,7:6,8:8,9:10,10:12,11:13,12:11},
  "avena":    {1:10,2:12,3:14,4:18,5:20,6:16,7:0,8:0,9:0,10:12,11:18,12:14},
  "raygrass": {1:8,2:10,3:12,4:14,5:15,6:10,7:8,8:8,9:10,10:12,11:13,12:10},
  "rye grass":{1:8,2:10,3:12,4:14,5:15,6:10,7:8,8:8,9:10,10:12,11:13,12:10},
  "moha":     {1:0,2:0,3:0,4:0,5:0,6:0,7:15,8:20,9:18,10:10,11:0,12:0},
  "natural":  {1:8,2:10,3:11,4:12,5:11,6:6,7:5,8:6,9:9,10:11,11:12,12:10},
};

function getEmoji(cultivo){
  if(!cultivo) return "";
  const c = cultivo.toLowerCase();
  if(c.includes("avena")||c.includes("rye")||c.includes("raygrass")||c.includes("moha")||c.includes("trigo")) return "🌽";
  if(c.includes("pastura")||c.includes("natural")||c.includes("trebol")||c.includes("lotus")) return "🌿";
  return "🌱";
}

function getTasaCrecimientoFromObj(tasas, cultivo, mes){
  if(!cultivo||!tasas) return null;
  const c = cultivo.toLowerCase();
  for(const key of Object.keys(tasas)){
    if(c.includes(key)) return tasas[key][mes] || null;
  }
  return null;
}
function getTasaCrecimiento(cultivo, mes){
  return getTasaCrecimientoFromObj(TASAS_CRECIMIENTO, cultivo, mes);
}

function getDisponibilidadDiaria(lote){
  // Get current cultivo from SIEMBRAS (last period)
  const siembras = SIEMBRAS[lote.id];
  if(!siembras || !siembras.length) return null;
  const cultivo = siembras[siembras.length-1].c;
  if(!cultivo || cultivo==="Sin dato") return null;
  const mes = new Date().getMonth()+1;
  const tasa = getTasaCrecimiento(cultivo, mes);
  if(!tasa || !lote.hectareas) return null;
  return {
    kgDia: Math.round(tasa * lote.hectareas * 10)/10,
    tasa,
    cultivo,
    hectareas: lote.hectareas,
  };
}

const PASTURA_COMP = {
  "Pastura Politictica": ["Cebadilla","Pasto ovillo","Rye Grass perenne","Rye Grass anual","Phalaris","Trebol rojo","Trebol blanco","Alfalfa","Lotus corniculatus","Achicoria"],
};

const SIEMBRAS = {
  "A1":    [{p:"Mar 2025",c:"Maiz"},{p:"Sept 2025",c:"Maiz"},{p:"Dic 2025",c:"Maiz"},{p:"Mar 2026",c:"Pastura 1"}],
  "A2":    [{p:"Mar 2025",c:"Rye Grass"},{p:"Sept 2025",c:"Sin dato"},{p:"Dic 2025",c:"Sin dato"},{p:"Mar 2026",c:"Pastura"}],
  "A3":    [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "A4":    [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Maiz"},{p:"Dic 2025",c:"Pastura"},{p:"Mar 2026",c:"Pastura Politictica"}],
  "A5":    [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "A6":    [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "B1":    [{p:"Mar 2025",c:"Rye Grass"},{p:"Sept 2025",c:"Maiz"},{p:"Dic 2025",c:"Sin dato"},{p:"Mar 2026",c:"Pastura 1"}],
  "B1A":   [{p:"Mar 2025",c:"Rye Grass"},{p:"Sept 2025",c:"Maiz"},{p:"Dic 2025",c:"Sin dato"},{p:"Mar 2026",c:"Pastura 2"}],
  "B2":    [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "B3":    [{p:"Mar 2025",c:"Avena"},{p:"Sept 2025",c:"Maiz"},{p:"Dic 2025",c:"Maiz"},{p:"Mar 2026",c:"Avena + trebol voleo"}],
  "B4":    [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "B5":    [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "B6":    [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Maiz"},{p:"Dic 2025",c:"Maiz"},{p:"Mar 2026",c:"Avena + trebol voleo"}],
  "B7":    [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "B8":    [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "B10":   [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "BAJO":  [{p:"Mar 2025",c:"Sin dato"},{p:"Sept 2025",c:"Sin dato"},{p:"Dic 2025",c:"Sin dato"},{p:"Mar 2026",c:"Sin dato"}],
  "F1":    [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "F2":    [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Avena al voleo"}],
  "F3":    [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Avena al voleo"}],
  "F4":    [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "F5":    [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "F6":    [{p:"Mar 2025",c:"Sin dato"},{p:"Sept 2025",c:"Maiz"},{p:"Dic 2025",c:"Maiz"},{p:"Mar 2026",c:"Rye Grass"}],
  "F7":    [{p:"Mar 2025",c:"Natural"},{p:"Sept 2025",c:"Avena"},{p:"Dic 2025",c:"Moha"},{p:"Mar 2026",c:"Avena"}],
  "F8":    [{p:"Mar 2025",c:"Natural"},{p:"Sept 2025",c:"Avena"},{p:"Dic 2025",c:"Moha"},{p:"Mar 2026",c:"Rye Grass"}],
  "F9":    [{p:"Mar 2025",c:"Trigo"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura 2 voleo"}],
  "F10":   [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "F11":   [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Maiz"},{p:"Dic 2025",c:"Sin dato"},{p:"Mar 2026",c:"Pastura 1"}],
  "F12":   [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "F13":   [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "81":    [{p:"Mar 2025",c:"Avena"},{p:"Sept 2025",c:"Avena"},{p:"Dic 2025",c:"Moha"},{p:"Mar 2026",c:"Avena"}],
  "82":    [{p:"Mar 2025",c:"Natural"},{p:"Sept 2025",c:"Maiz"},{p:"Dic 2025",c:"Maiz"},{p:"Mar 2026",c:"Pastura 1"}],
  "82A":   [{p:"Mar 2025",c:"Sin dato"},{p:"Sept 2025",c:"Sin dato"},{p:"Dic 2025",c:"Sin dato"},{p:"Mar 2026",c:"Pastura"}],
  "83":    [{p:"Mar 2025",c:"Sin dato"},{p:"Sept 2025",c:"Sin dato"},{p:"Dic 2025",c:"Pastura"},{p:"Mar 2026",c:"Pastura 1"}],
  "84":    [{p:"Mar 2025",c:"Avena"},{p:"Sept 2025",c:"Avena"},{p:"Dic 2025",c:"Moha"},{p:"Mar 2026",c:"Pastura 1"}],
  "85":    [{p:"Mar 2025",c:"Pastura 2024"},{p:"Sept 2025",c:"Pastura 2024"},{p:"Dic 2025",c:"Pastura 2024"},{p:"Mar 2026",c:"Pastura 2024"}],
  "86":    [{p:"Mar 2025",c:"Sin dato"},{p:"Sept 2025",c:"Rye Grass"},{p:"Dic 2025",c:"Moha"},{p:"Mar 2026",c:"Pastura 1"}],
  "87":    [{p:"Mar 2025",c:"Pastura 2024"},{p:"Sept 2025",c:"Pastura 2024"},{p:"Dic 2025",c:"Pastura 2024"},{p:"Mar 2026",c:"Pastura 2024"}],
  "88":    [{p:"Mar 2025",c:"Pastura 2025"},{p:"Sept 2025",c:"Pastura 2025"},{p:"Dic 2025",c:"Pastura 2025"},{p:"Mar 2026",c:"Pastura 2025"}],
  "S31":   [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "SMEDIO":[{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "SCHICO":[{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Maiz"},{p:"Mar 2026",c:"Pastura"}],
  "SARROYO":[{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "S41":   [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "R2":    [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "R3":    [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
};

const STOCK_HISTORIAL = {
  "S31":    [{f:"2026-04-08",cat:"Potrillos año y medio",ent:5,sal:0,tot:5},{f:"2026-05-13",cat:"Destete + Yegua Ama",ent:null,sal:null,tot:10}],
  "SMEDIO": [{f:"2026-04-08",cat:"Potrillos año y medio",ent:5,sal:0,tot:5},{f:"2026-05-13",cat:"Destete + Yegua Ama",ent:null,sal:null,tot:8}],
  "SARROYO":[{f:"2026-04-08",cat:"Potrillos 9 meses",ent:14,sal:0,tot:14},{f:"2026-05-13",cat:"Destete + Yegua Ama",ent:null,sal:null,tot:6}],
  "S41":    [{f:"2026-04-08",cat:"Sin cría",ent:4,sal:0,tot:4},{f:"2026-05-13",cat:"Destete + Yegua Ama",ent:null,sal:null,tot:10}],
  "R2":     [{f:"2026-04-08",cat:"Sin cría",ent:3,sal:0,tot:3},{f:"2026-04-28",cat:"Sin cría",ent:0,sal:3,tot:0},{f:"2026-04-28",cat:"Con cría",ent:7,sal:0,tot:7},{f:"2026-04-28",cat:"Sin cría",ent:3,sal:0,tot:10},{f:"2026-05-13",cat:"Destete + Yegua Ama",ent:null,sal:null,tot:9}],
  "R3":     [{f:"2026-04-08",cat:"Sin cría",ent:3,sal:0,tot:3},{f:"2026-04-28",cat:"Sin cría",ent:0,sal:3,tot:6},{f:"2026-05-13",cat:"Destete + Yegua Ama",ent:null,sal:null,tot:6}],
  "B7":     [{f:"2026-04-08",cat:"Potrillos 8 meses",ent:14,sal:0,tot:14},{f:"2026-05-13",cat:"Destete + Yegua Ama",ent:null,sal:null,tot:11}],
  "A2":     [{f:"2026-04-08",cat:"—",ent:0,sal:0,tot:0},{f:"2026-04-24",cat:"Sin cría",ent:7,sal:0,tot:7},{f:"2026-05-13",cat:"Sin dato",ent:null,sal:null,tot:4}],
  "A3":     [{f:"2026-04-08",cat:"Sin cría",ent:6,sal:0,tot:6}],
  "A5":     [{f:"2026-04-08",cat:"Sin cría",ent:10,sal:0,tot:10},{f:"2026-04-13",cat:"—",ent:0,sal:1,tot:9},{f:"2026-04-24",cat:"—",ent:0,sal:9,tot:0}],
  "A6":     [{f:"2026-04-08",cat:"Con cría",ent:4,sal:0,tot:4},{f:"2026-04-28",cat:"—",ent:0,sal:4,tot:0}],
  "B2":     [{f:"2026-04-08",cat:"Sin cría",ent:4,sal:0,tot:4},{f:"2026-04-24",cat:"Yeguas",ent:3,sal:0,tot:7},{f:"2026-05-13",cat:"Sin cría",ent:null,sal:null,tot:6}],
  "B4":     [{f:"2026-04-08",cat:"Sin cría",ent:6,sal:0,tot:6}],
  "B5":     [{f:"2026-04-08",cat:"Potrancas 18 meses",ent:5,sal:0,tot:5}],
  "B6":     [{f:"2026-04-24",cat:"Sin cría",ent:7,sal:0,tot:7},{f:"2026-05-13",cat:"—",ent:null,sal:null,tot:21}],
  "B8":     [{f:"2026-04-08",cat:"Con cría",ent:9,sal:0,tot:9},{f:"2026-04-28",cat:"—",ent:0,sal:7,tot:2}],
  "BAJO":   [{f:"2026-04-08",cat:"Sin cría",ent:27,sal:0,tot:27},{f:"2026-04-24",cat:"Sin cría preñadas",ent:0,sal:5,tot:22},{f:"2026-04-24",cat:"Sin cría vacías",ent:3,sal:0,tot:25},{f:"2026-05-13",cat:"—",ent:null,sal:null,tot:0}],
  "F1":     [{f:"2026-04-08",cat:"Potrancas",ent:2,sal:0,tot:2},{f:"2026-05-13",cat:"Potrancas",ent:null,sal:null,tot:6}],
  "F2":     [{f:"2026-04-08",cat:"Sin cría",ent:5,sal:0,tot:5},{f:"2026-05-13",cat:"Sin cría",ent:null,sal:null,tot:3}],
  "F3":     [{f:"2026-04-08",cat:"Con cría",ent:5,sal:0,tot:5},{f:"2026-04-08",cat:"Con cría",ent:0,sal:5,tot:0},{f:"2026-05-13",cat:"Sin cría",ent:null,sal:null,tot:3}],
  "F4":     [{f:"2026-04-08",cat:"Sin cría",ent:6,sal:0,tot:6},{f:"2026-05-13",cat:"—",ent:null,sal:null,tot:0}],
  "F5":     [{f:"2026-04-08",cat:"Sin cría",ent:7,sal:0,tot:7},{f:"2026-04-20",cat:"Nueva yegua al haras",ent:1,sal:0,tot:8,esAlta:true},{f:"2026-04-28",cat:"—",ent:0,sal:9,tot:0},{f:"2026-04-28",cat:"—",ent:1,sal:0,tot:1},{f:"2026-04-29",cat:"Se fue del haras",ent:0,sal:1,tot:0,esBaja:true}],
  "F6":     [{f:"2026-04-28",cat:"Sin cría",ent:9,sal:0,tot:9},{f:"2026-05-13",cat:"—",ent:null,sal:null,tot:7}],
  "F7":     [{f:"2026-04-28",cat:"Sin cría",ent:10,sal:0,tot:10}],
  "F8":     [{f:"2026-04-28",cat:"Preñadas",ent:9,sal:0,tot:9}],
  "F9":     [{f:"2026-04-24",cat:"Sin cría (ingreso)",ent:10,sal:0,tot:10,esAlta:true},{f:"2026-04-28",cat:"—",ent:0,sal:10,tot:0}],
  "F10":    [{f:"2026-04-08",cat:"Potrillos 7 meses",ent:12,sal:0,tot:12},{f:"2026-05-13",cat:"—",ent:null,sal:null,tot:0}],
  "F12":    [{f:"2026-05-13",cat:"Potrancas 18 meses",ent:null,sal:null,tot:3}],
  "F13":    [{f:"2026-04-08",cat:"Potrancas 2 años",ent:3,sal:0,tot:3}],
  "81":     [{f:"2026-04-24",cat:"Sin cría",ent:8,sal:0,tot:8},{f:"2026-05-13",cat:"Sin cría",ent:null,sal:null,tot:10}],
  "85":     [{f:"2026-04-08",cat:"Sin cría",ent:4,sal:0,tot:4},{f:"2026-04-24",cat:"—",ent:0,sal:4,tot:0},{f:"2026-05-13",cat:"Potrillos año y medio",ent:null,sal:null,tot:2}],
  "86":     [{f:"2026-04-08",cat:"Sin cría",ent:4,sal:0,tot:4}],
  "87":     [{f:"2026-04-08",cat:"Sin cría",ent:4,sal:0,tot:4},{f:"2026-05-13",cat:"Potrillos año y medio",ent:null,sal:null,tot:3}],
  "88":     [{f:"2026-04-08",cat:"Sin cría",ent:4,sal:0,tot:4},{f:"2026-04-24",cat:"—",ent:0,sal:4,tot:0},{f:"2026-05-13",cat:"Potrillos año y medio",ent:null,sal:null,tot:3}],
};


// ── Yeguas nodrizas (amas) ──────────────────────────────────────────────────
const amasData = [
  {id:"AMA001",nombre:"Five Fishes",categoria:"Yegua madre",alimentos:[],loteId:"S41",fechaIngreso:"",peso:"",color:""},
  {id:"AMA002",nombre:"Walnut Leave",categoria:"Yegua madre",alimentos:[],loteId:"SARROYO",fechaIngreso:"",peso:"",color:""},
  {id:"AMA003",nombre:"Love Stanza Chance",categoria:"Yegua madre",alimentos:[],loteId:"S31",fechaIngreso:"",peso:"",color:""},
  {id:"AMA004",nombre:"Perfect Melody",categoria:"Yegua madre",alimentos:[],loteId:"SMEDIO",fechaIngreso:"",peso:"",color:""},
  {id:"AMA005",nombre:"Dona Bibi",categoria:"Yegua madre",alimentos:[],loteId:"R3",fechaIngreso:"",peso:"",color:""},
  {id:"AMA006",nombre:"Nearly Mad",categoria:"Yegua madre",alimentos:[],loteId:"R2",fechaIngreso:"",peso:"",color:""},
  {id:"AMA007",nombre:"La Nicanora",categoria:"Yegua madre",alimentos:[],loteId:"BAJO",fechaIngreso:"",peso:"",color:""},
];

// ── Potrillos 2024 ───────────────────────────────────────────────────────────
const potrillos2024 = [
  // F1
  {id:"P24001",nombre:"Mi Mediterranea 24",categoria:"Potrillos 2024",alimentos:[],loteId:"F1",fechaIngreso:"",peso:"",color:""},
  {id:"P24002",nombre:"Ay Ay Ay 24",categoria:"Potrillos 2024",alimentos:[],loteId:"F1",fechaIngreso:"",peso:"",color:""},
  {id:"P24003",nombre:"Tan Bonita 24",categoria:"Potrillos 2024",alimentos:[],loteId:"F1",fechaIngreso:"",peso:"",color:""},
  {id:"P24004",nombre:"Little Goldilocks 24",categoria:"Potrillos 2024",alimentos:[],loteId:"F1",fechaIngreso:"",peso:"",color:""},
  {id:"P24005",nombre:"Steel Fill 24",categoria:"Potrillos 2024",alimentos:[],loteId:"F1",fechaIngreso:"",peso:"",color:""},
  {id:"P24006",nombre:"Life Time Plan 24",categoria:"Potrillos 2024",alimentos:[],loteId:"F1",fechaIngreso:"",peso:"",color:""},
  // F12
  {id:"P24007",nombre:"Oh Que Bella 24",categoria:"Potrillos 2024",alimentos:[],loteId:"F12",fechaIngreso:"",peso:"",color:""},
  {id:"P24008",nombre:"Patrizia 24",categoria:"Potrillos 2024",alimentos:[],loteId:"F12",fechaIngreso:"",peso:"",color:""},
  {id:"P24009",nombre:"Pase Lo Que Pase 24",categoria:"Potrillos 2024",alimentos:[],loteId:"F12",fechaIngreso:"",peso:"",color:""},
  // F13
  {id:"P24010",nombre:"Livia 24",categoria:"Potrillos 2024",alimentos:[],loteId:"F13",fechaIngreso:"",peso:"",color:""},
  {id:"P24011",nombre:"Nena Amada 24",categoria:"Potrillos 2024",alimentos:[],loteId:"F13",fechaIngreso:"",peso:"",color:""},
  {id:"P24012",nombre:"Italina 24",categoria:"Potrillos 2024",alimentos:[],loteId:"F13",fechaIngreso:"",peso:"",color:""},
  // 8.7
  {id:"P24013",nombre:"Miss Oasis 24",categoria:"Potrillos 2024",alimentos:[],loteId:"87",fechaIngreso:"",peso:"",color:""},
  {id:"P24014",nombre:"Dona Bibi 24",categoria:"Potrillos 2024",alimentos:[],loteId:"87",fechaIngreso:"",peso:"",color:""},
  {id:"P24015",nombre:"Destiny Match 24",categoria:"Potrillos 2024",alimentos:[],loteId:"87",fechaIngreso:"",peso:"",color:""},
  // 8.8
  {id:"P24016",nombre:"La Hipnosis 24",categoria:"Potrillos 2024",alimentos:[],loteId:"88",fechaIngreso:"",peso:"",color:""},
  {id:"P24017",nombre:"Nayla Sam 24",categoria:"Potrillos 2024",alimentos:[],loteId:"88",fechaIngreso:"",peso:"",color:""},
  {id:"P24018",nombre:"Fly High 24",categoria:"Potrillos 2024",alimentos:[],loteId:"88",fechaIngreso:"",peso:"",color:""},
  // B8
  {id:"P24019",nombre:"Brangelina 24",categoria:"Potrillos 2024",alimentos:[],loteId:"B8",fechaIngreso:"",peso:"",color:""},
  {id:"P24020",nombre:"Alfa Omega 24",categoria:"Potrillos 2024",alimentos:[],loteId:"B8",fechaIngreso:"",peso:"",color:""},
  {id:"P24021",nombre:"Orpen Look 24",categoria:"Potrillos 2024",alimentos:[],loteId:"B8",fechaIngreso:"",peso:"",color:""},
  // R4
  {id:"P24022",nombre:"Bella Y Romantica 24",categoria:"Potrillos 2024",alimentos:[],loteId:"R4",fechaIngreso:"",peso:"",color:""},
];

// ── Cuida sin categoría ──────────────────────────────────────────────────────
const cuidaSinCat = [
  {id:"C001",nombre:"Quevasenio",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
  {id:"C002",nombre:"Adorable Man",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
  {id:"C003",nombre:"Cielo",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
  {id:"C004",nombre:"Art",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
  {id:"C005",nombre:"Bonafila",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
  {id:"C006",nombre:"Fabulosa Tap",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
  {id:"C007",nombre:"Irrigada",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
  {id:"C008",nombre:"Superultramega",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
  {id:"C009",nombre:"Wallabie",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
  {id:"C010",nombre:"Daria Lo Que Fuera",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
  {id:"C011",nombre:"Bagatele",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
  {id:"C012",nombre:"Sum Power",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
  {id:"C013",nombre:"Pan Zhanle",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
  {id:"C014",nombre:"Sol",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
  {id:"C015",nombre:"Torri",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
  {id:"C016",nombre:"Oh Que Bella",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
  {id:"C017",nombre:"Patrizia",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
  {id:"C018",nombre:"Pase Lo Que Pase",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
  {id:"C019",nombre:"Embujado",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
  {id:"C020",nombre:"Ophus Alpha",categoria:"",alimentos:[],loteId:"BOXCUIDA",fechaIngreso:"",peso:"",color:""},
];

// ── Padrillos ────────────────────────────────────────────────────────────────
const padrillosData = [
  {id:"PAD001",nombre:"Cima De Triomphe",categoria:"Padrillo",alimentos:[],loteId:"PADRILLERA",fechaIngreso:"",peso:"",color:""},
  {id:"PAD002",nombre:"Capensis",categoria:"Padrillo",alimentos:[],loteId:"PADRILLERA",fechaIngreso:"",peso:"",color:""},
  {id:"PAD003",nombre:"Marsalis",categoria:"Padrillo",alimentos:[],loteId:"PADRILLERA",fechaIngreso:"",peso:"",color:""},
  {id:"PAD004",nombre:"Phelps",categoria:"Padrillo",alimentos:[],loteId:"PADRILLERA",fechaIngreso:"",peso:"",color:""},
];

// ── Sin lote ─────────────────────────────────────────────────────────────────
const sinLoteData = [
  {id:"SL001",nombre:"Si Lo Sabe Cante",categoria:"",alimentos:[],loteId:"",fechaIngreso:"",peso:"",color:""},
  {id:"SL002",nombre:"Cocomi",categoria:"",alimentos:[],loteId:"",fechaIngreso:"",peso:"",color:""},
];

// ── Yeguas madres nuevas sin registro previo ─────────────────────────────────
const yeguasMadresNuevas = [
  {id:"YM200",nombre:"Titmus",categoria:"Yegua madre",alimentos:[],loteId:"F5",fechaIngreso:"",peso:"",color:""},

  {id:"YM203",nombre:"Pampa Dream",categoria:"Yegua madre",alimentos:[],loteId:"B3",fechaIngreso:"",peso:"",color:""},
  {id:"YM205",nombre:"American Girls",categoria:"Yegua madre",alimentos:[],loteId:"B3",fechaIngreso:"",peso:"",color:""},
  {id:"YM207",nombre:"Suska",categoria:"Yegua madre",alimentos:[],loteId:"B3",fechaIngreso:"",peso:"",color:""},
  {id:"YM208",nombre:"Same Filly",categoria:"Yegua madre",alimentos:[],loteId:"B3",fechaIngreso:"",peso:"",color:""},
  {id:"YM209",nombre:"Hidden Stormy",categoria:"Yegua madre",alimentos:[],loteId:"B6",fechaIngreso:"",peso:"",color:""},
  {id:"YM211",nombre:"Carta Astral",categoria:"Yegua madre",alimentos:[],loteId:"A6",fechaIngreso:"",peso:"",color:""},
  {id:"YM212",nombre:"Start Queen",categoria:"Yegua madre",alimentos:[],loteId:"GALPUZ",fechaIngreso:"",peso:"",color:""},
  {id:"YM213",nombre:"In Exchange",categoria:"Yegua madre",alimentos:[],loteId:"GALPUZ",fechaIngreso:"",peso:"",color:""},
  {id:"YM214",nombre:"French Fries",categoria:"Yegua madre",alimentos:[],loteId:"BAJO",fechaIngreso:"",peso:"",color:""},
  {id:"YM215",nombre:"Abbuehl",categoria:"Yegua madre",alimentos:[],loteId:"F9",fechaIngreso:"",peso:"",color:""},
];

const initLotes = [
  { id:"A1",   nombre:"A1",    hectareas:2,    ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"A2",   nombre:"A2",    hectareas:3.5,  ultimaDesmalezada:"2026-05-11", notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"A3",   nombre:"A3",    hectareas:2.9,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"A4",   nombre:"A4",    hectareas:1.5,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"A5",   nombre:"A5",    hectareas:2.3,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"A6",   nombre:"A6",    hectareas:2.4,  ultimaDesmalezada:"2026-05-11", notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"B1",   nombre:"B1 A",    hectareas:0.8,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"B1A",  nombre:"B1",  hectareas:2.5,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"B2",   nombre:"B2",    hectareas:3.4,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"B3",   nombre:"B3",    hectareas:3.6,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"B4",   nombre:"B4",    hectareas:3.5,  ultimaDesmalezada:"2026-05-04", notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"B5",   nombre:"B5",    hectareas:5.2,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"B6",   nombre:"B6",    hectareas:3.6,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"B7",   nombre:"B7",    hectareas:12,   ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"B8",   nombre:"B8",    hectareas:3.5,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"B9",   nombre:"B9",    hectareas:7,    ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"B10",  nombre:"B10",   hectareas:7,    ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"BAJO", nombre:"Bajo",  hectareas:16,   ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"F1",   nombre:"F1",    hectareas:4.8,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"F2",   nombre:"F2",    hectareas:3.7,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"F3",   nombre:"F3",    hectareas:3.4,  ultimaDesmalezada:"2026-05-04", notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"F4",   nombre:"F4",    hectareas:2.6,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"F5",   nombre:"F5",    hectareas:6.6,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"F6",   nombre:"F6",    hectareas:3.9,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"F7",   nombre:"F7",    hectareas:2.5,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"F8",   nombre:"F8",    hectareas:3.5,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"F9",   nombre:"F9",    hectareas:7,    ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"F10",  nombre:"F10",   hectareas:8.4,  ultimaDesmalezada:"2026-05-11", notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"F11",  nombre:"F11",   hectareas:1.9,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"F12",  nombre:"F12",   hectareas:3.4,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"F13",  nombre:"F13",   hectareas:4.7,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"81",   nombre:"8.1",   hectareas:4.7,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"82",   nombre:"8.2",   hectareas:2.7,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"82A",  nombre:"8.2 A", hectareas:1,    ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"83",   nombre:"8.3",   hectareas:2,    ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"84",   nombre:"8.4",   hectareas:2.7,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"85",   nombre:"8.5",   hectareas:2,    ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"86",   nombre:"8.6",   hectareas:2.4,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"87",   nombre:"8.7",   hectareas:2.1,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"88",   nombre:"8.8",   hectareas:2.8,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"S31",     nombre:"S31",     hectareas:10,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"SMEDIO",  nombre:"SMedio",  hectareas:9,   ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"SCHICO",  nombre:"SChico",  hectareas:3.5, ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"SARROYO", nombre:"SArroyo", hectareas:9.7, ultimaDesmalezada:"2026-05-04", notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"S41",     nombre:"S41",     hectareas:9.7, ultimaDesmalezada:"2026-05-04", notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"R2",  nombre:"R2",  hectareas:5.1,  ultimaDesmalezada:"2026-05-11", notas:"Desmalezada solo la mitad (mayo 2026)", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"PADRILLERA", nombre:"Padrillera", hectareas:0, ultimaDesmalezada:null, notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"R4", nombre:"R4", hectareas:0, ultimaDesmalezada:null, notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"BOXCUIDA", nombre:"Box / Cuida", hectareas:0, ultimaDesmalezada:null, notas:"Instalaciones internas", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"GALPUZ", nombre:"Corral Galpón de Luz", hectareas:0, ultimaDesmalezada:null, notas:"Instalaciones internas", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"R3",  nombre:"R3",  hectareas:10.3, ultimaDesmalezada:"2026-05-11", notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
];

function cab(id, nombre, loteId, fechaIngreso="", peso="") {
  return { id, nombre, categoria:"Yegua madre", alimentos:[], loteId, fechaIngreso, peso, color:"" };
}

const initCaballos = [
  cab("YM001","Batrana","F6","2026-04-28",0), cab("YM002","Ellijay","F7","2026-04-28",0), cab("YM003","Reina Agatta","F7","2026-04-28",0),
  cab("YM004","Ride Beach","F7","2026-04-28",0), cab("YM005","Santificada","F7","2026-04-28",0), cab("YM006","Joy Tanguera","F7","2026-04-28",0),
  cab("YM007","Endless Dream","F6","2026-04-28",0),
  cab("YM008","Miss Top Girl","BAJA","2026-04-28",0), cab("YM009","Karakoa","F7","2026-04-28",0), cab("YM010","Star Of Belen","BAJA","2026-04-28",0),
  cab("YM011","Taylor Rae","BAJA","2026-04-28",0), cab("YM012","Queen Sarah","BAJA","2026-04-28",0), cab("YM013","Lady Thea","BAJA","2026-04-28",0),
  cab("YM014","Miss Tracy Bond","BAJA","2026-04-28",0), cab("YM015","Tweedia","F7","2026-04-28",0), cab("YM016","Opium Ruler","BAJA","2026-04-28",0),
  cab("YM017","Kirshara","BAJA","2026-04-28",0),
  {id:"YM018",nombre:"Neska Amada 25",categoria:"Potrillos 2025",alimentos:[],loteId:"R3",fechaIngreso:"2025-09-05",peso:262,color:""}, {id:"YM019",nombre:"Archie Fan 25",categoria:"Potrillos 2025",alimentos:[],loteId:"SMEDIO",fechaIngreso:"2025-09-25",peso:265,color:""}, {id:"YM020",nombre:"Pleasant Legends 25",categoria:"Potrillos 2025",alimentos:[],loteId:"S41",fechaIngreso:"2025-09-18",peso:289,color:""},
  {id:"YM021",nombre:"Destiny Match 25",categoria:"Potrillos 2025",alimentos:[],loteId:"R3",fechaIngreso:"2025-09-04",peso:291,color:""}, {id:"YM022",nombre:"Ishka Baja 25",categoria:"Potrillos 2025",alimentos:[],loteId:"SMEDIO",fechaIngreso:"2025-09-19",peso:269,color:""}, {id:"YM023",nombre:"Issolda 25",categoria:"Potrillos 2025",alimentos:[],loteId:"S31",fechaIngreso:"2025-09-14",peso:325,color:""},
  {id:"YM024",nombre:"Bella Y Romantica 25",categoria:"Potrillos 2025",alimentos:[],loteId:"SMEDIO",fechaIngreso:"2025-09-17",peso:280,color:""}, {id:"YM025",nombre:"Shafe 25",categoria:"Potrillos 2025",alimentos:[],loteId:"R2",fechaIngreso:"2025-07-25",peso:304,color:""}, cab("YM026","Summer Fashion","B5","2026-04-28",0),
  cab("YM027","Calma Romana","F9","2026-04-24",0), cab("YM028","Ven A Mi","BAJA","2026-04-24",0), cab("YM029","Abbuehl","F9","2026-04-24",0),
  cab("YM030","Leopolda Magna","F9","2026-04-24",0), cab("YM031","Break Of Day","F9","2026-04-24",0), {id:"YM032",nombre:"Candy Embrujada 25",categoria:"Potrillos 2025",alimentos:[],loteId:"R2",fechaIngreso:"2025-07-17",peso:310,color:""},
  cab("YM033","Wonderful Luck","F9","2026-04-24",0), cab("YM034","Brig","F9","2026-04-24",0), cab("YM035","Fever Tap","F9","2026-04-24",0),
  cab("YM036","Wallapop","F9","2026-04-24",0), {id:"YM037",nombre:"Spuki Inc 25",categoria:"Potrillos 2025",alimentos:[],loteId:"SMEDIO",fechaIngreso:"2025-07-13",peso:320,color:""}, {id:"YM038",nombre:"Summer Rae 25",categoria:"Potrillos 2025",alimentos:[],loteId:"R2",fechaIngreso:"2025-07-30",peso:308,color:""},
  {id:"YM039",nombre:"Hai Plus 25",categoria:"Potrillos 2025",alimentos:[],loteId:"SMEDIO",fechaIngreso:"2025-08-02",peso:275,color:""}, {id:"YM040",nombre:"Sumi Jo 25",categoria:"Potrillos 2025",alimentos:[],loteId:"S41",fechaIngreso:"2025-08-02",peso:301,color:""},
  cab("YM041","Fancy Indy","A6","2026-04-08",0), cab("YM042","Sola Para Ti","A6","2026-04-08",0),
  {id:"YM043",nombre:"Opera Pagliacci 25",categoria:"Potrillos 2025",alimentos:[],loteId:"R2",fechaIngreso:"2025-08-12",peso:302,color:""}, cab("YM044","Island Moon","B2","2026-04-24",0),
  {id:"YM045",nombre:"Titanium Sale 25",categoria:"Potrillos 2025",alimentos:[],loteId:"S31",fechaIngreso:"2025-08-04",peso:320,color:""}, {id:"YM046",nombre:"Nayla Sam 25",categoria:"Potrillos 2025",alimentos:[],loteId:"S31",fechaIngreso:"2025-07-23",peso:324,color:""},
  {id:"YM047",nombre:"Cala Celeste 25",categoria:"Potrillos 2025",alimentos:[],loteId:"S31",fechaIngreso:"2025-08-13",peso:306,color:""}, {id:"YM048",nombre:"Champein 25",categoria:"Potrillos 2025",alimentos:[],loteId:"R2",fechaIngreso:"2025-08-22",peso:310,color:""}, {id:"YM049",nombre:"Lola Chai 25",categoria:"Potrillos 2025",alimentos:[],loteId:"S31",fechaIngreso:"2025-08-23",peso:320,color:""},
  {id:"YM050",nombre:"Carneggie Mellon 25",categoria:"Potrillos 2025",alimentos:[],loteId:"S41",fechaIngreso:"2025-08-12",peso:347,color:""}, cab("YM051","La Unica Dama","B4","",0), cab("YM052","Accionada Cosmica","B4","",0),
  {id:"YM053",nombre:"Thaddea 25",categoria:"Potrillos 2025",alimentos:[],loteId:"S31",fechaIngreso:"2025-08-28",peso:297,color:""}, {id:"YM054",nombre:"Sol Y Sol 25",categoria:"Potrillos 2025",alimentos:[],loteId:"S41",fechaIngreso:"2025-07-23",peso:334,color:""}, {id:"YM055",nombre:"Niquelada Rye 25",categoria:"Potrillos 2025",alimentos:[],loteId:"S31",fechaIngreso:"2025-07-25",peso:314,color:""},
  {id:"YM056",nombre:"Indiana Catcher 25",categoria:"Potrillos 2025",alimentos:[],loteId:"SMEDIO",fechaIngreso:"2025-08-27",peso:290,color:""}, {id:"YM057",nombre:"Summer Violence 25",categoria:"Potrillos 2025",alimentos:[],loteId:"R2",fechaIngreso:"2025-08-06",peso:302,color:""}, {id:"YM058",nombre:"Bally Lee 25",categoria:"Potrillos 2025",alimentos:[],loteId:"S41",fechaIngreso:"2025-08-25",peso:319,color:""},
  cab("YM059","Sandrin","B6","2026-04-24",0), cab("YM060","Carmen Embrujada","B6","2026-04-24",0), cab("YM061","Cheating Girl","B6","2026-04-24",0),
  cab("YM062","Joy Niagara","B6","2026-04-24",0), cab("YM063","Laudemio","B6","2026-04-24",0), cab("YM064","Tapitai","B6","2026-04-24",0),
  cab("YM065","Jazz Banda","B6","2026-04-24",0), cab("YM066","Financial Aid","B6","2026-04-24",0), cab("YM067","Acces Code","B6","2026-04-24",0),
  cab("YM068","Angelic Air","BAJO","2026-04-24",0), cab("YM069","Christofle","BAJO","2026-04-24",0), {id:"YM070",nombre:"Wengen 25",categoria:"Potrillos 2025",alimentos:[],loteId:"R2",fechaIngreso:"2025-08-04",peso:320,color:""},
  {id:"YM071",nombre:"Opera Lilly 25",categoria:"Potrillos 2025",alimentos:[],loteId:"R2",fechaIngreso:"2025-09-29",peso:289,color:""}, {id:"YM072",nombre:"Distar 25",categoria:"Potrillos 2025",alimentos:[],loteId:"BAJO",fechaIngreso:"2025-10-12",peso:283,color:""}, cab("YM073","La Hipnosis","BAJO","2026-04-24",0),
  {id:"YM074",nombre:"Black Ice 25",categoria:"Potrillos 2025",alimentos:[],loteId:"SMEDIO",fechaIngreso:"2025-08-11",peso:314,color:""}, {id:"YM075",nombre:"Orpen Look 25",categoria:"Potrillos 2025",alimentos:[],loteId:"S31",fechaIngreso:"2025-08-25",peso:325,color:""}, {id:"YM076",nombre:"Pura Chispa 25",categoria:"Potrillos 2025",alimentos:[],loteId:"R2",fechaIngreso:"2025-08-03",peso:292,color:""},
  cab("YM077","Luminosa Candy","GALPUZ","2026-04-24",0), cab("YM078","Dona Lea","BAJO","2026-04-24",0), cab("YM079","Chispitas","BAJO","2026-04-24",0),
  cab("YM080","Schweigen","BAJO","2026-04-24",0), cab("YM081","Crackdown","BAJO","2026-04-24",0),
  {id:"YM082",nombre:"Summer Freedom 25",categoria:"Potrillos 2025",alimentos:[],loteId:"R3",fechaIngreso:"2025-10-09",peso:272,color:""}, {id:"YM083",nombre:"Dobrinka 25",categoria:"Potrillos 2025",alimentos:[],loteId:"R3",fechaIngreso:"2025-10-20",peso:233,color:""}, {id:"YM084",nombre:"American Voodoo 25",categoria:"Potrillos 2025",alimentos:[],loteId:"R3",fechaIngreso:"2025-10-25",peso:196,color:""},
  {id:"YM085",nombre:"Miss Lute 25",categoria:"Potrillos 2025",alimentos:[],loteId:"BAJO",fechaIngreso:"2025-11-10",peso:242,color:""}, {id:"YM086",nombre:"Tarotista 25",categoria:"Potrillos 2025",alimentos:[],loteId:"BAJO",fechaIngreso:"2025-10-22",peso:261,color:""}, {id:"YM087",nombre:"Nina Berstein 25",categoria:"Potrillos 2025",alimentos:[],loteId:"SARROYO",fechaIngreso:"2025-10-21",peso:280,color:""},
  cab("YM088","Calshot","B3","",0), {id:"YM089",nombre:"Fisher Pond 25",categoria:"Potrillos 2025",alimentos:[],loteId:"S41",fechaIngreso:"2025-09-19",peso:302,color:""}, cab("YM090","American Girl","B3","",0),
  {id:"YM091",nombre:"Ready N Waiting 25",categoria:"Potrillos 2025",alimentos:[],loteId:"BAJO",fechaIngreso:"2025-10-16",peso:232,color:""}, cab("YM092","Salome Scent","B3","",0), {id:"YM093",nombre:"Chispita 25",categoria:"Potrillos 2025",alimentos:[],loteId:"S41",fechaIngreso:"2025-08-02",peso:305,color:""},
  {id:"YM094",nombre:"Summer Force 25",categoria:"Potrillos 2025",alimentos:[],loteId:"R3",fechaIngreso:"2025-09-29",peso:246,color:""}, {id:"YM095",nombre:"Miss Oasis 25",categoria:"Potrillos 2025",alimentos:[],loteId:"BAJO",fechaIngreso:"2025-10-19",peso:233,color:""}, {id:"YM096",nombre:"Brangelina 25",categoria:"Potrillos 2025",alimentos:[],loteId:"BAJO",fechaIngreso:"2025-10-03",peso:259,color:""},
  {id:"YM097",nombre:"La Busanda 25",categoria:"Potrillos 2025",alimentos:[],loteId:"SARROYO",fechaIngreso:"2025-10-12",peso:238,color:""}, {id:"YM098",nombre:"Dona Bibi 25",categoria:"Potrillos 2025",alimentos:[],loteId:"BAJO",fechaIngreso:"2025-10-20",peso:255,color:""}, {id:"YM099",nombre:"La Nicanora 25",categoria:"Potrillos 2025",alimentos:[],loteId:"S31",fechaIngreso:"2025-07-31",peso:298,color:""},
  {id:"YM100",nombre:"Swiss Candy 25",categoria:"Potrillos 2025",alimentos:[],loteId:"S41",fechaIngreso:"2025-09-02",peso:287,color:""}, {id:"YM101",nombre:"Fantasy In Blue 25",categoria:"Potrillos 2025",alimentos:[],loteId:"S31",fechaIngreso:"2025-09-27",peso:300,color:""}, {id:"YM102",nombre:"Wild Wild Luck 25",categoria:"Potrillos 2025",alimentos:[],loteId:"R3",fechaIngreso:"2025-09-24",peso:259,color:""},
  {id:"YM103",nombre:"Amelie Embrujada 25",categoria:"Potrillos 2025",alimentos:[],loteId:"BAJO",fechaIngreso:"2025-10-23",peso:262,color:""}, {id:"YM104",nombre:"Perfect Melody 25",categoria:"Potrillos 2025",alimentos:[],loteId:"BAJO",fechaIngreso:"2025-10-26",peso:265,color:""}, {id:"YM105",nombre:"Miss Shaun 25",categoria:"Potrillos 2025",alimentos:[],loteId:"BAJO",fechaIngreso:"2025-10-29",peso:223,color:""},
  cab("YM106","Dream Tim","81","2026-04-24",0), cab("YM107","Air Groove","81","2026-04-24",0), cab("YM108","Kalavana","81","2026-04-24",0),
  cab("YM109","Eslovenia","81","2026-04-24",0), cab("YM110","Sonetta","81","2026-04-24",0), cab("YM111","Torgau","81","2026-04-24",0),
  cab("YM112","Carta Ganadora","F5","2026-04-24",0), cab("YM113","Girona Fever","81","2026-04-24",0),
  cab("YM114","Fantasy In Red","81","2026-04-24",0), cab("YM115","Thun","81","2026-04-24",0),
  ...amasData,
  ...potrillos2024,
  ...cuidaSinCat,
  ...padrillosData,
  ...sinLoteData,
  ...yeguasMadresNuevas,
];

const initRotaciones = [];
const initMovimientos = [
  // 21/5 - B3 -> Bajo
  {id:"MOV001",fecha:"2026-05-21",tipo:"individual",caballoId:null,caballoNombre:"Angelic Air",cantidad:1,categoria:"Yegua madre",loteOrigen:"B6",loteDestino:"BAJO",motivo:"Rotación",notas:""},
  {id:"MOV002",fecha:"2026-05-21",tipo:"individual",caballoId:null,caballoNombre:"Chispitas",cantidad:1,categoria:"Yegua madre",loteOrigen:"B6",loteDestino:"BAJO",motivo:"Rotación",notas:""},
  {id:"MOV003",fecha:"2026-05-21",tipo:"individual",caballoId:null,caballoNombre:"Wengen 25",cantidad:1,categoria:"Potrillos 2025",loteOrigen:"R2",loteDestino:"BAJO",motivo:"Rotación",notas:""},
  {id:"MOV004",fecha:"2026-05-21",tipo:"individual",caballoId:null,caballoNombre:"Orpen Look 25",cantidad:1,categoria:"Potrillos 2025",loteOrigen:"S31",loteDestino:"BAJO",motivo:"Rotación",notas:""},
  {id:"MOV005",fecha:"2026-05-21",tipo:"individual",caballoId:null,caballoNombre:"Christofle",cantidad:1,categoria:"Yegua madre",loteOrigen:"B6",loteDestino:"BAJO",motivo:"Rotación",notas:""},
  {id:"MOV006",fecha:"2026-05-21",tipo:"individual",caballoId:null,caballoNombre:"La Hipnosis",cantidad:1,categoria:"Yegua madre",loteOrigen:"B6",loteDestino:"BAJO",motivo:"Rotación",notas:""},
  {id:"MOV007",fecha:"2026-05-21",tipo:"individual",caballoId:null,caballoNombre:"Black Ice 25",cantidad:1,categoria:"Potrillos 2025",loteOrigen:"SMEDIO",loteDestino:"BAJO",motivo:"Rotación",notas:""},
  {id:"MOV008",fecha:"2026-05-21",tipo:"individual",caballoId:null,caballoNombre:"Dona Lea",cantidad:1,categoria:"Yegua madre",loteOrigen:"B6",loteDestino:"BAJO",motivo:"Rotación",notas:""},
  {id:"MOV009",fecha:"2026-05-21",tipo:"individual",caballoId:null,caballoNombre:"Schweigen",cantidad:1,categoria:"Yegua madre",loteOrigen:"B6",loteDestino:"BAJO",motivo:"Rotación",notas:""},
  {id:"MOV010",fecha:"2026-05-21",tipo:"individual",caballoId:null,caballoNombre:"Pura Chispa 25",cantidad:1,categoria:"Potrillos 2025",loteOrigen:"R2",loteDestino:"BAJO",motivo:"Rotación",notas:""},
  {id:"MOV011",fecha:"2026-05-21",tipo:"individual",caballoId:null,caballoNombre:"Crackdown",cantidad:1,categoria:"Yegua madre",loteOrigen:"B6",loteDestino:"BAJO",motivo:"Rotación",notas:""},
  {id:"MOV012",fecha:"2026-05-21",tipo:"individual",caballoId:null,caballoNombre:"Distar 25",cantidad:1,categoria:"Potrillos 2025",loteOrigen:"BAJO",loteDestino:"BAJO",motivo:"Rotación",notas:""},
  {id:"MOV013",fecha:"2026-05-21",tipo:"individual",caballoId:null,caballoNombre:"Miss Lute 25",cantidad:1,categoria:"Potrillos 2025",loteOrigen:"BAJO",loteDestino:"BAJO",motivo:"Rotación",notas:""},
  {id:"MOV014",fecha:"2026-05-21",tipo:"individual",caballoId:null,caballoNombre:"Brangelina 25",cantidad:1,categoria:"Potrillos 2025",loteOrigen:"BAJO",loteDestino:"BAJO",motivo:"Rotación",notas:""},
  {id:"MOV015",fecha:"2026-05-21",tipo:"individual",caballoId:null,caballoNombre:"Pura Firma 25",cantidad:1,categoria:"Potrillos 2025",loteOrigen:"BAJO",loteDestino:"BAJO",motivo:"Rotación",notas:""},
  // 21/5 - Artena ingresa a B6
  {id:"MOV016",fecha:"2026-05-21",tipo:"individual",caballoId:"YM118",caballoNombre:"Artena",cantidad:1,categoria:"Yegua madre",loteOrigen:null,loteDestino:"B6",motivo:"Ingreso al haras",notas:""},
  // 21/5 - F5 -> B3
  {id:"MOV017",fecha:"2026-05-21",tipo:"individual",caballoId:"YM119",caballoNombre:"Jolly Land",cantidad:1,categoria:"Potrillos 2025",loteOrigen:"F5",loteDestino:"B3",motivo:"Rotación",notas:""},
  {id:"MOV018",fecha:"2026-05-21",tipo:"individual",caballoId:"YM120",caballoNombre:"Leading The Group",cantidad:1,categoria:"Potrillos 2025",loteOrigen:"F5",loteDestino:"B3",motivo:"Rotación",notas:""},
  {id:"MOV019",fecha:"2026-05-21",tipo:"individual",caballoId:"YM121",caballoNombre:"Tampa Dream",cantidad:1,categoria:"Potrillos 2025",loteOrigen:"F5",loteDestino:"B3",motivo:"Rotación",notas:""},
  {id:"MOV020",fecha:"2026-05-21",tipo:"individual",caballoId:"YM122",caballoNombre:"Sailing Queen",cantidad:1,categoria:"Potrillos 2025",loteOrigen:"F5",loteDestino:"B3",motivo:"Rotación",notas:""},
  // 21/5 - 8.5 -> Box/Cuida
  {id:"MOV021",fecha:"2026-05-21",tipo:"individual",caballoId:null,caballoNombre:"Tafari",cantidad:1,categoria:"Potrillos 2024",loteOrigen:"85",loteDestino:"BOXCUIDA",motivo:"Ingresa a box en la cuida",notas:""},
  {id:"MOV022",fecha:"2026-05-21",tipo:"individual",caballoId:null,caballoNombre:"Cocorito Sham",cantidad:1,categoria:"Potrillos 2024",loteOrigen:"85",loteDestino:"BOXCUIDA",motivo:"Ingresa a box en la cuida",notas:""},
  // 21/5 - S41 -> SArroyo
  {id:"MOV023",fecha:"2026-05-21",tipo:"individual",caballoId:"YM123",caballoNombre:"Brig 2025",cantidad:1,categoria:"Potrillos 2025",loteOrigen:"S41",loteDestino:"SARROYO",motivo:"Ingreso",notas:""},
  {id:"MOV024",fecha:"2026-05-21",tipo:"individual",caballoId:"YM124",caballoNombre:"Summer Fashion 2025",cantidad:1,categoria:"Potrillos 2025",loteOrigen:"S41",loteDestino:"SARROYO",motivo:"Ingreso",notas:""},
  // 21/5 - SArroyo -> R3
  {id:"MOV025",fecha:"2026-05-21",tipo:"individual",caballoId:"YM125",caballoNombre:"Dobrinka 2025",cantidad:1,categoria:"Potrillos 2025",loteOrigen:"SARROYO",loteDestino:"R3",motivo:"Rotación",notas:""},
  {id:"MOV026",fecha:"2026-05-21",tipo:"individual",caballoId:"YM126",caballoNombre:"American Voodoo 2025",cantidad:1,categoria:"Potrillos 2025",loteOrigen:"SARROYO",loteDestino:"R3",motivo:"Rotación",notas:""},
  {id:"MOV027",fecha:"2026-05-21",tipo:"individual",caballoId:"YM127",caballoNombre:"Summer Freedom 2025",cantidad:1,categoria:"Potrillos 2025",loteOrigen:"SARROYO",loteDestino:"R3",motivo:"Rotación",notas:""},
  // 22/5 - Bajas del haras F7
  {id:"MOV028",fecha:"2026-05-22",tipo:"individual",caballoId:null,caballoNombre:"Opium Ruler",cantidad:1,categoria:"Yegua madre",loteOrigen:"F7",loteDestino:null,motivo:"Baja del haras",notas:""},
  {id:"MOV029",fecha:"2026-05-22",tipo:"individual",caballoId:null,caballoNombre:"Taylor Rae",cantidad:1,categoria:"Yegua madre",loteOrigen:"F7",loteDestino:null,motivo:"Baja del haras",notas:""},
  {id:"MOV030",fecha:"2026-05-22",tipo:"individual",caballoId:null,caballoNombre:"Kirshara",cantidad:1,categoria:"Yegua madre",loteOrigen:"F7",loteDestino:null,motivo:"Baja del haras",notas:""},
  {id:"MOV031",fecha:"2026-05-22",tipo:"individual",caballoId:null,caballoNombre:"Miss Top Girl",cantidad:1,categoria:"Yegua madre",loteOrigen:"F7",loteDestino:null,motivo:"Baja del haras",notas:""},
  {id:"MOV032",fecha:"2026-05-22",tipo:"individual",caballoId:null,caballoNombre:"Queen Sarah",cantidad:1,categoria:"Yegua madre",loteOrigen:"F7",loteDestino:null,motivo:"Baja del haras",notas:""},
  {id:"MOV033",fecha:"2026-05-22",tipo:"individual",caballoId:null,caballoNombre:"Lady Thea",cantidad:1,categoria:"Yegua madre",loteOrigen:"F7",loteDestino:null,motivo:"Baja del haras",notas:""},
  {id:"MOV034",fecha:"2026-05-22",tipo:"individual",caballoId:null,caballoNombre:"Miss Tracy Bond",cantidad:1,categoria:"Yegua madre",loteOrigen:"F7",loteDestino:null,motivo:"Baja del haras",notas:""},
  {id:"MOV035",fecha:"2026-05-22",tipo:"individual",caballoId:null,caballoNombre:"Star Of Belen",cantidad:1,categoria:"Yegua madre",loteOrigen:"F7",loteDestino:null,motivo:"Baja del haras",notas:""},
  // 22/5 - Bajas F9 y F8
  {id:"MOV036",fecha:"2026-05-22",tipo:"individual",caballoId:null,caballoNombre:"Ven A Mi",cantidad:1,categoria:"Yegua madre",loteOrigen:"F9",loteDestino:null,motivo:"Baja del haras",notas:""},
  {id:"MOV037",fecha:"2026-05-22",tipo:"individual",caballoId:null,caballoNombre:"Archie Fan 25",cantidad:1,categoria:"Potrillos 2025",loteOrigen:"F8",loteDestino:null,motivo:"Baja del haras",notas:""},
  // 23/5 - Luminosa Candy -> Galpon de Luz
  {id:"MOV038",fecha:"2026-05-23",tipo:"individual",caballoId:null,caballoNombre:"Luminosa Candy",cantidad:1,categoria:"Yegua madre",loteOrigen:"B6",loteDestino:"GALPUZ",motivo:"Corral en el Galpón de Luz",notas:""},
];


function diasDesde(f){ if(!f)return null; return Math.floor((new Date()-new Date(f))/86400000); }
function fmt(s){ if(!s)return"—"; const[y,m,d]=s.split("-"); return`${d}/${m}/${y}`; }
function calcPresion(n,ha){ if(!ha||n===0)return null; return(n/ha).toFixed(2); }
function estadoPastura(d){
  if(d===null)return{label:"Sin datos",color:"#8b7355"};
  if(d<30)return{label:"Óptima",color:"#4caf6e"};
  if(d<60)return{label:"Buena",color:"#a8c840"};
  if(d<90)return{label:"Regular",color:"#e8a020"};
  return{label:"Requiere atención",color:"#e05050"};
}
function hoy(){ return new Date().toISOString().split("T")[0]; }

const css=`
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;background:#f5f5f0;color:#111111;min-height:100vh;font-weight:500}
:root{--gold:#b07d2a;--goldl:#c8973a;--cream:#1a1410;--bd:#f5f5f0;--bm:#ffffff;--bc:#ffffff;--bb:#e0ddd8}
.app{display:flex;height:100vh;overflow:hidden}
.sidebar{width:260px;flex-shrink:0;background:#ffffff;border-right:1px solid #e0ddd8;display:flex;flex-direction:column;overflow-y:auto;position:fixed;top:0;left:0;height:100vh;z-index:200;transition:transform .3s ease;transform:translateX(-100%)}.sidebar.open{transform:translateX(0)}

.slogo{padding:24px 20px 20px;border-bottom:1px solid var(--bb)}
.slogo h1{font-family:'Playfair Display',serif;font-size:18px;color:var(--gold);line-height:1.2}
.slogo p{font-size:11px;color:#888880;margin-top:3px;letter-spacing:2px;text-transform:uppercase}
.nsec{padding:16px 12px 8px}
.nlbl{font-size:10px;color:#999990;letter-spacing:2px;text-transform:uppercase;padding:0 8px 8px}
.ni{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer;transition:all .15s;font-size:14px;color:#666660;border:none;background:none;width:100%;text-align:left}
.ni:hover{background:var(--bc);color:var(--cream)}
.ni.active{background:rgba(200,151,58,.15);color:var(--gold)}
.ni .ic{font-size:18px;width:20px;text-align:center}
.main{flex:1;overflow-y:auto;background:var(--bd)}
.mh{padding:24px 32px 20px;border-bottom:1px solid var(--bb);display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px}
.mh h2{font-family:'Playfair Display',serif;font-size:26px;color:#111111;font-weight:700}
.mh p{font-size:13px;color:#888880;margin-top:2px}
.cnt{padding:24px 32px}
.card{background:var(--bc);border:1px solid var(--bb);border-radius:12px;padding:20px;transition:border-color .2s}
.card:hover{border-color:#999990}
.ct{font-family:'Playfair Display',serif;font-size:16px;color:#111111;margin-bottom:12px;font-weight:700}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
.ga{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.sv{font-family:'Playfair Display',serif;font-size:32px;color:#8B6000;line-height:1;font-weight:700}
.sl{font-size:12px;color:#888880;margin-top:4px}
.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:500;background:rgba(200,151,58,.15);color:var(--gold);border:1px solid rgba(200,151,58,.3);white-space:nowrap}
.badge.g{background:rgba(76,175,110,.15);color:#4caf6e;border-color:rgba(76,175,110,.3)}
.badge.o{background:rgba(232,160,32,.15);color:#e8a020;border-color:rgba(232,160,32,.3)}
.badge.b{background:rgba(80,140,224,.15);color:#508ce0;border-color:rgba(80,140,224,.3)}
.badge.r{background:rgba(224,80,80,.15);color:#e05050;border-color:rgba(224,80,80,.3)}
.table{width:100%;border-collapse:collapse;font-size:13px}
.table th{text-align:left;padding:8px 12px;color:#444444;font-weight:700;font-size:11px;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #e0ddd8}
.table td{padding:10px 12px;border-bottom:1px solid #e0ddd8;color:#111111;vertical-align:middle;font-weight:600}
.table tr:last-child td{border-bottom:none}
.table tr:hover td{background:rgba(0,0,0,.04)}
.pc{background:var(--bc);border:1px solid var(--bb);border-radius:12px;padding:16px;cursor:pointer;transition:all .2s;position:relative}
.pc:hover{border-color:var(--gold);transform:translateY(-2px)}
.pn{font-family:'Playfair Display',serif;font-size:16px;color:#111111;margin-bottom:4px;font-weight:700}
.sb{height:5px;border-radius:3px;background:var(--bb);overflow:hidden;margin:8px 0}
.sf{height:100%;border-radius:3px;transition:width .4s}
.btn{padding:8px 18px;border-radius:8px;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;transition:all .15s;display:inline-flex;align-items:center;gap:6px}
.bp{background:var(--gold);color:#1a1410}.bp:hover{background:var(--goldl)}
.bg{background:transparent;color:#666660;border:1px solid var(--bb)}.bg:hover{border-color:var(--gold);color:var(--gold)}
.bd2{background:rgba(224,80,80,.15);color:#e05050;border:1px solid rgba(224,80,80,.3)}.bd2:hover{background:rgba(224,80,80,.25)}
.sm{padding:4px 10px;font-size:12px}
.mo{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px}
.md{background:var(--bc);border:1px solid var(--bb);border-radius:16px;padding:28px;width:100%;max-width:580px;max-height:90vh;overflow-y:auto}
.mtit{font-family:'Playfair Display',serif;font-size:20px;color:var(--cream);margin-bottom:20px}
.fg{margin-bottom:16px}
.fl{display:block;font-size:12px;color:#333333;margin-bottom:6px;letter-spacing:.5px;font-weight:700}
.fi{width:100%;padding:10px 12px;border-radius:8px;background:#f9f9f7;border:1px solid #e0ddd8;color:#1a1410;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;transition:border-color .15s}
.fi:focus{border-color:var(--gold)}
.fi option{background:var(--bm)}
.fr{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.cg{display:flex;flex-wrap:wrap;gap:8px}
.ci{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:6px;border:1px solid var(--bb);cursor:pointer;font-size:12px;color:#666660;transition:all .15s;background:var(--bm)}
.ci.ck{border-color:var(--gold);color:var(--gold);background:rgba(200,151,58,.1)}
.ci input{display:none}
.ir{display:flex;justify-content:space-between;align-items:flex-start;padding:9px 0;border-bottom:1px solid rgba(61,46,26,.5);font-size:13px;gap:12px}
.ir:last-child{border-bottom:none}
.ik{color:#555555;white-space:nowrap;font-weight:600}
.iv{color:#111111;font-weight:700;text-align:right}
.hc{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;background:#f9f9f7;border:1px solid #e0ddd8;font-size:13px;margin-bottom:8px;font-weight:600}
.tl{position:relative;padding-left:20px}
.tl::before{content:'';position:absolute;left:6px;top:0;bottom:0;width:2px;background:var(--bb);border-radius:2px}
.tli{position:relative;margin-bottom:16px}
.tld{position:absolute;left:-17px;top:4px;width:10px;height:10px;border-radius:50%;background:var(--gold);border:2px solid var(--bc)}
.tdt{font-size:11px;color:#888880;margin-bottom:2px}
.tbd{font-size:13px;color:var(--cream)}
.tmeta{font-size:12px;color:#666660;margin-top:2px}
.stit{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#333333;margin-bottom:12px;font-weight:800}
.tag{display:inline-block;padding:3px 8px;border-radius:4px;font-size:11px;background:rgba(0,0,0,.07);color:#666660;margin:2px}
.es{text-align:center;padding:36px 24px;color:#999990;font-size:14px}
.fb{display:flex}.fbt{display:flex;justify-content:space-between;align-items:center}.fw{flex-wrap:wrap}
.g2p{gap:8px}.g3p{gap:12px}
.mt2{margin-top:8px}.mt3{margin-top:12px}.mt4{margin-top:16px}
.mb2{margin-bottom:8px}.mb3{margin-bottom:12px}.mb4{margin-bottom:16px}
.tg{color:#8B6000;font-weight:700}.tm{color:#555555;font-weight:600}.ts{font-size:13px}.txs{font-size:11px}
.div{height:1px;background:var(--bb);margin:16px 0}
.li{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(61,46,26,.4);font-size:13px}
.li:last-child{border-bottom:none}
.search-input{width:100%;padding:9px 14px;border-radius:8px;background:#f9f9f7;border:1px solid #e0ddd8;color:#1a1410;font-family:'DM Sans',sans-serif;font-size:13px;outline:none;margin-bottom:16px}
.hamburger{display:flex;align-items:center;justify-content:center;position:fixed;top:12px;left:12px;z-index:201;background:#ffffff;border:1px solid #e0ddd8;border-radius:8px;width:40px;height:40px;cursor:pointer;color:#8B6000;font-size:20px;box-shadow:0 2px 6px rgba(0,0,0,.12);font-weight:700}
.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:199;cursor:pointer}.overlay.open{display:block}
.search-input:focus{border-color:var(--gold)}
`;

// Consumo detallado por categoría — editable desde Info Modificable
const CONSUMO_DETALLE_INIT = {
  "yegua madre": {
    peso:520, pctConsumo:2.5,
    raciones:[
      {nombre:"Heno", cantidad:2, pctMS:80},
      {nombre:"Suplemento", cantidad:2.25, pctMS:90},
    ]
  },
  "yegua vacía": {
    peso:520, pctConsumo:2.5,
    raciones:[
      {nombre:"Heno", cantidad:2, pctMS:80},
      {nombre:"Suplemento", cantidad:2.25, pctMS:90},
    ]
  },
  "potrillos": {
    peso:300, pctConsumo:2.5,
    raciones:[
      {nombre:"Ración", cantidad:1.6, pctMS:90},
      {nombre:"Alfalfa", cantidad:1.25, pctMS:80},
    ]
  },
  "potrancas": {
    peso:300, pctConsumo:2.5,
    raciones:[
      {nombre:"Ración", cantidad:1.6, pctMS:90},
      {nombre:"Alfalfa", cantidad:1.25, pctMS:80},
    ]
  },
};

// ── Movimiento Modal Component ────────────────────────────────────────────
function MovimientoModal({lotes,caballos,CATEGORIAS,saveMovimiento,closeModal,hoy}){
  const [paso,setPaso]=useState(1);
  const [cantidad,setCantidad]=useState("");
  const [categoria,setCategoria]=useState("");
  const [busqueda,setBusqueda]=useState("");
  const [seleccionados,setSeleccionados]=useState([]); // ids
  const [loteOrigen,setLoteOrigen]=useState("");
  const [loteDestino,setLoteDestino]=useState("");
  const [fecha,setFecha]=useState(hoy());
  const [motivo,setMotivo]=useState("");
  const [notas,setNotas]=useState("");

  const cabsFiltrados = caballos.filter(c=>{
    const matchCat = !categoria || c.categoria.toLowerCase()===categoria.toLowerCase();
    const matchBusq = !busqueda || c.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return matchCat && matchBusq;
  });

  function toggleSel(id){
    setSeleccionados(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  }

  // Auto-fill loteOrigen from selected named animals (if all share the same current lote)
  useEffect(()=>{
    if(seleccionados.length>0 && !loteOrigen){
      const lotesActuales = seleccionados.map(id=>caballos.find(c=>c.id===id)?.loteId).filter(Boolean);
      const unicos = [...new Set(lotesActuales)];
      if(unicos.length===1){
        setLoteOrigen(unicos[0]);
      }
    }
  },[seleccionados]);

  function save(){
    if(!loteDestino) return;
    if(!loteOrigen) return; // require explicit confirmation
    const loteOrigenFinal = loteOrigen==="__nuevo__" ? null : loteOrigen;
    if(seleccionados.length>0){
      // Save one movimiento per named animal
      seleccionados.forEach(id=>{
        const cab=caballos.find(c=>c.id===id);
        saveMovimiento({
          fecha, tipo:"individual",
          caballoId:id, caballoNombre:cab?.nombre||"",
          cantidad:1, categoria:cab?.categoria||categoria,
          loteOrigen:loteOrigenFinal, loteDestino,
          motivo, notas,
        });
      });
    } else {
      // Save as group
      saveMovimiento({
        fecha, tipo:"grupo",
        caballoId:null, caballoNombre:null,
        cantidad:parseInt(cantidad)||1, categoria,
        loteOrigen:loteOrigenFinal, loteDestino,
        motivo, notas,
      });
    }
    closeModal();
  }

  const pasoTitle=["","1 · Cantidad y categoría","2 · Seleccionar animales","3 · Lotes y fecha"][paso]||"";

  return(
    <div className="mo" onClick={e=>e.target===e.currentTarget&&closeModal()}>
      <div className="md" style={{maxWidth:540}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <div className="mtit" style={{marginBottom:0,flex:1}}>Registrar movimiento</div>
          <div style={{fontSize:12,color:"#888",fontWeight:600}}>{pasoTitle}</div>
        </div>

        {/* Paso 1: Cantidad y categoría */}
        {paso===1&&(
          <div>
            <div className="fr">
              <div className="fg">
                <label className="fl">Cantidad de animales *</label>
                <input className="fi" type="number" min="1" value={cantidad} onChange={e=>setCantidad(e.target.value)} placeholder="Ej: 6"/>
              </div>
              <div className="fg">
                <label className="fl">Categoría *</label>
                <select className="fi" value={categoria} onChange={e=>setCategoria(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {CATEGORIAS.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="fb g2p" style={{marginTop:20,justifyContent:"flex-end"}}>
              <button className="btn bg" onClick={closeModal}>Cancelar</button>
              <button className="btn bp" disabled={!cantidad||!categoria} onClick={()=>setPaso(2)}>Siguiente →</button>
            </div>
          </div>
        )}

        {/* Paso 2: Seleccionar animales */}
        {paso===2&&(
          <div>
            <div className="fg">
              <label className="fl">Buscar animal</label>
              <input className="fi" value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Escribí el nombre…"/>
            </div>
            <div style={{fontSize:12,color:"#888",marginBottom:8}}>{seleccionados.length} seleccionados de {cantidad} a mover</div>
            <div style={{maxHeight:260,overflowY:"auto",border:"1px solid #e0ddd8",borderRadius:8,padding:8}}>
              {cabsFiltrados.length===0
                ?<div style={{padding:16,color:"#aaa",textAlign:"center"}}>Sin coincidencias</div>
                :cabsFiltrados.map(c=>(
                  <label key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:6,cursor:"pointer",background:seleccionados.includes(c.id)?"#f0f8e8":"transparent",marginBottom:2}}>
                    <input type="checkbox" checked={seleccionados.includes(c.id)} onChange={()=>toggleSel(c.id)}/>
                    <div>
                      <div style={{fontWeight:600,fontSize:13}}>{c.nombre}</div>
                      <div style={{fontSize:11,color:"#888"}}>{c.categoria} · {lotes.find(l=>l.id===c.loteId)?.nombre||"Sin lote"}</div>
                    </div>
                  </label>
                ))
              }
            </div>
            <div className="fb g2p" style={{marginTop:16,justifyContent:"space-between"}}>
              <button className="btn bg" onClick={()=>setPaso(1)}>← Atrás</button>
              <button className="btn bp" disabled={seleccionados.length===0} onClick={()=>setPaso(3)}>Siguiente → ({seleccionados.length})</button>
            </div>
          </div>
        )}

        {/* Paso 3: Lotes y fecha */}
        {paso===3&&(
          <div>
            {seleccionados.length>0 && (()=>{
              const lotesActuales = seleccionados.map(id=>caballos.find(c=>c.id===id)?.loteId).filter(Boolean);
              const unicos = [...new Set(lotesActuales)];
              const nombreLoteActual = unicos.length===1 ? lotes.find(l=>l.id===unicos[0])?.nombre : null;
              if(unicos.length>1){
                return <div style={{background:"#fff3cd",border:"1px solid #e0c040",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#665000"}}>
                  ⚠️ Los animales seleccionados están en lotes distintos actualmente. Confirmá el lote de origen correcto antes de continuar.
                </div>;
              }
              if(nombreLoteActual && loteOrigen===unicos[0]){
                return <div style={{background:"#e8f5e8",border:"1px solid #a0d080",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#2d5a00"}}>
                  ✓ Confirmado: estos animales están actualmente en <strong>{nombreLoteActual}</strong>.
                </div>;
              }
              return null;
            })()}
            <div className="fr">
              <div className="fg">
                <label className="fl">Lote origen *</label>
                <select className="fi" value={loteOrigen} onChange={e=>setLoteOrigen(e.target.value)}>
                  <option value="">— Confirmá el lote de origen —</option>
                  <option value="__nuevo__">Ingreso nuevo al campo (sin origen)</option>
                  {lotes.map(l=><option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </div>
              <div className="fg">
                <label className="fl">Lote destino *</label>
                <select className="fi" value={loteDestino} onChange={e=>setLoteDestino(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {lotes.map(l=><option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="fg">
              <label className="fl">Fecha</label>
              <input className="fi" type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/>
            </div>
            <div className="fg">
              <label className="fl">Motivo</label>
              <input className="fi" value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Ej: Rotación planificada, destete, sobrepastoreo…"/>
            </div>
            <div className="fg">
              <label className="fl">Notas</label>
              <input className="fi" value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Observaciones adicionales"/>
            </div>
            {/* Resumen */}
            <div style={{background:"#f5f9f0",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13}}>
              <div style={{fontWeight:700,marginBottom:4}}>Resumen:</div>
              <div>{seleccionados.length} animales seleccionados</div>
              {loteOrigen&&<div>Desde: <strong>{lotes.find(l=>l.id===loteOrigen)?.nombre}</strong></div>}
              <div>Hacia: <strong>{lotes.find(l=>l.id===loteDestino)?.nombre||"—"}</strong></div>
            </div>
            <div className="fb g2p" style={{justifyContent:"space-between"}}>
              <button className="btn bg" onClick={()=>setPaso(2)}>← Atrás</button>
              <button className="btn bp" disabled={!loteDestino||!loteOrigen} onClick={save}>✓ Registrar movimiento</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Edit Tasa Form Component ──────────────────────────────────────────────
function EditTasaForm({tasasActivas,setTasasActivas,paramCrecimiento,setParamCrecimiento,closeModal,sbUpsert,hoy}){
  const meses = [{n:5,l:"Mayo"},{n:6,l:"Junio"}];
  const cultivos = Object.keys(tasasActivas);
  const [cultivo,setCultivo]=useState(cultivos[0]);
  const [mes,setMes]=useState(5);
  const [valor,setValor]=useState("");
  const [notas,setNotas]=useState("");

  function save(){
    if(!valor) return;
    const nuevaTasa=parseFloat(valor);
    // Update active tasas
    setTasasActivas(prev=>{
      const updated={...prev};
      if(!updated[cultivo]) updated[cultivo]={};
      updated[cultivo][mes]=nuevaTasa;
      return updated;
    });
    // Save to historial
    const newEntry={id:"TC"+Date.now(),cultivo,mes,tasa:nuevaTasa,fecha_cambio:hoy(),notas};
    setParamCrecimiento(prev=>[...prev,newEntry]);
    sbUpsert("parametros_crecimiento",[{id:newEntry.id,cultivo,mes,tasa:nuevaTasa,fecha_cambio:newEntry.fecha_cambio,notas:notas||null}]);
    closeModal();
  }

  return(
    <div>
      <div className="fg"><label className="fl">Cultivo</label>
        <select className="fi" value={cultivo} onChange={e=>setCultivo(e.target.value)}>
          {cultivos.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="fg"><label className="fl">Mes</label>
        <select className="fi" value={mes} onChange={e=>setMes(parseInt(e.target.value))}>
          {meses.map(m=><option key={m.n} value={m.n}>{m.l}</option>)}
        </select>
      </div>
      <div className="fg"><label className="fl">Valor actual</label>
        <div style={{padding:"8px 12px",background:"#f0f8e0",borderRadius:8,fontSize:13,color:"#2d5a00",fontWeight:700,marginBottom:8}}>
          Actual: {tasasActivas[cultivo]?.[mes] || "—"} kg/ha/día
        </div>
        <input className="fi" type="number" step="0.5" value={valor} onChange={e=>setValor(e.target.value)} placeholder="Nuevo valor"/>
      </div>
      <div className="fg"><label className="fl">Notas (motivo del cambio)</label>
        <input className="fi" value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Ej: Revisión nutricionista mayo 2026"/>
      </div>
      <div className="fb g2p" style={{marginTop:20,justifyContent:"flex-end"}}>
        <button className="btn bg" onClick={closeModal}>Cancelar</button>
        <button className="btn bp" onClick={save}>Guardar cambio</button>
      </div>
    </div>
  );
}

// ── Edit Consumo Form Component ────────────────────────────────────────────
function EditConsumoForm({consumosActivos,setConsumosActivos,consumoDetalle,setConsumoDetalle,paramConsumo,setParamConsumo,closeModal,sbUpsert,hoy}){
  const categorias = Object.keys(CONSUMO_DETALLE_INIT);
  const [categoria,setCategoria]=useState(categorias[0]);
  const [notas,setNotas]=useState("");
  const det = consumoDetalle[categoria]||CONSUMO_DETALLE_INIT[categoria]||{peso:500,pctConsumo:2.5,raciones:[]};
  const [peso,setPeso]=useState(det.peso);
  const [pct,setPct]=useState(det.pctConsumo);
  const [raciones,setRaciones]=useState(det.raciones||[]);

  // Recalc when category changes
  const handleCat = (c)=>{
    setCategoria(c);
    const d=consumoDetalle[c]||CONSUMO_DETALLE_INIT[c]||{peso:500,pctConsumo:2.5,raciones:[]};
    setPeso(d.peso); setPct(d.pctConsumo); setRaciones(d.raciones||[]);
  };

  const totalMS = Math.round(peso*pct/100*10)/10;
  const totalRaciones = Math.round(raciones.reduce((s,r)=>s+(r.cantidad*(r.pctMS/100)),0)*10)/10;
  const neto = Math.round((totalMS-totalRaciones)*10)/10;

  function updateRacion(i,field,val){
    setRaciones(prev=>prev.map((r,idx)=>idx===i?{...r,[field]:parseFloat(val)||0}:r));
  }

  function save(){
    const newDet={peso,pctConsumo:pct,raciones};
    setConsumoDetalle(prev=>({...prev,[categoria]:newDet}));
    setConsumosActivos(prev=>({...prev,[categoria]:neto,
      [categoria+" preñada"]:neto, ["con cría"]:neto,
    }));
    const newEntry={id:"CC"+Date.now(),categoria,consumo_neto:neto,fecha_cambio:hoy(),notas};
    setParamConsumo(prev=>[...prev,newEntry]);
    sbUpsert("parametros_consumo",[{id:newEntry.id,categoria,peso_kg:peso,pct_consumo:pct,suplementos:JSON.stringify(raciones),consumo_neto:neto,fecha_cambio:newEntry.fecha_cambio,notas:notas||null}]);
    closeModal();
  }

  return(
    <div>
      <div className="fg"><label className="fl">Categoría</label>
        <select className="fi" value={categoria} onChange={e=>handleCat(e.target.value)}>
          {categorias.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="fr">
        <div className="fg"><label className="fl">Peso vivo (kg)</label>
          <input className="fi" type="number" value={peso} onChange={e=>setPeso(parseFloat(e.target.value)||0)}/>
        </div>
        <div className="fg"><label className="fl">% consumo sobre peso vivo</label>
          <input className="fi" type="number" step="0.1" value={pct} onChange={e=>setPct(parseFloat(e.target.value)||0)}/>
        </div>
      </div>
      <div style={{background:"#f0f8e0",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13}}>
        <strong>Total MS/día:</strong> {totalMS} kg
      </div>
      <div className="stit">Raciones (a descontar)</div>
      {raciones.map((r,i)=>(
        <div key={i} className="fr" style={{marginBottom:8,alignItems:"center"}}>
          <div className="fg" style={{marginBottom:0}}><label className="fl">{r.nombre} (kg/día)</label>
            <input className="fi" type="number" step="0.1" value={r.cantidad} onChange={e=>updateRacion(i,"cantidad",e.target.value)}/>
          </div>
          <div className="fg" style={{marginBottom:0}}><label className="fl">% MS</label>
            <input className="fi" type="number" step="1" value={r.pctMS} onChange={e=>updateRacion(i,"pctMS",e.target.value)}/>
          </div>
        </div>
      ))}
      <div style={{background:neto>=0?"#f0fff4":"#fff0f0",borderRadius:8,padding:"12px 14px",margin:"12px 0",fontSize:14}}>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <span>Total raciones MS:</span><strong>{totalRaciones} kg</strong>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
          <span style={{fontWeight:700}}>Consumo neto de pasto:</span>
          <strong style={{color:neto>=0?"#228822":"#cc2222",fontSize:18}}>{neto} kg MS/día</strong>
        </div>
      </div>
      <div className="fg"><label className="fl">Notas (motivo del cambio)</label>
        <input className="fi" value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Ej: Ajuste nutricionista junio 2026"/>
      </div>
      <div className="fb g2p" style={{marginTop:20,justifyContent:"flex-end"}}>
        <button className="btn bg" onClick={closeModal}>Cancelar</button>
        <button className="btn bp" onClick={save}>Guardar cambio</button>
      </div>
    </div>
  );
}

export default function HarasApp(){
  const [user,setUser]=useState(getStoredUser());
  const [loginEmail,setLoginEmail]=useState("");
  const [loginPassword,setLoginPassword]=useState("");
  const [loginError,setLoginError]=useState("");
  const [loginLoading,setLoginLoading]=useState(false);
  const [view,setView]=useState("dashboard");
  const [toast,setToast]=useState(null); // {msg, type: "ok"|"error"}
  
  function showToast(msg, type="ok"){
    setToast({msg,type});
    setTimeout(()=>setToast(null), 3000);
  }
  const [sidebarOpen,setSidebarOpen]=useState(true);
  const [lotes,setLotes]=useState(initLotes);
  const [caballos,setCaballos]=useState(initCaballos);
  const [rotaciones,setRotaciones]=useState(initRotaciones);
  const [lluviasGlobal,setLluviasGlobal]=useState([]);
  const [paramCrecimiento,setParamCrecimiento]=useState([]); // historial de cambios
  const [paramConsumo,setParamConsumo]=useState([]);
  const [movimientos,setMovimientos]=useState(initMovimientos);
  const [pesoHistorial,setPesoHistorial]=useState([]); // [{id, caballoId, fecha, peso}]
  const [showPesoModal,setShowPesoModal]=useState(null); // caballoId
  const [newPesoVal,setNewPesoVal]=useState("");
  const [filtroCat,setFiltroCat]=useState(""); // filter caballos by categoria
  const [filtroCabNombre,setFiltroCabNombre]=useState(""); // search caballos by nombre
  const [filtroLoteNombre,setFiltroLoteNombre]=useState(""); // search lotes by nombre
  const [filtroLoteTipo,setFiltroLoteTipo]=useState(""); // filter lotes by cultivo type
  const [confirmAction,setConfirmAction]=useState(null); // {mensaje, onConfirm}
  const [showTrasladoLote,setShowTrasladoLote]=useState(null); // loteId origen
  const [showBajaModal,setShowBajaModal]=useState(null); // caballoId
  const [showMoverCaballo,setShowMoverCaballo]=useState(null); // {caballoId, loteOrigen}
  const [newPesoFecha,setNewPesoFecha]=useState("");
  const [consumoDetalle,setConsumoDetalle]=useState(CONSUMO_DETALLE_INIT);         // historial de cambios
  // Current effective values (latest entry per cultivo/mes or categoria)
  const [tasasActivas,setTasasActivas]=useState({...TASAS_CRECIMIENTO});
  const [consumosActivos,setConsumosActivos]=useState({...CONSUMO_CATEGORIA});
  const [undoStack,setUndoStack]=useState([]); // [{description, undo: fn}]

  function pushUndo(description, undoFn){
    setUndoStack(prev=>[{description, undo:undoFn}, ...prev].slice(0,10));
  }
  function doUndo(){
    setUndoStack(prev=>{
      if(!prev.length) return prev;
      prev[0].undo();
      return prev.slice(1);
    });
  }

  // Browser history management
  useEffect(()=>{
    const handlePop = (e)=>{
      if(e.state){
        if(e.state.view) setView(e.state.view);
        if(e.state.selLote !== undefined) setSelLote(e.state.selLote);
      } else {
        setView("dashboard");
        setSelLote(null);
      }
    };
    window.addEventListener("popstate", handlePop);
    // Set initial state
    window.history.replaceState({view:"dashboard", selLote:null}, "");
    return ()=>window.removeEventListener("popstate", handlePop);
  },[]);

  // Push history when view changes
  async function handleLogin(){
    if(!loginEmail||!loginPassword) return;
    setLoginLoading(true); setLoginError("");
    const result = await signIn(loginEmail, loginPassword);
    if(result.ok){
      setUser(getStoredUser());
    } else {
      setLoginError(result.error||"Email o contraseña incorrectos");
    }
    setLoginLoading(false);
  }

  async function handleLogout(){
    await signOut();
    setUser(null);
  }

  function navigate(newView, newLote=null){
    if(newView!==view){ setFiltroCat(""); setFiltroCabNombre(""); setFiltroLoteNombre(""); setFiltroLoteTipo(""); }
    setView(newView);
    setSelLote(newLote);
    window.history.pushState({view:newView, selLote:newLote}, "");
  }

  // Lluvia acumulada desde el 1 de enero
  const lluviaDesdeEnero = useMemo(()=>{
    const inicio = `${new Date().getFullYear()}-01-01`;
    return Math.round(lluviasGlobal
      .filter(l=>l.fecha>=inicio)
      .reduce((s,l)=>s+(parseFloat(l.mm)||0),0)*10)/10;
  },[lluviasGlobal]);

  // Días sin lluvia
  const diasSinLluvia = useMemo(()=>{
    if(!lluviasGlobal.length) return null;
    const ultima = [...lluviasGlobal].sort((a,b)=>b.fecha.localeCompare(a.fecha))[0];
    return ultima ? diasDesde(ultima.fecha) : null;
  },[lluviasGlobal]);

  // Lluvia acumulada en los últimos 21 días
  const lluviaUltimos21 = useMemo(()=>{
    const hace21 = new Date();
    hace21.setDate(hace21.getDate()-21);
    const hace21str = hace21.toISOString().split('T')[0];
    return Math.round(lluviasGlobal
      .filter(l=>l.fecha>=hace21str)
      .reduce((s,l)=>s+(parseFloat(l.mm)||0),0)*10)/10;
  },[lluviasGlobal]);
  const [loading,setLoading]=useState(false);
  const [dbConnected,setDbConnected]=useState(false);

  // Load from Supabase on mount
  useEffect(()=>{
    async function loadData(){
      setLoading(true);
      try {
        const [lotesDb, caballosDb] = await Promise.all([sbSelect("lotes"), sbSelect("caballos")]);
        if(lotesDb && lotesDb.length > 0){
          // Merge DB lotes with initLotes to keep local fields like intervenciones/lluvias
          setLotes(prev => prev.map(l => {
            const db = lotesDb.find(x => x.id === l.id);
            if(!db) return l;
            return { ...l,
              ultimaDesmalezada: db.ultima_desmalezada || l.ultimaDesmalezada,
              notas: db.notas || l.notas,
              ultimaSiembra: db.ultima_siembra || l.ultimaSiembra,
              queSembro: db.que_sembro || l.queSembro,
              fechaVacio: db.fecha_vacio || l.fechaVacio,
              tieneRiego: db.tiene_riego ?? l.tieneRiego,
              riegoDiario: db.riego_diario ?? l.riegoDiario,
              hectareas: db.hectareas ?? l.hectareas,
            };
          }));
          setDbConnected(true);
        }
        // Load parametros
        try {
          const crec = await sbSelect("parametros_crecimiento");
          if(crec && crec.length>0){
            setParamCrecimiento(crec);
            // Apply latest value per cultivo+mes
            const latest={};
            crec.sort((a,b)=>a.fecha_cambio.localeCompare(b.fecha_cambio)).forEach(p=>{
              if(!latest[p.cultivo]) latest[p.cultivo]={};
              latest[p.cultivo][p.mes]=p.tasa;
            });
            setTasasActivas(prev=>{
              const updated={...prev};
              Object.keys(latest).forEach(c=>{
                if(!updated[c]) updated[c]={};
                Object.keys(latest[c]).forEach(m=>{ updated[c][m]=latest[c][m]; });
              });
              return updated;
            });
          }
          const cons = await sbSelect("parametros_consumo");
          if(cons && cons.length>0){
            setParamConsumo(cons);
            const latestCons={};
            cons.sort((a,b)=>a.fecha_cambio.localeCompare(b.fecha_cambio)).forEach(p=>{
              latestCons[p.categoria.toLowerCase()]=p.consumo_neto;
            });
            setConsumosActivos(prev=>({...prev,...latestCons}));
          }
        } catch(e){ console.log("parametros error:", e); }
        try {
          const pesosDb = await sbSelect("peso_historial");
          if(pesosDb && pesosDb.length>0){
            const mappedPesos = pesosDb.map(p=>({id:p.id,caballoId:p.caballo_id,fecha:p.fecha,peso:parseFloat(p.peso)}));
            setPesoHistorial(mappedPesos);
            // Update each caballo with their latest peso
            const latestByHorse = {};
            mappedPesos.forEach(p=>{
              if(!latestByHorse[p.caballoId]||p.fecha>latestByHorse[p.caballoId].fecha||(p.fecha===latestByHorse[p.caballoId].fecha&&p.id>latestByHorse[p.caballoId].id)){
                latestByHorse[p.caballoId]=p;
              }
            });
            setCaballos(prev=>prev.map(c=>{
              if(latestByHorse[c.id]) return {...c,peso:latestByHorse[c.id].peso};
              return c;
            }));
          }
        } catch(e){ console.log("peso_historial error:", e); }
        try {
          const movsDb = await sbSelect("movimientos");
          if(movsDb && movsDb.length>0) setMovimientos(movsDb.map(m=>({...m,loteOrigen:m.lote_origen,loteDestino:m.lote_destino,caballoId:m.caballo_id,caballoNombre:m.caballo_nombre})));
        } catch(e){ console.log("movimientos error:", e); }
        try {
          const intervsDb = await sbSelect("intervenciones");
          if(intervsDb && intervsDb.length>0){
            // Group by lote_id and merge into lotes
            setLotes(prev=>prev.map(l=>{
              const lInterv=intervsDb.filter(i=>i.lote_id===l.id).map(i=>({id:i.id,fecha:i.fecha,tipo:i.tipo,elemento:i.elemento}));
              return lInterv.length>0?{...l,intervenciones:lInterv}:l;
            }));
          }
        } catch(e){ console.log("intervenciones error:", e); }
        try {
          const lluviasDb = await fetch(`${SUPABASE_URL}/rest/v1/lluvias_campo?select=*&order=fecha`, {
            headers:{"apikey":SUPABASE_KEY,"Authorization":`Bearer ${SUPABASE_KEY}`}
          }).then(r=>r.json());
          console.log("lluvias_campo loaded:", lluviasDb);
          if(Array.isArray(lluviasDb) && lluviasDb.length>0){
            setLluviasGlobal(lluviasDb.map(l=>({id:l.id,fecha:l.fecha,mm:parseFloat(l.mm)})));
          }
        } catch(e){ console.log("lluvias_campo error:", e); }
        const desmalezadasDb = await sbSelect("desmalezadas");
        if(desmalezadasDb && desmalezadasDb.length > 0){
          setDesmalezadas(desmalezadasDb.map(d=>({id:d.id,loteId:d.lote_id,fecha:d.fecha,notas:d.notas||""})));
        }
        if(caballosDb && caballosDb.length > 0){
          // DB is source of truth - use it fully
          const dbCaballos = caballosDb.map(c=>({
            id: c.id, nombre: c.nombre, categoria: c.categoria,
            alimentos: c.alimentos || [], loteId: c.lote_id,
            fechaIngreso: c.fecha_ingreso || "", peso: c.peso || "",
            color: c.color || "",
          }));
          // Keep initCaballos entries that aren't in DB yet (seed data)
          setCaballos(prev=>{
            const dbIds = new Set(dbCaballos.map(c=>c.id));
            const seedOnly = prev.filter(c=>!dbIds.has(c.id));
            seedOnly.forEach(c=>{
              sbUpsert("caballos",[{
                id:c.id, nombre:c.nombre, categoria:c.categoria,
                alimentos:c.alimentos, lote_id:c.loteId,
                fecha_ingreso:c.fechaIngreso||null, peso:c.peso||null, color:c.color||null,
              }]);
            });
            // After setting caballos, we'll update with latest peso from historial below
            return [...dbCaballos, ...seedOnly];
          });
          setDbConnected(true);
          // Load peso historial AFTER caballos so we can apply latest peso correctly
          try {
            const pesosDb2 = await sbSelect("peso_historial");
            if(pesosDb2 && pesosDb2.length>0){
              const mappedPesos2 = pesosDb2.map(p=>({id:p.id,caballoId:p.caballo_id,fecha:p.fecha,peso:parseFloat(p.peso)}));
              setPesoHistorial(mappedPesos2);
              const latestByHorse2 = {};
              mappedPesos2.forEach(p=>{
                if(!latestByHorse2[p.caballoId]||p.fecha>latestByHorse2[p.caballoId].fecha||(p.fecha===latestByHorse2[p.caballoId].fecha&&p.id>latestByHorse2[p.caballoId].id)){
                  latestByHorse2[p.caballoId]=p;
                }
              });
              setCaballos(prev=>prev.map(c=>{
                if(latestByHorse2[c.id]) return {...c,peso:latestByHorse2[c.id].peso};
                return c;
              }));
            }
          } catch(e){ console.log("peso reload error:", e); }
        }
      } catch(e) { console.log("DB not available, using local data"); }
      setLoading(false);
    }
    loadData();
  },[]);

  // Save lote to Supabase
  async function saveLoteToDb(lote){
    await sbUpsert("lotes", [{
      id: lote.id, nombre: lote.nombre, hectareas: lote.hectareas||null,
      ultima_desmalezada: lote.ultimaDesmalezada||null,
      notas: lote.notas||null, ultima_siembra: lote.ultimaSiembra||null,
      que_sembro: lote.queSembro||null, fecha_vacio: lote.fechaVacio||null,
      tiene_riego: lote.tieneRiego, riego_diario: lote.riegoDiario||0,
    }]);
  }

  // Save caballo to Supabase
  async function saveCaballoToDb(c){
    const result = await sbUpsert("caballos", [{
      id: c.id, nombre: c.nombre, categoria: c.categoria,
      alimentos: c.alimentos, lote_id: c.loteId,
      fecha_ingreso: c.fechaIngreso||null, peso: c.peso||null, color: c.color||null,
    }]);
    return result;
  }
  const [selLote,setSelLote]=useState(null);
  const [modal,setModal]=useState(null);
  const [editId,setEditId]=useState(null);
  const [intervPid,setIntervPid]=useState(null);
  const [lluviaPid,setLluviaPid]=useState(null);
  const [desmPid,setDesmPid]=useState(null);
  const [showLluviaGlobal,setShowLluviaGlobal]=useState(false);
  const [fLluviaG,setFLluviaG]=useState({fecha:hoy(),mm:""});
  const [desmalezadas,setDesmalezadas]=useState([]);
  const [busqueda,setBusqueda]=useState("");

  const EL={nombre:"",hectareas:"",ultimaDesmalezada:"",notas:"",ultimaSiembra:"",queSembro:"",fechaVacio:"",tieneRiego:false,riegoDiario:""};
  const EC={nombre:"",categoria:"Yegua madre",alimentos:[],loteId:"",peso:"",color:"",fechaIngreso:hoy()};
  const EI={fecha:hoy(),tipo:"Intersiembra",elemento:""};
  const ED={fecha:hoy(),notas:""};
  const ELl={fecha:hoy(),mm:""};
  const ER={caballoId:"",loteOrigen:"",loteDestino:"",fecha:hoy(),motivo:"",diasEnOrigen:""};

  const [fL,setFL]=useState(EL);
  const [fC,setFC]=useState(EC);
  const [fI,setFI]=useState(EI);
  const [fD,setFD]=useState(ED);
  const [fLl,setFLl]=useState(ELl);
  const [fR,setFR]=useState(ER);

  const cabsDe=(lid)=>caballos.filter(c=>c.loteId===lid&&!c.baja);

  // Stock total: last known tot from STOCK_HISTORIAL, else named horses
  const stockTotal=(lid)=>{
    // Always count named horses - STOCK_HISTORIAL kept only as historical reference, doesn't affect this count
    return cabsDe(lid).length;
  };
  // Determine lote status: "pastoreando" | "creciendo" | "descanso" | "vacio"
  const getLoteEstado=(lid)=>{
    const n=stockTotal(lid);
    if(n>0) return {estado:"pastoreando", label:"Pastoreando", color:"#2d7a2d", bg:"#e8f5e8"};
    // Lote is empty — check if there's a recent siembra with no animals after
    const hist=STOCK_HISTORIAL[lid];
    const siembra=SIEMBRAS[lid];
    const ultimaSiembraP = siembra ? siembra[siembra.length-1] : null;
    // Check if there was a siembra more recent than last animal exit
    if(ultimaSiembraP && ultimaSiembraP.c!=="Sin dato"){
      // Get date of last animal movement (if any)
      const lastAnimal=hist?[...hist].filter(x=>x.tot!==undefined).sort((a,b)=>b.f.localeCompare(a.f))[0]:null;
      // Map periodo to approximate date for comparison
      const periodoFechas={"Mar 2025":"2025-03-01","Sept 2025":"2025-09-01","Dic 2025":"2025-12-01","Mar 2026":"2026-03-01"};
      const fechaSiembra=periodoFechas[ultimaSiembraP.p];
      if(fechaSiembra && (!lastAnimal || fechaSiembra>lastAnimal.f)){
        return {estado:"creciendo", label:"Creciendo", color:"#5a8a00", bg:"#f0f8e0"};
      }
    }
    // If there was animal activity but now empty → descanso
    if(hist && hist.some(x=>x.ent>0)){
      return {estado:"descanso", label:"En descanso", color:"#8B6000", bg:"#fff8e0"};
    }
    return {estado:"vacio", label:"Sin actividad", color:"#888", bg:"#f5f5f5"};
  };

  // Get the date when a lote became empty based on STOCK_HISTORIAL
  const getFechaVacio=(lid)=>{
    const hist=STOCK_HISTORIAL[lid];
    if(!hist||!hist.length) return null;
    const sorted=[...hist].sort((a,b)=>a.f.localeCompare(b.f));
    // Find the last entry where tot===0 AND there's no subsequent entry with tot>0
    let fechaVacio=null;
    for(let i=0;i<sorted.length;i++){
      if(sorted[i].tot===0){
        // Check if any later entry has tot>0
        const hasLater=sorted.slice(i+1).some(x=>x.tot>0);
        if(!hasLater) fechaVacio=sorted[i].f;
      }
    }
    return fechaVacio;
  };

  const stockUltimaFecha=(lid)=>{
    const hist=STOCK_HISTORIAL[lid];
    if(!hist||!hist.length) return null;
    const last=[...hist].reverse().find(m=>m.tot!==null&&m.tot!==undefined);
    return last?last.f:null;
  };

  const primerIngreso=(lid)=>{
    // Use most recent movement INTO this lote only
    const movsEntrada=[...movimientos.filter(m=>m.loteDestino===lid)].sort((a,b)=>b.fecha.localeCompare(a.fecha));
    if(movsEntrada.length>0) return movsEntrada[0].fecha;
    // No movement registered - return null to show "?"
    return null;
  };

  const caballosActivos=useMemo(()=>caballos.filter(c=>!c.baja),[caballos]);
  const caballosFiltrados=useMemo(()=>{
    return caballosActivos.filter(c=>{
      const matchCat = !filtroCat || c.categoria===filtroCat;
      const matchNombre = !filtroCabNombre || c.nombre.toLowerCase().includes(filtroCabNombre.toLowerCase());
      return matchCat && matchNombre;
    });
  },[caballosActivos,filtroCat,filtroCabNombre]);

  const lotesFiltrados=useMemo(()=>{
    return lotes.filter(l=>{
      const matchNombre = !filtroLoteNombre && !busqueda || 
        l.nombre.toLowerCase().includes((filtroLoteNombre||busqueda).toLowerCase());
      const siembras = SIEMBRAS[l.id];
      const ultimoCultivo = siembras?siembras[siembras.length-1]?.c?.toLowerCase():"";
      const matchTipo = !filtroLoteTipo || 
        (filtroLoteTipo==="pastura" && (ultimoCultivo.includes("pastura")||ultimoCultivo.includes("natural"))) ||
        (filtroLoteTipo==="verdeo" && (ultimoCultivo.includes("avena")||ultimoCultivo.includes("rye")||ultimoCultivo.includes("raygrass")||ultimoCultivo.includes("moha")));
      return matchNombre && matchTipo;
    });
  },[lotes,busqueda,filtroLoteNombre,filtroLoteTipo]);

  const stats=useMemo(()=>({
    totalCabs:caballos.length,
    totalAnimales:lotes.reduce((sum,l)=>sum+stockTotal(l.id),0),
    demandaTotal:(()=>{
      let total=0;
      lotes.forEach(l=>{
        const c=getConsumoDiarioLote(l.id,caballos);
        if(c) total+=c;
      });
      return Math.round(total*10)/10;
    })(),
    totalLotes:lotes.length,
    ocup:lotes.filter(l=>stockTotal(l.id)>0).length,
    haTotal:lotes.reduce((s,l)=>s+(l.hectareas||0),0).toFixed(1),
    cats:CATEGORIAS.reduce((a,c)=>{a[c]=caballos.filter(x=>x.categoria===c).length;return a},{}),
  }),[caballos,lotes]);

  function closeModal(){setModal(null);setEditId(null);setIntervPid(null);setLluviaPid(null);setDesmPid(null);setFL(EL);setFC(EC);setFI(EI);setFLl(ELl);setFR(ER);setFD(ED);}

  async function saveCab(){
    if(!fC.nombre||!fC.loteId)return;
    const newC = editId ? {...caballos.find(c=>c.id===editId),...fC} : {...fC,id:"C"+Date.now()};
    if(editId) setCaballos(p=>p.map(c=>c.id===editId?newC:c));
    else setCaballos(p=>[...p,newC]);
    try {
      const result = await saveCaballoToDb(newC);
      if(result !== null) showToast(`✓ ${newC.nombre} guardado correctamente`);
      else showToast(`⚠️ ${newC.nombre} se guardó localmente pero puede no sincronizarse`, "error");
    } catch(e) {
      showToast(`✗ Error al guardar ${newC.nombre}`, "error");
    }
    closeModal();
  }
  function delCab(id){
    const cab = caballos.find(c=>c.id===id);
    if(!cab) return;
    setCaballos(p=>p.filter(c=>c.id!==id));
    sbDelete("caballos",id);
    pushUndo(`Borrar caballo "${cab.nombre}"`, ()=>{
      setCaballos(p=>[...p, cab]);
      saveCaballoToDb(cab);
    });
  }
  function editCab(c){setFC({nombre:c.nombre,categoria:c.categoria,alimentos:[...c.alimentos],loteId:c.loteId,peso:c.peso,color:c.color,fechaIngreso:c.fechaIngreso});setEditId(c.id);setModal("cab");}
  function togAlim(a){setFC(f=>({...f,alimentos:f.alimentos.includes(a)?f.alimentos.filter(x=>x!==a):[...f.alimentos,a]}));}

  function saveLote(){
    if(!fL.nombre)return;
    const d={...fL,hectareas:parseFloat(fL.hectareas)||0,riegoDiario:parseFloat(fL.riegoDiario)||0};
    let savedLote;
    if(editId){
      setLotes(p=>p.map(x=>{ if(x.id===editId){savedLote={...x,...d};return savedLote;}return x;}));
    } else {
      savedLote={...d,id:"L"+Date.now(),intervenciones:[],lluvias:[]};
      setLotes(p=>[...p,savedLote]);
    }
    setTimeout(()=>{ if(savedLote) saveLoteToDb(savedLote); },0);
    closeModal();
  }
  function editLote(l){setFL({nombre:l.nombre,hectareas:l.hectareas,ultimaDesmalezada:l.ultimaDesmalezada||"",notas:l.notas||"",ultimaSiembra:l.ultimaSiembra||"",queSembro:l.queSembro||"",fechaVacio:l.fechaVacio||"",tieneRiego:!!l.tieneRiego,riegoDiario:l.riegoDiario||""});setEditId(l.id);setModal("lote");}
  function desmHoy(lid){
    const fecha=hoy();
    setLotes(p=>p.map(x=>{
      if(x.id===lid){ const updated={...x,ultimaDesmalezada:fecha}; saveLoteToDb(updated); return updated; }
      return x;
    }));
    const newD={id:"D"+Date.now(),loteId:lid,fecha,notas:""};
    setDesmalezadas(p=>[...p,newD]);
    sbUpsert("desmalezadas",[{id:newD.id,lote_id:lid,fecha,notas:""}]);
  }

  function saveLluviaGlobal(){
    if(!fLluviaG.mm) return;
    const nueva = {id:"LG"+Date.now(), fecha:fLluviaG.fecha, mm:parseFloat(fLluviaG.mm)};
    setLluviasGlobal(p=>[...p, nueva]);
    fetch(`${SUPABASE_URL}/rest/v1/lluvias_campo?on_conflict=id`, {
      method:"POST",
      headers:{"apikey":SUPABASE_KEY,"Authorization":`Bearer ${SUPABASE_KEY}`,"Content-Type":"application/json","Prefer":"return=minimal"},
      body:JSON.stringify([{id:nueva.id,fecha:nueva.fecha,mm:nueva.mm}])
    });
    setFLluviaG({fecha:hoy(),mm:""});
    setShowLluviaGlobal(false);
  }
  function delLluviaGlobal(id){
    const lluvia = lluviasGlobal.find(l=>l.id===id);
    if(!lluvia) return;
    setLluviasGlobal(p=>p.filter(l=>l.id!==id));
    sbDelete("lluvias_campo",id);
    pushUndo(`Borrar lluvia ${lluvia.mm}mm del ${fmt(lluvia.fecha)}`, ()=>{
      setLluviasGlobal(p=>[...p, lluvia]);
      sbUpsert("lluvias_campo",[{id:lluvia.id, fecha:lluvia.fecha, mm:lluvia.mm}]);
    });
  }

  function addPeso(caballoId, peso, fecha){
    const cab = caballos.find(c=>c.id===caballoId);
    const toSave = [];

    // If caballo has existing peso but it's not yet in historial, save it first
    if(cab && cab.peso){
      const yaEnHistorial = pesoHistorial.some(p=>p.caballoId===caballoId && parseFloat(p.peso)===parseFloat(cab.peso));
      if(!yaEnHistorial){
        const pesoViejo = {id:"PH"+Date.now()+"_v", caballoId, fecha:cab.fechaIngreso||fecha, peso:parseFloat(cab.peso)};
        setPesoHistorial(prev=>[...prev, pesoViejo]);
        toSave.push({id:pesoViejo.id, caballo_id:caballoId, fecha:pesoViejo.fecha, peso:pesoViejo.peso});
      }
    }

    // Add new peso
    const newP = {id:"PH"+(Date.now()+1), caballoId, fecha, peso:parseFloat(peso)};
    setPesoHistorial(prev=>[...prev, newP]);
    toSave.push({id:newP.id, caballo_id:caballoId, fecha, peso:parseFloat(peso)});

    // Update caballo peso to latest
    setCaballos(prev=>prev.map(c=>c.id===caballoId?{...c,peso:parseFloat(peso)}:c));

    // Save all to DB
    if(toSave.length>0) sbUpsert("peso_historial", toSave);
    if(cab) saveCaballoToDb({...cab, peso:parseFloat(peso)});
    showToast("✓ Peso registrado");
  }

  function delMovimiento(id){
    const mov=movimientos.find(m=>m.id===id);
    if(!mov) return;
    setMovimientos(prev=>prev.filter(m=>m.id!==id));
    sbDelete("movimientos",id);
    pushUndo(`Borrar movimiento de ${mov.caballoNombre||mov.categoria||"animales"}`, ()=>{
      setMovimientos(prev=>[...prev,mov]);
      sbUpsert("movimientos",[{
        id:mov.id, fecha:mov.fecha, tipo:mov.tipo,
        caballo_id:mov.caballoId||null, caballo_nombre:mov.caballoNombre||null,
        cantidad:mov.cantidad||null, categoria:mov.categoria||null,
        lote_origen:mov.loteOrigen||null, lote_destino:mov.loteDestino||null,
        motivo:mov.motivo||null, notas:mov.notas||null,
      }]);
    });
  }

  function saveMovimiento(mov){
    const newMov={...mov, id:"MOV"+Date.now()+"_"+Math.random().toString(36).slice(2,7)};
    setMovimientos(prev=>[...prev,newMov]);
    // Update caballos loteId if named animal - use functional update to avoid stale closures
    if(newMov.caballoId){
      setCaballos(prev=>{
        const updated = prev.map(c=>c.id===newMov.caballoId?{...c,loteId:newMov.loteDestino,fechaIngreso:newMov.fecha}:c);
        const cabActualizado = updated.find(c=>c.id===newMov.caballoId);
        if(cabActualizado) saveCaballoToDb(cabActualizado);
        return updated;
      });
    }
    sbUpsert("movimientos",[{
      id:newMov.id, fecha:newMov.fecha, tipo:newMov.tipo,
      caballo_id:newMov.caballoId||null, caballo_nombre:newMov.caballoNombre||null,
      cantidad:newMov.cantidad||null, categoria:newMov.categoria||null,
      lote_origen:newMov.loteOrigen||null, lote_destino:newMov.loteDestino||null,
      motivo:newMov.motivo||null, notas:newMov.notas||null,
    }]);
  }

  function darDeBaja(caballoId, fecha, motivo){
    const cab=caballos.find(c=>c.id===caballoId);
    if(!cab) return;
    // Save movement as baja
    saveMovimiento({
      fecha, tipo:"baja",
      caballoId:cab.id, caballoNombre:cab.nombre,
      cantidad:1, categoria:cab.categoria,
      loteOrigen:cab.loteId||null, loteDestino:null,
      motivo:motivo||"Baja del haras", notas:"",
    });
    // Mark caballo as baja
    setCaballos(prev=>prev.map(c=>c.id===caballoId?{...c,loteId:null,baja:true,fechaBaja:fecha}:c));
    saveCaballoToDb({...cab,lote_id:null,baja:true,fecha_baja:fecha});
    // Update in Supabase
    sbUpsert("caballos",[{id:caballoId,lote_id:null,baja:true,fecha_baja:fecha}]);
    showToast(`✓ ${cab.nombre} dado de baja`);
  }

  function trasladarLoteCompleto(loteOrigenId, loteDestinoId, fecha, motivo){
    const animales = cabsDe(loteOrigenId);
    animales.forEach(c=>{
      saveMovimiento({
        fecha, tipo:"individual",
        caballoId:c.id, caballoNombre:c.nombre,
        cantidad:1, categoria:c.categoria,
        loteOrigen:loteOrigenId, loteDestino:loteDestinoId,
        motivo:motivo||"Traslado completo del lote", notas:"",
      });
    });
    showToast(`✓ ${animales.length} animales trasladados`);
  }

  function moverCaballoIndividual(caballoId, loteOrigenId, loteDestinoId, fecha, motivo){
    const cab = caballos.find(c=>c.id===caballoId);
    if(!cab) return;
    saveMovimiento({
      fecha, tipo:"individual",
      caballoId:cab.id, caballoNombre:cab.nombre,
      cantidad:1, categoria:cab.categoria,
      loteOrigen:loteOrigenId, loteDestino:loteDestinoId,
      motivo:motivo||"Rotación", notas:"",
    });
    showToast(`✓ ${cab.nombre} movido`);
  }

  function saveDesm(){
    if(!desmPid)return;
    const newD={id:"D"+Date.now(),loteId:desmPid,fecha:fD.fecha,notas:fD.notas};
    setDesmalezadas(p=>[...p,newD]);
    setLotes(p=>p.map(x=>{
      if(x.id===desmPid){ const updated={...x,ultimaDesmalezada:fD.fecha}; saveLoteToDb(updated); return updated; }
      return x;
    }));
    sbUpsert("desmalezadas",[{id:newD.id,lote_id:desmPid,fecha:fD.fecha,notas:fD.notas||null}]);
    closeModal();
  }
  function delDesm(id){
    const desm = desmalezadas.find(d=>d.id===id);
    if(!desm) return;
    setDesmalezadas(p=>p.filter(d=>d.id!==id));
    sbDelete("desmalezadas",id);
    pushUndo(`Borrar desmalezada del ${fmt(desm.fecha)}`, ()=>{
      setDesmalezadas(p=>[...p, desm]);
      sbUpsert("desmalezadas",[{id:desm.id, lote_id:desm.loteId, fecha:desm.fecha, notas:desm.notas||null}]);
    });
  }

  function saveInterv(){
    if(!fI.elemento||!intervPid)return;
    const newI={...fI,id:"I"+Date.now()};
    setLotes(p=>p.map(x=>x.id===intervPid?{...x,intervenciones:[...x.intervenciones,newI]}:x));
    sbUpsert("intervenciones",[{id:newI.id,lote_id:intervPid,fecha:newI.fecha,tipo:newI.tipo,elemento:newI.elemento}]);
    closeModal();
  }
  function delInterv(lid,iid){
    const lote = lotes.find(x=>x.id===lid);
    const interv = lote?.intervenciones?.find(i=>i.id===iid);
    setLotes(p=>p.map(x=>x.id===lid?{...x,intervenciones:x.intervenciones.filter(i=>i.id!==iid)}:x));
    sbDelete("intervenciones",iid);
    pushUndo(`Borrar intervención "${interv?.elemento||""}"`, ()=>{
      if(interv){
        setLotes(p=>p.map(x=>x.id===lid?{...x,intervenciones:[...x.intervenciones,interv]}:x));
        sbUpsert("intervenciones",[{id:interv.id,lote_id:lid,fecha:interv.fecha,tipo:interv.tipo,elemento:interv.elemento}]);
      }
    });
  }

  function saveLluvia(){
    if(!fLl.mm||!lluviaPid)return;
    setLotes(p=>p.map(x=>x.id===lluviaPid?{...x,lluvias:[...x.lluvias,{...fLl,mm:parseFloat(fLl.mm),id:"Ll"+Date.now()}]}:x));
    closeModal();
  }
  function delLluvia(lid,llid){setLotes(p=>p.map(x=>x.id===lid?{...x,lluvias:x.lluvias.filter(l=>l.id!==llid)}:x));}

  function saveRot(){
    if(!fR.caballoId||!fR.loteDestino)return;
    setRotaciones(p=>[...p,{...fR,diasEnOrigen:parseInt(fR.diasEnOrigen)||0,id:"R"+Date.now()}]);
    setCaballos(p=>p.map(c=>c.id===fR.caballoId?{...c,loteId:fR.loteDestino,fechaIngreso:fR.fecha}:c));
    closeModal();
  }

  const nav=[{id:"dashboard",ic:"◈",lb:"Dashboard"},{id:"lotes",ic:"⬡",lb:"Lotes"},{id:"caballos",ic:"⚘",lb:"Caballos"},{id:"rotaciones",ic:"↻",lb:"Rot. Cultivos"},{id:"parametros",ic:"⚙",lb:"Info Modificable"},{id:"movimientos",ic:"⇄",lb:"Movimientos"}];

  if(!user) return(
    <div style={{minHeight:"100vh",background:"#f5f5f0",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <style>{css}</style>
      <div style={{background:"#fff",borderRadius:16,padding:40,width:"100%",maxWidth:380,boxShadow:"0 4px 24px rgba(0,0,0,.1)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#8B6000",fontWeight:700,marginBottom:4}}>Haras Manager</div>
          <div style={{fontSize:13,color:"#888"}}>Ingresá con tu cuenta</div>
        </div>
        <div className="fg"><label className="fl">Email</label>
          <input className="fi" type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="tu@email.com"/>
        </div>
        <div className="fg"><label className="fl">Contraseña</label>
          <input className="fi" type="password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="••••••••"
            onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
        </div>
        {loginError&&<div style={{color:"#cc2222",fontSize:13,marginBottom:12,fontWeight:600}}>{loginError}</div>}
        <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"12px",fontSize:15}}
          disabled={loginLoading} onClick={handleLogin}>
          {loginLoading?"Ingresando…":"Ingresar"}
        </button>
      </div>
    </div>
  );

  return(
    <>
      <style>{css}</style>
      <div className="app">
        <button className="hamburger" onClick={()=>setSidebarOpen(o=>!o)}>{sidebarOpen?"✕":"☰"}</button>
        {toast&&(
          <div style={{position:"fixed",bottom:80,right:20,zIndex:400,background:toast.type==="ok"?"#228822":"#cc2222",color:"#fff",borderRadius:10,padding:"12px 20px",fontSize:13,fontWeight:700,boxShadow:"0 4px 12px rgba(0,0,0,.2)",maxWidth:300}}>
            {toast.msg}
          </div>
        )}
        {undoStack.length>0&&(
          <button onClick={doUndo} style={{position:"fixed",bottom:20,right:20,zIndex:300,background:"#8B6000",color:"#fff",border:"none",borderRadius:12,padding:"14px 24px",fontSize:15,fontWeight:800,cursor:"pointer",boxShadow:"0 4px 16px rgba(0,0,0,.3)",display:"flex",alignItems:"center",gap:10}}>
            ↩ Deshacer
            <span style={{fontSize:12,opacity:.85,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>"{undoStack[0]?.description}"</span>
          </button>
        )}
        <div className={`overlay ${sidebarOpen?"open":""}`} onClick={()=>setSidebarOpen(false)}/>
        <aside className={`sidebar ${sidebarOpen?"open":""}`}>
          <div className="slogo"><h1>Haras<br/>Manager</h1><p>Sistema de gestión</p></div>
          <div className="nsec">
            <div className="nlbl">Menú</div>
            {nav.map(n=>(
              <button key={n.id} className={`ni ${view===n.id?"active":""}`} onClick={()=>{navigate(n.id,null);setBusqueda("");setSidebarOpen(false);}}>
                <span className="ic">{n.ic}</span>{n.lb}
              </button>
            ))}
          </div>
          <div className="nsec" style={{marginTop:"auto",borderTop:"1px solid var(--bb)",paddingTop:16}}>
            <div className="nlbl">Resumen</div>
            <div style={{padding:"8px 12px 4px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,color:dbConnected?"#4caf6e":"#7a6a50"}}>{dbConnected?"● Conectada":"○ Local"}</span>
            <button onClick={handleLogout} style={{fontSize:11,color:"#cc2222",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Salir</button>
          </div>
          <div style={{padding:"2px 12px 8px",fontSize:11,color:"#888"}}>{user?.email}</div>
          <div style={{padding:"0px 12px 4px",fontSize:11,color:dbConnected?"#4caf6e":"#7a6a50"}}>
            {dbConnected?"● Base de datos conectada":"○ Datos locales"}
          </div>
          <div style={{padding:"4px 12px",fontSize:13,color:"#a89070"}}>
              <div style={{marginBottom:4}}><span className="tg" style={{fontFamily:"Playfair Display,serif",fontSize:20}}>{stats.totalAnimales}</span> animales</div>
              <div style={{marginBottom:4}}><span className="tg" style={{fontFamily:"Playfair Display,serif",fontSize:20}}>{stats.totalLotes}</span> lotes</div>
              <div><span className="tg" style={{fontFamily:"Playfair Display,serif",fontSize:20}}>{stats.haTotal}</span> <span style={{fontSize:12}}>ha</span></div>
            </div>
          </div>
        </aside>

        <main className="main">

          {/* DASHBOARD */}
          {view==="dashboard"&&(
            <>
              <div className="mh"><button className="hamburger" onClick={()=>setSidebarOpen(o=>!o)}>{sidebarOpen?"✕":"☰"}</button><div><h2>Panel general</h2><p>Vista consolidada del haras</p></div></div>
              <div className="cnt">
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:16,marginBottom:20}}>
                  {[{v:stats.totalAnimales,l:"Animales en campo"},{v:stats.totalLotes,l:"Lotes totales"},{v:`${stats.haTotal} ha`,l:"Superficie total"},{v:`${stats.demandaTotal} kg`,l:"Demanda MS/día total"}].map((s,i)=>(
                    <div key={i} className="card"><div className="sv">{s.v}</div><div className="sl">{s.l}</div></div>
                  ))}
                </div>
                {/* Lluvia global */}
                <div className="card" style={{marginBottom:20}}>
                  <div className="fbt mb3">
                    <div className="ct" style={{marginBottom:0}}>🌧 Lluvia del campo</div>
                    <button className="btn bp sm" onClick={()=>setShowLluviaGlobal(true)}>+ Registrar lluvia</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
                    <div style={{background:"#f0f7ff",borderRadius:10,padding:"14px 18px",border:"1px solid #c8e0ff"}}>
                      <div style={{fontSize:11,color:"#3366aa",letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:4}}>Desde el 1° de enero</div>
                      <div style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a4080",fontWeight:700}}>{lluviaDesdeEnero} <span style={{fontSize:14}}>mm</span></div>
                    </div>
                    <div style={{background:"#f0f7ff",borderRadius:10,padding:"14px 18px",border:"1px solid #c8e0ff"}}>
                      <div style={{fontSize:11,color:"#3366aa",letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:4}}>Últimos 21 días</div>
                      <div style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a4080",fontWeight:700}}>{lluviaUltimos21} <span style={{fontSize:14}}>mm</span></div>
                    </div>
                    <div style={{background:diasSinLluvia===null?"#f5f5f0":diasSinLluvia>14?"#fff0f0":diasSinLluvia>7?"#fff8f0":"#f0fff4",borderRadius:10,padding:"14px 18px",border:`1px solid ${diasSinLluvia===null?"#ddd":diasSinLluvia>14?"#ffb0b0":diasSinLluvia>7?"#ffd0a0":"#a0e0b0"}`}}>
                      <div style={{fontSize:11,color:diasSinLluvia===null?"#888":diasSinLluvia>14?"#aa2222":diasSinLluvia>7?"#aa6600":"#226622",letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:4}}>Días sin lluvia</div>
                      <div style={{fontFamily:"Playfair Display,serif",fontSize:28,color:diasSinLluvia===null?"#888":diasSinLluvia>14?"#cc2222":diasSinLluvia>7?"#cc7700":"#228822",fontWeight:700}}>{diasSinLluvia===null?"—":diasSinLluvia} <span style={{fontSize:14}}>{diasSinLluvia!==null?"días":""}</span></div>
                    </div>
                  </div>
                  {lluviasGlobal.length>0&&(
                    <div>
                      <div style={{fontSize:11,color:"#888",letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:8}}>Registros recientes</div>
                      <table className="table">
                        <thead><tr><th>Fecha</th><th>mm</th><th></th></tr></thead>
                        <tbody>
                          {[...lluviasGlobal].sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,8).map(l=>(
                            <tr key={l.id}>
                              <td>{fmt(l.fecha)}</td>
                              <td><strong>{l.mm} mm</strong></td>
                              <td><button className="btn bd2 sm" style={{padding:"2px 7px"}} onClick={()=>delLluviaGlobal(l.id)}>✕</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="card">
                  <div className="fbt mb3">
                    <div className="ct" style={{marginBottom:0}}>Estado de lotes</div>
                    <button className="btn bg sm" onClick={()=>navigate("lotes",null)}>Ver todos →</button>
                  </div>
                  <table className="table">
                    <thead><tr><th>Lote</th><th>Ha</th><th>Animales</th><th>Pastoreando</th><th>Descanso</th><th>Últ. desmalezada</th><th>Pastura</th><th>Disponib. diaria</th><th>Balance</th></tr></thead>
                    <tbody>
                      {lotes.map(l=>{
                        const n=stockTotal(l.id);
                        const est=estadoPastura(diasDesde(l.ultimaDesmalezada));
            const loteEst=getLoteEstado(l.id);
                        const fp=primerIngreso(l.id);
                        const dp=fp?diasDesde(fp):null;
                        const _fv=getFechaVacio(l.id)||l.fechaVacio; const dd=_fv&&n===0?diasDesde(_fv):null;
                        return(
                          <tr key={l.id} style={{cursor:"pointer"}} onClick={()=>navigate("lotes",l.id)}>
                            <td><button style={{background:"none",border:"none",cursor:"pointer",color:"var(--gold)",fontWeight:600,fontSize:13,padding:0,textDecoration:"underline"}} onClick={()=>navigate("lotes",l.id)}>{l.nombre}</button></td>
                            <td className="tm">{l.hectareas||"—"}</td>
                            <td>{n>0?n:<span className="tm">0</span>}</td>
                            <td>{n>0&&dp!==null?<span className="tg">{dp}d</span>:<span className="tm">—</span>}</td>
                            <td>{n===0&&dd!==null?<span style={{color:"#4caf6e"}}>{dd}d</span>:<span className="tm">—</span>}</td>
                            <td>{fmt(l.ultimaDesmalezada)}</td>
                            <td>
                              <span className="badge" style={{background:getLoteEstado(l.id).bg,color:getLoteEstado(l.id).color,borderColor:`${getLoteEstado(l.id).color}40`}}>{getLoteEstado(l.id).label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* LOTES LIST */}
          {view==="lotes"&&!selLote&&(
            <>
              <div className="mh">
                <div style={{marginLeft:52}}><h2>Lotes</h2><p>{lotes.length} lotes · {stats.haTotal} ha totales</p></div>
                <button className="btn bp" onClick={()=>{setEditId(null);setFL(EL);setModal("lote");}}>+ Nuevo lote</button>
              </div>
              <div className="cnt">
                <input className="search-input" placeholder="Buscar lote…" value={busqueda} onChange={e=>setBusqueda(e.target.value)}/>
                <div className="ga">
                  {lotesFiltrados.map(l=>{
                    const n=stockTotal(l.id);
                    const est=estadoPastura(diasDesde(l.ultimaDesmalezada));
            const loteEst=getLoteEstado(l.id);
                    const fp=primerIngreso(l.id);
                    const dp=fp?diasDesde(fp):null;
                    const _fv=getFechaVacio(l.id)||l.fechaVacio; const dd=_fv&&n===0?diasDesde(_fv):null;
                    const lEst=getLoteEstado(l.id);
                    return(
                      <div key={l.id} className="pc" style={{borderLeft:`4px solid ${lEst.color}`}} onClick={()=>navigate("lotes",l.id)}>
                        <div className="fbt" style={{marginBottom:4}}>
                          <div className="pn">{l.nombre}</div>
                          <span className="badge" style={{background:lEst.bg,color:lEst.color,borderColor:`${lEst.color}40`,fontSize:10}}>{lEst.label}</span>
                        </div>
                        <div className="tm txs" style={{marginBottom:10}}>{l.hectareas?`${l.hectareas} ha`:""} · {n} animales</div>
                        {n>0&&<div className="ir" style={{padding:"6px 0"}}><span className="ik">Pastoreando</span><span className="iv tg">{dp!==null?`${dp}d`:"?"}</span></div>}
                        {dd!==null&&<div className="ir" style={{padding:"6px 0"}}><span className="ik">Descanso</span><span className="iv" style={{color:"#4caf6e"}}>{dd}d</span></div>}
                        <div className="ir" style={{padding:"6px 0"}}><span className="ik">Desmalezada</span><span className="iv">{fmt(l.ultimaDesmalezada)}</span></div>
                        {(()=>{
                          const d=getDisponibilidadDiaria(l);
                          const c=getConsumoDiarioLote(l.id,caballos);
                          if(!d) return null;
                          const bal=c?d.kgDia-c:null;
                          return(<>
                            <div className="ir" style={{padding:"6px 0"}}><span className="ik">Disponib. diaria</span><span className="iv" style={{color:"#2d5a00",fontWeight:700}}>{d.kgDia} kg MS/d</span></div>
                            {bal!==null&&<div className="ir" style={{padding:"6px 0"}}><span className="ik">Balance</span><span className="iv" style={{color:bal>=0?"#228822":"#cc2222",fontWeight:700}}>{bal>=0?"+":""}{Math.round(bal*10)/10} kg MS/d</span></div>}
                          </>);
                        })()}
                        {l.notas&&<div className="mt2 txs tm">{l.notas}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* LOTE DETAIL */}
          {view==="lotes"&&selLote&&(()=>{
            const l=lotes.find(x=>x.id===selLote);
            if(!l)return null;
            const hs=cabsDe(l.id);
            const nTotal=stockTotal(l.id);
            const ulFecha=stockUltimaFecha(l.id);
            const est=estadoPastura(diasDesde(l.ultimaDesmalezada));
            const loteEst=getLoteEstado(l.id);
            const pres=calcPresion(nTotal,l.hectareas);
            const fp=primerIngreso(l.id);
            const dp=fp?diasDesde(fp):null;
            const _fv=getFechaVacio(l.id)||l.fechaVacio; const dd=_fv&&nTotal===0?diasDesde(_fv):null;
            const ds=diasDesde(l.ultimaSiembra);
            return(
              <>
                <div className="mh">
                  <div>
                    <button className="btn bg sm" style={{marginBottom:8}} onClick={()=>navigate("lotes",null)}>← Volver</button>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                      <h2 style={{margin:0}}>Lote {l.nombre}</h2>
                      <span className="badge" style={{background:loteEst.bg,color:loteEst.color,borderColor:`${loteEst.color}40`,fontSize:12}}>{loteEst.label}</span>
                    </div>
                    <p>{l.hectareas?`${l.hectareas} ha`:""}{l.notas?` · ${l.notas}`:""}</p>
                  </div>
                  <div className="fb g2p fw">
                    <button className="btn bg sm" onClick={()=>editLote(l)}>Editar</button>
                    <button className="btn bg sm" onClick={()=>{setIntervPid(l.id);setFI(EI);setModal("interv");}}>+ Intervención</button>
                    <button className="btn bg sm" onClick={()=>{setLluviaPid(l.id);setFLl(ELl);setModal("lluvia");}}>+ Lluvia</button>
                    <button className="btn bp sm" onClick={()=>{setDesmPid(l.id);setFD({...ED,fecha:hoy()});setModal("desm");}}>+ Desmalezada</button>
                  </div>
                </div>
                <div className="cnt">

                  {/* Fila 1: Pastura + Caballos */}
                  <div className="g2" style={{marginBottom:20}}>
                    <div className="card">
                      <div className="stit">Pastura & Suelo</div>
                      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                        <div style={{fontSize:36}}>🌿</div>
                        <div>
                          <div style={{fontFamily:"Playfair Display,serif",fontSize:20,color:est.color}}>{est.label}</div>
                          <div className="tm txs">{diasDesde(l.ultimaDesmalezada)!==null?`${diasDesde(l.ultimaDesmalezada)} días desde la última desmalezada`:"Sin registro de desmalezada"}</div>
                        </div>
                      </div>
                      <div className="ir"><span className="ik">Última desmalezada</span><span className="iv">{fmt(l.ultimaDesmalezada)}</span></div>
                      <div className="ir">
                        <span className="ik">Siembra</span>
                        <span className="iv" style={{textAlign:"right"}}>
                          {l.queSembro||"—"}
                          {l.ultimaSiembra&&<div className="tm txs">{fmt(l.ultimaSiembra)}{ds!==null?` · hace ${ds} días`:""}</div>}
                        </span>
                      </div>
                      {nTotal>0&&<div className="ir"><span className="ik">Días pastoreando</span><span className="iv tg">{dp!==null?`${dp} días`:"?"}</span></div>}
                      {dd!==null&&<div className="ir"><span className="ik">En descanso desde</span><span className="iv" style={{color:"#4caf6e"}}>{fmt(l.fechaVacio)} <span className="tm txs">({dd}d)</span></span></div>}
                      <div className="ir"><span className="ik">Superficie</span><span className="iv">{l.hectareas?`${l.hectareas} ha`:"—"}</span></div>
                      <div className="ir"><span className="ik">Presión de pastoreo</span><span className="iv">{pres?`${pres} cab/ha`:"—"}</span></div>
                      {pres&&<div className="mt2 txs" style={{color:"#a89070"}}>{parseFloat(pres)>1.5?"⚠️ Presión alta — considerar rotar":parseFloat(pres)>0.8?"✓ Presión moderada":"✓ Presión baja"}</div>}
                      {(()=>{
                        // Stock acumulado en descanso
                        if(nTotal===0 && dd!==null){
                          const disp=getDisponibilidadDiaria(l);
                          if(!disp||!dd) return null;
                          const stockAcum=Math.round(disp.tasa*dd*l.hectareas*10)/10;
                          return(
                            <div style={{marginTop:14,padding:"12px 14px",borderRadius:8,background:"#f0f8e8",border:"1px solid #a0e0b0"}}>
                              <div style={{fontSize:11,color:"#226622",letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:8}}>🌿 Stock acumulado en descanso</div>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                <div>
                                  <div style={{fontFamily:"Playfair Display,serif",fontSize:26,color:"#2d5a00",fontWeight:700}}>{stockAcum.toLocaleString()} <span style={{fontSize:13}}>kg MS</span></div>
                                  <div style={{fontSize:12,color:"#557700",marginTop:2}}>{disp.tasa} kg/ha/día × {dd} días × {l.hectareas} ha</div>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {(()=>{
                        const disp=getDisponibilidadDiaria(l);
                        const cons=getConsumoDiarioLote(l.id,caballos);
                        if(!disp) return null;
                        const ofertaHa = disp.tasa;
                        const ofertaTotal = disp.kgDia;
                        const demandaTotal = cons||0;
                        const balance = Math.round((ofertaTotal-demandaTotal)*10)/10;
                        const isOk = balance>=0;
                        return(
                          <div style={{marginTop:14,borderRadius:8,overflow:"hidden",border:"1px solid #e0ddd8"}}>
                            <div style={{background:"#f5f9f0",padding:"8px 14px",fontSize:11,color:"#446600",letterSpacing:1,textTransform:"uppercase",fontWeight:800}}>⚖️ Balance forrajero diario</div>
                            <div className="ir" style={{padding:"10px 14px",borderBottom:"1px solid #f0ede8"}}>
                              <span style={{fontSize:13,color:"#555",fontWeight:600}}>Oferta kg MS/ha</span>
                              <span style={{fontWeight:700,color:"#2d5a00"}}>{ofertaHa} kg MS/ha</span>
                            </div>
                            <div className="ir" style={{padding:"10px 14px",borderBottom:"1px solid #f0ede8"}}>
                              <span style={{fontSize:13,color:"#555",fontWeight:600}}>Oferta total del lote</span>
                              <span style={{fontWeight:700,color:"#2d5a00"}}>{ofertaTotal} kg MS/día</span>
                            </div>
                            <div style={{padding:"4px 14px",fontSize:11,color:"#aaa"}}>{disp.tasa} kg/ha × {l.hectareas} ha</div>
                            <div className="ir" style={{padding:"10px 14px",borderBottom:"1px solid #f0ede8",borderTop:"1px solid #f0ede8",marginTop:4}}>
                              <span style={{fontSize:13,color:"#555",fontWeight:600}}>Demanda total del lote</span>
                              <span style={{fontWeight:700,color:"#992222"}}>{demandaTotal} kg MS/día</span>
                            </div>
                            {cons&&<div style={{padding:"4px 14px",fontSize:11,color:"#aaa"}}>{Math.round((cons/nTotal)*10)/10} kg/animal × {nTotal} animales</div>}
                            <div className="ir" style={{padding:"12px 14px",background:isOk?"#f0fff4":"#fff0f0"}}>
                              <span style={{fontSize:14,fontWeight:800,color:isOk?"#226622":"#992222"}}>{isOk?"Superávit ✓":"Déficit ⚠️"}</span>
                              <span style={{fontFamily:"Playfair Display,serif",fontSize:24,fontWeight:700,color:isOk?"#228822":"#cc2222"}}>{isOk?"+":""}{balance} kg MS/día</span>
                            </div>
                          </div>
                        );
                      })()}
                      {(()=>{
                        const disp=getDisponibilidadDiaria(l);
                        if(!disp) return null;
                        return(
                          <div style={{marginTop:14,padding:"12px 14px",borderRadius:8,background:"#f0f8e8",border:"1px solid #c8e8a0"}}>
                            <div style={{fontSize:11,color:"#446600",letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:6}}>📊 Disponibilidad forrajera</div>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <div>
                                <div style={{fontFamily:"Playfair Display,serif",fontSize:26,color:"#2d5a00",fontWeight:700}}>{disp.kgDia} <span style={{fontSize:13}}>kg MS/día</span></div>
                                <div style={{fontSize:12,color:"#557700",marginTop:2}}>{getEmoji(disp.cultivo)} {disp.cultivo} · {disp.tasa} kg/ha/día × {disp.hectareas} ha</div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="card">
                      <div className="fbt mb3">
                        <div className="stit" style={{marginBottom:0}}>Animales actuales</div>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <span className="tg" style={{fontFamily:"Playfair Display,serif",fontSize:24}}>{nTotal}</span>
                          {hs.length>0&&<button className="btn bg sm" onClick={()=>setShowTrasladoLote(l.id)}>⇄ Trasladar lote completo</button>}
                        </div>
                      </div>
                      {nTotal===0
                        ?<div className="es" style={{padding:"24px 0"}}>Sin animales asignados</div>
                        :<div>
                          {hs.length===0
                            ?<div style={{padding:"12px 0",fontSize:13,color:"#a89070"}}>
                               ⚠️ {nTotal} animales sin nombre registrado
                               {ulFecha?<span className="tm txs"> (al {fmt(ulFecha)})</span>:null}
                             </div>
                            :<div>
                               {hs.length<nTotal&&<div style={{padding:"4px 0 10px",fontSize:12,color:"#a89070"}}>+{nTotal-hs.length} sin nombre registrado</div>}
                               {hs.map(h=>(
                                 <div key={h.id} className="hc">
                                   <span style={{fontSize:20}}>🐴</span>
                                   <div style={{flex:1}}>
                                     <div style={{color:"#1a1410",fontWeight:500}}>{h.nombre}</div>
                                     <div className="tm txs">{h.categoria}{h.fechaIngreso?` · ${diasDesde(h.fechaIngreso)} días aquí`:""}</div>
                                   </div>
                                   <button className="btn bg sm" style={{marginRight:8}} onClick={()=>setShowMoverCaballo({caballoId:h.id, loteOrigen:l.id})}>⇄ Mover</button>
                                   <span className="badge">{h.color||h.categoria}</span>
                                 </div>
                               ))}
                             </div>
                          }
                        </div>
                      }
                    </div>
                  </div>

                  {/* Fila 2: Agua + Intervenciones */}
                  <div className="g2" style={{marginBottom:20}}>
                    <div className="card">
                      <div className="stit">Agua</div>
                      <div className="ir"><span className="ik">Riego</span><span className="iv">{l.tieneRiego?<span className="badge b">✓ {l.riegoDiario} mm/día</span>:<span className="tm">Sin riego</span>}</span></div>
                      <div className="div"/>
                      <div className="stit">Lluvia del campo</div>
                      <div className="ir"><span className="ik">Desde el 1° de enero</span><span className="iv" style={{color:"#1a4080"}}>{lluviaDesdeEnero} mm</span></div>
                      <div className="ir"><span className="ik">Últimos 21 días</span><span className="iv" style={{color:"#1a4080"}}>{lluviaUltimos21} mm</span></div>
                      <div className="ir"><span className="ik">Días sin lluvia</span><span className="iv" style={{color:diasSinLluvia===null?"#888":diasSinLluvia>14?"#cc2222":diasSinLluvia>7?"#cc7700":"#228822"}}>{diasSinLluvia===null?"—":`${diasSinLluvia} días`}</span></div>
                      <div style={{marginTop:8,fontSize:11,color:"#888"}}>Los registros se gestionan desde el Dashboard</div>
                    </div>
                    <div className="card">
                      <div className="stit">Intervenciones</div>
                      {!(l.intervenciones||[]).length
                        ?<div className="tm txs">Sin intervenciones registradas</div>
                        :<div className="tl">
                          {[...(l.intervenciones||[])].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(iv=>(
                            <div key={iv.id} className="tli">
                              <div className="tld"/>
                              <div className="tdt">{fmt(iv.fecha)}</div>
                              <div className="tbd">{iv.tipo}</div>
                              <div className="tmeta fbt"><span>{iv.elemento}</span><button className="btn bd2 sm" style={{padding:"2px 7px"}} onClick={()=>delInterv(l.id,iv.id)}>✕</button></div>
                            </div>
                          ))}
                        </div>
                      }
                    </div>
                  </div>

                  {/* Historial de Desmalezadas */}
                  {(()=>{
                    const desmDeLote=[...desmalezadas.filter(d=>d.loteId===l.id)].sort((a,b)=>b.fecha.localeCompare(a.fecha));
                    return(
                      <div className="card" style={{marginBottom:20}}>
                        <div className="fbt mb3">
                          <div className="stit" style={{marginBottom:0}}>Historial de desmalezadas</div>
                          <button className="btn bg sm" onClick={()=>{setDesmPid(l.id);setFD({...ED,fecha:hoy()});setModal("desm");}}>+ Registrar</button>
                        </div>
                        {desmDeLote.length===0
                          ?<div className="tm txs">Sin registros — usá el botón para agregar</div>
                          :<table className="table">
                            <thead><tr><th>Fecha</th><th>Días atrás</th><th>Notas</th><th></th></tr></thead>
                            <tbody>{desmDeLote.map((d,i)=>(
                              <tr key={d.id}>
                                <td>{fmt(d.fecha)}</td>
                                <td className="tg" style={{fontWeight:500}}>{diasDesde(d.fecha)} días</td>
                                <td className="tm">{d.notas||"—"}</td>
                                <td>{i>0&&<button className="btn bd2 sm" style={{padding:"2px 7px"}} onClick={()=>delDesm(d.id)}>✕</button>}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        }
                      </div>
                    );
                  })()}
                  {/* Historial de Movimientos del lote */}
                  {(()=>{
                    const movsLote=[...movimientos.filter(m=>m.loteOrigen===l.id||m.loteDestino===l.id)].sort((a,b)=>b.fecha.localeCompare(a.fecha));
                    if(!movsLote.length) return null;
                    return(
                      <div className="card" style={{marginBottom:20}}>
                        <div className="stit">Historial de movimientos</div>
                        <table className="table">
                          <thead><tr><th>Fecha</th><th>Animal</th><th>Tipo</th><th>Desde/Hacia</th><th>Motivo</th></tr></thead>
                          <tbody>{movsLote.map(m=>{
                            const esEntrada=m.loteDestino===l.id;
                            const otroLoteId=esEntrada?m.loteOrigen:m.loteDestino;
                            const otroLote=lotes.find(x=>x.id===otroLoteId);
                            return(
                              <tr key={m.id}>
                                <td>{fmt(m.fecha)}</td>
                                <td><strong>{m.caballoNombre||(m.cantidad>1?`${m.cantidad} ${m.categoria||"animales"}`:m.categoria||"—")}</strong></td>
                                <td><span className={`badge ${esEntrada?"g":"o"}`}>{esEntrada?"↓ Entrada":"↑ Salida"}</span></td>
                                <td>{otroLote?<button style={{background:"none",border:"none",cursor:"pointer",color:"#8B6000",fontWeight:700,fontSize:13,padding:0,textDecoration:"underline"}} onClick={()=>navigate("lotes",otroLoteId)}>{otroLote.nombre}</button>:"—"}</td>
                                <td className="tm">{m.motivo||"—"}</td>
                              </tr>
                            );
                          })}</tbody>
                        </table>
                      </div>
                    );
                  })()}
                  {/* Historial de Siembras */}
                  {SIEMBRAS[l.id]&&(
                    <div className="card" style={{marginBottom:20}}>
                      <div className="stit">Historial de siembras</div>
                      <table className="table">
                        <thead><tr><th>Período</th><th>Cultivo</th><th>Composición</th></tr></thead>
                        <tbody>
                          {SIEMBRAS[l.id].map((s,i)=>(
                            <tr key={i}>
                              <td><span className="badge o">{s.p}</span></td>
                              <td style={{fontWeight:500}}>{s.c}</td>
                              <td className="tm txs">{PASTURA_COMP[s.c]?PASTURA_COMP[s.c].join(" · "):"—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Historial de movimientos */}
                  {STOCK_HISTORIAL[l.id]&&(
                    <div className="card" style={{marginBottom:20}}>
                      <div className="stit">Movimientos de animales</div>
                      <table className="table">
                        <thead><tr><th>Fecha</th><th>Categoría</th><th>Entradas</th><th>Salidas</th><th>Total en lote</th><th></th></tr></thead>
                        <tbody>
                          {STOCK_HISTORIAL[l.id].map((m,i)=>(
                            <tr key={i}>
                              <td>{fmt(m.f)}</td>
                              <td className="tm">{m.cat}</td>
                              <td>{m.ent!==null&&m.ent>0?<span className="badge g">+{m.ent}</span>:<span className="tm">—</span>}</td>
                              <td>{m.sal!==null&&m.sal>0?<span className="badge r">-{m.sal}</span>:<span className="tm">—</span>}</td>
                              <td><strong>{m.tot}</strong></td>
                              <td>{m.esAlta?<span className="badge g">Alta al haras</span>:m.esBaja?<span className="badge r">Baja del haras</span>:""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Alimentación */}
                  {hs.length>0&&(
                    <div className="card">
                      <div className="stit">Alimentación</div>
                      <table className="table">
                        <thead><tr><th>Caballo</th><th>Categoría</th><th>Peso</th><th>Ingreso</th><th>Días en lote</th><th>Alimentos</th></tr></thead>
                        <tbody>
                          {hs.map(h=>(
                            <tr key={h.id}>
                              <td><strong>{h.nombre}</strong></td>
                              <td><span className="badge">{h.categoria}</span></td>
                              <td>{h.peso?`${h.peso} kg`:"—"}</td>
                              <td>{fmt(h.fechaIngreso)}</td>
                              <td className="tg" style={{fontWeight:500}}>{h.fechaIngreso?`${diasDesde(h.fechaIngreso)} días`:"—"}</td>
                              <td>{h.alimentos.map(a=><span key={a} className="tag">{a}</span>)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          {/* CABALLOS */}
          {view==="caballos"&&(
            <>
              <div className="mh">
                <div style={{marginLeft:52}}><h2>Caballos</h2><p>{caballos.length} registros con nombre</p></div>
                <button className="btn bp" onClick={()=>{setEditId(null);setFC(EC);setModal("cab");}}>+ Nuevo caballo</button>
              </div>
              <div className="cnt">
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16,alignItems:"center"}}>
                  <input className="fi" style={{flex:1,minWidth:200,marginBottom:0}} value={filtroCabNombre} onChange={e=>setFiltroCabNombre(e.target.value)} placeholder="🔍 Buscar por nombre…"/>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {["","Yegua madre","Yegua vacía","Potrillos 2025","Potrillos 2024","Padrillo"].map(cat=>(
                      <button key={cat} onClick={()=>setFiltroCat(cat)} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${filtroCat===cat?"#8B6000":"#e0ddd8"}`,background:filtroCat===cat?"#8B6000":"#fff",color:filtroCat===cat?"#fff":"#333",fontWeight:600,fontSize:12,cursor:"pointer"}}>
                        {cat||"Todas"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card">
                  {caballosFiltrados.length===0
                    ?<div className="es"><div style={{fontSize:40,marginBottom:12}}>🐴</div>Sin caballos registrados.</div>
                    :<table className="table">
                      <thead><tr><th>Nombre</th><th>Categoría</th><th>Color</th><th>Peso</th><th>Lote</th><th>Días</th><th>Alimentos</th><th></th></tr></thead>
                      <tbody>
                        {caballosFiltrados.map(c=>{
                          const lot=lotes.find(l=>l.id===c.loteId);
                          return(
                            <tr key={c.id}>
                              <td><strong>{c.nombre}</strong></td>
                              <td><span className="badge">{c.categoria}</span></td>
                              <td className="tm txs">{c.color||"—"}</td>
                              <td onClick={()=>setShowPesoModal(c.id)} style={{cursor:"pointer"}}>
                                {(()=>{
                                  const histC=[...pesoHistorial.filter(p=>p.caballoId===c.id)].sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.id.localeCompare(a.id));
                                  const ultimo=histC[0];
                                  const pesoShow=ultimo?ultimo.peso:(c.peso||null);
                                  const fechaShow=ultimo?ultimo.fecha:null;
                                  return pesoShow?(
                                    <div style={{color:"#2d5a00",fontWeight:700,fontSize:13}}>
                                      <div>{pesoShow} kg</div>
                                      {fechaShow&&<div style={{fontSize:10,color:"#888",fontWeight:500}}>{fmt(fechaShow)}</div>}
                                    </div>
                                  ):<span style={{color:"#aaa"}}>—</span>;
                                })()}
                              </td>
                              <td>{lot?<button style={{background:"none",border:"none",cursor:"pointer",color:"var(--gold)",fontWeight:500,fontSize:13,padding:0,textDecoration:"underline"}} onClick={()=>navigate("lotes",lot.id)}>{lot.nombre}</button>:"—"}</td>
                              <td className="tg" style={{fontWeight:500}}>{c.fechaIngreso?`${diasDesde(c.fechaIngreso)}d`:"—"}</td>
                              <td style={{maxWidth:180}}>{c.alimentos.map(a=><span key={a} className="tag">{a}</span>)}</td>
                              <td><div className="fb g2p">
                                <button className="btn bg sm" onClick={()=>editCab(c)}>Editar</button>
                                <button className="btn bg sm" onClick={()=>{setModal("histCaballo");setEditId(c.id);}}>Movimientos</button>
                                <button className="btn bg sm" style={{color:"#2d5a00",borderColor:"#a0d080"}} onClick={()=>setShowPesoModal(c.id)}>⚖️ Peso</button>
                                <button className="btn bg sm" style={{color:"#cc2222",borderColor:"#e0a0a0"}} onClick={()=>setShowBajaModal(c.id)}>↓ Dar de baja</button>
                                <button className="btn bd2 sm" onClick={()=>setConfirmAction({mensaje:`Vas a eliminar a "${c.nombre}" del sistema. Esta acción se puede deshacer.`,onConfirm:()=>delCab(c.id)})}>✕ Eliminar</button>
                              </div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  }
                </div>
              </div>
            </>
          )}

          {/* MOVIMIENTOS */}
          {view==="movimientos"&&(
            <>
              <div className="mh">
                <div><h2>Movimientos</h2><p>{movimientos.length} registros</p></div>
                <button className="btn bp" onClick={()=>setModal("movimiento")}>+ Registrar movimiento</button>
              </div>
              <div className="cnt">
                <div className="card">
                  {movimientos.length===0
                    ?<div className="es">Sin movimientos registrados aún.</div>
                    :<table className="table">
                      <thead><tr><th>Fecha</th><th>Animal</th><th>Categoría</th><th>Cant.</th><th>Origen</th><th>Destino</th><th>Motivo</th><th></th></tr></thead>
                      <tbody>
                        {[...movimientos].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(m=>{
                          const ori=lotes.find(l=>l.id===m.loteOrigen);
                          const dst=lotes.find(l=>l.id===m.loteDestino);
                          return(
                            <tr key={m.id}>
                              <td>{fmt(m.fecha)}</td>
                              <td><strong>{m.caballoNombre||"Grupo sin nombre"}</strong></td>
                              <td><span className="badge">{m.categoria||"—"}</span></td>
                              <td>{m.cantidad||1}</td>
                              <td>{ori?<button style={{background:"none",border:"none",cursor:"pointer",color:"#8B6000",fontWeight:700,fontSize:13,padding:0,textDecoration:"underline"}} onClick={()=>navigate("lotes",m.loteOrigen)}>{ori.nombre}</button>:"—"}</td>
                              <td>{dst?<button style={{background:"none",border:"none",cursor:"pointer",color:"#228822",fontWeight:700,fontSize:13,padding:0,textDecoration:"underline"}} onClick={()=>navigate("lotes",m.loteDestino)}>{dst.nombre}</button>:"—"}</td>
                              <td className="tm">{m.motivo||"—"}</td>
                              <td><button className="btn bd2 sm" style={{padding:"2px 7px"}} onClick={()=>setConfirmAction({mensaje:`Vas a eliminar este movimiento. Se puede deshacer.`,onConfirm:()=>delMovimiento(m.id)})}>✕</button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  }
                </div>
              </div>
            </>
          )}

          {/* PARAMETROS */}
          {view==="parametros"&&(
            <>
              <div className="mh"><div><h2>Información Modificable</h2><p>Tasas de crecimiento y consumo por categoría</p></div></div>
              <div className="cnt">

                {/* Tasas de crecimiento */}
                <div className="card" style={{marginBottom:20}}>
                  <div className="ct">🌿 Tasas de crecimiento (kg MS / ha / día)</div>
                  <table className="table">
                    <thead><tr><th>Cultivo</th><th>Mayo</th><th>Junio</th><th>Último cambio</th><th>Notas</th></tr></thead>
                    <tbody>
                      {Object.keys(tasasActivas).map(cultivo=>(
                        <tr key={cultivo}>
                          <td><strong>{cultivo}</strong></td>
                          <td className="tg" style={{fontWeight:700}}>{tasasActivas[cultivo][5]}</td>
                          <td className="tg" style={{fontWeight:700}}>{tasasActivas[cultivo][6]}</td>
                          <td className="tm txs">{(()=>{const last=paramCrecimiento.filter(p=>p.cultivo===cultivo).sort((a,b)=>b.fecha_cambio.localeCompare(a.fecha_cambio))[0];return last?fmt(last.fecha_cambio):"—";})()}</td>
                          <td className="tm txs">{(()=>{const last=paramCrecimiento.filter(p=>p.cultivo===cultivo).sort((a,b)=>b.fecha_cambio.localeCompare(a.fecha_cambio))[0];return last?last.notas||"—":"—";})()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button className="btn bp" style={{marginTop:16}} onClick={()=>setModal("editTasa")}>✏️ Modificar tasa</button>
                </div>

                {/* Consumo por categoría */}
                <div className="card" style={{marginBottom:20}}>
                  <div className="ct">🐴 Consumo neto de pasto por categoría (kg MS / día)</div>
                  <table className="table">
                    <thead><tr><th>Categoría</th><th>Peso (kg)</th><th>% consumo</th><th>Total MS</th><th>Raciones</th><th>Neto pasto</th><th>Últ. cambio</th></tr></thead>
                    <tbody>
                      {Object.keys(CONSUMO_DETALLE_INIT).map(cat=>{
                        const d=consumoDetalle[cat]||CONSUMO_DETALLE_INIT[cat];
                        const total=Math.round(d.peso*d.pctConsumo/100*10)/10;
                        const rac=Math.round((d.raciones||[]).reduce((s,r)=>s+(r.cantidad*(r.pctMS/100)),0)*10)/10;
                        const neto=Math.round((total-rac)*10)/10;
                        const last=paramConsumo.filter(p=>p.categoria===cat).sort((a,b)=>b.fecha_cambio.localeCompare(a.fecha_cambio))[0];
                        return(
                          <tr key={cat}>
                            <td><strong>{cat}</strong></td>
                            <td>{d.peso} kg</td>
                            <td>{d.pctConsumo}%</td>
                            <td>{total} kg</td>
                            <td className="tm txs">{(d.raciones||[]).map(r=>`${r.nombre}: ${r.cantidad}kg (${r.pctMS}%MS)`).join(" | ")}</td>
                            <td className="tg" style={{fontWeight:700}}>{neto} kg MS/d</td>
                            <td className="tm txs">{last?fmt(last.fecha_cambio):"—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <button className="btn bp" style={{marginTop:16}} onClick={()=>setModal("editConsumo")}>✏️ Modificar consumo</button>
                </div>

                {/* Historial */}
                <div className="card">
                  <div className="ct">📋 Historial de cambios</div>
                  <table className="table">
                    <thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Valor anterior</th><th>Valor nuevo</th><th>Notas</th></tr></thead>
                    <tbody>
                      {[...paramCrecimiento.map(p=>({fecha:p.fecha_cambio,tipo:"Crecimiento",detalle:`${p.cultivo} · mes ${p.mes}`,valorNuevo:`${p.tasa} kg/ha/d`,notas:p.notas||""})),
                        ...paramConsumo.map(p=>({fecha:p.fecha_cambio,tipo:"Consumo",detalle:p.categoria,valorNuevo:`${p.consumo_neto} kg MS/d`,notas:p.notas||""}))
                      ].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map((h,i)=>(
                        <tr key={i}>
                          <td>{fmt(h.fecha)}</td>
                          <td><span className="badge">{h.tipo}</span></td>
                          <td><strong>{h.detalle}</strong></td>
                          <td className="tm">—</td>
                          <td className="tg" style={{fontWeight:700}}>{h.valorNuevo}</td>
                          <td className="tm">{h.notas}</td>
                        </tr>
                      ))}
                      {paramCrecimiento.length===0&&paramConsumo.length===0&&<tr><td colSpan={6}><div className="es">Sin cambios registrados aún</div></td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ROTACIONES */}
          {view==="rotaciones"&&(
            <>
              <div className="mh">
                <div style={{marginLeft:52}}><h2>Rotación de cultivos</h2><p>Historial de siembras por lote</p></div>
                
              </div>
              <div className="cnt">
                <div className="card">
                  <table className="table">
                    <thead><tr><th>Lote</th><th>Ha</th><th>Mar 2025</th><th>Sept 2025</th><th>Dic 2025</th><th>Mar 2026</th></tr></thead>
                    <tbody>
                      {lotes.map(l=>{
                        const s=SIEMBRAS[l.id]||[];
                        return(
                          <tr key={l.id}>
                            <td>
                              <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--gold)",fontWeight:600,fontSize:13,padding:0,textDecoration:"underline"}}
                                onClick={()=>navigate("lotes",l.id)}>
                                {l.nombre}
                              </button>
                            </td>
                            <td className="tm txs">{l.hectareas||"—"}</td>
                            {s.length>0?s.map((x,i)=>(
                              <td key={i}>
                                <span style={{fontSize:12}}>{x.c}</span>
                                {PASTURA_COMP[x.c]&&<div className="txs tm" style={{marginTop:2}}>{PASTURA_COMP[x.c].slice(0,3).join(", ")}…</div>}
                              </td>
                            )):<><td className="tm txs">—</td><td className="tm txs">—</td><td className="tm txs">—</td><td className="tm txs">—</td></>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>

        {/* MODAL: Caballo */}
        {modal==="cab"&&(
          <div className="mo" onClick={e=>e.target===e.currentTarget&&closeModal()}>
            <div className="md">
              <div className="mtit">{editId?"Editar caballo":"Nuevo caballo"}</div>
              <div className="fr">
                <div className="fg"><label className="fl">Nombre *</label><input className="fi" value={fC.nombre} onChange={e=>setFC(f=>({...f,nombre:e.target.value}))} placeholder="Nombre del caballo"/></div>
                <div className="fg"><label className="fl">Color / Pelaje</label><input className="fi" value={fC.color} onChange={e=>setFC(f=>({...f,color:e.target.value}))} placeholder="Ej: Alazán"/></div>
              </div>
              <div className="fr">
                <div className="fg"><label className="fl">Categoría</label><select className="fi" value={fC.categoria} onChange={e=>setFC(f=>({...f,categoria:e.target.value}))}>{CATEGORIAS.map(c=><option key={c}>{c}</option>)}</select></div>
                <div className="fg"><label className="fl">Peso (kg)</label><input className="fi" type="number" value={fC.peso} onChange={e=>setFC(f=>({...f,peso:e.target.value}))} placeholder="500"/></div>
              </div>
              <div className="fr">
                <div className="fg"><label className="fl">Lote *</label><select className="fi" value={fC.loteId} onChange={e=>setFC(f=>({...f,loteId:e.target.value}))}><option value="">— Seleccionar —</option>{lotes.map(l=><option key={l.id} value={l.id}>{l.nombre}</option>)}</select></div>
                <div className="fg"><label className="fl">Fecha de ingreso</label><input className="fi" type="date" value={fC.fechaIngreso} onChange={e=>setFC(f=>({...f,fechaIngreso:e.target.value}))}/></div>
              </div>
              <div className="fg"><label className="fl">Alimentos</label><div className="cg">{ALIMENTOS.map(a=><label key={a} className={`ci ${fC.alimentos.includes(a)?"ck":""}`}><input type="checkbox" checked={fC.alimentos.includes(a)} onChange={()=>togAlim(a)}/>{a}</label>)}</div></div>
              <div className="fb g2p" style={{marginTop:20,justifyContent:"flex-end"}}>
                <button className="btn bg" onClick={closeModal}>Cancelar</button>
                <button className="btn bp" onClick={saveCab} style={{opacity:(!fC.nombre||!fC.loteId)?0.5:1}}>{editId?"Guardar":"Registrar"}{(!fC.nombre||!fC.loteId)?" (completar campos *)":""}</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Lote */}
        {modal==="lote"&&(
          <div className="mo" onClick={e=>e.target===e.currentTarget&&closeModal()}>
            <div className="md">
              <div className="mtit">{editId?"Editar lote":"Nuevo lote"}</div>
              <div className="fr">
                <div className="fg"><label className="fl">Nombre *</label><input className="fi" value={fL.nombre} onChange={e=>setFL(f=>({...f,nombre:e.target.value}))} placeholder="Ej: A1"/></div>
                <div className="fg"><label className="fl">Superficie (ha)</label><input className="fi" type="number" step="0.1" value={fL.hectareas} onChange={e=>setFL(f=>({...f,hectareas:e.target.value}))} placeholder="3.5"/></div>
              </div>
              <div className="fr">
                <div className="fg"><label className="fl">Última desmalezada</label><input className="fi" type="date" value={fL.ultimaDesmalezada} onChange={e=>setFL(f=>({...f,ultimaDesmalezada:e.target.value}))}/></div>
                <div className="fg"><label className="fl">Vacío desde (si descansa)</label><input className="fi" type="date" value={fL.fechaVacio} onChange={e=>setFL(f=>({...f,fechaVacio:e.target.value}))}/></div>
              </div>
              <div className="fr">
                <div className="fg"><label className="fl">Fecha de siembra</label><input className="fi" type="date" value={fL.ultimaSiembra} onChange={e=>setFL(f=>({...f,ultimaSiembra:e.target.value}))}/></div>
                <div className="fg"><label className="fl">Qué se sembró</label><input className="fi" value={fL.queSembro} onChange={e=>setFL(f=>({...f,queSembro:e.target.value}))} placeholder="Ej: Festuca + trébol"/></div>
              </div>
              <div className="fg"><label className="fl">Notas</label><input className="fi" value={fL.notas} onChange={e=>setFL(f=>({...f,notas:e.target.value}))} placeholder="Observaciones del lote"/></div>
              <div className="div"/>
              <div className="stit">Riego</div>
              <div className="fr">
                <div className="fg"><label className="fl">¿Tiene riego?</label><div className="cg">{["Sí","No"].map(op=><label key={op} className={`ci ${(op==="Sí"&&fL.tieneRiego)||(op==="No"&&!fL.tieneRiego)?"ck":""}`}><input type="radio" onChange={()=>setFL(f=>({...f,tieneRiego:op==="Sí"}))}/>{op}</label>)}</div></div>
                {fL.tieneRiego&&<div className="fg"><label className="fl">mm por día</label><input className="fi" type="number" step="0.5" value={fL.riegoDiario} onChange={e=>setFL(f=>({...f,riegoDiario:e.target.value}))} placeholder="Ej: 8"/></div>}
              </div>
              <div className="fb g2p" style={{marginTop:20,justifyContent:"flex-end"}}>
                <button className="btn bg" onClick={closeModal}>Cancelar</button>
                <button className="btn bp" onClick={saveLote}>{editId?"Guardar":"Crear lote"}</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Intervención */}
        {modal==="interv"&&(
          <div className="mo" onClick={e=>e.target===e.currentTarget&&closeModal()}>
            <div className="md" style={{maxWidth:420}}>
              <div className="mtit">Registrar intervención</div>
              <div className="fg"><label className="fl">Fecha</label><input className="fi" type="date" value={fI.fecha} onChange={e=>setFI(f=>({...f,fecha:e.target.value}))}/></div>
              <div className="fg"><label className="fl">Tipo</label><input className="fi" value={fI.tipo} onChange={e=>setFI(f=>({...f,tipo:e.target.value}))} placeholder="Ej: Intersiembra"/></div>
              <div className="fg"><label className="fl">Elemento / Especie *</label><input className="fi" value={fI.elemento} onChange={e=>setFI(f=>({...f,elemento:e.target.value}))} placeholder="Ej: Raigrás perenne"/></div>
              <div className="fb g2p" style={{marginTop:20,justifyContent:"flex-end"}}>
                <button className="btn bg" onClick={closeModal}>Cancelar</button>
                <button className="btn bp" onClick={saveInterv}>Registrar</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Lluvia */}
        {modal==="lluvia"&&(
          <div className="mo" onClick={e=>e.target===e.currentTarget&&closeModal()}>
            <div className="md" style={{maxWidth:380}}>
              <div className="mtit">Registrar lluvia</div>
              <div className="fg"><label className="fl">Fecha</label><input className="fi" type="date" value={fLl.fecha} onChange={e=>setFLl(f=>({...f,fecha:e.target.value}))}/></div>
              <div className="fg"><label className="fl">Milímetros *</label><input className="fi" type="number" step="0.5" value={fLl.mm} onChange={e=>setFLl(f=>({...f,mm:e.target.value}))} placeholder="Ej: 22"/></div>
              <div className="fb g2p" style={{marginTop:20,justifyContent:"flex-end"}}>
                <button className="btn bg" onClick={closeModal}>Cancelar</button>
                <button className="btn bp" onClick={saveLluvia}>Registrar</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Lluvia global */}
        {showLluviaGlobal&&(
          <div className="mo" onClick={e=>e.target===e.currentTarget&&setShowLluviaGlobal(false)}>
            <div className="md" style={{maxWidth:380}}>
              <div className="mtit">Registrar lluvia</div>
              <div className="fg"><label className="fl">Fecha</label><input className="fi" type="date" value={fLluviaG.fecha} onChange={e=>setFLluviaG(f=>({...f,fecha:e.target.value}))}/></div>
              <div className="fg"><label className="fl">Milímetros *</label><input className="fi" type="number" step="0.5" value={fLluviaG.mm} onChange={e=>setFLluviaG(f=>({...f,mm:e.target.value}))} placeholder="Ej: 22"/></div>
              <div className="fb g2p" style={{marginTop:20,justifyContent:"flex-end"}}>
                <button className="btn bg" onClick={()=>setShowLluviaGlobal(false)}>Cancelar</button>
                <button className="btn bp" onClick={saveLluviaGlobal}>Registrar</button>
              </div>
            </div>
          </div>
        )}
        {/* MODAL: Movimiento */}
        {modal==="movimiento"&&(()=>{
          const EM={fecha:hoy(),tipo:"individual",caballoId:"",caballoNombre:"",cantidad:1,categoria:CATEGORIAS[0],loteOrigen:"",loteDestino:"",motivo:"",notas:""};
          return(
            <MovimientoModal lotes={lotes} caballos={caballos} CATEGORIAS={CATEGORIAS} saveMovimiento={saveMovimiento} closeModal={closeModal} hoy={hoy}/>
          );
        })()}
        {/* MODAL: Confirmación */}
        {confirmAction&&(
          <div className="mo" onClick={e=>e.target===e.currentTarget&&setConfirmAction(null)}>
            <div className="md" style={{maxWidth:380,textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
              <div className="mtit" style={{marginBottom:12}}>¿Estás seguro?</div>
              <div style={{fontSize:15,color:"#555",marginBottom:24,fontWeight:500}}>{confirmAction.mensaje}</div>
              <div className="fb g2p" style={{justifyContent:"center"}}>
                <button className="btn bg" style={{padding:"12px 24px",fontSize:14}} onClick={()=>setConfirmAction(null)}>Cancelar</button>
                <button className="btn bd2" style={{padding:"12px 24px",fontSize:14,background:"#cc2222",color:"#fff",border:"none"}} onClick={()=>{confirmAction.onConfirm();setConfirmAction(null);}}>Sí, eliminar</button>
              </div>
            </div>
          </div>
        )}
        {/* MODAL: Dar de baja */}
        {showBajaModal&&(()=>{
          const cab=caballos.find(c=>c.id===showBajaModal);
          if(!cab) return null;
          return(
            <div className="mo" onClick={e=>e.target===e.currentTarget&&setShowBajaModal(null)}>
              <div className="md" style={{maxWidth:400}}>
                <div className="mtit">↓ Dar de baja — {cab.nombre}</div>
                <div style={{fontSize:13,color:"#555",marginBottom:16}}>
                  El animal ya no va a aparecer en los lotes ni en el conteo activo. Quedará registrado en la sección <strong>Bajas</strong> con todo su historial.
                </div>
                <div className="fg">
                  <label className="fl">Fecha de baja</label>
                  <input className="fi" type="date" id="bajaFecha" defaultValue={hoy()}/>
                </div>
                <div className="fg">
                  <label className="fl">Motivo</label>
                  <input className="fi" id="bajaMotivo" placeholder="Ej: Venta, muerte, traslado definitivo..."/>
                </div>
                <div className="fb g2p" style={{justifyContent:"space-between",marginTop:16}}>
                  <button className="btn bg" onClick={()=>setShowBajaModal(null)}>Cancelar</button>
                  <button className="btn bp" style={{background:"#cc2222",border:"none"}} onClick={()=>{
                    const fecha=document.getElementById("bajaFecha").value||hoy();
                    const motivo=document.getElementById("bajaMotivo").value;
                    darDeBaja(showBajaModal, fecha, motivo);
                    setShowBajaModal(null);
                  }}>↓ Confirmar baja</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* MODAL: Trasladar lote completo */}
        {showTrasladoLote&&(()=>{
          const loteOrig=lotes.find(l=>l.id===showTrasladoLote);
          if(!loteOrig) return null;
          const animales=cabsDe(showTrasladoLote);
          return(
            <div className="mo" onClick={e=>e.target===e.currentTarget&&setShowTrasladoLote(null)}>
              <div className="md" style={{maxWidth:460}}>
                <div className="mtit">⇄ Trasladar lote completo</div>
                <div style={{fontSize:13,color:"#555",marginBottom:16}}>
                  Vas a mover los <strong>{animales.length}</strong> animales de <strong>{loteOrig.nombre}</strong> a otro lote. Se registra como movimiento individual para cada uno.
                </div>
                <div className="fg">
                  <label className="fl">Lote destino *</label>
                  <select className="fi" id="trasladoDestino">
                    <option value="">— Seleccionar —</option>
                    {lotes.filter(l=>l.id!==showTrasladoLote).map(l=><option key={l.id} value={l.id}>{l.nombre}</option>)}
                  </select>
                </div>
                <div className="fg">
                  <label className="fl">Fecha</label>
                  <input className="fi" type="date" id="trasladoFecha" defaultValue={hoy()}/>
                </div>
                <div className="fg">
                  <label className="fl">Motivo</label>
                  <input className="fi" id="trasladoMotivo" placeholder="Ej: Rotación planificada"/>
                </div>
                <div className="fb g2p" style={{justifyContent:"space-between",marginTop:16}}>
                  <button className="btn bg" onClick={()=>setShowTrasladoLote(null)}>Cancelar</button>
                  <button className="btn bp" onClick={()=>{
                    const destino=document.getElementById("trasladoDestino").value;
                    const fecha=document.getElementById("trasladoFecha").value||hoy();
                    const motivo=document.getElementById("trasladoMotivo").value;
                    if(!destino) return;
                    trasladarLoteCompleto(showTrasladoLote, destino, fecha, motivo);
                    setShowTrasladoLote(null);
                  }}>✓ Trasladar todos</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* MODAL: Mover caballo individual desde el lote */}
        {showMoverCaballo&&(()=>{
          const cab=caballos.find(c=>c.id===showMoverCaballo.caballoId);
          if(!cab) return null;
          const loteOrig=lotes.find(l=>l.id===showMoverCaballo.loteOrigen);
          return(
            <div className="mo" onClick={e=>e.target===e.currentTarget&&setShowMoverCaballo(null)}>
              <div className="md" style={{maxWidth:420}}>
                <div className="mtit">⇄ Mover a {cab.nombre}</div>
                <div style={{fontSize:13,color:"#555",marginBottom:16}}>
                  Actualmente en <strong>{loteOrig?.nombre||"—"}</strong>
                </div>
                <div className="fg">
                  <label className="fl">Lote destino *</label>
                  <select className="fi" id="moverDestino">
                    <option value="">— Seleccionar —</option>
                    {lotes.filter(l=>l.id!==showMoverCaballo.loteOrigen).map(l=><option key={l.id} value={l.id}>{l.nombre}</option>)}
                  </select>
                </div>
                <div className="fg">
                  <label className="fl">Fecha</label>
                  <input className="fi" type="date" id="moverFecha" defaultValue={hoy()}/>
                </div>
                <div className="fg">
                  <label className="fl">Motivo</label>
                  <input className="fi" id="moverMotivo" placeholder="Ej: Rotación"/>
                </div>
                <div className="fb g2p" style={{justifyContent:"space-between",marginTop:16}}>
                  <button className="btn bg" onClick={()=>setShowMoverCaballo(null)}>Cancelar</button>
                  <button className="btn bp" onClick={()=>{
                    const destino=document.getElementById("moverDestino").value;
                    const fecha=document.getElementById("moverFecha").value||hoy();
                    const motivo=document.getElementById("moverMotivo").value;
                    if(!destino) return;
                    moverCaballoIndividual(showMoverCaballo.caballoId, showMoverCaballo.loteOrigen, destino, fecha, motivo);
                    setShowMoverCaballo(null);
                  }}>✓ Mover</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* MODAL: Peso historial */}
        {showPesoModal&&(()=>{
          const cab=caballos.find(c=>c.id===showPesoModal);
          if(!cab) return null;
          const histPesos=[...pesoHistorial.filter(p=>p.caballoId===showPesoModal)].sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.id.localeCompare(a.id));
          // If horse has peso but no historial, show it as initial entry
          const pesosConInicial = histPesos.length===0 && cab.peso ? 
            [{id:"init",caballoId:cab.id,fecha:cab.fechaIngreso||"",peso:cab.peso,esInicial:true}] : 
            histPesos;
          return(
            <div className="mo" onClick={e=>e.target===e.currentTarget&&setShowPesoModal(null)}>
              <div className="md" style={{maxWidth:460}}>
                <div className="mtit">⚖️ Historial de pesos — {cab.nombre}</div>
                {(()=>{
                  const histC=[...pesoHistorial.filter(p=>p.caballoId===showPesoModal)].sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.id.localeCompare(a.id));
                  const ultimo=histC.length>0?histC[0]:null;
                  const pesoShow=ultimo?ultimo.peso:cab.peso;
                  const fechaShow=ultimo?ultimo.fecha:null;
                  return(
                    <div style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#2d5a00",fontWeight:700,marginBottom:4}}>
                      {pesoShow?`${pesoShow} kg`:"Sin registro"}
                      <span style={{fontSize:13,color:"#888",marginLeft:8}}>{fechaShow?`al ${fmt(fechaShow)}`:"último peso"}</span>
                    </div>
                  );
                })()}
                <div className="div"/>
                <div className="stit">Registrar nuevo pesaje</div>
                <div className="fr" style={{marginBottom:16}}>
                  <div className="fg"><label className="fl">Fecha</label><input className="fi" type="date" value={newPesoFecha||hoy()} onChange={e=>setNewPesoFecha(e.target.value)}/></div>
                  <div className="fg"><label className="fl">Peso (kg)</label><input className="fi" type="number" step="0.5" value={newPesoVal} onChange={e=>setNewPesoVal(e.target.value)} placeholder="Ej: 320"/></div>
                </div>
                <button className="btn bp" style={{marginBottom:20}} onClick={()=>{if(newPesoVal){addPeso(cab.id,newPesoVal,newPesoFecha||hoy());setNewPesoVal("");setNewPesoFecha("");}}}> + Registrar pesaje</button>
                <div className="stit">Historial</div>
                {pesosConInicial.length===0
                  ?<div className="tm txs">Sin registros previos</div>
                  :<table className="table">
                    <thead><tr><th>Fecha</th><th>Peso</th><th>Var. diaria</th></tr></thead>
                    <tbody>{pesosConInicial.map((p,idx)=>{
                      // pesosConInicial is sorted desc (most recent first)
                      // compare with the PREVIOUS one chronologically = next in this array
                      const anterior = pesosConInicial[idx+1];
                      let variacion = null;
                      if(anterior && p.fecha && anterior.fecha && p.fecha!==anterior.fecha){
                        const dias = (new Date(p.fecha) - new Date(anterior.fecha)) / (1000*60*60*24);
                        if(dias>0){
                          variacion = (parseFloat(p.peso) - parseFloat(anterior.peso)) / dias;
                        }
                      }
                      return(
                        <tr key={p.id}>
                          <td>{p.fecha?fmt(p.fecha):<span style={{color:"#aaa"}}>Sin fecha</span>}</td>
                          <td style={{fontWeight:700,color:"#2d5a00"}}>{p.peso} kg {p.esInicial&&<span style={{fontSize:10,color:"#888"}}>(inicial)</span>}</td>
                          <td>
                            {variacion!==null
                              ?<span style={{fontWeight:700,color:variacion>=0?"#2d5a00":"#cc2222"}}>
                                {variacion>=0?"+":""}{variacion.toFixed(2)} kg/día
                              </span>
                              :<span style={{color:"#aaa",fontSize:12}}>—</span>
                            }
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                }
                <div style={{marginTop:16,textAlign:"right"}}><button className="btn bg" onClick={()=>setShowPesoModal(null)}>Cerrar</button></div>
              </div>
            </div>
          );
        })()}
        {/* MODAL: Historial caballo */}
        {modal==="histCaballo"&&editId&&(()=>{
          const cab=caballos.find(c=>c.id===editId);
          if(!cab) return null;
          const movsC=[...movimientos.filter(m=>m.caballoId===editId)].sort((a,b)=>b.fecha.localeCompare(a.fecha));
          return(
            <div className="mo" onClick={e=>e.target===e.currentTarget&&closeModal()}>
              <div className="md" style={{maxWidth:580}}>
                <div className="mtit">Historial de {cab.nombre}</div>
                {movsC.length===0
                  ?<div className="es">Sin movimientos registrados para este caballo.</div>
                  :<table className="table">
                    <thead><tr><th>Fecha</th><th>Origen</th><th>Destino</th><th>Motivo</th></tr></thead>
                    <tbody>{movsC.map(m=>{
                      const ori=lotes.find(l=>l.id===m.loteOrigen);
                      const dst=lotes.find(l=>l.id===m.loteDestino);
                      return(
                        <tr key={m.id}>
                          <td>{fmt(m.fecha)}</td>
                          <td className="tm">{ori?ori.nombre:"—"}</td>
                          <td style={{fontWeight:700,color:"#228822"}}>{dst?dst.nombre:"—"}</td>
                          <td className="tm">{m.motivo||"—"}</td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                }
                <div style={{marginTop:16,textAlign:"right"}}>
                  <button className="btn bg" onClick={closeModal}>Cerrar</button>
                </div>
              </div>
            </div>
          );
        })()}
        {/* MODAL: Desmalezada */}
        {modal==="desm"&&(
          <div className="mo" onClick={e=>e.target===e.currentTarget&&closeModal()}>
            <div className="md" style={{maxWidth:420}}>
              <div className="mtit">Registrar desmalezada</div>
              <div className="fg"><label className="fl">Fecha</label><input className="fi" type="date" value={fD.fecha} onChange={e=>setFD(f=>({...f,fecha:e.target.value}))}/></div>
              <div className="fg"><label className="fl">Notas (opcional)</label><input className="fi" value={fD.notas} onChange={e=>setFD(f=>({...f,notas:e.target.value}))} placeholder="Ej: Solo mitad del lote"/></div>
              <div className="fb g2p" style={{marginTop:20,justifyContent:"flex-end"}}>
                <button className="btn bg" onClick={closeModal}>Cancelar</button>
                <button className="btn bp" onClick={saveDesm}>Registrar</button>
              </div>
            </div>
          </div>
        )}
        {/* MODAL: Editar Tasa */}
        {modal==="editTasa"&&(
          <div className="mo" onClick={e=>e.target===e.currentTarget&&closeModal()}>
            <div className="md" style={{maxWidth:460}}>
              <div className="mtit">Modificar tasa de crecimiento</div>
              <EditTasaForm tasasActivas={tasasActivas} setTasasActivas={setTasasActivas} paramCrecimiento={paramCrecimiento} setParamCrecimiento={setParamCrecimiento} closeModal={closeModal} sbUpsert={sbUpsert} hoy={hoy}/>
            </div>
          </div>
        )}
        {/* MODAL: Editar Consumo */}
        {modal==="editConsumo"&&(
          <div className="mo" onClick={e=>e.target===e.currentTarget&&closeModal()}>
            <div className="md" style={{maxWidth:460}}>
              <div className="mtit">Modificar consumo por categoría</div>
              <EditConsumoForm consumosActivos={consumosActivos} setConsumosActivos={setConsumosActivos} consumoDetalle={consumoDetalle} setConsumoDetalle={setConsumoDetalle} paramConsumo={paramConsumo} setParamConsumo={setParamConsumo} closeModal={closeModal} sbUpsert={sbUpsert} hoy={hoy}/>
            </div>
          </div>
        )}
        {/* MODAL: Rotación */}
        {modal==="rot"&&(
          <div className="mo" onClick={e=>e.target===e.currentTarget&&closeModal()}>
            <div className="md">
              <div className="mtit">Registrar rotación</div>
              <div className="fr">
                <div className="fg"><label className="fl">Caballo *</label><select className="fi" value={fR.caballoId} onChange={e=>setFR(f=>({...f,caballoId:e.target.value}))}><option value="">— Seleccionar —</option>{caballos.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
                <div className="fg"><label className="fl">Fecha</label><input className="fi" type="date" value={fR.fecha} onChange={e=>setFR(f=>({...f,fecha:e.target.value}))}/></div>
              </div>
              <div className="fr">
                <div className="fg"><label className="fl">Lote origen</label><select className="fi" value={fR.loteOrigen} onChange={e=>setFR(f=>({...f,loteOrigen:e.target.value}))}><option value="">— Seleccionar —</option>{lotes.map(l=><option key={l.id} value={l.id}>{l.nombre}</option>)}</select></div>
                <div className="fg"><label className="fl">Lote destino *</label><select className="fi" value={fR.loteDestino} onChange={e=>setFR(f=>({...f,loteDestino:e.target.value}))}><option value="">— Seleccionar —</option>{lotes.map(l=><option key={l.id} value={l.id}>{l.nombre}</option>)}</select></div>
              </div>
              <div className="fr">
                <div className="fg"><label className="fl">Días en origen</label><input className="fi" type="number" value={fR.diasEnOrigen} onChange={e=>setFR(f=>({...f,diasEnOrigen:e.target.value}))} placeholder="Ej: 45"/></div>
                <div className="fg"><label className="fl">Motivo</label><input className="fi" value={fR.motivo} onChange={e=>setFR(f=>({...f,motivo:e.target.value}))} placeholder="Ej: Rotación planificada"/></div>
              </div>
              <div className="fb g2p" style={{marginTop:20,justifyContent:"flex-end"}}>
                <button className="btn bg" onClick={closeModal}>Cancelar</button>
                <button className="btn bp" onClick={saveRot}>Registrar</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
