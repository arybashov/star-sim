// М31 · стенд звезды: корона в ультрафиолете — «объём, размеченный силовыми линиями» (реестр интерфейса, пп. 28–29; проектный
// разбор Codex 15.10.2026). Только стенд: игра этот модуль не загружает.
// Запекание (видеокарта, раз на снимок поля): сферическая сетка Nφ×Nθ×Nr (r — по логарифму от 1 до 2,5 R★ — поверхности источника);
// из каждой ячейки силовая линия прослеживается в обе стороны (средняя точка, шаг мельче у поверхности) до поверхности звезды или до
// поверхности источника. Замкнутая линия — петля: нагрев её оснований F_H (карта поверхности, установившийся) → закон RTV
// (Rosner, Tucker & Vaiana 1978): p₀ = (Q/9,8·10⁴)^(6/7)·L^(5/7), T = 1400·(p₀L)^(1/3), Q = F/L, L — полудлина; плотность — равновесие
// под тяжестью при этой T (изотермически, точная сферическая тяжесть). Открытая линия — заданные T и n у основания (ветер на этих высотах
// дозвуковой — почти гидростатика). Свечение канала 17,4 нм (Fe IX/X, Solar Orbiter EUI): ε = (n_e/10⁹)²·R(T), R — приближённый отклик
// (гауссиана по lg T около 5,95, σ 0,12 — тестовый, не калибровка прибора).
// Отрисовка (каждый кадр): луч от камеры сквозь объём, свечение складывается вдоль луча (корона прозрачна), диск звезды закрывает то,
// что за ним; яркость — логарифмом с постоянными границами (без автоэкспозиции), палитра — золотая, как у EUI 17,4 нм. Вид смешивается с
// обычным по расстоянию камеры до звезды: вблизи — ультрафиолет, вдали — как видит глаз.
(function (root) {
  'use strict';
  const KB = 1.380649e-16, MP = 1.67262e-24, G = 6.674e-8, MU = 1.4 / 2.3;
  const FIELD_GLSL = `
    uniform vec4 uC[160]; uniform int uNC; uniform float uDip, uDipU, uGU; uniform vec3 uDipM;
    // поле в Гс — та же формула, что fieldAt в star-model.js (заряды с изображениями, диполь с изображением)
    vec3 field(vec3 x) { vec3 b = vec3(0.0);
      for (int i = 0; i < 160; i++) { if (i >= uNC) break; vec3 d = x - uC[i].xyz; float r2 = dot(d, d) + 1e-6; b += uC[i].w * d / (r2 * sqrt(r2)); }
      if (uDip != 0.0) { float r2 = dot(x, x), r3 = r2 * sqrt(r2); float k3 = 3.0 * uDip * dot(uDipM, x) / (r3 * r2); b += k3 * x + uDipM * (-uDip / r3 + uDipU); }
      return b * uGU; }
    // то же поле и расстояние до ближайшего источника (заряда; диполь — в центре): масштаб, на котором поле меняется заметно
    vec3 fieldD(vec3 x, out float dm) { vec3 b = vec3(0.0); dm = length(x);
      for (int i = 0; i < 160; i++) { if (i >= uNC) break; vec3 d = x - uC[i].xyz; float r2 = dot(d, d) + 1e-6, rr = sqrt(r2); b += uC[i].w * d / (r2 * rr); dm = min(dm, rr); }
      if (uDip != 0.0) { float r2 = dot(x, x), r3 = r2 * sqrt(r2); float k3 = 3.0 * uDip * dot(uDipM, x) / (r3 * r2); b += k3 * x + uDipM * (-uDip / r3 + uDipU); }
      return b * uGU; }`;
  const BAKE_HEAD = `precision highp float; precision highp int; precision highp sampler2D;
    layout(location = 0) out vec4 o0;
    uniform sampler2D uFH; uniform int uFHW, uFHH; uniform float uLayer, uNr, uNt, uNp, uRmin, uRmax, uRcm, uGM, uTopen, uNopen, uBmin, uSW, uSH, uStepMode;
    uniform highp sampler3D uBG; uniform float uGOn, uGR0;
    ${FIELD_GLSL}
    const float PI = 3.14159265359, KB = ${KB.toExponential(6)}, MP = ${MP.toExponential(6)}, MU = ${MU.toFixed(6)};
    // поле для хода вдоль линии (автор: «давай поле в текстуру»): выше 1,02 R★ — из сетки (вектор поля и расстояние до ближайшего источника,
    // трилинейно, раз на снимок), ниже — точная сумма по зарядам (над пятнами поле меняется на масштабе глубины источников)
    vec3 fieldS(vec3 x, out float dm) { float r = length(x);
      if (uGOn > 0.5 && r > uGR0 && r < uRmax) { vec4 g = texture(uBG, vec3(fract(atan(x.z, x.x) / (2.0 * PI) + 1.0), acos(clamp(x.y / r, -1.0, 1.0)) / PI, log(r) / log(uRmax))); dm = max(g.w, 1e-3); return g.xyz; }
      return fieldD(x, dm); }
    // ход вдоль поля (знак sg) до поверхности звезды (код 1), поверхности источника (2), нуля поля (3) или предела шагов (0); rtop — наибольший радиус
    vec4 trace(vec3 x, float sg, out float code, out float rtop) { float len = 0.0; rtop = length(x);
      for (int k = 0; k < 900; k++) {
        // шаг (автор: «а быстрее можем текстуру считать?»): по масштабу поля — четверть расстояния до ближайшего источника, не больше высоты над
        // поверхностью + 0,006 (низкие петли не «срезаются» поверхностью); прежде — только по высоте (0,0025 у поверхности: длинные низкие линии
        // шли почти 900 шагов); uStepMode 0 — прежний шаг (для сверки)
        float r = length(x), dm; rtop = max(rtop, r);
        vec3 b1 = fieldS(x, dm); float m1 = length(b1); if (m1 < uBmin) { code = 3.0; return vec4(x, len); }
        float h = uStepMode > 0.5 ? clamp(min(0.25 * dm, (r - 1.0) + 0.006), 0.0025, 0.06) : clamp(0.02 * (r - 1.0) + 0.0025, 0.0025, 0.03);
        float dm2; vec3 xm = x + 0.5 * h * sg * b1 / m1, b2 = fieldS(xm, dm2); float m2 = length(b2); if (m2 < uBmin) { code = 3.0; return vec4(x, len); }
        vec3 xn = x + h * sg * b2 / m2; float rn = length(xn);
        if (rn <= 1.0) { float f = (r - 1.0) / max(1e-6, r - rn); code = 1.0; return vec4(mix(x, xn, f), len + h * f); }
        if (rn >= uRmax) { float f = (uRmax - r) / max(1e-6, rn - r); code = 2.0; return vec4(mix(x, xn, f), len + h * f); }
        x = xn; len += h; }
      code = 0.0; return vec4(x, len); }
    // нагрев оснований: R32F читается без фильтрации (линейная для float не гарантирована — OES_texture_float_linear), билинейно вручную;
    // по φ — по кругу, по θ — до края
    float fhAt(int i, int j) { return texelFetch(uFH, ivec2((i % uFHW + uFHW) % uFHW, clamp(j, 0, uFHH - 1)), 0).r; }
    float fh(vec3 p) { vec3 n = normalize(p);
      float x = fract(atan(n.z, n.x) / (2.0 * PI) + 1.0) * float(uFHW) - 0.5, y = acos(clamp(n.y, -1.0, 1.0)) / PI * float(uFHH) - 0.5;
      int i = int(floor(x)), j = int(floor(y)); float fx = x - floor(x), fy = y - floor(y);
      return mix(mix(fhAt(i, j), fhAt(i + 1, j), fx), mix(fhAt(i, j + 1), fhAt(i + 1, j + 1), fx), fy); }
    float fhUV(vec2 t) { float x = fract(t.x) * float(uFHW) - 0.5, y = t.y * float(uFHH) - 0.5; int i = int(floor(x)), j = int(floor(y)); float fx = x - floor(x), fy = y - floor(y);
      return mix(mix(fhAt(i, j), fhAt(i + 1, j), fx), mix(fhAt(i, j + 1), fhAt(i + 1, j + 1), fx), fy); }
    float resp174(float T) { float z = (log(T) / log(10.0) - 5.95) / 0.12; return exp(-0.5 * z * z); }`;
  // живая корона над краем (автор: «давай, корону живой»; разбор Codex): объём разделён на геометрию и яркость. Геометрия — снимками, слой за
  // кадр (две линии из ячейки — дорого): оба основания (первым — с B_r > 0: метка узора меха не рвётся на вершине), полудлина петли, тип.
  // Яркость — каждый кадр по живой карте нагрева у оснований (петля RTV, равновесие под тяжестью): нагрев у оснований виден над краем сразу,
  // отставание — только у самой формы петель
  const OCT_GLSL = `
    // направление ↔ число: октаэдрическая развёртка (ось y — вверх), по 12 бит на ось (≈ 0,05°), два целых в одном float (точно до 2²⁴)
    vec2 octSgn(vec2 v) { return vec2(v.x >= 0.0 ? 1.0 : -1.0, v.y >= 0.0 ? 1.0 : -1.0); }
    float octPack(vec3 n) { n /= abs(n.x) + abs(n.y) + abs(n.z); vec2 e = n.y >= 0.0 ? n.xz : (1.0 - abs(n.zx)) * octSgn(n.xz);
      vec2 q = floor(clamp(e * 0.5 + 0.5, 0.0, 1.0) * 4095.0 + 0.5); return q.x * 4096.0 + q.y; }
    vec3 octUnpack(float p) { float a = floor(p / 4096.0), b = p - a * 4096.0; vec2 e = vec2(a, b) / 4095.0 * 2.0 - 1.0;
      vec3 n = vec3(e.x, 1.0 - abs(e.x) - abs(e.y), e.y); if (n.y < 0.0) n.xz = (1.0 - abs(n.zx)) * octSgn(n.xz); return normalize(n); }`;
  const GEOM_FS = BAKE_HEAD + OCT_GLSL + `
    void main() {
      vec2 ij = floor(gl_FragCoord.xy);
      float ph = 2.0 * PI * (ij.x + 0.5) / uNp, th = PI * (ij.y + 0.5) / uNt, r = uRmin * exp(log(uRmax / uRmin) * (uLayer + 0.5) / uNr);
      vec3 x = r * vec3(sin(th) * cos(ph), cos(th), sin(th) * sin(ph));
      float cA, cB, tA, tB; vec4 A = trace(x, 1.0, cA, tA), B = trace(x, -1.0, cB, tB);
      // RGBA: основание 1, основание 2 (упакованы), полудлина петли (R★), тип: 1 — замкнутая, 2 — открытая, 3 — ноль поля, 4 — не дошли
      if (cA == 1.0 && cB == 1.0) { bool sw = dot(field(A.xyz), A.xyz) <= 0.0;
        o0 = vec4(octPack(normalize(sw ? B.xyz : A.xyz)), octPack(normalize(sw ? A.xyz : B.xyz)), 0.5 * (A.w + B.w), 1.0); }
      else if ((cA == 1.0 && cB == 2.0) || (cA == 2.0 && cB == 1.0)) o0 = vec4(octPack(normalize(cA == 1.0 ? A.xyz : B.xyz)), 0.0, 0.0, 2.0);
      else o0 = vec4(0.0, 0.0, 0.0, cA == 3.0 || cB == 3.0 ? 3.0 : 4.0);
    }`;
  const EMIT_FS = BAKE_HEAD + OCT_GLSL + `
    uniform highp sampler3D uGeo;
    void main() {
      ivec2 ij = ivec2(floor(gl_FragCoord.xy)); float r = uRmin * exp(log(uRmax / uRmin) * (uLayer + 0.5) / uNr);
      vec4 g = texelFetch(uGeo, ivec3(ij, int(uLayer)), 0); float T = 0.0, pb = 0.0; vec3 foot = vec3(0.0);
      if (g.a == 1.0) {   // замкнутая: петля RTV, нагрев — среднее по основаниям; метка — основание с B_r > 0
        vec3 a = octUnpack(g.r), b = octUnpack(g.g); foot = a; float F = 0.5 * (fh(a) + fh(b)), L = g.b * uRcm;
        if (F > 0.0 && L > 0.0) { float Q = F / L; pb = pow(Q / 9.8e4, 6.0 / 7.0) * pow(L, 5.0 / 7.0); T = clamp(1400.0 * pow(pb * L, 1.0 / 3.0), 3e5, 2e7); }
      } else if (g.a == 2.0) { T = uTopen; pb = uNopen * KB * T * 2.3 / 1.2; foot = 0.5 * octUnpack(g.r); }   // открытая: длина метки ½ — признак
      float eps = 0.0;
      if (T > 0.0 && pb > 0.0) { float aa = MU * MP * uGM / (KB * T * uRcm) * (1.0 - 1.0 / r);   // равновесие под тяжестью, изотермически
        float n9 = (1.2 / 2.3) * pb * exp(-aa) / (KB * T) / 1e9; eps = n9 * n9 * resp174(T); }
      // R — свечение 17,4 нм; GBA — основание силовой линии (единичный вектор — замкнутая, длина ½ — открытая, 0 — нет основания)
      o0 = vec4(eps, foot);
    }`;
  // текстура нижнего слоя на поверхности (автор: «газ очень низкого разрешения можно сделать — а там не объём высотой 1, а прямо текстуру
  // на поверхность»; формулы — разбор Codex, вариант B): в каждой точке — силовая линия из основания (в сторону, куда поле выходит наружу):
  // замкнутая — петля RTV с нагревом обоих оснований, открытая — T и n у основания; хранится свечение у основания e₀ = (n₀/10⁹)²·G(T)
  // (×0,01 — для половинной точности), крутизна A = 2μm_pGM/(kTR) (ε(r) = e₀·exp(−A(1 − 1/r)) — то же равновесие под тяжестью, что в объёме)
  // и наибольший радиус линии (выше вершины петли столб не светит). Приближение: столб над точкой — от петли из этой точки (наклон петель
  // и чужие петли над ней не учитываются; у края диска — переход к объёму)
  // форма и яркость нижнего слоя (автор: «давай 1 и 2 к 512»; разбор Codex). Форма — два постоянных отсчёта в ячейке (точки uSP внутри ячейки,
  // у каждой ячейки — свой поворот): второе основание (упаковано; −1 — открытая, −2 — нет основания), полудлина петли (лог-шкала 0,002…16 R★,
  // 12 бит) и вершина до r_c (12 бит) — два числа на отсчёт; перетрассировка — плитками по маске (видимые — чаще, по возрасту). Яркость —
  // каждый кадр заново по живому нагреву у обоих оснований: петля RTV → свечение столба J при 4 наклонах для каждого отсчёта, среднее двух
  // (усреднять готовые J — не форму: связь нелинейная). Приближение: столб над точкой — от петли из этой точки (у края диска — переход к объёму)
  const SURF_GLSL = `
    uniform vec4 uSP;
    float hs1(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec2 spAt(vec2 ij, int k) { return fract((k == 0 ? uSP.xy : uSP.zw) + vec2(hs1(ij), hs1(ij + 17.31))); }
    vec3 dirAt(vec2 uvc) { float ph = 2.0 * PI * uvc.x / uSW, th = PI * uvc.y / uSH; return vec3(sin(th) * cos(ph), cos(th), sin(th) * sin(ph)); }
    const float LQ0 = -6.2146081, LQ1 = 2.7725887;   // ln 0,002 и ln 16`;
  const SGEO_FS = BAKE_HEAD + OCT_GLSL + SURF_GLSL + `
    uniform sampler2D uMask; uniform float uRc, uK;
    vec2 geoAt(vec2 ij, int k) { vec3 n = dirAt(ij + spAt(ij, k)), x0 = n * 1.002; float c, rt, sg = dot(field(x0), n) >= 0.0 ? 1.0 : -1.0; vec4 E = trace(x0, sg, c, rt);
      if (c == 1.0) { float lq = clamp(floor((log(0.5 * (E.w + 0.004)) - LQ0) / (LQ1 - LQ0) * 4095.0 + 0.5), 0.0, 4095.0), rq = clamp(floor((min(rt, uRc) - 1.0) / (uRc - 1.0) * 4095.0 + 0.5), 0.0, 4095.0);
        return vec2(octPack(normalize(E.xyz)), lq * 4096.0 + rq); }
      return vec2(c == 2.0 ? -1.0 : -2.0, 0.0); }
    // плитка выбрана? значение маски: 0 — нет, 60·(фаза + 1) — только ячейки этой фазы 2×2, 255 — все ячейки (сборка)
    // форма хранится по фазам: четверть текстуры на фазу 2×2 (ячейки одной фазы — рядом: группы потоков видеокарты считают целиком; при
    // шахматной выборке в каждой группе считал бы лишь каждый четвёртый — вчетверо дороже)
    ivec2 stor(ivec2 q) { ivec2 h = ivec2(int(uSW), int(uSH)) / 2; return ivec2((q.x & 1) * h.x + (q.x >> 1), (q.y & 1) * h.y + (q.y >> 1)); }
    ivec2 texelOf(ivec2 s) { ivec2 h = ivec2(int(uSW), int(uSH)) / 2, p = ivec2(s.x >= h.x ? 1 : 0, s.y >= h.y ? 1 : 0); return 2 * (s - p * h) + p; }
    bool picked(ivec2 q) { ivec2 ms = textureSize(uMask, 0); float mv = texelFetch(uMask, ivec2(vec2(q) * vec2(ms) / vec2(uSW, uSH)), 0).r * 255.0;
      if (mv < 30.0) return false; if (mv > 250.0) return true; return (q.x & 1) + 2 * (q.y & 1) == int(floor(mv / 60.0 + 0.5)) - 1; }
    void main() { ivec2 q = texelOf(ivec2(floor(gl_FragCoord.xy))); if (!picked(q)) discard;   // не выбрана — прежняя форма
      vec2 ij = vec2(q);
      o0 = vec4(geoAt(ij, 0), uK > 1.5 ? geoAt(ij, 1) : vec2(-2.0, 0.0)); }`;
  const SBRI_FS = BAKE_HEAD + OCT_GLSL + SURF_GLSL + `
    uniform sampler2D uSG, uSGP, uSGP2, uTW, uVis, uJL; uniform float uRc, uK;
    // столб вдоль луча с прицельным расстоянием β: J = e₀∫ exp(−A(1 − 1/r))·dr/√(1 − β²/r²) от r = 1 до min(r_c, вершины), сразу при 4 наклонах
    // (β² = 0; 0,4375; 0,75; 0,9375 ↔ μ = 1; 0,75; 0,5; 0,25). Замена u = 1 − 1/r, w = (1 − e^(−Au))/A: J = e₀·w(u_top)·R(A, u_top), R — гладкий
    // остаток; он — в таблице uJL (64 × 32: ln A от ln 0,05 до ln 500, u от 0 до 1 − 1/r_c; билинейно по узлам; ошибка ≤ 0,1 % против 5 узлов
    // Гаусса — Лежандра, которыми таблица и посчитана). Автор: «давай ускоряй яркость»
    const float JLA0 = -2.9957323, JLA1 = 6.2146081;
    vec4 colJ4(float e0, float A, float rtop) { float rt = min(rtop, uRc); A = max(A, 1e-3); if (e0 <= 0.0 || rt <= 1.0) return vec4(0.0);
      float um = 1.0 - 1.0 / rt, wm = (1.0 - exp(-A * um)) / A; ivec2 ts = textureSize(uJL, 0);
      vec2 x = vec2(clamp((log(A) - JLA0) / (JLA1 - JLA0), 0.0, 1.0) * float(ts.x - 1), clamp(um / (1.0 - 1.0 / uRc), 0.0, 1.0) * float(ts.y - 1));
      ivec2 i0 = min(ivec2(floor(x)), ts - 2); vec2 f = x - vec2(i0);
      vec4 a = mix(texelFetch(uJL, i0, 0), texelFetch(uJL, i0 + ivec2(1, 0), 0), f.x), b = mix(texelFetch(uJL, i0 + ivec2(0, 1), 0), texelFetch(uJL, i0 + ivec2(1, 1), 0), f.x);
      return e0 * wm * mix(a, b, f.y); }
    // отсчёт k: fn — нагрев у собственного основания (считается один раз на прежнюю и новую форму)
    vec4 briAt(float fn, vec2 g) { if (g.x < -1.5) return vec4(0.0);
      float T = 0.0, pb = 0.0, rt = uRmax;
      if (g.x >= 0.0) {   // замкнутая: петля RTV, нагрев — среднее по основаниям; x = ((F/9,8·10⁴)·L)^(2/7): p = x³/L, T = 1400·x (то же, что прежде, одним pow)
        float lq = floor(g.y / 4096.0), rq = g.y - lq * 4096.0, L = exp(LQ0 + (LQ1 - LQ0) * lq / 4095.0) * uRcm, F = 0.5 * (fn + fh(octUnpack(g.x)));
        rt = 1.0 + (uRc - 1.0) * rq / 4095.0;
        if (F > 0.0 && L > 0.0) { float x = pow(F / 9.8e4 * L, 2.0 / 7.0); pb = x * x * x / L; T = clamp(1400.0 * x, 3e5, 2e7); } }
      else { T = uTopen; pb = uNopen * KB * T * 2.3 / 1.2; }   // открытая: T и n у основания
      if (T <= 0.0 || pb <= 0.0) return vec4(0.0);
      float n9 = (1.2 / 2.3) * pb / (KB * T) / 1e9; return colJ4(n9 * n9 * resp174(T), 2.0 * MU * MP * uGM / (KB * T * uRcm), rt); }
    ivec2 stor(ivec2 q) { ivec2 h = ivec2(int(uSW), int(uSH)) / 2; return ivec2((q.x & 1) * h.x + (q.x >> 1), (q.y & 1) * h.y + (q.y >> 1)); }   // форма — по фазам (см. SGEO_FS)
    // форма плитки сменяется не скачком (автор: «дергается все»): яркость — смесь по прежней и новой форме, доля новой w растёт от 0 до 1 за
    // промежуток между двумя последними обновлениями плитки — форма едет непрерывно, отставая на этот промежуток (видимое — ≈ 4 кадра)
    // яркость — только плитки, которым она нужна (видимое полушарие, где сменились нагрев или форма); остальные — прежняя (uVis 16×16)
    void main() { vec2 ij = floor(gl_FragCoord.xy); if (texelFetch(uVis, ivec2(ij * vec2(textureSize(uVis, 0)) / vec2(uSW, uSH)), 0).r < 0.5) discard; ivec2 ms = textureSize(uTW, 0) / 2, q = ivec2(ij); float w = texelFetch(uTW, ivec2(ij * vec2(ms) / vec2(uSW, uSH)) * 2 + ivec2(q.x & 1, q.y & 1), 0).r;
      // нагрев у собственного основания — прямо по координатам текстуры (без перевода в направление и обратно) и только у замкнутых (разбор Codex)
      // три последние формы ячейки (автор: «стало ещё лучше — но не до конца»: с двумя формами обновление, пришедшее на кадр позже запаздывания,
      // давало остановку и рывок вдогонку); w — положение момента «сейчас − LAG»: [0, 1) — между P2 и P, [1, 2) — между P и S, 2 — S
      ivec2 sq = stor(ivec2(ij)); vec4 g = w >= 1.0 ? texelFetch(uSG, sq, 0) : vec4(-2.0), gp = w < 2.0 ? texelFetch(uSGP, sq, 0) : vec4(-2.0), g2 = w < 1.0 ? texelFetch(uSGP2, sq, 0) : vec4(-2.0);
      vec2 tsz = vec2(uSW, uSH); float f0 = g.x >= 0.0 || gp.x >= 0.0 || g2.x >= 0.0 ? fhUV((ij + spAt(ij, 0)) / tsz) : 0.0, f1 = uK > 1.5 && (g.z >= 0.0 || gp.z >= 0.0 || g2.z >= 0.0) ? fhUV((ij + spAt(ij, 1)) / tsz) : 0.0;
      vec4 JS = w >= 1.0 ? (uK > 1.5 ? 0.5 * (briAt(f0, g.xy) + briAt(f1, g.zw)) : briAt(f0, g.xy)) : vec4(0.0),
           JP = w < 2.0 ? (uK > 1.5 ? 0.5 * (briAt(f0, gp.xy) + briAt(f1, gp.zw)) : briAt(f0, gp.xy)) : vec4(0.0),
           J2 = w < 1.0 ? (uK > 1.5 ? 0.5 * (briAt(f0, g2.xy) + briAt(f1, g2.zw)) : briAt(f0, g2.xy)) : vec4(0.0);
      vec4 J = w >= 2.0 ? JS : w >= 1.0 ? mix(JP, JS, w - 1.0) : mix(J2, JP, w);
      o0 = J; }`;
  // копия прежней формы выбранных плиток (перед их перетрассировкой)

  // ---- трубки (этап 3 плана; автор: «ещё есть артефакты — давай трубки»; разбор Codex): корона из силовых трубок с постоянными номерами.
  // Основания — выборка по магнитному потоку (замкнутые — с положительной полярности, открытые — и с отрицательной), привязаны к полюсам и
  // едут с ними; линия трассируется каждый кадр (длина — одним проходом, 64 точки — по колонке за проход, каждая от предыдущей: на трубку —
  // две трассировки); газ — RTV по живому нагреву у обоих оснований, равновесие под тяжестью; трубка — отрезки конечных цилиндров сечением
  // a = √(Φᵢ/π|B|), яркость пикселя — свечение × путь луча в цилиндре (у края диска путь длиннее — лимб сам), сумма — в линейном буфере
  const TLEN_FS = BAKE_HEAD + OCT_GLSL + `
    uniform sampler2D uSeed;
    void main() { int i = int(gl_FragCoord.y); vec4 sd = texelFetch(uSeed, ivec2(0, i), 0); if (sd.w <= 0.0) { o0 = vec4(0.0, 0.0, 0.0, 1.0); return; }
      vec3 n = normalize(sd.xyz), x0 = n * 1.002; float sg = dot(field(x0), n) >= 0.0 ? 1.0 : -1.0, c, rt; vec4 E = trace(x0, sg, c, rt);
      o0 = vec4(E.w, c, octPack(normalize(E.xyz)), sg); }`;   // длина линии (R★), код конца (1 — поверхность, 2 — открытая), второе основание, знак хода
  const TPT_FS = BAKE_HEAD + `
    uniform sampler2D uSeed, uLen, uPrev; uniform float uJ, uMt;
    // ход вдоль поля на длину dist от x (тот же шаг, что в trace); остановка у поверхности, у поверхности источника, в нуле поля
    vec3 walk(vec3 x, float sg, float dist) { float len = 0.0;
      for (int k = 0; k < 600; k++) { if (len >= dist) break; float r = length(x), dm; vec3 b1 = fieldS(x, dm); float m1 = length(b1); if (m1 < uBmin) break;
        float h = min(clamp(min(0.25 * dm, (r - 1.0) + 0.006), 0.0025, 0.06), dist - len);
        float dm2; vec3 xm = x + 0.5 * h * sg * b1 / m1, b2 = fieldS(xm, dm2); float m2 = length(b2); if (m2 < uBmin) break;
        vec3 xn = x + h * sg * b2 / m2; float rn = length(xn); if (rn <= 1.0) { x = xn / rn; break; } if (rn >= uRmax) { x = xn / rn * uRmax; break; } x = xn; len += h; }
      return x; }
    void main() { int i = int(gl_FragCoord.y); vec4 sd = texelFetch(uSeed, ivec2(0, i), 0), L = texelFetch(uLen, ivec2(0, i), 0); vec3 x;
      if (uJ < 0.5) x = normalize(sd.xyz) * 1.002; else { x = texelFetch(uPrev, ivec2(int(uJ) - 1, i), 0).xyz; if (sd.w > 0.0 && L.x > 0.0) x = walk(x, L.w, L.x / (uMt - 1.0)); }
      o0 = vec4(x, length(field(x))); }`;   // точка j и |B| в ней
  const TGAS_FS = BAKE_HEAD + OCT_GLSL + `
    uniform sampler2D uSeed, uLen;
    void main() { int i = int(gl_FragCoord.y); vec4 sd = texelFetch(uSeed, ivec2(0, i), 0), L = texelFetch(uLen, ivec2(0, i), 0); float T = 0.0, pb = 0.0;
      // замкнутая — только с положительного основания (с отрицательного она уже посчитана: каждая петля — один раз, разбор Codex)
      if (sd.w > 0.0 && L.y == 1.0 && L.w > 0.0) { float F = 0.5 * (fh(normalize(sd.xyz)) + fh(octUnpack(L.z))), Lh = 0.5 * (L.x + 0.004) * uRcm;   // замкнутая: RTV (одним pow)
        if (F > 0.0 && Lh > 0.0) { float x = pow(F / 9.8e4 * Lh, 2.0 / 7.0); pb = x * x * x / Lh; T = clamp(1400.0 * x, 3e5, 2e7); } }
      else if (sd.w > 0.0 && L.y == 2.0) { T = uTopen; pb = uNopen * KB * T * 2.3 / 1.2; }   // открытая: T и n у основания
      o0 = vec4(T, pb, L.y, sd.w); }`;   // T, давление у основания, тип, поток трубки (с проявлением)
  // свет трубки на единицу потока: Σ n²·R174(T)·Δs/|B| вдоль линии (сечение ∝ Φ/|B|; RTV — равновесие под тяжестью от давления у основания)
  const TLUM_FS = BAKE_HEAD + `
    uniform sampler2D uPA, uPB, uTG; uniform float uMt, uShowR, uH0;
    void main() { int i = int(gl_FragCoord.y), M = int(uMt); vec4 g = texelFetch(uTG, ivec2(0, i), 0); float T = g.x, pb = g.y, lam = 0.0;
      if (T > 0.0 && pb > 0.0) { float A = MU * MP * uGM / (KB * T * uRcm), z = (log(T) / log(10.0) - 5.95) / 0.12, rs = exp(-0.5 * z * z); vec4 a = texelFetch(uPA, ivec2(0, i), 0);
        for (int j = 1; j < 64; j++) { if (j >= M) break; vec4 b = (j % 2 == 0) ? texelFetch(uPA, ivec2(j, i), 0) : texelFetch(uPB, ivec2(j, i), 0);
          // как в отрисовке (разбор Codex): сечение — усечённый конус (среднее 1/B по нему — (1/Ba + 1/√(Ba·Bb) + 1/Bb)/3), поле не меньше 10⁻³,
          // отрезок виден, если его начало ниже uShowR; нижняя часть погашена от uH0 до 2·uH0 (там свет — у текстуры)
          float ds = distance(a.xyz, b.xyz), r = 0.5 * (length(a.xyz) + length(b.xyz)), Ba = max(a.w, 1e-3), Bb = max(b.w, 1e-3), ib = (1.0 / Ba + inversesqrt(Ba * Bb) + 1.0 / Bb) / 3.0;
          if (ds > 1e-7 && length(a.xyz) <= uShowR && a.w > 0.0 && b.w > 0.0) { float n9 = (1.2 / 2.3) * pb * exp(-A * (1.0 - 1.0 / max(r, 1.0))) / (KB * T) / 1e9; lam += n9 * n9 * rs * ds * ib * smoothstep(uH0, 2.0 * uH0, r - 1.0); }
          a = b; } }
      o0 = vec4(lam, 0.0, 0.0, 0.0); }`;
  // магнитный ковёр (автор: «надо от неё плясать» — от Солнца: на снимках SDO 17,1 нм весь спокойный диск светится пятнистой сетью; «попробуй
  // подобрать ковёр»): подсеточный слой коротких петель между мелкими разнополярными элементами на границах ячеек супергрануляции. Над
  // спокойной поверхностью крупное поле даёт длинные петли — по RTV 2–3 МК и редкий газ, в 17,1 нм они тёмные; петли ковра короткие (0,03 R★
  // ≈ 20 тыс. км у Солнца) — ≈ 1 МК и плотные. Нагрев — местный (карта нагрева) × узор сети (среднее 1); газ — RTV на полудлине; свечение у
  // основания ε₀ = n²·R174(T), высота слоя — меньшая из высоты петли (L/π) и половины шкалы высот (свечение ∝ n²)
  const CARP_FS = BAKE_HEAD + `
    uniform sampler2D uNet; uniform float uCW, uCH, uCL, uNetK, uXL, uXNu;
    void main() { vec2 ij = gl_FragCoord.xy; float ph = 2.0 * PI * ij.x / uCW, th = PI * ij.y / uCH; vec3 n = vec3(sin(th) * cos(ph), cos(th), sin(th) * sin(ph));
      float F0 = max(fh(n), 0.0), N = texture(uNet, vec2(ij.x / uCW, ij.y / uCH)).r * uNetK, F = F0 * N, Lh = 0.5 * uCL * uRcm, e0 = 0.0, He = 1e-4, eX = 0.0, HX = 1e-4;
      if (F > 0.0) { float x = pow(F / 9.8e4 * Lh, 2.0 / 7.0), T = clamp(1400.0 * x, 1e5, 2e7), p = x * x * x / Lh, n9 = (1.2 / 2.3) * p / (KB * T) / 1e9;
        e0 = n9 * n9 * resp174(T); He = max(1e-4, min(uCL / PI, 0.5 * KB * T * uRcm / (MU * MP * uGM))); }
      // протяжённая спокойная корона (автор: «давай корону над краем доводить до SDO»): петли длиной uXL при местном нагреве (без узора сети) —
      // T по RTV; плотность — RTV × uXNu: наблюдаемые тёплые петли плотнее равновесия RTV (Aschwanden et al. 2001; Winebarger et al. 2003) —
      // эмпирическая поправка, подобрана по профилю над краем на снимке SDO/AIA 171; шкала высот свечения — половина гидростатической
      if (F0 > 0.0 && uXNu > 0.0) { float Lx = 0.5 * uXL * uRcm, x = pow(F0 / 9.8e4 * Lx, 2.0 / 7.0), T = clamp(1400.0 * x, 1e5, 2e7), p = x * x * x / Lx, n9 = uXNu * (1.2 / 2.3) * p / (KB * T) / 1e9;
        eX = n9 * n9 * resp174(T); HX = max(1e-3, 0.5 * KB * T * uRcm / (MU * MP * uGM)); }
      o0 = vec4(e0, He, eX, HX); }`;   // ковёр: свечение у основания и высота слоя; протяжённая корона: то же
  // мох — переходный слой у оснований горячих петель (автор: «давай активные области»): ядра активных областей — 2–4 МК, в 17,1 нм тусклые;
  // ярок их переходный слой, где температура проходит через ≈ 1 МК при высоком давлении. Тепло проводится вниз: κ₀T^{5/2}·dT/ds = F_c ≈ F,
  // поэтому столб n_e²·ds = (n_e·T)²·κ₀·T^{1/2}/F·dT; свёртка с откликом R174 (гауссиана по lg T) — ln10·T₀^{3/2}·1,09·σ√(2π) ≈ 6,35·10⁸,
  // до 0,7·T_max (выше — корона петли, её считает своя часть); давление — RTV петли длиной uXL при местном нагреве
  const MOSS_FS = BAKE_HEAD + `
    uniform sampler2D uNet; uniform float uCW, uCH, uXL, uNetK;
    float ncdf(float z) { return 0.5 * (1.0 + tanh(0.7978845608 * (z + 0.044715 * z * z * z))); }
    void main() { vec2 ij = gl_FragCoord.xy; float ph = 2.0 * PI * ij.x / uCW, th = PI * ij.y / uCH; vec3 n = vec3(sin(th) * cos(ph), cos(th), sin(th) * sin(ph));
      float N = texture(uNet, vec2(ij.x / uCW, ij.y / uCH)).r * uNetK, F = max(fh(n), 0.0) * sqrt(max(N, 0.0)), I = 0.0;
      if (F > 0.0) { float Lh = 0.5 * uXL * uRcm, x = pow(F / 9.8e4 * Lh, 2.0 / 7.0), Tm = 1400.0 * x, p = x * x * x / Lh, pk = (1.2 / 2.3) * p / KB;
        I = pk * pk * 1e-6 / F * 6.35e8 * ncdf((log(0.7 * Tm) / log(10.0) - 6.0) / 0.12) / (1e18 * uRcm); }
      o0 = vec4(I, 0.0, 0.0, 0.0); }`;   // столб мха по вертикали, в единицах n₉²·R★
  const TUBE_VS = `precision highp float; precision highp sampler2D;
    in vec2 corner; uniform sampler2D uPA, uPB, uGas, uHP, uHT; uniform int uMt; uniform mat4 uView, uProj; uniform vec3 uCam; uniform float uRcm, uShowR, uFill, uPx;
    out vec3 vW, vP0, vP1, vN0, vN1; out float vRa, vRb, vT, vPb, vJa, vJb, vHb, vGate, vSc; flat out int vOk;
    vec4 pt(int j, int i) { return (j % 2 == 0) ? texelFetch(uPA, ivec2(j, i), 0) : texelFetch(uPB, ivec2(j, i), 0); }
    void main() { int i = gl_InstanceID / (uMt - 1), j = gl_InstanceID - i * (uMt - 1); vec4 a = pt(j, i), b = pt(j + 1, i), g = texelFetch(uGas, ivec2(0, i), 0);
      vOk = 0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vT = g.x; vPb = g.y;
      // газодинамика (этап 3, второй шаг): место профиля трубки и доля смешения с RTV — по таблице; свечение 174 Å в точках j и j + 1
      vec4 ht = texelFetch(uHT, ivec2(0, i), 0); int sl = int(ht.x + 0.5) - 1; vHb = sl >= 0 ? clamp(ht.y, 0.0, 1.0) : 0.0; vJa = 0.0; vJb = 0.0;
      if (vHb > 0.0) { vJa = texelFetch(uHP, ivec2(j, sl), 0).w; vJb = texelFetch(uHP, ivec2(j + 1, sl), 0).w; }
      // RTV без решения (T, p ≤ 0) — трубка видна только газодинамикой (разбор Codex: годность профиля не зависит от RTV)
      bool rtv = g.x > 0.0 && g.y > 0.0; if (!rtv) vPb = 0.0;
      // только яркие трубки (автор: «и трубки только яркие оставим»): вес показа — третий канал таблицы; тусклые не рисуются вовсе
      vGate = ht.z; if (vGate <= 0.001 || g.w <= 0.0 || (!rtv && vHb <= 0.0) || length(a.xyz) > uShowR || distance(a.xyz, b.xyz) < 1e-7) return;
      // коэффициент заполнения f (автор: «давай трубки»; толстые трубки ложились слоями): газ светит в нити радиусом √f от сечения трубки
      // с плотностью в 1/√f больше (свет трубки ∝ ε·путь·ширина — сохраняется)
      float ra = sqrt(uFill * g.w / (3.14159265 * max(a.w, 1e-3))) / uRcm, rb = sqrt(uFill * g.w / (3.14159265 * max(b.w, 1e-3))) / uRcm; vRa = ra; vRb = rb;
      // запас 1,6 радиуса: торец по биссектрисе выступает за отрезок
      vec3 P0 = a.xyz, P1 = b.xyz, M = 0.5 * (P0 + P1), v = normalize(M - uCam), ax = P1 - P0, axp = ax - dot(ax, v) * v; float lp = length(axp);
      // нить тоньше пикселя (автор: «надо трубок сильно больше», «и тоньше») рисуется шириной в пиксель со светом × (r/r_эфф)² — свет отрезка тот же,
      // без пропаданий и мерцания при растре
      { float pr = 0.6 * length(M - uCam) * uPx, rae = max(ra, pr), rbe = max(rb, pr); vSc = 0.5 * (ra * ra / (rae * rae) + rb * rb / (rbe * rbe)); ra = rae; rb = rbe; vRa = ra; vRb = rb; }
      vec3 ud = lp > 1e-7 ? axp / lp : normalize(cross(v, abs(v.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))), sd = normalize(cross(v, ud));
      // торцы — по биссектрисам углов с соседними отрезками (трубка делится на отрезки без перекрытий и щелей: прежде плоские торцы давали
      // на изгибах яркие «бусины» и тёмные зазоры); повторные точки и разворот назад — без деления на ноль (разбор Codex)
      vec3 u = normalize(ax), dp = j > 0 ? P0 - pt(j - 1, i).xyz : vec3(0.0), dn = j + 2 < uMt ? pt(j + 2, i).xyz - P1 : vec3(0.0);
      vec3 up = length(dp) > 1e-7 ? normalize(dp) : u, un = length(dn) > 1e-7 ? normalize(dn) : u, s0 = up + u, s1 = u + un;
      vN0 = length(s0) > 1e-6 ? normalize(s0) : u; vN1 = length(s1) > 1e-6 ? normalize(s1) : u;
      // прямоугольник к камере, с запасом: проекция отрезка и торцов (торец по биссектрисе выступает на r·tg(излом/2))
      float c0 = clamp(dot(up, u), -0.99, 1.0), c1 = clamp(dot(u, un), -0.99, 1.0), ex = max(sqrt((1.0 - c0) / (1.0 + c0)), sqrt((1.0 - c1) / (1.0 + c1)));
      float rr = max(ra, rb) * (1.2 + min(8.0, ex));
      vec3 W = M + ud * (corner.x * (0.5 * lp + rr)) + sd * (corner.y * rr);
      vW = W; vP0 = P0; vP1 = P1; vOk = 1; gl_Position = uProj * uView * vec4(W, 1.0); }`;
  const TUBE_FS = `precision highp float;
    layout(location = 0) out vec4 o0; in vec3 vW, vP0, vP1, vN0, vN1; in float vRa, vRb, vT, vPb, vJa, vJb, vHb, vGate, vSc; flat in int vOk; uniform vec3 uCam; uniform float uGM, uRcm, uFill, uH0;
    const float KB = ${KB.toExponential(6)}, MP = ${MP.toExponential(6)}, MU = ${MU.toFixed(6)};
    float resp174(float T) { float z = (log(T) / log(10.0) - 5.95) / 0.12; return exp(-0.5 * z * z); }
    void main() { if (vOk == 0) discard; vec3 d = normalize(vW - uCam), ax = vP1 - vP0; float L = length(ax); vec3 u = ax / L;
      // начало луча — у отрезка (разбор Codex: камера в 6 R★, радиус нити ~10⁻³ — коэффициенты от камеры теряли точность float, хорда
      // выходила нулевой); s — параметр от этого начала
      float tc = dot(0.5 * (vP0 + vP1) - uCam, d); vec3 o = uCam + tc * d, w = o - vP0; float t0 = -1e9, t1 = 1e9;
      // между плоскостями торцов: (x − P0)·N0 ≥ 0 и (x − P1)·N1 ≤ 0
      { float a0 = dot(d, vN0), b0 = dot(w, vN0); if (abs(a0) > 1e-9) { float tq = -b0 / a0; if (a0 > 0.0) t0 = max(t0, tq); else t1 = min(t1, tq); } else if (b0 < 0.0) discard;
        float a1 = dot(d, vN1), b1 = dot(o - vP1, vN1); if (abs(a1) > 1e-9) { float tq = -b1 / a1; if (a1 < 0.0) t0 = max(t0, tq); else t1 = min(t1, tq); } else if (b1 > 0.0) discard; }
      t0 = max(t0, -tc);   // перед камерой
      // луч ∩ усечённый конус: радиус линейно от vRa у P0 до vRb у P1, |x⊥|² = (vRa + k·s)², s — координата вдоль оси (разбор Codex: прежде —
      // цилиндр с радиусом в точке наибольшего сближения луча с осью, хорда зависела от направления взгляда); корни — устойчивой формулой;
      // при qa < 0 из двух кусков — тот, что у начала отрезка луча; второй лист конуса (радиус < 0) — отброшен
      float k = (vRb - vRa) / L, du = dot(d, u), wu = dot(w, u), rw = vRa + k * wu;
      float qa = 1.0 - du * du - k * k * du * du, qb = 2.0 * (dot(w, d) - wu * du - k * du * rw), qc = dot(w, w) - wu * wu - rw * rw;
      // лист конуса с радиусом ≥ 0 — до выбора куска (разбор Codex: прежде проверка после — при сильном изломе отбрасывала и допустимую хорду)
      { float kd = k * du; if (abs(kd) > 1e-12) { float tq = -rw / kd; if (kd > 0.0) t0 = max(t0, tq); else t1 = min(t1, tq); } else if (rw < 0.0) discard; }
      if (abs(qa) > 1e-9) { float ds = qb * qb - 4.0 * qa * qc;
        if (ds > 0.0) { float q = -0.5 * (qb + (qb >= 0.0 ? 1.0 : -1.0) * sqrt(ds)), r1 = q / qa, r2 = abs(q) > 1e-30 ? qc / q : r1, lo = min(r1, r2), hi = max(r1, r2);
          if (qa > 0.0) { t0 = max(t0, lo); t1 = min(t1, hi); } else if (t0 < lo) t1 = min(t1, lo); else t0 = max(t0, hi); }
        else if (qa > 0.0) discard; }
      else if (abs(qb) > 1e-12) { float tq = -qc / qb; if (qb > 0.0) t1 = min(t1, tq); else t0 = max(t0, tq); } else if (qc > 0.0) discard;
      // за диском звезды — не видно (в параметре от начала у отрезка)
      float bb = dot(uCam, d), hh = bb * bb - dot(uCam, uCam) + 1.0; if (hh > 0.0) { float ts = -bb - sqrt(hh); if (ts > 0.0) t1 = min(t1, ts - tc); }
      if (t1 <= t0) discard;
      // свечение: RTV — равновесие под тяжестью от давления у основания; газодинамика — линейно между точками профиля (интеграл по хорде —
      // значение в её середине); смешение — по свечению (разбор Codex: не по n, T — отклик и n² нелинейны)
      vec3 xm = o + 0.5 * (t0 + t1) * d; float sm = clamp(dot(xm - vP0, u) / L, 0.0, 1.0), eR = 0.0;
      if (vPb > 0.0) { float r = length(xm), aa = MU * MP * uGM / (KB * vT * uRcm) * (1.0 - 1.0 / max(r, 1.0)), n9 = (1.2 / 2.3) * vPb * exp(-aa) / (KB * vT) / 1e9; eR = n9 * n9 * resp174(vT); }
      // плотность в нити — в 1/√f больше: ε — в 1/f; яркость — свечение × путь (R★), линейно
      // нижняя часть трубки погашена плавно от uH0 до 2·uH0 над поверхностью: основание короны показывает текстура (там же были толстые
      // яркие низкие петли — автор: «появляются иногда очень толстые трубки»)
      float hw = smoothstep(uH0, 2.0 * uH0, length(xm) - 1.0);
      o0 = vec4(vSc * vGate * hw * mix(eR, mix(vJa, vJb, sm), vHb) / uFill * (t1 - t0), 0.0, 0.0, 0.0); }`;
  const GCOPY_FS = `precision highp float; precision highp sampler2D; layout(location = 0) out vec4 o0; uniform sampler2D uSG, uMask; uniform float uSW, uSH;
    // плитка выбрана? значение маски: 0 — нет, 60·(фаза + 1) — только ячейки этой фазы 2×2, 255 — все ячейки (сборка)
    // форма хранится по фазам: четверть текстуры на фазу 2×2 (ячейки одной фазы — рядом: группы потоков видеокарты считают целиком; при
    // шахматной выборке в каждой группе считал бы лишь каждый четвёртый — вчетверо дороже)
    ivec2 stor(ivec2 q) { ivec2 h = ivec2(int(uSW), int(uSH)) / 2; return ivec2((q.x & 1) * h.x + (q.x >> 1), (q.y & 1) * h.y + (q.y >> 1)); }
    ivec2 texelOf(ivec2 s) { ivec2 h = ivec2(int(uSW), int(uSH)) / 2, p = ivec2(s.x >= h.x ? 1 : 0, s.y >= h.y ? 1 : 0); return 2 * (s - p * h) + p; }
    bool picked(ivec2 q) { ivec2 ms = textureSize(uMask, 0); float mv = texelFetch(uMask, ivec2(vec2(q) * vec2(ms) / vec2(uSW, uSH)), 0).r * 255.0;
      if (mv < 30.0) return false; if (mv > 250.0) return true; return (q.x & 1) + 2 * (q.y & 1) == int(floor(mv / 60.0 + 0.5)) - 1; }
    void main() { ivec2 s = ivec2(floor(gl_FragCoord.xy)); if (!picked(texelOf(s))) discard;
      o0 = texelFetch(uSG, s, 0); }`;
  const GRID_FS = `precision highp float; precision highp int;
    layout(location = 0) out vec4 o0;
    uniform float uGL, uGNp, uGNt, uGNr, uRmax;
    ${FIELD_GLSL}
    const float PI = 3.14159265359;
    void main() { vec2 ij = floor(gl_FragCoord.xy); float ph = 2.0 * PI * (ij.x + 0.5) / uGNp, th = PI * (ij.y + 0.5) / uGNt, r = exp(log(uRmax) * (uGL + 0.5) / uGNr);
      float dm; vec3 b = fieldD(r * vec3(sin(th) * cos(ph), cos(th), sin(th) * sin(ph)), dm); o0 = vec4(b, dm); }`;
  // карта нагрева оснований на видеокарте (автор: «ужасно выглядят пиксели — надо текстуру на шар считать на карте»; разбор Codex, вариант A):
  // те же формулы, что derive() в surface-state.js, — но в точке поверхности, а не средним по ячейке 128×64 (≈ 5 000 км: квадраты в короне):
  // f_res = |B_r|/B_conc, U — тени (объединение дисков площадью |q|·Φ₀·фаза/B_s; край — сглажен на ячейку), ковёр B_carpet·(1 − U),
  // f = min(1, f_res + ковёр/B_conc), F_raw = B_conc²·v·tgθ/4π·[(f − min(f_res, U)) + s_u·min(f_res, U)], нагрев короны = η_H·ε·F_raw
  // (стационарный — как и прежде; импульсы в корону не передавались)
  const HEAT_FS = `precision highp float; precision highp int;
    layout(location = 0) out vec4 o0;
    uniform float uW, uH, uBconc, uCarpet, uDrv, uSu, uEtaEps; uniform vec4 uSp[64]; uniform float uSpC[64]; uniform int uNS;
    ${FIELD_GLSL}
    const float PI = 3.14159265359;
    void main() { vec2 ij = gl_FragCoord.xy; float ph = 2.0 * PI * ij.x / uW, th = PI * ij.y / uH;
      vec3 n = vec3(sin(th) * cos(ph), cos(th), sin(th) * sin(ph));
      float fRes = abs(dot(field(n), n)) / uBconc;
      // тени (автор: «рваные края», «убирай мерцание»; разбор Codex): покрытие ячейки — точно по φ (хорда тени на сфере ∩ ячейка, с периодическими
      // копиями ячейки) и 12 полосами по θ — только по широтам самой тени ∩ ячейка: площадь сохраняется на 99,8–101,1 % при любом радиусе (0,01…3
      // ячейки) и положении, у полюса тоже (прежде 64–107 %: пока пятно ползло по сетке, нагрев его петель «дышал»; полосы по всей ячейке
      // пропускали тени мельче шага). Малые углы — через гаверсинусы (1 − cos r во float теряет до 12 %). Объединение — 1 − Π(1 − cᵢ)
      float j0 = floor(ij.y), i0 = floor(ij.x), th0 = PI * j0 / uH, dph = 2.0 * PI / uW, aCell = dph * (cos(th0) - cos(PI * (j0 + 1.0) / uH)), dTh = PI / uH, keep = 1.0;
      for (int i = 0; i < 64; i++) { if (i >= uNS) break; vec3 sc = uSp[i].xyz; float rU = uSp[i].w; if (rU <= 0.0) continue;
        if (dot(n, sc) < uSpC[i]) continue;   // дальше полутора ячеек от края тени — не касается (косинус — готовый, без acos на ячейку)
        float ts = atan(length(sc.xz), sc.y), ta = max(th0, ts - rU), tb = min(th0 + dTh, ts + rU); if (ta >= tb) continue;
        float ps = atan(sc.z, sc.x), hr = sin(0.5 * rU), acc = 0.0, sts = max(sin(ts), 1e-12), dc = (i0 + 0.5) * dph - ps; dc -= 2.0 * PI * floor(dc / (2.0 * PI) + 0.5);
        hr *= hr;   // гаверсинус радиуса; площадь тени 4π·hav(r)
        for (int k = 0; k < 12; k++) { float th = ta + (float(k) + 0.5) * (tb - ta) / 12.0, sw = sin(th), st = max(sw, 1e-12), hd = sin(0.5 * (th - ts));   // вес площади — настоящий sin θ (ограничитель у полюса завышал шапку втрое)
          // полуширина хорды по долготе: hav(Δφ) = (hav r − hav Δθ)/(sin θ sin θₛ)
          float hp = (hr - hd * hd) / (st * sts); if (hp <= 0.0) continue; float hwp = hp >= 1.0 ? PI : 2.0 * asin(sqrt(hp));
          float ov = hp >= 1.0 ? dph : max(0.0, min(dc + 0.5 * dph, hwp) - max(dc - 0.5 * dph, -hwp)) + max(0.0, min(dc - 2.0 * PI + 0.5 * dph, hwp) - max(dc - 2.0 * PI - 0.5 * dph, -hwp))
            + max(0.0, min(dc + 2.0 * PI + 0.5 * dph, hwp) - max(dc + 2.0 * PI - 0.5 * dph, -hwp));
          acc += ov * sw; }
        float c = acc * (tb - ta) / 12.0 / aCell;
        keep *= 1.0 - clamp(c, 0.0, 1.0); }   // перекрытие теней — как независимых (приближение: точное объединение потребовало бы интервалов по полосам)
      float U = 1.0 - keep;
      float fUd = min(fRes, U), f = min(1.0, fRes + uCarpet * (1.0 - U) / uBconc);
      o0 = vec4(uEtaEps * uBconc * uBconc * uDrv / (4.0 * PI) * ((f - fUd) + uSu * fUd), U, fRes, 1.0); }`;
  const RAY_VS = `out vec2 vNdc; void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  // луч в половинном разрешении (автор: «луч в половинном разрешении») — растяжка на экран билинейно (цвет предумножен — смешивается верно)
  const UP_FS = `precision highp float; precision highp sampler2D; layout(location = 0) out vec4 o0; in vec2 vNdc; uniform sampler2D uT;
    void main() { o0 = texture(uT, vNdc * 0.5 + 0.5); }`;
  const RAY_FS = `precision highp float; precision highp sampler3D; precision highp sampler2D;
    layout(location = 0) out vec4 o0;
    in vec2 vNdc;
    uniform sampler3D uVol, uVolB; uniform sampler2D uHist, uHistD, uDW, uTA; uniform sampler2D uCarp, uMoss; uniform float uCarpOn, uMossH; uniform float uTubes, uTW0, uTW1, uTK, uTRamp, uFurDisk, uFurLo, uFurHi; uniform float uDOn; uniform float uMix, uRc, uMuA, uMuB, uSurfOn, uGas; uniform mat3 uCamRot; uniform vec3 uCam; uniform float uTanH, uAspect, uRmin, uRmax, uI0, uIw, uW, uRaw, uSteps, uFur, uFurK1, uFurK2, uFurSig, uFurNorm, uFurStep, uTime;
    const float PI = 3.14159265359;
    vec3 uvw(vec3 p) { float r = length(p); return vec3(fract(atan(p.z, p.x) / (2.0 * PI) + 1.0), acos(clamp(p.y / r, -1.0, 1.0)) / PI, log(r / uRmin) / log(uRmax / uRmin)); }
    bool sphere(vec3 o, vec3 d, float R, out vec2 t) { float b = dot(o, d), c = dot(o, o) - R * R, h = b * b - c; if (h < 0.0) return false; h = sqrt(h); t = vec2(-b - h, -b + h); return true; }
    // золотая палитра канала 17,4 нм (как у снимков EUI): чёрный → бурый → оранжевый → золото → бледно-жёлтый
    vec3 gold(float x) { vec3 c = mix(vec3(0.0), vec3(0.28, 0.12, 0.02), smoothstep(0.0, 0.25, x)); c = mix(c, vec3(0.85, 0.45, 0.07), smoothstep(0.2, 0.55, x));
      c = mix(c, vec3(1.0, 0.78, 0.30), smoothstep(0.5, 0.8, x)); return mix(c, vec3(1.0, 0.96, 0.82), smoothstep(0.8, 1.0, x)); }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    // нижний слой в точке uv при наклоне μ: B-сплайн по 16 соседним точкам живой текстуры (J линейна — смешиваются сами яркости, поток
    // сохраняется), по наклону — кубическая интерполяция μ·J по узлам 1; 0,75; 0,5; 0,25 (ошибка ≤ 1 % против прямого счёта)
    float colJh(sampler2D uHist, vec2 uv, float mu) { ivec2 sz = textureSize(uHist, 0); vec2 x = uv * vec2(sz) - 0.5, f = fract(x); ivec2 i0 = ivec2(floor(x)) - 1;
      vec4 wx = vec4((1.0 - f.x) * (1.0 - f.x) * (1.0 - f.x), 3.0 * f.x * f.x * f.x - 6.0 * f.x * f.x + 4.0, -3.0 * f.x * f.x * f.x + 3.0 * f.x * f.x + 3.0 * f.x + 1.0, f.x * f.x * f.x) / 6.0;
      vec4 wy = vec4((1.0 - f.y) * (1.0 - f.y) * (1.0 - f.y), 3.0 * f.y * f.y * f.y - 6.0 * f.y * f.y + 4.0, -3.0 * f.y * f.y * f.y + 3.0 * f.y * f.y + 3.0 * f.y + 1.0, f.y * f.y * f.y) / 6.0;
      vec4 S = vec4(0.0);
      for (int b = 0; b < 4; b++) { int jj = clamp(i0.y + b, 0, sz.y - 1);
        for (int a = 0; a < 4; a++) { int ii = (i0.x + a) % sz.x; if (ii < 0) ii += sz.x; S += wx[a] * wy[b] * texelFetch(uHist, ivec2(ii, jj), 0); } }
      float m = clamp(mu, 0.25, 1.0); const vec4 N = vec4(1.0, 0.75, 0.5, 0.25);
      vec4 l = vec4((m - N.y) * (m - N.z) * (m - N.w) / ((N.x - N.y) * (N.x - N.z) * (N.x - N.w)), (m - N.x) * (m - N.z) * (m - N.w) / ((N.y - N.x) * (N.y - N.z) * (N.y - N.w)),
                    (m - N.x) * (m - N.y) * (m - N.w) / ((N.z - N.x) * (N.z - N.y) * (N.z - N.w)), (m - N.x) * (m - N.y) * (m - N.z) / ((N.w - N.x) * (N.w - N.y) * (N.w - N.z)));
      return max(0.0, dot(l, S * N)) / m; }
    // мех (реестр, п. 29): мелкий узор нагрева на основаниях (сетка, гранулы — масштабы ≈ 700 и 2 500 км) переносится вдоль силовых линий
    // по метке основания; множитель — логнормальный со средним 1 (средняя яркость не меняется); узор медленно живёт (uTime)
    float h3(vec3 p) { p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float vn(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
                 mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
    float furW(vec3 f) { float n = 0.65 * (vn(f * uFurK1 + vec3(uTime * 0.11, 0.0, uTime * 0.07)) - 0.5) + 0.35 * (vn(f * uFurK2 - vec3(0.0, uTime * 0.03, 0.0)) - 0.5);
      float z = n * 7.33; return exp(uFurSig * z) / uFurNorm; }   // 7,33 — к единичной дисперсии (замер: σ суммы шумов 0,136); uFurNorm — среднее exp(σz)
    // множитель меха: газ включён — 1 вне меха, узор — по доле меха; газ выключен — только сам мех (доля × узор), без метки основания — 0
    // мех на диске — только на ярких линиях (автор: «в центре должна быть текстура только ярких линий»): доля меха в точке луча — по её
    // яркости в шкале тона картинки (свечение на столбе 0,1 R★ против границ яркости калибровки): тусклый газ — гладкий, яркие петли — нитями
    float furGate(float e) { float tn = log(1.0 + e * 0.1 / uI0) / log(1.0 + uIw / uI0); return smoothstep(uFurLo, uFurHi, tn); }
    // слой у поверхности (ковёр, протяжённая корона, мох): свечение e·exp(−h/H) с местными e, H точки поверхности под каждой точкой луча —
    // интегралом вдоль луча внутри сферы Rs (автор: «эти вот проекции пятен на текстуру — наверное не надо делать — свет так не распространяется
    // в газе»: прежде столб брался по одной точке под касательной — пятно у края «проецировалось» вверх тёмным столбом)
    uniform float uCarpRs, uExtRs, uMossRs, uNetK2, uExtNet; uniform sampler2D uNet2;
    vec2 surfUV(vec3 P) { return vec2(fract(atan(P.z, P.x) / (2.0 * PI) + 1.0), acos(clamp(P.y, -1.0, 1.0)) / PI); }
    float layerCol(vec3 o, vec3 d, float tHit, float Rs, int comp, int NS, float jit) {
      vec2 ts; if (!sphere(o, d, Rs, ts)) return 0.0; float t0 = max(ts.x, 0.0), t1 = tHit > 0.0 ? min(ts.y, tHit) : ts.y; if (t1 <= t0) return 0.0;
      float dt = (t1 - t0) / float(NS), acc = 0.0;
      for (int k = 0; k < 32; k++) { if (k >= NS) break; vec3 x = o + (t0 + (float(k) + jit) * dt) * d; float r = length(x), h = r - 1.0; if (h < 0.0) continue; vec2 uv = surfUV(x / r);
        float e, H; if (comp == 2) { e = texture(uMoss, uv).r / uMossH; H = uMossH; } else { vec4 c = texture(uCarp, uv); e = comp == 0 ? c.x : c.z; H = comp == 0 ? c.y : c.w; }
        // лучи (автор: «лучи в короне ещё меньше стали»): протяжённая корона светит вдоль силовых линий — свечение × узор сети у основания линии,
        // проходящей через точку (метка основания — из объёма поля): линии от ярких узлов сети — светлые перья, средняя яркость та же
        if (comp == 1 && uExtNet > 0.0 && r < uRmax) { vec4 vv = texture(uVol, uvw(x)); float lf = length(vv.gba); if (lf > 0.2) e *= mix(1.0, texture(uNet2, surfUV(vv.gba / lf)).r * uNetK2, uExtNet); }
        acc += e * exp(-h / max(H, 1e-5)); }
      return acc * dt; }
    float furM(float fr, vec3 foot, bool ok) { if (uGas > 0.5) return fr > 0.0 && ok ? mix(1.0, furW(foot), fr) : 1.0; return fr > 0.0 && ok ? fr * furW(foot) : 0.0; }
    void main() {
      // луч — из поля зрения камеры (без обращения проекции: при дальней плоскости в 10⁵ точности float не хватало)
      vec3 d = normalize(uCamRot * vec3(vNdc.x * uTanH * uAspect, vNdc.y * uTanH, -1.0)), o = uCam;
      // прежняя звезда целиком (текстура, газ, мех) и поверх неё в середине диска — трубки (автор: «по краю делать как было раньше бахрому —
      // корону из газа — а в центре трубки», «ну и текстуру — короче к старой звезде просто в центр добавить трубок»; «хотя поведение трубок
      // более правильное»): доля трубок — по наклону луча к поверхности μ (у края луч идёт вдоль поверхности — там газ и бахрома); нижняя
      // часть трубок погашена (её свет — в текстуре); линейные яркости складываются, тон и палитра — один раз
      float wt = 0.0, It = 0.0; if (uTubes > 0.5) { vec2 t1; if (sphere(o, d, 1.0, t1) && t1.x > 0.0) { float bi = length(cross(o, d)); wt = uTRamp * smoothstep(uTW0, uTW1, sqrt(max(0.0, 1.0 - bi * bi))); }
        if (wt > 0.0) It = texelFetch(uTA, ivec2(gl_FragCoord.xy), 0).r; }
      vec2 to; if (!sphere(o, d, uRmax, to)) { o0 = vec4(0.0, 0.0, 0.0, uRaw > 0.5 ? 0.5 : uW); return; }
      float a = max(to.x, 0.0), b = to.y; vec2 ts; bool disk = sphere(o, d, 1.0, ts) && ts.x > 0.0; if (disk) b = min(b, ts.x);   // за диском — не видно
      // мех — над краем (прицельное расстояние больше радиуса); на диске — по выключателю uFurDisk (автор: «а текстуры нет на переднем волуме?»:
      // при газе одним слоем без текстуры диск гладкий — узор оснований вдоль силовых линий даёт ему рисунок; прежде на диске нити тонули
      // в ярком нижнем слое); к краю — плавно
      float bimp = length(cross(o, d)), edg = smoothstep(0.985, 1.02, bimp), outer = 1.0 - smoothstep(1.3, 1.4, bimp), fwE = uFur * edg * outer, fwD = uFur * uFurDisk * (1.0 - edg) * outer, fw = fwE + fwD;   // полоса меха — до 1,3–1,4 R★; на диске — по яркости точки
      // нижний слой на диске — из текстуры (доля α по наклону: у края — объём целиком, без шва); при α = 1 объём ниже r_c не нужен
      float mu = sqrt(max(0.0, 1.0 - bimp * bimp)), al = disk && uSurfOn > 0.5 ? (uGas > 0.5 ? smoothstep(uMuA, uMuB, mu) : 1.0) : 0.0;   // газ выключен — текстура до самого края (у края — J при μ = 0,25: столб над краем вдвое-втрое длиннее вертикали, порядок тот же)
      vec2 tc; if (al > 0.999 && sphere(o, d, uRc, tc)) b = min(b, max(a, tc.x));
      float I = 0.0, Il = 0.0, t = a, j = hash(gl_FragCoord.xy);
      // шаг: у поверхности мельче; у луча с мехом — ещё мельче (метка основания вдоль луча меняется быстро, иначе узор — зерно)
      // uGas 0 — газ (объём над диском и краем) не рисуется, мех — остаётся (автор: «газ только» выключить, «а мех оставь»): свечение газа видно
      // только через узор меха над кромкой (доля меха × множитель узора); лучи без меха объём не проходят
      for (int k = 0; k < 1500; k++) { if (t >= b || (uGas < 0.5 && fw <= 0.0)) break; vec3 p = o + t * d; float r = length(p);
        float fr = fw * (1.0 - smoothstep(1.3, 1.4, r)), sk = mix(1.0, uFurStep, fr);   // выше 1,4 R★ — без меха и обычным шагом
        float ds = min(sk * clamp(0.1 * (r - 1.0) + 0.003, 0.003, 0.08), b - t); vec3 ps = o + (t + j * ds) * d;
        vec3 q = uvw(ps); vec4 v = texture(uVol, q); float e = v.r;
        float rk = 1.0 - smoothstep(1.3, 1.4, r);
        { float lf = length(v.gba); e *= furM((fwE + fwD * furGate(e)) * rk, lf > 0.2 ? v.gba / lf : vec3(0.0), lf > 0.2); }
        // смена снимка поля: новый объём проявляется поверх прежнего (свечение смешивается, метки — каждая в своём объёме)
        if (uMix > 0.0) { vec4 v2 = texture(uVolB, q); float e2 = v2.r, l2 = length(v2.gba); e2 *= furM((fwE + fwD * furGate(e2)) * rk, l2 > 0.2 ? v2.gba / l2 : vec3(0.0), l2 > 0.2); e = mix(e, e2, uMix); }
        if (length(ps) > uRc) I += e * ds; else Il += e * ds; t += ds; }
      if (al > 0.0) { vec3 P = normalize(o + ts.x * d); vec2 uv = vec2(fract(atan(P.z, P.x) / (2.0 * PI) + 1.0), acos(clamp(P.y, -1.0, 1.0)) / PI);
        float J = colJh(uHist, uv, mu);
        // подробный слой 2048 (автор: «давай 2048 только там, куда смотрит камера»): где он готов — его доля из текстуры присутствия плиток
        // (линейная выборка — край области плавный)
        if (uDOn > 0.5) { float wd = texture(uDW, uv).r; if (wd > 0.002) J = mix(J, colJh(uHistD, uv, mu), wd); }
        I = al * (J + I) + (1.0 - al) * (I + Il); }
      else I += Il;
      // трубки видны (автор: «покрутите с кодексом и сделайте чтоб трубки видны были»; замысел Codex): в середине гладкий фон приглушён на uTK
      // (0,8) и трубки заменяют часть его света — прежде трубки давали 6 % света фона в своих пикселях (прибавка тона ≈ 0,01) и тонули;
      // у края wt = 0 — прежняя звезда без изменений
      I = I * (1.0 - wt * uTK) + wt * It;
      // ковёр, протяжённая корона и мох — интегралом вдоль луча (на диске — до поверхности: дальнюю сторону закрывает звезда)
      if (uCarpOn > 0.5) { vec2 tq; float tHit = sphere(o, d, 1.0, tq) && tq.x > 0.0 ? tq.x : -1.0, jt = hash(gl_FragCoord.xy + 17.0);
        I += layerCol(o, d, tHit, uCarpRs, 0, 16, jt) + layerCol(o, d, tHit, uExtRs, 1, 24, jt) + layerCol(o, d, tHit, uMossRs, 2, 12, jt); }
      if (uRaw > 0.5) { o0 = vec4(I, disk ? 1.0 : 0.0, 0.0, 1.0); return; }
      float x = log(1.0 + I / uI0) / log(1.0 + uIw / uI0);
      o0 = vec4(gold(clamp(x, 0.0, 1.0)) * uW, uW);   // предумноженный: результат = ультрафиолет·w + прежний кадр·(1 − w)
    }`;

  // выборка z узора меха (повтор h3/vn шейдера; точки случайные — две составляющие независимы): среднее exp(σz) — норма множителя
  // (шум не гауссов, поправка exp(−σ²/2) для него неточна)
  let Z = null;
  function furNorm(sig) {
    if (!Z) { const fr = x => x - Math.floor(x), mix = (a, b, t) => a + (b - a) * t;
      const h3 = (x, y, z) => { x = fr(x * 0.3183099 + 0.71) * 17; y = fr(y * 0.3183099 + 0.113) * 17; z = fr(z * 0.3183099 + 0.419) * 17; return fr(x * y * z * (x + y + z)); };
      const vn = (x, y, z) => { const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z); let a = x - i, b = y - j, c = z - k; a = a * a * (3 - 2 * a); b = b * b * (3 - 2 * b); c = c * c * (3 - 2 * c);
        return mix(mix(mix(h3(i, j, k), h3(i + 1, j, k), a), mix(h3(i, j + 1, k), h3(i + 1, j + 1, k), a), b), mix(mix(h3(i, j, k + 1), h3(i + 1, j, k + 1), a), mix(h3(i, j + 1, k + 1), h3(i + 1, j + 1, k + 1), a), b), c); };
      let q = 12345; const rnd = () => (q = (q * 1103515245 + 12345) % 2147483648) / 2147483648 * 997;
      Z = new Float32Array(20000); for (let n = 0; n < Z.length; n++) Z[n] = 7.33 * (0.65 * (vn(rnd(), rnd(), rnd()) - 0.5) + 0.35 * (vn(rnd(), rnd(), rnd()) - 0.5)); }
    let m = 0; for (let n = 0; n < Z.length; n++) m += Math.exp(sig * Z[n]); return m / Z.length;
  }
  // нужны WebGL2 и запись в float (EXT_color_buffer_float): объём RGBA16F, калибровка — FLOAT
  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  const supported = renderer => !!(renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float'));

  function create(THREE, renderer, o) {
    // fur — мех над краем (0/1), furSig — его контраст (σ логнормального множителя), furStep — доля шага луча с мехом
    o = Object.assign({ shell: 0.15, surfW: 512, surfH: 256, surf: 1, muA: 0.25, muB: 0.45, Nr: 64, Nt: 96, Np: 192, rMax: 2.5, Topen: 1e6, nOpen: 1e8, near0: 8, near1: 16, fur: 1, furSig: 1.2, furStep: 0.35 }, o);
    const R = o.R, M = o.M, rMin = 1.0;
    // ---- объём: φ — ширина, θ — высота, ln r — глубина
    // три объёма (автор: «перескакивает одно в другое и стоит»): показываемый F, следующий готовый N и строящийся C. Пока C считается по слою
    // за кадр, F непрерывно перетекает в N (доля — по готовности C); C готов — F ← N, N ← C, новый снимок строится в освободившийся.
    // Время стоит — F плавно доходит до N и замирает
    const makeVol = () => { const v = new THREE.WebGL3DRenderTarget(o.Np, o.Nt, o.Nr); v.depthBuffer = false; v.stencilBuffer = false;
      Object.assign(v.texture, { format: THREE.RGBAFormat, type: THREE.HalfFloatType, internalFormat: 'RGBA16F', minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping, wrapR: THREE.ClampToEdgeWrapping, generateMipmaps: false }); return v; };
    const vols = [makeVol(), makeVol(), makeVol()]; let iF = 0, iN = 1, iC = 2, nReady = false, job = null, heatDirty = true, geoDirty = true;   // vols — яркость (каждый кадр)
    // геометрия снимка: основания, полудлина, тип — float без фильтрации (упакованные основания нельзя смешивать)
    const makeGeo = () => { const v = new THREE.WebGL3DRenderTarget(o.Np, o.Nt, o.Nr); v.depthBuffer = false; v.stencilBuffer = false;
      Object.assign(v.texture, { format: THREE.RGBAFormat, type: THREE.FloatType, internalFormat: 'RGBA32F', minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
        wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping, wrapR: THREE.ClampToEdgeWrapping, generateMipmaps: false }); return v; };
    const geos = [makeGeo(), makeGeo(), makeGeo()];
    // нижний слой: форма и яркость (J при 4 наклонах — её читает луч); float, выборка — точками; размер — слоя
    const makeF = (W, H) => new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping, depthBuffer: false, stencilBuffer: false });
    const frameInv = new THREE.Matrix4(), camL = new THREE.Matrix4();
    // ---- нагрев оснований — сам массив карты (float), не её картинка
    const fhTex = new THREE.DataTexture(new Float32Array(128 * 64), 128, 64, THREE.RedFormat, THREE.FloatType);
    Object.assign(fhTex, { wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping, magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, flipY: false, generateMipmaps: false });
    const uC = []; for (let i = 0; i < 160; i++) uC.push(new THREE.Vector4());
    const bu = { uFH: { value: fhTex }, uFHW: { value: 128 }, uFHH: { value: 64 }, uLayer: { value: 0 }, uNr: { value: o.Nr }, uNt: { value: o.Nt }, uNp: { value: o.Np }, uRmin: { value: rMin }, uRmax: { value: o.rMax },
      uRcm: { value: R }, uGM: { value: G * M }, uTopen: { value: o.Topen }, uNopen: { value: o.nOpen }, uBmin: { value: 1e-3 }, uStepMode: { value: 1 },
      uC: { value: uC }, uNC: { value: 0 }, uDip: { value: 0 }, uDipU: { value: 0 }, uGU: { value: 1 }, uDipM: { value: new THREE.Vector3(0, 1, 0) } };
    bu.uSW = { value: o.surfW }; bu.uSH = { value: o.surfH }; bu.uRc = { value: 1 + o.shell };
    bu.uSP = { value: new THREE.Vector4(halton(1, 2), halton(1, 3), halton(2, 2), halton(2, 3)) };   // точки двух отсчётов внутри ячейки
    // таблица столба R(ln A, u) = J4/(e₀·w) — по 5 узлам Гаусса — Лежандра (как прежде в шейдере), 64 × 32
    const JL = (() => { const NA = 64, NU = 32, la0 = Math.log(0.05), la1 = Math.log(500), uMax = 1 - 1 / (1 + o.shell), data = new Float32Array(NA * NU * 4), B2 = [0, 0.4375, 0.75, 0.9375];
      const GX = [-0.9061798459, -0.5384693101, 0, 0.5384693101, 0.9061798459], GW = [0.2369268851, 0.4786286705, 0.5688888889, 0.4786286705, 0.2369268851];
      for (let j = 0; j < NU; j++) for (let i = 0; i < NA; i++) { const A = Math.exp(la0 + (la1 - la0) * i / (NA - 1)), um = Math.max(1e-6, uMax * j / (NU - 1)), wm = (1 - Math.exp(-A * um)) / A;
        for (let q = 0; q < 5; q++) { const w = 0.5 * wm * (GX[q] + 1), u = -Math.log(Math.max(1e-9, 1 - A * w)) / A, om = 1 - u;
          for (let k = 0; k < 4; k++) data[(j * NA + i) * 4 + k] += 0.5 * GW[q] / (om * om * Math.sqrt(Math.max(1e-4, 1 - B2[k] * om * om))); } }
      const t = new THREE.DataTexture(data, NA, NU, THREE.RGBAFormat, THREE.FloatType); Object.assign(t, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, generateMipmaps: false, flipY: false }); t.needsUpdate = true; return t; })();
    bu.uJL = { value: JL };   // отсчётов формы на ячейку
    // геометрия объёма строится по снимку несколько кадров — у неё свои копии зарядов и диполя (живая текстура меняет их каждый кадр); нагрев
    // геометрии не нужен — яркость берёт живой
    const uCv = []; for (let i = 0; i < 160; i++) uCv.push(new THREE.Vector4());
    const bv = Object.assign({}, bu, { uFH: { value: fhTex }, uFHW: { value: 128 }, uFHH: { value: 64 }, uLayer: { value: 0 }, uC: { value: uCv }, uNC: { value: 0 }, uDip: { value: 0 }, uDipU: { value: 0 }, uGU: { value: 1 },
      uDipM: { value: new THREE.Vector3(0, 1, 0) } });
    const bakeMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: GEOM_FS, uniforms: bv, depthTest: false, depthWrite: false });
    const eu = Object.assign({}, bu, { uLayer: { value: 0 }, uGeo: { value: geos[0].texture } });   // яркость: живой нагрев (bu.uFH), геометрия снимка
    const emitMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: EMIT_FS, uniforms: eu, depthTest: false, depthWrite: false });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bakeMat), qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); quad.frustumCulled = false; qs.add(quad);
    // карта нагрева 1024×512 (≈ 650 км на экваторе Проксимы) — float, без фильтрации (билинейно — в запекании)
    // сетка поля 256×128×48 (φ, θ, ln r от 1 до rSS), половинная точность — трилинейная выборка аппаратно; строится раз на снимок
    const GNp = o.gridNp || 256, GNt = o.gridNt || 128, GNr = o.gridNr || 48, gridRT = new THREE.WebGL3DRenderTarget(GNp, GNt, GNr); gridRT.depthBuffer = false; gridRT.stencilBuffer = false;
    Object.assign(gridRT.texture, { format: THREE.RGBAFormat, type: THREE.HalfFloatType, internalFormat: 'RGBA16F', minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping, wrapR: THREE.ClampToEdgeWrapping, generateMipmaps: false });
    const gu = { uGL: { value: 0 }, uGNp: { value: GNp }, uGNt: { value: GNt }, uGNr: { value: GNr }, uRmax: { value: o.rMax }, uC: bu.uC, uNC: bu.uNC, uDip: bu.uDip, uDipU: bu.uDipU, uGU: bu.uGU, uDipM: bu.uDipM };
    const gridMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: GRID_FS, uniforms: gu, depthTest: false, depthWrite: false });
    // сетка поля — для текстуры поверхности (объём — точно: там сетка то быстрее, то медленнее); ниже uGR0 — точно (сверка: тип линии
    // 99,99 %, свечение p99 1,3 %; выше 1,02 — выигрыш тает)
    const gridSurf = o.grid != null ? o.grid : 1; bu.uBG = { value: gridRT.texture }; bu.uGOn = { value: gridSurf }; bu.uGR0 = { value: o.gridR0 || 1.02 };
    bv.uBG = bu.uBG; bv.uGOn = { value: 0 }; bv.uGR0 = bu.uGR0;   // объём — точное поле
    function buildGrid() { const prev = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel(); quad.material = gridMat;
      try { for (let k = 0; k < GNr; k++) { gu.uGL.value = k; renderer.setRenderTarget(gridRT, k, 0); renderer.render(qs, qc); } } finally { quad.material = bakeMat; renderer.setRenderTarget(prev, face, mip); } }
    // карта нагрева — не грубее текстуры: база — o.surfW (не меньше 1024), при включённом подробном слое — вдвое подробнее (2048 — 325 км)
    const makeHeat = (w, h) => new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false });
    const HW = o.heatW || Math.max(1024, o.surfW), HH = o.heatH || HW / 2, heatRT = makeHeat(HW, HH); let heat2 = null, heatCur = heatRT;
    const sp = [], spC = new Array(64).fill(2); for (let i = 0; i < 64; i++) sp.push(new THREE.Vector4());
    const hu = { uW: { value: HW }, uH: { value: HH }, uBconc: { value: 3000 }, uCarpet: { value: 500 }, uDrv: { value: 3e3 }, uSu: { value: 0.1 }, uEtaEps: { value: 0 }, uSp: { value: sp }, uSpC: { value: spC }, uNS: { value: 0 },
      uC: bu.uC, uNC: bu.uNC, uDip: bu.uDip, uDipU: bu.uDipU, uGU: bu.uGU, uDipM: bu.uDipM };   // поле — те же заряды, что в запекании
    const heatMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: HEAT_FS, uniforms: hu, depthTest: false, depthWrite: false });
    const hquad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), heatMat), hs = new THREE.Scene(); hquad.frustumCulled = false; hs.add(hquad);
    // ---- луч
    const ru = { uVol: { value: vols[0].texture }, uVolB: { value: vols[1].texture }, uHist: { value: null }, uHistD: { value: null }, uDW: { value: null }, uDOn: { value: 0 }, uMix: { value: 0 },
      uRc: { value: 1 + o.shell }, uMuA: { value: o.muA }, uMuB: { value: o.muB }, uSurfOn: { value: o.surf }, uCamRot: { value: new THREE.Matrix3() }, uCam: { value: new THREE.Vector3() }, uTanH: { value: 0.4 }, uAspect: { value: 1 }, uRmin: { value: rMin }, uRmax: { value: o.rMax },
      uI0: { value: 1 }, uIw: { value: 100 }, uW: { value: 1 }, uRaw: { value: 0 }, uSteps: { value: 600 },
      uCarp: { value: null }, uMoss: { value: null }, uMossH: { value: 0.004 }, uCarpRs: { value: 1.06 }, uExtRs: { value: 1.45 }, uMossRs: { value: 1.024 }, uNet2: { value: null }, uNetK2: { value: 4 }, uExtNet: { value: o.extNet != null ? o.extNet : 0.8 }, uCarpOn: { value: 0 }, uFurDisk: { value: o.furDisk != null ? o.furDisk : 0 }, uFurLo: { value: o.furLo != null ? o.furLo : 0.4 }, uFurHi: { value: o.furHi != null ? o.furHi : 0.65 }, uTubes: { value: 0 }, uTK: { value: o.tubeDim != null ? o.tubeDim : 0.8 }, uTRamp: { value: 0 }, uTW0: { value: o.tubeMu0 != null ? o.tubeMu0 : 0.3 }, uTW1: { value: o.tubeMu1 != null ? o.tubeMu1 : 0.6 }, uTA: { value: null }, uGas: { value: o.gas != null ? o.gas : 1 }, uFur: { value: o.fur }, uFurK1: { value: o.R / 7e7 }, uFurK2: { value: o.R / 2.5e8 }, uFurSig: { value: o.furSig }, uFurNorm: { value: 1 }, uFurStep: { value: o.furStep }, uTime: { value: 0 } };
    const rayMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: RAY_VS, fragmentShader: RAY_FS, uniforms: ru, depthTest: false, depthWrite: false, transparent: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, toneMapped: false });
    const rq = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), rayMat), rs = new THREE.Scene(); rq.frustumCulled = false; rs.add(rq);
    const rayScale = o.rayScale != null ? o.rayScale : 0.5, dbs = new THREE.Vector2(); let halfRT = null;
    const upMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: RAY_VS, fragmentShader: UP_FS, uniforms: { uT: { value: null } }, depthTest: false, depthWrite: false, transparent: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, toneMapped: false });
    const uq = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), upMat), us = new THREE.Scene(); uq.frustumCulled = false; us.add(uq);
    const S = { baked: false, ms: 0, frac: null, I0: 1, Iw: 100 }; let furSigN = NaN;
    // запекание: C — заряды модели (star-model charges(): xyzq, gUnit, dip, dipU, dipM), fh — нагрев 128×64, эрг/(см²·с)
    // проход материалом mat в цель rt целиком
    function pass(mat, rt) { const prev = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel(), ac = renderer.autoClear; quad.material = mat; renderer.autoClear = false;
      try { renderer.setRenderTarget(rt); renderer.render(qs, qc); } finally { quad.material = bakeMat; renderer.autoClear = ac; renderer.setRenderTarget(prev, face, mip); } }
    let gridStale = false, inVer = 0;
    function setInputs(C, fh, noGrid) {
      inUids = C.uids || null; inSet = new Set(inUids || []); inImg = !!C.img;   // для переноса оснований трубок (сопоставление зарядов и полюсов по uid — разбор Codex)
      const n = Math.min(160, C.length / 4); if (C.length / 4 > 160) console.warn('corona: зарядов больше 160 — лишние отброшены');
      for (let i = 0; i < 160; i++) uC[i].set(i < n ? C[i * 4] : 0, i < n ? C[i * 4 + 1] : 0, i < n ? C[i * 4 + 2] : 0, i < n ? C[i * 4 + 3] : 0);
      bu.uNC.value = n; bu.uDip.value = C.dip || 0; bu.uDipU.value = C.dipU || 0; bu.uGU.value = C.gUnit; if (C.dipM) bu.uDipM.value.fromArray(C.dipM);
      if (gridSurf > 0.5) { if (noGrid) gridStale = true; else { buildGrid(); gridStale = false; } }   // поле — в сетку (только для живой текстуры)
      heatDirty = true; inVer++;   // нагрев сменился — яркость устарела; новая версия входов — форма всех плиток устарела
      if (fh && fh.spots) {   // карта нагрева на видеокарте: {spots: [x, y, z, угловой радиус тени], Bconc, carpetG, vh, tanTheta, su, etaEps}
        const L = Math.min(64, fh.spots.length); for (let i = 0; i < 64; i++) { const q = fh.spots[i]; if (i < L) sp[i].set(q[0], q[1], q[2], q[3]); else sp[i].set(0, 1, 0, 0); }
        Object.assign(hu.uNS, { value: L }); hu.uBconc.value = fh.Bconc; hu.uCarpet.value = fh.carpetG; hu.uDrv.value = fh.vh * fh.tanTheta; hu.uSu.value = fh.su; hu.uEtaEps.value = fh.etaEps;
        if (DET.on && detOK && !heat2) heat2 = makeHeat(HW * 2, HH * 2); heatCur = DET.on && heat2 ? heat2 : heatRT;
        const hw = heatCur.width, hh = heatCur.height, m = 1.5 * Math.PI / hh; hu.uW.value = hw; hu.uH.value = hh;
        for (let i = 0; i < 64; i++) spC[i] = i < L ? Math.cos(Math.min(Math.PI, fh.spots[i][3] + m)) : 2;
        const prev = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
        renderer.setRenderTarget(heatCur); renderer.render(hs, qc); renderer.setRenderTarget(prev, face, mip);
        bu.uFH.value = heatCur.texture; bu.uFHW.value = hw; bu.uFHH.value = hh; }
      else { fhTex.image.data.set(fh); fhTex.needsUpdate = true; bu.uFH.value = fhTex; bu.uFHW.value = 128; bu.uFHH.value = 64; } }
    // карта нагрева (для проверок): Float32Array HW·HH·4 — нагрев, тень, f_res
    // живая текстура (для проверок): Float32Array W·H·4 — J при μ = 1; 0,75; 0,5; 0,25; geo — форма (в порядке ячеек); detail — подробный слой
    function readSurf(geo, det) { const Ly = det ? detail : base; if (!Ly) return null; return Ly.read(geo); }
    // снимок для геометрии объёма: копии живых зарядов и диполя
    function freezeVol() { for (let i = 0; i < 160; i++) uCv[i].copy(uC[i]);
      bv.uNC.value = bu.uNC.value; bv.uDip.value = bu.uDip.value; bv.uDipU.value = bu.uDipU.value; bv.uGU.value = bu.uGU.value; bv.uDipM.value.copy(bu.uDipM.value); }
    // яркость по геометрии снимка i — живым нагревом (все слои)
    function emit(i) { const prev = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel(); quad.material = emitMat; eu.uGeo.value = geos[i].texture;
      try { for (let k = 0; k < o.Nr; k++) { eu.uLayer.value = k; renderer.setRenderTarget(vols[i], k, 0); renderer.render(qs, qc); } } finally { quad.material = bakeMat; renderer.setRenderTarget(prev, face, mip); } }
    // кадр яркости: пришла новая геометрия или (heat ≠ false) сменился нагрев — пересчитать показываемые (F и, если готов, N)
    function emitLive(heat) { if (!S.baked || !(geoDirty || (heat !== false && heatDirty))) return false; emit(iF); if (nReady) emit(iN); geoDirty = heatDirty = false; return true; }
    // ---- сборка нижнего слоя (база 1024 на всю звезду; подробный 2048 — около точки под камерой): цели, свои параметры шейдеров, плитки T×T,
    // их обход по фазам 2×2 (видимое — чаще, по возрасту), плавная смена формы, яркость по плиткам. LB — линий за кадр; det — подробный слой:
    // в работе только плитки в области (угол от точки под камерой < det.rho), плитка, вошедшая в область, сперва трассируется целиком,
    // затем её присутствие растёт до 1 за det.fadeIn; вышла — падает (луч смешивает слои по присутствию)
    const camS = new THREE.Vector3(0, 0, 10), cd = new THREE.Vector3();
    const AGE_MAX = 1500;   // мс: фаза плитки старше — вне очереди
    // показ формы — с постоянным запаздыванием LAG (автор: «рисунок проезжает вперёд, потом тормозится или даже назад двигается»): прежде доля
    // новой формы шла от промежутка между двумя последними обновлениями — когда следующий промежуток был длиннее прежнего, показываемое время
    // в миг обновления отскакивало назад (короче — вперёд). Теперь показ — момент «сейчас − LAG» между прежней и новой формой ячейки;
    // ячейка перетрассируется, только когда её новая форма старше LAG (показываемое время не идёт назад); LAG — 1,25 ожидаемого промежутка
    // обхода видимых плиток (по бюджету и средней длительности кадра), меняется медленно
    function makeLayer(W, H, T, LB, det) {
      const TX = T, TY = T, NT = TX * TY, K = W >= 1024 ? 1 : 2, nearest = { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, generateMipmaps: false, flipY: false };
      const tex = (d, w, h, type, lin) => { const t = new THREE.DataTexture(d, w, h, THREE.RedFormat, type); Object.assign(t, nearest); if (lin) Object.assign(t, { magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping }); t.needsUpdate = true; return t; };
      const geoS = makeF(W, H), geoP = makeF(W, H), geoP2 = makeF(W, H), bri = makeF(W, H);
      const maskData = new Uint8Array(NT), maskTex = tex(maskData, TX, TY, THREE.UnsignedByteType), visData = new Uint8Array(NT).fill(255), visTex = tex(visData, TX, TY, THREE.UnsignedByteType);
      const twData = new Float32Array(NT * 4).fill(1), twTex = tex(twData, TX * 2, TY * 2, THREE.FloatType);   // доля новой формы: плитка × фаза
      const resData = new Uint8Array(NT), resTex = det ? tex(resData, TX, TY, THREE.UnsignedByteType, true) : null, res = new Float32Array(NT), valid = new Uint8Array(NT);
      const lu = Object.assign({}, bu, { uSW: { value: W }, uSH: { value: H }, uMask: { value: maskTex }, uSG: { value: geoS.texture }, uSGP: { value: geoP.texture }, uSGP2: { value: geoP2.texture }, uTW: { value: twTex }, uVis: { value: visTex }, uK: { value: K } });
      const vsh = 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', mat = fs => new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: vsh, fragmentShader: fs, uniforms: lu, depthTest: false, depthWrite: false });
      const sgeoMat = mat(SGEO_FS), sbriMat = mat(SBRI_FS), gcopyMat = mat(GCOPY_FS);
      // по (плитка, фаза): время двух последних обновлений, версия входов; следующая фаза плитки; центры плиток
      const tAge = new Float64Array(NT * 4), tPrv = new Float64Array(NT * 4), tP2 = new Float64Array(NT * 4), tVer = new Int32Array(NT * 4).fill(-1), tPh = new Uint8Array(NT), tDir = [];
      for (let ty = 0; ty < TY; ty++) for (let tx = 0; tx < TX; tx++) { const ph = 2 * Math.PI * (tx + 0.5) / TX, th = Math.PI * (ty + 0.5) / TY; tDir.push(new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph))); }
      const TPF = Math.max(1, Math.floor(LB / (K * W * H / NT / 4)));
      // равные по возрасту плитки — вразброс (бит-реверс номера; разбор Codex: порядок номеров давал бегущий фронт строками)
      const bits = Math.round(Math.log2(NT)), tPerm = new Float64Array(NT); for (let t = 0; t < NT; t++) { let r = 0, x = t; for (let b = 0; b < bits; b++) { r = (r << 1) | (x & 1); x >>= 1; } tPerm[t] = r / NT; }
      // плитка видна, если угол от её центра до направления на камеру меньше горизонта плюс полудиагональ плитки (+3°)
      const RT = Math.hypot(Math.PI / TX, Math.PI / (2 * TY)) + 0.05, visCos = d => Math.cos(Math.min(Math.PI, Math.acos(Math.min(1, 1 / d)) + RT));
      const wIdx = (t, p) => (2 * ((t / TX) | 0) + (p >> 1)) * TX * 2 + 2 * (t % TX) + (p & 1);
      let LAG = 150, frameMs = 33, lastNow = performance.now();
      const inReg = t => !det || (det.on && tDir[t].dot(cd) > Math.cos(det.rho)), active = t => !det || inReg(t) || res[t] > 0;   // уходящая плитка обновляется, пока её доля не упала до 0
      function pickTiles(all, changed) { maskData.fill(0); const now = performance.now(); let n = 0;
        if (all) { maskData.fill(255); tAge.fill(now); tPrv.fill(now - 1); tP2.fill(now - 2); tVer.fill(inVer); valid.fill(1); n = NT; }
        else { const d = Math.max(1, camS.length()), hz = visCos(d), sc = []; cd.copy(camS).normalize(); let budget = TPF;
          // запаздывание — до проверки готовности; растёт не быстрее половины длительности кадра (разбор Codex: иначе при скачке длительности
          // кадра время показа «сейчас − LAG» шло назад); ожидаемый промежуток — 4 фазы × (видимых активных плиток / плиток за кадр) кадров
          const dtF = now - lastNow; lastNow = now; if (dtF > 0 && dtF < 200) frameMs += (dtF - frameMs) * 0.05; let nv = 0; for (let t = 0; t < NT; t++) if (valid[t] && active(t) && tDir[t].dot(cd) > hz) nv++;
          const tgtLag = Math.min(900, Math.max(80, 2.2 * 4 * Math.max(1, nv / TPF) * frameMs)); LAG += Math.min(0.5 * Math.max(0, dtF), (tgtLag - LAG) * 0.01);   // ≈ 2 промежутка, медленно
          if (det) for (let t = 0; t < NT && budget >= 4; t++) if (inReg(t) && !valid[t]) {   // вошла в область — целиком (все фазы), затем присутствие растёт
            maskData[t] = 255; for (let p = 0; p < 4; p++) { const u = t * 4 + p; tAge[u] = now; tPrv[u] = now - 1; tP2[u] = now - 2; tVer[u] = inVer; twData[wIdx(t, p)] = 1; } valid[t] = 1; budget -= 4; n++; }
          for (let t = 0; t < NT; t++) { if (maskData[t] || !valid[t] || !active(t)) continue; const u = t * 4 + tPh[t]; if (!changed && tVer[u] === inVer) continue; if (now - LAG < tPrv[u]) continue;   // показ ещё в паре P2→P — P2 нужна (три формы: обновление может опоздать на целый промежуток без остановки)
            const age = now - tAge[u]; sc.push([(age > AGE_MAX ? 1e9 : 0) + (age + 1) * (tDir[t].dot(cd) > hz ? 1 : 0.15) + tPerm[t], t]); }
          sc.sort((a, b) => b[0] - a[0]);
          for (const [, t] of sc.slice(0, Math.max(0, budget))) { const p = tPh[t], u = t * 4 + p; maskData[t] = 60 * (p + 1); tP2[u] = tPrv[u]; tPrv[u] = tAge[u]; tAge[u] = now; tVer[u] = inVer; tPh[t] = (p + 1) & 3; n++; }
        }
        maskTex.needsUpdate = true; return n; }
      // доля новой формы — так, чтобы показ пришёлся на момент «сейчас − LAG» между прежней и новой формой ячейки
      function tileWeights() { const now = performance.now();
        for (let u = 0; u < NT * 4; u++) { const tau = now - LAG;   // показ — момент «сейчас − LAG» в обрамляющей паре
          twData[wIdx(u >> 2, u & 3)] = tau < tPrv[u] ? Math.min(1, Math.max(0, (tau - tP2[u]) / Math.max(1, tPrv[u] - tP2[u]))) : 1 + Math.min(1, Math.max(0, (tau - tPrv[u]) / Math.max(1, tAge[u] - tPrv[u]))); }
        twTex.needsUpdate = true; }
      // яркость нужна плитке, если она видна (и в области) и с прошлого счёта сменились входы, идёт смена формы или форма обновилась; плитка,
      // посчитанная посреди смены, досчитывается и после её конца (разбор Codex)
      const bVer = new Int32Array(NT).fill(-1), bT = new Float64Array(NT), bFade = new Uint8Array(NT);
      function brightTiles(all) { const now = performance.now(), d = Math.max(1, camS.length()), hz = visCos(d); cd.copy(camS).normalize(); let n = 0;
        for (let t = 0; t < NT; t++) { let need = all;
          if (!need && valid[t] && active(t) && tDir[t].dot(cd) > hz) { if (bVer[t] !== inVer || bFade[t]) need = true; else for (let p = 0; p < 4 && !need; p++) if (twData[wIdx(t, p)] < 2 || tAge[t * 4 + p] > bT[t]) need = true; }
          visData[t] = need ? 255 : 0; if (need) { bVer[t] = inVer; bT[t] = now; let f = 0; for (let p = 0; p < 4; p++) if (twData[wIdx(t, p)] < 2) f = 1; bFade[t] = f; n++; } }
        visTex.needsUpdate = true; return n; }
      function brightTilesR() { const n = brightTiles(false); if (n) passIn(sbriMat, bri, rects(visData), false); return n; }
      // присутствие подробного слоя: в области и готова — растёт, иначе падает; вышла из области — форма недействительна (войдёт — заново)
      let lastT = performance.now();
      // доля растёт, только если готовы и плитка, и все восемь соседей (разбор Codex: линейная выборка доли и сглаживание луча 4×4 заходят в
      // соседнюю плитку — читать её можно, лишь когда она готова); вышла из области и доля упала до 0 — форма недействительна
      const ready = t => valid[t] && bVer[t] >= 0;
      function residency() { if (!det) return 0; const now = performance.now(), dt = Math.min(0.2, (now - lastT) / 1000); lastT = now; let any = 0;
        for (let t = 0; t < NT; t++) { const tx = t % TX, ty = (t / TX) | 0; let ok = inReg(t) && ready(t);
          for (let b = -1; b <= 1 && ok; b++) for (let a = -1; a <= 1 && ok; a++) { const yy = Math.min(TY - 1, Math.max(0, ty + b)), xx = (tx + a + TX) % TX; if (!ready(yy * TX + xx)) ok = false; }
          const tgt = ok ? 1 : 0; res[t] = tgt > res[t] ? Math.min(1, res[t] + dt / det.fadeIn) : Math.max(0, res[t] - dt / det.fadeIn);
          if (!inReg(t) && res[t] === 0) { valid[t] = 0; bVer[t] = -1; }
          resData[t] = Math.round(res[t] * 255); if (res[t] > 0) any = 1; }
        resTex.needsUpdate = true; return any; }
      // прямоугольники ячеек вокруг плиток с ненулевым data[t] (разбор Codex: полноэкранный проход с отбрасыванием всё равно запускает все
      // ячейки — у подробного слоя 2 млн на проход): по широте — от первой до последней строки плиток, по долготе — занятые столбцы без самого
      // длинного пустого промежутка (через шов — два прямоугольника)
      function rects(data) { const col = new Uint8Array(TX); let y0 = TY, y1 = -1;
        for (let t = 0; t < NT; t++) if (data[t]) { const tx = t % TX, ty = (t / TX) | 0; col[tx] = 1; if (ty < y0) y0 = ty; if (ty > y1) y1 = ty; }
        if (y1 < 0) return [];
        let best = 0, bs = 0; for (let st = 0; st < TX; st++) { if (col[st]) continue; let l = 0; while (l < TX && !col[(st + l) % TX]) l++; if (l > best) { best = l; bs = st; } }
        const cw = W / TX, rh = H / TY, ry = y0 * rh, rhh = (y1 - y0 + 1) * rh;
        if (best === 0) return [[0, ry, W, rhh]];
        const a = (bs + best) % TX, n = TX - best;   // занятая дуга: столбцы a … a + n − 1 (по кругу)
        return a + n <= TX ? [[a * cw, ry, n * cw, rhh]] : [[a * cw, ry, (TX - a) * cw, rhh], [0, ry, (a + n - TX) * cw, rhh]]; }
      // проход в прямоугольники rs; stor — цель хранит форму по фазам (каждый прямоугольник — в четверть каждой фазы)
      function passIn(m, rt, rs, stor) { const hw = W / 2, hh = H / 2;
        const parts = stor ? rs.flatMap(([x, y, w, h]) => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([px, py]) => [px * hw + Math.floor(x / 2), py * hh + Math.floor(y / 2), Math.ceil(w / 2), Math.ceil(h / 2)])) : rs;
        for (const [x, y, w, h] of parts) { rt.scissor.set(x, y, w, h); rt.scissorTest = true; try { pass(m, rt); } finally { rt.scissorTest = false; rt.scissor.set(0, 0, W, H); } } }
      const L = { W, H, bri, resTex, geoS, diag: () => { const now = performance.now(), d = Math.max(1, camS.length()), hz = visCos(d); cd.copy(camS).normalize(); let nv = 0, hold = 0;
          for (let t = 0; t < NT; t++) { if (!valid[t] || !active(t) || tDir[t].dot(cd) <= hz) continue; for (let p = 0; p < 4; p++) { nv++; if (now - LAG > tAge[t * 4 + p]) hold++; } }
          return { LAG, frameMs, TPF, holdFrac: nv ? hold / nv : 0, visUnits: nv }; },
        // кадр слоя: changed — входы сменились
        step(changed) { const n = pickTiles(false, changed); if (n) { const rs = rects(maskData); lu.uSG.value = geoP.texture; try { passIn(gcopyMat, geoP2, rs, true); } finally { lu.uSG.value = geoS.texture; }
            passIn(gcopyMat, geoP, rs, true); passIn(sgeoMat, geoS, rs, true);
            if (det && maskData.some(v => v === 255)) { const km = maskData.slice(); for (let t = 0; t < NT; t++) maskData[t] = km[t] === 255 ? 255 : 0; maskTex.needsUpdate = true; const r2 = rects(maskData); passIn(gcopyMat, geoP, r2, true); passIn(gcopyMat, geoP2, r2, true); maskData.set(km); maskTex.needsUpdate = true; } }
          tileWeights(); const b = brightTilesR(); return det ? residency() : b; },
        fill() { pickTiles(true); pass(sgeoMat, geoS); pass(gcopyMat, geoP); pass(gcopyMat, geoP2); tileWeights(); if (brightTiles(true)) pass(sbriMat, bri); },
        reset() { valid.fill(0); res.fill(0); resData.fill(0); if (resTex) resTex.needsUpdate = true; bVer.fill(-1); },
        read(geo) { const buf = new Float32Array(W * H * 4), prev = renderer.getRenderTarget(); renderer.setRenderTarget(geo ? geoS : bri);
          renderer.getContext().readPixels(0, 0, W, H, 0x1908, 0x1406, buf); renderer.setRenderTarget(prev);
          if (geo) { const hw = W >> 1, hh = H >> 1, out = new Float32Array(buf.length);   // из хранения по фазам — в порядок ячеек
            for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const sx = (i & 1) * hw + (i >> 1), sy = (j & 1) * hh + (j >> 1); for (let c = 0; c < 4; c++) out[(j * W + i) * 4 + c] = buf[(sy * W + sx) * 4 + c]; }
            return { buf: out, W, H }; }
          return { buf, W, H }; },
        // замер (разбор Codex): prep — копия рабочей формы во временные цели (вне таймера); measure — кадр: копия прежней формы выбранных
        // плиток, их перетрассировка, яркость видимых плиток со сменой формы (part — 'copy' | 'geo' | 'bri')
        prep() { if (!L.sc) L.sc = [makeF(W, H), makeF(W, H), makeF(W, H)]; const km = maskData.slice(); maskData.fill(255); maskTex.needsUpdate = true;
          const sg = lu.uSG.value; try { pass(gcopyMat, L.sc[0]); lu.uSG.value = geoP.texture; pass(gcopyMat, L.sc[2]); } finally { lu.uSG.value = sg; maskData.set(km); maskTex.needsUpdate = true; } },
        measure(part) { if (!L.sc) L.prep(); const [s0, s1, s2] = L.sc, keep = maskData.slice(), kw = twData.slice(), kv = visData.slice(), sg = lu.uSG.value, sgp = lu.uSGP.value;
          try { maskData.fill(0); for (let t = 0; t < TPF && t < NT; t++) maskData[(t * 7) % NT] = 60 * (1 + (t & 3)); maskTex.needsUpdate = true; twData.fill(1.5); twTex.needsUpdate = true;
            const d = Math.max(1, camS.length()), hz = visCos(d); cd.copy(camS).normalize(); for (let t = 0; t < NT; t++) visData[t] = tDir[t].dot(cd) > hz ? 255 : 0; visTex.needsUpdate = true; bu.uGOn.value = gridSurf;
            lu.uSG.value = s0.texture; if (!part || part === 'copy') pass(gcopyMat, s2); if (!part || part === 'geo') pass(sgeoMat, s0); lu.uSGP.value = s2.texture; if (!part || part === 'bri') pass(sbriMat, s1); }
          finally { lu.uSG.value = sg; lu.uSGP.value = sgp; maskData.set(keep); maskTex.needsUpdate = true; twData.set(kw); twTex.needsUpdate = true; visData.set(kv); visTex.needsUpdate = true; } },
        dispose() { [geoS, geoP, geoP2, bri].forEach(r => r.dispose()); [sgeoMat, sbriMat, gcopyMat, maskTex, visTex, twTex].forEach(x => x.dispose()); if (resTex) resTex.dispose(); if (L.sc) L.sc.forEach(r => r.dispose()); } };
      return L; }
    // база — вся звезда; подробный — 2048 около точки под камерой, только когда камера ближе DET_ON (ячейка базы — больше двух точек луча);
    // создаётся при первом включении
    const base = makeLayer(o.surfW, o.surfH, 16, o.surfW >= 2048 ? 131072 : o.surfW >= 1024 ? 65536 : 32768, null);
    ru.uHist.value = base.bri.texture;
    // включение — по размеру ячейки базы в точках луча в центре диска (разбор Codex): > 1,6 — подробный слой включается, < 1,35 — выключается
    // (обычный вид 6,2 R★ — ≈ 1,25: выключен; 3 R★ — ≈ 3,2)
    const DET = { on: false, rho: 0.8, fadeIn: 0.35 }, DET_ON = o.detOn != null ? o.detOn : 1.6, DET_OFF = o.detOff != null ? o.detOff : 1.35, detW = 2 * o.surfW, detOK = o.detail !== 0 && o.surfW === 1024;
    let detPx = 0, detAllow = !!o.detAllow;   // по умолчанию выключен: вблизи с ним 15 к/с (автор: «тут всё дергается»)   // точек луча на ячейку базы в центре диска (look); detAllow — выключатель стенда
    let detail = null, detAny = false;
    // кадр нижнего слоя: C, fh — входы сейчас (null — прежние: поле стоит)
    function live(C, fh) { if (!S.baked) return false;
      if (C && !hydFrozen()) setInputs(C, fh);   // газодинамика в трубках: поле — снимок (входы не принимаются)
      if (gridStale) { buildGrid(); gridStale = false; }   // текстуру снова включили — сетка по текущим зарядам
      if (tubes.on) { bu.uGOn.value = gridSurf; tubesFrame(); }   // трубки — середине диска; текстура и объём — краю (автор: «по краю … корону из газа — а в центре трубки»)
      bu.uGOn.value = gridSurf; const b = base.step(!!C);
      if (detOK) { if (!DET.on && detAllow && detPx > DET_ON) DET.on = true; else if (DET.on && (!detAllow || detPx < DET_OFF)) DET.on = false; }
      if (DET.on && !detail) { detail = makeLayer(detW, o.surfH * 2, 32, 32768, DET); ru.uHistD.value = detail.bri.texture; ru.uDW.value = detail.resTex; }
      if (detail && (DET.on || detAny)) { detAny = !!detail.step(!!C); ru.uDOn.value = detAny ? 1 : 0; }
      return b > 0; }
    function look(camera) { setCam(camera); camS.copy(ru.uCam.value); renderer.getDrawingBufferSize(dbs);
      detPx = dbs.y * rayScale / (2 * Math.tan(camera.fov * Math.PI / 360) / (camera.zoom || 1)) / Math.max(1e-3, camS.length() - 1) * (2 * Math.PI / o.surfW); }
    function readHeat() { const w = heatCur.width, h = heatCur.height, buf = new Float32Array(w * h * 4); renderer.readRenderTargetPixels(heatCur, 0, 0, w, h, buf); return { buf, W: w, H: h }; }
    // полное запекание — сразу в показываемый объём (при сборке)
    function bake(C, fh) {
      const t0 = performance.now(); job = null; nReady = false; ru.uMix.value = 0; ru.uVol.value = vols[iF].texture; setInputs(C, fh); freezeVol(); const geo = geos[iF];
      const prev = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
      for (let k = 0; k < o.Nr; k++) { bv.uLayer.value = k; renderer.setRenderTarget(geo, k, 0); renderer.render(qs, qc); }
      renderer.setRenderTarget(prev, face, mip); emit(iF); geoDirty = heatDirty = false;
      bu.uGOn.value = gridSurf; base.fill(); if (detail) detail.reset(); detAny = false; ru.uDOn.value = 0;
      // доли линий по типу (выборка — один слой у поверхности и один повыше)
      const cnt = [0, 0, 0, 0, 0], buf = new Float32Array(o.Np * o.Nt * 4), gl = renderer.getContext();
      for (const k of [2, Math.floor(o.Nr / 2)]) { renderer.setRenderTarget(geo, k, 0); gl.readPixels(0, 0, o.Np, o.Nt, gl.RGBA, gl.FLOAT, buf);
        for (let i = 0; i < buf.length; i += 4) { const c = buf[i + 3]; cnt[c === 1 ? 1 : c === 2 ? 2 : 4]++; } }
      renderer.setRenderTarget(prev, face, mip);
      const tot = cnt.reduce((a, b) => a + b, 0) || 1; S.frac = { closed: cnt[1] / tot, open: cnt[2] / tot, other: cnt[4] / tot };
      S.ms = performance.now() - t0; S.baked = true;
    }
    // перестройка объёма по ходу жизни поля: beginBake — снимок живых входов (в N, если его нет, иначе в C), stepBake — n порций слоёв за кадр
    // и доля перетекания F → N, stepFade — дотекание, пока новых снимков нет (бесшовно; границы яркости прежние — без автоэкспозиции)
    const sm = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
    function beginBake() { if (job || !S.baked) return false; freezeVol(); job = { k: 0, into: nReady ? iC : iN, t0: performance.now(), m0: ru.uMix.value }; return true; }
    const LPF = Math.max(1, Math.round(4096 / (o.Np * o.Nt)));   // слоёв объёма за кадр — ≈ 4 тыс. ячеек (≈ 2,5–3 мс; живая текстура — ещё ≈ 4 мс)
    function stepBake(n) { if (!job) return false; const to = geos[job.into], prev = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
      for (let i = 0; i < (n || 1) * LPF && job.k < o.Nr; i++, job.k++) { bv.uLayer.value = job.k; renderer.setRenderTarget(to, job.k, 0); renderer.render(qs, qc); }
      renderer.setRenderTarget(prev, face, mip);
      // F перетекает в N, пока строится C; начали посреди дотекания — продолжаем с достигнутой доли (без остановки — разбор Codex)
      const prog = job.k / o.Nr;
      if (nReady && job.into === iC) ru.uMix.value = job.m0 + (1 - job.m0) * prog;   // равномерно (прежде — S-кривая: скорость формы пульсировала с каждым снимком)
      if (job.k >= o.Nr) { S.rebakeMs = performance.now() - job.t0; S.rebakes = (S.rebakes || 0) + 1;
        if (job.into === iN) nReady = true;   // первый следующий готов — перетекание начнётся со следующим снимком (или дотеканием)
        else { const f = iF; iF = iN; iN = iC; iC = f; ru.uMix.value = 0; }   // в этот миг видно N целиком — после сдвига это F: шва нет
        ru.uVol.value = vols[iF].texture; ru.uVolB.value = vols[iN].texture; job = null; geoDirty = true; }   // новая геометрия — яркость по ней
      return true; }
    function stepFade(dt, dur) { if (job || !nReady) return; ru.uMix.value = Math.min(1, ru.uMix.value + Math.max(0, dt) / (dur || 1));
      if (ru.uMix.value >= 1) { const f = iF; iF = iN; iN = f; nReady = false; ru.uMix.value = 0; ru.uVol.value = vols[iF].texture; ru.uVolB.value = vols[iN].texture; } }
    // замер (панель «Компоненты»): один слой запекания в строящийся объём C — не показывается; при идущей сборке слой 0 уже посчитан с теми же
    // входами — результат тот же
    // замер одного кадра нижнего слоя (база): prepMeasure — вне таймера, measureSurf(part) — под таймером
    function prepMeasure() { base.prep(); }
    function measureSurf(part) { base.measure(part); }
    function measureLayer() { const prev = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
      const k = arguments.length ? arguments[0] | 0 : 0; bv.uLayer.value = k;
      try { renderer.setRenderTarget(geos[iC], k, 0); renderer.render(qs, qc); } finally { renderer.setRenderTarget(prev, face, mip); } }
    // замер яркости объёма (одна геометрия — все слои; в строящееся место C)
    function measureEmit() { const prev = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel(); quad.material = emitMat; eu.uGeo.value = geos[iF].texture;
      try { for (let k = 0; k < o.Nr; k++) { eu.uLayer.value = k; renderer.setRenderTarget(vols[iC], k, 0); renderer.render(qs, qc); } } finally { quad.material = bakeMat; renderer.setRenderTarget(prev, face, mip); } }
    // система звезды: если звезда повёрнута (вращение), камера переводится в её систему — объём запечён в системе звезды
    function setFrame(m4) { if (m4) frameInv.copy(m4).invert(); else frameInv.identity(); }
    // границы яркости — один раз после запекания: по лучам из точки камеры (I0 — 5 % медианы диска, белая точка — 99,7-й процентиль
    // лучей с ненулевым свечением; дальше не меняются — без автоэкспозиции); диска в кадре нет (камера ещё не поставлена, холст нулевой) —
    // false, повторить позже; свечения на диске нет совсем — true, границы прежние (S.cal.zero)
    function calibrate(camera) {
      const W = 160, H = 120, rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, format: THREE.RGBAFormat }), px = new Float32Array(W * H * 4);
      const prev = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
      try { ru.uRaw.value = 1; rayMat.blending = THREE.NoBlending; renderer.setRenderTarget(rt); renderer.clear(); render(camera, 1, rt); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px); }
      finally { renderer.setRenderTarget(prev, face, mip); ru.uRaw.value = 0; rayMat.blending = THREE.CustomBlending; rt.dispose(); }
      const v = [], dk = []; let nd = 0;
      for (let i = 0; i < W * H; i++) { const I = px[i * 4], d = px[i * 4 + 1] > 0.5; if (d) nd++; if (!(I > 0) || !Number.isFinite(I)) continue; v.push(I); if (d) dk.push(I); }
      v.sort((a, b) => a - b); dk.sort((a, b) => a - b); S.cal = { n: v.length, disk: nd };
      if (nd < 50) return false; if (!dk.length) { S.cal.zero = true; return true; }
      const med = dk[dk.length >> 1], hi = v[Math.min(v.length - 1, Math.floor(v.length * 0.997))];
      S.I0 = ru.uI0.value = Math.max(1e-12, 0.05 * med); S.Iw = ru.uIw.value = Math.max(hi, 2 * S.I0); S.cal.med = med; return true;
    }
    function setCam(camera) { camera.updateMatrixWorld(); camL.multiplyMatrices(frameInv, camera.matrixWorld); ru.uCamRot.value.setFromMatrix4(camL); ru.uCam.value.setFromMatrixPosition(camL);
      ru.uTanH.value = Math.tan(camera.fov * Math.PI / 360) / (camera.zoom || 1); ru.uAspect.value = camera.aspect; }
    // вес ультрафиолета по расстоянию камеры до центра звезды: ближе near0 — 1, дальше near1 — 0
    const weight = camera => { const d = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld).length(); return 1 - THREE.MathUtils.smoothstep(d, o.near0, o.near1); };
    // режим трубок входит и уходит плавно (2 с): приглушение фона и трубки вместе (замысел Codex), без скачка яркости середины; каждый кадр —
    // и когда корона не видна (разбор Codex: угасание зависало); первый отсчёт — только время (без скачка на 12 %)
    function tubeRamp() { const nt = performance.now() / 1000, dt = tubes.rampT > 0 ? Math.min(0.25, Math.max(0, nt - tubes.rampT)) : 0; tubes.rampT = nt;
      tubes.ramp = Math.min(1, Math.max(0, tubes.ramp + (tubes.want ? 1 : -1) * dt / 2)); if (!tubes.want && tubes.ramp <= 0) tubes.on = false; ru.uTRamp.value = tubes.ramp; }
    function render(camera, wForce, target, time) {
      if (!target) tubeRamp();
      if (!S.baked) return 0; carpFrame(); if (time != null) ru.uTime.value = time; const w = wForce != null ? wForce : weight(camera); if (w <= 0.001) return 0;
      if (ru.uFurSig.value !== furSigN) { furSigN = ru.uFurSig.value; ru.uFurNorm.value = furNorm(furSigN); }
      const prev = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel(), ac = renderer.autoClear;
      setCam(camera); ru.uW.value = w; renderer.autoClear = false;
      if (!target && rayScale < 1) {   // на экран — в половинную цель, затем растяжка с тем же смешиванием
        renderer.getDrawingBufferSize(dbs); const W = Math.max(1, Math.round(dbs.x * rayScale)), H = Math.max(1, Math.round(dbs.y * rayScale));
        if (!halfRT || halfRT.width !== W || halfRT.height !== H) { if (halfRT) halfRT.dispose();
          halfRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false });
          upMat.uniforms.uT.value = halfRT.texture; }
        if (tubes.on) tubesDraw(camera, W, H); ru.uTubes.value = tubes.on ? 1 : 0;
        try { rayMat.blending = THREE.NoBlending; renderer.setRenderTarget(halfRT); renderer.render(rs, camera); } finally { rayMat.blending = THREE.CustomBlending; }
        renderer.setRenderTarget(null); renderer.render(us, camera); }
      else { const tOn = ru.uTubes.value; ru.uTubes.value = 0; try { renderer.setRenderTarget(target || null); renderer.render(rs, camera); } finally { ru.uTubes.value = tOn; } }   // калибровка — по прежней короне
      renderer.autoClear = ac; renderer.setRenderTarget(prev, face, mip); return w;
    }

    // ---- трубки (этап 3; автор: «давай трубки»): N трубок по M точек
    // трубок 8192 (автор: «надо трубок сильно больше»); трассируется 2048 за кадр по кругу — каждая обновляется раз в 4 кадра (поле медленное:
    // основания за это время сдвигаются на сотые доли градуса), цена трассировки — прежняя
    const TN = o.tubesN || 8192, TC = Math.min(TN, o.tubesChunk || 2048), TM = 64, tubes = { on: false, want: false, ramp: 0, rampT: 0, poles: null, acc: null };
    const fltRT = (w, h) => new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false });
    const tSeedData = new Float32Array(TN * 4), tSeed = new THREE.DataTexture(tSeedData, 1, TN, THREE.RGBAFormat, THREE.FloatType);
    Object.assign(tSeed, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, generateMipmaps: false, flipY: false }); tSeed.needsUpdate = true;
    const tLen = fltRT(1, TN), tGas = fltRT(1, TN), tLum = fltRT(1, TN), tPA = fltRT(TM, TN), tPB = fltRT(TM, TN);
    const tu = Object.assign({}, bu, { uSeed: { value: tSeed }, uLen: { value: tLen.texture }, uPrev: { value: null }, uJ: { value: 0 }, uMt: { value: TM }, uPA: { value: tPA.texture }, uPB: { value: tPB.texture }, uTG: { value: tGas.texture }, uShowR: { value: Math.min(o.rMax, 2.0) } });
    const vshQ = 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', tmat = fs => new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: vshQ, fragmentShader: fs, uniforms: tu, depthTest: false, depthWrite: false });
    const tLenMat = tmat(TLEN_FS), tPtMat = tmat(TPT_FS), tGasMat = tmat(TGAS_FS), tLumMat = tmat(TLUM_FS);
    // отрисовка: экземпляр — отрезок трубки (N·(M − 1)); прямоугольник к камере, сумма — сложением в линейный буфер
    const tGeo = new THREE.InstancedBufferGeometry(); tGeo.setAttribute('corner', new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2)); tGeo.setIndex([0, 1, 2, 0, 2, 3]);
    tGeo.instanceCount = TN * (TM - 1); tGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    const tru = { uPA: { value: tPA.texture }, uPB: { value: tPB.texture }, uGas: { value: tGas.texture }, uMt: { value: TM }, uView: { value: new THREE.Matrix4() }, uProj: { value: new THREE.Matrix4() },
      uCam: { value: new THREE.Vector3() }, uRcm: { value: R }, uShowR: { value: Math.min(o.rMax, 2.0) }, uGM: { value: G * M }, uFill: { value: o.tubeFill || 0.05 }, uPx: { value: 0.001 }, uH0: { value: o.tubeH0 != null ? o.tubeH0 : 0.03 } };
    tu.uH0 = tru.uH0;   // свет трубки для выборки — с тем же гашением низа
    // обе стороны: прямоугольник строится лицом к камере, обход вершин на экране — то по, то против часовой (иначе отсекался — трубки не рисовались)
    // прозрачность не включена: двусторонний прозрачный материал three.js рисует двумя проходами (разбор Codex); сложение — своим смешиванием
    const tRenMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: TUBE_VS, fragmentShader: TUBE_FS, uniforms: tru, depthTest: false, depthWrite: false, transparent: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
    const tMesh = new THREE.Mesh(tGeo, tRenMat), tScene = new THREE.Scene(); tMesh.frustumCulled = false; tScene.add(tMesh);
    // выбор оснований: поток |B_r|·dA по сетке 64×32 (поле — как в шейдере, по текущим зарядам)
    const jsField = (x, y, z) => { let bx = 0, by = 0, bz = 0; const C = bu.uC.value, n = bu.uNC.value;
      for (let k = 0; k < n; k++) { const c = C[k], dx = x - c.x, dy = y - c.y, dz = z - c.z, r2 = dx * dx + dy * dy + dz * dz + 1e-6, f = c.w / (r2 * Math.sqrt(r2)); bx += f * dx; by += f * dy; bz += f * dz; }
      const D = bu.uDip.value; if (D) { const m = bu.uDipM.value, r2 = x * x + y * y + z * z, r3 = r2 * Math.sqrt(r2), k3 = 3 * D * (m.x * x + m.y * y + m.z * z) / (r3 * r2), du = bu.uDipU.value;
        bx += k3 * x + m.x * (-D / r3 + du); by += k3 * y + m.y * (-D / r3 + du); bz += k3 * z + m.z * (-D / r3 + du); }
      const g = bu.uGU.value; return [bx * g, by * g, bz * g]; };
    // выборка оснований (автор: «появляются иногда очень толстые трубки — которые потом совершают странные эволюции»): прежде каждая трубка
    // несла равный поток — половину света давали 33 низкие короткие петли (толщиной 3–6 тыс. км, ≈ 0,9 МК — у пика 174 Å); их пересев и
    // изменения длины меняли сразу по 2–5 % всего света. Теперь — трубки примерно равного света. Предложение — смесь: заряды полюсов своего
    // знака (поверхностный поток заряда на глубине — его точная форма (1 − aμ)/(1 + a² − 2aμ)^{3/2}, выборка обращением функции
    // распределения) с весом «поток × свет на единицу потока у трубок этого полюса» (замер на видеокарте раз в 0,5 с), шапки ярких трубок и
    // равномерная часть — доли ниже; поток трубки — точный вес max(0, ±B_r(x))·R²/(N·π±·p(x)): сумма потоков сходится без смещения, форма предложения повторяет пики у
    // пятен — веса ровные (по сетке 64×32 пятно было уже ячейки — отдельные трубки несли до 10 средних потоков). Где светит — трубок больше
    // и они тоньше, где тускло — меньше, толще и тусклые
    // смесь с гарантированными долями (разбор Codex: «10 % равномерно» добавочной массой не гарантировались — веса без защиты): 20 % — по
    // магнитному потоку полюсов, 75 % — по свету (полюса × свет на единицу потока + шапки ярких трубок), 5 % — равномерно (поле, не
    // представленное зарядами: диполь)
    const gNow = new Float32Array(TN), gTgt = new Float32Array(TN);   // вес показа трубки: текущий и цель
    const AF = 0.2, AU = 0.05, AL = 0.75, FBETA = 0.1, CAP_R = 0.02, CAP_N = 48, lumBuf = new Float32Array(TN * 4), lamPole = new Map(), capsP = [], capsN = [];
    let lumOK = false, phiP = 0, phiN = 0, mixP = null, mixN = null, fluxT = -1e9, lam0 = 1;
    // свет на единицу потока по полюсам — среднее с весом потока ΣλΦ/ΣΦ (разбор Codex: невзвешенное среднее раздувала сама сгущённая выборка),
    // трубке — её главного полюса (наибольшая доля ≥ 0,3), без главного — фону; сжатие к среднему (вес одной средней трубки), 0,02–50,
    // сглаживание наполовину за обновление. Шапки: вокруг оснований самых ярких трубок (до 48, свет больше двух средних) — 1,1°, масса —
    // половина света трубки: внутри полюса свет неравномерен (короткие петли у линии раздела ярче длинных) — там выборка гуще
    function lightMap() { if (!lumOK) return; const prev = renderer.getRenderTarget(); pass(tLumMat, tLum); renderer.setRenderTarget(tLum); renderer.getContext().readPixels(0, 0, 1, TN, 0x1908, 0x1406, lumBuf); renderer.setRenderTarget(prev);
      const acc = new Map(), lit = []; let sLF = 0, sF = 0, nT = 0, s0 = 0, f0 = 0;
      for (let k = 0; k < TN; k++) { const t = T[k]; if (t.born < 0 || !(t.phiEff > 0) || !(tSeedData[k * 4 + 3] > 0)) continue; const l = lumBuf[k * 4]; if (!Number.isFinite(l) || l < 0) continue;
        const F = t.phiEff; sLF += l * F; sF += F; nT++; lit.push([k, l * F]);
        if (t.top != null) { let e = acc.get(t.top); if (!e) acc.set(t.top, e = [0, 0]); e[0] += l * F; e[1] += F; } else { s0 += l * F; f0 += F; } }
      capsP.length = 0; capsN.length = 0; const m = sF > 0 ? sLF / sF : 0, Fm = nT ? sF / nT : 0; if (!(m > 0)) return;
      const keep = new Map(); for (const [u, e] of acc) { const tg = Math.min(50, Math.max(0.02, (e[0] + m * Fm) / (e[1] + Fm) / m)), old = lamPole.get(u); keep.set(u, old != null ? 0.5 * (old + tg) : tg); }
      lamPole.clear(); for (const [u, v] of keep) lamPole.set(u, v); lam0 = 0.5 * (lam0 + Math.min(50, Math.max(0.02, (s0 + m * Fm) / (f0 + Fm) / m)));
      // только яркие трубки (автор: «и трубки только яркие оставим»): цель веса показа — по свету трубки к среднему, плавно от tubeB0 до tubeB1
      { const b0 = o.tubeB0 != null ? o.tubeB0 : 1, b1 = o.tubeB1 != null ? o.tubeB1 : 2, ml = sLF / nT; gTgt.fill(0); for (const [k, L] of lit) { const x = Math.min(1, Math.max(0, (L / ml - b0) / (b1 - b0))); gTgt[k] = x * x * (3 - 2 * x); } }
      const mL = sLF / nT, fu = bu.uGU.value * R * R, cr = Math.cos(CAP_R), om = 2 * Math.PI * (1 - cr); lit.sort((x, y) => y[1] - x[1]);
      for (let e = 0; e < Math.min(CAP_N, lit.length); e++) { const [k, L] = lit[e]; if (L < 2 * mL) break; const t = T[k];
        (t.pol > 0 ? capsP : capsN).push({ cx: t.dir.x, cy: t.dir.y, cz: t.dir.z, cr, om, M: 0.5 * L / (m * fu) }); } }
    // смесь одного знака: заряды полюсов (направление, глубина a = |c|, базис касательной плоскости; поток fl = |q|·4π, свет ml = fl·Λ), шапки;
    // L — оценка света полярности (для выбора полярности новой трубки): полюса, шапки и фон (поток полярности по сетке × свет фона)
    function buildMix(sgn, pm, phiGrid) { const C = bu.uC.value, comps = []; let F = 0, ML = 0;
      if (pm) for (let i = 0; i < pm.n; i++) { const c = C[i]; if (!(c.w * sgn > 0)) continue; const a = Math.hypot(c.x, c.y, c.z); if (!(a > 1e-6 && a < 0.9999)) continue;
        const ax = new THREE.Vector3(c.x / a, c.y / a, c.z / a), e1 = ax.clone().cross(Math.abs(ax.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize(), e2 = ax.clone().cross(e1);
        const fl = Math.abs(c.w) * 4 * Math.PI, ml = fl * (lamPole.get(pm.uids[i]) || 1); comps.push({ cx: ax.x, cy: ax.y, cz: ax.z, a, e1, e2, fl, ml }); F += fl; ML += ml; }
      const caps = (sgn > 0 ? capsP : capsN).slice(); for (const c of caps) ML += c.M;
      const Fg = phiGrid / Math.max(1e-30, bu.uGU.value * R * R), L = ML + FBETA * Math.max(F, Fg) * lam0;
      return F > 0 || Fg > 0 ? { comps, caps, F, ML, L } : null; }
    const KN = 1 / (4 * Math.PI);
    // плотность предложения на единицу телесного угла (точка на единичной сфере)
    function mixPdf(mx, x, y, z) { let pf = 0, pl = 0;
      for (const c of mx.comps) { const mu = x * c.cx + y * c.cy + z * c.cz, q = 1 + c.a * c.a - 2 * c.a * mu, kk = KN * (1 - c.a * mu) / (q * Math.sqrt(q)); pf += c.fl * kk; pl += c.ml * kk; }
      for (const c of mx.caps) if (x * c.cx + y * c.cy + z * c.cz >= c.cr) pl += c.M / c.om;
      const aF = mx.F > 0 ? AF : 0, aL = mx.ML > 0 ? AL : 0; return (1 - aF - aL) * KN + (aF ? aF * pf / mx.F : 0) + (aL ? aL * pl / mx.ML : 0); }
    // выборка точки: у заряда μ = cos угла от него — обращением F(q) = (√q − (1 − a²)/√q + 2a)/(4a), q = 1 + a² − 2aμ; у шапки — μ равномерно
    // в [cos ρ, 1]; азимут — равномерно
    const onSphere = (out, ax, e1, e2, mu, ph) => { const sn = Math.sqrt(Math.max(0, 1 - mu * mu)), cp = Math.cos(ph) * sn, sp = Math.sin(ph) * sn;
      return out.set(mu * ax[0] + cp * e1.x + sp * e2.x, mu * ax[1] + cp * e1.y + sp * e2.y, mu * ax[2] + cp * e1.z + sp * e2.z).normalize(); };
    const sampleCharge = (c, out) => { const a = c.a, B = 4 * a * Math.random() - 2 * a, y = 0.5 * (B + Math.sqrt(B * B + 4 * (1 - a * a))), q = y * y;
      return onSphere(out, [c.cx, c.cy, c.cz], c.e1, c.e2, Math.max(-1, Math.min(1, (1 + a * a - q) / (2 * a))), 2 * Math.PI * Math.random()); };
    const capBasis = c => { if (!c.e1) { const ax = new THREE.Vector3(c.cx, c.cy, c.cz); c.e1 = ax.clone().cross(Math.abs(c.cy) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize(); c.e2 = ax.clone().cross(c.e1); } return c; };
    function mixSample(mx, out) { const aF = mx.F > 0 ? AF : 0, aL = mx.ML > 0 ? AL : 0, u = Math.random();
      if (u < aF) { let v = Math.random() * mx.F; for (const c of mx.comps) { if (v < c.fl) return sampleCharge(c, out); v -= c.fl; } return sampleCharge(mx.comps[mx.comps.length - 1], out); }
      if (u < aF + aL) { let v = Math.random() * mx.ML; for (const c of mx.comps) { if (v < c.ml) return sampleCharge(c, out); v -= c.ml; }
        for (const c of mx.caps) { if (v < c.M) { capBasis(c); return onSphere(out, [c.cx, c.cy, c.cz], c.e1, c.e2, c.cr + (1 - c.cr) * Math.random(), 2 * Math.PI * Math.random()); } v -= c.M; } }
      const mu = 2 * Math.random() - 1, ph = 2 * Math.PI * Math.random(), sn = Math.sqrt(1 - mu * mu); return out.set(sn * Math.cos(ph), mu, sn * Math.sin(ph)); }
    // поток полярностей — по сетке 64×32 (сводка, фон смеси); затем смеси по текущим зарядам и свету полюсов
    function fluxMap() { lightMap(); const GW = 64, GH = 32; phiP = 0; phiN = 0;
      for (let j = 0; j < GH; j++) { const t0 = Math.PI * j / GH, t1 = Math.PI * (j + 1) / GH, dA = 2 * Math.PI / GW * (Math.cos(t0) - Math.cos(t1)) * R * R, th = 0.5 * (t0 + t1);
        for (let i = 0; i < GW; i++) { const ph = 2 * Math.PI * (i + 0.5) / GW, x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph), f = jsField(x, y, z), v = f[0] * x + f[1] * y + f[2] * z;
          if (v > 0) phiP += v * dA; else phiN -= v * dA; } }
      const pm = poleMap(); mixP = buildMix(1, pm, phiP); mixN = buildMix(-1, pm, phiN); }
    // трубка: основание (направление), веса полюсов (ws — места в таблице поворотов, wg — поколение места, ww — доли), главный полюс (uid, |q| в
    // начале нормировки — поток трубки следует за его силой), поток (phi0 — при выборке, phi — в нормировке, phiEff — действующий), полярность,
    // угасание по причине (гибель полюса, чужое поле — поток замирает), проявление
    const T = Array.from({ length: TN }, () => ({ dir: new THREE.Vector3(0, 1, 0), ws: [], wg: [], ww: [], uid: null, top: null, q0: 1, phi0: 0, phi: 0, phiEff: 0, bad: 0, dying: false, pol: 1, born: -1e9, die: 1e18 }));
    // перенос оснований (автор: «у тебя один лес волос — едет сквозь другой — это как?»; разбор Codex): поле — сумма полей зарядов, узор
    // каждого полюса (с изображением) поворачивается вместе с полюсом; основание поворачивается на Ω = Σ wᵢ·ωᵢ, ωᵢ — поворот полюса i за кадр
    // (ось p_old × p_new), wᵢ = B_r,i·B_r/(B_r² + ε²), ε = ¼·Σ|B_r,k| — доля полюса в поле основания со знаком (точно для суммы движущихся
    // узоров), у линии раздела непрерывно уходит в ноль; |Ω| — не больше поворота самого быстрого полюса; неподвижный фон — диполь; все
    // полюса. Веса — по кругу 1/16 трубок за кадр
    let inUids = null, inSet = new Set(), inImg = false;   // снимок входов: uid полюсов в порядке зарядов и есть ли изображения (из стенда — вместе с зарядами)
    // таблица поворотов: место — за uid, пока он жив (среди полюсов или во входах); новый владелец места — новое поколение: веса трубок со
    // старым поколением не срабатывают (разбор Codex: циклическая таблица отдавала место живого полюса)
    const US = 1024, uSlot = new Map(), sGen = new Uint32Array(US), om = new Float64Array(US * 3), omUsed = [], sFree = []; for (let k = US - 1; k >= 0; k--) sFree.push(k);
    const uidSlot = u => { let k = uSlot.get(u); if (k == null) { if (!sFree.length) return -1; k = sFree.pop(); sGen[k]++; uSlot.set(u, k); } return k; };
    function poleMap() { const n = bu.uNC.value;
      if (inUids && (n === inUids.length || n === 2 * inUids.length)) return { uids: inUids, n: inUids.length, img: inImg && n === 2 * inUids.length };
      const P = (tubes.poles || []).filter(Q => Q && Q.q !== 0); return P.length && (n === P.length || n === 2 * P.length) ? { uids: P.map(Q => Q.uid), n: P.length, img: n === 2 * P.length } : null; }
    const vB = new Float64Array(160);
    function tubeWeights(t, pm, byUid) { const C = bu.uC.value, x = t.dir.x, y = t.dir.y, z = t.dir.z, n = pm.n; let tot = 0, sa = 0;
      const br = c => { const dx = x - c.x, dy = y - c.y, dz = z - c.z, r2 = dx * dx + dy * dy + dz * dz + 1e-6; return c.w * (dx * x + dy * y + dz * z) / (r2 * Math.sqrt(r2)); };
      for (let i = 0; i < n; i++) { const v = br(C[i]) + (pm.img ? br(C[n + i]) : 0); vB[i] = v; tot += v; sa += Math.abs(v); }
      // диполь на поверхности (как в jsField при r = 1): B_r = (2D + D_u)·(m·n)
      const D = bu.uDip.value; if (D) { const m = bu.uDipM.value, v = (2 * D + bu.uDipU.value) * (m.x * x + m.y * y + m.z * z); tot += v; sa += Math.abs(v); }
      const den = tot * tot + 0.0625 * sa * sa;
      // основание ушло в поле другого знака (трасса уже идёт по новому) — трубка гаснет и пересевается; только у трубок с потоком (нулевые
      // живут свой срок — иначе положительные исходы дольше занимают места: смещение во времени, разбор Codex)
      if (t.phi0 > 0) t.bad = (tot >= 0 ? 1 : -1) === t.pol ? 0 : t.bad + 1;
      t.ws.length = 0; t.wg.length = 0; t.ww.length = 0; let bi = -1, bw = 0.5, ti = -1, tw = 0.3;
      if (den > 0) for (let i = 0; i < n; i++) { const w = vB[i] * tot / den; if (Math.abs(w) < 1e-3) continue; if (w > tw) { tw = w; ti = i; } const k = uidSlot(pm.uids[i]); if (k < 0) continue; t.ws.push(k); t.wg.push(sGen[k]); t.ww.push(w); if (w > bw) { bw = w; bi = i; } }
      t.top = ti >= 0 ? pm.uids[ti] : null;   // полюс, которому трубка отдаёт свой свет в карте света
      // главный полюс (доля > ½): поток трубки следует за его силой; смена — без скачка (действующий поток переносится в новую нормировку);
      // угасающая трубка и трубка, чей главный полюс исчез, — без смены (гибель доводит кадр — разбор Codex)
      if (t.dying) return; if (t.uid != null) { const Q = byUid && byUid.get(t.uid); if (!Q || Q.dead) return; }
      const u = bi >= 0 ? pm.uids[bi] : null;
      if (u !== t.uid) { t.phi = t.phiEff; t.uid = u; if (u != null) { const Q = byUid && byUid.get(u); t.q0 = Math.max(1e-9, Math.abs(Q ? Q.q : C[bi].w)); } } }
    const T_LIFE = o.tubeLife || 30, T_FADE = 1.5;   // с: жизнь трубки (обновление выборки), проявление/угасание
    function seedTube(k, now, pm, byUid) { const t = T[k];
      t.uid = null; t.top = null; t.bad = 0; t.dying = false; t.ws.length = 0; t.wg.length = 0; t.ww.length = 0; t.born = now; t.die = now + T_LIFE * (0.6 + 0.8 * Math.random());
      // полярность — случайно, с вероятностью по свету полярностей; поток трубки — max(0, ±B_r)·R²/(N·π±·p(x)) (разбор Codex: квоты по номерам
      // трубок при их смене давали временный сдвиг суммы потока до 1,9; ненулевой полярности — не меньше 2 %)
      const lp = mixP ? mixP.L : 0, ln = mixN ? mixN.L : 0; let pp = lp / Math.max(1e-30, lp + ln); if (mixP && mixN) pp = Math.min(0.98, Math.max(0.02, pp));
      t.pol = Math.random() < pp ? 1 : -1; const mx = t.pol > 0 ? mixP : mixN, pi = t.pol > 0 ? pp : 1 - pp;
      if (!mx || !(pi > 0)) { t.phi0 = t.phi = t.phiEff = 0; return; }   // поля нет — пустая трубка до своего срока
      mixSample(mx, t.dir); const f = jsField(t.dir.x, t.dir.y, t.dir.z), br = f[0] * t.dir.x + f[1] * t.dir.y + f[2] * t.dir.z, pd = mixPdf(mx, t.dir.x, t.dir.y, t.dir.z);
      t.phi0 = t.phi = t.phiEff = pd > 0 ? Math.max(0, t.pol * br) * R * R / (TN * pi * pd) : 0;
      if (pm) tubeWeights(t, pm, byUid); }
    const pPrev = new Map(); let wRR = 0, omMaxLast = 0;   // полюса прошлого кадра (uid → направление); очередь пересчёта весов
    let tPrevT = 0, tRow = 0;
    function tubesFrame() { const now = performance.now() / 1000; if (now - fluxT > 0.5 || !(mixP || mixN)) { fluxMap(); fluxT = now; }
      // повороты полюсов за кадр (тот же uid): ось p_old × p_new, угол между ними (разбор Codex: отброшенный поворот терялся)
      for (const k of omUsed) om[3 * k] = om[3 * k + 1] = om[3 * k + 2] = 0; omUsed.length = 0; let omMax = 0;
      const byUid = new Map(); for (const Q of tubes.poles || []) if (Q && Q.uid != null) { byUid.set(Q.uid, Q); const l = Q.p.length(); if (!(l > 0)) continue; let pr = pPrev.get(Q.uid);
        if (pr) { const ax = pr[1] * Q.p.z - pr[2] * Q.p.y, ay = pr[2] * Q.p.x - pr[0] * Q.p.z, az = pr[0] * Q.p.y - pr[1] * Q.p.x, sn = Math.hypot(ax, ay, az) / l, cs = (pr[0] * Q.p.x + pr[1] * Q.p.y + pr[2] * Q.p.z) / l, an = Math.atan2(sn, cs);
          if (sn > 1e-12 && an < 3) { const k = uidSlot(Q.uid); if (k >= 0) { const f = an / (sn * l); om[3 * k] = ax * f; om[3 * k + 1] = ay * f; om[3 * k + 2] = az * f; omUsed.push(k); omMax = Math.max(omMax, an); } } }
        else { pr = [0, 0, 0]; pPrev.set(Q.uid, pr); } pr[0] = Q.p.x / l; pr[1] = Q.p.y / l; pr[2] = Q.p.z / l; }
      omMaxLast = omMax;
      if (pPrev.size > byUid.size + 64) for (const u of pPrev.keys()) if (!byUid.has(u)) pPrev.delete(u);
      if (uSlot.size > byUid.size + inSet.size + 32) for (const [u, k] of uSlot) if (!byUid.has(u) && !inSet.has(u)) { uSlot.delete(u); sFree.push(k); }
      const pm = poleMap(), nW = Math.ceil(TN / 16);
      if (pm) for (let c = 0; c < nW; c++, wRR = (wRR + 1) % TN) if (T[wRR].born >= 0 && !T[wRR].pin) tubeWeights(T[wRR], pm, byUid);
      for (let k = 0; k < TN; k++) { const t = T[k]; let fresh = false;
        if (!t.pin && (now > t.die + T_FADE || t.born < 0)) { seedTube(k, now, pm, byUid); fresh = true; gNow[k] = gTgt[k] = 0; if (t.born < 0 || now - tPrevT > 5) t.born = now - T_FADE; }   // первая выборка — сразу видна
        if (t.bad >= 2 && !t.dying) { t.die = Math.min(t.die, now); t.dying = true; }
        // основание — поворотом на Ω (формула Родрига), не быстрее самого быстрого полюса; только что посеянная — уже по текущему полю (без шага)
        if (!fresh && !t.pin && omUsed.length && t.ws.length) { let wx = 0, wy = 0, wz = 0; for (let e = 0; e < t.ws.length; e++) { const s3 = t.ws[e]; if (sGen[s3] !== t.wg[e]) continue; const q = 3 * s3, w = t.ww[e]; wx += w * om[q]; wy += w * om[q + 1]; wz += w * om[q + 2]; }
          let an = Math.hypot(wx, wy, wz); if (an > 1e-12) { const kx = wx / an, ky = wy / an, kz = wz / an; an = Math.min(an, omMax); const c = Math.cos(an), sn = Math.sin(an), d = t.dir, kd = kx * d.x + ky * d.y + kz * d.z;
            d.set(d.x * c + (ky * d.z - kz * d.y) * sn + kx * kd * (1 - c), d.y * c + (kz * d.x - kx * d.z) * sn + ky * kd * (1 - c), d.z * c + (kx * d.y - ky * d.x) * sn + kz * kd * (1 - c)).normalize(); } }
        // поток: за силой главного полюса; угасание по причине (гибель полюса, чужое поле) — с последним действующим потоком, без пересчёта
        let phi = t.phiEff;
        if (!t.dying) { phi = t.phi; if (t.uid != null) { const Q = byUid.get(t.uid); if (!Q || Q.dead) { t.die = Math.min(t.die, now); t.dying = true; phi = t.phiEff; } else phi *= Math.abs(Q.q) / Math.max(1e-9, t.q0); } }
        t.phiEff = phi;
        const fade = t.pin ? 1 : Math.min(1, Math.max(0, (now - t.born) / T_FADE)) * Math.min(1, Math.max(0, (t.die + T_FADE - now) / T_FADE));
        tSeedData[k * 4] = t.dir.x; tSeedData[k * 4 + 1] = t.dir.y; tSeedData[k * 4 + 2] = t.dir.z; tSeedData[k * 4 + 3] = phi * fade; }
      { const st = Math.min(0.25, Math.max(0, now - tPrevT)); for (let k = 0; k < TN; k++) { const g = gNow[k], tg = T[k].pin ? 1 : gTgt[k]; gNow[k] = tg > g ? Math.min(tg, g + st) : Math.max(tg, g - st); hTab[k * 4 + 2] = gNow[k]; } hTabTex.needsUpdate = true; }   // вес показа — к цели за 1 с
      tPrevT = now; tSeed.needsUpdate = true;
      // длина, точки (колонка за проход, попеременно в две цели), газ, свет на единицу потока (для выборки)
      // строки r0 … r0 + TC (четверть трубок) — длина и точки; газ — всем (дёшево, нагрев живой)
      const r0 = tRow; tRow = (tRow + TC) % TN;
      const rows = (mat, rt, x, w) => { rt.scissor.set(x, r0, w, TC); rt.scissorTest = true; try { pass(mat, rt); } finally { rt.scissorTest = false; rt.scissor.set(0, 0, rt.width, rt.height); } };
      bu.uGOn.value = gridSurf; quad.material = tLenMat; rows(tLenMat, tLen, 0, 1);
      for (let j = 0; j < TM; j++) { const tgt = j % 2 === 0 ? tPA : tPB; tu.uJ.value = j; tu.uPrev.value = (j % 2 === 0 ? tPB : tPA).texture; rows(tPtMat, tgt, j, 1); }
      pass(tGasMat, tGas); if (tRow === 0) lumOK = true; }
    // отрисовка трубок в линейный буфер (размер — как у буфера луча)
    function tubesDraw(camera, W, H) { if (!tubes.acc || tubes.acc.width !== W || tubes.acc.height !== H) { if (tubes.acc) tubes.acc.dispose();
        tubes.acc = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false }); }
      tru.uView.value.copy(camL).invert(); tru.uProj.value.copy(camera.projectionMatrix); tru.uCam.value.copy(ru.uCam.value); tru.uPx.value = 2 * Math.tan(camera.fov * Math.PI / 360) / (camera.zoom || 1) / H;   // размер пикселя буфера на единицу расстояния
      const prev = renderer.getRenderTarget(), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
      renderer.setRenderTarget(tubes.acc); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false); renderer.render(tScene, camera); renderer.setClearColor(cc, ca); renderer.setRenderTarget(prev);
      ru.uTA.value = tubes.acc.texture; }
    // ---- газодинамика в трубках (этап 3, второй шаг; автор: «давай газодинамику в трубки»; замысел — разбор Codex): K закреплённых петель
    // считает hydro1d в фоновых потоках (hydro-worker.js). При 24 ч/с поверхности газ невидим (петля приходит к равновесию RTV быстрее кадра),
    // поэтому газ идёт на своих часах (по умолчанию 30×) на снимке поля: входы короны не принимаются, основания и форма стоят (жизнь
    // поверхности на это время останавливает стенд), камера свободна. Петли — яркие видимые замкнутые трубки, без пересева; невидимая
    // дольше 10 с уступает место. Профиль — свечение 174 Å в 64 точках линии (среднее по окну точки), смешение с RTV по свечению за 1,5 с
    const HK = o.hydroK || 8, HWK = o.hydroWorkers || 2, H_FADE = 1.5, H_LAGMAX = 1.5;   // петель, потоков; смешение, с; предел отставания часов газа (реальных с)
    const hyd = { act: false, want: false, rate: o.hydroRate || 30, lam: o.hydroLam || 0.15, w: [], epoch: 0, seq: 0, gen: 0, tGas: 0, slots: new Array(HK).fill(null), lastSel: -1e9, eff: 0, shown: null, cpu: 0, err: 0, lastErr: '' };
    const hProf = new Float32Array(TM * HK * 4), hProfTex = new THREE.DataTexture(hProf, TM, HK, THREE.RGBAFormat, THREE.FloatType);
    const hTab = new Float32Array(TN * 4), hTabTex = new THREE.DataTexture(hTab, 1, TN, THREE.RGBAFormat, THREE.FloatType);
    for (const t of [hProfTex, hTabTex]) { Object.assign(t, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, generateMipmaps: false, flipY: false }); t.needsUpdate = true; }
    tru.uHP = { value: hProfTex }; tru.uHT = { value: hTabTex };
    const hydFrozen = () => hyd.want && tubes.on;
    const resp174 = T => { const z = (Math.log10(Math.max(T, 1)) - 5.95) / 0.12; return Math.exp(-0.5 * z * z); };
    // поток: «занят» снимает только ответ на свой запрос (pend — номер; разбор Codex: устаревший ответ снимал занятость нового)
    function hydSpawn(W) { W.w = new Worker(o.hydroWorker || 'hydro-worker.js'); W.busy = false; W.pend = -1; W.sent = -1e9; W.w.onmessage = e => hydMsg(W, e.data);
      W.w.onerror = e => { hyd.err++; hyd.lastErr = String(e.message || e); }; W.w.postMessage({ op: 'epoch', epoch: hyd.epoch }); }
    function hydWorkers() { if (hyd.w.length) return true;
      try { for (let k = 0; k < HWK; k++) { const W = { k }; hydSpawn(W); hyd.w.push(W); } }
      catch (e) { hyd.lastErr = String(e && e.message || e); hyd.w.forEach(W => W.w && W.w.terminate()); hyd.w = []; return false; }
      return true; }
    // новая эпоха: ответы прежней отбрасываются, расчёты в потоках сброшены
    function hydEpoch() { hyd.epoch++; hyd.w.forEach(W => W.w.postMessage({ op: 'epoch', epoch: hyd.epoch })); }
    const slotOf = (id, gen) => hyd.slots.findIndex(S => S && S.k === id && S.gen === gen);
    function hydMsg(W, m) {
      if (m.op === 'profiles' && m.seq === W.pend) W.busy = false;
      if (m.epoch !== hyd.epoch) return;   // ответ прежнего снимка
      if (m.op === 'profiles') { hyd.cpu = hyd.cpu * 0.8 + m.cpuMs * 0.2;
        for (const it of m.items) { const si = slotOf(it.id, it.gen); if (si < 0) continue; const S = hyd.slots[si]; S.t = it.t; S.lag = it.lag; S.tot = it.totals; hProf.set(it.samples, si * TM * 4); S.ready = true; if (it.ms > 0) S.cost = S.cost == null ? it.ms : S.cost * 0.8 + it.ms * 0.2; }
        hProfTex.needsUpdate = true; }
      else if (m.op === 'created') { const si = slotOf(m.id, m.gen); if (si >= 0) { hyd.slots[si].N = m.N; hyd.slots[si].ms = m.ms; } }
      else if (m.op === 'error') { hyd.err++; hyd.lastErr = m.msg; const si = slotOf(m.id, m.gen); if (si >= 0) { hyd.slots[si].want = false; hyd.slots[si].dead = true; } } }
    // нагрев основания — по карте нагрева (та же билинейная выборка, что fh() в шейдере); карта на видеокарте — читается один раз на выбор
    function fhReader() { let d, W, H, st;
      if (bu.uFH.value === fhTex) { d = fhTex.image.data; W = 128; H = 64; st = 1; } else { const r = readHeat(); d = r.buf; W = r.W; H = r.H; st = 4; }
      const at = (i, j) => d[(Math.min(H - 1, Math.max(0, j)) * W + ((i % W) + W) % W) * st];
      return n => { const x = (((Math.atan2(n.z, n.x) / (2 * Math.PI)) % 1 + 1) % 1) * W - 0.5, y = Math.acos(Math.max(-1, Math.min(1, n.y))) / Math.PI * H - 0.5, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
        return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy; }; }
    function readTubesNow() { const prev = renderer.getRenderTarget(), gl = renderer.getContext(), len = new Float32Array(TN * 4), gas = new Float32Array(TN * 4);
      renderer.setRenderTarget(tLen); gl.readPixels(0, 0, 1, TN, 0x1908, 0x1406, len); renderer.setRenderTarget(tGas); gl.readPixels(0, 0, 1, TN, 0x1908, 0x1406, gas); renderer.setRenderTarget(prev); return { len, gas }; }
    function readRows(rt, y, h) { const buf = new Float32Array(TM * h * 4), prev = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.getContext().readPixels(0, y, TM, h, 0x1908, 0x1406, buf); renderer.setRenderTarget(prev); return buf; }
    // выбор петель: свободные места — яркими видимыми замкнутыми трубками (раз в 2 с); невидимая дольше 10 с — уступает место
    function hydSelect(nowS) {
      if (!hydWorkers()) return; const cdn = camS.clone().normalize(), vis = v => v.dot(cdn) > -0.15;
      for (const S of hyd.slots) if (S && S.want) { if (vis(S.dA) || vis(S.dM) || vis(S.dB)) S.hid = null; else if (S.hid == null) S.hid = nowS; else if (nowS - S.hid > 10) S.want = false; }
      const free = []; hyd.slots.forEach((S, i) => { if (!S) free.push(i); }); if (!free.length) return;
      const lt = readTubesNow(), pa = readRows(tPA, 0, TN), cands = [], v3 = (buf, j, i) => new THREE.Vector3(buf[(i * TM + j) * 4], buf[(i * TM + j) * 4 + 1], buf[(i * TM + j) * 4 + 2]);
      for (let k = 0; k < TN; k++) { const t = T[k], g = k * 4, Tk = lt.gas[g], pb = lt.gas[g + 1], Lr = lt.len[g];
        if (t.pin || lt.gas[g + 2] !== 1 || !(Tk > 0) || !(pb > 0) || !(lt.gas[g + 3] > 0) || Lr < 0.05 || Lr > 1.6) continue;
        if (nowS - t.born < T_FADE + 0.5 || t.die - nowS < 4) continue;
        const dA = v3(pa, 0, k).normalize(), dM = v3(pa, TM >> 1, k), dB = v3(pa, TM - 2, k).normalize(); if (!(vis(dA) || vis(dM.clone().normalize()) || vis(dB))) continue;
        const n = pb / Tk; cands.push({ k, dA, sc: n * n * resp174(Tk) * Lr * Math.sqrt(lt.gas[g + 3]), T: Tk, pb, Lr }); }
      cands.sort((a, b) => b.sc - a.sc); const used = hyd.slots.filter(Boolean).map(S => S.dA), fh = cands.length ? fhReader() : null;
      for (const c of cands) { if (!free.length) break; if (used.some(u => u.angleTo(c.dA) < 0.05)) continue;
        const S = hydCreate(c, free[0], fh); if (S) { free.shift(); used.push(S.dA); } } }
    // петля → фоновый поток: 64 точки (чётные — из tPA, нечётные — из tPB), длина вдоль линии, абсолютная высота, сечение ∝ 1/|B|
    function hydCreate(c, si, fh) { const ra = readRows(tPA, c.k, 1), rb = readRows(tPB, c.k, 1), P = [];
      for (let j = 0; j < TM; j++) { const b = j % 2 === 0 ? ra : rb, x = b[j * 4], y = b[j * 4 + 1], z = b[j * 4 + 2], B = b[j * 4 + 3], r = Math.hypot(x, y, z);
        if (![x, y, z, B].every(Number.isFinite) || !(B > 0) || r < 0.999) return null; P.push([x, y, z, B, r]); }
      if (P[TM - 1][4] > 1.01) return null;   // линия не дошла до второго основания
      const sS = new Float64Array(TM), ps = [0], ph = [(P[0][4] - 1) * R], pA = [1]; let mx = 1, mn = 1;
      for (let j = 1; j < TM; j++) { const ds = Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1], P[j][2] - P[j - 1][2]) * R; sS[j] = sS[j - 1] + ds;
        if (sS[j] > ps[ps.length - 1] + 1e3) { const A = P[0][3] / P[j][3]; mx = Math.max(mx, A); mn = Math.min(mn, A); ps.push(sS[j]); ph.push((P[j][4] - 1) * R); pA.push(A); } }
      if (ps.length < 8 || mx > 50 || mn < 0.02) return null;   // вырожденная линия или у нуля поля
      const dA = new THREE.Vector3(P[0][0], P[0][1], P[0][2]).normalize(), dB = new THREE.Vector3(P[TM - 1][0], P[TM - 1][1], P[TM - 1][2]).normalize(), dM = new THREE.Vector3(P[TM >> 1][0], P[TM >> 1][1], P[TM >> 1][2]).normalize();
      const FA = fh(dA), FB = fh(dB); if (!(FA > 0) || !(FB > 0)) return null;
      const cnt = hyd.w.map(W => hyd.slots.filter(S => S && S.wk === W.k).reduce((a, S) => a + (S.cost != null ? S.cost : 10 * S.Lr), 0)), wk = cnt.indexOf(Math.min(...cnt));
      const S = { k: c.k, gen: ++hyd.gen, wk, t0: hyd.tGas, t: 0, lag: 0, ready: false, want: true, blend: 0, dA, dB, dM, hid: null, Lr: c.Lr, T0: c.T, FA, FB, N: 0, tot: null };
      hyd.slots[si] = S; T[c.k].pin = true;
      hyd.w[wk].w.postMessage({ op: 'create', epoch: hyd.epoch, id: S.k, gen: S.gen, star: { R, M }, lch: 1.5e8, s: Float64Array.from(ps), h: Float64Array.from(ph), area: Float64Array.from(pA), sampleS: sS,
        heat: { FA, FB, lamA: hyd.lam, lamB: hyd.lam }, init: { Tcor: c.T, pb: c.pb } });
      return S; }
    function hydFree(si) { const S = hyd.slots[si]; if (!S) return; const W = hyd.w[S.wk]; if (W) W.w.postMessage({ op: 'drop', epoch: hyd.epoch, id: S.k, gen: S.gen });
      const t = T[S.k]; t.pin = false; t.die = Math.max(t.die, performance.now() / 1000 + 2 + 4 * Math.random()); hTab[S.k * 4] = hTab[S.k * 4 + 1] = 0; hyd.slots[si] = null; }
    // кадр: dt — реальные секунды кадра, run — время идёт (пауза стенда — газ стоит; скрытая вкладка — dt = 0)
    function hydroTick(dt, run) { const act = hydFrozen(), nowS = performance.now() / 1000, dtB = Math.min(0.25, Math.max(0, dt || 0)), dtG = Math.min(1, Math.max(0, dt || 0)); let ch = false;
      // смена режима (трубки или газ выключены/включены): выход — расчёты гаснут и сбрасываются; вход — прежние места освобождаются сразу,
      // снимок — заново (разбор Codex: старый газ возвращался на изменённую геометрию)
      if (act !== hyd.act) { hyd.act = act; hydEpoch(); hyd.tGas = 0; hyd.eff = 0; hyd.shown = null; hyd.lastSel = -1e9;
        for (let si = 0; si < HK; si++) { const S = hyd.slots[si]; if (!S) continue; if (act) { hydFree(si); ch = true; } else { S.want = false; S.dead = true; } } }
      for (let si = 0; si < HK; si++) { const S = hyd.slots[si]; if (!S) continue; const tg = act && S.want && S.ready ? 1 : 0, b0 = S.blend;
        S.blend = tg > S.blend ? Math.min(1, S.blend + dtB / H_FADE) : Math.max(0, S.blend - dtB / H_FADE);
        if (!tg && S.blend <= 0 && !(act && S.want)) { hydFree(si); ch = true; continue; }
        if (S.blend !== b0 || hTab[S.k * 4] !== si + 1) { hTab[S.k * 4] = si + 1; hTab[S.k * 4 + 1] = S.blend; ch = true; } }
      if (ch) hTabTex.needsUpdate = true;
      if (!act) return;
      // часы газа: dt·скорость, но не дальше самой отстающей петли + предел (устойчивое отставание — меньше фактическая скорость, без долга)
      let lo = Infinity; for (const S of hyd.slots) if (S && S.want && S.ready) lo = Math.min(lo, S.t0 + S.t);
      // часы газа — по реальному времени кадра (до 1 с; разбор Codex: предел смешения 0,25 с замедлял газ при низкой частоте кадров)
      if (run) hyd.tGas += dtG * hyd.rate; if (lo < Infinity) hyd.tGas = Math.min(hyd.tGas, lo + H_LAGMAX * hyd.rate);
      if (lo < Infinity && hyd.shown != null && dtG > 0 && run) hyd.eff += ((lo - hyd.shown) / dtG - hyd.eff) * Math.min(1, dtG / 2); hyd.shown = lo < Infinity ? lo : null;
      if (nowS - hyd.lastSel > 2) { hyd.lastSel = nowS; hydSelect(nowS); }
      for (const W of hyd.w) {
        // ответа нет 5 с — поток завис или упал: перезапуск, его петли гаснут (их состояние потеряно)
        if (W.busy && nowS - W.sent > 5) { W.w.terminate(); hyd.err++; hyd.lastErr = 'поток газа не ответил за 5 с — перезапущен'; for (const S of hyd.slots) if (S && S.wk === W.k) { S.want = false; S.dead = true; } hydSpawn(W); }
        if (W.busy || nowS - W.sent < 0.05) continue; const tg = [];   // профили — не чаще 20 раз в секунду
        for (const S of hyd.slots) if (S && S.wk === W.k && S.want && !S.dead) { const tt = Math.max(0, hyd.tGas - S.t0); if (!S.ready || tt > S.t + 1e-6) tg.push({ id: S.k, gen: S.gen, t: tt }); }
        if (tg.length) { W.busy = true; W.sent = nowS; W.pend = ++hyd.seq; W.w.postMessage({ op: 'advance', epoch: hyd.epoch, seq: W.pend, budgetMs: 40, targets: tg }); } } }
    function setHydro(v) { v = !!v; if (v === hyd.want) return; for (let si = 0; si < HK; si++) if (hyd.slots[si]) hydFree(si); hTabTex.needsUpdate = true;
      hyd.want = v; hyd.act = hydFrozen(); hydEpoch(); hyd.tGas = 0; hyd.eff = 0; hyd.shown = null; hyd.lastSel = -1e9; }
    function hydroStatus() { const sl = hyd.slots.filter(Boolean), rd = sl.filter(S => S.ready && S.want); let lo = Infinity; for (const S of rd) lo = Math.min(lo, S.t0 + S.t);
      return { on: hydFrozen(), want: hyd.want, rate: hyd.rate, eff: hyd.eff, n: rd.length, K: HK, age: lo < Infinity ? lo : 0, lagReal: lo < Infinity ? Math.max(0, hyd.tGas - lo) / hyd.rate : 0, cpu: hyd.cpu, err: hyd.err, lastErr: hyd.lastErr, workers: hyd.w.length,
        slots: sl.map(S => ({ k: S.k, gen: S.gen, wk: S.wk, L: S.Lr, T0: S.T0, FA: S.FA, FB: S.FB, t: S.t, lag: S.lag, blend: S.blend, N: S.N, Tmax: S.tot && S.tot.Tmax, dMass: S.tot && S.tot.dMass, heatErr: S.tot && S.t > 0 ? S.tot.heat / (S.t * S.tot.heatIn) - 1 : null })) }; }
    // ---- магнитный ковёр: узор сети (ячейки супергрануляции — Вороной по случайным центрам на сфере с шагом net, нагрев — на границах ячеек:
    // там собираются мелкие элементы поля) и слой ковра (проход CARP_FS — каждый кадр, по живой карте нагрева)
    const carp = { on: false, L: o.carpL || 0.03, net: o.carpNet || 0.043, lane: o.carpLane || 0.25, floor: o.carpFloor != null ? o.carpFloor : 0.05, clump: o.carpClump != null ? o.carpClump : 1, seed: o.carpSeed || 7, xL: o.carpXL || 0.3, xNu: o.carpXNu != null ? o.carpXNu : 1.5, moss: o.moss !== false };   // по снимку SDO/AIA 171 (16.10.2026): ν = 1,5 — профиль над краем; фон ячейки 0,05 и сгустки 1 — контраст сети
    const NW = 512, NH = 256, netData = new Uint8Array(NW * NH * 4), netTex = new THREE.DataTexture(netData, NW, NH, THREE.RGBAFormat, THREE.UnsignedByteType);
    Object.assign(netTex, { magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping, generateMipmaps: false, flipY: false });
    let netK = 4;   // множитель: узор хранится как N/4 в байте
    function makeNet() { const s0 = carp.net, n = Math.max(12, Math.round(4 * Math.PI / (0.866 * s0 * s0))); let a = carp.seed >>> 0;
      const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const P = new Float32Array(n * 3), grid = new Map(), key = (i, j, k) => (i + 512) * 1048576 + (j + 512) * 1024 + (k + 512);
      const sd = carp.seed * 7919, hsh = (i, j, k) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 2147483647) ^ sd; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
      const sm = t => t * t * (3 - 2 * t), vnoise = (x, y, z) => { const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = sm(x - i), fy = sm(y - j), fz = sm(z - k), L = (a, b, t) => a + (b - a) * t;
        return L(L(L(hsh(i, j, k), hsh(i + 1, j, k), fx), L(hsh(i, j + 1, k), hsh(i + 1, j + 1, k), fx), fy), L(L(hsh(i, j, k + 1), hsh(i + 1, j, k + 1), fx), L(hsh(i, j + 1, k + 1), hsh(i + 1, j + 1, k + 1), fx), fy), fz); };
      for (let i = 0; i < n; i++) { const z = 2 * rnd() - 1, ph = 2 * Math.PI * rnd(), r = Math.sqrt(1 - z * z); P[3 * i] = r * Math.cos(ph); P[3 * i + 1] = z; P[3 * i + 2] = r * Math.sin(ph);
        const g = key(Math.floor(P[3 * i] / s0), Math.floor(P[3 * i + 1] / s0), Math.floor(P[3 * i + 2] / s0)); let b = grid.get(g); if (!b) grid.set(g, b = []); b.push(i); }
      const val = new Float32Array(NW * NH); let sum = 0, wsum = 0;
      for (let y = 0; y < NH; y++) { const th = Math.PI * (y + 0.5) / NH, st = Math.sin(th), ct = Math.cos(th), wy = st;
        for (let x = 0; x < NW; x++) { const ph = 2 * Math.PI * (x + 0.5) / NW, vx = st * Math.cos(ph), vy = ct, vz = st * Math.sin(ph), gi = Math.floor(vx / s0), gj = Math.floor(vy / s0), gk = Math.floor(vz / s0); let d1 = 9, d2 = 9;
          for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) { const b = grid.get(key(gi + di, gj + dj, gk + dk)); if (!b) continue;
            for (const i of b) { const dx = vx - P[3 * i], dy = vy - P[3 * i + 1], dz = vz - P[3 * i + 2], q = dx * dx + dy * dy + dz * dz; if (q < d1) { d2 = d1; d1 = q; } else if (q < d2) d2 = q; } }
          // сгустки: шум масштаба трети ячейки рвёт границы на обрывки и пятна у узлов (на снимках 17,1 нм сеть — пятнистая, не сплошные стенки)
          const ns = 3 / s0, cl = vnoise(vx * ns, vy * ns, vz * ns), clump = 1 - carp.clump + carp.clump * 2 * Math.min(1, Math.max(0, (cl - 0.35) / 0.4));
          const e = (Math.sqrt(d2) - Math.sqrt(d1)) / s0, w = carp.floor + Math.exp(-(e / carp.lane) * (e / carp.lane)) * clump; val[y * NW + x] = w; sum += w * wy; wsum += wy; } }
      const m = sum / wsum; let mx = 0; for (let k = 0; k < val.length; k++) { val[k] /= m; mx = Math.max(mx, val[k]); } netK = Math.max(1, mx);
      for (let k = 0; k < val.length; k++) { const v = Math.round(255 * Math.min(1, val[k] / netK)); netData[4 * k] = netData[4 * k + 1] = netData[4 * k + 2] = v; netData[4 * k + 3] = 255; }
      netTex.needsUpdate = true; }
    const carpRT = new THREE.WebGLRenderTarget(512, 256, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping, depthBuffer: false, stencilBuffer: false });
    const cu = Object.assign({}, bu, { uNet: { value: netTex }, uCW: { value: 512 }, uCH: { value: 256 }, uCL: { value: carp.L }, uNetK: { value: 4 }, uXL: { value: carp.xL }, uXNu: { value: carp.xNu } });
    const carpMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: CARP_FS, uniforms: cu, depthTest: false, depthWrite: false });
    const mossRT = new THREE.WebGLRenderTarget(512, 256, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping, depthBuffer: false, stencilBuffer: false });
    const mossMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: MOSS_FS, uniforms: cu, depthTest: false, depthWrite: false });
    let netMade = false;
    function carpFrame() { if (!carp.on) return; if (!netMade) { makeNet(); netMade = true; } cu.uCL.value = carp.L; cu.uNetK.value = netK; cu.uXL.value = carp.xL; cu.uXNu.value = carp.xNu; pass(carpMat, carpRT); ru.uCarp.value = carpRT.texture; ru.uNet2.value = netTex; ru.uNetK2.value = netK;
      ru.uCarpRs.value = 1 + 6 * carp.L / Math.PI; ru.uExtRs.value = 1 + 6 * 0.5 * KB * 2e6 * R / (MU * MP * G * M); ru.uMossRs.value = 1 + 6 * ru.uMossH.value;
      if (carp.moss) { pass(mossMat, mossRT); ru.uMoss.value = mossRT.texture; } else ru.uMoss.value = blackTex; }
    const blackTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat); blackTex.needsUpdate = true;
    function setCarpet(v) { if (v && typeof v === 'object') { const remake = ['net', 'lane', 'floor', 'clump', 'seed'].some(k => v[k] != null && v[k] !== carp[k]); Object.assign(carp, v); if (remake) netMade = false; } else carp.on = !!v; ru.uCarpOn.value = carp.on ? 1 : 0; }
    // слой k объёма (для проверок): Float32Array Nφ·Nθ·4 — свечение, метка основания
    function readLayer(k) { const buf = new Float32Array(o.Np * o.Nt * 4), prev = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
      renderer.setRenderTarget(vols[iF], k, 0); renderer.getContext().readPixels(0, 0, o.Np, o.Nt, 0x1908, 0x1406, buf); renderer.setRenderTarget(prev, face, mip); return buf; }
    function dispose() { carpRT.dispose(); carpMat.dispose(); netTex.dispose(); mossRT.dispose(); mossMat.dispose(); blackTex.dispose(); hyd.w.forEach(W => W.w && W.w.terminate()); hyd.w = []; hProfTex.dispose(); hTabTex.dispose(); [tLen, tGas, tLum, tPA, tPB].forEach(r => r.dispose()); tLumMat.dispose(); if (tubes.acc) tubes.acc.dispose(); tSeed.dispose(); [tLenMat, tPtMat, tGasMat, tRenMat].forEach(m => m.dispose()); tGeo.dispose(); base.dispose(); if (detail) detail.dispose(); JL.dispose(); geos.forEach(v => v.dispose()); emitMat.dispose(); if (halfRT) halfRT.dispose(); upMat.dispose(); uq.geometry.dispose(); gridRT.dispose(); gridMat.dispose(); heatRT.dispose(); if (heat2) heat2.dispose(); heatMat.dispose(); hquad.geometry.dispose(); vols.forEach(v => v.dispose()); fhTex.dispose(); bakeMat.dispose(); rayMat.dispose(); quad.geometry.dispose(); rq.geometry.dispose(); }
    return { setTubes: v => { tubes.want = !!v; if (v) tubes.on = true; }, setTubeDim: k => { ru.uTK.value = Math.min(1, Math.max(0, +k || 0)); }, setCarpet, carpet: () => Object.assign({}, carp), readMoss: () => { const b = new Float32Array(512 * 256 * 4), prev = renderer.getRenderTarget(); renderer.setRenderTarget(mossRT); renderer.getContext().readPixels(0, 0, 512, 256, 0x1908, 0x1406, b); renderer.setRenderTarget(prev); return b; }, readCarp: () => { const b = new Float32Array(512 * 256 * 4), prev = renderer.getRenderTarget(); renderer.setRenderTarget(carpRT); renderer.getContext().readPixels(0, 0, 512, 256, 0x1908, 0x1406, b); renderer.setRenderTarget(prev); return b; }, setHydro, hydroTick, hydroStatus, hydroFrozen: hydFrozen, setHydroRate: r => { hyd.rate = Math.max(1, Math.min(1000, +r || 30)); },
      _tubes: () => ({ tru, tRenMat, tMesh, tScene, tGeo, camL, T, phiP, phiN, mixP, mixN, lamPole, lumBuf, lam0: () => lam0, omMax: omMaxLast, slotsFree: sFree.length }), setTubeFill: f => { tru.uFill.value = Math.min(1, Math.max(0.005, f)); },
      tubesDebug: () => { const prev = renderer.getRenderTarget(), gl = renderer.getContext(), pa = new Float32Array(TM * TN * 4); renderer.setRenderTarget(tPA); gl.readPixels(0, 0, TM, TN, 0x1908, 0x1406, pa);
        let acc = null; if (tubes.acc) { acc = new Float32Array(tubes.acc.width * tubes.acc.height * 4); renderer.setRenderTarget(tubes.acc); gl.readPixels(0, 0, tubes.acc.width, tubes.acc.height, 0x1908, 0x1406, acc); }
        renderer.setRenderTarget(prev); return { pa, acc, accW: tubes.acc && tubes.acc.width, accH: tubes.acc && tubes.acc.height, seed: tSeedData.slice(0, 40) }; }, tubesOn: () => tubes.on, setPoles: pv => { if (!hydFrozen()) tubes.poles = pv; },
      readTubes: () => { const prev = renderer.getRenderTarget(), b1 = new Float32Array(TN * 4), b2 = new Float32Array(TN * 4); renderer.setRenderTarget(tLen); renderer.getContext().readPixels(0, 0, 1, TN, 0x1908, 0x1406, b1); renderer.setRenderTarget(tGas); renderer.getContext().readPixels(0, 0, 1, TN, 0x1908, 0x1406, b2); renderer.setRenderTarget(prev); return { len: b1, gas: b2 }; },
      diag: () => base.diag(), bake, live, look, prepMeasure, emitLive, detail: () => ({ on: DET.on, any: detAny, px: detPx, allow: detAllow, layer: detail }), setDetail: v => { detAllow = !!v; }, measureEmit, inputs: (C, fh, ng) => { if (!hydFrozen()) setInputs(C, fh, ng); }, beginBake, stepBake, stepFade, setFrame, busy: () => !!job, building: () => !!job, measureLayer, measureSurf, readHeat, readSurf, buildGrid, readGrid: k => { const buf = new Float32Array(GNp * GNt * 4), prev = renderer.getRenderTarget(); renderer.setRenderTarget(gridRT, k, 0); renderer.getContext().readPixels(0, 0, GNp, GNt, 0x1908, 0x1406, buf); renderer.setRenderTarget(prev); return { buf, GNp, GNt, GNr }; }, charges: () => bu.uNC.value, bakeUniforms: bu, volUniforms: bv, calibrate, render, weight, readLayer, dispose, stats: () => S, opts: o, uniforms: ru };
  }
  const api = { create, supported, furNorm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.M31Corona = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
