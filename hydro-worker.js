// М31 · стенд звезды: газодинамика выбранных трубок короны в фоновом потоке (этап 3 плана, второй шаг; автор: «давай газодинамику в трубки»;
// замысел и протокол — разбор Codex). У каждой трубки — свой hydro1d по её силовой линии (geometry 'path': абсолютная высота над фотосферой
// вдоль линии; ноги-хромосферы глубиной lch — вертикально вниз от настоящих высот оснований), сечение ∝ 1/|B| вдоль линии, нагрев — у оснований:
// от каждого основания спадает с масштабом λ, нормирован на сетке решателя отдельно для каждого: ∫Q_A·A ds = F_A·A_A, ∫Q_B·A ds = F_B·A_B.
// Сообщения (единицы СГС):
//   { op: 'epoch', epoch }                     — всё сбросить (новый снимок поля)
//   { op: 'create', epoch, id, gen, star: {R, M}, lch, s, h, area (Float64Array по линии), sampleS (места выдачи вдоль линии, неубывающие),
//     heat: { FA, FB, lamA, lamB (доли длины) }, init: { Tcor, pb (давление у поверхности, равновесие RTV) } }
//   { op: 'drop', epoch, id, gen }
//   { op: 'advance', epoch, seq, budgetMs, targets: [{ id, gen, t (возраст трубки, физ. с) }] } — один запрос в работе: следующий — после ответа
// Ответы:
//   { op: 'created', epoch, id, gen, N, ms }
//   { op: 'profiles', epoch, seq, cpuMs, items: [{ id, gen, t, lag, ms (процессор на эту петлю), samples: Float32Array 4·M — [n_e, T, u, j174] в окне каждой точки, totals }] }
//   { op: 'error', epoch, id, gen, msg }
// j174 — свечение (n_e/10⁹)²·R174(T), среднее по окну точки (между серединами соседних отрезков): интеграл вдоль трубки сохраняется при любой
// ширине сгустка; излучение ячеек — ÷f_c (LTRAC: так же, как для синтеза в самом решателе)
importScripts('hydro1d.js');
const H = self.M31Hydro1D, tubes = new Map(), TCH = 2e4;
let epoch = 0;
const resp174 = T => { const z = (Math.log10(Math.max(T, 1)) - 5.95) / 0.12; return Math.exp(-0.5 * z * z); };   // как в шейдере трубок

function make(m) {
  const s = Float64Array.from(m.s), h = Float64Array.from(m.h), A = Float64Array.from(m.area), n = s.length, lch = m.lch || 1.5e8;
  if (n < 3) throw new Error('мало точек линии');
  for (let i = 0; i < n; i++) { if (!Number.isFinite(s[i]) || !Number.isFinite(h[i]) || !(A[i] > 0) || !Number.isFinite(A[i])) throw new Error('линия: не число в точке ' + i);
    if (i > 0 && !(s[i] > s[i - 1])) throw new Error('линия: s не растёт в точке ' + i); }
  const L = s[n - 1], lamA = Math.max(0.02, m.heat.lamA || 0.15) * L, lamB = Math.max(0.02, m.heat.lamB || 0.15) * L;
  const interp = (arr, x) => { if (x <= 0) return arr[0]; if (x >= L) return arr[n - 1]; let a = 0, b = n - 1; while (b - a > 1) { const k = (a + b) >> 1; if (s[k] <= x) a = k; else b = k; }
    return arr[a] + (arr[b] - arr[a]) * (x - s[a]) / (s[b] - s[a]); };
  // нагрев — только в линии (по s, не по высоте: ноги-резервуары без нагрева); коэффициенты — после сетки
  let qA = 0, qB = 0;
  const heat = x => { const xl = x - lch; if (xl <= 0 || xl >= L) return 0; return qA * Math.exp(-xl / lamA) + qB * Math.exp(-(L - xl) / lamB); };
  const tube = H.tube({ geometry: 'path', path: { s: Array.from(s), h: Array.from(h) }, lch, star: m.star, dsMin: m.dsMin || 1e7, dsMax: m.dsMax || 4e7, fine: 3e8,
    area: x => interp(A, x - lch), heat });
  // нормировка на сетке решателя (V = A·Δs ячейки — как в учёте нагрева решателя)
  const pr = tube.profile(); let IA = 0, IB = 0;
  for (let i = 0; i < tube.N; i++) { const xl = pr.s[i] - lch; if (xl <= 0 || xl >= L) continue; const V = interp(A, xl) * pr.ds[i]; IA += Math.exp(-xl / lamA) * V; IB += Math.exp(-(L - xl) / lamB) * V; }
  qA = Math.max(0, m.heat.FA) * A[0] / Math.max(1e-30, IA); qB = Math.max(0, m.heat.FB) * A[n - 1] / Math.max(1e-30, IB);
  // начало — равновесие под тяжестью: хромосфера T_ch в ногах, выше — Tcor (переход по расстоянию от ближнего конца вдоль трубки); давление
  // равновесия RTV pb (у поверхности) — перенесено к месту опоры sRef (1000 км по линии от основания A) по настоящей высоте
  // опора — центр ячейки решателя, ближайший к 1000 км по линии от A (hydrostatic() назначает давление именно ему — разбор Codex: прежде
  // давление пересчитывалось к высоте точки линии, а не ячейки — 0,2–0,6 % расхождения с RTV)
  const S = tube.S, sRefL = Math.min(1e8, 0.25 * L), mu = H.MU, R = m.star.R, GM = H.G * m.star.M;
  let jr = 0; for (let i = 0; i < tube.N; i++) if (Math.abs(tube.sc[i] - lch - sRefL) < Math.abs(tube.sc[jr] - lch - sRefL)) jr = i;
  const pRef = m.init.pb * Math.exp(-GM * mu * H.mp / (H.kB * m.init.Tcor * R) * (1 - R / (R + Math.max(0, tube.hc[jr]))));
  tube.hydrostatic(x => { const d = Math.min(x, S - x); return TCH + (m.init.Tcor - TCH) * 0.5 * (1 + Math.tanh((d - lch - 5e7) / 2e7)); }, pRef, tube.sc[jr]);
  const t0 = tube.totals();
  return { tube, L, lch, sampleS: Float64Array.from(m.sampleS), gen: m.gen, heatIn: Math.max(0, m.heat.FA) * A[0] + Math.max(0, m.heat.FB) * A[n - 1], m0: t0.mass, e0: t0.energy };
}

// выдача: окно точки j — между серединами соседних точек; среднее по перекрытию с ячейками (значения ячеек постоянны внутри — интеграл точен)
function sample(T) {
  const tb = T.tube, pr = tb.profile(), N = tb.N, fc = tb.fc, sp = T.sampleS, M = sp.length, out = new Float32Array(M * 4), lch = T.lch;
  let i = 0;
  for (let j = 0; j < M; j++) {
    const w0 = lch + (j > 0 ? 0.5 * (sp[j - 1] + sp[j]) : sp[0]), w1 = lch + (j < M - 1 ? 0.5 * (sp[j] + sp[j + 1]) : sp[M - 1]);
    let sw = 0, ne = 0, Tt = 0, u = 0, je = 0;
    if (w1 > w0) { while (i > 0 && pr.s[i] - 0.5 * pr.ds[i] > w0) i--;
      for (let k = i; k < N; k++) { const a = pr.s[k] - 0.5 * pr.ds[k], b = a + pr.ds[k]; if (a >= w1) break; if (b <= w0) { i = k + 1; continue; }
        const ov = Math.min(w1, b) - Math.max(w0, a); if (ov <= 0) continue; const n9 = pr.ne[k] / 1e9;
        sw += ov; ne += pr.ne[k] * ov; Tt += pr.T[k] * ov; u += pr.u[k] * ov; je += n9 * n9 * resp174(pr.T[k]) / (fc[k] || 1) * ov; } }
    if (sw > 0) { out[4 * j] = ne / sw; out[4 * j + 1] = Tt / sw; out[4 * j + 2] = u / sw; out[4 * j + 3] = je / sw; }
    else {   // окно нулевой ширины (повторные точки в конце линии) — значение ячейки в точке
      const x = lch + sp[j]; let k = 0; while (k < N - 1 && pr.s[k] + 0.5 * pr.ds[k] < x) k++; const n9 = pr.ne[k] / 1e9;
      out[4 * j] = pr.ne[k]; out[4 * j + 1] = pr.T[k]; out[4 * j + 2] = pr.u[k]; out[4 * j + 3] = n9 * n9 * resp174(pr.T[k]) / (fc[k] || 1); }
  }
  let Tmax = 0; for (let k = 0; k < N; k++) Tmax = Math.max(Tmax, pr.T[k]);
  const tt = tb.totals();
  return { samples: out, totals: { mass: tt.mass, dMass: (tt.mass - T.m0) / T.m0, energy: tt.energy, heat: tt.heat, rad: tt.rad, floor: tt.floor, heatIn: T.heatIn, Tmax, N, fcMax: tt.fcMax, condSplits: tt.condSplits } };
}

self.onmessage = e => { const m = e.data;
  if (m.op === 'epoch') { epoch = m.epoch; tubes.clear(); return; }
  if (m.epoch !== epoch) return;   // устаревший запрос
  if (m.op === 'create') { const t0 = performance.now();
    try { const T = make(m); tubes.set(m.id, T); self.postMessage({ op: 'created', epoch, id: m.id, gen: m.gen, N: T.tube.N, ms: performance.now() - t0 }); }
    catch (err) { tubes.delete(m.id); self.postMessage({ op: 'error', epoch, id: m.id, gen: m.gen, msg: String(err && err.message || err) }); } return; }
  if (m.op === 'drop') { const T = tubes.get(m.id); if (T && T.gen === m.gen) tubes.delete(m.id); return; }
  if (m.op === 'advance') { const t0 = performance.now(), dl = t0 + (m.budgetMs || 40), act = [];
    for (const g of m.targets) { const T = tubes.get(g.id); if (T && T.gen === g.gen) act.push({ T, id: g.id, gen: g.gen, tgt: g.t }); }
    // шаг — той трубке, что отстала больше всех (порции шагов; один step() не прерывается — бюджет мягкий)
    for (;;) { let b = null, lagMax = 1e-9; for (const a of act) { if (a.dead) continue; const l = a.tgt - a.T.tube.t; if (l > lagMax) { lagMax = l; b = a; } }
      if (!b || performance.now() >= dl) break;
      const ts = performance.now(); try { b.T.tube.step(b.tgt - b.T.tube.t); b.ms = (b.ms || 0) + performance.now() - ts; } catch (err) { b.dead = true; tubes.delete(b.id); self.postMessage({ op: 'error', epoch, id: b.id, gen: b.gen, msg: String(err && err.message || err) }); } }
    const items = [];
    for (const a of act) { if (a.dead) continue; const p = sample(a.T); items.push({ id: a.id, gen: a.gen, t: a.T.tube.t, lag: Math.max(0, a.tgt - a.T.tube.t), ms: a.ms || 0, samples: p.samples, totals: p.totals }); }
    self.postMessage({ op: 'profiles', epoch, seq: m.seq, cpuMs: performance.now() - t0, items }, items.map(x => x.samples.buffer)); }
};
