import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import {
  Home, BookOpen, BarChart3, ScanEye, MessageCircle, ShieldCheck, Calendar, GraduationCap, Settings,
  Plus, Camera, X, Trash2, ChevronDown, ChevronUp, Send, Loader2, Sparkles, Mic, MicOff, Volume2, VolumeX,
  ImagePlus, Download, Upload, RotateCcw, Layers, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown,
  Minus, Lock, MoreHorizontal, FlaskConical, XCircle, WifiOff,
} from 'lucide-react';
import { callAI, AI_CONNECTED } from './aiService';

/* ============================================================
   CONSTANTES Y HELPERS COMPARTIDOS
   ============================================================ */

const PARES = ['AUD/NZD OTC', 'EUR/USD OTC', 'GBP/USD OTC', 'USD/JPY OTC', 'EUR/JPY OTC', 'USD/CAD OTC', 'Otro'];
const SESIONES = ['Mañana', 'Mediodía', 'Tarde'];
const TEMPORALIDADES = ['4H', '1H', '15M', '5M', '1M'];
const EMOCIONES = [
  { id: 'calma', label: 'Calma' },
  { id: 'confianza', label: 'Confianza' },
  { id: 'ansiedad', label: 'Ansiedad' },
  { id: 'euforia', label: 'Euforia' },
  { id: 'miedo', label: 'Miedo' },
  { id: 'revancha', label: 'Revancha' },
  { id: 'impulsividad', label: 'Impulsividad' },
  { id: 'cansancio', label: 'Cansancio' },
];
const MODOS_NEXO = [
  { id: 'analisis', label: 'Análisis' },
  { id: 'riesgo', label: 'Riesgo' },
  { id: 'disciplina', label: 'Disciplina' },
  { id: 'estudio', label: 'Estudio' },
  { id: 'revision', label: 'Revisión' },
  { id: 'identidad', label: 'Identidad' },
];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayISO = () => new Date().toISOString().slice(0, 10);
const nowHM = () => new Date().toTimeString().slice(0, 5);

function resizeImage(file, maxW = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const emptyForm = () => ({
  id: null,
  fecha: todayISO(),
  hora: nowHM(),
  par: PARES[0],
  direccion: 'Compra',
  resultado: 'Ganada',
  monto: '',
  riesgo: '',
  sesion: 'Mañana',
  temporalidad: '15M',
  setup: '',
  motivoEntrada: '',
  stopLoss: '',
  takeProfit: '',
  emocion: 'calma',
  emocionDespues: '',
  cumplimientoPlan: '',
  errores: '',
  aprendizaje: '',
  notas: '',
  captura: null,
});

const netOf = (t) => (t.resultado === 'Perdida' ? -Math.abs(Number(t.monto) || 0) : t.resultado === 'Ganada' ? Math.abs(Number(t.monto) || 0) : 0);

/* ============================================================
   CÁLCULOS DETERMINÍSTICOS (nunca se le piden al modelo)
   ============================================================ */

function computeStats(trades) {
  const total = trades.length;
  const ganadas = trades.filter((t) => t.resultado === 'Ganada');
  const perdidas = trades.filter((t) => t.resultado === 'Perdida');
  const empates = trades.filter((t) => t.resultado === 'Empate');
  const winrate = total ? (ganadas.length / (ganadas.length + perdidas.length || 1)) * 100 : 0;
  const pnlTotal = trades.reduce((a, t) => a + netOf(t), 0);
  const sumWins = ganadas.reduce((a, t) => a + Math.abs(Number(t.monto) || 0), 0);
  const sumLosses = perdidas.reduce((a, t) => a + Math.abs(Number(t.monto) || 0), 0);
  const profitFactor = sumLosses > 0 ? sumWins / sumLosses : sumWins > 0 ? Infinity : 0;
  const expectativa = total ? pnlTotal / total : 0;

  // Rachas
  let rachaG = 0, rachaP = 0, curG = 0, curP = 0;
  trades.forEach((t) => {
    if (t.resultado === 'Ganada') { curG += 1; curP = 0; rachaG = Math.max(rachaG, curG); }
    else if (t.resultado === 'Perdida') { curP += 1; curG = 0; rachaP = Math.max(rachaP, curP); }
    else { curG = 0; curP = 0; }
  });

  // Drawdown máximo sobre curva acumulada (en orden cronológico)
  const ordered = [...trades].sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
  let acum = 0, peak = 0, maxDD = 0;
  ordered.forEach((t) => {
    acum += netOf(t);
    peak = Math.max(peak, acum);
    maxDD = Math.max(maxDD, peak - acum);
  });

  // R promedio / acumulado (solo si hay riesgo cargado)
  const conRiesgo = trades.filter((t) => Number(t.riesgo) > 0);
  const rValues = conRiesgo.map((t) => netOf(t) / Number(t.riesgo));
  const rAcumulado = rValues.reduce((a, r) => a + r, 0);
  const rPromedio = rValues.length ? rAcumulado / rValues.length : null;

  // Cumplimiento del plan
  const conCumplimiento = trades.filter((t) => t.cumplimientoPlan === 'Sí' || t.cumplimientoPlan === 'No');
  const cumplenSi = trades.filter((t) => t.cumplimientoPlan === 'Sí').length;
  const cumplimientoPct = conCumplimiento.length ? (cumplenSi / conCumplimiento.length) * 100 : null;

  return {
    total, ganadas: ganadas.length, perdidas: perdidas.length, empates: empates.length,
    winrate, pnlTotal, profitFactor, expectativa, rachaG, rachaP, maxDD,
    rAcumulado: conRiesgo.length ? rAcumulado : null, rPromedio, muestraR: conRiesgo.length,
    cumplimientoPct, muestraCumplimiento: conCumplimiento.length,
  };
}

function groupWinrate(trades, keyFn) {
  const map = {};
  trades.forEach((t) => {
    const k = keyFn(t);
    if (!k) return;
    if (!map[k]) map[k] = { n: 0, g: 0, net: 0 };
    map[k].n += 1;
    if (t.resultado === 'Ganada') map[k].g += 1;
    map[k].net += netOf(t);
  });
  return Object.entries(map)
    .map(([k, v]) => ({ key: k, n: v.n, winrate: v.n ? (v.g / v.n) * 100 : 0, net: v.net }))
    .sort((a, b) => b.n - a.n);
}

function computePatterns(trades) {
  return {
    porSetup: groupWinrate(trades, (t) => t.setup || null),
    porSesion: groupWinrate(trades, (t) => t.sesion),
    porTemporalidad: groupWinrate(trades, (t) => t.temporalidad),
    porPar: groupWinrate(trades, (t) => t.par),
    porEmocion: groupWinrate(trades, (t) => EMOCIONES.find((e) => e.id === t.emocion)?.label),
    porCumplimiento: groupWinrate(trades, (t) => t.cumplimientoPlan || null),
  };
}

/* ============================================================
   VALIDACIÓN AUTOMÁTICA CONTRA PLAN/RIESGO
   ============================================================ */

function parseNumeroPlan(str) {
  if (!str) return null;
  const s = String(str).trim();
  const esPorcentaje = s.includes('%');
  const num = parseFloat(s.replace(/[^0-9.,-]/g, '').replace(',', '.'));
  if (isNaN(num)) return null;
  return { valor: num, esPorcentaje };
}

function evaluarRiesgo(form, plan, trades) {
  const checks = [];
  if (!plan) {
    checks.push({ level: 'warn', text: 'No definiste tu Plan/Riesgo todavía — cargalo para recibir controles automáticos.' });
    return checks;
  }

  const riesgo = Number(form.riesgo) || 0;
  const hoy = form.fecha || todayISO();
  const tradesHoy = trades.filter((t) => t.fecha === hoy && t.id !== form.id);
  const tradesHoyOrdenados = [...tradesHoy].sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

  // Riesgo máximo por operación
  const rMax = parseNumeroPlan(plan.riesgoPorOperacion);
  if (rMax && riesgo > 0) {
    const capital = Number(plan.capital) || 0;
    const limite = rMax.esPorcentaje && capital > 0 ? (rMax.valor / 100) * capital : rMax.valor;
    if (limite > 0) {
      if (riesgo > limite) checks.push({ level: 'fail', text: `Riesgo de $${riesgo} supera tu máximo por operación ($${limite.toFixed(2)}).` });
      else checks.push({ level: 'ok', text: 'Riesgo dentro del límite por operación.' });
    }
  } else if (!form.riesgo) {
    checks.push({ level: 'warn', text: 'No definiste el riesgo en $ de esta operación — no vas a poder medirla en R.' });
  }

  if (!form.stopLoss) {
    checks.push({ level: 'warn', text: 'No definiste stop loss.' });
  }

  // Límite diario
  const limiteDiario = parseNumeroPlan(plan.limiteDiario);
  if (limiteDiario) {
    const perdidaHoy = tradesHoy.reduce((a, t) => a + (t.resultado === 'Perdida' ? Math.abs(Number(t.monto) || 0) : 0), 0);
    const proyectada = perdidaHoy + (form.resultado === 'Perdida' ? Math.abs(Number(form.monto) || 0) : 0);
    if (perdidaHoy >= limiteDiario.valor) checks.push({ level: 'fail', text: `Ya alcanzaste tu límite diario de pérdida ($${limiteDiario.valor}).` });
    else if (proyectada > limiteDiario.valor) checks.push({ level: 'warn', text: 'Esta operación te acercaría o superaría tu límite diario de pérdida.' });
  }

  // Máximo de operaciones por día
  if (plan.maxOperacionesDia) {
    const max = Number(plan.maxOperacionesDia);
    if (tradesHoy.length + 1 > max) checks.push({ level: 'fail', text: `Superás tu máximo de operaciones por día (${max}).` });
  }

  // Sesión permitida
  if (plan.horarios && form.sesion) {
    const ok = plan.horarios.toLowerCase().includes(form.sesion.toLowerCase());
    if (!ok) checks.push({ level: 'warn', text: `La sesión "${form.sesion}" no aparece en tus horarios permitidos ("${plan.horarios}").` });
  }

  // Setup válido
  if (plan.setupsValidos) {
    if (!form.setup) checks.push({ level: 'warn', text: 'No cargaste el setup de esta operación.' });
    else if (!plan.setupsValidos.toLowerCase().includes(form.setup.toLowerCase())) {
      checks.push({ level: 'fail', text: `El setup "${form.setup}" no está en tu lista de setups válidos.` });
    }
  }

  // Regla tras pérdida / dos pérdidas consecutivas
  if (tradesHoyOrdenados.length >= 1) {
    const ultima = tradesHoyOrdenados[tradesHoyOrdenados.length - 1];
    const penultima = tradesHoyOrdenados[tradesHoyOrdenados.length - 2];
    if (ultima?.resultado === 'Perdida' && penultima?.resultado === 'Perdida') {
      checks.push({ level: 'fail', text: `Dos pérdidas consecutivas hoy${plan.reglaTrasDosPerdidas ? ` — tu plan indica: "${plan.reglaTrasDosPerdidas}"` : ': tu plan indica pausa.'}` });
    } else if (ultima?.resultado === 'Perdida') {
      checks.push({ level: 'warn', text: `Venís de una pérdida hoy${plan.reglaTrasPerdida ? ` — tu plan indica: "${plan.reglaTrasPerdida}"` : ': revisá tu estado emocional.'}` });
    }
  }

  if (checks.length === 0) checks.push({ level: 'ok', text: 'Cumple con los controles definidos en tu plan.' });
  return checks;
}

function planStatusFromChecks(checks) {
  if (checks.some((c) => c.level === 'fail')) return 'fuera_del_plan';
  if (checks.some((c) => c.level === 'warn')) return 'advertencia';
  return 'cumple';
}

function buildTradesContextText(trades) {
  if (!trades || trades.length === 0) return 'El usuario todavía no cargó operaciones en su journal.';
  const s = computeStats(trades);
  const p = computePatterns(trades);
  const top = (arr) => arr.slice(0, 3).map((x) => `${x.key}: ${x.winrate.toFixed(0)}% (n=${x.n})`).join(' · ');
  const fueraPlan = trades.filter((t) => t.planStatus === 'fuera_del_plan').length;
  const advertencia = trades.filter((t) => t.planStatus === 'advertencia').length;
  return `Resumen del journal de Pablo (${s.total} operaciones, calculado por código, no inventar estos números):
- Winrate: ${s.winrate.toFixed(0)}% · Neto: $${s.pnlTotal.toFixed(2)} · Profit factor: ${isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : '∞'}
- Expectativa por operación: $${s.expectativa.toFixed(2)} · Drawdown máximo: $${s.maxDD.toFixed(2)}
- Racha ganadora máx: ${s.rachaG} · Racha perdedora máx: ${s.rachaP}
${s.rPromedio !== null ? `- R promedio: ${s.rPromedio.toFixed(2)} (n=${s.muestraR})` : ''}
${s.cumplimientoPct !== null ? `- Cumplimiento del plan: ${s.cumplimientoPct.toFixed(0)}% (n=${s.muestraCumplimiento})` : ''}
- Operaciones marcadas fuera del plan al guardarse: ${fueraPlan} · con advertencia: ${advertencia}
- Por setup: ${top(p.porSetup) || 'sin datos'}
- Por sesión: ${top(p.porSesion) || 'sin datos'}
- Por emoción: ${top(p.porEmocion) || 'sin datos'}`;
}

/* ============================================================
   HOOKS DE DATOS COMPARTIDOS (localStorage real del navegador)
   ============================================================ */

/**
 * Mismo shape que window.storage del artifact (get/set devuelven
 * {value} o null), pero sobre localStorage real — así el resto del
 * código no cambió más de lo necesario en la migración.
 */
const storage = {
  get: async (key) => {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? { value: v } : null;
    } catch (e) { return null; }
  },
  set: async (key, value) => {
    try {
      localStorage.setItem(key, value);
      return { value };
    } catch (e) { return null; }
  },
};

function useTrades() {
  const [trades, setTrades] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const r = await storage.get('trades', false);
        if (r && r.value) setTrades(JSON.parse(r.value));
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);
  const persist = async (next) => {
    setTrades(next);
    try { await storage.set('trades', JSON.stringify(next), false); } catch (e) {}
  };
  return { trades, persist, loaded };
}

function usePlan() {
  const [plan, setPlan] = useState(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const r = await storage.get('plan-riesgo', false);
        if (r && r.value) setPlan(JSON.parse(r.value));
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);
  const persist = async (next) => {
    setPlan(next);
    try { await storage.set('plan-riesgo', JSON.stringify(next), false); } catch (e) {}
  };
  return { plan, persist, loaded };
}

function useAnalisis() {
  const [lista, setLista] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const r = await storage.get('analisis', false);
        if (r && r.value) setLista(JSON.parse(r.value));
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);
  const persist = async (next) => {
    setLista(next);
    try { await storage.set('analisis', JSON.stringify(next), false); } catch (e) {}
  };
  return { lista, persist, loaded };
}

function buildPlanContextText(plan) {
  if (!plan) return 'El usuario todavía no definió su Plan/Riesgo.';
  return `Plan de riesgo definido por Pablo:
- Capital de trading: ${plan.capital || '—'}
- Riesgo máximo por operación: ${plan.riesgoPorOperacion || '—'}
- Límite de pérdida diario: ${plan.limiteDiario || '—'} · semanal: ${plan.limiteSemanal || '—'}
- Máximo de operaciones por día: ${plan.maxOperacionesDia || '—'}
- Horarios permitidos: ${plan.horarios || '—'}
- Setups válidos: ${plan.setupsValidos || '—'}
- Regla tras una pérdida: ${plan.reglaTrasPerdida || '—'}
- Regla tras dos pérdidas seguidas: ${plan.reglaTrasDosPerdidas || '—'}`;
}

/* ============================================================
   UI PRIMITIVOS
   ============================================================ */

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={styles.fieldLabel}>{label}</label>
      {children}
      {hint && <div style={styles.fieldHint}>{hint}</div>}
    </div>
  );
}

function Card({ children, style }) {
  return <div style={{ ...styles.card, ...style }}>{children}</div>;
}

function StatBox({ label, value, sub, color }) {
  return (
    <div style={styles.statBox}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{ ...styles.statValue, color: color || '#e8e4da' }}>{value}</div>
      {sub && <div style={styles.statSub}>{sub}</div>}
    </div>
  );
}

function NoConectado({ texto }) {
  return (
    <div style={styles.noConectado}>
      <Lock size={12} /> {texto || 'No conectado todavía'}
    </div>
  );
}

/* ============================================================
   PANTALLA: INICIO
   ============================================================ */

function InicioScreen({ trades, plan, onGoTab }) {
  const hoy = todayISO();
  const tradesHoy = trades.filter((t) => t.fecha === hoy);
  const pnlHoy = tradesHoy.reduce((a, t) => a + netOf(t), 0);
  const cumplenHoy = tradesHoy.filter((t) => t.cumplimientoPlan === 'Sí').length;
  const perdidaHoy = tradesHoy.reduce((a, t) => a + (t.resultado === 'Perdida' ? Math.abs(Number(t.monto) || 0) : 0), 0);
  const limiteDiario = plan?.limiteDiario ? Number(plan.limiteDiario) : null;
  const riesgoDisponible = limiteDiario !== null ? Math.max(0, limiteDiario - perdidaHoy) : null;

  const accesos = [
    { id: 'journal', label: 'Nueva operación', icon: Plus },
    { id: 'analizar', label: 'Analizar gráfico', icon: ScanEye },
    { id: 'nexo', label: 'Hablar con NEXO', icon: MessageCircle },
    { id: 'rendimiento', label: 'Ver rendimiento', icon: BarChart3 },
  ];

  return (
    <div style={styles.screenPad}>
      <div style={styles.inicioHero}>
        <div style={styles.inicioSlogan}>"El trader decide. Journal Capital mide, analiza y acompaña."</div>
      </div>

      <Card>
        <div style={styles.cardTitle}>Resumen del día — {hoy}</div>
        <div style={styles.statsGrid}>
          <StatBox label="Operaciones" value={tradesHoy.length} />
          <StatBox label="Resultado" value={`${pnlHoy >= 0 ? '+' : ''}$${pnlHoy.toFixed(2)}`} color={pnlHoy >= 0 ? '#4f9c82' : '#c96a4e'} />
          <StatBox label="Cumplimiento" value={tradesHoy.length ? `${cumplenHoy}/${tradesHoy.length}` : '—'} />
          <StatBox
            label="Riesgo disponible"
            value={riesgoDisponible !== null ? `$${riesgoDisponible.toFixed(2)}` : '—'}
            sub={riesgoDisponible === null ? 'definí tu límite diario en Plan/Riesgo' : undefined}
            color={riesgoDisponible === 0 ? '#c96a4e' : undefined}
          />
        </div>
      </Card>

      <Card>
        <div style={styles.cardTitle}>Próximos eventos / calendario</div>
        <NoConectado texto="Calendario económico en tiempo real no conectado" />
      </Card>

      <div style={styles.accesosGrid}>
        {accesos.map((a) => (
          <button key={a.id} onClick={() => onGoTab(a.id)} style={styles.accesoBtn}>
            <a.icon size={18} color="#c9973f" />
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   PANTALLA: JOURNAL
   ============================================================ */

function JournalScreen({ trades, persist, loaded, plan }) {
  const [sub, setSub] = useState('nueva');
  const [form, setForm] = useState(emptyForm());
  const [expandedId, setExpandedId] = useState(null);
  const [showAvanzado, setShowAvanzado] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const [checklistTicks, setChecklistTicks] = useState({});
  const fileRef = useRef(null);

  const checklistItems = useMemo(() => (plan?.checklist ? plan.checklist.split('\n').map((s) => s.trim()).filter(Boolean) : []), [plan]);
  const controlRiesgo = useMemo(() => evaluarRiesgo(form, plan, trades), [form, plan, trades]);

  const save = async (e) => {
    e.preventDefault();
    if (!form.monto || isNaN(Number(form.monto))) return;
    const planStatus = planStatusFromChecks(controlRiesgo);
    const checklistCumplido = checklistItems.length
      ? `${checklistItems.filter((_, i) => checklistTicks[i]).length}/${checklistItems.length}`
      : null;
    const entry = {
      ...form, id: form.id || uid(), monto: Number(form.monto), riesgo: form.riesgo ? Number(form.riesgo) : '',
      planStatus, controlRiesgo: controlRiesgo.map((c) => c.text), checklistCumplido,
    };
    const next = form.id ? trades.map((t) => (t.id === form.id ? entry : t)) : [entry, ...trades];
    await persist(next);
    setForm(emptyForm());
    setShowAvanzado(false);
    setChecklistTicks({});
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 1400);
  };

  const editTrade = (t) => {
    setForm({ ...emptyForm(), ...t, monto: String(t.monto), riesgo: t.riesgo ? String(t.riesgo) : '' });
    setSub('nueva');
  };

  const deleteTrade = async (id) => {
    await persist(trades.filter((t) => t.id !== id));
  };

  const onPickImage = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const dataUrl = await resizeImage(file);
    setForm((f) => ({ ...f, captura: dataUrl }));
    e.target.value = '';
  };

  return (
    <div style={styles.screenPad}>
      <div style={styles.subtabs}>
        {[{ id: 'nueva', label: 'Nueva' }, { id: 'historial', label: 'Historial' }].map((s) => (
          <button key={s.id} onClick={() => setSub(s.id)} className={`jc-btn jc-neutral-sel ${sub === s.id ? 'is-selected' : ''}`} style={styles.subtabBtn}>
            {s.label}
          </button>
        ))}
      </div>

      {sub === 'nueva' && (
        <form onSubmit={save}>
          <Card>
            <div style={styles.formGrid2}>
              <Field label="Fecha">
                <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} style={styles.input} required />
              </Field>
              <Field label="Hora">
                <input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} style={styles.input} />
              </Field>
            </div>

            <Field label="Par">
              <select value={form.par} onChange={(e) => setForm({ ...form, par: e.target.value })} style={styles.input}>
                {PARES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>

            <div style={styles.formGrid2}>
              <Field label="Dirección">
                <div style={styles.toggleRow}>
                  {['Compra', 'Venta'].map((d) => (
                    <button type="button" key={d} onClick={() => setForm({ ...form, direccion: d })}
                      className={`jc-btn ${d === 'Compra' ? 'jc-success' : 'jc-danger'} ${form.direccion === d ? 'is-selected' : ''}`}
                      style={styles.toggleBtn}>{d}</button>
                  ))}
                </div>
              </Field>
              <Field label="Temporalidad">
                <select value={form.temporalidad} onChange={(e) => setForm({ ...form, temporalidad: e.target.value })} style={styles.input}>
                  {TEMPORALIDADES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Sesión">
              <div style={styles.toggleRow}>
                {SESIONES.map((s) => (
                  <button type="button" key={s} onClick={() => setForm({ ...form, sesion: s })}
                    className={`jc-btn jc-neutral-sel ${form.sesion === s ? 'is-selected' : ''}`}
                    style={styles.toggleBtn}>{s}</button>
                ))}
              </div>
            </Field>

            <Field label="Resultado">
              <div style={styles.toggleRow}>
                {['Ganada', 'Perdida', 'Empate'].map((r) => (
                  <button type="button" key={r} onClick={() => setForm({ ...form, resultado: r })}
                    className={`jc-btn ${r === 'Ganada' ? 'jc-success' : r === 'Perdida' ? 'jc-danger' : 'jc-info'} ${form.resultado === r ? 'is-selected' : ''}`}
                    style={styles.toggleBtn}>{r}</button>
                ))}
              </div>
            </Field>

            <div style={styles.formGrid2}>
              <Field label="Monto ($)">
                <input type="number" step="0.01" min="0" placeholder="0.00" value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: e.target.value })} style={styles.input} required />
              </Field>
              <Field label="Riesgo arriesgado ($)" hint="opcional — habilita el cálculo en R">
                <input type="number" step="0.01" min="0" placeholder="0.00" value={form.riesgo}
                  onChange={(e) => setForm({ ...form, riesgo: e.target.value })} style={styles.input} />
              </Field>
            </div>

            <Field label="Setup / estrategia">
              <input type="text" placeholder="Ej: reversión en soporte, ruptura de rango..." value={form.setup}
                onChange={(e) => setForm({ ...form, setup: e.target.value })} style={styles.input} />
            </Field>

            <Field label="Estado emocional al operar">
              <div style={styles.chipRow}>
                {EMOCIONES.map((em) => (
                  <button type="button" key={em.id} onClick={() => setForm({ ...form, emocion: em.id })}
                    className={`jc-btn jc-neutral-sel ${form.emocion === em.id ? 'is-selected' : ''}`} style={styles.chip}>{em.label}</button>
                ))}
              </div>
            </Field>

            <Field label="¿Cumpliste tu plan?">
              <div style={styles.toggleRow}>
                {['Sí', 'No'].map((c) => (
                  <button type="button" key={c} onClick={() => setForm({ ...form, cumplimientoPlan: c })}
                    className={`jc-btn ${c === 'Sí' ? 'jc-success' : 'jc-danger'} ${form.cumplimientoPlan === c ? 'is-selected' : ''}`}
                    style={styles.toggleBtn}>{c}</button>
                ))}
              </div>
            </Field>

            <Field label="Notas">
              <textarea rows={3} placeholder="Qué viste, qué pensaste, qué harías distinto..." value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })} style={{ ...styles.input, resize: 'vertical' }} />
            </Field>

            <Field label="Captura del gráfico">
              <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} style={{ display: 'none' }} />
              <button type="button" onClick={() => fileRef.current.click()} style={styles.captureBtn}>
                <Camera size={15} /> {form.captura ? 'Cambiar captura' : 'Adjuntar captura'}
              </button>
              {form.captura && (
                <div style={{ position: 'relative', marginTop: 10, width: 90 }}>
                  <img src={form.captura} alt="captura" style={styles.thumb} />
                  <button type="button" onClick={() => setForm({ ...form, captura: null })} style={styles.thumbX}><X size={12} /></button>
                </div>
              )}
            </Field>

            <button type="button" onClick={() => setShowAvanzado((v) => !v)} style={styles.avanzadoToggle}>
              {showAvanzado ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Detalle avanzado (motivo, SL/TP, errores, aprendizaje)
            </button>

            {showAvanzado && (
              <div style={{ marginTop: 14 }}>
                <Field label="Motivo de entrada">
                  <textarea rows={2} value={form.motivoEntrada} onChange={(e) => setForm({ ...form, motivoEntrada: e.target.value })} style={{ ...styles.input, resize: 'vertical' }} />
                </Field>
                <div style={styles.formGrid2}>
                  <Field label="Stop loss">
                    <input type="text" value={form.stopLoss} onChange={(e) => setForm({ ...form, stopLoss: e.target.value })} style={styles.input} />
                  </Field>
                  <Field label="Take profit">
                    <input type="text" value={form.takeProfit} onChange={(e) => setForm({ ...form, takeProfit: e.target.value })} style={styles.input} />
                  </Field>
                </div>
                <Field label="Estado emocional después">
                  <div style={styles.chipRow}>
                    {EMOCIONES.map((em) => (
                      <button type="button" key={em.id} onClick={() => setForm({ ...form, emocionDespues: em.id })}
                        className={`jc-btn jc-neutral-sel ${form.emocionDespues === em.id ? 'is-selected' : ''}`} style={styles.chip}>{em.label}</button>
                    ))}
                  </div>
                </Field>
                <Field label="Errores cometidos">
                  <textarea rows={2} value={form.errores} onChange={(e) => setForm({ ...form, errores: e.target.value })} style={{ ...styles.input, resize: 'vertical' }} />
                </Field>
                <Field label="Aprendizaje">
                  <textarea rows={2} value={form.aprendizaje} onChange={(e) => setForm({ ...form, aprendizaje: e.target.value })} style={{ ...styles.input, resize: 'vertical' }} />
                </Field>
              </div>
            )}

            <div style={styles.controlRiesgoBox}>
              <div style={styles.controlRiesgoTitle}><ShieldCheck size={14} color="#c9973f" /> Control de riesgo</div>
              {controlRiesgo.map((c, i) => (
                <div key={i} style={styles.controlRiesgoRow}>
                  {c.level === 'ok' && <CheckCircle2 size={14} color="#4f9c82" />}
                  {c.level === 'warn' && <AlertTriangle size={14} color="#c9973f" />}
                  {c.level === 'fail' && <XCircle size={14} color="#c96a4e" />}
                  <span style={{ color: c.level === 'ok' ? '#8a93a3' : c.level === 'warn' ? '#c9973f' : '#c96a4e' }}>{c.text}</span>
                </div>
              ))}
            </div>

            {checklistItems.length > 0 && (
              <div style={styles.controlRiesgoBox}>
                <div style={styles.controlRiesgoTitle}><CheckCircle2 size={14} color="#c9973f" /> Checklist pre-operación</div>
                {checklistItems.map((item, i) => (
                  <label key={i} style={styles.checklistRow}>
                    <input type="checkbox" checked={!!checklistTicks[i]} onChange={(e) => setChecklistTicks({ ...checklistTicks, [i]: e.target.checked })} />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            )}

            <button type="submit" className="jc-btn jc-btn-primary" style={styles.saveBtn}>
              {saveState === 'saved' ? <CheckCircle2 size={16} /> : <Plus size={16} />} {form.id ? 'Guardar cambios' : 'Registrar operación'}
            </button>
          </Card>
        </form>
      )}

      {sub === 'historial' && (
        <div>
          {!loaded ? (
            <div style={styles.emptyMsg}>Cargando…</div>
          ) : trades.length === 0 ? (
            <div style={styles.emptyMsg}>Todavía no registraste operaciones.</div>
          ) : (
            trades.map((t) => (
              <Card key={t.id} style={{ marginBottom: 10 }}>
                <div onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} style={styles.histRow}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: t.resultado === 'Ganada' ? '#4f9c82' : t.resultado === 'Perdida' ? '#c96a4e' : '#5a6472' }} />
                  <span style={styles.histDate}>{t.fecha}</span>
                  <span style={styles.histPar}>{t.par.split(' ')[0]}</span>
                  <span style={styles.histSesion}>{t.sesion}</span>
                  {t.planStatus === 'fuera_del_plan' && <XCircle size={13} color="#c96a4e" />}
                  {t.planStatus === 'advertencia' && <AlertTriangle size={13} color="#c9973f" />}
                  {t.demo && <FlaskConical size={12} color="#5a6472" />}
                  <span style={{ ...styles.histMonto, color: t.resultado === 'Ganada' ? '#4f9c82' : t.resultado === 'Perdida' ? '#c96a4e' : '#8a93a3' }}>
                    {t.resultado === 'Perdida' ? '−' : t.resultado === 'Ganada' ? '+' : ''}${t.monto}
                  </span>
                  {expandedId === t.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </div>
                {expandedId === t.id && (
                  <div style={styles.histDetail}>
                    {t.captura && <img src={t.captura} alt="captura operación" style={styles.detailImg} />}
                    <div style={styles.detailRow}><span style={styles.detailLabel}>Setup</span><span style={styles.detailVal}>{t.setup || '—'}</span></div>
                    <div style={styles.detailRow}><span style={styles.detailLabel}>Cumplió plan</span><span style={styles.detailVal}>{t.cumplimientoPlan || '—'}</span></div>
                    {t.checklistCumplido && <div style={styles.detailRow}><span style={styles.detailLabel}>Checklist</span><span style={styles.detailVal}>{t.checklistCumplido}</span></div>}
                    <div style={styles.detailRow}><span style={styles.detailLabel}>Notas</span><span style={styles.detailVal}>{t.notas || '—'}</span></div>
                    {t.errores && <div style={styles.detailRow}><span style={styles.detailLabel}>Errores</span><span style={styles.detailVal}>{t.errores}</span></div>}
                    {t.aprendizaje && <div style={styles.detailRow}><span style={styles.detailLabel}>Aprendizaje</span><span style={styles.detailVal}>{t.aprendizaje}</span></div>}
                    {t.controlRiesgo && t.controlRiesgo.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={styles.detailLabel}>Control de riesgo al guardar</div>
                        {t.controlRiesgo.map((c, i) => <div key={i} style={styles.controlRiesgoTextSmall}>· {c}</div>)}
                      </div>
                    )}
                    <div style={styles.detailActions}>
                      <button onClick={() => editTrade(t)} style={styles.smallBtn}>Editar</button>
                      <button onClick={() => deleteTrade(t.id)} style={{ ...styles.smallBtn, color: '#c96a4e' }}><Trash2 size={13} /> Borrar</button>
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PANTALLA: RENDIMIENTO
   ============================================================ */

function RendimientoScreen({ trades }) {
  const stats = useMemo(() => computeStats(trades), [trades]);
  const patterns = useMemo(() => computePatterns(trades), [trades]);

  const ordered = useMemo(() => [...trades].sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || ''))), [trades]);
  let acum = 0;
  const curva = ordered.map((t, i) => { acum += netOf(t); return { x: i + 1, y: Number(acum.toFixed(2)) }; });

  if (trades.length === 0) {
    return <div style={styles.screenPad}><div style={styles.emptyMsg}>Cargá operaciones en el Journal para ver tu rendimiento acá.</div></div>;
  }

  const PatternBlock = ({ title, data }) => (
    <Card>
      <div style={styles.cardTitle}>{title}</div>
      {data.length === 0 ? <div style={styles.emptyMsgSmall}>Sin datos suficientes</div> : data.slice(0, 6).map((d) => (
        <div key={d.key} style={styles.patternRow}>
          <span style={styles.patternKey}>{d.key}</span>
          <span style={{ ...styles.patternWr, color: d.winrate >= 50 ? '#4f9c82' : '#c96a4e' }}>{d.winrate.toFixed(0)}%</span>
          <span style={styles.patternN}>n={d.n}{d.n < 5 && ' ⚠'}</span>
        </div>
      ))}
    </Card>
  );

  return (
    <div style={styles.screenPad}>
      <Card>
        <div style={styles.statsGrid}>
          <StatBox label="Operaciones" value={stats.total} />
          <StatBox label="Winrate" value={`${stats.winrate.toFixed(0)}%`} color={stats.winrate >= 50 ? '#4f9c82' : '#c96a4e'} />
          <StatBox label="Neto" value={`$${stats.pnlTotal.toFixed(2)}`} color={stats.pnlTotal >= 0 ? '#4f9c82' : '#c96a4e'} />
          <StatBox label="Profit factor" value={isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞'} />
          <StatBox label="Expectativa/op" value={`$${stats.expectativa.toFixed(2)}`} />
          <StatBox label="Drawdown máx" value={`$${stats.maxDD.toFixed(2)}`} color="#c96a4e" />
          <StatBox label="Racha ganadora" value={stats.rachaG} color="#4f9c82" />
          <StatBox label="Racha perdedora" value={stats.rachaP} color="#c96a4e" />
        </div>
        {stats.rPromedio !== null && (
          <div style={styles.rNote}>R promedio: {stats.rPromedio.toFixed(2)} · R acumulado: {stats.rAcumulado.toFixed(2)} (n={stats.muestraR})</div>
        )}
        {stats.cumplimientoPct !== null && (
          <div style={styles.rNote}>Cumplimiento del plan: {stats.cumplimientoPct.toFixed(0)}% (n={stats.muestraCumplimiento})</div>
        )}
      </Card>

      <Card>
        <div style={styles.cardTitle}>Curva de resultado acumulado</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={curva}>
            <CartesianGrid stroke="#1f2733" strokeDasharray="3 3" />
            <XAxis dataKey="x" stroke="#5a6472" fontSize={10} />
            <YAxis stroke="#5a6472" fontSize={10} />
            <Tooltip contentStyle={{ background: '#131a24', border: '1px solid #2a3441', fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#2a3441" />
            <Line type="monotone" dataKey="y" stroke="#c9973f" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div style={styles.cardTitle2}>Motor de patrones</div>
      <PatternBlock title="Por setup" data={patterns.porSetup} />
      <PatternBlock title="Por sesión" data={patterns.porSesion} />
      <PatternBlock title="Por temporalidad" data={patterns.porTemporalidad} />
      <PatternBlock title="Por par" data={patterns.porPar} />
      <PatternBlock title="Por estado emocional" data={patterns.porEmocion} />
      <PatternBlock title="Por cumplimiento del plan" data={patterns.porCumplimiento} />
      <div style={styles.sampleWarning}><AlertTriangle size={12} /> ⚠ junto al winrate indica muestra chica (n&lt;5) — tomalo como orientativo, no como regla.</div>
    </div>
  );
}

/* ============================================================
   PANTALLA: ANALIZAR
   ============================================================ */

const ANALISIS_SYSTEM_PROMPT = `Sos el módulo de Análisis de Journal Capital Trading, dentro del asistente NEXO.

Tu tarea es analizar una o más capturas de gráfico que te pasa Pablo, un trader con experiencia en OTC (Quotex) que estudia acción de precio institucional y order flow. NO sos un generador de señales — no digas "comprá" ni "vendé" ni "entrá acá" ni "esta operación es segura".

Organizá tu respuesta SIEMPRE con estos encabezados, en este orden, en texto plano (sin markdown, sin asteriscos, para que se pueda leer en voz alta):

Observaciones: qué elementos son objetivamente visibles en la o las capturas.
Estructura: tendencia o rango, máximos y mínimos, cambios de estructura si corresponde.
Zonas: soportes, resistencias, zonas de liquidez o reacción relevantes.
Lectura multitemporal: si hay más de una captura, cómo se relacionan entre sí. Si hay una sola, decilo.
Escenarios posibles: explicá posibilidades sin presentarlas como certeza.
Invalidación: qué tendría que pasar para invalidar la hipótesis planteada.
Riesgo: qué debería revisar el operador antes de decidir (sin decirle qué hacer).
Incertidumbre: qué no se puede afirmar con la información disponible en la imagen. Nunca inventes velas, precios o niveles que no se ven.
Conclusión educativa: resumen breve para ayudarlo a pensar mejor, no para decidir por él.

La decisión final siempre es del operador.`;

function AnalizarScreen({ trades, persist, analisisLista, persistAnalisis }) {
  const [imagenes, setImagenes] = useState({}); // { '4H': dataUrl, ... }
  const [par, setPar] = useState(PARES[0]);
  const [contexto, setContexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [saved, setSaved] = useState(false);
  const fileRefs = useRef({});

  const onPick = async (tf, e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const dataUrl = await resizeImage(file, 1100, 0.8);
    setImagenes((prev) => ({ ...prev, [tf]: dataUrl }));
    e.target.value = '';
  };

  const timeframesUsados = TEMPORALIDADES.filter((tf) => imagenes[tf]);

  const analizar = async () => {
    if (timeframesUsados.length === 0) return;
    setLoading(true);
    setResultado(null);
    setSaved(false);
    try {
      const content = [];
      timeframesUsados.forEach((tf) => {
        const match = imagenes[tf].match(/^data:(image\/\w+);base64,(.+)$/);
        content.push({ type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } });
        content.push({ type: 'text', text: `↑ Captura correspondiente a temporalidad ${tf}.` });
      });
      content.push({ type: 'text', text: `Par: ${par}. Contexto/hipótesis del operador: ${contexto || 'no especificado'}.` });

      const res = await callAI({
        system: ANALISIS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
        context: 'analizar',
      });
      setResultado(res.ok ? (res.text || 'No se pudo generar el análisis, probá de nuevo.') : res.error);
    } catch (e) {
      setResultado('Hubo un error inesperado analizando el gráfico. Probá de nuevo en un momento.');
    }
    setLoading(false);
  };

  const guardarEnJournal = async () => {
    const entry = {
      id: uid(),
      fecha: todayISO(),
      par,
      timeframes: timeframesUsados,
      contexto,
      resultado,
      imagenes,
    };
    await persistAnalisis([entry, ...analisisLista]);
    setSaved(true);
  };

  return (
    <div style={styles.screenPad}>
      <Card>
        <div style={styles.cardTitle}><Layers size={15} color="#c9973f" /> Análisis multitemporal</div>
        {!AI_CONNECTED && (
          <div style={styles.aiDisconnectedBanner}>
            <WifiOff size={13} /> Análisis IA no conectado. Podés seguir cargando capturas y guardando el contexto, pero todavía no hay lectura automática.
          </div>
        )}
        <Field label="Par">
          <select value={par} onChange={(e) => setPar(e.target.value)} style={styles.input}>
            {PARES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>

        <div style={styles.tfGrid}>
          {TEMPORALIDADES.map((tf) => (
            <div key={tf} style={styles.tfSlot}>
              <input ref={(el) => (fileRefs.current[tf] = el)} type="file" accept="image/*" onChange={(e) => onPick(tf, e)} style={{ display: 'none' }} />
              {imagenes[tf] ? (
                <div style={{ position: 'relative' }}>
                  <img src={imagenes[tf]} alt={tf} style={styles.tfThumb} />
                  <button onClick={() => setImagenes((p) => { const n = { ...p }; delete n[tf]; return n; })} style={styles.thumbX}><X size={12} /></button>
                </div>
              ) : (
                <button onClick={() => fileRefs.current[tf].click()} style={styles.tfBtn}>
                  <ImagePlus size={16} />
                </button>
              )}
              <span style={styles.tfLabel}>{tf}</span>
            </div>
          ))}
        </div>

        <Field label="Contexto / hipótesis (opcional)">
          <textarea rows={2} placeholder="Qué estás viendo, qué hipótesis tenés..." value={contexto}
            onChange={(e) => setContexto(e.target.value)} style={{ ...styles.input, resize: 'vertical' }} />
        </Field>

        <button onClick={analizar} disabled={loading || timeframesUsados.length === 0} className="jc-btn jc-btn-primary" style={styles.saveBtn}>
          {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <ScanEye size={16} />} {loading ? 'Analizando…' : 'Analizar'}
        </button>
      </Card>

      {resultado && (
        <Card>
          <div style={styles.cardTitle}>Resultado del análisis</div>
          <div style={styles.analisisText}>{resultado}</div>
          <button onClick={guardarEnJournal} disabled={saved} className="jc-btn jc-btn-primary" style={{ ...styles.saveBtn, marginTop: 12 }}>
            <CheckCircle2 size={16} /> {saved ? 'Guardado' : 'Guardar análisis en Journal'}
          </button>
        </Card>
      )}

      {analisisLista.length > 0 && (
        <>
          <div style={styles.cardTitle2}>Análisis guardados</div>
          {analisisLista.slice(0, 5).map((a) => (
            <Card key={a.id} style={{ marginBottom: 10 }}>
              <div style={styles.histRow}>
                <span style={styles.histDate}>{a.fecha}</span>
                <span style={styles.histPar}>{a.par.split(' ')[0]}</span>
                <span style={styles.histSesion}>{a.timeframes.join(', ')}</span>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

/* ============================================================
   PANTALLA: NEXO (asistente)
   ============================================================ */

const CONOCIMIENTO_BASE_V0 = `
CONOCIMIENTO BASE V0 — GESTIÓN DE RIESGO (metodología Journal Capital):
Proteger el capital es prioridad sobre ganar una operación individual. Toda operación debe tener riesgo definido antes de entrar. El resultado se mide en R, no solo en dinero. No se aumenta el riesgo para recuperar pérdidas. Se respetan los límites diario y semanal. Después de una pérdida se revisa el estado emocional antes de seguir operando. Después de dos pérdidas consecutivas corresponde pausar si el plan lo indica. No se opera fuera de los horarios/sesiones definidos, ni setups fuera del plan, ni sin invalidación clara, ni sin aceptar emocionalmente la pérdida posible. La pérdida no es fracaso, es información. Una operación ganadora fuera del plan sigue siendo un error de proceso; una perdedora dentro del plan puede ser una buena ejecución. El objetivo es consistencia del proceso, no acertar siempre.

CONOCIMIENTO BASE V0 — IDENTIDAD DEL OPERADOR:
Preguntas que podés usar cuando sea pertinente (no en cada mensaje, solo cuando aporte): ¿esta operación pertenece a tu plan? ¿estás operando por oportunidad o por ansiedad? ¿estás intentando recuperar? ¿tu riesgo está definido? ¿aceptarías esta pérdida sin romperte emocionalmente? ¿esta decisión protege tu capital? ¿estás actuando como operador profesional o como apostador? ¿estás ejecutando un sistema o reaccionando al mercado?

CONOCIMIENTO BASE V0 — ACCIÓN DE PRECIO INSTITUCIONAL BÁSICA:
Al revisar una captura, contemplá: contexto mayor, tendencia o rango, máximos y mínimos relevantes, zonas de soporte/resistencia, posibles zonas de liquidez, rupturas de estructura, retesteos, confirmaciones, invalidación de la hipótesis, relación riesgo/beneficio, e incertidumbre de la lectura. Separá siempre observación objetiva de interpretación. Nunca inventes niveles o patrones que no se vean con claridad.

FORMATO DE RESPUESTA cuando te pregunten algo como "¿qué pensás de esta operación?":
1. Lectura técnica si hay captura adjunta.
2. Revisión contra el plan de riesgo (si está cargado).
3. Riesgo definido o faltante.
4. Estado emocional si está cargado.
5. Una pregunta de identidad operativa, si aporta.
6. Advertencia si falta información importante.
7. Recordatorio breve de que la decisión final es del operador.
No apliques este formato rígido a preguntas simples de teoría — usalo cuando evalúes una operación concreta.`;

function buildNexoSystemPrompt(modo) {
  const base = `Sos NEXO, el copiloto de trading dentro de "Journal Capital Trading". Tu rol no es reemplazar al operador, sino ayudarlo a analizar contexto, cuidar el riesgo, respetar su plan y mejorar su disciplina y su proceso. Nunca dás señales del tipo "comprá ahora", "vendé ahora" o "esta operación es segura".

Quién es el usuario: Pablo, un trader que opera principalmente OTC en Quotex (scalping, sobre todo AUD/NZD OTC) y estudia acción de precio institucional y order flow. Su desafío principal no es la técnica — es la gestión de riesgo y el autosabotaje. Trátalo como un trader capaz, no como un principiante.

Reglas:
- Si te paso estadísticas del journal, son calculadas por código — usalas tal cual, no inventes ni recalcules números.
- Toda conclusión estadística debe mencionar el tamaño de muestra si está disponible.
- No presentes correlaciones como causalidad ni porcentajes como garantías futuras.
- Hablá como copiloto: "según tu plan, esto todavía no cumple confirmación", "tu riesgo supera el límite definido", "estás operando después de dos pérdidas seguidas".
- Tus respuestas pueden leerse en voz alta: evitá markdown, asteriscos y títulos con #.`;

  const modos = {
    analisis: 'Modo actual: ANÁLISIS. Enfocate en ayudar a leer contexto de mercado y gráficos.',
    riesgo: 'Modo actual: RIESGO. Enfocate en evaluar exposición, límites diarios/semanales, tamaño de posición y cumplimiento del plan de riesgo.',
    disciplina: 'Modo actual: DISCIPLINA. Enfocate en ayudarlo a no romper reglas, no sobreoperar y no operar desde ansiedad, euforia o revancha.',
    estudio: 'Modo actual: ESTUDIO. Respondé dudas teóricas de acción de precio, order flow y gestión de riesgo con tus propias palabras.',
    revision: 'Modo actual: REVISIÓN. Enfocate en revisar operaciones pasadas, estadísticas y patrones detectados.',
    identidad: 'Modo actual: IDENTIDAD. Ayudalo a reflexionar: ¿está operando como profesional o como apostador? ¿por plan o por impulso? ¿está protegiendo su capital?',
  };
  return base + '\n\n' + (modos[modo] || modos.analisis) + '\n' + CONOCIMIENTO_BASE_V0;
}

function NexoScreen({ trades, plan }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [modo, setModo] = useState('analisis');
  const [autoRead, setAutoRead] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(true);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const scrollRef = useRef(null);
  const taRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const autoReadRef = useRef(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const h = await storage.get('bot-chat-history', false);
        if (h && h.value) setMessages(JSON.parse(h.value));
      } catch (e) {}
      loadedRef.current = true;
    })();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setVoiceSupported(false);
    if (!window.speechSynthesis) setTtsSupported(false);
    return () => {
      try { recognitionRef.current && recognitionRef.current.stop(); } catch (e) {}
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const persistHistory = async (next) => {
    try { await storage.set('bot-chat-history', JSON.stringify(next), false); } catch (e) {}
  };

  const speak = (text, onDone) => {
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'es-AR';
      utter.rate = 1;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => { setSpeaking(false); if (onDone) onDone(); };
      utter.onerror = () => { setSpeaking(false); if (onDone) onDone(); };
      window.speechSynthesis.speak(utter);
    } catch (e) { if (onDone) onDone(); }
  };

  const toggleAutoRead = () => {
    const next = !autoRead;
    autoReadRef.current = next;
    setAutoRead(next);
    if (!next) { try { window.speechSynthesis.cancel(); } catch (e) {} setSpeaking(false); }
  };

  const toggleDictate = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { try { recognitionRef.current && recognitionRef.current.stop(); } catch (e) {} setListening(false); return; }
    const rec = new SR();
    rec.lang = 'es-AR';
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onresult = (ev) => setInput((prev) => (prev ? prev + ' ' : '') + ev.results[0][0].transcript);
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
  };

  const handleImagePick = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    resizeImage(file, 1200, 0.82).then(setPendingImage);
    e.target.value = '';
  };

  const send = async () => {
    const text = input.trim();
    const imageForSend = pendingImage;
    if (!text && !imageForSend) return;
    if (sending) return;
    const userMsg = { id: uid(), role: 'user', text, image: imageForSend || null };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    setInput('');
    setPendingImage(null);
    if (taRef.current) taRef.current.style.height = 'auto';
    setSending(true);

    try {
      const apiMessages = nextMsgs.map((m) => {
        if (m.image) {
          const match = m.image.match(/^data:(image\/\w+);base64,(.+)$/);
          return { role: m.role, content: [{ type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } }, { type: 'text', text: m.text || 'Analizá este gráfico.' }] };
        }
        return { role: m.role, content: m.text };
      });
      const contextNote = `[Contexto — no lo muestres como bloque, solo úsalo]\n${buildTradesContextText(trades)}\n\n${buildPlanContextText(plan)}`;

      const res = await callAI({
        system: buildNexoSystemPrompt(modo) + '\n\n' + contextNote,
        messages: apiMessages,
        context: 'nexo',
      });
      const replyText = res.ok ? (res.text || 'No pude generar una respuesta, probá de nuevo.') : res.error;
      const botMsg = { id: uid(), role: 'assistant', text: replyText };
      const finalMsgs = [...nextMsgs, botMsg];
      setMessages(finalMsgs);
      persistHistory(finalMsgs);
      setSending(false);
      if (autoReadRef.current && res.ok) speak(replyText);
      return;
    } catch (e) {
      const errMsg = { id: uid(), role: 'assistant', text: 'Hubo un error inesperado. Probá de nuevo en un momento.' };
      const finalMsgs = [...nextMsgs, errMsg];
      setMessages(finalMsgs);
      persistHistory(finalMsgs);
    }
    setSending(false);
  };

  const clearChat = async () => { setMessages([]); await persistHistory([]); };
  const onKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div style={styles.nexoWrap}>
      <div style={styles.modoRow}>
        {MODOS_NEXO.map((m) => (
          <button key={m.id} onClick={() => setModo(m.id)} className={`jc-btn jc-neutral-sel ${modo === m.id ? 'is-selected' : ''}`} style={styles.modoChip}>{m.label}</button>
        ))}
      </div>

      <div style={styles.nexoHeaderRow}>
        <div style={styles.nexoStatus}>
          {trades.length > 0 ? `conectado a ${trades.length} operaciones` : 'sin operaciones cargadas'}{plan ? ' · plan definido' : ' · sin plan definido'}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {ttsSupported && (
            <button onClick={toggleAutoRead} style={{ ...styles.clearBtn, ...(autoRead ? styles.voiceBtnActive : {}) }}>
              {autoRead ? <Volume2 size={12} /> : <VolumeX size={12} />} {autoRead ? 'Leyendo' : 'Leer'}
            </button>
          )}
          {messages.length > 0 && <button onClick={clearChat} style={styles.clearBtn}><Trash2 size={12} /> Limpiar</button>}
        </div>
      </div>
      {!AI_CONNECTED && (
        <div style={styles.aiDisconnectedBanner}>
          <WifiOff size={13} /> NEXO AI no conectado. El Journal, Rendimiento y Plan/Riesgo siguen funcionando normalmente.
        </div>
      )}

      <div ref={scrollRef} style={styles.chatArea}>
        {messages.length === 0 && (
          <div style={styles.welcome}>
            <Sparkles size={24} color="#c9973f" />
            <div style={styles.welcomeTitle}>Consultá a NEXO</div>
            <div style={styles.welcomeSub}>Elegí un modo arriba y preguntale sobre tu operativa, tu riesgo o tus operaciones cargadas.</div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{ ...styles.msgRow, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'assistant' && <div style={styles.avatar}>◆</div>}
            <div style={{ ...styles.bubble, ...(m.role === 'user' ? styles.bubbleUser : styles.bubbleBot), flexDirection: 'column', alignItems: 'stretch' }}>
              {m.image && <img src={m.image} alt="adjunto" style={styles.chatImage} />}
              {m.text && <span>{m.text}</span>}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ ...styles.msgRow, justifyContent: 'flex-start' }}>
            <div style={styles.avatar}>◆</div>
            <div style={{ ...styles.bubble, ...styles.bubbleBot }}><Loader2 size={15} /> escribiendo…</div>
          </div>
        )}
      </div>

      <div style={styles.inputWrap}>
        {pendingImage && (
          <div style={styles.pendingImageRow}>
            <img src={pendingImage} alt="pendiente" style={styles.pendingThumb} />
            <span style={styles.pendingLabel}>Gráfico listo para analizar</span>
            <button onClick={() => setPendingImage(null)} style={styles.removeImgBtn}><X size={14} /></button>
          </div>
        )}
        <div style={styles.inputBar}>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImagePick} style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current.click()} style={styles.micBtn}><ImagePlus size={16} /></button>
          {voiceSupported && (
            <button onClick={toggleDictate} style={{ ...styles.micBtn, ...(listening ? styles.micBtnActive : {}) }}>
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}
          <textarea ref={taRef} value={input}
            onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'; }}
            onKeyDown={onKeyDown} placeholder="Escribí tu consulta…" rows={1} style={styles.textarea} />
          <button onClick={send} disabled={sending || (!input.trim() && !pendingImage)} style={{ ...styles.sendBtn, opacity: sending || (!input.trim() && !pendingImage) ? 0.5 : 1 }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PANTALLA: PLAN / RIESGO
   ============================================================ */

function emptyPlan() {
  return { capital: '', riesgoPorOperacion: '', limiteDiario: '', limiteSemanal: '', maxOperacionesDia: '', horarios: '', setupsValidos: '', reglaTrasPerdida: '', reglaTrasDosPerdidas: '', checklist: '' };
}

function PlanScreen({ plan, persist }) {
  const [form, setForm] = useState(plan || emptyPlan());
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (plan) setForm(plan); }, [plan]);

  const save = async () => {
    await persist(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  };

  return (
    <div style={styles.screenPad}>
      <Card>
        <div style={styles.cardTitle}><ShieldCheck size={15} color="#c9973f" /> Plan de riesgo</div>
        <div style={styles.formGrid2}>
          <Field label="Capital de trading ($)">
            <input type="number" value={form.capital} onChange={(e) => setForm({ ...form, capital: e.target.value })} style={styles.input} />
          </Field>
          <Field label="Riesgo máximo por operación">
            <input type="text" placeholder="Ej: 1% o $10" value={form.riesgoPorOperacion} onChange={(e) => setForm({ ...form, riesgoPorOperacion: e.target.value })} style={styles.input} />
          </Field>
        </div>
        <div style={styles.formGrid2}>
          <Field label="Límite de pérdida diario ($)">
            <input type="number" value={form.limiteDiario} onChange={(e) => setForm({ ...form, limiteDiario: e.target.value })} style={styles.input} />
          </Field>
          <Field label="Límite de pérdida semanal ($)">
            <input type="number" value={form.limiteSemanal} onChange={(e) => setForm({ ...form, limiteSemanal: e.target.value })} style={styles.input} />
          </Field>
        </div>
        <Field label="Máximo de operaciones por día">
          <input type="number" value={form.maxOperacionesDia} onChange={(e) => setForm({ ...form, maxOperacionesDia: e.target.value })} style={styles.input} />
        </Field>
        <Field label="Horarios / sesiones permitidas">
          <input type="text" value={form.horarios} onChange={(e) => setForm({ ...form, horarios: e.target.value })} style={styles.input} />
        </Field>
        <Field label="Setups válidos">
          <input type="text" value={form.setupsValidos} onChange={(e) => setForm({ ...form, setupsValidos: e.target.value })} style={styles.input} />
        </Field>
        <Field label="Regla después de una pérdida">
          <input type="text" value={form.reglaTrasPerdida} onChange={(e) => setForm({ ...form, reglaTrasPerdida: e.target.value })} style={styles.input} />
        </Field>
        <Field label="Regla después de dos pérdidas seguidas">
          <input type="text" value={form.reglaTrasDosPerdidas} onChange={(e) => setForm({ ...form, reglaTrasDosPerdidas: e.target.value })} style={styles.input} />
        </Field>
        <Field label="Checklist pre-operación" hint="una línea por ítem">
          <textarea rows={4} value={form.checklist} onChange={(e) => setForm({ ...form, checklist: e.target.value })} style={{ ...styles.input, resize: 'vertical' }} />
        </Field>
        <button onClick={save} className="jc-btn jc-btn-primary" style={styles.saveBtn}>{saved ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />} {saved ? 'Guardado' : 'Guardar plan'}</button>
      </Card>
      <div style={styles.rNote}>NEXO compara tus operaciones y consultas contra este plan cuando está definido.</div>
    </div>
  );
}

/* ============================================================
   PANTALLAS STUB: CALENDARIO / APRENDER
   ============================================================ */

function StubScreen({ icon: Icon, titulo, descripcion, itemsFuturos }) {
  return (
    <div style={styles.screenPad}>
      <Card>
        <div style={styles.stubHeader}>
          <Icon size={28} color="#c9973f" />
          <div style={styles.stubTitle}>{titulo}</div>
        </div>
        <div style={styles.stubDesc}>{descripcion}</div>
        <NoConectado texto="Preparado para próxima fase — no conectado todavía" />
        <div style={styles.stubList}>
          {itemsFuturos.map((it) => <div key={it} style={styles.stubItem}>· {it}</div>)}
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   PANTALLA: CONFIGURACIÓN
   ============================================================ */

function generarTradesDemo() {
  const setups = ['Reversión en soporte', 'Ruptura de rango', 'Retest de zona', 'Continuación de tendencia', 'Reversión en resistencia'];
  const out = [];
  for (let i = 0; i < 25; i++) {
    const diasAtras = Math.floor(Math.random() * 30);
    const d = new Date();
    d.setDate(d.getDate() - diasAtras);
    const resultado = Math.random() < 0.52 ? 'Ganada' : Math.random() < 0.85 ? 'Perdida' : 'Empate';
    const monto = resultado === 'Empate' ? 0 : Math.round((5 + Math.random() * 25) * 100) / 100;
    const emocion = EMOCIONES[Math.floor(Math.random() * EMOCIONES.length)].id;
    out.push({
      id: uid(), demo: true,
      fecha: d.toISOString().slice(0, 10),
      hora: `${String(8 + Math.floor(Math.random() * 10)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      par: PARES[Math.floor(Math.random() * (PARES.length - 1))],
      direccion: Math.random() < 0.5 ? 'Compra' : 'Venta',
      resultado, monto,
      riesgo: Math.round((3 + Math.random() * 8) * 100) / 100,
      sesion: SESIONES[Math.floor(Math.random() * SESIONES.length)],
      temporalidad: TEMPORALIDADES[Math.floor(Math.random() * TEMPORALIDADES.length)],
      setup: setups[Math.floor(Math.random() * setups.length)],
      emocion, emocionDespues: '',
      cumplimientoPlan: Math.random() < 0.75 ? 'Sí' : 'No',
      motivoEntrada: '', stopLoss: '', takeProfit: '', errores: '', aprendizaje: '',
      notas: 'Operación de demo generada para probar estadísticas.',
      captura: null, planStatus: 'cumple', controlRiesgo: [], checklistCumplido: null,
    });
  }
  return out;
}

function ConfiguracionScreen({ trades, persistTrades }) {
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);
  const hayDemo = trades.some((t) => t.demo);

  const cargarDemo = async () => {
    await persistTrades([...generarTradesDemo(), ...trades]);
    setMsg('Se cargaron 25 operaciones demo. Mirá Rendimiento para probar las estadísticas.');
  };

  const borrarDemo = async () => {
    await persistTrades(trades.filter((t) => !t.demo));
    setMsg('Datos demo borrados. Tus operaciones reales quedaron intactas.');
  };

  const exportar = async () => {
    const keys = ['trades', 'plan-riesgo', 'analisis', 'bot-chat-history'];
    const out = {};
    for (const k of keys) {
      try { const r = await storage.get(k, false); if (r && r.value) out[k] = JSON.parse(r.value); } catch (e) {}
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `journal-capital-backup-${todayISO()}.json`; a.click();
    URL.revokeObjectURL(url);
    setMsg('Backup descargado.');
  };

  const importar = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        for (const k of Object.keys(data)) {
          await storage.set(k, JSON.stringify(data[k]), false);
        }
        setMsg('Datos importados. Recargá la app para verlos reflejados.');
      } catch (err) { setMsg('El archivo no es un backup válido.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div style={styles.screenPad}>
      <Card>
        <div style={styles.cardTitle}><FlaskConical size={15} color="#c9973f" /> Modo demo</div>
        <div style={{ fontSize: '0.8rem', color: '#8a93a3', marginBottom: 12 }}>Cargá operaciones ficticias para probar Rendimiento, Patrones y NEXO sin tocar tus datos reales. Quedan marcadas y se pueden borrar sin afectar el resto.</div>
        <button onClick={cargarDemo} className="jc-btn jc-btn-primary" style={styles.saveBtn}><FlaskConical size={16} /> Cargar datos demo</button>
        {hayDemo && (
          <button onClick={borrarDemo} className="jc-btn jc-danger" style={{ ...styles.saveBtn, marginTop: 10 }}>
            <Trash2 size={16} /> Borrar datos demo
          </button>
        )}
      </Card>
      <Card>
        <div style={styles.cardTitle}>Datos</div>
        <button onClick={exportar} className="jc-btn jc-btn-primary" style={styles.saveBtn}><Download size={16} /> Exportar backup (JSON)</button>
        <input ref={fileRef} type="file" accept="application/json" onChange={importar} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current.click()} className="jc-btn jc-neutral-sel is-selected" style={{ ...styles.saveBtn, marginTop: 10 }}>
          <Upload size={16} /> Importar backup
        </button>
        {msg && <div style={styles.rNote}>{msg}</div>}
      </Card>
      <Card>
        <div style={styles.cardTitle}>Estado de conexiones futuras</div>
        <NoConectado texto="Backend / base de datos remota: no conectado" />
        <NoConectado texto="Calendario económico (API de noticias): no conectado" />
        <NoConectado texto="Biblioteca RAG (manuales propios): no conectado" />
        <NoConectado texto="Google Calendar: no conectado" />
      </Card>
    </div>
  );
}

/* ============================================================
   APP RAÍZ
   ============================================================ */

const TABS_PRINCIPALES = [
  { id: 'inicio', label: 'Inicio', icon: Home },
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'analizar', label: 'Analizar', icon: ScanEye },
  { id: 'rendimiento', label: 'Rendimiento', icon: BarChart3 },
  { id: 'nexo', label: 'NEXO', icon: MessageCircle },
];
const TABS_MAS = [
  { id: 'plan', label: 'Plan / Riesgo', icon: ShieldCheck },
  { id: 'calendario', label: 'Calendario', icon: Calendar },
  { id: 'aprender', label: 'Aprender', icon: GraduationCap },
  { id: 'config', label: 'Configuración', icon: Settings },
];

export default function JournalCapitalApp() {
  const [tab, setTab] = useState('inicio');
  const [masAbierto, setMasAbierto] = useState(false);
  const { trades, persist: persistTrades, loaded: tradesLoaded } = useTrades();
  const { plan, persist: persistPlan } = usePlan();
  const { lista: analisisLista, persist: persistAnalisis } = useAnalisis();
  const enTabsMas = TABS_MAS.some((t) => t.id === tab);

  const irA = (id) => { setTab(id); setMasAbierto(false); };

  return (
    <div style={styles.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        textarea, input, select, button { font-family: 'Inter', sans-serif; }
        textarea:focus, input:focus, select:focus, button:focus-visible { outline: 2px solid #c9973f; outline-offset: 1px; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: #2a3441; border-radius: 4px; }
        @keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }

        :root {
          --jc-gold: #d4a33f; --jc-gold-dim: rgba(212,163,63,0.13); --jc-gold-glow: 0 0 0 1px rgba(212,163,63,0.3), 0 0 10px rgba(212,163,63,0.16);
          --jc-green: #42c99a; --jc-green-dim: rgba(66,201,154,0.13); --jc-green-glow: 0 0 0 1px rgba(66,201,154,0.32), 0 0 10px rgba(66,201,154,0.18);
          --jc-red: #e45b68; --jc-red-dim: rgba(228,91,104,0.13); --jc-red-glow: 0 0 0 1px rgba(228,91,104,0.32), 0 0 10px rgba(228,91,104,0.18);
          --jc-blue: #5fa8ff; --jc-blue-dim: rgba(95,168,255,0.13); --jc-blue-glow: 0 0 0 1px rgba(95,168,255,0.32), 0 0 10px rgba(95,168,255,0.18);
          --jc-neutral: #3a4453;
        }
        .jc-btn { background: transparent; border: 1px solid var(--jc-neutral); color: #9aa3b0; border-radius: 7px; cursor: pointer; transition: filter .15s ease, background .15s ease, box-shadow .15s ease; font-family: 'Inter', sans-serif; }
        .jc-btn:hover:not(:disabled) { filter: brightness(1.22); }
        .jc-btn:focus-visible { outline: 2px solid var(--jc-gold); outline-offset: 1px; }
        .jc-btn:disabled { opacity: .42; cursor: not-allowed; filter: none; box-shadow: none; }

        .jc-gold { border-color: var(--jc-gold); color: var(--jc-gold); }
        .jc-gold.is-selected { background: var(--jc-gold-dim); box-shadow: var(--jc-gold-glow); }

        .jc-success { border-color: rgba(66,201,154,0.55); color: var(--jc-green); }
        .jc-success.is-selected { background: var(--jc-green-dim); box-shadow: var(--jc-green-glow); color: #7be0bb; border-color: var(--jc-green); }

        .jc-danger { border-color: rgba(228,91,104,0.55); color: var(--jc-red); }
        .jc-danger.is-selected { background: var(--jc-red-dim); box-shadow: var(--jc-red-glow); color: #ff8a92; border-color: var(--jc-red); }

        .jc-info { border-color: rgba(95,168,255,0.55); color: var(--jc-blue); }
        .jc-info.is-selected { background: var(--jc-blue-dim); box-shadow: var(--jc-blue-glow); color: #9cc7ff; border-color: var(--jc-blue); }

        .jc-neutral-sel { border-color: var(--jc-neutral); color: #8a93a3; }
        .jc-neutral-sel.is-selected { border-color: var(--jc-gold); color: var(--jc-gold); background: var(--jc-gold-dim); box-shadow: var(--jc-gold-glow); }

        .jc-btn-primary { border: 1px solid var(--jc-gold); color: var(--jc-gold); background: transparent; box-shadow: var(--jc-gold-glow); font-weight: 600; }
        .jc-btn-primary:hover:not(:disabled) { filter: brightness(1.25); }
      `}</style>

      <header style={styles.topHeader}>
        <span style={styles.brandMark}>◆</span>
        <div style={styles.brandTitle}>Journal Capital Trading</div>
      </header>

      <main style={styles.main}>
        {tab === 'inicio' && <InicioScreen trades={trades} plan={plan} onGoTab={setTab} />}
        {tab === 'journal' && <JournalScreen trades={trades} persist={persistTrades} loaded={tradesLoaded} plan={plan} />}
        {tab === 'analizar' && <AnalizarScreen trades={trades} persist={persistTrades} analisisLista={analisisLista} persistAnalisis={persistAnalisis} />}
        {tab === 'rendimiento' && <RendimientoScreen trades={trades} />}
        {tab === 'nexo' && <NexoScreen trades={trades} plan={plan} />}
        {tab === 'plan' && <PlanScreen plan={plan} persist={persistPlan} />}
        {tab === 'calendario' && (
          <StubScreen icon={Calendar} titulo="Calendario"
            descripcion="Organización diaria y semanal de tu operativa: qué sesiones operar, revisión del día, notas asociadas a operaciones."
            itemsFuturos={['Vista diaria, semanal y mensual', 'Checklist del día y revisión semanal', 'Notas asociadas a operaciones', 'Integración futura con Google Calendar']} />
        )}
        {tab === 'aprender' && (
          <StubScreen icon={GraduationCap} titulo="Aprender"
            descripcion="Biblioteca de metodología Journal Capital: tus propios manuales de acción de precio, chartismo, gestión de riesgo, psicología e identidad del operador."
            itemsFuturos={['Carga de manuales propios (sin scraping ni contenido con copyright)', 'Búsqueda y citas por documento/sección', 'NEXO respondiendo "según la metodología Journal Capital..."', 'Requiere backend con RAG — todavía no conectado']} />
        )}
        {tab === 'config' && <ConfiguracionScreen trades={trades} persistTrades={persistTrades} />}
      </main>

      {masAbierto && (
        <div style={styles.masOverlay} onClick={() => setMasAbierto(false)}>
          <div style={styles.masSheet} onClick={(e) => e.stopPropagation()}>
            <div style={styles.masSheetTitle}>Más</div>
            {TABS_MAS.map((t) => (
              <button key={t.id} onClick={() => irA(t.id)} style={{ ...styles.masItem, ...(tab === t.id ? styles.masItemActive : {}) }}>
                <t.icon size={17} /> {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <nav style={styles.tabBar}>
        {TABS_PRINCIPALES.map((t) => (
          <button key={t.id} onClick={() => irA(t.id)} style={{ ...styles.tabBtn, ...(tab === t.id ? styles.tabBtnActive : {}) }}>
            <t.icon size={17} />
            <span style={styles.tabLabel}>{t.label}</span>
          </button>
        ))}
        <button onClick={() => setMasAbierto((v) => !v)} style={{ ...styles.tabBtn, ...(enTabsMas || masAbierto ? styles.tabBtnActive : {}) }}>
          <MoreHorizontal size={17} />
          <span style={styles.tabLabel}>Más</span>
        </button>
      </nav>
    </div>
  );
}

/* ============================================================
   ESTILOS COMPARTIDOS
   ============================================================ */

const styles = {
  app: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d1117', color: '#e8e4da', fontFamily: "'Inter', sans-serif" },
  topHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid #1f2733', flexShrink: 0 },
  brandMark: { color: '#c9973f', fontSize: 18 },
  brandTitle: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '0.95rem' },
  main: { flex: 1, overflowY: 'auto' },
  screenPad: { padding: '16px 16px 90px 16px' },

  tabBar: { display: 'flex', borderTop: '1px solid #1f2733', background: '#0d1117', flexShrink: 0 },
  tabBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '9px 4px', background: 'none', border: 'none', color: '#5a6472', cursor: 'pointer' },
  tabBtnActive: { color: '#c9973f' },
  tabLabel: { fontSize: '0.6rem', fontFamily: "'IBM Plex Mono', monospace" },

  masOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', zIndex: 50 },
  masSheet: { width: '100%', background: '#131a24', borderTop: '1px solid #2a3441', borderRadius: '14px 14px 0 0', padding: '10px 10px 24px 10px' },
  masSheetTitle: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '0.85rem', color: '#8a93a3', padding: '8px 10px' },
  masItem: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 12px', background: 'none', border: 'none', borderRadius: 8, color: '#e8e4da', fontSize: '0.88rem', cursor: 'pointer', textAlign: 'left' },
  masItemActive: { color: '#c9973f', background: 'rgba(201,151,63,0.1)' },

  card: { background: '#131a24', border: '1px solid #1f2733', borderRadius: 10, padding: 16, marginBottom: 14 },
  cardTitle: { display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '0.9rem', marginBottom: 12 },
  cardTitle2: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '0.85rem', color: '#c9c4b5', margin: '18px 0 8px 4px' },

  fieldLabel: { display: 'block', fontSize: '0.76rem', color: '#8a93a3', marginBottom: 6, fontFamily: "'IBM Plex Mono', monospace" },
  fieldHint: { fontSize: '0.68rem', color: '#5a6472', marginTop: 4 },
  input: { width: '100%', background: '#0d1117', border: '1px solid #2a3441', borderRadius: 7, padding: '10px 12px', color: '#e8e4da', fontSize: '0.86rem' },
  formGrid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },

  toggleRow: { display: 'flex', gap: 8 },
  toggleBtn: { flex: 1, padding: '9px 8px', borderRadius: 7, fontSize: '0.8rem' },

  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: { padding: '7px 11px', borderRadius: 100, fontSize: '0.75rem' },

  captureBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 13px', background: '#0d1117', border: '1px solid #2a3441', borderRadius: 7, color: '#c9c4b5', fontSize: '0.8rem', cursor: 'pointer' },
  thumb: { width: 90, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid #2a3441' },
  thumbX: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, background: '#c96a4e', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },

  avanzadoToggle: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#8a93a3', fontSize: '0.78rem', cursor: 'pointer', padding: '6px 0' },

  controlRiesgoBox: { background: '#0d1117', border: '1px solid #1f2733', borderRadius: 8, padding: '12px 13px', marginTop: 14 },
  controlRiesgoTitle: { display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '0.8rem', marginBottom: 8 },
  controlRiesgoRow: { display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: '0.78rem', lineHeight: 1.4, marginBottom: 6 },
  controlRiesgoTextSmall: { fontSize: '0.74rem', color: '#8a93a3', lineHeight: 1.5 },
  checklistRow: { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.8rem', color: '#c9c4b5', marginBottom: 8, cursor: 'pointer' },

  saveBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 8, fontSize: '0.88rem', marginTop: 6 },

  subtabs: { display: 'flex', gap: 8, marginBottom: 14 },
  subtabBtn: { flex: 1, padding: '9px', borderRadius: 7, fontSize: '0.82rem' },

  emptyMsg: { textAlign: 'center', color: '#5a6472', fontSize: '0.85rem', padding: '40px 10px' },
  emptyMsgSmall: { color: '#5a6472', fontSize: '0.78rem' },

  histRow: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  histDate: { fontSize: '0.78rem', color: '#8a93a3', fontFamily: "'IBM Plex Mono', monospace" },
  histPar: { fontSize: '0.8rem', flex: 1 },
  histSesion: { fontSize: '0.72rem', color: '#5a6472' },
  histMonto: { fontWeight: 600, fontSize: '0.85rem' },
  histDetail: { marginTop: 12, paddingTop: 12, borderTop: '1px solid #1f2733' },
  detailImg: { width: '100%', borderRadius: 7, marginBottom: 10 },
  detailRow: { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '0.8rem', marginBottom: 6 },
  detailLabel: { color: '#5a6472', flexShrink: 0 },
  detailVal: { color: '#c9c4b5', textAlign: 'right' },
  detailActions: { display: 'flex', gap: 8, marginTop: 10 },
  smallBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', background: '#0d1117', border: '1px solid #2a3441', borderRadius: 6, color: '#8a93a3', fontSize: '0.75rem', cursor: 'pointer' },

  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  statBox: { background: '#0d1117', border: '1px solid #1f2733', borderRadius: 8, padding: '10px 12px' },
  statLabel: { fontSize: '0.68rem', color: '#5a6472', fontFamily: "'IBM Plex Mono', monospace" },
  statValue: { fontSize: '1.1rem', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", marginTop: 2 },
  statSub: { fontSize: '0.62rem', color: '#5a6472', marginTop: 2 },
  rNote: { fontSize: '0.76rem', color: '#8a93a3', marginTop: 10 },

  patternRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #1f2733', fontSize: '0.8rem' },
  patternKey: { flex: 1, color: '#c9c4b5' },
  patternWr: { fontWeight: 600, width: 44, textAlign: 'right' },
  patternN: { color: '#5a6472', fontSize: '0.7rem', width: 48, textAlign: 'right' },
  sampleWarning: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: '#5a6472', marginTop: 6, marginBottom: 20 },

  noConectado: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: '#5a6472', background: '#0d1117', border: '1px dashed #2a3441', borderRadius: 7, padding: '8px 10px', marginBottom: 8 },
  aiDisconnectedBanner: { display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.74rem', color: '#c9973f', background: 'rgba(201,151,63,0.08)', border: '1px dashed rgba(201,151,63,0.4)', borderRadius: 7, padding: '9px 11px', marginBottom: 12, lineHeight: 1.4 },

  inicioHero: { padding: '4px 4px 16px 4px' },
  inicioSlogan: { fontFamily: "'Space Grotesk', sans-serif", fontStyle: 'italic', fontSize: '0.86rem', color: '#c9973f', lineHeight: 1.4 },
  accesosGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 },
  accesoBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 10px', background: '#131a24', border: '1px solid #1f2733', borderRadius: 10, color: '#c9c4b5', fontSize: '0.76rem', cursor: 'pointer' },

  tfGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 14 },
  tfSlot: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  tfBtn: { width: '100%', aspectRatio: '1', background: '#0d1117', border: '1px dashed #2a3441', borderRadius: 7, color: '#5a6472', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  tfThumb: { width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 7, border: '1px solid #2a3441' },
  tfLabel: { fontSize: '0.62rem', color: '#8a93a3', fontFamily: "'IBM Plex Mono', monospace" },
  analisisText: { fontSize: '0.85rem', lineHeight: 1.6, color: '#e8e4da', whiteSpace: 'pre-wrap' },

  nexoWrap: { display: 'flex', flexDirection: 'column', height: '100%' },
  modoRow: { display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 14px 0 14px', flexShrink: 0 },
  modoChip: { flex: '0 0 auto', padding: '6px 12px', borderRadius: 100, fontSize: '0.72rem' },
  nexoHeaderRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', flexShrink: 0 },
  nexoStatus: { fontSize: '0.7rem', color: '#5a6472', fontFamily: "'IBM Plex Mono', monospace" },
  clearBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: '#131a24', border: '1px solid #2a3441', borderRadius: 5, color: '#8a93a3', fontSize: '0.7rem', cursor: 'pointer' },
  voiceBtnActive: { background: '#c96a4e', borderColor: '#c96a4e', color: '#fff' },

  chatArea: { flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 12 },
  welcome: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6, margin: 'auto', maxWidth: 340, padding: '24px 10px' },
  welcomeTitle: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '1rem' },
  welcomeSub: { fontSize: '0.8rem', color: '#8a93a3', lineHeight: 1.5 },
  msgRow: { display: 'flex', gap: 8 },
  avatar: { width: 24, height: 24, borderRadius: 6, background: '#131a24', border: '1px solid #2a3441', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9973f', fontSize: 11, flexShrink: 0 },
  bubble: { maxWidth: '78%', padding: '10px 13px', borderRadius: 9, fontSize: '0.86rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  bubbleUser: { background: '#c9973f', color: '#0d1117', fontWeight: 500 },
  bubbleBot: { background: '#131a24', border: '1px solid #1f2733', color: '#e8e4da' },
  chatImage: { width: '100%', maxWidth: 220, borderRadius: 7, marginBottom: 6, display: 'block' },

  inputWrap: { borderTop: '1px solid #1f2733', flexShrink: 0 },
  pendingImageRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px 0 14px' },
  pendingThumb: { width: 36, height: 36, objectFit: 'cover', borderRadius: 6, border: '1px solid #2a3441' },
  pendingLabel: { fontSize: '0.74rem', color: '#8a93a3', flex: 1 },
  removeImgBtn: { width: 24, height: 24, borderRadius: 6, background: '#131a24', border: '1px solid #2a3441', color: '#8a93a3', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  inputBar: { display: 'flex', gap: 8, padding: '10px 14px', alignItems: 'flex-end' },
  micBtn: { width: 38, height: 38, borderRadius: 8, background: '#131a24', border: '1px solid #2a3441', color: '#c9c4b5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  micBtnActive: { background: '#c96a4e', borderColor: '#c96a4e', color: '#fff' },
  textarea: { flex: 1, background: '#131a24', border: '1px solid #2a3441', borderRadius: 8, padding: '9px 12px', color: '#e8e4da', fontSize: '0.86rem', resize: 'none', maxHeight: 100, lineHeight: 1.4 },
  sendBtn: { width: 38, height: 38, borderRadius: 8, background: '#c9973f', border: 'none', color: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },

  stubHeader: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', marginBottom: 10 },
  stubTitle: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.1rem' },
  stubDesc: { fontSize: '0.82rem', color: '#8a93a3', textAlign: 'center', lineHeight: 1.5, marginBottom: 14 },
  stubList: { marginTop: 10 },
  stubItem: { fontSize: '0.78rem', color: '#5a6472', padding: '3px 0' },
};
