// М31 · стенд звезды: газодинамика вдоль одной магнитной трубки — этап 2 плана (DOC «План работ — газодинамика короны и поверхность
// звезды»). Поле задано и жёсткое (малое β): газ движется только вдоль трубки, по координате s; сечение A(s), тяжесть вдоль трубки.
// Уравнения сохранения (на единицу длины трубки):
//   ∂(Aρ)/∂t + ∂(Aρu)/∂s = 0
//   ∂(Aρu)/∂t + ∂[A(ρu² + p)]/∂s = p·∂A/∂s − Aρ·∂Φ/∂s
//   ∂(A(E + ρΦ))/∂t + ∂[Au(E + p + ρΦ)]/∂s = A(Q − R) + ∂(Aκ∂T/∂s)/∂s,   E = p/(γ−1) + ρu²/2
// Схема: конечные объёмы, поток HLLC (неподвижный контакт — переходный слой — не размывается), сохранение равновесия под тяжестью
// (well-balanced: состояние ячейки продолжается к граням по своему изотермическому равновесию; источник импульса — разность давлений
// этого продолжения на гранях), RK2; теплопроводность Спитцера κ0·T^5/2 — неявно (трёхдиагональная система), с насыщением потока;
// излучение оптически тонкое n_e·n_H·Λ(T) (Klimchuk, Patsourakos & Cargill 2008) — подшагами; TRAC (Johnston & Bradshaw 2019):
// ниже T_c проводимость κ0·T_c^5/2, потери и нагрев ×(T/T_c)^5/2. Резервуары — хромосфера в самой трубке (T_ch ≈ 2·10⁴ K, потери
// выключены ниже ≈ 1,5·T_ch), концы — стенки: масса и энергия трубки замкнуты, испарение и сток — из уравнений, без правил.
// Состав: H и He (He/H = 0,1 по числу), полностью ионизованы: n_e = 1,2·n_H, ρ = 1,4·m_p·n_H, p = 2,3·n_H·kT, μ ≈ 0,61.
(function (root) {
  'use strict';
  const kB = 1.380649e-16, mp = 1.67262e-24, me = 9.10938e-28, G = 6.674e-8, MSUN = 1.989e33, RSUN = 6.957e10, KAPPA0 = 1e-6;
  const XHE = 0.1, NE_NH = 1 + 2 * XHE, RHO_NH = (1 + 4 * XHE) * mp, NT_NH = 2 + 3 * XHE, MU = (1 + 4 * XHE) / (2 + 3 * XHE);
  // Λ(T), эрг·см³/с — кусочно-степенная (KPC08, табл. 1): [верхний lg T, χ, α]
  const LAM = [[4.97, 1.09e-31, 2], [5.67, 8.87e-17, -1], [6.18, 1.90e-22, 0], [6.55, 3.53e-13, -1.5], [6.90, 3.46e-25, 1 / 3], [7.63, 5.49e-16, -1], [99, 1.96e-27, 0.5]];
  function lambda(T) { const lt = Math.log10(T); for (const [hi, c, a] of LAM) if (lt <= hi) return c * Math.pow(T, a); return 0; }
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // трубка. o: star {R, M} (см, г); geometry 'loop' (вертикальные ноги-хромосферы lch + полуокружность длиной 2·Lc) или 'flat' (прямая
  // длины S, без тяжести); сетка: ds (ровная) или dsMin/dsMax/fine (мелко у оснований до lch + fine, дальше растёт); gamma; переключатели
  // hydro, conduction, radiation, trac, gravity; area(s) — сечение; heat(s, h, t) — нагрев, эрг/см³/с; Tch — температура хромосферы
  function tube(o) {
    const o0 = o || {};
    o = Object.assign({ geometry: 'loop', star: { R: 0.154 * RSUN, M: 0.122 * MSUN }, Lc: 5e8, lch: 1.5e8, dsMin: 5e6, dsMax: 3e7, fine: 3e8, grow: 0.1,
      gamma: 5 / 3, order: 2, ltrac: true, ltracRc: 1.5, ltracP: 3, fcTau: 0, dtMax: 0, heatRes: 0.5, hydro: true, conduction: true, radiation: true, trac: true, gravity: true, saturation: true, Tch: 2e4, cfl: 0.4, tcTau: 10,
      area: null, heat: null }, o);
    // уширение переходных слоёв: по умолчанию LTRAC (сходится к разрешённому расчёту — DOC, 15.10.2026); trac: true без ltrac: false —
    // глобальный TRAC (для сравнения); оба false — без уширения (нужна сетка ≤ 5 км у переходных слоёв)
    if (o0.trac === true && o0.ltrac === undefined) o.ltrac = false;
    if (o.ltrac) o.trac = false;
    // geometry 'path' — настоящая силовая линия: path = { s: [...], h: [...] } — высота над поверхностью вдоль линии от основания A (s = 0)
    // до основания B (s = L), см; ноги-хромосферы — вертикально; сечение — area(s) от вызывающего (A ∝ 1/B вдоль линии)
    if (o.geometry === 'path') o.Lc = o.path.s[o.path.s.length - 1] / 2;
    const g1 = o.gamma - 1, S = o.geometry === 'flat' ? o.S : 2 * o.lch + 2 * o.Lc;
    // ---- сетка: шаги от основания к середине, зеркально; масштаб — чтобы середина попала на грань
    const steps = [];
    if (o.ds) { const n = Math.max(2, Math.round(S / o.ds)); for (let k = 0; k < n; k++) steps.push(S / n); }
    // мелко — от fineFrom (по умолчанию от основания) до lch + fine; ниже fineFrom (глубокая хромосфера) и выше — шаг растёт на grow от
    // расстояния до мелкой зоны, не больше dsDeep внизу и dsMax в короне
    else { let d = 0; const half = S / 2, dFine = o.lch + o.fine, f0 = o.fineFrom || 0, dDeep = o.dsDeep || o.dsMax;
      while (d < half) { const ds = d < f0 ? Math.min(dDeep, o.dsMin + (f0 - d) * o.grow) : Math.min(o.dsMax, o.dsMin + Math.max(0, d - dFine) * o.grow); steps.push(ds); d += ds; }
      const k = half / d; for (let i = 0; i < steps.length; i++) steps[i] *= k; for (let i = steps.length - 1; i >= 0; i--) steps.push(steps[i]); }
    const N = steps.length, sf = new Float64Array(N + 1), sc = new Float64Array(N), dsC = new Float64Array(N);
    for (let i = 0; i < N; i++) { sf[i + 1] = sf[i] + steps[i]; dsC[i] = steps[i]; sc[i] = sf[i] + 0.5 * steps[i]; }
    // ---- геометрия: высота над поверхностью, потенциал тяжести, сечение
    const Rl = 2 * o.Lc / Math.PI;
    const pathH = x => { const ps = o.path.s, ph = o.path.h; let a = 0, b = ps.length - 1; if (x <= 0) return ph[0]; if (x >= ps[b]) return ph[b];
      while (b - a > 1) { const m = (a + b) >> 1; if (ps[m] <= x) a = m; else b = m; } return ph[a] + (ph[b] - ph[a]) * (x - ps[a]) / (ps[b] - ps[a]); };
    // 'path': path.h — абсолютная высота над фотосферой; ноги-резервуары (глубина lch) — вертикально вниз от настоящих высот оснований hA, hB
    // (разбор Codex: прежде к высоте линии прибавлялась lch — петля поднималась на толщину хромосферы, у основания — скачок)
    const hA = o.geometry === 'path' ? o.path.h[0] : 0, hB = o.geometry === 'path' ? o.path.h[o.path.h.length - 1] : 0;
    const hOf = s => o.geometry === 'flat' ? 0 : o.geometry === 'path' ? (s <= o.lch ? hA - (o.lch - s) : s >= S - o.lch ? hB - (s - (S - o.lch)) : pathH(s - o.lch))
      : s <= o.lch ? s : s >= S - o.lch ? S - s : o.lch + Rl * Math.sin(Math.PI * (s - o.lch) / (2 * o.Lc));
    const phiOf = s => o.gravity && o.geometry !== 'flat' ? -G * o.star.M / (o.star.R + hOf(s)) : 0;
    const area = o.area || (() => 1);
    const hc = new Float64Array(N), Pc = new Float64Array(N), Pf = new Float64Array(N + 1), Ac = new Float64Array(N), Af = new Float64Array(N + 1);
    for (let i = 0; i < N; i++) { hc[i] = hOf(sc[i]); Pc[i] = phiOf(sc[i]); Ac[i] = area(sc[i]); }
    for (let f = 0; f <= N; f++) { Pf[f] = phiOf(sf[f]); Af[f] = area(sf[f]); }
    // ---- состояние: ρ, ρu, E (внутренняя + кинетическая, на единицу объёма)
    const rho = new Float64Array(N), mom = new Float64Array(N), En = new Float64Array(N);
    const cv = r => r * NT_NH / RHO_NH * kB / g1;   // теплоёмкость единицы объёма, эрг/(см³·K)
    const T = new Float64Array(N);
    const temp = () => { for (let i = 0; i < N; i++) { const ei = En[i] - 0.5 * mom[i] * mom[i] / rho[i]; T[i] = ei / cv(rho[i]); } return T; };
    // начальное равновесие: T(s, h) задано, давление — по дискретному равновесию (давления продолжений совпадают на гранях); масштаб —
    // давление pRef в ячейке у sRef
    function hydrostatic(Tfun, pRef, sRef) {
      const c2 = new Float64Array(N), p = new Float64Array(N); for (let i = 0; i < N; i++) c2[i] = kB * Tfun(sc[i], hc[i]) / (MU * mp);
      p[0] = 1; for (let i = 0; i < N - 1; i++) p[i + 1] = p[i] * Math.exp(-(Pf[i + 1] - Pc[i]) / c2[i] + (Pf[i + 1] - Pc[i + 1]) / c2[i + 1]);
      let j = 0; for (let i = 0; i < N; i++) if (Math.abs(sc[i] - sRef) < Math.abs(sc[j] - sRef)) j = i; const k = pRef / p[j];
      for (let i = 0; i < N; i++) { const pi = p[i] * k; rho[i] = pi / c2[i]; mom[i] = 0; En[i] = pi / g1; }
    }
    // произвольное начало (проверки): init(s) → {rho, u, p}
    function setState(init) { for (let i = 0; i < N; i++) { const w = init(sc[i], hc[i]); rho[i] = w.rho; mom[i] = w.rho * w.u; En[i] = w.p / g1 + 0.5 * w.rho * w.u * w.u; } }

    // ---- газодинамика
    const u = new Float64Array(N), p = new Float64Array(N), c2i = new Float64Array(N), du = new Float64Array(N);
    const FR = new Float64Array(N + 1), FM = new Float64Array(N + 1), FE = new Float64Array(N + 1), pL = new Float64Array(N + 1), pR = new Float64Array(N + 1);
    // продолжения состояния ячейки по её изотермическому равновесию к левой (−) и правой (+) граням; скачки ln p, ln ρ на гранях; наклоны
    const pEm = new Float64Array(N), pEp = new Float64Array(N);
    const Jp = new Float64Array(N + 1), sp = new Float64Array(N), sT = new Float64Array(N);
    const fx = [0, 0, 0];
    // HLLC (Toro): поток через грань между состояниями L и R
    function hllc(rL, uL, PL, rR, uR, PR) {
      const cL = Math.sqrt(o.gamma * PL / rL), cR = Math.sqrt(o.gamma * PR / rR), SL = Math.min(uL - cL, uR - cR), SR = Math.max(uL + cL, uR + cR);
      const EL = PL / g1 + 0.5 * rL * uL * uL, ER = PR / g1 + 0.5 * rR * uR * uR;
      if (SL >= 0) { fx[0] = rL * uL; fx[1] = rL * uL * uL + PL; fx[2] = uL * (EL + PL); return; }
      if (SR <= 0) { fx[0] = rR * uR; fx[1] = rR * uR * uR + PR; fx[2] = uR * (ER + PR); return; }
      const Ss = (PR - PL + rL * uL * (SL - uL) - rR * uR * (SR - uR)) / (rL * (SL - uL) - rR * (SR - uR));
      if (Ss >= 0) { const k = rL * (SL - uL) / (SL - Ss);
        fx[0] = rL * uL + SL * (k - rL); fx[1] = rL * uL * uL + PL + SL * (k * Ss - rL * uL); fx[2] = uL * (EL + PL) + SL * (k * (EL / rL + (Ss - uL) * (Ss + PL / (rL * (SL - uL)))) - EL); }
      else { const k = rR * (SR - uR) / (SR - Ss);
        fx[0] = rR * uR + SR * (k - rR); fx[1] = rR * uR * uR + PR + SR * (k * Ss - rR * uR); fx[2] = uR * (ER + PR) + SR * (k * (ER / rR + (Ss - uR) * (Ss + PR / (rR * (SR - uR)))) - ER); }
    }
    const minmod = (a, b) => a * b <= 0 ? 0 : Math.abs(a) < Math.abs(b) ? a : b;
    // правая часть: dρ/dt, d(ρu)/dt, dE/dt. Второй порядок по пространству с сохранением равновесия: ln p на гранях — равновесное
    // продолжение ячейки плюс наклон отклонения от него; наклон — по скачкам продолжений соседей на гранях (minmod); температура (c² = p/ρ)
    // — своим наклоном (minmod центральных разностей ln c²: новых экстремумов T нет), ρ = p/c². В равновесии, где давления продолжений
    // на гранях совпадают (изотермическом и с переходным слоем), скачков давления нет и u = 0: на гранях p_L = p_R, плотности разные —
    // HLLC держит неподвижный контакт точно, потоки массы и энергии нулевые, поток импульса сокращается с источником (разностью давлений
    // самих продолжений — равновесной частью); отклонение входит через потоки. o.order = 1 — первый порядок
    function rhs(r, m, E, dr, dm, dE) {
      for (let i = 0; i < N; i++) { u[i] = m[i] / r[i]; p[i] = Math.max(1e-30, g1 * (E[i] - 0.5 * m[i] * u[i])); c2i[i] = p[i] / r[i];
        pEm[i] = p[i] * Math.exp(-(Pf[i] - Pc[i]) / c2i[i]); pEp[i] = p[i] * Math.exp(-(Pf[i + 1] - Pc[i]) / c2i[i]); }
      for (let i = 0; i < N; i++) du[i] = i === 0 || i === N - 1 ? 0 : minmod((u[i] - u[i - 1]) / (sc[i] - sc[i - 1]), (u[i + 1] - u[i]) / (sc[i + 1] - sc[i]));
      const o2 = o.order !== 1;
      Jp[0] = Jp[N] = 0;
      for (let f = 1; f < N; f++) Jp[f] = Math.log(pEm[f] / pEp[f - 1]) / (sc[f] - sc[f - 1]);
      for (let i = 0; i < N; i++) { sp[i] = o2 ? minmod(Jp[i], Jp[i + 1]) : 0;
        sT[i] = o2 && i > 0 && i < N - 1 ? minmod(Math.log(c2i[i] / c2i[i - 1]) / (sc[i] - sc[i - 1]), Math.log(c2i[i + 1] / c2i[i]) / (sc[i + 1] - sc[i])) : 0; }
      for (let f = 0; f <= N; f++) {
        let rl, ul, ql, rr, ur, qr;
        if (f > 0) { const i = f - 1, d = sf[f] - sc[i]; ql = pEp[i] * Math.exp(sp[i] * d); rl = ql / (c2i[i] * Math.exp(sT[i] * d)); ul = u[i] + du[i] * d; }
        if (f < N) { const i = f, d = sf[f] - sc[i]; qr = pEm[i] * Math.exp(sp[i] * d); rr = qr / (c2i[i] * Math.exp(sT[i] * d)); ur = u[i] + du[i] * d; }
        if (f === 0) { rl = rr; ql = qr; ul = -ur; } else if (f === N) { rr = rl; qr = ql; ur = -ul; }   // стенки: зеркало
        hllc(rl, ul, ql, rr, ur, qr);
        FR[f] = Af[f] * fx[0]; FM[f] = Af[f] * fx[1]; FE[f] = Af[f] * (fx[2] + Pf[f] * fx[0]);   // энергия — с потенциалом
      }
      for (let i = 0; i < N; i++) { const inv = 1 / (Ac[i] * dsC[i]);
        // p·∂A/∂s − ρ∂Φ/∂s: разность давлений равновесного продолжения на гранях + отклонение (среднее по граням) на изменение сечения
        const dev = 0.5 * (pEp[i] * (Math.exp(sp[i] * (sf[i + 1] - sc[i])) - 1) + pEm[i] * (Math.exp(sp[i] * (sf[i] - sc[i])) - 1));
        dr[i] = -(FR[i + 1] - FR[i]) * inv;
        dm[i] = -(FM[i + 1] - FM[i]) * inv + (Af[i + 1] * pEp[i] - Af[i] * pEm[i] + dev * (Af[i + 1] - Af[i])) * inv;
        dE[i] = -(FE[i + 1] - FE[i]) * inv - Pc[i] * dr[i]; }
    }
    const k1 = [new Float64Array(N), new Float64Array(N), new Float64Array(N)], k2 = [new Float64Array(N), new Float64Array(N), new Float64Array(N)];
    const r1 = new Float64Array(N), m1 = new Float64Array(N), E1 = new Float64Array(N);
    // RK2 (Хойн); каждая стадия — допустима (ρ > 0, внутренняя энергия > 0), иначе шаг заново первым порядком (он сохраняет положительность
    // при условии Куранта), а если и так нельзя — двумя половинами
    const sv = [new Float64Array(N), new Float64Array(N), new Float64Array(N)], hyd = { fallback: 0, halves: 0 };
    const okState = (r, m, E) => { for (let i = 0; i < N; i++) if (!(r[i] > 0) || !(E[i] - 0.5 * m[i] * m[i] / r[i] > 0)) return false; return true; };
    function rk2(dt) {
      rhs(rho, mom, En, k1[0], k1[1], k1[2]);
      for (let i = 0; i < N; i++) { r1[i] = rho[i] + dt * k1[0][i]; m1[i] = mom[i] + dt * k1[1][i]; E1[i] = En[i] + dt * k1[2][i]; }
      if (!okState(r1, m1, E1)) return false;
      rhs(r1, m1, E1, k2[0], k2[1], k2[2]);
      for (let i = 0; i < N; i++) { rho[i] += 0.5 * dt * (k1[0][i] + k2[0][i]); mom[i] += 0.5 * dt * (k1[1][i] + k2[1][i]); En[i] += 0.5 * dt * (k1[2][i] + k2[2][i]); }
      return okState(rho, mom, En);
    }
    function hydroStep(dt, depth) {
      depth = depth || 0; sv[0].set(rho); sv[1].set(mom); sv[2].set(En);
      if (rk2(dt)) return;
      rho.set(sv[0]); mom.set(sv[1]); En.set(sv[2]); const ord = o.order; o.order = 1; const ok = rk2(dt); o.order = ord; if (ok) { hyd.fallback++; return; }
      rho.set(sv[0]); mom.set(sv[1]); En.set(sv[2]); if (depth > 10) throw new Error('hydro1d: шаг газодинамики недопустим и при делении');
      hyd.halves++; hydroStep(dt / 2, depth + 1); hydroStep(dt / 2, depth + 1);
    }
    function cflDt() { let dt = Infinity; for (let i = 0; i < N; i++) { const ui = mom[i] / rho[i], pi = Math.max(1e-30, g1 * (En[i] - 0.5 * mom[i] * ui)), c = Math.sqrt(o.gamma * pi / rho[i]);
      dt = Math.min(dt, dsC[i] / (Math.abs(ui) + c)); } return o.cfl * dt; }

    // ---- TRAC (Johnston & Bradshaw 2019): ячейка не разрешает переходный слой, если Δs·|∂T/∂s|/T > ½; T_c — наибольшая T таких ячеек,
    // отдельно для каждой ноги (левая и правая половины), в пределах [T_ch, 0,2·T_max]; растёт сразу, спадает за tcTau; пределы — после
    let TcL = o.Tch, TcR = o.Tch;
    const tcOf = i => i < N / 2 ? TcL : TcR;
    function tracUpdate(dt) {
      if (!o.trac) { TcL = TcR = 0; return; } temp(); let tmax = 0; for (let i = 0; i < N; i++) tmax = Math.max(tmax, T[i]);
      let tl = o.Tch, tr = o.Tch;
      for (let i = 1; i < N - 1; i++) { const gr = Math.abs(T[i + 1] - T[i - 1]) / (sc[i + 1] - sc[i - 1]); if (dsC[i] * gr / T[i] > 0.5) { if (i < N / 2) tl = Math.max(tl, T[i]); else tr = Math.max(tr, T[i]); } }
      const relax = (old, tgt) => tgt > old ? tgt : old + (tgt - old) * Math.min(1, dt / o.tcTau), lim = x => Math.max(o.Tch, Math.min(0.2 * tmax, x));
      TcL = lim(relax(TcL, tl)); TcR = lim(relax(TcR, tr));
    }
    // ---- LTRAC (Iijima & Imada 2021): местное уширение неразрешённых переходных слоёв — у оснований и на краях сгустков в короне; без
    // глобальной T_c. r = exp(Δs·|∂T/∂s|/T), f_c = сглаживание [¼, ½, ¼] от max(1, r/r_c)^p (r_c = 1,5; p = 3 — у авторов 2–3 лучше
    // всего для меры эмиссии; p = 4 в петле RTV даёт колебания f_c 28…143 и течения 2 км/с, их отмечали и авторы); теплопроводность ×f_c,
    // излучение ÷f_c (суммарные потери и приток тепла через слой не меняются), нагрев — без изменений; излучение для синтеза — тоже ÷f_c
    const fcR = new Float64Array(N), fc = new Float64Array(N).fill(1);
    function ltracUpdate(dtL) {
      temp(); for (let i = 0; i < N; i++) { const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1), g = Math.abs(T[b] - T[a]) / (sc[b] - sc[a]);
        fcR[i] = Math.pow(Math.max(1, Math.exp(dsC[i] * g / T[i]) / o.ltracRc), o.ltracP); }
      // fcTau > 0 — рост сразу, спад за fcTau (как ограничитель спада у TRAC, Johnston et al. 2020) — гасит колебания f_c
      for (let i = 0; i < N; i++) { const tg = 0.25 * fcR[Math.max(0, i - 1)] + 0.5 * fcR[i] + 0.25 * fcR[Math.min(N - 1, i + 1)];
        fc[i] = o.fcTau > 0 && tg < fc[i] ? fc[i] + (tg - fc[i]) * Math.min(1, dtL / o.fcTau) : tg; }
    }
    // ---- теплопроводность: неявно по T (обратный Эйлер); нелинейность κ(T) и насыщения — итерациями Пикара до сходимости
    // (|ΔT|/T < 10⁻⁵); не сошлось за 40 или T где-то изменилась больше чем на 20 % (неявность устойчива, но не точна) — шаг пополам. Поток насыщается (Cowie & McKee 1977: q_sat = 0,4·(2kT/πm_e)^½·n_e·kT);
    // концы — без потока
    const Kf = new Float64Array(N + 1), aa = new Float64Array(N), bb = new Float64Array(N), cc = new Float64Array(N), dd = new Float64Array(N), Tn = new Float64Array(N), Tp = new Float64Array(N), T0 = new Float64Array(N), Ci = new Float64Array(N);
    function condSolve(dt) {
      for (let i = 0; i < N; i++) Ci[i] = cv(rho[i]) * Ac[i] * dsC[i] / dt;
      Tn.set(T0);
      for (let it = 0; it < 40; it++) {
        Tp.set(Tn); Kf[0] = 0; Kf[N] = 0;
        for (let f = 1; f < N; f++) { const Tf = 0.5 * (Tp[f - 1] + Tp[f]), h = sc[f] - sc[f - 1]; let k = KAPPA0 * Math.pow(Math.max(Tf, o.trac ? (f < N / 2 ? TcL : TcR) : 0), 2.5);
          if (o.saturation) { const q = k * Math.abs(Tp[f] - Tp[f - 1]) / h, ne = NE_NH * 0.5 * (rho[f - 1] + rho[f]) / RHO_NH, qs = 0.4 * Math.sqrt(2 * kB * Tf / (Math.PI * me)) * ne * kB * Tf; k /= 1 + q / qs; }
          if (o.ltrac) k *= 0.5 * (fc[f - 1] + fc[f]);
          Kf[f] = Af[f] * k / h; }
        for (let i = 0; i < N; i++) { aa[i] = -Kf[i]; cc[i] = -Kf[i + 1]; bb[i] = Ci[i] + Kf[i] + Kf[i + 1]; dd[i] = Ci[i] * T0[i]; }
        for (let i = 1; i < N; i++) { const w = aa[i] / bb[i - 1]; bb[i] -= w * cc[i - 1]; dd[i] -= w * dd[i - 1]; }
        Tn[N - 1] = dd[N - 1] / bb[N - 1]; for (let i = N - 2; i >= 0; i--) Tn[i] = (dd[i] - cc[i] * Tn[i + 1]) / bb[i];
        let d = 0; for (let i = 0; i < N; i++) d = Math.max(d, Math.abs(Tn[i] - Tp[i]) / Tp[i]);
        if (d < 1e-5) return true;
      }
      return false;
    }
    const cond = { calls: 0, splits: 0 };
    function conduct(dt, depth) {
      depth = depth || 0; if (!depth) cond.calls++;
      temp(); T0.set(T);
      let okc = condSolve(dt); if (okc) for (let i = 0; i < N; i++) if (Math.abs(Tn[i] - T0[i]) > 0.2 * Math.max(Tn[i], T0[i])) { okc = false; break; }
      if (okc || depth >= 14) { for (let i = 0; i < N; i++) En[i] += cv(rho[i]) * (Tn[i] - T0[i]); return; }
      cond.splits++; conduct(dt / 2, depth + 1); conduct(dt / 2, depth + 1);
    }
    // ---- излучение и нагрев: в каждой ячейке подшагами ≤ 2 % тепла ячейки и не длиннее heatRes (0,5 с); излучение — неявной трапецией
    // (второй порядок, устойчиво у равновесия), нагрев — по середине подшага (ступенчатый импульс, выровненный по heatEvents — моментам
    // включения и выключения нагрева, — учитывается точно); время шага расходуется всегда целиком; ниже T_floor — пол (в учёт)
    const B = { heat: 0, rad: 0, floor: 0 };
    let t = 0;
    const nextEvent = tt => { if (!o.heatEvents) return Infinity; for (const e of o.heatEvents) if (e > tt + 1e-12) return e; return Infinity; };
    function sources(dt) {
      const Tfl = 0.9 * o.Tch;
      for (let i = 0; i < N; i++) {
        const c = cv(rho[i]), nH = rho[i] / RHO_NH, ne = NE_NH * nH, ek = 0.5 * mom[i] * mom[i] / rho[i], V = Ac[i] * dsC[i], tc = o.trac ? tcOf(i) : 0;
        const fl = o.ltrac ? 1 / fc[i] : 1, fT = T => tc && T < tc ? Math.pow(T / tc, 2.5) : 1, RT = T => o.radiation ? ne * nH * lambda(T) * fT(T) * fl * smooth(o.Tch, 1.5 * o.Tch, T) : 0;
        let Ti = (En[i] - ek) / c, left = dt, n = 0, fac = 1;
        while (left > 0) {
          const tt = t + dt - left, f0 = fT(Ti), R0 = RT(Ti);
          let sub = Math.min(left, o.heatRes, nextEvent(tt) - tt);
          const Qa = o.heat ? o.heat(sc[i], hc[i], tt + 0.5 * sub) : 0, r0 = Qa * f0 - R0;
          sub = Math.min(sub, r0 === 0 ? Infinity : 0.02 * c * Ti / Math.abs(r0) * fac); if (++n > 3000) sub = left;
          const Q = o.heat ? o.heat(sc[i], hc[i], tt + 0.5 * sub) : 0, q0 = Q * f0 - R0;
          // c·(T' − T) = ½·sub·(r(T) + r(T')), r = Q·f(T) − R(T) — Ньютон с численной производной; не сошлось — подшаг вдвое меньше
          const rr = T => Q * fT(T) - RT(T);
          let T1 = Ti + q0 * sub / c, ok = false;
          // быстрый путь: источник за подшаг меняет T меньше чем на 10⁻⁶ — трапеция не нужна (явный шаг точен до 10⁻¹²)
          if (Math.abs(q0) * sub < 1e-6 * c * Ti) ok = true;
          // Ньютон: производная — односторонней разностью (две оценки r на итерацию)
          else for (let it = 0; it < 12; it++) { const r1 = rr(T1), g = c * (T1 - Ti) - 0.5 * sub * (q0 + r1), e = 1e-4 * T1, gp = c - 0.5 * sub * (rr(T1 + e) - r1) / e;
            const T2 = Math.max(0.5 * T1, Math.min(2 * T1, T1 - g / gp)), conv = Math.abs(T2 - T1) < 1e-8 * T1; T1 = T2; if (conv) { ok = true; break; } }
          if (!ok && n <= 3000 && sub > 1e-9 * dt) { fac *= 0.5; continue; } fac = Math.min(1, fac * 2);
          const f1 = fT(T1), R1 = RT(T1);
          B.heat += Q * 0.5 * (f0 + f1) * sub * V; B.rad += 0.5 * (R0 + R1) * sub * V;
          Ti = Ti + 0.5 * sub * (q0 + Q * f1 - R1) / c; left -= sub;
          if (Ti < Tfl) { B.floor += (Tfl - Ti) * c * V; Ti = Tfl; }
        }
        En[i] = ek + c * Ti;
      }
    }
    // ---- шаг: газодинамика (по условию Куранта), TRAC, теплопроводность, источники; шаг не перешагивает момент из heatEvents
    function step(dtMax) {
      const dt = Math.min(dtMax || Infinity, o.dtMax || Infinity, o.hydro ? cflDt() : Infinity, nextEvent(t) - t);
      if (o.hydro) hydroStep(dt);
      if (o.trac) tracUpdate(dt);
      if (o.ltrac) ltracUpdate(dt);
      if (o.conduction) conduct(dt);
      if (o.radiation || o.heat) sources(dt);
      for (let i = 0; i < N; i++) if (!(rho[i] > 0) || !isFinite(En[i])) throw new Error('hydro1d: плохое состояние в ячейке ' + i + ' при t = ' + t);
      t += dt; return dt;
    }
    function advance(tEnd, each) { let n = 0; while (t < tEnd - 1e-12) { step(tEnd - t); n++; if (each) each(n); } return n; }
    // сводка: масса, полная энергия (внутренняя + кинетическая + в поле тяжести), учёт нагрева, излучения и пола
    function totals() { let M = 0, E = 0; for (let i = 0; i < N; i++) { const V = Ac[i] * dsC[i]; M += rho[i] * V; E += (En[i] + rho[i] * Pc[i]) * V; } return { mass: M, energy: E, heat: B.heat, rad: B.rad, floor: B.floor, t, Tc: Math.max(TcL, TcR), TcL, TcR, condSplits: cond.splits, hydroFallback: hyd.fallback, hydroHalves: hyd.halves, fcMax: o.ltrac ? Math.max(...fc) : 1 }; }
    function profile() { temp(); const out = { s: sc, h: hc, ds: dsC, rho: Float64Array.from(rho), u: new Float64Array(N), T: Float64Array.from(T), p: new Float64Array(N), ne: new Float64Array(N) };
      for (let i = 0; i < N; i++) { out.u[i] = mom[i] / rho[i]; out.p[i] = g1 * (En[i] - 0.5 * mom[i] * out.u[i]); out.ne[i] = NE_NH * rho[i] / RHO_NH; } return out; }
    return { N, S, sc, sf, hc, Pc, fc, hydrostatic, setState, step, advance, totals, profile, temp, get t() { return t; }, set t(v) { t = v; }, get Tc() { return Math.max(TcL, TcR); }, opts: o,
      raw: { rho, mom, En } };
  }
  const api = { tube, lambda, kB, mp, me, G, MSUN, RSUN, KAPPA0, MU, NE_NH, RHO_NH, NT_NH };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.M31Hydro1D = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
