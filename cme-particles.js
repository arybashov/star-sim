// М31 · стенд звезды: выброс массы частицами — нити волокна и брызги (автор: «давай начнем выброс партиклами», «сначала фотки», затем —
// «давай как в ультрафиолете — нити и брызги»; ориентиры — снимки SDO/AIA 31.08.2012 и 07.06.2011 на странице «Ориентиры»; замысел — разбор
// Codex 16.10.2026). Только стенд: игра этот модуль не загружает. Здесь — движение (процессор, без three.js); вид — в corona.js.
//
// Единицы — R★ и секунды показа (как путь жгута ropePath в модели звезды): тяготение у поверхности g0 = 1/(2·tDyn²), 1 км/с = kms.
// Волокно — жгут над линией раздела полярностей: ось — дуга, ноги закреплены у концов линии раздела (±L вдоль неё), вершина поднимается
// на h(t) — путь вершины из модели звезды (H, линейно между отсчётами: скорость — из той же интерполяции; после h > 6 путь в модели
// стоит — у уходящего продолжается последней скоростью). Нити — неодинаковыми пучками вокруг оси (закрутка ≈ 1,2 оборота по длине),
// вещество вдоль нити — сгустками с пропусками; сечение растёт с подъёмом (у ног — нет). Отрыв — участками нити (согласованно, не
// каждой частицей): часть стекает по своей нити к ближней ноге (вдоль поля, под тяжестью), часть летит баллистикой в поле g0/r² с
// общим для участка толчком 20–60 км/с (и дроблением ±5 км/с); упавшее на поверхность гаснет коротким свечением удара (07.06.2011).
// Запертое извержение (жгут остановился): освобождение — по расписанию стока модели (tStall, tFall), почти всё стекает по ногам.
// Каждая частица — сгусток: «масса» поглощения M (единицы τ·площадь, Σ = τ₀·площадь волокна — средняя τ волокна τ₀), размер σ
// (растёт с сечением — пик τ ∝ σ⁻²), свечение E: тёплая оболочка холодной нити (∝ M·σ/σ₀) и нагретый газ (нагрев по времени —
// см. ниже: связные области греются после срыва до 0,6–2,5 МК, перестают поглощать и светят в 171, затем остывают).
// Детерминированно: состояние — функция времени цикла (шаг 0,01 с, контрольные точки каждые 2 с: прокрутка назад — от ближайшей).
(function (root) {
  'use strict';
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const v3 = p => Array.isArray(p) ? p.slice(0, 3) : [p.x, p.y, p.z];
  const DT = 0.01, CK = 2, SEG = 0.15;   // шаг, с показа; контрольные точки, с; длина участка отрыва в долях s ∈ [−1, 1]

  function create(o) {
    o = o || {};
    // P0, P1 — якорная пара (единичные векторы в системе звезды); rope — путь жгута модели (H, dt, hCr, tStall, tFall, esc);
    // g0, kms — тяготение и 1 км/с в единицах R★ и секунд показа; alpha — физ. секунд на секунду показа
    const P0 = nrm(v3(o.P0)), P1 = nrm(v3(o.P1)), rope = o.rope, g0 = o.g0, kms = o.kms, alpha = o.alpha || 188;
    const tau0 = o.tau0 != null ? o.tau0 : 2, e0 = o.e0 != null ? o.e0 : 0.1, fFall = o.fFall != null ? o.fFall : 0.5, N = Math.max(100, Math.round(o.N || 8000)), seed = (o.seed || 1) | 0;
    const f1 = o.hotF != null ? o.hotF : 0.5, eH = o.hotE != null ? o.hotE : 4;   // нагрев: доля областей, начавших греться к подъёму 0,5 R★; яркость нагретого
    const m = nrm([P0[0] + P1[0], P0[1] + P1[1], P0[2] + P1[2]]), ax = nrm([P0[0] - P1[0], P0[1] - P1[1], P0[2] - P1[2]]), side = nrm(crs(m, ax));
    const sep = Math.hypot(P0[0] - P1[0], P0[1] - P1[1], P0[2] - P1[2]), L = 0.6 * sep;
    // путь вершины: линейно между отсчётами; у уходящего после остановки отсчётов (h > 6) — последней скоростью
    const H = rope.H, rdt = rope.dt; let kL = H.length - 1; while (kL > 1 && H[kL] === H[kL - 1]) kL--;
    const vL = kL > 0 ? (H[kL] - H[kL - 1]) / rdt : 0, extra = rope.esc && vL > 0;
    const hAt = t => { const x = t / rdt; if (x <= 0) return H[0]; if (extra && x >= kL) return Math.min(60, H[kL] + vL * (t - kL * rdt)); const i = Math.min(H.length - 2, Math.floor(x)), f = Math.min(1, x - i); return H[i] + (H[i + 1] - H[i]) * f; };
    const hi = H[0], hCr = rope.hCr > hi ? rope.hCr : 1.5 * hi;
    // начало срыва — жгут прошёл высоту срыва; запертое — расписание стока модели
    let tEr = -1; for (let i = 0; i < H.length; i++) if (H[i] > hCr) { tEr = i * rdt; break; }
    const confined = !rope.esc && rope.tStall >= 0, tStall = rope.tStall, tFall = rope.tFall || 3, Tw = 900 / alpha;   // окно отрыва уходящего — 15 мин физ.
    const R = mulberry(seed ^ 0x51ed), asym = (R() < 0.5 ? -1 : 1) * (0.15 + 0.2 * R());   // вершина смещена к одной ноге (несимметричный подъём)
    // сечение волокна и сгусток — в долях разноса пары (автор: «надо к остальным звёздам всё подключать»): у Солнца разнос ≈ 0,16 R★ →
    // a₀ ≈ 0,01 R★ (≈ 7 тыс. км), σ₀ = 0,35·a₀ — как было подобрано; у других звёзд волокно соразмерно своей области
    const a0 = o.a0 || 0.063 * sep, q = o.q || 0.08, Twist = 1.2;
    const lift = t => Math.max(0, hAt(t) - hi);
    // ось жгута и сечение (s ∈ [−1, 1]; ноги — на поверхности: начальная высота h_i·(1 − s⁴), подъём ∝ (1 − s²))
    function axisAt(s, t, out) { const u = nrm([m[0] + s * L * side[0], m[1] + s * L * side[1], m[2] + s * L * side[2]]), f = 1 - s * s;
      const z = hi * (1 - s * s * s * s) + lift(t) * f * (1 + asym * s); out[0] = u[0] * (1 + z); out[1] = u[1] * (1 + z); out[2] = u[2] * (1 + z); return out; }
    const aAt = (s, t) => a0 * (0.4 + 0.6 * (1 - s * s)) + q * lift(t) * (1 - s * s);
    // пучки: 5 неодинаковых, в каждом 2–4 нити; у нити — фаза и доля радиуса; вес массы пучка — неравный
    const strands = []; { const NB = 5; for (let b = 0; b < NB; b++) { const pb = 2 * Math.PI * R(), rb = 0.15 + 0.7 * R(), wb = 0.08 + 0.2 * R(), mb = 0.5 + R(), ns = 2 + Math.floor(3 * R());
      for (let k = 0; k < ns; k++) strands.push({ ph: pb + (R() - 0.5) * wb * 4, rho: Math.min(1, Math.max(0.05, rb + (R() - 0.5) * wb)), w: mb / ns, gap: R() * 100, b }); } }
    const NS = strands.length, A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0];
    // точка нити k при s, t (+ смещение частицы в сечении, доли a)
    function strandAt(k, s, t, dx, dy, out) { s = Math.max(-1, Math.min(1, s)); axisAt(s, t, out); const e = 1e-3, sa = Math.max(-1, s - e), sb = Math.min(1, s + e); axisAt(sa, t, A); axisAt(sb, t, B);
      const T = nrm([B[0] - A[0], B[1] - A[1], B[2] - A[2]]), n2 = nrm(crs(T, ax)), st = strands[k], ph = st.ph + Math.PI * Twist * (s + 1), a = aAt(s, t), c = Math.cos(ph), sn = Math.sin(ph);
      const x = a * (st.rho * c + dx), y = a * (st.rho * sn + dy); out[0] += x * ax[0] + y * n2[0]; out[1] += x * ax[1] + y * n2[1]; out[2] += x * ax[2] + y * n2[2]; return out; }
    // шум вдоль нити — сгустки и пропуски холодного вещества
    const hash = x => { const s = Math.sin(x * 127.1) * 43758.5453; return s - Math.floor(s); };
    const noise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) + (hash(i + 1) - hash(i)) * u; };
    const dens = (k, s) => Math.max(0, noise(s * 5 + strands[k].gap) * 1.6 - 0.45) * (0.6 + 0.4 * noise(s * 23 + strands[k].gap * 3));
    // участки отрыва (нить × участок): отрыв, время, способ (1 — сток по нити, 2 — баллистика), толчок
    const NSEG = Math.ceil(2 / SEG), seg = [];
    for (let k = 0; k < NS; k++) for (let j = 0; j < NSEG; j++) { const sc = -1 + (j + 0.5) * SEG, u = R(), u2 = R(), u3 = R(), leg = Math.abs(sc) > 0.55;
      let rel = false, tr = 1e9, mode = 0, kick = [0, 0, 0];
      if (confined) { rel = true; tr = tStall + u2 * tFall; mode = leg || u3 < 0.6 ? 1 : 2; }
      else if (tEr >= 0 && u < fFall) { rel = true; tr = tEr + (leg ? 0.5 * u2 : 0.15 + 0.85 * u2) * Tw; mode = leg ? 1 : 2; }
      if (mode === 2) { const sp = (confined ? 10 + 20 * R() : 20 + 40 * R()) * kms, d = nrm([R() - 0.5, R() - 0.5, R() - 0.5]); kick = [sp * d[0], sp * d[1], sp * d[2]]; }
      seg.push({ rel, tr, mode, kick, hot: R() < 0.35 ? 2 + 2 * R() : 0.2 + 0.4 * R() }); }
    // частицы: нить по весу, s — по плотности сгустков (выборка с отказом), смещение в сечении, размер
    const sk = new Uint16Array(N), ss = new Float32Array(N), dxy = new Float32Array(2 * N), ksz = new Float32Array(N), jit = new Float32Array(3 * N);
    { const W = strands.reduce((a, s) => a + s.w, 0); for (let i = 0; i < N; i++) { let r = R() * W, k = 0; while (k < NS - 1 && r > strands[k].w) { r -= strands[k].w; k++; }
      let s = 0; for (let tr = 0; tr < 40; tr++) { s = -1 + 2 * R(); if (R() < dens(k, s)) break; }
      sk[i] = k; ss[i] = s; dxy[2 * i] = 0.05 * (R() + R() + R() - 1.5); dxy[2 * i + 1] = 0.05 * (R() + R() + R() - 1.5); ksz[i] = 0.7 + 0.6 * R();
      for (let c = 0; c < 3; c++) jit[3 * i + c] = (R() - 0.5) * 2 * 5 * kms; } }
    const segOf = i => sk[i] * NSEG + Math.min(NSEG - 1, Math.floor((ss[i] + 1) / SEG));
    // масса: средняя τ волокна τ₀ на площади 2L × 2a₀ (вид сверху)
    // сгусток растёт медленнее сечения жгута (σ ∝ a^0,35): при подъёме нити расходятся и видны по отдельности (31.08.2012); при σ ∝ a
    // (самоподобно) пучки сливались в одну гладкую светящуюся трубку
    const sig0 = o.sig0 || 0.35 * a0, GX = 0.35, Mi = tau0 * (2 * L) * (2 * a0) / N;
    // нагрев по времени (автор: «давай нагрев по времени»; замысел — разбор Codex). Связные области нити (Δs ≈ 0,45, общие для нитей пучка;
    // значения в узлах — линейно вдоль s, без «конфетти») начинают греться, когда доля начавших нагрев f_h(t) = f1·(0,2 + 0,8·S(подъём/0,5 R★))
    // превысит их порог (после срыва). T растёт за τ_h = 300–1200 физ. с до T_max (70 % — 0,6–1 МК, в полосе 171; 30 % — 1,3–2,5 МК: уходят
    // выше и гаснут), держится 900–2700 с (нагрев продолжается), затем остывает адиабатически T ∝ ρ^{2/3} (разбор Codex: без этого постоянное T_max —
    // непрерывный нагрев; при остывании сразу после разогрева в полосу 171 почти никто не попадал — жгут расширяется быстрее). Часть
    // областей одной ноги тёплая ещё до срыва (31.08.2012 — светлые нити ноги до извержения: Lörinčík et al. 2019). Поглощение 171 держится до
    // ≈ 10⁵ K (He II; Landi & Reale 2013): a = 1 − S(4,8; 5,3; lg T). Свечение нагретого — eH·M·ν·R₁₇₁(T): ν — плотность участка жгута
    // относительно начальной (сечение² × длина; мера эмиссии ∝ M·ρ), R₁₇₁ — гаусс по lg T: 5,9 ± 0,15. Масштабы — постановка по виду
    // (Landi et al. 2010: многотемпературное вещество 10⁵–10⁶ K), не измеренная доля
    const RH = mulberry(seed ^ 0x7ea7), HL = 0.45, NHN = Math.ceil(2 / HL) + 1, NBd = strands.reduce((a, q) => Math.max(a, q.b + 1), 0), preSide = asym > 0 ? 1 : -1;
    const hn = []; for (let b = 0; b < NBd; b++) for (let k = 0; k < NHN; k++) { const sk0 = -1 + k * HL, warm = RH() < 0.7;
      hn.push({ u: RH(), tau: (300 + 900 * RH()) / alpha, tm: warm ? 5.8 + 0.2 * RH() : 6.1 + 0.3 * RH(), pre: sk0 * preSide > 0.4 && RH() < 0.5 ? 1 : 0, hold: (900 + 1800 * RH()) / alpha }); }
    // начало нагрева — срыв; у запертого без срыва (жгут поднялся, но порог не пройден) — начало заметного подъёма (+0,02 R★ или +20 %)
    let tH0 = tEr; if (tH0 < 0) for (let i = 0; i < H.length; i++) if (H[i] > hi + Math.max(0.02, 0.2 * hi)) { tH0 = i * rdt; break; }
    const fhT = new Float32Array(H.length); { let mx = 0; for (let i = 0; i < H.length; i++) { if (tH0 >= 0 && i * rdt >= tH0) { const x = Math.min(1, Math.max(0, (H[i] - hi) / 0.5)); mx = Math.max(mx, f1 * (0.2 + 0.8 * x * x * (3 - 2 * x))); } fhT[i] = mx; } }
    const thOf = u => { if (f1 <= 0 || tH0 < 0 || fhT[fhT.length - 1] < u) return 1e9;   // 0 — без нагрева (разбор Codex)
      let a = 0, b = fhT.length - 1; while (a < b) { const md = (a + b) >> 1; if (fhT[md] >= u) b = md; else a = md + 1; } return Math.max(tH0, a * rdt); };
    const hTau = new Float32Array(N), hTm = new Float32Array(N), hPre = new Float32Array(N), hTh = new Float32Array(N), hHold = new Float32Array(N);
    for (let i = 0; i < N; i++) { const b = strands[sk[i]].b, x = (ss[i] + 1) / HL, k0 = Math.min(NHN - 2, Math.floor(x)), f = x - k0, A0 = hn[b * NHN + k0], A1 = hn[b * NHN + k0 + 1];
      hTau[i] = A0.tau + (A1.tau - A0.tau) * f; hHold[i] = A0.hold + (A1.hold - A0.hold) * f; hTm[i] = A0.tm + (A1.tm - A0.tm) * f; hPre[i] = f1 > 0 ? A0.pre + (A1.pre - A0.pre) * f : 0; hTh[i] = thOf(A0.u + (A1.u - A0.u) * f); }
    // плотность нити относительно начальной: (w₀/w)² × (ℓ₀/ℓ); ширина нити w ∝ a^0,35 (как σ сгустка: нити тоньше жгута и расширяются
    // медленнее его — при плотности по сечению всего жгута, ∝ a⁻², нагретые нити гасли к 0,2 R★), ℓ — длина оси на единицу s
    const lenAx0 = (s, t) => { s = Math.max(-0.999, Math.min(0.999, s)); axisAt(s - 1e-3, t, A); axisAt(s + 1e-3, t, B); return Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) / 2e-3; };
    const LT = new Float32Array(65); let LTt = NaN;   // таблица длины оси на время LTt (кадр): 65 узлов по s вместо двух точек оси на частицу
    const lenAx = (s, t) => { if (t !== LTt) return lenAx0(s, t); const x = (Math.max(-1, Math.min(1, s)) + 1) * 32, k = Math.min(63, Math.floor(x)); return LT[k] + (LT[k + 1] - LT[k]) * (x - k); };
    const lenTab = t => { if (t === LTt) return; for (let k = 0; k <= 64; k++) LT[k] = lenAx0(-1 + k / 32, t); LTt = t; };
    const nuAx = (s, t, l0) => { const r = Math.pow(aAt(s, 0) / aAt(s, t), GX); return r * r * (l0 != null ? l0 : lenAx(s, 0)) / Math.max(lenAx(s, t), 1e-9); };
    // кэш: длина оси при t = 0 у исходного места частицы; плотность на конце нагрева (не зависит от момента запроса — разбор см. nuOf)
    const L0 = new Float32Array(N), nuTe = new Float32Array(N).fill(NaN); for (let i = 0; i < N; i++) L0[i] = lenAx0(ss[i], 0);
    // плотность частицы в момент t (летящая — с момента отрыва сгусток расширяется: ν ∝ (1 + 0,05·Δt)⁻³, как σ)
    // у стекающих — по исходному месту на нити (разбор Codex: по текущему s кэш конца нагрева зависел от истории прокрутки)
    function nuOf(i, t) { if (S.st[i] === 2 && t > S.trel[i]) { const g = 1 + 0.05 * (t - S.trel[i]); return nuAx(ss[i], S.trel[i], L0[i]) / (g * g * g); } return nuAx(ss[i], t, L0[i]); }
    const sst = (a, b, x) => { const y = Math.min(1, Math.max(0, (x - a) / (b - a))); return y * y * (3 - 2 * y); };
    function logTOf(i, t, nuNow) { const base = 4 + 1.7 * sst(0, 1, hPre[i]), th = hTh[i]; if (t <= th) return base; const tm = Math.max(hTm[i], base), x = (t - th) / hTau[i];
      if (x < 1) return base + (tm - base) * x * x * (3 - 2 * x);
      // нагрев держится ещё 900–2700 физ. с (постоянная T — это продолжающийся нагрев), затем — адиабатическое остывание
      const te = th + hTau[i] + hHold[i]; if (t <= te) return tm;
      if (nuTe[i] !== nuTe[i]) nuTe[i] = nuOf(i, te);   // при t ≥ конца нагрева ответ один и тот же (момент отрыва детерминирован)
      return Math.max(4, tm + (2 / 3) * Math.log10(Math.max(1e-9, nuNow) / Math.max(nuTe[i], 1e-9))); }
    // состояние: 0 — на нити, 1 — стекает по нити (s, ṡ), 2 — летит (x, v), 3 — упала (время и место удара)
    const S = { tc: 0, st: new Uint8Array(N), x: new Float32Array(3 * N), v: new Float32Array(3 * N), s: new Float32Array(N), sd: new Float32Array(N), tImp: new Float32Array(N), sr: new Float32Array(N), trel: new Float32Array(N) };
    const ck = new Map(); const snap = () => ({ tc: S.tc, st: S.st.slice(), x: S.x.slice(), v: S.v.slice(), s: S.s.slice(), sd: S.sd.slice(), tImp: S.tImp.slice(), sr: S.sr.slice(), trel: S.trel.slice() });
    function restore(c) { S.tc = c.tc; S.st.set(c.st); S.x.set(c.x); S.v.set(c.v); S.s.set(c.s); S.sd.set(c.sd); S.tImp.set(c.tImp); S.sr.set(c.sr); S.trel.set(c.trel); }
    const init0 = snap(); ck.set(0, init0);
    const P = [0, 0, 0], Q = [0, 0, 0];
    // отрыв в момент t: скорость точки нити (разность положений по интерполированному пути) + толчок участка + дробление
    function release(i, t) { const g = seg[segOf(i)], k = sk[i], e = 0.01; S.trel[i] = t; S.sr[i] = Math.pow(aAt(ss[i], t) / aAt(ss[i], 0), GX);
      if (g.mode === 1) { S.st[i] = 1; S.s[i] = ss[i]; strandAt(k, ss[i] + 1e-3, t, dxy[2 * i], dxy[2 * i + 1], P); strandAt(k, ss[i] - 1e-3, t, dxy[2 * i], dxy[2 * i + 1], Q);
        const dl = Math.hypot(P[0] - Q[0], P[1] - Q[1], P[2] - Q[2]) / 2e-3; S.sd[i] = (ss[i] >= 0 ? 1 : -1) * 5 * kms / Math.max(dl, 1e-6); return; }
      S.st[i] = 2; strandAt(k, ss[i], t + e, dxy[2 * i], dxy[2 * i + 1], P); strandAt(k, ss[i], Math.max(0, t - e), dxy[2 * i], dxy[2 * i + 1], Q); const dd = t + e - Math.max(0, t - e);
      strandAt(k, ss[i], t, dxy[2 * i], dxy[2 * i + 1], C);
      for (let c = 0; c < 3; c++) { S.x[3 * i + c] = C[c]; S.v[3 * i + c] = (P[c] - Q[c]) / dd + g.kick[c] + jit[3 * i + c]; } }
    function step() { const t0 = S.tc, t1 = t0 + DT;
      for (let i = 0; i < N; i++) { let st = S.st[i];
        if (st === 0) { const g = seg[segOf(i)]; if (g.rel && g.tr <= t1) { release(i, t1); } continue; }
        if (st === 1) { // сток по нити: ускорение вдоль касательной от тяжести, положение — на движущейся нити
          const k = sk[i], s = S.s[i]; axisAt(Math.min(1, s + 1e-3), t1, P); axisAt(Math.max(-1, s - 1e-3), t1, Q);   // касательная — по оси жгута (дешевле нити втрое)
          const tg = [P[0] - Q[0], P[1] - Q[1], P[2] - Q[2]], dl = Math.hypot(tg[0], tg[1], tg[2]) / 2e-3, mid = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2, (P[2] + Q[2]) / 2], r = Math.hypot(mid[0], mid[1], mid[2]);
          const at = -g0 / (r * r) * (mid[0] * tg[0] + mid[1] * tg[1] + mid[2] * tg[2]) / (r * Math.max(Math.hypot(tg[0], tg[1], tg[2]), 1e-12));
          S.sd[i] += at / Math.max(dl, 1e-6) * DT; S.s[i] = s + S.sd[i] * DT;
          if (Math.abs(S.s[i]) >= 1) { S.st[i] = 3; S.tImp[i] = t1; strandAt(k, S.s[i] > 0 ? 1 : -1, t1, 0, 0, C); const l = Math.hypot(C[0], C[1], C[2]); for (let c = 0; c < 3; c++) S.x[3 * i + c] = C[c] / l * 1.001; }
          continue; }
        if (st === 2) { // баллистика (скоростной Верле), удар — по отрезку шага
          const j = 3 * i, x = S.x, v = S.v; let r = Math.hypot(x[j], x[j + 1], x[j + 2]), k1 = -g0 / (r * r * r);
          const xn = [x[j] + v[j] * DT + 0.5 * k1 * x[j] * DT * DT, x[j + 1] + v[j + 1] * DT + 0.5 * k1 * x[j + 1] * DT * DT, x[j + 2] + v[j + 2] * DT + 0.5 * k1 * x[j + 2] * DT * DT];
          const rn = Math.hypot(xn[0], xn[1], xn[2]);
          if (rn < 1) { const f = (r - 1) / Math.max(r - rn, 1e-9), ip = nrm([x[j] + (xn[0] - x[j]) * f, x[j + 1] + (xn[1] - x[j + 1]) * f, x[j + 2] + (xn[2] - x[j + 2]) * f]);
            S.st[i] = 3; S.tImp[i] = t0 + f * DT; x[j] = ip[0] * 1.001; x[j + 1] = ip[1] * 1.001; x[j + 2] = ip[2] * 1.001; continue; }
          const k2 = -g0 / (rn * rn * rn); for (let c = 0; c < 3; c++) { v[j + c] += 0.5 * (k1 * x[j + c] + k2 * xn[c]) * DT; x[j + c] = xn[c]; } } }
      S.tc = t1; const kc = Math.round(t1 / CK); if (Math.abs(t1 - kc * CK) < DT / 2 && !ck.has(kc)) ck.set(kc, snap()); }
    function advance(t) { t = Math.max(0, t);
      if (t < S.tc - 1e-9) { let best = 0; for (const k of ck.keys()) if (k * CK <= t + 1e-9 && k > best) best = k; restore(ck.get(best)); }
      while (S.tc + DT <= t + 1e-9) step(); }
    // вид в момент t: P4 — (x, y, z, σ), Q4 — (M, E, σ_e, 0); только видимые частицы
    const P4 = new Float32Array(4 * N), Q4 = new Float32Array(4 * N);
    function at(t, fade) { advance(t); lenTab(t); fade = fade == null ? 1 : fade; const env = fade * Math.min(1, Math.max(0, t / 0.8)), dtc = t - S.tc; let n = 0;
      if (env <= 0) return { n: 0, P: P4, Q: Q4 };
      for (let i = 0; i < N; i++) { const st = S.st[i]; let sg, x, y, z, M = Mi * env, E;
        if (st === 0) { strandAt(sk[i], ss[i], t, dxy[2 * i], dxy[2 * i + 1], C); x = C[0]; y = C[1]; z = C[2]; sg = sig0 * ksz[i] * Math.pow(aAt(ss[i], t) / aAt(ss[i], 0), GX); }
        else if (st === 1) { strandAt(sk[i], S.s[i], t, dxy[2 * i], dxy[2 * i + 1], C); x = C[0]; y = C[1]; z = C[2]; sg = sig0 * ksz[i] * S.sr[i]; }
        else if (st === 2) { const j = 3 * i; x = S.x[j] + S.v[j] * dtc; y = S.x[j + 1] + S.v[j + 1] * dtc; z = S.x[j + 2] + S.v[j + 2] * dtc; sg = sig0 * ksz[i] * S.sr[i] * (1 + 0.05 * (t - S.trel[i])); }
        else { const a = t - S.tImp[i]; if (a > 1.2 || a < 0) continue; const j = 3 * i; x = S.x[j]; y = S.x[j + 1]; z = S.x[j + 2]; sg = 0.0025;
          // удар: вещество нагрето — не поглощает, коротко светит
          E = 3 * e0 * M * Math.exp(-a / 0.25); M = 0; P4.set([x, y, z, sg], 4 * n); Q4.set([0, E, sg, 0], 4 * n); n++; continue; }
        const r = Math.hypot(x, y, z); if (r > 60) continue;
        // нагрев: поглощение — доля a₁₇₁, свечение — тёплая оболочка холодной нити (условно, ∝ σ) + нагретый газ (∝ ν·R₁₇₁); нагретое светит
        // своим объёмом — пятно свечения сжимается к σ (разбор Codex: 1,7σ снижало пик в 2,9 раза)
        const nu = nuOf(i, t), lt = logTOf(i, t, nu), a171 = 1 - sst(4.8, 5.3, lt), zt = (lt - 5.9) / 0.15, R171 = Math.exp(-0.5 * zt * zt);
        E = e0 * M * (sg / (sig0 * ksz[i])) * a171 + eH * M * nu * R171;
        P4[4 * n] = x; P4[4 * n + 1] = y; P4[4 * n + 2] = z; P4[4 * n + 3] = sg; Q4[4 * n] = M * a171; Q4[4 * n + 1] = E; Q4[4 * n + 2] = sg * (1 + 0.7 * a171); Q4[4 * n + 3] = lt; n++; }
      return { n, P: P4, Q: Q4 }; }
    function stats() { const c = [0, 0, 0, 0]; for (let i = 0; i < N; i++) c[S.st[i]]++; let hs = 0; for (let i = 0; i < N; i++) if (hTh[i] <= S.tc) hs++;
      return { attached: c[0], drain: c[1], fly: c[2], fallen: c[3], heating: hs, tc: S.tc, tEr, confined, hi, hCr, strands: NS, ck: ck.size }; }
    return { at, stats, hAt, N, tEr, confined, frame: { m, ax, side, L } };
  }
  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.M31CmeParticles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
