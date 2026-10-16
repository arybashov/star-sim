// М31 · стенд звезды: поверхность как нижняя граница и двигатель короны — этап 1 плана (DOC «План работ — газодинамика короны и
// поверхность звезды»; проектный разбор Codex 15.10.2026). Только стенд: игра этот модуль не загружает.
// Карта 128×64 (равные шаги по долготе и полярному углу, ось вращения — Y, как в модели звезды) хранит:
//   Br, Babs — поле на поверхности, Гс (из зарядов модели: полюса, их изображения, диполь); среднее |Br| по ячейке — по 2×2 точкам;
//   bCarpet — «магнитный ковёр»: подсеточные разноимённые элементы спокойной поверхности (беззнаковое поле, знаковый вклад — ноль);
//   fMag — доля площади магнитных концентраций (поле концентрации Bconc — гипотеза: вертикальные трубки ≈ 3 кГс), fUmbra — тень пятен;
//   Efree — запас свободной энергии (Дж… эрг на ячейку), Epulse — энергия, отданная событием и выходящая импульсом;
//   FH — поток нагрева в верхнюю атмосферу, эрг/(см²·с) — будущий источник для трубок (этап 3).
// Двигатель — перемешивание оснований конвекцией (замыкание Паркера 1988): F = Bconc²·v_h·tgθ/4π·[(fMag − fUmbra) + s_u·fUmbra],
// в тени перемешивание подавлено (s_u). Мощность в резервуар — ε·F·площадь; ε калибруется один раз по целевой мощности нагрева
// (Проксима: L_X ≈ (0,4–1,6)·10²⁷ эрг/с — нагрев с запасом, L_H ≈ 3·10²⁷) и дальше не трогается: меняется магнитная картина —
// меняется нагрев. Выпуск: доля a — сразу, остальное копится и утекает за τ; уничтожение потока (контакты полюсов) открывает запас —
// импульс за τ_pulse (E = ε_ev·B·ΔΦ·ℓ/8π, не больше запаса — второй источник энергии не создаётся). Доля η_H выпуска — в корону (FH),
// остальное — потери нижней атмосферы (прокси хромосферной сети). Бюджет: E_нач + ∫P_drive dt = Σ(Efree + Epulse) + E_H + E_low.
(function (root) {
  'use strict';
  const DEF = { W: 128, H: 64, Bconc: 3000, vh: 3e4, tanTheta: 0.1, su: 0.1, steady: 0.8, tau: 3000, tauPulse: 100, etaH: 0.8, LHtarget: 3e27,
    carpetG: 500, evEps: 0.1, evL: 1e9, PHI0: 5e21, spotBs: 3000, qPore: 0.01, Fref: 2e6 };
  function create(opts) {
    const o = Object.assign({}, DEF, opts), W = o.W, H = o.H, N = W * H, R = o.R, R2 = R * R;
    // ---- сетка: центры, площади (точные — по поясам), направления
    const area = new Float64Array(N), nx = new Float64Array(N), ny = new Float64Array(N), nz = new Float64Array(N);
    for (let j = 0; j < H; j++) { const t0 = Math.PI * j / H, t1 = Math.PI * (j + 1) / H, a = R2 * (2 * Math.PI / W) * (Math.cos(t0) - Math.cos(t1)), th = 0.5 * (t0 + t1);
      for (let i = 0; i < W; i++) { const k = j * W + i, ph = 2 * Math.PI * (i + 0.5) / W; area[k] = a; nx[k] = Math.sin(th) * Math.cos(ph); ny[k] = Math.cos(th); nz[k] = Math.sin(th) * Math.sin(ph); } }
    const cellOf = (x, y, z) => { const th = Math.acos(Math.max(-1, Math.min(1, y))); let ph = Math.atan2(z, x); if (ph < 0) ph += 2 * Math.PI;
      const j = Math.min(H - 1, Math.floor(th / Math.PI * H)), i = Math.min(W - 1, Math.floor(ph / (2 * Math.PI) * W)); return j * W + i; };
    const Br = new Float64Array(N), Babs = new Float64Array(N), absBr = new Float64Array(N), bCarpet = new Float64Array(N), fMag = new Float64Array(N), fUmbra = new Float64Array(N);
    // точки квадратуры: 2×2 в ячейке равной площади (по полярному углу — равные шаги cos θ), направления — заранее
    const thEq = (j, f) => Math.acos(Math.cos(Math.PI * j / H) + f * (Math.cos(Math.PI * (j + 1) / H) - Math.cos(Math.PI * j / H)));
    const qx = new Float64Array(N * 4), qy = new Float64Array(N * 4), qz = new Float64Array(N * 4);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { const m = (j * W + i) * 4 + a * 2 + b, th = thEq(j, 0.25 + 0.5 * a), ph = 2 * Math.PI * (i + 0.25 + 0.5 * b) / W;
      qx[m] = Math.sin(th) * Math.cos(ph); qy[m] = Math.cos(th); qz[m] = Math.sin(th) * Math.sin(ph); }
    const Fraw = new Float64Array(N), Pdrive = new Float64Array(N), Efree = new Float64Array(N), Epulse = new Float64Array(N), FH = new Float64Array(N), Flow = new Float64Array(N), pulseFrac = new Float64Array(N);
    let eps = 0, overflow = 0, version = 0, calibErr = '';
    const B = { Einit: 0, Edrive: 0, EH: 0, Elow: 0, events: 0, Eevents: 0, t: 0 };
    // ---- поле: field(x, y, z, out) → [bx, by, bz] в Гс на поверхности; Br, |Br|, |B| ячейки — средние по 2×2 точкам квадратуры
    function setField(field) {
      const o3 = [0, 0, 0];
      for (let k = 0; k < N; k++) { let sb = 0, sa = 0, sm = 0;
        for (let q = k * 4; q < k * 4 + 4; q++) { field(qx[q], qy[q], qz[q], o3); const br = o3[0] * qx[q] + o3[1] * qy[q] + o3[2] * qz[q]; sb += br; sa += Math.abs(br); sm += Math.hypot(o3[0], o3[1], o3[2]); }
        Br[k] = sb / 4; absBr[k] = sa / 4; Babs[k] = sm / 4; }
      version++; derive();
    }
    // ---- тени пятен: spots = [{x, y, z, q, sF}] — площадь тени ∝ потоку (|q|·Φ₀/B_s), фаза sF; доля покрытия ячейки — по 4×4 точкам
    // равной площади, перекрытия — объединением (маска точек)
    const umbraCand = new Float64Array(N), umbraMask = new Uint16Array(N), umbraSmall = new Float64Array(N);
    const pop16 = v => { v = v - ((v >> 1) & 0x5555); v = (v & 0x3333) + ((v >> 2) & 0x3333); v = (v + (v >> 4)) & 0x0f0f; return (v + (v >> 8)) & 0x1f; };
    function setSpots(spots) {
      umbraMask.fill(0); umbraSmall.fill(0);
      for (const S of spots) { const a = Math.abs(S.q); if (a < o.qPore || !(S.sF > 0)) continue;
        const sl = Math.hypot(S.x, S.y, S.z) || 1, sx = S.x / sl, sy = S.y / sl, sz = S.z / sl;
        const areaU = a * o.PHI0 * S.sF / o.spotBs, rU = Math.sqrt(areaU / Math.PI) / R, cr = Math.cos(rU);   // угловой радиус тени
        const th0 = Math.acos(Math.max(-1, Math.min(1, sy))); let ph0 = Math.atan2(sz, sx); if (ph0 < 0) ph0 += 2 * Math.PI;
        // мелкая тень (радиус меньше трети ячейки) — точная площадь в ячейку центра: 16 точек её не разрешают
        const kc = Math.min(H - 1, Math.floor(th0 / Math.PI * H)) * W + Math.min(W - 1, Math.floor(ph0 / (2 * Math.PI) * W));
        if (rU < Math.PI / H / 3) { umbraSmall[kc] += areaU / area[kc]; continue; }
        const j0 = Math.max(0, Math.floor((th0 - rU) / Math.PI * H)), j1 = Math.min(H - 1, Math.floor((th0 + rU) / Math.PI * H));
        // диск у полюса — все долготы; иначе — по ширине на сфере в его поясе
        const polar = th0 - rU <= 0 || th0 + rU >= Math.PI, st = Math.max(1e-6, Math.sin(Math.max(1e-3, Math.min(th0, Math.PI - th0) - rU))), dph = polar ? Math.PI : Math.min(Math.PI, Math.asin(Math.min(1, Math.sin(rU) / st)) + 2 * Math.PI / W);
        const i0 = polar ? 0 : Math.floor((ph0 - dph) / (2 * Math.PI) * W), i1 = polar ? W - 1 : Math.floor((ph0 + dph) / (2 * Math.PI) * W);
        for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) { const i = ((ii % W) + W) % W, k = j * W + i; let m = 0;
          for (let a2 = 0; a2 < 4; a2++) for (let b2 = 0; b2 < 4; b2++) { const th = thEq(j, (a2 + 0.5) / 4), ph = 2 * Math.PI * (i + (b2 + 0.5) / 4) / W;
            if (Math.sin(th) * Math.cos(ph) * sx + Math.cos(th) * sy + Math.sin(th) * Math.sin(ph) * sz >= cr) m |= 1 << (a2 * 4 + b2); }
          umbraMask[k] |= m; } }
      for (let k = 0; k < N; k++) umbraCand[k] = Math.min(1, pop16(umbraMask[k]) / 16 + umbraSmall[k]);
      derive();
    }
    // ---- заполнение, ковёр, двигатель
    function derive() {
      overflow = 0;
      for (let k = 0; k < N; k++) {
        // тень — диски пятен (площадь из собственного потока |q|·Φ₀·фаза/B_s): изображение и подавление ковра (ковра под тенью нет).
        // Двигатель — только из потока карты: в нём тень не больше поля ячейки (fUd = min(f_res, диск)) — иначе компактная тень добавляла
        // бы поток сверх размазанного полем вокруг того же пятна (ревью Codex: одиночный заряд — ×1,75 потока)
        const fRes = absBr[k] / o.Bconc; fUmbra[k] = umbraCand[k]; const fUd = Math.min(fRes, fUmbra[k]);
        bCarpet[k] = o.carpetG * (1 - fUmbra[k]);
        let f = fRes + bCarpet[k] / o.Bconc; if (f > 1) { overflow++; f = 1; } fMag[k] = f;
        Fraw[k] = o.Bconc * o.Bconc * o.vh * o.tanTheta / (4 * Math.PI) * ((fMag[k] - fUd) + o.su * fUd);
        Pdrive[k] = area[k] * eps * Fraw[k];
      }
    }
    // калибровка ε один раз: ε·η_H·Σ A·F_raw = L_H (цель)
    // ε вне (0, 1] — ошибка параметризации (показывается в сводке; ε ограничивается единицей, не молча); η_H ≤ 0 или цель ≤ 0 — нагрева нет
    function calibrate() { let s = 0; for (let k = 0; k < N; k++) s += area[k] * Fraw[k]; calibErr = '';
      if (!(o.etaH > 0) || !(o.LHtarget > 0) || !(s > 0) || !isFinite(s)) { eps = 0; calibErr = 'нагрев выключен: доля в корону, цель или двигатель не положительны'; }
      else { eps = o.LHtarget / (o.etaH * s); if (eps > 1) { calibErr = `цель недостижима: нужен ε = ${eps.toFixed(2)} > 1`; eps = 1; } }
      derive(); return eps; }
    // ---- события уничтожения потока: [{x, y, z, dq}] — dq в единицах |q| (одна полярность); запрос E = ε_ev·|B|·ΔΦ·ℓ/8π — из запаса
    // соседних ячеек (гауссовы веса, ≈ 2 ячейки), не больше, чем там есть
    const eo = [0, 0, 0];
    function events(list, fieldNow) {
      for (const e of list) { const el = Math.hypot(e.x, e.y, e.z) || 1, ex = e.x / el, ey = e.y / el, ez = e.z / el, dPhi = Math.abs(e.dq) * o.PHI0, c = cellOf(ex, ey, ez);
        // |B| события — текущее поле в точке события (fieldNow), иначе — из карты (может отставать до её пересчёта)
        let Bev = Babs[c]; if (fieldNow) { fieldNow(ex, ey, ez, eo); Bev = Math.hypot(eo[0], eo[1], eo[2]); }
        const req = o.evEps * Bev * dPhi * o.evL / (8 * Math.PI);
        const jc = Math.floor(c / W), ic = c % W, w = [], ks = []; let ws = 0;
        for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const j = jc + dj; if (j < 0 || j >= H) continue; const k = j * W + (((ic + di) % W) + W) % W, ww = Math.exp(-(di * di + dj * dj) / 2); w.push(ww); ks.push(k); ws += ww; }
        for (let m = 0; m < ks.length; m++) { const k = ks[m], take = Math.min(Efree[k], req * w[m] / ws); Efree[k] -= take; Epulse[k] += take; B.Eevents += take; }
        B.events++; }
    }
    // ---- шаг: dt — физические секунды; при постоянном двигателе на шаге — точное решение резервуара
    function step(dt) {
      if (!(dt > 0)) return; const d = -Math.expm1(-dt / o.tau), dp = -Math.expm1(-dt / o.tauPulse);
      for (let k = 0; k < N; k++) {
        const old = Efree[k], P = Pdrive[k], inS = (1 - o.steady) * P;
        Efree[k] = old * (1 - d) + inS * o.tau * d;
        const relBase = o.steady * P * dt + old + inS * dt - Efree[k], relP = Epulse[k] * dp; Epulse[k] -= relP;
        const rel = relBase + relP; B.Edrive += P * dt; B.EH += o.etaH * rel; B.Elow += (1 - o.etaH) * rel;
        FH[k] = o.etaH * rel / (area[k] * dt); Flow[k] = (1 - o.etaH) * rel / (area[k] * dt); pulseFrac[k] = rel > 0 ? relP / rel : 0;
      }
      B.t += dt;
    }
    // ---- сводка и бюджет
    function stats() {
      let A = 0, mBr = 0, mB = 0, mBc = 0, signed = 0, pos = 0, neg = 0, LH = 0, fm = 0, fu = 0, stored = 0;
      for (let k = 0; k < N; k++) { const a = area[k]; A += a; mBr += absBr[k] * a; mB += Babs[k] * a; mBc += (absBr[k] + bCarpet[k]) * a; signed += Br[k] * a; if (Br[k] > 0) pos += Br[k] * a; else neg -= Br[k] * a;
        LH += FH[k] * a; fm += fMag[k] * a; fu += fUmbra[k] * a; stored += Efree[k] + Epulse[k]; }
      const res = B.Einit + B.Edrive - stored - B.EH - B.Elow;
      return { meanAbsBr: mBr / A, meanB: mB / A, meanAbsBrCarpet: mBc / A, signedMx: signed, positiveMx: pos, negativeMx: neg, LH, fMag: fm / A, fUmbra: fu / A, eps, overflow, stored, calibErr,
        budget: { Einit: B.Einit, Edrive: B.Edrive, EH: B.EH, Elow: B.Elow, residual: res, rel: B.Edrive > 0 ? Math.abs(res) / B.Edrive : 0 }, events: B.events, Eevents: B.Eevents, t: B.t, version };
    }
    // ---- изображение: RGBA8 W×H — R: lg(1 + FH/Fref)/2, G: fUmbra, B: fMag, A: доля импульса в выпуске
    const tex = new Uint8Array(N * 4);
    function texture() { for (let k = 0; k < N; k++) { const q = k * 4; tex[q] = Math.round(255 * Math.min(1, Math.log10(1 + FH[k] / o.Fref) / 2)); tex[q + 1] = Math.round(255 * fUmbra[k]);
      tex[q + 2] = Math.round(255 * fMag[k]); tex[q + 3] = Math.round(255 * Math.min(1, pulseFrac[k])); } return tex; }
    return { W, H, N, area, nx, ny, nz, Br, Babs, absBr, bCarpet, fMag, fUmbra, Fraw, Pdrive, Efree, Epulse, FH, Flow, setField, setSpots, calibrate, events, step, stats, texture, cellOf, opts: o,
      get eps() { return eps; }, set eps(v) { eps = v; derive(); } };
  }
  // ---- проверка потока: знаковый поток через сферу (квадратура W×H с 2×2 точками в ячейке) — для изолированного источника он равен
  // q·Φ₀ (Гаусс), для сбалансированного поля — нулю; field(x, y, z, out) — в Гс, R — см
  function fluxAudit(field, R, W, H) {
    W = W || 512; H = H || 256; const o3 = [0, 0, 0]; let s = 0, u = 0;
    for (let j = 0; j < H; j++) { const t0 = Math.PI * j / H, t1 = Math.PI * (j + 1) / H, a = R * R * (2 * Math.PI / W) * (Math.cos(t0) - Math.cos(t1)) / 4;
      for (let i = 0; i < W; i++) for (let p = 0; p < 2; p++) for (let q = 0; q < 2; q++) { const c0 = Math.cos(t0), c1 = Math.cos(t1), th = Math.acos(c0 + (0.25 + 0.5 * p) * (c1 - c0)), ph = 2 * Math.PI * (i + 0.25 + 0.5 * q) / W;
        const x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph); field(x, y, z, o3); const br = o3[0] * x + o3[1] * y + o3[2] * z; s += br * a; u += Math.abs(br) * a; } }
    return { signedMx: s, unsignedMx: u };
  }
  // ---- фиксированные физические шаги (этап 0): поверхность и карта идут шагами H физических секунд (час — шаг модели поверхности),
  // остаток копится — результат не зависит от частоты кадров; события уничтожения потока датированы концом шага (разрешение — шаг);
  // поле карты пересчитывается раз в fieldEvery физических секунд и в момент заморозки (снимок совпадает с полюсами); за кадр — не
  // больше maxSteps шагов, остальное — отставание (видно в сводке). o: { SF — модель поверхности (stepHours, takeEvents), SS — карта,
  // onField() — пересчитать поле и тени карты по текущим полюсам, onSpots() — только тени (каждый шаг), fieldNow() — функция текущего
  // поля для событий }
  function stepper(o) {
    const Hs = o.H || 3600, fieldEvery = o.fieldEvery || 6 * 3600, maxSteps = o.maxSteps || 24;
    let acc = 0, t = 0, tField = 0, frozenPrev = false, steps = 0;
    return {
      advance(dtPhys, frozen) {
        if (frozen && !frozenPrev) { o.onField(); tField = t; }
        frozenPrev = !!frozen;
        if (dtPhys > 0) acc += dtPhys; let n = 0;
        while (acc >= Hs && n < maxSteps) {
          if (o.beforeStep) o.beforeStep();   // снимок прежнего состояния — показ между шагами
          if (!frozen && o.SF) o.SF.stepHours(Hs / 3600);
          o.SS.step(Hs);
          if (!frozen && o.SF) { o.SS.events(o.SF.takeEvents(), o.fieldNow ? o.fieldNow() : null);
            if (t + Hs - tField >= fieldEvery) { o.onField(); tField = t + Hs; } else if (o.onSpots) o.onSpots(); }
          acc -= Hs; t += Hs; n++; steps++;
        }
        return n;
      },
      get t() { return t; }, get backlog() { return acc; }, get steps() { return steps; } };
  }
  const api = { create, fluxAudit, stepper, DEF };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.M31SurfaceState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
