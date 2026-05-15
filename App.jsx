import { useState, useMemo, useEffect, useCallback } from "react";

const SUPABASE_URL = "https://xmiygmcczqlvovdwlfov.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtaXlnbWNjenFsdm92ZHdsZm92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjQwOTIsImV4cCI6MjA5NDM0MDA5Mn0._Fp6Ah-pg2Kp9qbemzNZJ7RQj6w34WJRZsWNvVDtYJA";

async function sbFetch(table, method="GET", body=null, filters="") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${filters}`, {
    method,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": method==="POST"?"return=representation":"",
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function sbSelect(table) { return await sbFetch(table, "GET", null, "?select=*&order=id"); }
async function sbUpsert(table, data) { return await sbFetch(table, "POST", data, "?on_conflict=id"); }
async function sbDelete(table, id) { return await sbFetch(table, "DELETE", null, `?id=eq.${id}`); }


const CATEGORIAS = ["Padrillo", "Yegua madre", "Potro", "Potranca", "Castrado", "Yegua de trabajo"];
const ALIMENTOS  = ["Heno de alfalfa","Heno de pastura","Grano de maíz","Avena","Pellet comercial","Suplemento proteico","Sal mineral"];

const PASTURA_COMP = {
  "Pastura Politictica": ["Cebadilla","Pasto ovillo","Rye Grass perenne","Rye Grass anual","Phalaris","Trebol rojo","Trebol blanco","Alfalfa","Lotus corniculatus","Achicoria"],
};

const SIEMBRAS = {
  "A1":    [{p:"Mar 2025",c:"Maiz"},{p:"Sept 2025",c:"Maiz"},{p:"Dic 2025",c:"Maiz"},{p:"Mar 2026",c:"Pastura 1"}],
  "A2":    [{p:"Mar 2025",c:"Rye Grass"},{p:"Sept 2025",c:"Sin dato"},{p:"Dic 2025",c:"Sin dato"},{p:"Mar 2026",c:"Sin dato"}],
  "A3":    [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "A4":    [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Maiz"},{p:"Dic 2025",c:"Sin dato"},{p:"Mar 2026",c:"Pastura Politictica"}],
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
  "82A":   [{p:"Mar 2025",c:"Sin dato"},{p:"Sept 2025",c:"Sin dato"},{p:"Dic 2025",c:"Sin dato"},{p:"Mar 2026",c:"Sin dato"}],
  "83":    [{p:"Mar 2025",c:"Sin dato"},{p:"Sept 2025",c:"Sin dato"},{p:"Dic 2025",c:"Sin dato"},{p:"Mar 2026",c:"Pastura 1"}],
  "84":    [{p:"Mar 2025",c:"Avena"},{p:"Sept 2025",c:"Avena"},{p:"Dic 2025",c:"Moha"},{p:"Mar 2026",c:"Pastura 1"}],
  "85":    [{p:"Mar 2025",c:"Pastura 2024"},{p:"Sept 2025",c:"Pastura 2024"},{p:"Dic 2025",c:"Pastura 2024"},{p:"Mar 2026",c:"Pastura 2024"}],
  "86":    [{p:"Mar 2025",c:"Sin dato"},{p:"Sept 2025",c:"Rye Grass"},{p:"Dic 2025",c:"Moha"},{p:"Mar 2026",c:"Pastura 1"}],
  "87":    [{p:"Mar 2025",c:"Pastura 2024"},{p:"Sept 2025",c:"Pastura 2024"},{p:"Dic 2025",c:"Pastura 2024"},{p:"Mar 2026",c:"Pastura 2024"}],
  "88":    [{p:"Mar 2025",c:"Pastura 2025"},{p:"Sept 2025",c:"Pastura 2025"},{p:"Dic 2025",c:"Pastura 2025"},{p:"Mar 2026",c:"Pastura 2025"}],
  "S31":   [{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "SMEDIO":[{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Pastura a"},{p:"Mar 2026",c:"Pastura a"}],
  "SCHICO":[{p:"Mar 2025",c:"Pastura a"},{p:"Sept 2025",c:"Pastura a"},{p:"Dic 2025",c:"Maiz"},{p:"Mar 2026",c:"Sin dato"}],
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
  "F9":     [{f:"2026-04-24",cat:"Sin cría (ingreso)",ent:10,sal:0,tot:10,esAlta:true},{f:"2026-04-28",cat:"—",ent:0,sal:10,tot:0},{f:"2026-05-12",cat:"Preñadas",ent:null,sal:null,tot:14}],
  "F10":    [{f:"2026-04-08",cat:"Potrillos 7 meses",ent:12,sal:0,tot:12},{f:"2026-05-13",cat:"—",ent:null,sal:null,tot:0}],
  "F12":    [{f:"2026-05-13",cat:"Potrancas 18 meses",ent:null,sal:null,tot:3}],
  "F13":    [{f:"2026-04-08",cat:"Potrancas 2 años",ent:3,sal:0,tot:3}],
  "81":     [{f:"2026-04-24",cat:"Sin cría",ent:8,sal:0,tot:8},{f:"2026-05-13",cat:"Sin cría",ent:null,sal:null,tot:10}],
  "85":     [{f:"2026-04-08",cat:"Sin cría",ent:4,sal:0,tot:4},{f:"2026-04-24",cat:"—",ent:0,sal:4,tot:0},{f:"2026-05-13",cat:"Potrillos año y medio",ent:null,sal:null,tot:2}],
  "86":     [{f:"2026-04-08",cat:"Sin cría",ent:4,sal:0,tot:4}],
  "87":     [{f:"2026-04-08",cat:"Sin cría",ent:4,sal:0,tot:4},{f:"2026-05-13",cat:"Potrillos año y medio",ent:null,sal:null,tot:3}],
  "88":     [{f:"2026-04-08",cat:"Sin cría",ent:4,sal:0,tot:4},{f:"2026-04-24",cat:"—",ent:0,sal:4,tot:0},{f:"2026-05-13",cat:"Potrillos año y medio",ent:null,sal:null,tot:3}],
};

const initLotes = [
  { id:"A1",   nombre:"A1",    hectareas:2,    ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"A2",   nombre:"A2",    hectareas:3.5,  ultimaDesmalezada:"2026-05-11", notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"A3",   nombre:"A3",    hectareas:2.9,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"A4",   nombre:"A4",    hectareas:1.5,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"A5",   nombre:"A5",    hectareas:2.3,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"A6",   nombre:"A6",    hectareas:2.4,  ultimaDesmalezada:"2026-05-11", notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"B1",   nombre:"B1",    hectareas:0.8,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
  { id:"B1A",  nombre:"B1 A",  hectareas:2.5,  ultimaDesmalezada:null,         notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
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
  { id:"R3",  nombre:"R3",  hectareas:10.3, ultimaDesmalezada:"2026-05-11", notas:"", ultimaSiembra:"", queSembro:"", fechaVacio:null, intervenciones:[], lluvias:[], tieneRiego:false, riegoDiario:0 },
];

function cab(id, nombre, loteId, fechaIngreso="") {
  return { id, nombre, categoria:"Yegua madre", alimentos:[], loteId, fechaIngreso, peso:"", color:"" };
}

const initCaballos = [
  cab("YM001","Batrana","F6","2026-04-28"), cab("YM002","Ellijay","F6","2026-04-28"), cab("YM003","Reina Agatta","F6","2026-04-28"),
  cab("YM004","Ride Beach","F6","2026-04-28"), cab("YM005","Santificada","F6","2026-04-28"), cab("YM006","Joy Tanguera","F6","2026-04-28"),
  cab("YM007","Endless Dream","F6","2026-04-28"),
  cab("YM008","Miss Top Girl","F7","2026-04-28"), cab("YM009","Karakoa","F7","2026-04-28"), cab("YM010","Star Of Belen","F7","2026-04-28"),
  cab("YM011","Taylor Rae","F7","2026-04-28"), cab("YM012","Queen Sarah","F7","2026-04-28"), cab("YM013","Lady Thea","F7","2026-04-28"),
  cab("YM014","Miss Tracy Bond","F7","2026-04-28"), cab("YM015","Tweedia","F7","2026-04-28"), cab("YM016","Opium Ruler","F7","2026-04-28"),
  cab("YM017","Kirshara","F7","2026-04-28"),
  cab("YM018","Neska Amada","F8","2026-04-28"), cab("YM019","Archie Fan","F8","2026-04-28"), cab("YM020","Pleasant Legends","F8","2026-04-28"),
  cab("YM021","Destiny Match","F8","2026-04-28"), cab("YM022","Ishka Baja","F8","2026-04-28"), cab("YM023","Issolda","F8","2026-04-28"),
  cab("YM024","Bella Y Romantica","F8","2026-04-28"), cab("YM025","Shafe","F8","2026-04-28"), cab("YM026","Summer Fashion","F8","2026-04-28"),
  cab("YM027","Calma Romana","F9","2026-04-24"), cab("YM028","Ven A Mi","F9","2026-04-24"), cab("YM029","Abbuehl","F9","2026-04-24"),
  cab("YM030","Leopolda Magna","F9","2026-04-24"), cab("YM031","Break Of Day","F9","2026-04-24"), cab("YM032","Candy Embrujada","F9","2026-04-24"),
  cab("YM033","Wonderful Luck","F9","2026-04-24"), cab("YM034","Brig","F9","2026-04-24"), cab("YM035","Fever Tap","F9","2026-04-24"),
  cab("YM036","Wallapop","F9","2026-04-24"), cab("YM037","Spuki Inc","F9","2026-04-24"), cab("YM038","Summer Rae","F9","2026-04-24"),
  cab("YM039","Hai Plus","F9","2026-04-24"), cab("YM040","Sumi Jo","F9","2026-04-24"),
  cab("YM041","Fancy Indy","A3","2026-04-08"), cab("YM042","Sola Para Ti","A3","2026-04-08"),
  cab("YM043","Opera Pagliacci","A2","2026-04-24"), cab("YM044","Island Moon","A2","2026-04-24"),
  cab("YM045","Titanium Sale","A2","2026-04-24"), cab("YM046","Nayla Sam","A2","2026-04-24"),
  cab("YM047","Cala Celeste","B2",""), cab("YM048","Champein","B2",""), cab("YM049","Lola Chai","B2",""),
  cab("YM050","Carneggie Mellon","B2",""), cab("YM051","La Unica Dama","B2",""), cab("YM052","Accionada Cosmica","B2",""),
  cab("YM053","Thaddea","B6","2026-04-24"), cab("YM054","Sol Y Sol","B6","2026-04-24"), cab("YM055","Niquelada Rye","B6","2026-04-24"),
  cab("YM056","Indiana Catcher","B6","2026-04-24"), cab("YM057","Summer Violence","B6","2026-04-24"), cab("YM058","Bally Lee","B6","2026-04-24"),
  cab("YM059","Sandrin","B6","2026-04-24"), cab("YM060","Carmen Embrujada","B6","2026-04-24"), cab("YM061","Cheating Girl","B6","2026-04-24"),
  cab("YM062","Joy Niagara","B6","2026-04-24"), cab("YM063","Laudemio","B6","2026-04-24"), cab("YM064","Tapitai","B6","2026-04-24"),
  cab("YM065","Jazz Banda","B6","2026-04-24"), cab("YM066","Financial Aid","B6","2026-04-24"), cab("YM067","Acces Code","B6","2026-04-24"),
  cab("YM068","Angelic Air","B6","2026-04-24"), cab("YM069","Christofle","B6","2026-04-24"), cab("YM070","Wengen","B6","2026-04-24"),
  cab("YM071","Opera Lilly","B6","2026-04-24"), cab("YM072","Distar","B6","2026-04-24"), cab("YM073","La Hipnosis","B6","2026-04-24"),
  cab("YM074","Black Ice","B6","2026-04-24"), cab("YM075","Orpen Look","B6","2026-04-24"), cab("YM076","Pura Chispa","B6","2026-04-24"),
  cab("YM077","Luminosa Candy","B6","2026-04-24"), cab("YM078","Dona Lea","B6","2026-04-24"), cab("YM079","Chispitas","B6","2026-04-24"),
  cab("YM080","Swhengen","B6","2026-04-24"), cab("YM081","Crackdown","B6","2026-04-24"),
  cab("YM082","Summer Freedom","B3",""), cab("YM083","Dobrinka","B3",""), cab("YM084","American Voodoo","B3",""),
  cab("YM085","Miss Lute","B3",""), cab("YM086","Tarotista","B3",""), cab("YM087","Nina Berstein","B3",""),
  cab("YM088","Calshot","B3",""), cab("YM089","Fisher Pond","B3",""), cab("YM090","American Girl","B3",""),
  cab("YM091","Ready N Waiting","B3",""), cab("YM092","Salome Scent","B3",""), cab("YM093","Chispita","B3",""),
  cab("YM094","Summer Force","B3",""), cab("YM095","Miss Oasis","B3",""), cab("YM096","Brangelina","B3",""),
  cab("YM097","La Busanda","B3",""), cab("YM098","Dona Bibi","B3",""), cab("YM099","La Nicanora","B3",""),
  cab("YM100","Swiss Candy","F2","2026-04-08"), cab("YM101","Fantasy In Blue","F2","2026-04-08"), cab("YM102","Wild Wild Luck","F2","2026-04-08"),
  cab("YM103","Amelie Embrujada","F3","2026-04-08"), cab("YM104","Perfect Melody","F3","2026-04-08"), cab("YM105","Miss Shaun","F3","2026-04-08"),
  cab("YM106","Dream Tim","81","2026-04-24"), cab("YM107","Air Groove","81","2026-04-24"), cab("YM108","Kalavana","81","2026-04-24"),
  cab("YM109","Eslovenia","81","2026-04-24"), cab("YM110","Sonetta","81","2026-04-24"), cab("YM111","Torgau","81","2026-04-24"),
  cab("YM112","Carta Ganadora","81","2026-04-24"), cab("YM113","Girona Fever","81","2026-04-24"),
  cab("YM114","Fantasy In Red","81","2026-04-24"), cab("YM115","Thun","81","2026-04-24"),
];

const initRotaciones = [];

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
body{font-family:'DM Sans',sans-serif;background:#1a1410;color:#e8dcc8;min-height:100vh}
:root{--gold:#c8973a;--goldl:#e8b85a;--cream:#e8dcc8;--bd:#1a1410;--bm:#2d2318;--bc:#251c12;--bb:#3d2e1a}
.app{display:flex;height:100vh;overflow:hidden}
.sidebar{width:240px;flex-shrink:0;background:var(--bm);border-right:1px solid var(--bb);display:flex;flex-direction:column;overflow-y:auto}
.slogo{padding:24px 20px 20px;border-bottom:1px solid var(--bb)}
.slogo h1{font-family:'Playfair Display',serif;font-size:18px;color:var(--gold);line-height:1.2}
.slogo p{font-size:11px;color:#7a6a50;margin-top:3px;letter-spacing:2px;text-transform:uppercase}
.nsec{padding:16px 12px 8px}
.nlbl{font-size:10px;color:#5a4a30;letter-spacing:2px;text-transform:uppercase;padding:0 8px 8px}
.ni{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer;transition:all .15s;font-size:14px;color:#a89070;border:none;background:none;width:100%;text-align:left}
.ni:hover{background:var(--bc);color:var(--cream)}
.ni.active{background:rgba(200,151,58,.15);color:var(--gold)}
.ni .ic{font-size:18px;width:20px;text-align:center}
.main{flex:1;overflow-y:auto;background:var(--bd)}
.mh{padding:24px 32px 20px;border-bottom:1px solid var(--bb);display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px}
.mh h2{font-family:'Playfair Display',serif;font-size:26px;color:var(--cream)}
.mh p{font-size:13px;color:#7a6a50;margin-top:2px}
.cnt{padding:24px 32px}
.card{background:var(--bc);border:1px solid var(--bb);border-radius:12px;padding:20px;transition:border-color .2s}
.card:hover{border-color:#5a4a30}
.ct{font-family:'Playfair Display',serif;font-size:16px;color:var(--cream);margin-bottom:12px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
.ga{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.sv{font-family:'Playfair Display',serif;font-size:32px;color:var(--gold);line-height:1}
.sl{font-size:12px;color:#7a6a50;margin-top:4px}
.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:500;background:rgba(200,151,58,.15);color:var(--gold);border:1px solid rgba(200,151,58,.3);white-space:nowrap}
.badge.g{background:rgba(76,175,110,.15);color:#4caf6e;border-color:rgba(76,175,110,.3)}
.badge.o{background:rgba(232,160,32,.15);color:#e8a020;border-color:rgba(232,160,32,.3)}
.badge.b{background:rgba(80,140,224,.15);color:#508ce0;border-color:rgba(80,140,224,.3)}
.badge.r{background:rgba(224,80,80,.15);color:#e05050;border-color:rgba(224,80,80,.3)}
.table{width:100%;border-collapse:collapse;font-size:13px}
.table th{text-align:left;padding:8px 12px;color:#7a6a50;font-weight:500;font-size:11px;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid var(--bb)}
.table td{padding:10px 12px;border-bottom:1px solid rgba(61,46,26,.5);color:var(--cream);vertical-align:middle}
.table tr:last-child td{border-bottom:none}
.table tr:hover td{background:rgba(61,46,26,.4)}
.pc{background:var(--bc);border:1px solid var(--bb);border-radius:12px;padding:16px;cursor:pointer;transition:all .2s;position:relative}
.pc:hover{border-color:var(--gold);transform:translateY(-2px)}
.pn{font-family:'Playfair Display',serif;font-size:16px;color:var(--cream);margin-bottom:4px}
.sb{height:5px;border-radius:3px;background:var(--bb);overflow:hidden;margin:8px 0}
.sf{height:100%;border-radius:3px;transition:width .4s}
.btn{padding:8px 18px;border-radius:8px;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;transition:all .15s;display:inline-flex;align-items:center;gap:6px}
.bp{background:var(--gold);color:#1a1410}.bp:hover{background:var(--goldl)}
.bg{background:transparent;color:#a89070;border:1px solid var(--bb)}.bg:hover{border-color:var(--gold);color:var(--gold)}
.bd2{background:rgba(224,80,80,.15);color:#e05050;border:1px solid rgba(224,80,80,.3)}.bd2:hover{background:rgba(224,80,80,.25)}
.sm{padding:4px 10px;font-size:12px}
.mo{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px}
.md{background:var(--bc);border:1px solid var(--bb);border-radius:16px;padding:28px;width:100%;max-width:580px;max-height:90vh;overflow-y:auto}
.mtit{font-family:'Playfair Display',serif;font-size:20px;color:var(--cream);margin-bottom:20px}
.fg{margin-bottom:16px}
.fl{display:block;font-size:12px;color:#a89070;margin-bottom:6px;letter-spacing:.5px}
.fi{width:100%;padding:10px 12px;border-radius:8px;background:var(--bm);border:1px solid var(--bb);color:var(--cream);font-family:'DM Sans',sans-serif;font-size:14px;outline:none;transition:border-color .15s}
.fi:focus{border-color:var(--gold)}
.fi option{background:var(--bm)}
.fr{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.cg{display:flex;flex-wrap:wrap;gap:8px}
.ci{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:6px;border:1px solid var(--bb);cursor:pointer;font-size:12px;color:#a89070;transition:all .15s;background:var(--bm)}
.ci.ck{border-color:var(--gold);color:var(--gold);background:rgba(200,151,58,.1)}
.ci input{display:none}
.ir{display:flex;justify-content:space-between;align-items:flex-start;padding:9px 0;border-bottom:1px solid rgba(61,46,26,.5);font-size:13px;gap:12px}
.ir:last-child{border-bottom:none}
.ik{color:#7a6a50;white-space:nowrap}
.iv{color:var(--cream);font-weight:500;text-align:right}
.hc{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;background:var(--bm);border:1px solid var(--bb);font-size:13px;margin-bottom:8px}
.tl{position:relative;padding-left:20px}
.tl::before{content:'';position:absolute;left:6px;top:0;bottom:0;width:2px;background:var(--bb);border-radius:2px}
.tli{position:relative;margin-bottom:16px}
.tld{position:absolute;left:-17px;top:4px;width:10px;height:10px;border-radius:50%;background:var(--gold);border:2px solid var(--bc)}
.tdt{font-size:11px;color:#7a6a50;margin-bottom:2px}
.tbd{font-size:13px;color:var(--cream)}
.tmeta{font-size:12px;color:#a89070;margin-top:2px}
.stit{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5a4a30;margin-bottom:12px;font-weight:500}
.tag{display:inline-block;padding:3px 8px;border-radius:4px;font-size:11px;background:rgba(61,46,26,.8);color:#a89070;margin:2px}
.es{text-align:center;padding:36px 24px;color:#5a4a30;font-size:14px}
.fb{display:flex}.fbt{display:flex;justify-content:space-between;align-items:center}.fw{flex-wrap:wrap}
.g2p{gap:8px}.g3p{gap:12px}
.mt2{margin-top:8px}.mt3{margin-top:12px}.mt4{margin-top:16px}
.mb2{margin-bottom:8px}.mb3{margin-bottom:12px}.mb4{margin-bottom:16px}
.tg{color:var(--gold)}.tm{color:#7a6a50}.ts{font-size:13px}.txs{font-size:11px}
.div{height:1px;background:var(--bb);margin:16px 0}
.li{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(61,46,26,.4);font-size:13px}
.li:last-child{border-bottom:none}
.search-input{width:100%;padding:9px 14px;border-radius:8px;background:var(--bm);border:1px solid var(--bb);color:var(--cream);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;margin-bottom:16px}
.search-input:focus{border-color:var(--gold)}
`;

export default function HarasApp(){
  const [view,setView]=useState("dashboard");
  const [lotes,setLotes]=useState(initLotes);
  const [caballos,setCaballos]=useState(initCaballos);
  const [rotaciones,setRotaciones]=useState(initRotaciones);
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
        const desmalezadasDb = await sbSelect("desmalezadas");
        if(desmalezadasDb && desmalezadasDb.length > 0){
          setDesmalezadas(desmalezadasDb.map(d=>({id:d.id,loteId:d.lote_id,fecha:d.fecha,notas:d.notas||""})));
        }
        if(caballosDb && caballosDb.length > 0){
          setCaballos(caballosDb.map(c=>({
            id: c.id, nombre: c.nombre, categoria: c.categoria,
            alimentos: c.alimentos || [], loteId: c.lote_id,
            fechaIngreso: c.fecha_ingreso || "", peso: c.peso || "",
            color: c.color || "",
          })));
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
    await sbUpsert("caballos", [{
      id: c.id, nombre: c.nombre, categoria: c.categoria,
      alimentos: c.alimentos, lote_id: c.loteId,
      fecha_ingreso: c.fechaIngreso||null, peso: c.peso||null, color: c.color||null,
    }]);
  }
  const [selLote,setSelLote]=useState(null);
  const [modal,setModal]=useState(null);
  const [editId,setEditId]=useState(null);
  const [intervPid,setIntervPid]=useState(null);
  const [lluviaPid,setLluviaPid]=useState(null);
  const [desmPid,setDesmPid]=useState(null);
  const [desmalezadas,setDesmalezadas]=useState([]);
  const [busqueda,setBusqueda]=useState("");

  const EL={nombre:"",hectareas:"",ultimaDesmalezada:"",notas:"",ultimaSiembra:"",queSembro:"",fechaVacio:"",tieneRiego:false,riegoDiario:""};
  const EC={nombre:"",categoria:CATEGORIAS[0],alimentos:[],loteId:"",peso:"",color:"",fechaIngreso:hoy()};
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

  const cabsDe=(lid)=>caballos.filter(c=>c.loteId===lid);

  // Stock total: last known tot from STOCK_HISTORIAL, else named horses
  const stockTotal=(lid)=>{
    const hist=STOCK_HISTORIAL[lid];
    if(hist&&hist.length>0){
      const last=[...hist].reverse().find(m=>m.tot!==null&&m.tot!==undefined);
      if(last!==undefined) return last.tot;
    }
    return cabsDe(lid).length;
  };
  const stockUltimaFecha=(lid)=>{
    const hist=STOCK_HISTORIAL[lid];
    if(!hist||!hist.length) return null;
    const last=[...hist].reverse().find(m=>m.tot!==null&&m.tot!==undefined);
    return last?last.f:null;
  };

  const primerIngreso=(lid)=>{
    const hs=cabsDe(lid);
    if(!hs.length) return null;
    const fechas=hs.map(h=>h.fechaIngreso).filter(Boolean).sort();
    return fechas.length?fechas[0]:null;
  };

  const lotesFiltrados=useMemo(()=>{
    if(!busqueda)return lotes;
    return lotes.filter(l=>l.nombre.toLowerCase().includes(busqueda.toLowerCase()));
  },[lotes,busqueda]);

  const stats=useMemo(()=>({
    totalCabs:caballos.length,
    totalLotes:lotes.length,
    ocup:lotes.filter(l=>stockTotal(l.id)>0).length,
    haTotal:lotes.reduce((s,l)=>s+(l.hectareas||0),0).toFixed(1),
    cats:CATEGORIAS.reduce((a,c)=>{a[c]=caballos.filter(x=>x.categoria===c).length;return a},{}),
  }),[caballos,lotes]);

  function closeModal(){setModal(null);setEditId(null);setIntervPid(null);setLluviaPid(null);setDesmPid(null);setFL(EL);setFC(EC);setFI(EI);setFLl(ELl);setFR(ER);setFD(ED);}

  function saveCab(){
    if(!fC.nombre||!fC.loteId)return;
    const newC = editId ? {...caballos.find(c=>c.id===editId),...fC} : {...fC,id:"C"+Date.now()};
    if(editId) setCaballos(p=>p.map(c=>c.id===editId?newC:c));
    else setCaballos(p=>[...p,newC]);
    saveCaballoToDb(newC);
    closeModal();
  }
  function delCab(id){setCaballos(p=>p.filter(c=>c.id!==id)); sbDelete("caballos",id);}
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
    setDesmalezadas(p=>p.filter(d=>d.id!==id));
    sbDelete("desmalezadas",id);
  }

  function saveInterv(){
    if(!fI.elemento||!intervPid)return;
    setLotes(p=>p.map(x=>x.id===intervPid?{...x,intervenciones:[...x.intervenciones,{...fI,id:"I"+Date.now()}]}:x));
    closeModal();
  }
  function delInterv(lid,iid){setLotes(p=>p.map(x=>x.id===lid?{...x,intervenciones:x.intervenciones.filter(i=>i.id!==iid)}:x));}

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

  const nav=[{id:"dashboard",ic:"◈",lb:"Dashboard"},{id:"lotes",ic:"⬡",lb:"Lotes"},{id:"caballos",ic:"⚘",lb:"Caballos"},{id:"rotaciones",ic:"↻",lb:"Rot. Cultivos"}];

  return(
    <>
      <style>{css}</style>
      <div className="app">
        <aside className="sidebar">
          <div className="slogo"><h1>Haras<br/>Manager</h1><p>Sistema de gestión</p></div>
          <div className="nsec">
            <div className="nlbl">Menú</div>
            {nav.map(n=>(
              <button key={n.id} className={`ni ${view===n.id?"active":""}`} onClick={()=>{setView(n.id);setSelLote(null);setBusqueda("");}}>
                <span className="ic">{n.ic}</span>{n.lb}
              </button>
            ))}
          </div>
          <div className="nsec" style={{marginTop:"auto",borderTop:"1px solid var(--bb)",paddingTop:16}}>
            <div className="nlbl">Resumen</div>
            <div style={{padding:"8px 12px 4px",fontSize:11,color:dbConnected?"#4caf6e":"#7a6a50"}}>
            {dbConnected?"● Base de datos conectada":"○ Datos locales"}
          </div>
          <div style={{padding:"4px 12px",fontSize:13,color:"#a89070"}}>
              <div style={{marginBottom:4}}><span className="tg" style={{fontFamily:"Playfair Display,serif",fontSize:20}}>{stats.totalCabs}</span> con nombre</div>
              <div style={{marginBottom:4}}><span className="tg" style={{fontFamily:"Playfair Display,serif",fontSize:20}}>{stats.totalLotes}</span> lotes</div>
              <div><span className="tg" style={{fontFamily:"Playfair Display,serif",fontSize:20}}>{stats.haTotal}</span> <span style={{fontSize:12}}>ha</span></div>
            </div>
          </div>
        </aside>

        <main className="main">

          {/* DASHBOARD */}
          {view==="dashboard"&&(
            <>
              <div className="mh"><div><h2>Panel general</h2><p>Vista consolidada del haras</p></div></div>
              <div className="cnt">
                <div className="g3 mb4" style={{marginBottom:20}}>
                  {[{v:stats.totalCabs,l:"Caballos con nombre"},{v:stats.totalLotes,l:"Lotes totales"},{v:`${stats.haTotal} ha`,l:"Superficie total"}].map((s,i)=>(
                    <div key={i} className="card"><div className="sv">{s.v}</div><div className="sl">{s.l}</div></div>
                  ))}
                </div>
                <div className="card">
                  <div className="fbt mb3">
                    <div className="ct" style={{marginBottom:0}}>Estado de lotes</div>
                    <button className="btn bg sm" onClick={()=>setView("lotes")}>Ver todos →</button>
                  </div>
                  <table className="table">
                    <thead><tr><th>Lote</th><th>Ha</th><th>Animales</th><th>Pastoreando</th><th>Descanso</th><th>Últ. desmalezada</th><th>Pastura</th></tr></thead>
                    <tbody>
                      {lotes.map(l=>{
                        const n=stockTotal(l.id);
                        const est=estadoPastura(diasDesde(l.ultimaDesmalezada));
                        const fp=primerIngreso(l.id);
                        const dp=fp?diasDesde(fp):null;
                        const dd=l.fechaVacio&&n===0?diasDesde(l.fechaVacio):null;
                        return(
                          <tr key={l.id} style={{cursor:"pointer"}} onClick={()=>{setView("lotes");setSelLote(l.id);}}>
                            <td><button style={{background:"none",border:"none",cursor:"pointer",color:"var(--gold)",fontWeight:600,fontSize:13,padding:0,textDecoration:"underline"}} onClick={()=>{setView("lotes");setSelLote(l.id);}}>{l.nombre}</button></td>
                            <td className="tm">{l.hectareas||"—"}</td>
                            <td>{n>0?n:<span className="tm">0</span>}</td>
                            <td>{n>0&&dp!==null?<span className="tg">{dp}d</span>:<span className="tm">—</span>}</td>
                            <td>{n===0&&dd!==null?<span style={{color:"#4caf6e"}}>{dd}d</span>:<span className="tm">—</span>}</td>
                            <td>{fmt(l.ultimaDesmalezada)}</td>
                            <td><span className="badge" style={{background:`${est.color}20`,color:est.color,borderColor:`${est.color}40`}}>{est.label}</span></td>
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
                <div><h2>Lotes</h2><p>{lotes.length} lotes · {stats.haTotal} ha totales</p></div>
                <button className="btn bp" onClick={()=>{setEditId(null);setFL(EL);setModal("lote");}}>+ Nuevo lote</button>
              </div>
              <div className="cnt">
                <input className="search-input" placeholder="Buscar lote…" value={busqueda} onChange={e=>setBusqueda(e.target.value)}/>
                <div className="ga">
                  {lotesFiltrados.map(l=>{
                    const n=stockTotal(l.id);
                    const est=estadoPastura(diasDesde(l.ultimaDesmalezada));
                    const fp=primerIngreso(l.id);
                    const dp=fp?diasDesde(fp):null;
                    const dd=l.fechaVacio&&n===0?diasDesde(l.fechaVacio):null;
                    return(
                      <div key={l.id} className="pc" style={{borderLeft:`4px solid ${est.color}`}} onClick={()=>setSelLote(l.id)}>
                        <div className="fbt" style={{marginBottom:4}}>
                          <div className="pn">{l.nombre}</div>
                          <span className="badge" style={{background:`${est.color}20`,color:est.color,borderColor:`${est.color}40`,fontSize:10}}>{est.label}</span>
                        </div>
                        <div className="tm txs" style={{marginBottom:10}}>{l.hectareas?`${l.hectareas} ha`:""} · {n} animales</div>
                        {dp!==null&&n>0&&<div className="ir" style={{padding:"6px 0"}}><span className="ik">Pastoreando</span><span className="iv tg">{dp}d</span></div>}
                        {dd!==null&&<div className="ir" style={{padding:"6px 0"}}><span className="ik">Descanso</span><span className="iv" style={{color:"#4caf6e"}}>{dd}d</span></div>}
                        <div className="ir" style={{padding:"6px 0"}}><span className="ik">Desmalezada</span><span className="iv">{fmt(l.ultimaDesmalezada)}</span></div>
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
            const pres=calcPresion(nTotal,l.hectareas);
            const fp=primerIngreso(l.id);
            const dp=fp?diasDesde(fp):null;
            const dd=l.fechaVacio&&nTotal===0?diasDesde(l.fechaVacio):null;
            const ds=diasDesde(l.ultimaSiembra);
            const llTotal=(l.lluvias||[]).reduce((s,x)=>s+x.mm,0);
            return(
              <>
                <div className="mh">
                  <div>
                    <button className="btn bg sm" style={{marginBottom:8}} onClick={()=>setSelLote(null)}>← Volver</button>
                    <h2>Lote {l.nombre}</h2>
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
                      {dp!==null&&nTotal>0&&<div className="ir"><span className="ik">Días pastoreando</span><span className="iv tg">{dp} días</span></div>}
                      {dd!==null&&<div className="ir"><span className="ik">En descanso desde</span><span className="iv" style={{color:"#4caf6e"}}>{fmt(l.fechaVacio)} <span className="tm txs">({dd}d)</span></span></div>}
                      <div className="ir"><span className="ik">Superficie</span><span className="iv">{l.hectareas?`${l.hectareas} ha`:"—"}</span></div>
                      <div className="ir"><span className="ik">Presión de pastoreo</span><span className="iv">{pres?`${pres} cab/ha`:"—"}</span></div>
                      {pres&&<div className="mt2 txs" style={{color:"#a89070"}}>{parseFloat(pres)>1.5?"⚠️ Presión alta — considerar rotar":parseFloat(pres)>0.8?"✓ Presión moderada":"✓ Presión baja"}</div>}
                    </div>

                    <div className="card">
                      <div className="fbt mb3">
                        <div className="stit" style={{marginBottom:0}}>Animales actuales</div>
                        <span className="tg" style={{fontFamily:"Playfair Display,serif",fontSize:24}}>{nTotal}</span>
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
                                     <div style={{color:"var(--cream)",fontWeight:500}}>{h.nombre}</div>
                                     <div className="tm txs">{h.categoria}{h.fechaIngreso?` · ${diasDesde(h.fechaIngreso)} días aquí`:""}</div>
                                   </div>
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
                      <div className="ir"><span className="ik">Total lluvia registrada</span><span className="iv tg">{llTotal} mm</span></div>
                      <div className="div"/>
                      <div className="stit">Lluvias</div>
                      {!(l.lluvias||[]).length
                        ?<div className="tm txs">Sin registros</div>
                        :[...(l.lluvias||[])].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(x=>(
                          <div key={x.id} className="li">
                            <span>{fmt(x.fecha)}</span>
                            <div className="fb g2p"><span className="badge b">{x.mm} mm</span><button className="btn bd2 sm" style={{padding:"2px 7px"}} onClick={()=>delLluvia(l.id,x.id)}>✕</button></div>
                          </div>
                        ))
                      }
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
                <div><h2>Caballos</h2><p>{caballos.length} registros con nombre</p></div>
                <button className="btn bp" onClick={()=>{setEditId(null);setFC(EC);setModal("cab");}}>+ Nuevo caballo</button>
              </div>
              <div className="cnt">
                <div className="card">
                  {caballos.length===0
                    ?<div className="es"><div style={{fontSize:40,marginBottom:12}}>🐴</div>Sin caballos registrados.</div>
                    :<table className="table">
                      <thead><tr><th>Nombre</th><th>Categoría</th><th>Color</th><th>Peso</th><th>Lote</th><th>Días</th><th>Alimentos</th><th></th></tr></thead>
                      <tbody>
                        {caballos.map(c=>{
                          const lot=lotes.find(l=>l.id===c.loteId);
                          return(
                            <tr key={c.id}>
                              <td><strong>{c.nombre}</strong></td>
                              <td><span className="badge">{c.categoria}</span></td>
                              <td className="tm txs">{c.color||"—"}</td>
                              <td>{c.peso?`${c.peso} kg`:"—"}</td>
                              <td>{lot?<button style={{background:"none",border:"none",cursor:"pointer",color:"var(--gold)",fontWeight:500,fontSize:13,padding:0,textDecoration:"underline"}} onClick={()=>{setView("lotes");setSelLote(lot.id);}}>{lot.nombre}</button>:"—"}</td>
                              <td className="tg" style={{fontWeight:500}}>{c.fechaIngreso?`${diasDesde(c.fechaIngreso)}d`:"—"}</td>
                              <td style={{maxWidth:180}}>{c.alimentos.map(a=><span key={a} className="tag">{a}</span>)}</td>
                              <td><div className="fb g2p">
                                <button className="btn bg sm" onClick={()=>editCab(c)}>Editar</button>
                                <button className="btn bd2 sm" onClick={()=>delCab(c.id)}>✕</button>
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

          {/* ROTACIONES */}
          {view==="rotaciones"&&(
            <>
              <div className="mh">
                <div><h2>Rotación de cultivos</h2><p>Historial de siembras por lote</p></div>
                
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
                                onClick={()=>{setView("lotes");setSelLote(l.id);}}>
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
                <button className="btn bp" onClick={saveCab}>{editId?"Guardar":"Registrar"}</button>
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
