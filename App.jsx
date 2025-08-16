import React, { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Bernard Bau – Projektplan (4K & Mobile)
 * - Wochen / Monate / Jahr (max. 12 Monate)
 * - Vorarbeiter, Baustelle, Ort, Chef, Techniker, Start/Ende
 * - Filter + Suche
 * - Export: PNG & PDF
 * - Speichern/Laden (localStorage) inkl. letzter Bearbeiter + Datum
 * - Heller Hintergrund, moderne Farben
 * - Am Ende: eigenes Raster (Tabelle) für "Noch zuzuweisen"
 */

// ---- Hilfsfunktionen ----
const parseISO = (s) => new Date(s + "T00:00:00");
const toISO = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const startOfWeek = (d) => { const day = (d.getDay() + 6) % 7; return addDays(d, -day); };
const endOfWeek = (d) => addDays(startOfWeek(d), 6);
const diffDays = (a, b) => Math.ceil((b - a) / (1000 * 60 * 60 * 24));
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const fmtDate = (d) => new Intl.DateTimeFormat("de-IT", { dateStyle: "medium", timeZone: "Europe/Rome" }).format(d);
const fmtShort = (d) => new Intl.DateTimeFormat("de-IT", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Rome" }).format(d);
const monthLabel = (d) => new Intl.DateTimeFormat("de-IT", { month: "short", year: "numeric" }).format(d);
const getISOWeek = (date) => { const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); const dayNum = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - dayNum); const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7); return { year: d.getUTCFullYear(), week: weekNo }; };

// Farbpalette pro Chef (helle, angenehme Farben)
const CHEF_COLORS = { DAN: "#60a5fa", HAN: "#34d399", MARK: "#fbbf24", DEFAULT: "#c084fc" };

const guessDeviceName = () => {
  const ua = navigator.userAgent;
  const os = /Windows/i.test(ua) ? "Windows" : /Mac OS X/i.test(ua) ? "macOS" : /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : "Gerät";
  const browser = /Chrome\\//i.test(ua) ? "Chrome" : /Safari\\//i.test(ua) ? "Safari" : /Firefox\\//i.test(ua) ? "Firefox" : "Browser";
  return `${os} · ${browser}`;
};

// ---- Startdaten (aus deiner Liste) ----
const initialAssignments = [
  { id: "1",  vorarbeiter: "Aberham Andreas",  baustelle: "Waldheim Reihenhäuser", ort: "Aldein",     chef: "DAN", techniker: "Letizia", start: "2025-05-20", ende: "2025-11-03" },
  { id: "2",  vorarbeiter: "Aberham Martin",   baustelle: "Hotel Seehauser",       ort: "Welschnofen", chef: "DAN", techniker: "Letizia", start: "2025-05-01", ende: "2025-10-29" },
  { id: "3",  vorarbeiter: "Aberham Simon",    baustelle: "Dichristin Stefan",      ort: "Kaltern",    chef: "HAN", techniker: "Simon",   start: "2025-07-28", ende: "2026-02-06" },
  { id: "4",  vorarbeiter: "Bamhakl Günther",  baustelle: "SASS RIGAIS",            ort: "Villnöss",   chef: "MARK", techniker: "Lena",    start: "2025-08-01", ende: "2026-03-26" },
  { id: "5a", vorarbeiter: "Daum Andreas",     baustelle: "Krankheit",              ort: "",           chef: "",     techniker: "",        start: "2025-08-08", ende: "2025-10-31" },
  { id: "5b", vorarbeiter: "Daum Andreas",     baustelle: "WEINGARTEN GARAGE",      ort: "Kaltern",    chef: "HAN", techniker: "",        start: "2025-11-03", ende: "2026-04-03" },
  { id: "6",  vorarbeiter: "Gurndin Christoph",baustelle: "Runggatscher",           ort: "Eppan",      chef: "HAN", techniker: "",        start: "2025-07-29", ende: "2025-10-20" },
  { id: "7",  vorarbeiter: "Heinz Markus",     baustelle: "INVESTA Frasnelli",      ort: "Montan",     chef: "HAN", techniker: "Tobias",  start: "2025-06-10", ende: "2026-08-03" },
  { id: "8",  vorarbeiter: "Köhl Günther",     baustelle: "KELLEREI TRAMIN",        ort: "Tramin",     chef: "HAN", techniker: "Alberto", start: "2025-08-28", ende: "2025-11-26" },
  { id: "9",  vorarbeiter: "Mauracher Matthias",baustelle:"ABSAM Hütte",             ort: "Obereggen",  chef: "HAN", techniker: "Herbst",  start: "2025-05-19", ende: "2025-08-22" },
  { id: "10a",vorarbeiter: "Pernstich Wilhelm",baustelle: "Brunner Armin",          ort: "Margreid",   chef: "HAN", techniker: "Letizia", start: "2025-06-30", ende: "2025-08-15" },
  { id: "10b",vorarbeiter: "Pernstich Wilhelm",baustelle: "HOTEL IDEAL",            ort: "Leifers",    chef: "DAN", techniker: "Letizia", start: "2025-08-28", ende: "2027-01-13" },
  { id: "11", vorarbeiter: "Tobias Sanoll",    baustelle: "Frei",                   ort: "",           chef: "",     techniker: "",        start: "2025-08-04", ende: "2025-08-04" },
  { id: "12", vorarbeiter: "Resch Andreas",    baustelle: "ALM",                    ort: "",           chef: "",     techniker: "",        start: "2025-04-21", ende: "2025-10-24" },
  { id: "13a",vorarbeiter: "Sartori Valter",   baustelle: "Berofin I",              ort: "Gardasee",   chef: "MARK", techniker: "Alberto", start: "2025-05-05", ende: "2025-07-29" },
  { id: "13b",vorarbeiter: "Sartori Valter",   baustelle: "Berofin II",             ort: "Gardasee",   chef: "MARK", techniker: "Alberto", start: "2025-09-01", ende: "2026-01-02" },
  { id: "14a",vorarbeiter: "Gian Paolo",       baustelle: "KELLEREI Steinhaus",     ort: "Salurn",     chef: "DAN", techniker: "Alberto", start: "2024-12-01", ende: "2025-08-07" },
  { id: "14b",vorarbeiter: "Gian Paolo",       baustelle: "Frei",                   ort: "",           chef: "",     techniker: "",        start: "2025-08-07", ende: "2025-08-07" },
  { id: "15", vorarbeiter: "Scavelli Sebastiano",baustelle:"Schulmensa",            ort: "Jenesien",   chef: "DAN", techniker: "Tobias",  start: "2025-03-03", ende: "2025-09-12" },
  { id: "16", vorarbeiter: "Vaccaro Nicola",   baustelle: "Kavada",                 ort: "Bozen",      chef: "MARK", techniker: "Lena",    start: "2025-06-18", ende: "2025-08-12" },
  { id: "17", vorarbeiter: "Sergiu Iliesov",   baustelle: "Frei",                   ort: "",           chef: "",     techniker: "",        start: "2025-08-28", ende: "2025-08-28" },
  { id: "18a",vorarbeiter: "Wieser Alex",      baustelle: "Jablonsky",              ort: "Kaltern",    chef: "HAN", techniker: "Lena",    start: "2025-07-07", ende: "2025-09-26" },
  { id: "18b",vorarbeiter: "Wieser Alex",      baustelle: "SCHATZER RITZ",          ort: "Eppan",      chef: "HAN", techniker: "Simon",   start: "2025-09-22", ende: "2026-01-09" },
  { id: "19", vorarbeiter: "Vilaj Urim",       baustelle: "Reiseggerhof",           ort: "Buchholz",   chef: "MARK", techniker: "",        start: "2025-08-28", ende: "2026-03-25" },
  { id: "20a",vorarbeiter: "Visar",            baustelle: "Kindergarten Laag",      ort: "Laag",       chef: "DAN", techniker: "Osti",    start: "2025-06-30", ende: "2025-09-05" },
  { id: "20b",vorarbeiter: "Visar",            baustelle: "EDYNA POMELLA",          ort: "Kurtatsch",  chef: "DAN", techniker: "Letizia", start: "2025-09-01", ende: "2025-10-10" },
  { id: "21a",vorarbeiter: "Noch zuzuweisen",  baustelle: "Ex Kastion",             ort: "Buchholz",   chef: "",     techniker: "",        start: "2025-10-01", ende: "2025-12-23" },
  { id: "21b",vorarbeiter: "Noch zuzuweisen",  baustelle: "Leonhard",               ort: "",           chef: "DAN", techniker: "",        start: "2025-10-01", ende: "2026-04-06" },
  { id: "21c",vorarbeiter: "Noch zuzuweisen",  baustelle: "Kindergarten Pfatten",   ort: "Pfatten",    chef: "HAN", techniker: "Simon",   start: "2025-09-15", ende: "2026-01-02" },
];

// ---- Component ----
export default function Terminplaner() {
  const [items, setItems] = useState(() => { const saved = localStorage.getItem("bb_terminplan_items"); return saved ? JSON.parse(saved) : initialAssignments; });
  const [view, setView] = useState(() => localStorage.getItem("bb_terminplan_view") || "Monat");
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem("bb_terminplan_zoom") || 1));
  const [filter, setFilter] = useState({ vorarbeiter: "", chef: "", techniker: "", baustelle: "", q: "" });
  const [editorName, setEditorName] = useState(() => localStorage.getItem("bb_terminplan_editor") || guessDeviceName());
  const [lastSaved, setLastSaved] = useState(() => { const meta = localStorage.getItem("bb_terminplan_meta"); return meta ? JSON.parse(meta) : null; });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: "", vorarbeiter: "", baustelle: "", ort: "", chef: "", techniker: "", start: "", ende: "" });
  const [editingId, setEditingId] = useState(null);

  const timelineRef = useRef(null);
  const wrapperRef = useRef(null);

  // Filtered items
  const filtered = useMemo(() => {
    const q = filter.q.trim().toLowerCase();
    return items.filter((it) => {
      if (filter.vorarbeiter && it.vorarbeiter !== filter.vorarbeiter) return false;
      if (filter.chef && it.chef !== filter.chef) return false;
      if (filter.techniker && it.techniker !== filter.techniker) return false;
      if (filter.baustelle && it.baustelle !== filter.baustelle) return false;
      if (q) { const bucket = `${it.vorarbeiter} ${it.baustelle} ${it.ort} ${it.chef} ${it.techniker}`.toLowerCase(); if (!bucket.includes(q)) return false; }
      return true;
    });
  }, [items, filter]);

  // Gruppen: zugewiesen vs. noch zuzuweisen
  const assigned   = useMemo(() => filtered.filter(it => (it.vorarbeiter || "").toLowerCase() !== "noch zuzuweisen"), [filtered]);
  const unassigned = useMemo(() => filtered.filter(it => (it.vorarbeiter || "").toLowerCase() ===  "noch zuzuweisen"), [filtered]);

  // Zeitspanne berechnen (max 12 Monate in Jahresansicht)
  const { tStart, tEnd } = useMemo(() => {
    const list = assigned.length ? assigned : filtered;
    if (!list.length) { const today = new Date(); return { tStart: startOfMonth(today), tEnd: addDays(today, 30) }; }
    let minS = parseISO(list[0].start), maxE = parseISO(list[0].ende);
    for (const it of list) { const s = parseISO(it.start); const e = parseISO(it.ende); if (s < minS) minS = s; if (e > maxE) maxE = e; }
    if (view === "Woche") { minS = startOfWeek(minS); maxE = endOfWeek(maxE); }
    else if (view === "Monat") { minS = startOfMonth(minS); maxE = endOfMonth(maxE); }
    else if (view === "Jahr") { const begin = startOfMonth(minS); const end = new Date(begin.getFullYear(), begin.getMonth() + 11, 31); return { tStart: begin, tEnd: end < maxE ? end : maxE }; }
    return { tStart: minS, tEnd: maxE };
  }, [assigned, filtered, view]);

  const totalDays = Math.max(1, diffDays(tStart, addDays(tEnd, 1)));
  const basePxPerDay = view === "Woche" ? 16 : view === "Monat" ? 6 : 3;
  const pxPerDay = basePxPerDay * zoom;
  const timelineWidth = Math.max(600, Math.round(totalDays * pxPerDay));

  // Header-Ticks (Monate / Wochen)
  const ticks = useMemo(() => {
    const list = [];
    if (view === "Woche") {
      let cur = startOfWeek(tStart);
      while (cur <= tEnd) { const { year, week } = getISOWeek(cur); const x = Math.round(diffDays(tStart, cur) * pxPerDay); list.push({ x, label: `KW ${week} ${year}` }); cur = addDays(cur, 7); }
    } else {
      let cur = startOfMonth(tStart);
      while (cur <= tEnd) { const x = Math.round(diffDays(tStart, cur) * pxPerDay); list.push({ x, label: monthLabel(cur) }); cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); }
    }
    return list;
  }, [tStart, tEnd, pxPerDay, view]);

  const unique = (arr) => Array.from(new Set(arr.filter(Boolean)));
  const allVorarbeiter = useMemo(() => unique(items.map((i) => i.vorarbeiter)), [items]);
  const allChefs = useMemo(() => unique(items.map((i) => i.chef)), [items]);
  const allTechniker = useMemo(() => unique(items.map((i) => i.techniker)), [items]);
  const allBaustellen = useMemo(() => unique(items.map((i) => i.baustelle)), [items]);

  // Speichern
  const saveAll = () => {
    localStorage.setItem("bb_terminplan_items", JSON.stringify(items));
    localStorage.setItem("bb_terminplan_view", view);
    localStorage.setItem("bb_terminplan_zoom", String(zoom));
    localStorage.setItem("bb_terminplan_editor", editorName);
    const when = new Date();
    const meta = { editorName, when: when.toISOString() };
    localStorage.setItem("bb_terminplan_meta", JSON.stringify(meta));
    setLastSaved(meta);
  };

  // Export PNG
  const exportPNG = async () => {
    if (!wrapperRef.current) return;
    const node = wrapperRef.current;
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a"); a.href = url; a.download = `Terminplan_${new Date().toISOString().slice(0, 10)}.png`; a.click();
  };

  // Export PDF (A3 quer, mehrseitig bei Bedarf)
  const exportPDF = async () => {
    if (!wrapperRef.current) return;
    const node = wrapperRef.current;
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    } else {
      let position = 0;
      while (position < imgHeight) {
        pdf.addImage(imgData, "PNG", 0, -position, imgWidth, imgHeight);
        position += pageHeight;
        if (position < imgHeight) pdf.addPage();
      }
    }
    pdf.save(`Terminplan_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // Form helpers
  const openNew = () => { setEditingId(null); setForm({ id: "", vorarbeiter: "", baustelle: "", ort: "", chef: "", techniker: "", start: "", ende: "" }); setShowForm(true); };
  const openEdit = (id) => { const it = items.find((x) => x.id === id); if (!it) return; setEditingId(id); setForm(it); setShowForm(true); };
  const submitForm = () => {
    if (!form.vorarbeiter || !form.baustelle || !form.start || !form.ende) { alert("Bitte Vorarbeiter, Baustelle, Start und Ende ausfüllen."); return; }
    const payload = { ...form, id: editingId || String(Date.now()) };
    const next = editingId ? items.map((it) => (it.id === editingId ? payload : it)) : [...items, payload];
    setItems(next); setShowForm(false);
  };
  const deleteItem = (id) => { if (!confirm("Eintrag wirklich löschen?")) return; setItems(items.filter((i) => i.id !== id)); };

  // Bar-Koordinaten
  const calcBar = (startISO, endISO) => {
    const s = parseISO(startISO), e = parseISO(endISO);
    const leftDays = clamp(diffDays(tStart, s), 0, totalDays);
    const rightDays = clamp(diffDays(tStart, addDays(e, 1)), 0, totalDays);
    const left = Math.round(leftDays * pxPerDay);
    const width = Math.max(2, Math.round((rightDays - leftDays) * pxPerDay));
    return { left, width };
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 text-gray-900 p-4 md:p-6">
      <div className="max-w-[1800px] mx-auto">
        <header className="mb-4 md:mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Bernard Bau – Projektplan</h1>
          <p className="text-sm text-gray-600 mt-1">Spaltenansicht nach {view === "Woche" ? "Kalenderwochen" : view === "Monat" ? "Monaten" : "Monaten (max. 12)"}. Heller Hintergrund. Farben je Chef.</p>
          <div className="mt-2 text-xs text-gray-500">{lastSaved ? (<span>Zuletzt gespeichert von <span className="font-medium">{lastSaved.editorName}</span> am {fmtDate(new Date(lastSaved.when))}</span>) : (<span>Noch nicht gespeichert</span>)}</div>
        </header>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end bg-white rounded-2xl shadow p-3 md:p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 flex-1">
            <select className="border rounded px-2 py-2" value={filter.vorarbeiter} onChange={(e) => setFilter({ ...filter, vorarbeiter: e.target.value })}>
              <option value="">Vorarbeiter (alle)</option>
              {allVorarbeiter.map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
            <select className="border rounded px-2 py-2" value={filter.baustelle} onChange={(e) => setFilter({ ...filter, baustelle: e.target.value })}>
              <option value="">Baustelle (alle)</option>
              {allBaustellen.map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
            <select className="border rounded px-2 py-2" value={filter.chef} onChange={(e) => setFilter({ ...filter, chef: e.target.value })}>
              <option value="">Chef (alle)</option>
              {allChefs.map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
            <select className="border rounded px-2 py-2" value={filter.techniker} onChange={(e) => setFilter({ ...filter, techniker: e.target.value })}>
              <option value="">Techniker (alle)</option>
              {allTechniker.map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
            <input className="border rounded px-3 py-2 col-span-2" placeholder="Suche… (Name, Ort, Baustelle)" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-xl p-1">
              {["Woche", "Monat", "Jahr"].map((m) => (
                <button key={m} onClick={() => setView(m)} className={`px-3 py-2 rounded-lg text-sm ${view === m ? "bg-white shadow font-semibold" : "text-gray-600"}`}>{m}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Zoom</span>
              <input type="range" min={0.5} max={2.5} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button onClick={openNew} className="px-4 py-2 rounded-xl bg-blue-600 text-white shadow">+ Eintrag</button>
          <button onClick={saveAll} className="px-4 py-2 rounded-xl bg-amber-500 text-white shadow">Speichern</button>
          <button onClick={exportPNG} className="px-4 py-2 rounded-xl bg-emerald-600 text-white shadow">Export PNG</button>
          <button onClick={exportPDF} className="px-4 py-2 rounded-xl bg-emerald-700 text-white shadow">Export PDF</button>
          <div className="ml-auto flex items-center gap-2 bg-white rounded-xl shadow px-3">
            <span className="text-sm text-gray-600">Gerätename / Bearbeiter</span>
            <input className="border rounded px-2 py-1" value={editorName} onChange={(e) => setEditorName(e.target.value)} />
          </div>
        </div>

        {/* Grid: linke Tabelle + Timeline */}
        <div ref={wrapperRef} className="w-full overflow-hidden rounded-2xl bg-white shadow">
          {/* Header */}
          <div className="grid" style={{ gridTemplateColumns: "520px 1fr" }}>
            <div className="border-b p-2 md:p-3 bg-gray-50 font-semibold text-sm md:text-base">Ressourcen</div>
            <div className="border-b p-0 md:p-0 relative">
              <div className="sticky top-0 bg-gray-50 border-b z-10 overflow-x-auto" style={{ width: "100%" }}>
                <div className="relative" style={{ width: timelineWidth }}>
                  {ticks.map((t, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-l border-gray-200" style={{ left: t.x }}>
                      <div className="text-[10px] md:text-xs text-gray-600 px-1 -translate-x-2 bg-gray-50">{t.label}</div>
                    </div>
                  ))}
                  <div className="h-8" />
                </div>
              </div>
            </div>
          </div>

          {/* Rows: nur zugewiesene */}
          <div className="max-h-[70vh] overflow-auto">
            {assigned.map((it, idx) => {
              const color = CHEF_COLORS[it.chef] || CHEF_COLORS.DEFAULT;
              const { left, width } = calcBar(it.start, it.ende);
              const dauer = Math.max(1, diffDays(parseISO(it.start), addDays(parseISO(it.ende), 1)));
              return (
                <div key={it.id} className={`grid items-stretch ${idx % 2 ? "bg-white" : "bg-gray-50"}`} style={{ gridTemplateColumns: "520px 1fr" }}>
                  <div className="border-t p-2 md:p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-10 rounded" style={{ backgroundColor: color }} />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm md:text-base truncate">{it.vorarbeiter}</div>
                        <div className="text-xs text-gray-600 truncate">{it.baustelle}{it.ort ? ` · ${it.ort}` : ""}</div>
                        <div className="text-xs text-gray-500">Chef: {it.chef || "–"} · Techniker: {it.techniker || "–"}</div>
                        <div className="text-[11px] text-gray-500">{fmtShort(parseISO(it.start))} – {fmtShort(parseISO(it.ende))} · {dauer} Tage</div>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => openEdit(it.id)} className="text-xs px-3 py-1 rounded bg-blue-100 hover:bg-blue-200">Bearbeiten</button>
                      <button onClick={() => deleteItem(it.id)} className="text-xs px-3 py-1 rounded bg-rose-100 hover:bg-rose-200">Löschen</button>
                    </div>
                  </div>
                  <div className="border-t relative">
                    <div ref={idx === 0 ? timelineRef : null} className="relative" style={{ width: timelineWidth, height: 56 }}>
                      {ticks.map((t, i) => (<div key={i} className="absolute top-0 bottom-0 border-l border-gray-100" style={{ left: t.x }} />))}
                      <div className="absolute top-3 h-8 rounded-2xl shadow" style={{ left, width, backgroundColor: color }}>
                        <div className="text-[10px] md:text-xs text-white px-2 py-1 truncate">{it.baustelle}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {!assigned.length && (
              <div className="p-6 text-center text-gray-500">Keine Einträge für den aktuellen Filter.</div>
            )}
          </div>
        </div>

        {/* Raster für "Noch zuzuweisen" am Schluss */}
        <div className="mt-6 p-4 bg-violet-50 border border-violet-200 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-violet-800">Noch zuzuweisende Baustellen</h2>
            <span className="text-sm text-violet-800/70">{unassigned.length} Eintrag(e)</span>
          </div>
          {unassigned.length ? (
            <div className="overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-violet-100 text-violet-900">
                    <th className="border p-2 text-left">Vorarbeiter</th>
                    <th className="border p-2 text-left">Baustelle</th>
                    <th className="border p-2 text-left">Ort</th>
                    <th className="border p-2 text-left">Chef</th>
                    <th className="border p-2 text-left">Techniker</th>
                    <th className="border p-2 text-left">Start</th>
                    <th className="border p-2 text-left">Ende</th>
                    <th className="border p-2 text-left">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {unassigned.map((it, index) => (
                    <tr key={it.id || index} className={index % 2 ? "bg-white" : "bg-violet-50"}>
                      <td className="border p-2">{it.vorarbeiter}</td>
                      <td className="border p-2">{it.baustelle}</td>
                      <td className="border p-2">{it.ort || "–"}</td>
                      <td className="border p-2">{it.chef || "–"}</td>
                      <td className="border p-2">{it.techniker || "–"}</td>
                      <td className="border p-2">{fmtShort(parseISO(it.start))}</td>
                      <td className="border p-2">{fmtShort(parseISO(it.ende))}</td>
                      <td className="border p-2">
                        <button onClick={() => openEdit(it.id)} className="text-xs px-3 py-1 rounded bg-blue-100 hover:bg-blue-200">Zuordnen</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-violet-900/70">Aktuell keine unzugewiesenen Baustellen.</div>
          )}
        </div>

        {/* Editor Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="font-semibold">{editingId ? "Eintrag bearbeiten" : "Neuen Eintrag hinzufügen"}</div>
                <button onClick={() => setShowForm(false)} className="px-3 py-1 rounded bg-gray-100">Schließen</button>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600">Vorarbeiter</label>
                  <input className="w-full border rounded px-3 py-2" value={form.vorarbeiter} onChange={(e) => setForm({ ...form, vorarbeiter: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Baustelle</label>
                  <input className="w-full border rounded px-3 py-2" value={form.baustelle} onChange={(e) => setForm({ ...form, baustelle: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Ort</label>
                  <input className="w-full border rounded px-3 py-2" value={form.ort} onChange={(e) => setForm({ ...form, ort: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Chef</label>
                  <input className="w-full border rounded px-3 py-2" value={form.chef} onChange={(e) => setForm({ ...form, chef: e.target.value.toUpperCase() })} placeholder="z.B. DAN / HAN / MARK" />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Techniker</label>
                  <input className="w-full border rounded px-3 py-2" value={form.techniker} onChange={(e) => setForm({ ...form, techniker: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm text-gray-600">Start</label>
                    <input type="date" className="w-full border rounded px-3 py-2" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Ende</label>
                    <input type="date" className="w-full border rounded px-3 py-2" value={form.ende} onChange={(e) => setForm({ ...form, ende: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="p-4 border-t flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl bg-gray-100">Abbrechen</button>
                <button onClick={submitForm} className="px-4 py-2 rounded-xl bg-blue-600 text-white">Speichern</button>
              </div>
            </div>
          </div>
        )}

        {/* Fußzeile */}
        <footer className="text-xs text-gray-500 mt-4">
          <div>
            Tipp: Farben werden anhand des Chef-Kürzels vergeben. Zoom & Ansicht können für 4K feinjustiert werden. Änderungen sind lokal speicherbar und können später mit Cloud-Sync erweitert werden.
          </div>
        </footer>
      </div>
    </div>
  );
}
