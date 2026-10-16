// М31 · модель звезды вблизи: поверхность, арки, вспышка и корональный выброс (DOC «Вспышки звезды цели — проект v1», шаг В5).
// Общая для игры (space3d.js) и стенда (PROTOTYPE/star-lab): параметры — в DEFAULTS, стенд правит их ползунками.
// Арки — силовые линии поля магнитных полюсов: модель автора из Houdini (F:\_ZUEV\Showreel\logo4.hip, сеть MagneticFields:
// volumewrangle1 — поле — сумма q·(P − p)/|P − p|^k по полюсам, volumetrail — линии от «+» к «−»). Полюса — пары у активных
// областей, источники под поверхностью (над пятном поле вертикальное — линии встают аркой). Поверхность — шейдер: грануляция,
// потемнение к краю, пятна и факелы у полюсов. Вспышка — ленты у основания главной арки; выброс — петля протуберанца
// поднимается и раскручивается, за ней расширяется фронт из волокон с ярким ободом, внизу — аркада послевспышечных петель.
// Всё — нитями и частицами, без мягкого ореола (реестр интерфейса, п. 22). Геометрия — в радиусах звезды (группа без масштаба)
(function (root) {
  'use strict';
  const R_SUN_KM = 696000;
  // параметры: «геометрия» — пересборка (полюса, линии, частицы), остальное — униформы, меняются на лету
  const DEFAULTS = {
    // поверхность
    // rim, rimPow — светящаяся кромка звезды по Френелю: сила и резкость (0 — нет; в игре нет)
    rim: 0, rimPow: 4,
    // granPhys — грануляция по расчётам конвекции M-карликов (стенд; в игре 0 — прежний рисунок): granKm — размер гранулы, км, granRms —
    // СКО яркости, granTau — смена рисунка, с показа (замедлено: настоящая гранула живёт ≈ 100 с)
    granPhys: 0, granKm: 150, granRms: 0.015, granTau: 4,
    // стенд, этапы 0–1 (labPhysics 1 — только из стенда): labLH — целевая мощность нагрева, эрг/с; labCarpetG — «ковёр», Гс; labVh — скорость
    // перемешивания оснований, км/с; labTanTh — наклон поля (tgθ); labSteady — доля выпуска сразу; labTau, labTauPulse — утечка запаса и
    // импульса, с; labEtaH — доля в корону; labPlageK, labPulseK — яркость факелов и импульсов из карты; labFreezeField — заморозить поле
    labPhysics: 0, labLH: 3e27, labCarpetG: 500, labVh: 0.3, labTanTh: 0.1, labSteady: 0.8, labTau: 3000, labTauPulse: 100, labEtaH: 0.8, labPlageK: 0.35, labPulseK: 1, labFreezeField: 0, labMapView: 0,
    // стенд, фотосфера «как видит глаз» (photosphere.js): labEye — включить; labExpEV — экспозиция камеры, ступени (0 — у центра диска
    // наибольший канал 0,8 после кривой — колено); labCurve — кривая камеры: 1 — по каналам, как плёнка и матрица (пересвет через жёлтый),
    // 0 — по наибольшему каналу (настоящая цветность звезды сохраняется); labSpotDT, labPenDT — тень и полутень холоднее фотосферы на столько K (M-карлики: 200–400 K, Berdyugina 2005;
    // по умолчанию 300); labPenK — радиус полутени в радиусах тени (1 — без полутени: у M-карликов не доказана); labFacK — сила факелов;
    // labUBVRI — фотометрия звезды U B V R I (цвет по спектру; нет — Планк при T_eff); labTeff — измеренная T_eff, K (0 — по классу); labSpotIrr — неровность края тени (СКО относительного радиуса; 0 — круг)
    labEye: 0, labExpEV: 0, labCurve: 1, labSpotDT: 300, labPenDT: 100, labPenK: 1, labFacK: 1, labUBVRI: null, labTeff: 0, labSpotIrr: 0.1,
    granScale: 90, granContrast: 0.26, superScale: 14, limbA: 0.62, limbB: 0.22, limbRed: 0.45, spotSize: 0.018, spotGrow: 0.016, plage: 0.5, plageWidth: 0.006,
    satBoost: 0.25, bright: 1.1,
    // области и полюса (геометрия). open — радиальный фон открытого поля ∝ 1/r² («монополь» в центре — допустимый простой фон; в
    // Houdini — normalize(P) без затухания): поле фона равно полю полюса силы 1 на расстоянии 1/√open R★; 0 — без фона.
    // rSS — поверхность источника (модель PFSS), R★: заряды-изображения, линии, дошедшие до неё, — открытые; 0 — без неё
    regions: 10, limbShare: 0.67, sepMin: 0.1, sepMax: 0.3, qMin: 0.45, qMax: 1.25, flareSep: 0.26, flareQ: 1.5, poleDepth: 0.06, falloff: 2, open: 0, rSS: 0,
    // арки (геометрия): archMode — 0 трубки по силовым линиям, 1 плазма частицами по нитям поля, 2 и то и другое, 3 частицы в поле и
    // гравитации (без нитей; fp… — её параметры)
    archMode: 0, seedsBase: 14, seedsPerQ: 14, seedRMin: 0.01, seedRMax: 0.035, topMin: 0.015, topMax: 0.32, chordMin: 0.05, chordMax: 0.45, minAspect: 0.22,
    tubeR: 0.0045, tubeRq: 0.004,
    // арки (вид)
    archBright: 1.1, flowSpeed: 1.4, flowFreq: 46, sway: 0.0025,
    // плазма на нитях (литература — DOC «Вспышки звезды цели — проект v1», «Сравнение с литературой»): spotG — поле над сильнейшим
    // полюсом, Гс (калибровка единиц поля); нагрев E_H = heat·1,8·10⁻³·(B̄/100 Гс)^heatB·(L/50 тыс. км)^heatL эрг/(см³·с) (по Schrijver
    // et al. 2004 — ∝ B·L⁻²; при heat 1 петля Солнца L = 50 тыс. км, B̄ = 100 Гс — 3 МК); eps — расширение трубки (сечение ∝ B^−eps; 0 —
    // ровная; 1 — трубка поля, A ∝ 1/B: течение быстрое у полюсов, медленное на вершинах, на открытых линиях ветер разгоняется наружу); openN — давление у основания открытых линий, доля от типичной петли (2 дин/см²);
    // flowKms — течение у основания, км/с; tDyn — секунд показа на динамическое время R★/v_esc (сжатие времени);
    // pN — частиц; pSize — точка, R★; pTrail — штрих: выдержка, с показа (0 — точки); pBright — яркость;
    // поверхность (только плазма, стенд): surface 1 — полюса самостоятельные (всплытие, блуждание, уничтожение потока, старение);
    // surfH — часов поверхности на секунду показа; driftKms — скорость течения поверхности (среднеквадратичная), км/с; driftScale — размер
    // вихрей течения, R★; corrH — за сколько часов рисунок течения меняется; sepKms
    // км/с; emergeH, sepStopH — всплытие потока и конец расхождения, ч; lifeDays — старение комплексов, сут; birthH — новая пара в
    // среднем раз в столько часов; clusterFrac — доля рождений рядом с полюсами; polesTarget — сколько полюсов держать (≤ 64);
    // поток рождающейся пары — степенной закон N(Φ) ∝ Φ^−fluxSlope на pairQLo…pairQHi (в единицах |q|; рождения −2,7 — Thornton & Parnell
    // 2011); полный срок жизни ∝ потоку (условно, по Гневышеву — Вальдмайеру): lifeDays·clamp(q, 0,1, 1) — у живых наклон ≈ −1,7 (наблюдаемые
    // концентрации −1,85 — Parnell et al. 2009); latBias — перевес к экватору: плотность по широте ∝ cos^(1+latBias) (0 — равномерно);
    // spotBs — поле тени пятна, Гс (размер тени: площадь = Φ/B_s)
    // spreadKm2s — расплывание распадающихся областей (стенд): коэффициент диффузии потока по поверхности, км²/с (Солнце — 250–600 по
    // блужданию сетки; у M-карликов не измерен; 0 — нет, как в игре); источник полюса уходит глубже — поле на поверхности шире и слабее;
    // пара после расхождения плывёт целиком; spreadDMax — предел глубины, R★ (эмпирический: дальше поток должен уходить в общий фон)
    // cancRate — уничтожение потока, доля меньшего исходного в час; heatC — добавка нагрева, эрг/(см³·с) при 5·10¹⁹ Мкс/ч; heatE — то же
    // от всплытия потока (молодые петли); birthBright — яркость точек и факела всплытия на поверхности
    // flowBoost — ускорение течений для показа (настоящие 5–30 км/с при нашем сжатии времени почти не видны; соотношения скоростей — физические)
    spotG: 3000, heat: 1, heatB: 1, heatL: -2, eps: 1, aMax: 1.3, csEta: 0.3, openN: 0.05, flowKms: 20, flowBoost: 10, tDyn: 6,
    // ветер (открытые линии): за поверхностью источника — радиально до windR R★; скорость растёт от flowKms к windKms на масштабе windAcc R★
    // (ветер Паркера разгоняется; у M-карликов скорость не измерена — порядка скорости убегания); сечение ∝ r², плотность n = F/(A·v);
    // частицы расходятся по раздувающейся трубке (windSpread — радиус трубки на 1 R★ высоты) с турбулентной рябью (windTurb, альвеновские
    // колебания и сгустки) и гаснут с освещённостью (рассеянный свет ∝ 1/r²)
    // windTexp — остывание ветра T ∝ r^−windTexp за 1,5 R★ (плазма остывает медленнее адиабаты r^−4/3: теплопроводность электронов и нагрев
    // турбулентностью; Parker Solar Probe: электроны r^−0,65, протоны r^−0,5…−1); windShow — доля частиц ветра для показа, × к массе;
    // windFade — яркость частицы ветра ∝ (1,3/r)^windFade (освещённость звездой — 2; для показа мягче)
    // windGrow — порция ветра при расширении: размер точки 1 + windGrow·h (h — высота, R★)
    // уровень детализации (стенд): lodN — частиц мелких пар, lodPairs — пар в показе, lodSeeds — нитей на пару, lodBands — полудекад
    // ниже 4·10²⁰ Мкс (до 7), lodBright — яркость
    // seedQuota — предел затравок крупных (нитей); pMassPow — доля частиц нити ∝ масса^pMassPow (1 — строго по массе)
    seedQuota: 360, pMassPow: 0.5,
    // growKms — скорость роста новой нити от полюса к полюсу, км/с (показ — с flowBoost)
    growKms: 150,
    // освобождённая плазма: orphBweak — ниже этого поля (Гс) не удерживается полем, становится облаком; orphCloud — скорость блуждания
    // облака, R★/с; orphLife — сколько живёт, с
    orphBweak: 5, orphCloud: 0.04, orphLife: 6,
    // частицы в поле (archMode 3): fpN — частиц; fpVinj — испарение у основания, км/с; fpCool — остывание, с показа; fpLife — предел жизни, с;
    // fpTmax — T горячей, МК (тепловой разброс скоростей → шкала высот); rainTerm — предельная скорость дождя, км/с (задаёт трение)
    // fpTime — ускорение хода времени плазмы для показа (скорости и тяжесть — вместе)
    // fpPts — точек вылета на поверхности; на видеокарте вес — у пятен: доля пятна ∝ |q|^fpQpow, ширина — fpSpotW теней; на процессоре —
    // fpBfloor — фон поля без нагрева, Гс, fpBpow — вес ∝ (B − фон)^fpBpow
    // fpGpuN — частиц на видеокарте (квадрат стороны текстуры)
    // fpSupport — доля тяжести, снятая с горячей плазмы давлением (струйки на видеокарте)
    // fpMoveEm — точки вылета движутся вместе с полем (1) или неподвижны на поверхности (0)
    // fpSplat — размер пятна порции плазмы (толщина трубки), R★
    // fpField — плазма как среда (плотность в текстуре, 1) или точки (0); fpFieldK — яркость среды
    // ветер (частицы в поле): fpWind — вкл., fpWindT — T короны для Паркера, МК, fpWindOn — с какой высоты, R★, fpWindTau — выход на скорость ветра, с
    fpWind: 1, fpWindT: 2, fpWindOn: 1.3, fpWindTau: 0.5,
    // облака (частицы в поле): fpCloudRate — темп отрыва у вершин петель под открытым полем, fpCloudOn — с какой высоты, R★
    // fpCloudBright — яркость сгустков (в белом свете их видно по плотности: рассеяние на электронах)
    // fpCloudIn — доля нисходящих половин пары (сокращающиеся петли), fpCloudInV — их начальная скорость, км/с
    // fpCloudSize — пятно порции облака в толщинах струйки (облако — мягкий сгусток, не искры)
    // fpBrVar — разброс яркости порций (σ логнормального множителя, среднее 1)
    fpBrVar: 0.6,
    fpCloudRate: 6, fpCloudOn: 1.25, fpCloudBright: 10, fpCloudSize: 5, fpCloudDbg: 0, fpCloudIn: 0.4, fpCloudInV: 60,
    fpGpuN: 262144, fpSupport: 0.95, fpMoveEm: 1, fpSplat: 0.015, fpField: 0, fpFieldK: 0.15, fpN: 12000, fpVinj: 150, fpCool: 8, fpLife: 30, fpTmax: 2.5, rainTerm: 70, fpTime: 10, fpPts: 12000, fpBfloor: 60, fpBpow: 0.5, fpQpow: 0.5, fpSpotW: 1.5,
    lodN: 4000, lodPairs: 32, lodSeeds: 3, lodBands: 7, lodBright: 1,
    // облака, отрывающиеся от вершин высоких петель: puffN — частиц, puffPerDay — в сутки поверхности, puffKms — скорость при отрыве, км/с,
    // puffLen — длина сгустка вдоль линии при отрыве, R★, puffBright — яркость, puffNear — насколько близко вершина петли к открытой линии, R★
    puffN: 3000, puffPerDay: 6, puffKms: 100, puffLen: 0.12, puffBright: 1, puffNear: 0.15,
    windR: 2.5, windKms: 500, windAcc: 1.5, windSpread: 0.35, windTurb: 0.1, windTexp: 0.65, windShow: 10, windFade: 1.5, windGrow: 3,
    // испарение при вспышке (частиц, км/с, МК, остывание и торможение — с показа, яркость) и корональный дождь (частиц, доля силы
    // тяжести, предел скорости км/с, яркость)
    evN: 3000, evKms: 300, evT: 20, evCool: 4, evDamp: 1.2, evBright: 0.7, rainN: 300, rainF: 0.4, rainCap: 90, rainBright: 0.5,
    // протуберанец — холодное ядро жгута (частиц, яркость); цвет: colorMode 0 — видимый свет (глаз: рассеянный свет звезды с оттенком
    // корональных линий, доля — lineMix), 1 — ультрафиолет (условные цвета каналов SDO/AIA)
    promN: 1500, promBright: 0.8, colorMode: 0, lineMix: 0.3,
    pN: 20000, pSize: 0.004, pTrail: 1.5, pBright: 1,
    surface: 0, surfH: 24, driftKms: 0.05, driftScale: 0.6, corrH: 240, sepKms: 0.229, emergeH: 24, sepStopH: 60, lifeDays: 150, birthH: 72, clusterFrac: 0.2, polesTarget: 64, cancRate: 0.00567, heatC: 0.02, heatE: 0.015, birthBright: 1.6,
    fluxSlope: 2.7, pairQLo: 0.08, pairQHi: 1.5, latBias: 1, spotBs: 3000, spreadKm2s: 0, spreadDMax: 0.5,
    // плавание пятен (стенд; 0 — нет, как в игре): labProtD — период вращения звезды, сут (звезда поворачивается целиком по часам поверхности,
    // физика — в системе звезды; Проксима — 83,1 сут, Wargelin et al. 2017); в системе, вращающейся с этим периодом: labOmEq — Ω_экв − Ω_системы,
    // labDOm — перепад экватор − полюс ΔΩ, рад/сут (Ω(λ) = Ω_экв − ΔΩ·sin²λ; у Проксимы не измерен); labVmer — меридиональное течение к полюсам,
    // м/с (v = v_m·sin 2λ; не измерено); labDspot — случайное блуждание пятен, км²/с (скорость — процесс Орнштейна — Уленбека с временем labOuH ч;
    // не измерено); pairRigid — пара после расхождения плывёт целиком (как при расплывании, но без него)
    labProtD: 0, labOmEq: 0, labDOm: 0, labVmer: 0, labDspot: 0, labOuH: 12, pairRigid: 0,
    // вспышка и выброс
    // вспышка и выброс. Выброс — по литературе (DOC «Вспышки…», «Сравнение с литературой — корональный выброс»): жгут медленно
    // поднимается (slowKms, км/с) до высоты срыва, где показатель спада внешнего поля n превышает ncr (тороидальная неустойчивость,
    // Kliem & Török 2006), дальше разгоняется силой ∝ ropeDrive·(n − ncr) против силы тяжести; в устойчивой полосе тормозится и
    // останавливается — запертое извержение, вещество стекает дождём. dipoleG — крупномасштабный диполь звезды, Гс на полюсе (ось — ось
    // вращения Y, как у полностью конвективных M: Morin et al. 2008, 2010; якоря вспышки — на широте 20°): сильный диполь запирает выбросы (Alvarado-Gómez et al. 2018). cmeEscape — уходящий выброс
    // по сценарию (1): разгон выше местной скорости убегания. Режим трубок (игра, шаг В5) — прежняя анимация выброса по времени:
    // ropeH — подъём петли, R★, frontR — радиус фронта, R★; ни диполя, ни потемнения
    cycle: 18, flashDecay: 1.8, ropeH: 1.05, ropeW: 4.5, frontR: 0.88, frontBright: 1.4, ribbons: 2.5, dipoleG: 0, dipoleTilt: 0, ncr: 1.5, ropeDrive: 2, slowKms: 30, cmeEscape: 0, dimming: 0.25,
    ropeN: 5000, frontN: 9000, arcadeN: 2400
  };
  const GEOM = ['regions', 'limbShare', 'sepMin', 'sepMax', 'qMin', 'qMax', 'flareSep', 'flareQ', 'poleDepth', 'falloff', 'open', 'rSS', 'archMode', 'seedsBase', 'seedsPerQ',
    'seedRMin', 'seedRMax', 'topMin', 'topMax', 'chordMin', 'chordMax', 'minAspect', 'tubeR', 'tubeRq', 'ropeN', 'frontN', 'arcadeN', 'satBoost',
    'spotG', 'heat', 'heatB', 'heatL', 'eps', 'aMax', 'csEta', 'openN', 'pN', 'puffN', 'lodN', 'fpN', 'fpPts', 'fpGpuN', 'spotBs', 'labPhysics', 'labLH', 'labCarpetG', 'labVh', 'labTanTh', 'labSteady', 'labTau', 'labTauPulse', 'labEtaH', 'fpField', 'pTrail', 'evN', 'rainN', 'promN', 'surface', 'polesTarget', 'fluxSlope', 'pairQLo', 'pairQHi', 'latBias', 'dipoleG', 'ncr', 'ropeDrive', 'slowKms', 'cmeEscape', 'tDyn', 'cycle', 'spreadKm2s', 'spreadDMax', 'labEye', 'labSpotDT', 'labPenDT', 'labUBVRI', 'labTeff'];
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // ---- класс звезды: модель для всех звёзд каталога. Спектр — первый компонент («G2V + K1V» → G2V; номер компонента — comp).
  // Температура — по классу и подклассу (главная последовательность; белые карлики — свои); цвет — по температуре; радиус —
  // по классу и классу светимости; активность (пятна, арки, вспышки) — у конвективных звёзд (F–M), у A, B, O и белых карликов
  // поверхность гладкая. Значения — ориентиры для показа, не измерения отдельных звёзд
  const T_MS = { O: [42000, 33000], B: [30000, 10500], A: [9800, 7500], F: [7300, 6000], G: [5900, 5300], K: [5200, 3950], M: [3850, 2400] };
  function classOf(sp, comp) {
    const parts = String(sp || 'G2V').split('+').map(x => x.trim()).filter(Boolean), s = (parts[Math.min(parts.length - 1, comp | 0)] || 'G2V').replace(/:/g, '');
    // белый карлик: DA, DB, DC, DQ, DZ… (строчная «d» — карлик главной последовательности)
    if (/^D[A-Z]/.test(s)) { const k = parseFloat(s.replace(/^D[A-Z]*/i, '')) || 5; return { cls: 'D', sub: k, lum: 'D', teff: Math.round(50400 / Math.max(1, k)), parts }; }
    const m = /^(sd|esd|d)?([OBAFGKMLT])\s*(\d+(\.\d+)?)?\s*([IV]+[ab]?|[IV]+-[IV]+)?/i.exec(s.replace(/^[a-z]+(?=[OBAFGKM])/, '')) || [];
    const cls = (m[2] || 'G').toUpperCase(), sub = m[3] != null ? +m[3] : 5, lum = (m[5] || 'V').toUpperCase();
    const r = T_MS[cls] || T_MS.G, teff = Math.round(r[0] + (r[1] - r[0]) * Math.min(1, sub / 9.5));
    return { cls, sub, lum: /^I(?!I|V)/.test(lum) ? 'I' : /^III|^II/.test(lum) ? 'III' : /^IV/.test(lum) ? 'IV' : 'V', teff, parts };
  }
  // цвет по температуре (приближение излучения абсолютно чёрного тела в sRGB)
  function teffColor(T) {
    const t = T / 100; let r, g, b;
    r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    const c = x => Math.max(0, Math.min(255, Math.round(x)));
    return (c(r) << 16) | (c(g) << 8) | c(b);
  }
  // фоновые течения поверхности (стенд): дифференциальное вращение и меридиональное течение, скорость в R★/ч в точке c (единичный вектор, ось Y —
  // ось вращения): v_φ = cosλ·(Ω_экв − Ω_сист − ΔΩ·sin²λ) (рад/сут → /24), меридиональное ċ = (2v_m/R)·c_y·(ŷ − c_y·c) — к полюсам при v_m > 0,
  // на полюсах — ноль (разбор Codex 15.10.2026)
  function bgVel(c, p, RK, out) { const y = c.y, w = ((p.labOmEq || 0) - (p.labDOm || 0) * y * y) / 24, vm = 2 * (p.labVmer || 0) * 3.6 / RK;
    out.set(w * c.z, 0, -w * c.x);   // ω·(ŷ × c) — вращение вокруг Y в ту же сторону, что и звезда
    return out.set(out.x - vm * y * y * c.x, out.y + vm * y * (1 - y * y), out.z - vm * y * y * c.z); }
  // фаза вращения звезды, рад: часы поверхности (ч) и период (сут)
  const rotAngle = (clockH, Pd) => Pd > 0 ? (2 * Math.PI * clockH / (24 * Pd)) % (2 * Math.PI) : 0;
  // нормальное случайное число по (семя, номер, тик, компонента) — воспроизводимо, без общего генератора (порядок не важен)
  const hnorm = (a, b, c, d) => { const h = i => { let x = Math.imul((a ^ Math.imul(b, 0x9e3779b1) ^ Math.imul(c, 0x85ebca6b) ^ Math.imul(d * 2 + i, 0xc2b2ae35)) >>> 0, 0x27d4eb2d) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d) >>> 0; x ^= x >>> 12; return ((x >>> 8) + 0.5) / 16777216; };
    return Math.sqrt(-2 * Math.log(h(0))) * Math.cos(2 * Math.PI * h(1)); };
  // семя узора тени — по постоянному номеру пятна uid (не по слоту): целочисленный хеш → [0, 1)
  const spotSeed = uid => { let h = Math.imul((uid | 0) + 0x9e3779b9, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16; return (h >>> 8) / 16777216; };
  // контур тени (как в шейдере STAR_FS, ветка LAB_EYE): относительный радиус r(θ)/rL при фазах ph[k−2], k = 2…7
  const SPOT_W = [2, 3, 4, 5, 6, 7].map(k => 3.217388 * Math.pow(k, -1.5));
  const spotOutline = (th, ph, eps) => { let s = 0; SPOT_W.forEach((w, j) => { s += w * Math.cos((j + 2) * th + ph[j]); }); return (1 + eps * s) / Math.sqrt(1 + eps * eps); };
  // излучение абсолютно чёрного тела в линейных sRGB (стенд: фотосфера «как видит глаз»): B_λ(T) × кривые чувствительности CIE 1931 2°
  // (аналитическое приближение Wyman, Sloan & Shirley 2013) по 380–780 нм шагом 1 нм → XYZ → линейные sRGB (белая точка D65, без
  // хроматической адаптации — камера с дневным балансом белого); ответ [R, G, B, Y] в условных единицах (Y — яркость; масштаб общий для всех T)
  function planckRGB(T) {
    const g = (l, m, s1, s2) => { const t = (l - m) / (l < m ? s1 : s2); return Math.exp(-0.5 * t * t); };
    let X = 0, Y = 0, Z = 0;
    for (let l = 380; l <= 780; l += 1) {
      const B = 1 / (Math.pow(l * 1e-3, 5) * (Math.exp(1.438777e7 / (l * T)) - 1));   // ∝ B_λ: c₂ = hc/k = 1,438777·10⁷ нм·К, λ в мкм для масштаба
      X += B * (1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2));
      Y += B * (0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1));
      Z += B * (1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8)); }
    return [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z, Y, X / (X + Y + Z), Y / (X + Y + Z)];
  }
  // параметры класса: радиус (радиусов Солнца), цвет, конвекция и активность; overrides — поправки к DEFAULTS (вид и арки)
  function classParams(sp, comp) {
    const k = classOf(sp, comp), conv = /[FGKM]/.test(k.cls) && k.lum !== 'D';
    let rSun = k.cls === 'D' ? 0.012 : k.cls === 'M' ? Math.max(0.1, 0.62 - 0.08 * k.sub) : k.cls === 'K' ? 0.9 - 0.03 * k.sub
      : ({ O: 6, B: 4, A: 1.8, F: 1.3, G: 1.0 })[k.cls] || 1;
    if (k.lum === 'IV') rSun *= 1.8; else if (k.lum === 'III') rSun *= 11; else if (k.lum === 'I') rSun *= 60;
    // масса (масс Солнца) — для силы тяжести: главная последовательность — по радиусу (Барнард 0,19 R☉ → 0,16 M☉), остальные — ориентиры
    const mSun = k.cls === 'D' ? 0.6 : k.lum === 'I' ? 15 : k.lum === 'III' ? 1.5 : k.lum === 'IV' ? 1.3 : Math.pow(rSun, rSun < 1 ? 1.1 : 1.25);
    // активность 0…1: красные карлики — вспыхивающие, K — умеренно, G — как Солнце, F — слабо; гиганты — крупные ячейки, слабые арки
    const act = !conv ? 0 : k.cls === 'M' ? 1 : k.cls === 'K' ? 0.7 : k.cls === 'G' ? 0.55 : 0.25;
    const giant = k.lum === 'III' || k.lum === 'I';
    const o = { satBoost: ({ M: 0.25, K: 0.12, G: 0.04, F: 0.02 })[k.cls] || 0, dipoleG: conv ? ({ M: 400, K: 60, G: 5, F: 2 })[k.cls] || 0 : 0 };   // диполь: у M-карликов — сотни Гс (запирает выбросы), у Солнца — единицы
    if (!conv) Object.assign(o, { regions: 0, granContrast: k.cls === 'D' ? 0 : 0.05, plage: 0, limbA: k.cls === 'D' ? 0.35 : 0.42, limbB: 0.08, limbRed: 0.2 });
    else {
      Object.assign(o, { regions: Math.round(2 + 8 * act), qMax: 0.6 + 0.65 * act, topMax: 0.12 + 0.2 * act, archBright: 0.5 + 0.6 * act, flareQ: 0.9 + 0.6 * act });
      if (k.cls === 'G' || k.cls === 'F') Object.assign(o, { sepMin: 0.06, sepMax: 0.18, flareSep: 0.16, spotSize: 0.012, plage: 0.35 });
    }
    if (giant) Object.assign(o, { granScale: k.lum === 'I' ? 6 : 14, granContrast: 0.42, superScale: 3, regions: conv ? 2 : 0, archBright: 0.4 });
    return { info: k, rSun, mSun, teff: k.teff, colorHex: teffColor(k.teff), convective: conv, activity: act, overrides: o };
  }
  // шкала высот плазмы в радиусах звезды: H/R★ = kT·R★/(μ m_p G M★), μ = 0,6; для Солнца ≈ 0,072 на 1 МК
  const scaleHeight = (cp, tMK) => 0.0722 * tMK * cp.rSun / cp.mSun;
  // радиус звезды, км: из данных системы, иначе — по классу (classParams: главная последовательность, гиганты, белые карлики)
  function radiusKm(sp, sysRkm, comp) { return sysRkm || classParams(sp, comp).rSun * R_SUN_KM; }
  // полюса: область вспышки — на +Y (ось выброса); остальные — случайно, доля limbShare — у края диска (локальная Z — к наблюдателю)
  function poles(THREE, seed, p) {
    const rnd = mulberry(seed), out = []; out.regions = []; if (!(p.regions >= 1)) return out;   // без активных областей (A, B, O, белые карлики) — полюсов нет
    // область: центр c, ось пары a (касательная), разнос sep; полюса — c ± a·sep/2 на сфере (для дрейфа — out.regions)
    const region = (c, sep, tilt, s, id) => { const e = new THREE.Vector3(0, 1, 0).cross(c); if (e.lengthSq() < 1e-6) e.set(1, 0, 0); e.normalize();
      const n = c.clone().cross(e).normalize(), a = e.multiplyScalar(Math.cos(tilt)).addScaledVector(n, Math.sin(tilt)), d = a.clone().multiplyScalar(sep / 2);
      out.regions.push({ c: c.clone(), a: a.clone(), sep, id, i: out.length });
      out.push({ p: c.clone().add(d).normalize(), q: s, id }, { p: c.clone().sub(d).normalize(), q: -s, id }); };
    region(new THREE.Vector3(0, 1, 0), p.flareSep, 0.25, p.flareQ, 0);
    const nLimb = Math.round((p.regions - 1) * p.limbShare);
    for (let k = 1, guard = 0; k < p.regions && guard < 400; guard++) {
      const zc = k <= nLimb ? (rnd() - 0.5) * 0.5 : rnd() * 0.9, a = rnd() * 2 * Math.PI, rr = Math.sqrt(1 - zc * zc), c = new THREE.Vector3(rr * Math.cos(a), rr * Math.sin(a), zc);
      if (c.y > 0.8 || out.some(P => P.p.dot(c) > 0.97)) continue;
      region(c, p.sepMin + (p.sepMax - p.sepMin) * rnd(), (rnd() - 0.5) * 1.2, p.qMin + (p.qMax - p.qMin) * rnd(), k); k++;
    }
    return out;
  }
  // заряды поля — [x, y, z, q]: полюса p′ на глубине poleDepth под поверхностью (модель погружённых зарядов, Longcope 2005) и, если
  // rSS > 1, их изображения для поверхности источника (модель PFSS): −q·R_S/a на радиусе R_S²/a — на R_S поле радиально
  // C.gUnit — единица поля в гауссах (над сильнейшим полюсом — spotG); C.dip — диполь звезды в единицах поля, C.dipM — его ось (от оси
  // вращения Y наклонена на dipoleTilt градусов к X; Проксима — 51°, Klein et al. 2021), C.dipU — однородное
  // поле его изображения для поверхности источника (m/R_S³ вдоль оси — на R_S поле радиально)
  // глубина у каждого полюса своя (Q.dep — расплывание стареющей области, стенд; нет — общая poleDepth); изображение — для своей глубины
  function charges(P0, p) {
    const P = P0.filter(Q => Q.q !== 0);   // пустые слоты (ушедшие полюса) — не в поле
    const im = p.rSS > 1, n = P.length, C = new Float32Array(n * (im ? 8 : 4));
    P.forEach((Q, i) => { const k = 1 - (Q.dep > 0 ? Q.dep : p.poleDepth), j = i * 4; C[j] = Q.p.x * k; C[j + 1] = Q.p.y * k; C[j + 2] = Q.p.z * k; C[j + 3] = Q.q;
      if (im) { const f = p.rSS * p.rSS / (k * k), J = (n + i) * 4; C[J] = C[j] * f; C[J + 1] = C[j + 1] * f; C[J + 2] = C[j + 2] * f; C[J + 3] = -Q.q * p.rSS / k; } });
    // единица поля постоянная: spotG — над полюсом силы 1,5 (не по текущему сильнейшему — он меняется при уничтожении потока)
    // стенд, этап 0 (labFluxUnitG): единица согласована с потоком — заряд q несёт q·Φ₀ через замкнутую сферу (Гаусс), gUnit = Φ₀/(4πR²);
    // прежняя единица давала поток в 2,08 раза больше Φ₀ (разбор Codex 15.10.2026); игра — как была
    C.gUnit = p.labFluxUnitG > 0 ? p.labFluxUnitG : p.spotG * p.poleDepth * p.poleDepth / 1.5; C.dip = p.dipoleG > 0 ? p.dipoleG / C.gUnit / (2 + (im ? 1 / Math.pow(p.rSS, 3) : 0)) : 0; C.dipU = C.dip && im ? C.dip / Math.pow(p.rSS, 3) : 0;   // на полюсе — ровно dipoleG (с изображением)
    const tl = (p.dipoleTilt || 0) * Math.PI / 180; C.dipM = [Math.sin(tl), Math.cos(tl), 0];
    return C;
  }
  // поле в точке: сумма q·(x − c)/|x − c|^(falloff+1) по зарядам C (n штук) плюс радиальный фон открытого поля open·x/|x|^(falloff+1)
  // (в Houdini — normalize(P), без затухания); o — ответ [bx, by, bz]
  function fieldAt(x, y, z, PF, n, e, open, o) {
    let bx = 0, by = 0, bz = 0;
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const dx = x - PF[j], dy = y - PF[j + 1], dz = z - PF[j + 2], r2 = dx * dx + dy * dy + dz * dz + 1e-6, s = PF[j + 3] / (e === 1.5 ? r2 * Math.sqrt(r2) : Math.pow(r2, e));
      bx += s * dx; by += s * dy; bz += s * dz;
    }
    if (open > 0) { const r2 = x * x + y * y + z * z, s = open / (e === 1.5 ? r2 * Math.sqrt(r2) : Math.pow(r2, e)); bx += s * x; by += s * y; bz += s * z; }
    const md = PF.dip; if (md) { const m = PF.dipM || [0, 1, 0], r2 = x * x + y * y + z * z, r3 = r2 * Math.sqrt(r2), k3 = 3 * md * (m[0] * x + m[1] * y + m[2] * z) / (r3 * r2);   // диполь вдоль оси m: (3(m·r)r − m·r²)/r⁵
      const km = -md / r3 + PF.dipU; bx += k3 * x + km * m[0]; by += k3 * y + km * m[1]; bz += k3 * z + km * m[2]; }
    o[0] = bx; o[1] = by; o[2] = bz;
  }
  // силовые линии от «+»: шаг RK2; в арки — вернувшиеся на поверхность невысокие линии с короткой хордой
  function lines(THREE, P, p, rnd) {
    const res = [], rejected = { open: 0, high: 0, low: 0, long: 0, short: 0, flat: 0, self: 0 };
    const B = new THREE.Vector3(), B2 = new THREE.Vector3(), x = new THREE.Vector3(), m = new THREE.Vector3();
    const C = charges(P, p), nC = C.length / 4, e = (p.falloff + 1) / 2, o = [0, 0, 0];
    const field = (v, out) => { fieldAt(v.x, v.y, v.z, C, nC, e, p.open, o); return out.set(o[0], o[1], o[2]); };
    for (const Q of P) if (Q.q > 0) {
      const t1 = new THREE.Vector3(0, 1, 0).cross(Q.p); if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0); t1.normalize();
      const t2 = Q.p.clone().cross(t1).normalize(), n = Math.round(p.seedsBase + p.seedsPerQ * Q.q);
      for (let i = 0; i < n; i++) {
        const a = 2 * Math.PI * (i + 0.6 * rnd()) / n, r0 = p.seedRMin + (p.seedRMax - p.seedRMin) * rnd();
        x.copy(Q.p).addScaledVector(t1, r0 * Math.cos(a)).addScaledVector(t2, r0 * Math.sin(a)).setLength(1.001);
        const pts = [x.clone()]; let ok = false, top = 0;
        for (let k = 0; k < 900; k++) {
          const h = 0.004 + 0.01 * Math.min(1, (x.length() - 1) * 8);
          field(x, B).normalize(); m.copy(x).addScaledVector(B, h / 2); field(m, B2).normalize(); x.addScaledVector(B2, h);
          if (k % 2 === 1) pts.push(x.clone()); top = Math.max(top, x.length() - 1);
          if (x.length() < 1) { x.setLength(1); pts.push(x.clone()); ok = true; break; }
          if (x.length() > 1.9) break;
        }
        const chord = pts[0].distanceTo(pts[pts.length - 1]);
        let len = 0; for (let k = 1; k < pts.length; k++) len += pts[k].distanceTo(pts[k - 1]);
        const why = !ok || pts.length <= 8 ? 'open' : top < p.topMin ? 'low' : top > p.topMax ? 'high' : chord < p.chordMin ? 'short' : chord > p.chordMax ? 'long'
          : top < p.minAspect * chord ? 'flat' : pts[pts.length - 1].distanceTo(Q.p) <= 0.05 ? 'self' : null;
        if (why) rejected[why]++; else res.push({ pts, q: Q.q, id: Q.id, top, chord, len });
      }
    }
    return { lines: res, rejected };
  }
  const NOISE_GLSL = `
    float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }`;
  // карта теней пятен (стенд, фотосфера «как видит глаз»; автор: «давай … тени в текстуру»): тень (R) и полутень (G) всех пятен — в текстуру
  // широта–долгота; край — тот же неровный контур r(θ) = rL·(1 + ε·Σ Wₖcos(kθ + φₖ))/√(1 + ε²); сглаживание — на ячейку текстуры с учётом
  // наклона границы (|∇F| = √(1 + (r′/ρ)²)); пересчёт — когда пятна изменились, не чаще 4 раз в секунду (вращение звезды — поворот группы,
  // карту не трогает). Фотосфера читает её вместо цикла по 64 пятнам в каждом пикселе
  const SPOTMAP_FS = `precision highp float; precision highp int;
    layout(location = 0) out vec4 o0;
    uniform vec3 uP[64]; uniform float uQ[64]; uniform float uS[64]; uniform vec4 uSpX[64]; uniform int uN; uniform float uSpotSq, uSpotQ, uIrr, uClk, uPenK, uMW, uMH;
    void main() { vec2 ij = gl_FragCoord.xy; float ph = 6.28318530718 * ij.x / uMW, th = 3.14159265359 * ij.y / uMH;
      vec3 o = vec3(sin(th) * cos(ph), cos(th), sin(th) * sin(ph)); float tex = 3.14159265359 / uMH, spot = 0.0, pen = 0.0, eI = uIrr, nI = 1.0 / sqrt(1.0 + eI * eI);
      for (int i = 0; i < 64; i++) { if (i >= uN) break; float a = abs(uQ[i]); if (a < uSpotQ || a <= 0.0 || uS[i] <= 0.0 || uSpotSq <= 0.0) continue;
        float d = distance(o, uP[i]), rL = uSpotSq * sqrt(a * uS[i]), rMax = rL * (1.0 + 2.8393 * eI) * nI * max(uPenK, 1.0) + 2.0 * tex;
        if (d >= rMax) continue;
        vec3 e1 = uSpX[i].xyz, e2 = cross(uP[i], e1), dv = o - uP[i]; float px = dot(dv, e1), py = dot(dv, e2), rr = max(length(vec2(px, py)), 1e-9);
        float c1 = px / rr, s1 = py / rr, ck = c1, sk = s1, sum = 0.0, dsum = 0.0, sd = uSpX[i].w;
        for (int k = 2; k <= 7; k++) { float cn = ck * c1 - sk * s1, sn = sk * c1 + ck * s1; ck = cn; sk = sn; float fk = float(k);
          float h1 = fract(sin((sd + fk * 0.6180339) * 91.345) * 47453.5453), h2 = fract(sin((sd + fk * 0.4142136) * 57.123) * 31718.927);
          float phs = 6.2831853 * h1 + uClk * (0.5 + h2) * (h2 > 0.5 ? 1.0 : -1.0) / 240.0, cp = cos(phs), sp = sin(phs), wk = 3.217388 * pow(fk, -1.5);
          sum += wk * (ck * cp - sk * sp); dsum -= wk * fk * (sk * cp + ck * sp); }
        float rI = rL * (1.0 + eI * sum) * nI, rp = rL * eI * dsum * nI, g = sqrt(1.0 + rp * rp / (rr * rr + 1e-12)), fw = clamp(0.5 * tex * g, 1e-6, 0.5 * rL);
        spot = max(spot, 1.0 - smoothstep(rI - fw, rI + fw, d));
        if (uPenK > 1.0) { float rP = rI * uPenK, fp = clamp(0.5 * tex * sqrt(1.0 + uPenK * uPenK * rp * rp / (rr * rr + 1e-12)), 1e-6, 0.5 * rP); pen = max(pen, 1.0 - smoothstep(rP - fp, rP + fp, d)); } }
      o0 = vec4(spot, pen, 0.0, 1.0); }`;
  const STAR_VS = `#include <common>
    #include <logdepthbuf_pars_vertex>
    varying vec3 vO; varying vec3 vNv; varying vec3 vV;
    void main(){ vO = position; vNv = normalMatrix * normal; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv;
      #include <logdepthbuf_vertex>
    }`;
  const STAR_FS = `#include <logdepthbuf_pars_fragment>
    uniform float uGP, uGF, uGRms, uGTau;
    uniform sampler2D uSMap; uniform float uSMapK, uSMapP, uSMapView;
    #ifdef LAB_EYE
    uniform sampler2D uPhot, uSpotMap, uSpotMapB; uniform float uSpotMix, uExpo, uFacK, uPenK, uCurve, uIrr, uClk, uSpotMH; uniform vec4 uSpX[64];
    #endif
    uniform float uT, uFlash, uGran, uGranC, uSuper, uLimbA, uLimbB, uLimbRed, uSpot, uSpotGrow, uSpotSq, uSpotQ, uPlage, uPlageW, uRib, uDim, uBirth, uRim, uRimP;
    uniform vec3 uCol; uniform vec3 uP[64]; uniform float uQ[64]; uniform float uS[64]; uniform float uB[64]; uniform int uN;
    varying vec3 vO; varying vec3 vNv; varying vec3 vV;
    ${NOISE_GLSL}
    // грануляция M-карлика (Ludwig, Allard & Hauschildt 2002: 2800 K — ≈ 80 км, СКО 1,1 %; Beeck et al. 2013: M2V — ≈ 300 км, < 3 %; по шкале
    // высот T/(μg) для Барнарда — 75–140 км): три слабые октавы, мелкой субструктуры мало; неразрешимые на пикселе частоты гасятся
    // (fwidth), средняя яркость сохраняется — издали диск ровный; рисунок сменяется плавным переходом между двумя эпохами
    float granAA(vec3 p, float t){ float fp = length(fwidth(p)), ep = floor(t), w = smoothstep(0.0, 1.0, fract(t)), tn = inversesqrt((1.0 - w) * (1.0 - w) + w * w);
      float sum = 0.0, amp = 0.5; vec3 sh = vec3(37.0, 57.0, 71.0);
      for (int i = 0; i < 3; i++) { float keep = 1.0 - smoothstep(0.25, 0.5, fp);
        sum += amp * keep * mix(vn(p + sh * ep) - 0.5, vn(p + sh * (ep + 1.0)) - 0.5, w) * tn;
        p = p * 2.03 + vec3(1.7, 9.2, 3.1); fp *= 2.03; amp *= 0.25; }
      return sum; }
    void main(){
      #include <logdepthbuf_fragment>
      vec3 o = normalize(vO);
      float gPhys = uGP > 0.5 ? 1.0 + uGRms * granAA(o * uGF, uT / max(0.1, uGTau)) / 0.0956 : 1.0;   // 0,0956 — СКО суммы октав (замер)
      float mu = clamp(dot(normalize(vNv), normalize(vV)), 0.0, 1.0);
      float limb = 1.0 - uLimbA * (1.0 - mu) - uLimbB * (1.0 - mu) * (1.0 - mu);   // потемнение к краю — квадратичный закон
      #ifndef LAB_EYE
      float g = fbm(o * uGran + vec3(uT * 0.04, uT * 0.03, 0.0)), g2 = fbm(o * uSuper - vec3(0.0, uT * 0.006, 0.0));
      float cells = smoothstep(0.32, 0.72, g) * (0.85 + 0.3 * g2);          // гранулы и супергрануляция
      #else
      float cells = 0.5;   // фотосфера «как видит глаз»: прежняя грануляция шумом (две суммы по 5 октав на пиксель) не нужна — не считается
      #endif
      float spot = 0.0, plage = 0.0, rib = 0.0, em = 0.0, pen = 0.0;
      #ifdef LAB_EYE
      vec3 dox = dFdx(o), doy = dFdy(o);   // для ширины сглаживания неровного края (производные — только здесь, в однородном потоке)
      #endif
      #ifdef LAB_SPOTMAP
      // тени — из карты теней (широта–долгота); уровень детализации — по угловому размеру пикселя (не по производной u: на шве она скачет)
      { float u = fract(atan(o.z, o.x) / 6.28318530718 + 1.0), u2 = fract(u + 0.5), v = acos(clamp(o.y, -1.0, 1.0)) / 3.14159265359;
        float dux = dFdx(u), duy = dFdy(u), dux2 = dFdx(u2), duy2 = dFdy(u2);   // на шве u скачет — берётся непрерывная из двух
        vec2 gx = vec2(abs(dux) < abs(dux2) ? dux : dux2, dFdx(v)), gy = vec2(abs(duy) < abs(duy2) ? duy : duy2, dFdy(v));
        // смена карты — плавно (автор: «давай и фотосферу так же»): смесь прежней (B) и текущей по доле времени до следующей карты
        vec4 smk = mix(texture2DGradEXT(uSpotMapB, vec2(u, v), gx, gy), texture2DGradEXT(uSpotMap, vec2(u, v), gx, gy), uSpotMix); spot = smk.r; pen = max(smk.g, smk.r); }
      #else
      // пятно: радиус uSpot + uSpotGrow·|q| (игра) или uSpotSq·√|q| — площадь ∝ потоку (режим плазмы); темнота — по силе (игра) или только
      // выше порога пор uSpotQ (слабее — без тени, только факел); поры светлее тени пятна (полная тень — от 7·uSpotQ)
      for (int i = 0; i < 64; i++) { if (i >= uN) break; float d = distance(o, uP[i]), a = abs(uQ[i]), rs = uSpot + uSpotGrow * a + uSpotSq * sqrt(a);
        if (a <= 0.0) continue;
        #ifdef LAB_SURFACE_MAP
        // стенд: те же диски, что в карте — площадь ∝ потоку и фазе пятна (|q|·Φ₀·sF/B_s), перекрытия — объединением
        // край — сглаживание на пиксель (fwidth), симметрично около радиуса: площадь тени сохраняется; молодое пятно (фаза 0) — без тени
        if (a >= uSpotQ && uS[i] > 0.0 && uSpotSq > 0.0) { float rL = uSpotSq * sqrt(a * uS[i]), fw = max(fwidth(d), 1e-5);
          #ifdef LAB_EYE
          // неровный край тени (визуальная гипотеза: наблюдений форм пятен M-карликов нет; разбор Codex): r(θ) = rL·(1 + ε·Σ Wₖcos(kθ + φₖ))/√(1 + ε²),
          // k = 2…7, Wₖ = 3,217388·k^−1,5 (½ΣWₖ² = 1 — ε есть СКО относительного радиуса), площадь ½∫r²dθ = π·rL² точно при любых фазах;
          // фазы — от номера пятна (uSpX.w), плывут с часами поверхности (≈ радиан за 10 сут); угол — в базисе пятна (uSpX.xyz переносится с ним).
          // Ширина сглаживания — до ветвления (производные — только в однородном потоке); дальше границы — не считается
          float eI = uIrr, rMax = rL * (1.0 + 2.8393 * eI) / sqrt(1.0 + eI * eI) * max(uPenK, 1.0) + 2.0 * fw;
          if (d < rMax) { vec3 e1 = uSpX[i].xyz, e2 = cross(uP[i], e1), dv = o - uP[i]; float px = dot(dv, e1), py = dot(dv, e2), rr = max(length(vec2(px, py)), 1e-9);
            float c1 = px / rr, s1 = py / rr, ck = c1, sk = s1, sum = 0.0, dsum = 0.0, sd = uSpX[i].w;
            for (int k = 2; k <= 7; k++) { float cn = ck * c1 - sk * s1, sn = sk * c1 + ck * s1; ck = cn; sk = sn; float fk = float(k);
              float h1 = fract(sin((sd + fk * 0.6180339) * 91.345) * 47453.5453), h2 = fract(sin((sd + fk * 0.4142136) * 57.123) * 31718.927);
              float ph = 6.2831853 * h1 + uClk * (0.5 + h2) * (h2 > 0.5 ? 1.0 : -1.0) / 240.0, cp = cos(ph), sp = sin(ph), wk = 3.217388 * pow(fk, -1.5);
              sum += wk * (ck * cp - sk * sp); dsum -= wk * fk * (sk * cp + ck * sp); }   // r(θ) и dr/dθ
            float nI = 1.0 / sqrt(1.0 + eI * eI), rI = rL * (1.0 + eI * sum) * nI, rp = rL * eI * dsum * nI;
            // ширина сглаживания — по самой границе F = d − r(θ) (разбор Codex): ∇F·dx = ∇d·dx − r′(θ)·∇θ·dx, производные o — до цикла
            float dd = max(d, 1e-9), i2 = 1.0 / (rr * rr);
            float tx = (px * dot(dox, e2) - py * dot(dox, e1)) * i2, ty = (px * dot(doy, e2) - py * dot(doy, e1)) * i2;
            float gx = dot(dv, dox) / dd, gy = dot(dv, doy) / dd;
            float fwI = clamp(abs(gx - rp * tx) + abs(gy - rp * ty), 1e-5, 0.5 * rL), fwP = clamp(abs(gx - uPenK * rp * tx) + abs(gy - uPenK * rp * ty), 1e-5, 0.5 * rL * uPenK);
            spot = max(spot, 1.0 - smoothstep(rI - fwI, rI + fwI, d));
            if (uPenK > 1.0) { float rP = rI * uPenK; pen = max(pen, 1.0 - smoothstep(rP - fwP, rP + fwP, d)); } }
          #else
          spot = max(spot, 1.0 - smoothstep(rL - fw, rL + fw, d));
          #endif
        }
        #else
        spot += (1.0 - smoothstep(uSpotQ > 0.0 ? 0.3 * rs : 0.004, rs, d)) * (uSpotQ > 0.0 ? smoothstep(0.4 * uSpotQ, uSpotQ, a) * (0.6 + 0.4 * smoothstep(uSpotQ, 7.0 * uSpotQ, a)) : min(1.0, a)) * uS[i];
        #endif
        #ifndef LAB_EYE
        em += uB[i] * (1.0 - smoothstep(0.0, 2.4 * rs + 0.014, d)) * min(1.0, 0.5 + 2.0 * a);   // всплытие — яркие точки и факел у оснований
        plage += a * exp(-d * d / (uPlageW + 0.01 * a)) * smoothstep(0.012, 0.04, d);
        #endif
      }
      #endif
      // ленты вспышки: по обе стороны линии раздела главной области (полюса 0 и 1), расходятся по мере вспышки
      vec3 m = normalize(uP[0] + uP[1]), ax = normalize(uP[0] - uP[1]);
      float along = dot(o - m, normalize(cross(m, ax))), across = dot(o - m, ax), sep = 0.02 + 0.05 * (1.0 - uFlash);
      #ifndef LAB_EYE
      float ds = abs(across) - sep; rib = exp(-ds * ds / 0.00012) * exp(-along * along / 0.004) * (1.0 - smoothstep(0.0, 0.08, distance(o, m) - 0.05));
      #endif
      vec3 col = uCol * (uGP > 0.5 ? gPhys : 1.0 - uGranC * 0.54 + uGranC * cells) * limb * mix(vec3(1.0, 0.5, 0.32), vec3(1.0), pow(mu, uLimbRed));   // к краю — краснее
      #ifdef LAB_SURFACE_MAP
      // стенд: тень — диски пятен (как в карте); яркость тени в видимом свете ≈ 0,3 фотосферы: тень M-карлика холоднее на ≈ 400 K
      // (Berdyugina 2005), на 600 нм по Планку exp(−hc/λk·(1/T_s − 1/T)) ≈ 0,3
      col *= 1.0 - 0.7 * clamp(spot, 0.0, 1.0);
      #else
      col *= 1.0 - 0.75 * clamp(spot, 0.0, 1.0);
      #endif
      #ifdef LAB_SURFACE_MAP
      // стенд, этап 1: факелы и хромосферная сеть — из карты поверхности: выпущенная энергия (R — lg(1 + F_H/F_ref)/2, A — доля импульса);
      // прокси потерь, не расчёт спектра; прежние факел по полюсам и всплытие — выключены (энергия — только из бюджета карты)
      vec4 smap = texture2D(uSMap, vec2(fract(atan(o.z, o.x) / 6.28318530718 + 1.0), acos(clamp(o.y, -1.0, 1.0)) / 3.14159265359));
      // факел окружает пятно, сквозь тень не светит (ячейка карты ≈ 5 000 км крупнее тени)
      col += (uCol * uSMapK * smap.r * limb + vec3(1.0, 0.95, 0.85) * max(uCol.r, 0.5) * uSMapP * smap.a * smap.r * limb) * (1.0 - clamp(spot, 0.0, 1.0));
      #ifdef LAB_EYE
      // фотосфера «как видит глаз» (реестр интерфейса, п. 28): линейная яркость — таблица по μ (photosphere.js: потемнение к краю по PHOENIX,
      // Claret 2012; спектр по фотометрии; строки — спокойная поверхность, тень, полутень), грануляция — множитель; факелы — закон контраста
      // сильнополевых областей M-карлика (инженерная аппроксимация по Johnson et al. 2021, разбор Codex): в центре диска темнее (−3 %),
      // у края светлее (+1,5 % при μ ≤ 0,2), сила — по карте нагрева; импульсы нагрева короны в видимом свете не видны — только в ультрафиолете.
      // Края тени и полутени — смешение яркостей, не температур. Камера: постоянная экспозиция → ACES (Narkowicz 2016) → sRGB; без свечений
      { float um = clamp(mu, 0.0, 1.0), tu = (um * 127.0 + 0.5) / 128.0;
        vec3 Iq = texture2D(uPhot, vec2(tu, 0.5 / 3.0)).rgb, Iu = texture2D(uPhot, vec2(tu, 1.5 / 3.0)).rgb, Ip = texture2D(uPhot, vec2(tu, 2.5 / 3.0)).rgb;
        float mm = max(mu, 0.2), Cf = 0.04 - 0.14 * mm + 0.07 * mm * mm;
        // вес факелов — фоновый выпуск без импульса: R = lg(1 + F_H/F_ref)/2, A — доля импульса → R фона
        float xr = pow(10.0, 2.0 * smap.r) - 1.0, rbg = log(1.0 + xr * (1.0 - smap.a)) * 0.2171472;   // 1/(2 ln 10)
        vec3 lin = Iq * gPhys * (1.0 + uFacK * clamp(rbg / 0.6, 0.0, 1.0) * Cf);
        { float U = clamp(spot, 0.0, 1.0), Pc = max(U, clamp(pen, 0.0, 1.0)); lin = U * Iu + (Pc - U) * Ip * gPhys + (1.0 - Pc) * lin; }   // линейно по покрытиям (разбор Codex)
        // кривая: uCurve 0 — по наибольшему каналу (оттенок сохраняется, пересвет уводит к белому), 1 — по каналам (как плёнка и матрица:
        // красный упирается в предел первым — пересвет идёт через жёлтый к белому)
        vec3 x = lin * uExpo; float m = max(max(x.r, x.g), max(x.b, 1e-6)), fm = clamp((m * (2.51 * m + 0.03)) / (m * (2.43 * m + 0.59) + 0.14), 0.0, 1.0);
        vec3 tc = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
        vec3 tm = mix(mix(x * (fm / m), vec3(fm), 0.9 * smoothstep(1.0, 8.0, m)), tc, uCurve);
        col = mix(12.92 * tm, 1.055 * pow(tm, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), tm)); }
      #endif
      // проверка: карта нагрева в условных цветах (lg F_H: чёрный → красный → жёлтый → белый; тени — синие)
      if (uSMapView > 0.5) { float hv = clamp(smap.r / 0.6, 0.0, 1.0); vec3 hc = mix(mix(vec3(0.05, 0.0, 0.1), vec3(0.9, 0.1, 0.05), smoothstep(0.0, 0.4, hv)), mix(vec3(1.0, 0.85, 0.2), vec3(1.0), smoothstep(0.75, 1.0, hv)), smoothstep(0.35, 0.75, hv));
        col = mix(hc * (0.4 + 0.6 * mu), vec3(0.2, 0.4, 1.0), smap.g); }
      #else
      col += uCol * uPlage * clamp(plage, 0.0, 1.5) * limb;
      col += mix(uCol, vec3(1.0, 0.95, 0.85) * max(uCol.r, 0.5), 0.45) * uBirth * clamp(em, 0.0, 1.5) * limb;
      #endif
      // кромка по Френелю (автор): хромосфера и переходный слой — тонкая светящаяся оболочка, у края луч идёт по ней длинной хордой —
      // кромка ярче (в УФ и рентгене так и видно), поверх потемнения фотосферы к краю
      #ifndef LAB_EYE
      col += mix(uCol, vec3(1.0, 0.85, 0.75), 0.35) * uRim * pow(1.0 - mu, uRimP);   // белее фотосферы
      #endif
      #ifndef LAB_SURFACE_MAP
      col += vec3(1.0, 0.96, 0.9) * rib * uFlash * uRib;   // ленты сценарной вспышки — не в физической ветке
      #endif
      col *= 1.0 - uDim * exp(-dot(o - m, o - m) / 0.006);                // после выброса — холодное тёмное пятно (корона над ним опустела)
      gl_FragColor = vec4(col, 1.0);
    }`;
  const ARCH_VS = `#include <common>
    #include <logdepthbuf_pars_vertex>
    attribute float aPh; attribute float aFl; uniform float uT, uLift, uSway;
    varying float vU; varying float vPh; varying float vH; varying float vFl;
    void main(){ vU = uv.x; vPh = aPh; vFl = aFl; vH = length(position) - 1.0;
      vec3 p = position + normal * uSway * sin(uT * 1.3 + aPh * 6.28 + uv.x * 11.0);
      p *= 1.0 + aFl * uLift * sin(3.14159 * uv.x);                          // главная арка вспухает перед выбросом
      vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
      #include <logdepthbuf_vertex>
    }`;
  const ARCH_FS = `#include <logdepthbuf_pars_fragment>
    uniform float uT, uFlash, uA, uGone, uBright, uFlowS, uFlowF; uniform vec3 uCol;
    varying float vU; varying float vPh; varying float vH; varying float vFl;
    void main(){
      #include <logdepthbuf_fragment>
      float flow = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(vU * uFlowF - uT * uFlowS * (1.0 + 1.15 * vPh) + vPh * 40.0), 3.0);   // сгустки плазмы бегут вдоль
      float foot = smoothstep(0.0, 0.06, vU) * (1.0 - smoothstep(0.94, 1.0, vU));
      float hot = 0.55 + 0.9 * exp(-vH * 9.0);                                 // у основания ярче и горячее
      vec3 c = mix(uCol * vec3(1.0, 0.62, 0.42), vec3(1.0, 0.82, 0.5), 0.2 + 0.45 * exp(-vH * 16.0));
      float k = uBright * flow * hot * (0.35 + 0.65 * foot) * (1.0 + vFl * uFlash * 1.2) * (1.0 - vFl * uGone);
      gl_FragColor = vec4(c * k * uA, 1.0);
    }`;
  // плазма частицами: яркость частицы (aA) и температура (aT — log₁₀ T) считаются на процессоре по физике нити
  const PART_VS = `#include <common>
    #include <logdepthbuf_pars_vertex>
    attribute float aA; attribute float aF; attribute float aT; attribute float aZ; uniform float uPx, uR, uSize, uVis, uFlash, uGone;
    varying float vA; varying float vT;
    void main(){ vT = aT;
      vA = aA * uVis * (1.0 + aF * uFlash * 1.5) * (1.0 - aF * uGone) / aZ;   // раздутая порция ветра — крупнее и тусклее на пиксель
      vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp(uSize * uR * uPx / -mv.z * aZ, 1.0, max(1.0, 5.0 * aZ));
      #include <logdepthbuf_vertex>
    }`;
  // цвет — два режима. Видимый свет (как увидел бы глаз): корона светит рассеянным светом звезды (K-корона, яркость ∝ n — цвет
  // фотосферы) с оттенком корональных эмиссионных линий: Fe X 637 нм (≈ 1 МК, красная), Fe XIV 530 нм (≈ 2 МК, зелёная), Ca XV 569 нм
  // (≈ 4–5 МК, жёлтая, только активные области и вспышки), горячая вспышка — сплошной спектр (белая); холодное вещество (протуберанец,
  // дождь, ≈ 10⁴ К) — Hα и He D3 (розово-красное). Ультрафиолет — условная палитра каналов SDO/AIA: ≈ 0,8 МК — золотое (171 Å),
  // 2–3 МК — тёпло-белое, ≥ 6 МК — голубое (94 Å), ≥ 20 МК — бело-фиолетовое; холодное — красное
  const PART_FS = `#include <logdepthbuf_pars_fragment>
    uniform float uBright, uMode, uLine; uniform vec3 uStar; varying float vA; varying float vT;
    vec3 lcol(float lt){
      vec3 c = vec3(1.0, 0.3, 0.42);
      c = mix(c, vec3(1.0, 0.32, 0.12), smoothstep(5.6, 5.95, lt));
      c = mix(c, vec3(0.45, 1.0, 0.3), smoothstep(6.1, 6.3, lt));
      c = mix(c, vec3(1.0, 0.95, 0.25), smoothstep(6.45, 6.65, lt));
      return mix(c, vec3(1.0), smoothstep(6.9, 7.2, lt)); }
    vec3 tcol(float lt){
      vec3 c = mix(vec3(1.0, 0.22, 0.3), vec3(1.0, 0.6, 0.2), smoothstep(4.6, 5.9, lt));
      c = mix(c, vec3(1.0, 0.86, 0.62), smoothstep(5.9, 6.35, lt));
      c = mix(c, vec3(0.6, 0.8, 1.0), smoothstep(6.45, 6.85, lt));
      return mix(c, vec3(0.82, 0.76, 1.0), smoothstep(7.0, 7.4, lt)); }
    void main(){
      #include <logdepthbuf_fragment>
      #ifdef STREAK
        float r = 0.0; if (vA < 0.002) discard;
      #else
        vec2 q = gl_PointCoord - 0.5; float r = length(q); if (r > 0.5 || vA < 0.002) discard;
      #endif
      float cool = 1.0 - smoothstep(4.6, 5.2, vT);
      vec3 col = uMode < 0.5 ? mix(mix(uStar, lcol(vT), uLine), lcol(vT), cool) : tcol(vT);
      gl_FragColor = vec4(col * min(vA, 4.0) * uBright * (1.0 - r * 2.0), 1.0);
    }`;
  // выброс: kind 0 — петля протуберанца (скрученная трубка по главной арке), 1 — фронт из волокон, 2 — аркада после вспышки
  const CME_VS = `#include <common>
    #include <logdepthbuf_pars_vertex>
    attribute vec4 aD; uniform float uT, uPx, uR, uRopeH, uRopeW, uFrontR, uFrontB; uniform vec3 uA, uB;
    varying float vA; varying vec3 vC;
    float sm(float a, float b, float x){ return clamp((x - a) / (b - a), 0.0, 1.0); }
    void main(){
      float kind = aD.x, s = aD.y, v = aD.z, rn = aD.w, t = uT; vec3 P; float a = 0.0, sz = 1.0;
      vec3 m = normalize(uA + uB), ax = normalize(uA - uB), side = normalize(cross(m, ax));
      if (kind < 0.5) {                                                       // петля: поднимается, раздувается, раскручивается
        float u = sm(0.5, 9.0, t), H = 0.1 + uRopeH * pow(u, 1.5), w = min(length(uA - uB) * 0.5 * (1.0 + uRopeW * H), 0.75 * H + 0.13);
        float ang = 3.14159 * s; vec3 c = m * (1.0 + H * sin(ang)) + ax * (w * cos(ang));
        vec3 tg = normalize(ax * (-w * sin(ang)) + m * (H * cos(ang)) + 1e-4);
        vec3 n1 = normalize(cross(tg, side)), n2 = cross(tg, n1);
        float tw = v * 6.28318 + s * 9.0 * (1.0 + u) + t * 0.6, rr = (0.012 + 0.16 * u) * (0.55 + 0.45 * rn) * (0.6 + 0.4 * sin(ang));
        P = c + (n1 * cos(tw) + n2 * sin(tw)) * rr;
        a = sm(0.3, 1.2, t) * (1.0 - sm(7.0, 11.0, t)) * (0.6 + 0.4 * sin(s * 30.0 + t * 3.0 + rn * 6.0));
        vC = mix(vec3(1.0, 0.36, 0.42), vec3(1.0, 0.75, 0.55), 0.25 + 0.35 * (1.0 - u)); sz = 1.4;
      } else if (kind < 1.5) {                                                // фронт: купол волокон над петлёй
        float u = sm(1.0, 11.0, t), Rf = 0.1 + uFrontR * pow(u, 1.2), lat = s * 1.75, lon = v * 6.28318;
        vec3 C = m * (1.0 + Rf * 0.85);
        vec3 dir = normalize(m * cos(lat) + (ax * cos(lon) + side * sin(lon)) * sin(lat));
        float wig = 0.06 * sin(lat * 7.0 + rn * 20.0 + t) * Rf;
        P = C + dir * (Rf * (0.9 + 0.1 * rn + 0.06 * sin(lon * 5.0 + t * 0.7))) + (ax * cos(lon + 1.57) + side * sin(lon + 1.57)) * wig;
        if (dot(P, m) < 1.02) P += m * (1.02 - dot(P, m));
        float rim = 1.0 - abs(normalize(normalMatrix * dir).z);              // оболочка по касательной к лучу зрения — яркий обод
        a = sm(1.0, 2.5, t) * (1.0 - sm(8.0, 13.0, t)) * (0.12 + 0.88 * pow(rim, 3.0)) * (0.35 + 0.65 * cos(lat * 0.8) * cos(lat * 0.8)) * (0.35 + 0.65 * step(0.5, fract(v * 31.0 + rn * 0.3)));
        vC = vec3(0.85, 0.9, 1.0) * uFrontB; sz = 1.1 + 1.0 * u;
      } else {                                                                // аркада: низкие петли вдоль линии раздела
        float z = (v - 0.5) * 0.22, hh = 0.03 + 0.03 * rn, ang = 3.14159 * s;
        vec3 base = normalize(m + side * z);
        P = base * (1.0 + hh * sin(ang)) + ax * (0.035 * cos(ang));
        a = sm(1.5, 3.5, t) * (1.0 - sm(10.0, 16.0, t));
        vC = vec3(1.0, 0.8, 0.6) * 0.35; sz = 0.7;
      }
      vA = a; vec4 mv = modelViewMatrix * vec4(P, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp(sz * 0.022 * uR * uPx / -mv.z, 1.0, 7.0);
      #include <logdepthbuf_vertex>
    }`;
  const CME_FS = `#include <logdepthbuf_pars_fragment>
    varying float vA; varying vec3 vC;
    void main(){
      #include <logdepthbuf_fragment>
      vec2 q = gl_PointCoord - 0.5; float r = length(q); if (r > 0.5 || vA < 0.003) discard;
      gl_FragColor = vec4(vC * vA * (1.0 - r * 2.0) * 0.9, 1.0);
    }`;
  // показатель спада внешнего поля над серединой области вспышки (Kliem & Török 2006): n(h) = −d ln B_ex / d ln h, B_ex — поле вдоль оси
  // пары полюсов (поперёк оси жгута) на высоте h; жгут неустойчив, где n > ncr. hCr — нижняя высота срыва, hStall — начало устойчивой
  // полосы над ней (если есть)
  function decay(P, p) {
    const C = charges(P, p), nC = C.length / 4, e = (p.falloff + 1) / 2, o = [0, 0, 0], H = [], Bx = [], n = [], K = 80;
    const m = P[0].p.clone().add(P[1].p).normalize(), ax = P[0].p.clone().sub(P[1].p).normalize();
    for (let i = 0; i <= K; i++) { const h = 0.01 * Math.pow(300, i / K), r = 1 + h; H.push(h);
      fieldAt(m.x * r, m.y * r, m.z * r, C, nC, e, p.open, o); Bx.push(Math.abs(o[0] * ax.x + o[1] * ax.y + o[2] * ax.z) + 1e-12); }
    for (let i = 0; i <= K; i++) { const a = Math.max(0, i - 1), b = Math.min(K, i + 1); n.push(-(Math.log(Bx[b]) - Math.log(Bx[a])) / (Math.log(H[b]) - Math.log(H[a]))); }
    // устойчивая полоса — только 0 ≤ n < ncr ниже поверхности источника (у неё поле раскрывается, горизонтальное меняет знак — n < 0)
    let hCr = 0, hStall = 0; const hTop = p.rSS > 1 ? 0.8 * (p.rSS - 1) : 3;
    for (let i = 0; i <= K && H[i] < hTop; i++) { if (!hCr) { if (n[i] > p.ncr && H[i] > 0.02) hCr = H[i]; } else if (!hStall && n[i] >= 0 && n[i] < p.ncr) hStall = H[i]; }
    const nAt = h => { const x = Math.log(h / 0.01) / Math.log(300) * K, i = Math.max(0, Math.min(K - 1, Math.floor(x))), f = Math.min(1, Math.max(0, x - i)); return n[i] + (n[i + 1] - n[i]) * f; };
    return { H, n, hCr, hStall, nAt, gUnit: C.gUnit };
  }
  // путь жгута: высота вершины h(t) по циклу (с показа). До высоты срыва — медленный подъём (slowKms), выше — разгон силой
  // ∝ ropeDrive·(n − ncr) в единицах силы тяжести у поверхности против силы тяжести на массу протуберанца; скорость упала до нуля —
  // остановка (запертое извержение), вещество стекает (fall, время свободного падения с долей rainF); escape — сценарий: разгон не
  // слабее 1,2 g до скорости выше местной скорости убегания
  function ropePath(DI, p, ph, escape, sep) {
    sep = sep || p.flareSep;                                                       // фактический разнос якорей (полюса дрейфуют)
    const g0 = 1 / (2 * p.tDyn * p.tDyn), kms = 1 / (617.7 * Math.sqrt(ph.mSun / ph.rSun)) / p.tDyn, dt = 0.02, Nt = Math.ceil(p.cycle / dt) + 2;
    // к вспышке жгут подошёл к порогу срыва (медленный подъём — до цикла); порог выше масштаба области (≈ 1,2 разноса) — срыв не
    // начинается: жгут поднимается до масштаба области и застревает (запертое извержение с самого начала)
    const hLim = 1.2 * sep, free = DI.hCr && DI.hCr < hLim || escape;
    const H = new Float32Array(Nt); let h = DI.hCr && DI.hCr < hLim ? 0.92 * DI.hCr : 0.25 * sep, v = 0, tStall = -1, vMax = 0, esc = false;
    for (let i = 0; i < Nt; i++) {
      const t = i * dt; H[i] = h; if (t < 0.3 || tStall >= 0 || h > 6) continue;
      const ve = 1 / p.tDyn / Math.sqrt(1 + h);                                // местная скорость убегания
      if (!free) { v = 3 * p.slowKms * kms; if (h >= hLim) { tStall = t; v = 0; } }
      else if (DI.hCr && h < DI.hCr && !escape) v = p.slowKms * kms;
      else { let a = p.ropeDrive * g0 * Math.min(0.5, (DI.nAt(h) >= 0 ? DI.nAt(h) : 3) - p.ncr) - 0.3 * g0 / ((1 + h) * (1 + h));   // сила ограничена: разгон кончается к ≈ 2 R★
        if (escape && v < 1.3 * ve) a = Math.max(a, 1.2 * g0);
        const nh = DI.nAt(h); v += a * dt; if (!escape && (nh < 0 || nh >= p.ncr)) v = Math.max(v, p.slowKms * kms);   // выше порога жгут неустойчив — назад не идёт
        if (v <= 0) { v = 0; tStall = t; } }
      if (v > ve && h > 1.5) esc = true;
      vMax = Math.max(vMax, v); h += v * dt;
    }
    const hMax = H.reduce((a, x) => Math.max(a, x), 0), tFall = Math.min(8, Math.max(1.5, Math.sqrt(2 * hMax / (Math.max(0.05, p.rainF) * g0)) * 0.5));
    return { H, dt, tStall, hMax, tFall, vMaxKms: vMax / kms, esc: esc || (escape && hMax > 3), hCr: DI.hCr, hStall: DI.hStall,
      at(t) { const i = Math.max(0, Math.min(H.length - 1, Math.round(t / dt))); return H[i]; },
      fall(t) { return tStall < 0 ? 0 : Math.min(1, Math.max(0, (t - tStall) / tFall)); } };
  }
  // фаза цикла вспышки (t — секунды от начала цикла): яркость вспышки, вспухание главной арки, её исчезновение (ушла в выброс)
  function phase(t, p) {
    const flash = t < 0.4 ? t / 0.4 : Math.exp(-(t - 0.4) / p.flashDecay) * (t < 9 ? 1 : 0);
    const lift = t < 1 ? 0.05 * t : Math.max(0, 0.05 - (t - 1) * 0.05);
    const gone = t > 1 && t < 12 ? Math.min(1, (t - 1) / 1.5) * (1 - Math.max(0, (t - 9) / 3)) : 0;
    return { flash, lift, gone };
  }
  // ---- поверхность: самостоятельные полюса (DOC «Вспышки звезды цели — проект v1», «Полюса по литературе»; проект — Codex, 14.10.2026).
  // Свои часы: surfH часов поверхности на секунду показа. Полюса плывут по общему плавному течению поверхности (вихревое поле, см. ниже;
  // случайное блуждание у каждого своё давало «едет — встаёт» — решение автора).
  // Новая пара всплывает: поток — за emergeH ч, расхождение — по профилю Schunker et al. 2019 (пик относительной скорости sepKms через
  // 0,04 срока, остановка через sepStopH ч), сила разноса ∝ q^0,27 (Otsuji et al. 2011). Разноимённые полюса при сближении уничтожают
  // поток (cancRate — доля меньшего исходного потока в час: 34% за 2,5 сут — Green et al. 2011; взаимодействие 0,02–0,06 R★ — масштаб
  // глубины источников). Комплексы стареют (поток убывает линейно до нуля за срок ∝ потоку; полюс уходит, когда тени уже нет, его место — новой области), сумма
  // зарядов остаётся нулевой; новые пары — пуассоновски, раз в birthH ч, доля
  // clusterFrac — рядом с существующими полюсами. Полюса 0 и 1 — якоря цикла вспышки: блуждают, но не распадаются и не уничтожаются
  const MAXP = 64, PHI0 = 5e21;   // слотов полюсов (массив пятен шейдера NSP); поток одной полярности на единицу |q|, Мкс (калибровка учёта)
  const smooth01 = x => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
  const basisOf = (c, e1) => { e1.addScaledVector(c, -e1.dot(c)); if (e1.lengthSq() < 1e-6) { e1.set(0, 1, 0).cross(c); if (e1.lengthSq() < 1e-6) e1.set(1, 0, 0); } return e1.normalize(); };
  function surface(THREE, P, p, ph, seed) {
    if (P.length > MAXP) P.length = MAXP;                                                     // слоты: не больше массива пятен шейдера
    const rndM = mulberry(seed ^ 0x51ed27), rndB = mulberry(seed ^ 0x2b9e71), RK = ph.rKm, e2 = new THREE.Vector3(), d = new THREE.Vector3(), contacts = new Map();
    const e3 = new THREE.Vector3(), e4 = new THREE.Vector3(), e5 = new THREE.Vector3(), e6 = new THREE.Vector3(), e7 = new THREE.Vector3(), e8 = new THREE.Vector3();
    let clock = 0, uid = 0, births = 0, cancTot = 0, nextBirth = 0, collect = false; const evq = [];
    const init = (Q, i, sib, born, q0) => Object.assign(Q, { uid: uid++, gen: (Q.gen | 0) + 1, qBirth: q0, born, sib, anchor: Q.id === 0, dead: false, u: Q.u || new THREE.Vector3(), dep: undefined, sepS: undefined, ou: undefined,
      e1: basisOf(Q.p, (Q.e1 || new THREE.Vector3()).set(0, 1, 0).cross(Q.p)) });
    // ---- течение поверхности (решение автора 14.10.2026: «полюса должны плавно двигаться» — случайное блуждание у каждого своё, полюс то
    // едет, то встаёт): общее плавное вихревое поле по сфере, как вихревой шум сети popnet6 автора — v = c × ∇ψ (без источников и стоков),
    // ψ = Σ sin(f·(k·c) + φ + ω·t/corrH) по 8 гармоникам; соседние полюса плывут согласованно, рисунок медленно меняется; скорость —
    // driftKms (среднеквадратичная по сфере), размер вихрей — driftScale
    const modes = []; for (let k = 0; k < 8; k++) { const z = 2 * rndM() - 1, a = 6.2831853 * rndM(), rr = Math.sqrt(1 - z * z);
      modes.push({ kx: rr * Math.cos(a), ky: z, kz: rr * Math.sin(a), f: Math.PI / Math.max(0.05, p.driftScale) * (0.7 + 0.6 * rndM()), ph: 6.2831853 * rndM(), w: (rndM() < 0.5 ? -1 : 1) * (0.5 + rndM()) }); }
    const flowRaw = (c, out, tH = clock) => { let gx = 0, gy = 0, gz = 0; const tt = tH / Math.max(1, p.corrH);   // tH — часы поверхности (по умолчанию — сейчас)
      for (const m of modes) { const g = m.f * Math.cos(m.f * (m.kx * c.x + m.ky * c.y + m.kz * c.z) + m.ph + m.w * tt); gx += g * m.kx; gy += g * m.ky; gz += g * m.kz; }
      const gr = gx * c.x + gy * c.y + gz * c.z; gx -= gr * c.x; gy -= gr * c.y; gz -= gr * c.z;
      return out.set(c.y * gz - c.z * gy, c.z * gx - c.x * gz, c.x * gy - c.y * gx); };
    let flowNorm = 0; { const t = new THREE.Vector3(), o2 = new THREE.Vector3(); for (let i = 0; i < 400; i++) { const z = 2 * rndM() - 1, a = 6.2831853 * rndM(), rr = Math.sqrt(1 - z * z); t.set(rr * Math.cos(a), z, rr * Math.sin(a)); flowNorm += flowRaw(t, o2).lengthSq(); } flowNorm = Math.sqrt(flowNorm / 400) || 1; }
    const flowAt = (c, out, tH) => flowRaw(c, out, tH).multiplyScalar(p.driftKms * 3600 / RK / flowNorm);   // R★/ч; tH — для восстановления пути мелких пар по абсолютным часам
    const u0 = Q => flowAt(Q.p, Q.u);
    // вихревость течения ζ = r̂·rot v, 1/ч: v = c × ∇ψ, ψ = Σ sin(f·(k·c) + …) → ζ = ∇²ψ на единичной сфере =
    // Σ [−f²(1 − (k·c)²)·sin − 2f·(k·c)·cos] (лапласиан продолжения в пространство минус радиальные производные)
    const vortAt = (c, tH = clock) => { let z = 0; const tt = tH / Math.max(1, p.corrH);
      for (const m of modes) { const kc = m.kx * c.x + m.ky * c.y + m.kz * c.z, ar = m.f * kc + m.ph + m.w * tt; z += -m.f * m.f * (1 - kc * kc) * Math.sin(ar) - 2 * m.f * kc * Math.cos(ar); }
      return z * p.driftKms * 3600 / RK / flowNorm; };
    // поворот x вокруг единичной оси e на угол th (формула Родрига)
    const rotV = (x, e, th) => { const c = Math.cos(th), s = Math.sin(th), ed = e.dot(x); e8.copy(e).cross(x); return x.multiplyScalar(c).addScaledVector(e8, s).addScaledVector(e, ed * (1 - c)); };
    // поток пары — по степенному закону (обратная функция распределения); направление — по широте с перевесом к экватору (ось вращения — Y)
    const qPow = () => { const a = 1 - p.fluxSlope, lo = Math.pow(p.pairQLo, a), hi = Math.pow(p.pairQHi, a); return Math.pow(lo + rndB() * (hi - lo), 1 / a); };
    const latDir = out => { for (let k = 0; k < 64; k++) { const y = 2 * rndB() - 1; if (rndB() < Math.pow(1 - y * y, p.latBias / 2)) { const a = 6.2831853 * rndB(), rr = Math.sqrt(1 - y * y); return out.set(rr * Math.cos(a), y, rr * Math.sin(a)); } } return out.set(1, 0, 0); };
    const lifeT = q => p.lifeDays * 24 * Math.min(1, Math.max(0.1, q));
    const sPhase = (Q, age) => { const E = Math.max(1, p.emergeH); return smooth01((age - 0.25 * E) / (1.25 * E)) * smooth01(Math.abs(Q.q) / (0.3 * (Q.qBirth || 1))); };                           // полный срок жизни пары, ч (∝ потоку)
    const decayH = q => Math.max(1, lifeT(q) - p.emergeH);                                         // распад — линейный: поток (площадь) убывает с постоянной
    // скоростью до нуля (правило Гневышева — Вальдмайера, dA/dt = −W), полюс уходит, когда тени уже не видно (|q| < qGone)
    const qGone = 0.003;
    // расплывание (spreadKm2s > 0, стенд): поток распадающейся области растекается диффузией η по поверхности; в модели зарядов — источник
    // уходит глубже: полуширина поля над зарядом на глубине d — 0,766·d, у пятна диффузии — 0,83·√(4ηt) → d² = d₀² + 4cηt/R★²,
    // c = ln2/(2^⅔ − 1) = 1,18 (разбор Codex 15.10.2026). Пятно держит поток: растекается только то, что уже не в тени — скорость
    // умножается на (1 − фаза тени), т. е. расплывание идёт по мере распада пятна (van Driel-Gesztelyi & Green 2015). Предел — spreadDMax
    const spr = p.spreadKm2s > 0, kD = spr ? 4 * 1.180024 * p.spreadKm2s * 3600 / (RK * RK) : 0, d02 = p.poleDepth * p.poleDepth;
    const dMax2 = Math.pow(Math.min(0.9, Math.max(p.poleDepth, p.spreadDMax || 0.5)), 2);
    // шаг расплывания: age — возраст в конце шага, ph — фаза тени, средняя за шаг (трапеция по началу и концу — сходится при дроблении шага)
    const spreadStep = (Q, age, dh, ph) => { if (!spr || Q.anchor || age <= p.emergeH) return;
      const d2 = (Q.dep > 0 ? Q.dep * Q.dep : d02) + kD * Math.min(dh, age - p.emergeH) * (1 - ph); Q.dep = Math.sqrt(Math.min(dMax2, d2)); };
    // частота рождений — чтобы держать polesTarget при таком сроке жизни: пара живёт ≈ lifeT (всплытие + линейный распад)
    let lifeMean = 0; { const r = mulberry(seed ^ 0x6a09e6), a = 1 - p.fluxSlope, lo = Math.pow(p.pairQLo, a), hi = Math.pow(p.pairQHi, a);
      for (let k = 0; k < 400; k++) lifeMean += lifeT(Math.pow(lo + r() * (hi - lo), 1 / a)) / 400; }
    const birthIv = () => Math.min(p.birthH, lifeMean / Math.max(1, p.polesTarget / 2));   // ч между рождениями пар
    // начальная раскладка — тем же законом, что и рождения (игровая раскладка — только у якорей вспышки, пара 0–1); пары — до polesTarget;
    // разнос зрелой пары — как после расхождения: 0,03 + 0,19·q^0,27 R★
    const nT = Math.min(MAXP, Math.max(2, 2 * Math.round(p.polesTarget / 2))); if (P.length > nT) P.length = nT;   // ровно цель (чётно, 2–64)
    for (let k = 2; k + 1 < nT; k += 2) {
      if (!P[k]) P.push({ p: new THREE.Vector3(), q: 1, id: k >> 1 }, { p: new THREE.Vector3(), q: -1, id: k >> 1 });
      const c = latDir(new THREE.Vector3()), e1 = basisOf(c, new THREE.Vector3(0, 1, 0).cross(c)), a = 6.2831853 * rndB(); e2.copy(c).cross(e1);
      const ax = e1.clone().multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a)), q0 = qPow(), sp = (0.03 + 0.19 * Math.pow(q0, 0.27)) / 2;
      const A0 = Math.max(p.emergeH, p.sepStopH), A1 = p.emergeH + decayH(q0) * (1 - 2 * qGone / q0);   // возраст — пока остаток выше 2·qGone
      const age = A0 + rndB() * Math.max(0, A1 - A0), qn = Math.max(2 * qGone, q0 * (1 - (age - p.emergeH) / decayH(q0)));   // уже постаревшая
      for (const [Q, s] of [[P[k], 1], [P[k + 1], -1]]) { Q.p.copy(c).addScaledVector(ax, s * sp).normalize(); Q.q = s * qn; Q.q0b = q0; Q.age = age; } }
    // якоря вспышки (пара 0–1) — на широте 20° к наблюдателю (+Z), пара по меридиану, «+» севернее: поле диполя (ось Y) над ней — поперёк
    // линии раздела, запирает жгут (Kliem & Török 2006)
    if (P[1]) { const c = new THREE.Vector3(0, Math.sin(0.349), Math.cos(0.349)), nn = new THREE.Vector3(0, Math.cos(0.349), -Math.sin(0.349)), sp = P[0].p.distanceTo(P[1].p) / 2;
      P[0].p.copy(c).addScaledVector(nn, sp).normalize(); P[1].p.copy(c).addScaledVector(nn, -sp).normalize(); }
    // стартовые области — зрелые, разного возраста (иначе стареют и уходят хором); пара — один возраст
    P.forEach((Q, i) => { init(Q, i, Q.q > 0 ? i + 1 : i - 1, Q.q > 0 ? -(Q.age != null ? Q.age : Math.max(p.emergeH, p.sepStopH)) : P[i - 1].born, Q.q0b != null ? Q.q0b : Math.abs(Q.q)); u0(Q); });
    P.forEach(Q => { Q.sgn = Math.sign(Q.q) || 1; Q.sibUid = P[Q.sib] ? P[Q.sib].uid : -1; });
    if (spr) P.forEach(Q => { if (Q.anchor || !(Q.qBirth > 0)) return; const q1 = Q.q, age = -Q.born, q0 = Q.qBirth;
      const qAt = a => Q.sgn * Math.max(0, q0 * (1 - (a - p.emergeH) / decayH(q0)));   // уже постаревшая: линейный распад после всплытия
      for (let a0 = p.emergeH; a0 < age - 1e-9;) { const h = Math.min(1, age - a0); Q.q = qAt(a0); const f0 = sPhase(Q, a0); Q.q = qAt(a0 + h);
        spreadStep(Q, a0 + h, h, 0.5 * (f0 + sPhase(Q, a0 + h))); a0 += h; } Q.q = q1; });
    nextBirth = -Math.log(Math.max(1e-9, rndB())) * birthIv();
    const alive = Q => !Q.dead;
    // снять поток с полюсов знака sgn (не якорей, не из множества skip) на сумму amt пропорционально |q| — для баланса; вернёт, сколько снято
    const drain = (sgn, amt, skip) => { let tot = 0; P.forEach((Q, i) => { if (alive(Q) && !Q.anchor && !skip.has(i) && Math.sign(Q.q) === sgn) tot += Math.abs(Q.q); });
      if (tot < amt) return 0; P.forEach((Q, i) => { if (alive(Q) && !Q.anchor && !skip.has(i) && Math.sign(Q.q) === sgn) Q.q -= sgn * amt * Math.abs(Q.q) / tot; }); return amt; };
    const sub = dh => {
      clock += dh;
      const ph0 = spr ? P.map(Q => alive(Q) && !Q.anchor ? sPhase(Q, clock - dh - Q.born) : 0) : null;   // фаза тени в начале шага
      // течение поверхности, расхождение новой пары, всплытие потока
      const toR = 3600 / RK;
      const stop = p.sepStopH, pk = 0.04 * stop;
      // якоря вспышки (пара 0–1) — одно целое: течение в их середине, разнос постоянный (иначе за десятки суток течение разносило их по
      // разные стороны звезды — два вечных одиноких полюса с силой 1,5, весь поток которых уходил «в космос»)
      const A0 = P[0], A1 = P[1], anc = A0 && A1 && A0.anchor && alive(A0) && alive(A1); let midU = null;
      if (anc) { const mid = A0.p.clone().add(A1.p).normalize(); midU = flowAt(mid, new THREE.Vector3()); if (A0.sep0 == null) A0.sep0 = A0.p.distanceTo(A1.p); }
      // пара после расхождения (расплывание включено) — одно целое: середина плывёт с течением, ось поворачивается с вихревостью, хорда
      // постоянная (иначе пара попадает в разные вихри и разъезжается на ползвезды, оставаясь точками)
      const rigid = Q => { if (!(spr || p.pairRigid > 0) || Q.anchor || !alive(Q)) return false; const S = P[Q.sib];
        return !!S && alive(S) && !S.anchor && S.uid === Q.sibUid && S.sibUid === Q.uid && clock - Q.born >= Math.max(stop, p.emergeH + dh); };
      for (const Q of P) { if (!alive(Q)) continue;
        if (rigid(Q)) { Q.emR = 0; continue; }
        const c = Q.p; basisOf(c, Q.e1); flowAt(c, Q.u); d.copy(anc && (Q === A0 || Q === A1) ? midU : Q.u);
        const age = clock - Q.born, S = P[Q.sib];
        if (S && age < stop && S.uid === Q.sibUid) {
          const f = age < pk ? age / pk : (stop - age) / (stop - pk), v = 0.5 * p.sepKms * toR * Math.pow(Q.qBirth, 0.27) * f;
          e2.copy(c).sub(S.p); e2.addScaledVector(c, -e2.dot(c)); if (e2.lengthSq() > 1e-12) d.addScaledVector(e2.normalize(), v);
        }
        Q.emR = 0; if (age < p.emergeH + dh && age >= 0) { const add = Q.qBirth * (smooth01(age / p.emergeH) - smooth01((age - dh) / p.emergeH)); Q.q += Math.sign(Q.sgn) * Math.max(0, add); Q.emR = Math.max(0, add) / dh; }   // |q| в час
        c.addScaledVector(d, dh).normalize();
      }
      if (spr || p.pairRigid > 0) for (const A of P) { if (!(A.sgn > 0) || !rigid(A)) continue; const B = P[A.sib];
        const m = e3.copy(A.p).add(B.p).normalize();
        if (!(A.sepS > 0)) A.sepS = B.sepS = A.p.distanceTo(B.p);   // хорда в конце расхождения (для сводки)
        // угловая скорость пары Ω = m × v + ½ζ·m (перенос середины и вращение с вихревостью); оба полюса поворачиваются одним поворотом —
        // текущий разнос сохраняется (его меняют только фоновые течения ниже — сдвиг пары дифференциальным вращением; разбор Codex)
        const v = flowAt(m, e5), Om = e6.copy(m).cross(v).addScaledVector(m, 0.5 * vortAt(m)), w = Om.length();
        if (w > 1e-15) { const ax = e7.copy(Om).multiplyScalar(1 / w); rotV(A.p, ax, w * dh).normalize(); rotV(B.p, ax, w * dh).normalize(); }
        A.u.copy(Om).cross(A.p); B.u.copy(Om).cross(B.p); basisOf(A.p, A.e1); basisOf(B.p, B.e1); }   // u — фактическая скорость, R★/ч
      // фоновые течения (стенд): дифференциальное вращение и меридиональное — каждому полюсу своё (пары сдвигаются и вытягиваются);
      // случайное блуждание — у пары целиком (середина) или у одиночного полюса: скорость — точный шаг Орнштейна — Уленбека, перенос — по ней
      const bgOn = p.labOmEq || p.labDOm || p.labVmer, ouOn = p.labDspot > 0;
      if (bgOn || ouOn) { const tau = Math.max(2, p.labOuH || 12), aOU = Math.exp(-dh / tau), sig = Math.sqrt(p.labDspot * 3600 / (RK * RK) / tau), tick = Math.round(clock * 3600);
        if (bgOn) for (const Q of P) { if (!alive(Q)) continue; bgVel(Q.p, p, RK, e8); Q.p.addScaledVector(e8, dh).normalize(); Q.u.add(e8); basisOf(Q.p, Q.e1); }
        if (ouOn) for (const Q of P) { if (!alive(Q) || Q.anchor) continue; const pr = rigid(Q); if (pr && !(Q.sgn > 0)) continue;   // пара — один раз
          // скорость блуждания хранится вектором (3D) и переносится проекцией на касательную плоскость центра — поворачивается вместе с парой
          // (разбор Codex: компоненты в базисе e1 не следовали повороту пары); шаг скорости — точный по Орнштейну — Уленбеку
          const B = pr ? P[Q.sib] : null, c = pr ? e3.copy(Q.p).add(B.p).normalize() : e3.copy(Q.p), t1 = basisOf(c, e4.copy(Q.e1)), t2 = e5.copy(c).cross(t1);
          const ou = Q.ou || (Q.ou = new THREE.Vector3()); ou.addScaledVector(c, -ou.dot(c)).multiplyScalar(aOU);
          ou.addScaledVector(t1, sig * Math.sqrt(1 - aOU * aOU) * hnorm(seed | 0, Q.uid | 0, tick, 0)).addScaledVector(t2, sig * Math.sqrt(1 - aOU * aOU) * hnorm(seed | 0, Q.uid | 0, tick, 1));
          const dl = ou.length() * dh;
          if (dl > 1e-15) { const ax = e7.copy(c).cross(ou).normalize(), Wv = e6.copy(ax).multiplyScalar(ou.length());   // угловая скорость блуждания, 1/ч
            rotV(Q.p, ax, dl).normalize(); basisOf(Q.p, Q.e1); Q.u.add(e8.copy(Wv).cross(Q.p));   // и в фактическую скорость (для сдвига в контактах)
            if (B) { rotV(B.p, ax, dl).normalize(); basisOf(B.p, B.e1); B.u.add(e8.copy(Wv).cross(B.p)); } } } }
      if (anc) { const mid = A0.p.clone().add(A1.p).normalize(), ax = A0.p.clone().sub(A1.p); ax.addScaledVector(mid, -ax.dot(mid)).normalize();
        A0.p.copy(mid).addScaledVector(ax, A0.sep0 / 2).normalize(); A1.p.copy(mid).addScaledVector(ax, -A0.sep0 / 2).normalize(); }   // разнос якорей — постоянный
      // уничтожение потока: предложения по разноимённым парам; коэффициенты доступности — по одному снимку запасов (порядок не важен)
      const prop = [], want = new Float64Array(P.length), q0s = P.map(Q => Q.q);
      for (let i = 0; i < P.length; i++) { const A = P[i]; if (!alive(A) || A.anchor || A.q <= 0) continue;
        for (let j = 0; j < P.length; j++) { const B = P[j]; if (!alive(B) || B.anchor || B.q >= 0) continue;
          if (A.sib === j && B.sibUid === A.uid && clock - A.born < stop) continue;
          const dd = A.p.distanceTo(B.p), K = 1 - smooth01((dd - 0.02) / 0.04); if (K <= 0) continue;
          const q = p.cancRate * Math.min(A.qBirth, B.qBirth) * K * dh; prop.push([i, j, q, dd]); want[i] += q; want[j] += q; } }
      const av = want.map((w, i) => w > 0 ? Math.min(1, Math.abs(q0s[i]) / w) : 1);
      for (const [i, j, q0, dd] of prop) {
        const A = P[i], B = P[j], q = q0 * Math.min(av[i], av[j]); if (!(q > 0)) continue;
        A.q -= q; B.q += q; cancTot += q;
        if (collect) evq.push({ x: (A.p.x + B.p.x) / 2, y: (A.p.y + B.p.y) / 2, z: (A.p.z + B.p.z) / 2, dq: q, clock });   // карта поверхности (стенд)
        const key = A.uid + ':' + B.uid; let ct = contacts.get(key);
        if (!ct) contacts.set(key, ct = { a: A.uid, b: B.uid, init: Math.min(A.qBirth, B.qBirth), canc: 0, rope: 0, shear: 0, rate: 0, dq: 0, loc: new THREE.Vector3(), last: clock });
        ct.loc.copy(A.p).add(B.p).normalize(); ct.canc += q; ct.dq += q; ct.last = clock;
        e2.copy(A.p).sub(B.p); const t = ct.loc.clone().cross(e2).normalize(), sh = A.u.clone().sub(B.u).dot(t) / Math.max(dd, 0.02);
        ct.shear += sh * dh; ct.rope += Math.min(1, Math.abs(ct.shear)) * q;
      }
      // запись контакта живёт, пока не затух жгут (время утечки 240 ч), а не только пока идёт уничтожение
      for (const [k, ct] of contacts) { ct.rope *= Math.exp(-dh / 240); ct.rate += (ct.dq / dh - ct.rate) * (1 - Math.exp(-dh / 2)); ct.dq = 0;
        if (clock - ct.last > 48 && ct.rate < 1e-6 && ct.rope < 0.01 * ct.init) contacts.delete(k); }
      // старение: заявки по полюсам (линейный распад, qBirth/decayH в час), поровну с обоих знаков
      let wp = 0, wn = 0; const wq = new Float64Array(P.length);
      P.forEach((Q, i) => { if (!alive(Q) || Q.anchor || clock - Q.born < p.emergeH) return; wq[i] = Math.min(Math.abs(Q.q), Q.qBirth * dh / decayH(Q.qBirth)); if (Q.q > 0) wp += wq[i]; else wn += wq[i]; });
      // пара (живая «−» того же рождения) распадается вместе — по одной и той же заявке: скорость линейная, баланс точный; полюса без пары
      // (пара ушла или уничтожена) — общим механизмом, поровну с обоих знаков
      P.forEach((Q, i) => { if (!(Q.q > 0) || !wq[i]) return; const j = Q.sib, S = P[j]; if (!S || !alive(S) || S.uid !== Q.sibUid || !(S.q < 0) || !wq[j]) return;
        const dd = Math.min(wq[i], wq[j]); Q.q -= dd; S.q += dd; wq[i] -= dd; wq[j] -= dd; wp -= dd; wn -= dd; });
      const take = Math.min(wp, wn);
      if (take > 1e-15) P.forEach((Q, i) => { if (wq[i]) Q.q -= Math.sign(Q.q) * wq[i] * take / (Q.q > 0 ? wp : wn); });
      // уход: остаток < qGone (тени уже нет) после всплытия и расхождения; разница остатков знаков снимается с других полюсов того
      // знака, чей остаток меньше, — сумма зарядов звезды остаётся нулевой; не из чего снять — уход откладывается
      const out = new Set(); let rp = 0, rn = 0;
      P.forEach((Q, i) => { if (alive(Q) && !Q.anchor && clock - Q.born > Math.max(stop, p.emergeH) && Math.abs(Q.q) < qGone) { out.add(i); if (Q.q > 0) rp += Q.q; else rn -= Q.q; } });
      if (out.size) { const diff = rp - rn, ok = Math.abs(diff) < 1e-12 || drain(diff > 0 ? -1 : 1, Math.abs(diff), out) > 0;
        if (ok) for (const i of out) { P[i].q = 0; P[i].dead = true; } }
      // расплывание — после старения и ухода: фаза тени средняя за шаг (рождённые в этом шаге моложе всплытия — не трогаются)
      if (spr) P.forEach((Q, i) => { if (alive(Q) && !Q.anchor) spreadStep(Q, clock - Q.born, dh, 0.5 * ((ph0[i] || 0) + sPhase(Q, clock - Q.born))); });
      // рождение: пуассоновский поток (время следующего события), свободные слоты — мёртвые не якоря или новые до MAXP
      // нет места — рождение ждёт (не пропадает): иначе области уходят пачками, а новые не успевают
      if (clock >= nextBirth && P.filter(alive).length + 2 <= Math.min(MAXP, p.polesTarget)) {
        const free = []; P.forEach((Q, i) => { if (Q.dead && !Q.anchor) free.push(i); });
        while (free.length < 2 && P.length < MAXP) { P.push({ p: new THREE.Vector3(1, 0, 0), q: 0, id: 1000 + P.length, dead: true }); free.push(P.length - 1); }
        // мест много (полюсов на 4 меньше цели) — всплывает чаще, вчетверо, пока число не вернётся к цели
        if (free.length >= 2) { nextBirth = clock - Math.log(Math.max(1e-9, rndB())) * birthIv() / (P.filter(alive).length + 4 <= p.polesTarget ? 4 : 1);
          const c = new THREE.Vector3(), live = P.filter(Q => alive(Q) && Q.q !== 0);
          if (live.length && rndB() < p.clusterFrac) { const R0 = live[(rndB() * live.length) | 0], e1 = basisOf(R0.p, new THREE.Vector3(0, 1, 0).cross(R0.p)), a = 6.2831853 * rndB(), r = 0.08 + 0.1 * rndB();
            e2.copy(R0.p).cross(e1); c.copy(R0.p).addScaledVector(e1, r * Math.cos(a)).addScaledVector(e2, r * Math.sin(a)).normalize(); }
          else latDir(c);
          const e1 = basisOf(c, new THREE.Vector3(0, 1, 0).cross(c)), a = 6.2831853 * rndB(); e2.copy(c).cross(e1); const ax = e1.clone().multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a));
          const q0 = qPow(), [i, j] = free;
          for (const [k, s, sib] of [[i, 1, j], [j, -1, i]]) { const Q = P[k]; Q.p.copy(c).addScaledVector(ax, s * 0.015).normalize(); Q.q = 0; Q.sgn = s; Q.id = 1000 + k; init(Q, k, sib, clock, q0); u0(Q); }
          P[i].sibUid = P[j].uid; P[j].sibUid = P[i].uid; births++;
        } }
    };
    // шаг: время поверхности режется на подшаги ≤ 1 ч — итог не зависит от частоты кадров
    // фазы жизни для фотосферы (van Driel-Gesztelyi & Green 2015): всплытие — сначала яркие точки и факелы у оснований (bF), тень пятна
    // собирается из пор к ≈ 1,5 emergeH (sF); при распаде тень сжимается (площадь ∝ потоку) и под конец гаснет раньше факела — область
    // растворяется светлым факелом
    const phases = () => P.forEach(Q => { if (Q.dead) { Q.sF = 0; Q.bF = 0; return; } const E = Math.max(1, p.emergeH), age = clock - Q.born;
      Q.sF = Q.anchor ? 1 : sPhase(Q, age);
      Q.bF = Q.anchor ? 0 : smooth01(age / (0.1 * E)) * (1 - smooth01((age - 0.3 * E) / (1.2 * E))); });
    phases();
    const step = dt => { let dh = dt * p.surfH; if (!(dh > 0)) return false; while (dh > 1e-9) { const h = Math.min(1, dh); sub(h); dh -= h; } phases(); return true; };
    const depS = () => { const ds = P.filter(Q => alive(Q) && !Q.anchor).map(Q => Q.dep > 0 ? Q.dep : p.poleDepth); return ds.length ? { mean: ds.reduce((a, b) => a + b, 0) / ds.length, max: Math.max(...ds) } : null; };
    const stats = () => ({ clock, alive: P.filter(alive).length, births, cancMx: cancTot * PHI0, sumQ: P.reduce((a, Q) => a + Q.q, 0), dep: depS(),
      contacts: [...contacts.values()].sort((a, b) => b.canc - a.canc).slice(0, 3).map(c => ({ frac: c.canc / c.init, rope: c.rope / c.init, rateMx: c.rate * PHI0 })) });
    // takeEvents — уничтожения потока с прошлого вызова (стенд: карта поверхности; сбор включается первым вызовом)
    // stepHours — шаг в физических часах (стенд: фиксированные шаги, без привязки к кадрам)
    const stepHours = hh => { while (hh > 1e-9) { const h = Math.min(1, hh); sub(h); hh -= h; } phases(); };
    return { step, stepHours, stats, contacts, flowAt, vortAt, get clock() { return clock; }, takeEvents() { collect = true; return evq.splice(0, evq.length); } };
  }
  // ---- плазма на нитях (литература: DOC «Вспышки звезды цели — проект v1», «Сравнение с литературой — корональные петли»).
  // Нити — силовые линии от «+» полюсов: закрытые садятся на поверхность, открытые доходят до поверхности источника. Закрытая нить:
  // полудлина L, среднее поле B̄ → нагрев E_H (+ добавка от уничтожения потока у её оснований) → законы RTV (Rosner, Tucker & Vaiana 1978):
  // давление p₀ и температура вершины T_max → профиль T(s) = T_max·[(s/L)(2 − s/L)]^{2/7} → давление вдоль нити с силой тяжести
  // d ln p = −(R★/H(T))·dr/r² → плотность n = p/(2kT). Свечение — n²·Λ(T) (Klimchuk, Patsourakos & Cargill 2008). Частицы — порции
  // массы: на нить — пропорционально её массе (сечение у основания — доля потока полюса, A₀ ∝ |q|/(N·B)), в нити — равномерно по массовой
  // координате, бегут с сохранением массы (предел — скорость звука); яркость частицы — n·Λ(T), цвет — по температуре. Открытые — разреженные.
  // При самостоятельных полюсах (surface) нити добавляются и гаснут вслед за полюсами, перетрассируются по кругу (≤ 7 за кадр) с плавным
  // переходом формы (при смене связности — через гашение), частицы пересаживаются на нити с недостатком массы через гашение и проявление
  const KB = 1.380649e-16;
  const LAMBDA = [[4.97, 1.09e-31, 2], [5.67, 8.87e-17, -1], [6.18, 1.9e-22, 0], [6.55, 3.53e-13, -1.5], [6.9, 3.46e-25, 1 / 3], [7.63, 5.49e-16, -1], [99, 1.96e-27, 0.5]];
  const lambdaT = T => { const l = Math.log10(T); for (const [lt, a, b] of LAMBDA) if (l <= lt) return a * Math.pow(T, b); return 0; };
  // законы RTV: по нагреву E_H (эрг/(см³·с)) и полудлине L (см) — давление (дин/см²) и температура вершины (К)
  const rtv = (EH, Lcm) => { const pr = Math.pow(EH / 9.8e4, 6 / 7) * Math.pow(Lcm, 5 / 7); return { pr, T: 1400 * Math.cbrt(pr * Lcm) }; };
  function plasma(THREE, P, p, seed, ph, SF) {
    const rnd = mulberry(seed ^ 0x2545f491), e = (p.falloff + 1) / 2, o = [0, 0, 0], rMax = p.rSS > 1 ? p.rSS : 3, NK = 64;
    let C = charges(P, p), nC = C.length / 4;
    const gUnit = C.gUnit;   // единица поля, Гс (постоянная калибровка)
    const hR1 = 0.0722 * ph.rSun / ph.mSun, Rcm = ph.rKm * 1e5, vesc = 617.7 * Math.sqrt(ph.mSun / ph.rSun);    // H/R★ на 1 МК; R★, см; v_esc, км/с
    const h0 = () => ph.rope ? ph.rope.H[0] : 0;
    // затравки: на «+» полюс — 14·гладко(q) + 14·q; точки — постоянная последовательность в кольце (золотой угол): добавленная затравка не
    // сдвигает остальные; базис — переносится вместе с полюсом
    const wantSeeds = q => q > 0 ? Math.round(p.seedsBase * smooth01(q / 0.1) + p.seedsPerQ * q) : 0;
    const seedPos = (sd, out) => {
      const Q = P[sd.qi], c = Q.p, e1 = Q.e1 || basisOf(c, new THREE.Vector3(0, 1, 0).cross(c)), a = sd.k * 2.3999632 + (Q.uid | 0) * 0.618 * 6.2832;
      const r0 = p.seedRMin + (p.seedRMax - p.seedRMin) * Math.sqrt((sd.k + 0.5) / 32), ca = r0 * Math.cos(a), sa = r0 * Math.sin(a);
      const e2x = c.y * e1.z - c.z * e1.y, e2y = c.z * e1.x - c.x * e1.z, e2z = c.x * e1.y - c.y * e1.x;
      out[0] = c.x + e1.x * ca + e2x * sa; out[1] = c.y + e1.y * ca + e2y * sa; out[2] = c.z + e1.z * ca + e2z * sa; const l = 1.001 / Math.hypot(out[0], out[1], out[2]); out[0] *= l; out[1] *= l; out[2] *= l;
    };
    // ближайший «−» полюс к точке (куда села нить) — для смены связности
    const landing = (x, y, z, sg = 1) => { let best = -1, bd = 0.12; P.forEach((Q, i) => { if (Q.q * sg < 0 && !Q.dead) { const dd = Math.hypot(Q.p.x - x, Q.p.y - y, Q.p.z - z); if (dd < bd) { bd = dd; best = i; } } }); return best; };
    // силовая линия от затравки по полю (RK2): точки, |B| в точках, закрыта ли; слабое поле или сразу вниз — «неразрешённая» (без плазмы)
    const sp = [0, 0, 0];
    const trace = sd => {
      // от «−» полюса линия идёт против поля (sg = −1): своя петля у полюса, на который не садятся нити от «+»
      seedPos(sd, sp); let x = sp[0], y = sp[1], z = sp[2]; const sg = sd.sg || 1, F = (a, b2, c) => { fieldAt(a, b2, c, C, nC, e, p.open, o); if (sg < 0) { o[0] = -o[0]; o[1] = -o[1]; o[2] = -o[2]; } };
      F(x, y, z); let bx = o[0], by = o[1], bz = o[2], b = Math.hypot(bx, by, bz) + 1e-12;
      const X = [x, y, z], Bm = [b]; let closed = false, bad = (bx * x + by * y + bz * z) <= 0, r = 1, k = 0;   // в затравке поле должно выходить наружу
      for (; k < 1500 && !bad; k++) {
        const h = 0.003 + 0.012 * Math.min(1, (Math.hypot(x, y, z) - 1) * 6);
        F(x + bx / b * h / 2, y + by / b * h / 2, z + bz / b * h / 2); const bm = Math.hypot(o[0], o[1], o[2]);
        if (bm < 1e-6) { bad = true; break; }
        x += o[0] / bm * h; y += o[1] / bm * h; z += o[2] / bm * h;
        r = Math.hypot(x, y, z); if (r < 1) { x /= r; y /= r; z /= r; closed = true; }
        F(x, y, z); bx = o[0]; by = o[1]; bz = o[2]; b = Math.hypot(bx, by, bz) + 1e-12;
        X.push(x, y, z); Bm.push(b);
        if (closed || r > rMax) break;
      }
      if (!closed && r <= rMax) bad = true;
      if (!closed && sg < 0) bad = true;   // от «−» полюса — только петли: открытая линия одинокого «−» шла бы «из космоса» (автор)
      else if (!closed && p.windR > r) { const r1 = r, ux = x / r, uy = y / r, uz = z / r, b1 = b;   // за поверхностью источника поле радиально: продление до windR
        for (let rr = r1 + 0.1; rr <= p.windR + 1e-9; rr += 0.1) { X.push(ux * rr, uy * rr, uz * rr); Bm.push(b1 * (r1 / rr) * (r1 / rr)); } }                                      // не дошла ни до поверхности, ни до внешней границы — неразрешённая
      const L = X.length, iB = closed ? landing(X[L - 3], X[L - 2], X[L - 1], sg) : -1, QA = P[sd.qi], QB = iB >= 0 ? P[iB] : null;
      return { X: new Float32Array(X), B: Bm, closed: closed && L > 12, bad: bad || L <= 6, iB, genA: QA.gen | 0, genB: QB ? QB.gen | 0 : -1 };
    };
    // физика нити: длина, нагрев (с добавкой Hx от уничтожения потока), RTV, профиль температуры, давление с силой тяжести, плотность, масса;
    // итог — 64 узла, равномерно по длине (общая сетка для плавного перехода формы между трассами)
    const phys = (sd, tr, Hx, Lmin) => {   // Lmin — нижний предел полудлины в нагреве (мелкие петли: 5 Мм — регуляризация, Codex)
      if (tr.X.length < 6) { tr.X = Float32Array.of(tr.X[0], tr.X[1], tr.X[2], tr.X[0], tr.X[1], tr.X[2]); tr.B = [tr.B[0], tr.B[0]]; tr.bad = true; }   // вырожденная — без плазмы
      const X = tr.X, K = X.length / 3, s = new Float32Array(K), T = new Float32Array(K), n = new Float32Array(K), w = new Float32Array(K), cm = new Float32Array(K), lt = new Float32Array(K), na = new Float32Array(K);
      for (let k = 1; k < K; k++) s[k] = s[k - 1] + Math.hypot(X[k * 3] - X[k * 3 - 3], X[k * 3 + 1] - X[k * 3 - 2], X[k * 3 + 2] - X[k * 3 - 1]);
      const Lt = s[K - 1] || 1e-6, L = Lt / 2; let Bbar = 0, top = 0;
      for (let k = 0; k < K; k++) { Bbar += tr.B[k]; top = Math.max(top, Math.hypot(X[k * 3], X[k * 3 + 1], X[k * 3 + 2]) - 1); }
      Bbar = Bbar / K * gUnit;
      let Tm, lnp, EH = 0;
      if (tr.closed) {
        EH = p.heat * 1.8e-3 * Math.pow(Bbar / 100, p.heatB) * Math.pow(Math.max(Lmin || 1e7, L * Rcm) / 5e9, p.heatL) + (Hx || 0); const q = rtv(EH, L * Rcm);
        Tm = q.T; lnp = Math.log(q.pr);
        for (let k = 0; k < K; k++) { const u = Math.min(s[k], Lt - s[k]) / L; T[k] = Tm * Math.pow(Math.max(0.01, u * (2 - u)), 2 / 7); }
      } else { Tm = 1e6; lnp = Math.log(Math.max(1e-9, p.openN * 2)); T.fill(Tm); }
      // трубка: закрытая — почти постоянного сечения (≤ aMax); открытая — по полю (ветер расширяется, ≤ 50)
      const A0 = tr.B[0], aCap = tr.closed ? p.aMax : 50; let M = 0, Aprev = 1, csMin = Infinity;
      for (let k = 0; k < K; k++) {
        if (k) { const r0 = Math.hypot(X[k * 3 - 3], X[k * 3 - 2], X[k * 3 - 1]), r1 = Math.hypot(X[k * 3], X[k * 3 + 1], X[k * 3 + 2]);
          lnp -= (r1 - r0) / (r0 * r1) / (hR1 * 0.5 * (T[k] + T[k - 1]) / 1e6); }
        n[k] = Math.exp(lnp) / (2 * KB * T[k]); w[k] = n[k] * lambdaT(T[k]); lt[k] = Math.log10(T[k]);
        const A = p.eps ? Math.min(aCap, Math.pow(A0 / tr.B[k], p.eps)) : 1; na[k] = n[k] * A;   // видимые петли почти постоянного сечения: ширина ×1,1–1,3 (Klimchuk 2000; López Fuentes et al. 2006)
        csMin = Math.min(csMin, na[k] * 150 * Math.sqrt(T[k] / 1e6));   // наименьший поток со скоростью звука, n·A·c_s (c_s в км/с)
        if (k) M += 0.5 * (n[k] * A + n[k - 1] * Aprev) * (s[k] - s[k - 1]); cm[k] = M; Aprev = A;
      }
      // открытая линия — ветер: скорость v(r) разгоняется, сечение — по полю до поверхности источника (≤ 50), дальше ∝ r²; поток F = n·A·v
      // постоянен → n = F/(A·v); масса на длину n·A = F/v — частицы редеют там, где ветер быстрее
      let Fw = 0; if (!tr.closed && !tr.bad) { const vAt = rr => p.flowKms + (p.windKms - p.flowKms) * (1 - Math.exp(-Math.max(0, rr - 1) / Math.max(0.1, p.windAcc)));
        let Ass = 1, rss = rMax; M = 0; const F = n[0] * vAt(1); Fw = F;
        for (let k = 0; k < K; k++) { const rr = Math.hypot(X[k * 3], X[k * 3 + 1], X[k * 3 + 2]);
          const A = rr <= rss ? (Ass = p.eps ? Math.min(50, Math.pow(A0 / tr.B[k], p.eps)) : 1) : Ass * (rr / rss) * (rr / rss);
          T[k] = Tm * Math.min(1, Math.pow(rr / 1.5, -p.windTexp)); lt[k] = Math.log10(T[k]);   // остывает медленнее адиабаты (электроны r^−0,65 — Parker Solar Probe)
          n[k] = F / (A * vAt(rr)); w[k] = n[k] * lambdaT(T[k]); na[k] = n[k] * A;
          if (k) M += 0.5 * (na[k] + na[k - 1]) * (s[k] - s[k - 1]); cm[k] = M; } }   // нормировка cm — ниже, общая
      for (let k = 0; k < K; k++) cm[k] /= M || 1;
      if (tr.bad) M = 0;
      const Aend = tr.closed ? (p.eps ? Math.min(aCap, Math.pow(A0 / tr.B[K - 1], p.eps)) : 1) : na[K - 1] / (n[K - 1] || 1);
      // пересэмплирование на 64 узла равномерно по длине
      const R = { X: new Float32Array(NK * 3), T: new Float32Array(NK), n: new Float32Array(NK), na: new Float32Array(NK), w: new Float32Array(NK), lt: new Float32Array(NK), cm: new Float32Array(NK), rad: new Float32Array(NK), s: new Float32Array(NK) };
      for (let i = 0, k = 0; i < NK; i++) { const si = Lt * i / (NK - 1); while (k < K - 2 && s[k + 1] < si) k++; const d = s[k + 1] - s[k], f = d > 0 ? Math.min(1, Math.max(0, (si - s[k]) / d)) : 0, a = k * 3, b = a + 3;
        R.X[i * 3] = X[a] + (X[b] - X[a]) * f; R.X[i * 3 + 1] = X[a + 1] + (X[b + 1] - X[a + 1]) * f; R.X[i * 3 + 2] = X[a + 2] + (X[b + 2] - X[a + 2]) * f;
        for (const [dst, src] of [[R.T, T], [R.n, n], [R.na, na], [R.w, w], [R.lt, lt], [R.cm, cm]]) dst[i] = src[k] + (src[k + 1] - src[k]) * f;
        R.rad[i] = Math.hypot(R.X[i * 3], R.X[i * 3 + 1], R.X[i * 3 + 2]); R.s[i] = si; }
      R.cm[0] = 0; R.cm[NK - 1] = 1;
      return Object.assign(R, { sd, tr, K: NK, M, Lt, closed: tr.closed, Tm, Bbar, EH, Hx: Hx || 0, L: L * ph.rKm, top, Bfoot: A0 * gUnit, csMin, Fw,
        nA: [n[0], n[K - 1] * Aend], dir: tr.closed ? sd.dir : 1, f: sd.qi === 0 ? 1 : 0, iA: sd.qi, genA: tr.genA, iB: tr.iB, genB: tr.genB,   // открытая линия — только наружу (ветер)
        over: sd.qi === 0 && tr.closed && top > 0.8 * h0(), vis: 1, dying: false, free: false, refs: 0, wA: 1 });
    };
    // ---- показываемая форма нити — непрерывная (проект Codex 14.10.2026): от текущей показываемой формы и её скорости к новой трассе по
    // кубической кривой Эрмита за период обхода T; конечная скорость — по двум последним трассам; после конца отрезка — короткая
    // экстраполяция (≤ 0,2 T). Свойства плазмы (масса, яркость, температура) переходят линейно за тот же отрезок. Новая трасса может прийти
    // во время перехода — тогда отрезок перенацеливается с текущего состояния. Смена связности — гашение прежней и проявление новой
    let clk = 0;
    const PH = ['cm', 'w', 'lt'];
    // нить едет за своими основаниями: между трассами показываемая форма сдвигается на перенос полюсов с момента трассы (у основания A —
    // целиком, к B — линейно по длине; открытая или севшая не на полюс — дальний конец на месте). Автор: «линии за полюсами не поспевают»
    const anch = S => { const A = P[S.sd.qi], B = S.closed && S.iB >= 0 ? P[S.iB] : null;
      S.aA = A && !A.dead && (A.gen | 0) === S.genA ? [A.p.x, A.p.y, A.p.z] : null; S.aB = B && !B.dead && (B.gen | 0) === S.genB ? [B.p.x, B.p.y, B.p.z] : null; };
    const oA = [0, 0, 0], oB = [0, 0, 0];
    const offs = S => { oA[0] = oA[1] = oA[2] = oB[0] = oB[1] = oB[2] = 0;
      if (S.small) { const c = S.small.cNow; if (c && S.aC) { oA[0] = oB[0] = c.x - S.aC[0]; oA[1] = oB[1] = c.y - S.aC[1]; oA[2] = oB[2] = c.z - S.aC[2]; } return; }   // мелкая — с центром своей пары
      const A = P[S.sd.qi], B = S.iB >= 0 ? P[S.iB] : null;
      if (S.aA && A && !A.dead && (A.gen | 0) === S.genA) { oA[0] = A.p.x - S.aA[0]; oA[1] = A.p.y - S.aA[1]; oA[2] = A.p.z - S.aA[2]; S.lA = oA.slice(); } else if (S.lA) { oA[0] = S.lA[0]; oA[1] = S.lA[1]; oA[2] = S.lA[2]; }
      if (S.aB && B && !B.dead && (B.gen | 0) === S.genB) { oB[0] = B.p.x - S.aB[0]; oB[1] = B.p.y - S.aB[1]; oB[2] = B.p.z - S.aB[2]; S.lB = oB.slice(); } else if (S.lB) { oB[0] = S.lB[0]; oB[1] = S.lB[1]; oB[2] = S.lB[2]; } };   // полюс ушёл — последний перенос (форма не отскакивает)
    let verSeq = 0;
    const still = S => { S.ver = ++verSeq; S.D = S.X.slice(); S.Dv = new Float32Array(NK * 3); S.P0 = S.X; S.V0 = S.Dv; S.V1 = S.Dv; S.t0 = clk; S.Tseg = 1; S.tTrace = clk; anch(S);
      for (const k of PH) { S['d' + k] = S[k].slice(); S['p' + k] = S[k]; } };
    let shapeWarn = 0;
    const shape = S => {
      if (!S.D || !S.Dv || !S.P0) { if (shapeWarn++ < 3) console.warn('shape: нить без формы', S.small ? 'мелкая' : 'крупная', Object.keys(S).slice(0, 40).join(',')); return; }
      const u = (clk - S.t0) / S.Tseg, D = S.D, Dv = S.Dv, P0 = S.P0, V0 = S.V0, P1 = S.X, V1 = S.V1, Ts = S.Tseg;
      if (u < 1) { const u2 = u * u, u3 = u2 * u, a0 = 2 * u3 - 3 * u2 + 1, a1 = (u3 - 2 * u2 + u) * Ts, a2 = -2 * u3 + 3 * u2, a3 = (u3 - u2) * Ts;
        const b0 = (6 * u2 - 6 * u) / Ts, b1 = 3 * u2 - 4 * u + 1, b2 = (-6 * u2 + 6 * u) / Ts, b3 = 3 * u2 - 2 * u;
        for (let i = 0; i < NK * 3; i++) { D[i] = a0 * P0[i] + a1 * V0[i] + a2 * P1[i] + a3 * V1[i]; Dv[i] = b0 * P0[i] + b1 * V0[i] + b2 * P1[i] + b3 * V1[i]; } }
      else { const dt = Math.min(clk - S.t0 - Ts, 0.2 * Ts), ex = clk - S.t0 - Ts < 0.2 * Ts; for (let i = 0; i < NK * 3; i++) { D[i] = P1[i] + V1[i] * dt; Dv[i] = ex ? V1[i] : 0; } }
      offs(S); for (let i = 0; i < NK; i++) { const w = i / (NK - 1), i3 = i * 3; D[i3] += (1 - w) * oA[0] + w * oB[0]; D[i3 + 1] += (1 - w) * oA[1] + w * oB[1]; D[i3 + 2] += (1 - w) * oA[2] + w * oB[2]; }   // перенос основаниями
      const rm = S.rMin || 1.0005; for (let i = 0; i < NK; i++) { const r = Math.hypot(D[i * 3], D[i * 3 + 1], D[i * 3 + 2]); if (r < rm) { const k = rm / (r || 1), i3 = i * 3; D[i3] *= k; D[i3 + 1] *= k; D[i3 + 2] *= k;   // не под поверхность;
        const vr = (Dv[i3] * D[i3] + Dv[i3 + 1] * D[i3 + 1] + Dv[i3 + 2] * D[i3 + 2]) / (rm * rm); if (vr < 0) { Dv[i3] -= vr * D[i3]; Dv[i3 + 1] -= vr * D[i3 + 1]; Dv[i3 + 2] -= vr * D[i3 + 2]; } } }   // скорость — без движения вниз
      const f = Math.min(1, Math.max(0, u)); for (const k of PH) { const d = S['d' + k], a = S['p' + k], b = S[k]; for (let i = 0; i < NK; i++) d[i] = a[i] + (b[i] - a[i]) * f; }
    };
    // пул нитей: str[j] — нить или освободившийся слот; затравки по полюсам
    const str = [], perPole = new Map();
    // новая затравка: при сборке — сразу трасса; потом — заготовка (pending), трассируется в общей очереди с бюджетом
    const addSeed = (qi, k, vis, now) => { const Q = P[qi], sd = { qi, gen: Q.gen | 0, k, sg: Math.sign(Q.q) || 1, dir: ((k * 7 + (Q.uid | 0)) & 1) ? 1 : -1 };
      let S; if (now) { S = phys(sd, trace(sd)); still(S); } else S = { sd, pending: true, M: 0, wA: 0, vis: 0, dying: false, free: false, refs: 0, closed: false };
      S.vis = vis; S.due = clk + rnd(); let j = str.findIndex(x => x.free); if (j < 0) { j = str.length; str.push(S); } else str[j] = S;
      (perPole.get(qi) || perPole.set(qi, []).get(qi)).push(j); return j; };
    let covPrev = new Map(), covF = new Map();   // покрытие «−» полюсов нитями от «+»: число нитей (прошлая переразметка) и доля потока
    const quota = () => { let s = 0; P.forEach((Q, qi) => { if (!Q.dead) s += Q.q > 0 ? wantSeeds(Q.q) : Math.max(0, wantSeeds(-Q.q) - (covPrev.get(qi) || 0)); }); return Math.min(1, p.seedQuota / Math.max(1, s)); };   // «−» — в среднем половина (их поток чаще покрыт нитями от «+»)   // общий предел затравок (Codex: 240 при 48 полюсах)
    { const qk = quota(); P.forEach((Q, qi) => { for (let k = 0, n = Math.round(wantSeeds(Q.q) * qk); k < n; k++) addSeed(qi, k, 1, true); }); }
    // вес нити: доля потока полюса на затравку и B у основания; с учётом видимости — проявляющиеся и гаснущие нити полюса вместе представляют |q|
    const reweigh = () => { for (const [qi, list] of perPole) { const Q = P[qi]; let sv = 0; for (const j of list) { const S = str[j]; if (!S.free && !S.pending && S.sd.qi === qi) sv += S.vis; }
      for (const j of list) { const S = str[j]; if (S.free || S.pending || S.sd.qi !== qi) continue; S.wA = Math.abs(Q.q) * (Q.q < 0 ? 1 - (covF.get(qi) || 0) : 1) / Math.max(1e-3, sv) / Math.max(1e-6, S.Bfoot / gUnit); } } };   // «−» — только непокрытая часть потока
    reweigh();
    const massOf = S => S.free || S.pending ? 0 : S.M * S.wA * S.vis * (S.closed ? 1 : p.windShow);   // ветер — с показным множителем доли частиц
    // частицы на нить — по массе в степени pMassPow (< 1 — точки есть и у слабых петель); яркость точки умножается на массу/долю (bK — к среднему),
    // поэтому свет нити остаётся пропорциональным её массе
    const shareOf = S => { const m = massOf(S); return m > 0 ? Math.pow(m, p.pMassPow) : 0; };
    let bK = 1; const lightOf = S => { const m = massOf(S), sh = shareOf(S); return sh > 0 ? Math.min(20, m / sh * bK) : 0; };
    let mass0 = str.reduce((a, S) => a + massOf(S), 0) || 1;
    // частицы: по нитям — пропорционально массе (расслоенная выборка); в нити — равномерно по массовой координате m ∈ [0, 1)
    const N = Math.max(0, Math.round(p.pN)), js = new Uint16Array(N), ms = new Float32Array(N), pf = new Float32Array(N).fill(1), pfd = new Int8Array(N), pdr = new Int8Array(N), ptm = new Float32Array(N), pvs = new Float32Array(N), opos = new Float32Array(N * 3), odir = new Float32Array(N * 3), orw = new Float32Array(N * 3), olk = new Float32Array(N), olt = new Float32Array(N), ob = [0, 0, 0], pAge = new Float32Array(N).fill(10);   // pfd: −1 стекает, −2 стекла, 1 входит; pAge — с последнего входа, с
    const tr = p.pTrail > 0;
    { const tot = str.reduce((a, S) => a + shareOf(S), 0); bK = tot / (str.reduce((a, S) => a + massOf(S), 0) || 1); for (let i = 0, j = 0, acc = str.length ? shareOf(str[0]) : 0; i < N; i++) { const u = (i + 0.5) / N * tot; while (j < str.length - 1 && acc < u) acc += shareOf(str[++j]); js[i] = j; ms[i] = rnd(); } }
    // «баллистические» частицы — испарение при вспышке (петли между якорями) и корональный дождь (длинные петли); списки обновляются
    let evS = [], rainS = [];
    const lists = () => { const Ls = str.filter(S => !S.free && !S.pending && !S.dying && S.closed).map(S => S.Lt).sort((a, b) => a - b), Lmed = Ls.length ? Ls[Ls.length >> 1] : 0; evS = []; rainS = [];
      str.forEach((S, j) => { if (S.free || S.pending || S.dying || !S.closed || S.vis < 0.5) return; if (S.f && S.iB === 1) evS.push(j); if (S.Lt >= Lmed) rainS.push(j); }); };   // испарение — только петли между якорями (0 → 1)
    lists();
    const NE = ph.flares ? Math.max(0, Math.round(p.evN)) : 0, NR = Math.max(0, Math.round(p.rainN)), NB = NE + NR, NL = ph.labLOD && SF ? Math.max(0, Math.round(p.lodN)) : 0;
    const NP = ph.rope && ph.cme ? Math.max(0, Math.round(p.promN)) : 0, NT = N + NB + NP + NL + (SF ? Math.max(0, Math.round(p.puffN || 0)) : 0), nv = tr ? 2 * NT : NT;   // в конце — облака   // NL — частицы мелких пар (в конце)
    const prD = new Float32Array(NP * 3); for (let i = 0; i < NP * 3; i++) prD[i] = rnd();   // протуберанец: место вдоль жгута, закрутка, радиус
    const bj = new Uint16Array(NB), bs = new Float32Array(NB), bu = new Float32Array(NB), bt0 = new Float32Array(NB).fill(-1);
    const gp = new Float32Array(nv * 3), ga = new Float32Array(nv), gf = new Float32Array(nv), gt = new Float32Array(nv), gz = new Float32Array(nv).fill(1);   // gz — размер точки, ×
    const geo = new THREE.BufferGeometry();
    for (const [k, a, w] of [['position', gp, 3], ['aA', ga, 1], ['aF', gf, 1], ['aT', gt, 1], ['aZ', gz, 1]]) geo.setAttribute(k, new THREE.BufferAttribute(a, w).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.max(rMax, p.windR + 1));
    // ---- уровень детализации (только стенд, opts.labLOD; проект Codex 14.10.2026). «Количества полюсов не существует»: ниже 4·10²⁰ Мкс
    // (поток рождения пары) — процедурный каталог мелких пар, не зависящий от камеры: семь полудекад до 2·10¹⁷ Мкс, живых на единицу ln Φ
    // A·(Φ/4·10²⁰)^−0,85 (A = 45,6 — продолжение крупных у границы; наклон живых −1,85, Parnell et al. 2009); разнос d(Φ), глубина h(Φ),
    // жизнь τ(Φ) = 6…72 ч — проектные зависимости (эфемерные области: ≈ 5 Мм при ≈ 10¹⁹ Мкс). Рождения — по ячейкам кубической сетки сферы
    // и эпохам длиной τmax по хэшу (те же пары в тех же местах при каждом приближении), плотность по широте как у крупных; центр пары плывёт
    // общим течением поверхности (шаг 1 ч от рождения). Показ — по камере: ячейки у ближайшей к ней точки, петля ≥ 4 px; по lodSeeds нитей
    // на пару в поле крупных и своей пары; свой пул частиц; проявление 0,25 с, гашение 0,4 с. Камера управляет только показом, не полем
    const LOD = (() => {
      if (!NL) return null;
      const LB0 = 4e20, Alod = 45.6, Q4 = Math.PI / 4;
      const dOf = phi => { const x = phi / 1e19; return 0.03846 * (x <= 1 ? Math.sqrt(x) : Math.pow(x, 0.32184)); };
      // глубина заряда — радиус трубки с полем тени B_s: h = √(Φ/πB_s) — у поверхности ≈ 2,3 кГс при любом потоке, как у настоящих концентраций
      // (при h ≈ 0,3 d было ≈ 160 Гс — слабее фона, свои петли не замыкались)
      const hOf = phi => Math.max(0.0015, Math.sqrt(phi / (Math.PI * p.spotBs)) / Rcm);
      const tauOf = phi => Math.min(72, Math.max(6, 72 * Math.sqrt(phi / 4e20)));
      let wMean = 0; for (let k = 0; k < 200; k++) { const y = (k + 0.5) / 100 - 1; wMean += Math.pow(1 - y * y, p.latBias / 2) / 200; }
      const bands = [];
      for (let b = 0; b < Math.min(7, p.lodBands); b++) { const hi = LB0 / Math.pow(10, b / 2), lo = Math.max(2e17, hi / Math.sqrt(10)); if (hi <= 2e17 * 1.01) break;
        const Npairs = Alod / 2 / 0.85 * (Math.pow(lo / LB0, -0.85) - Math.pow(hi / LB0, -0.85)), mid = Math.sqrt(lo * hi), d = dOf(mid), n = Math.max(2, Math.ceil(Math.PI / 2 / (2 * d)));
        let rate = 0; for (let k = 0; k < 40; k++) { const f2 = lo * Math.pow(hi / lo, (k + 0.5) / 40); rate += Alod / 2 * Math.pow(f2 / LB0, -0.85) / tauOf(f2) * Math.log(hi / lo) / 40; }   // рождений в час на всей звезде
        bands.push({ id: b, lo, hi, d, tauMax: tauOf(hi), rate, n, da: Math.PI / 2 / n, N: Npairs }); }
      const h32 = (...a) => { let h = (seed ^ 0x6c8e9cf5) >>> 0; for (const v of a) { h = Math.imul(h ^ (v | 0), 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; } return h >>> 0; };
      // грани куба: главная ось m, знак sg; (a, b) — тангенсы по двум другим осям
      const faceDir = (fc, a, b, out) => { const m = fc >> 1, sg = fc & 1 ? -1 : 1, v = [0, 0, 0]; v[m] = sg; v[(m + 1) % 3] = a; v[(m + 2) % 3] = b; return out.set(v[0], v[1], v[2]).normalize(); };
      const cellOf = (B, x, y, z) => { const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z), m = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2, c = [x, y, z], M = Math.abs(c[m]);
        const fc = m * 2 + (c[m] < 0 ? 1 : 0), a = c[(m + 1) % 3] / M, b = c[(m + 2) % 3] / M, cl = v => Math.max(0, Math.min(B.n - 1, Math.floor((Math.atan(v) + Q4) / B.da)));
        return [fc, cl(a), cl(b)]; };
      const poisson = (mu, r) => { let k = 0, L = Math.exp(-mu), pp = r(); while (pp > L && k < 50) { k++; pp *= r(); } return k; };
      // кэш событий ячеек: вытеснение самых старых записей (порядок обращения), не полный сброс — положения пар не пересчитываются хором
      const evCache = new Map(), tmp = new THREE.Vector3();
      const cellEvents = (B, fc, i, j, ep) => { const key = B.id + '|' + fc + '|' + i + '|' + j + '|' + ep; let ev = evCache.get(key);
        if (ev) { evCache.delete(key); evCache.set(key, ev); return ev; }
        const r = mulberry(h32(B.id, fc, i, j, ep + 100000)), ac = Math.tan(-Q4 + (i + 0.5) * B.da), bc = Math.tan(-Q4 + (j + 0.5) * B.da);
        const J = (1 + ac * ac) * (1 + bc * bc) / Math.pow(1 + ac * ac + bc * bc, 1.5), c = faceDir(fc, ac, bc, tmp);
        const mu = B.rate * B.tauMax * J * B.da * B.da / (4 * Math.PI) * Math.pow(Math.max(0, 1 - c.y * c.y), p.latBias / 2) / wMean;
        ev = []; for (let k = poisson(mu, r); k > 0; k--) {
          // поток рождения: плотность живых ∝ Φ^−1,85, делённая на τ(Φ) (отбор с вероятностью τ(lo)/τ(Φ)) — в стационаре живые снова ∝ Φ^−1,85
          let phi = B.lo; for (let g = 0; g < 20; g++) { phi = Math.pow(Math.pow(B.lo, -0.85) + r() * (Math.pow(B.hi, -0.85) - Math.pow(B.lo, -0.85)), -1 / 0.85); if (r() <= tauOf(B.lo) / tauOf(phi)) break; }
          const c0 = faceDir(fc, Math.tan(-Q4 + (i + r()) * B.da), Math.tan(-Q4 + (j + r()) * B.da), new THREE.Vector3()), ang = 6.2832 * r(), born = (ep + r()) * B.tauMax;
          const e1 = basisOf(c0, new THREE.Vector3(0, 1, 0).cross(c0)), e2 = c0.clone().cross(e1);
          ev.push({ id: key + '|' + k, B, born, phi, q0: phi / PHI0, tau: tauOf(phi), d: dOf(phi), h: hOf(phi), c0, ax0: e1.multiplyScalar(Math.cos(ang)).addScaledVector(e2, Math.sin(ang)), hs: r() }); }
        evCache.set(key, ev);
        if (evCache.size > 6000) { let n = 1000; for (const k2 of evCache.keys()) { evCache.delete(k2); if (--n <= 0) break; } }
        return ev; };
      // состояние пары на часы поверхности T: центр — перенос течением от рождения (шаг 1 ч, кэш), ось — вслед за центром; поток и разнос — по возрасту
      const fl = new THREE.Vector3(), fm = new THREE.Vector3();
      const pairAt = (ev, T) => { const age = T - ev.born; if (age < 0 || age >= ev.tau) return null;
        if (!ev.pos || ev.tPos > T) { ev.pos = ev.c0.clone(); ev.ax = ev.ax0.clone(); ev.tPos = ev.born; }
        while (ev.tPos + 1 <= T) { SF.flowAt(ev.pos, fl, ev.tPos); fm.copy(ev.pos).addScaledVector(fl, 0.5).normalize(); SF.flowAt(fm, fl, ev.tPos + 0.5);
          ev.pos.add(fl).normalize(); ev.ax.addScaledVector(ev.pos, -ev.ax.dot(ev.pos)).normalize(); ev.tPos += 1; }
        const c = ev.pos.clone(); if (T > ev.tPos) { SF.flowAt(c, fl, ev.tPos); fm.copy(c).addScaledVector(fl, 0.5 * (T - ev.tPos)).normalize(); SF.flowAt(fm, fl, ev.tPos + 0.5 * (T - ev.tPos)); c.addScaledVector(fl, T - ev.tPos).normalize(); }
        const ax = ev.ax.clone().addScaledVector(c, -ev.ax.dot(c)).normalize();
        const E = ev.tau / 3, q = age < E ? ev.q0 * smooth01(age / E) : ev.q0 * Math.max(0, 1 - (age - E) / (ev.tau - E));
        return { c, ax, q, sep: ev.d * (0.2 + 0.8 * smooth01(age / (0.6 * ev.tau))), age }; };
      // активные пары: id → { ev, alpha, tgt, S: [нити по затравкам], old: [гаснущие], sa, cNow }
      const why = { inward: 0, long: 0, high: 0, steps: 0, away: 0, short: 0, ok: 0, near: 0 };
      const act = new Map(); let cam = null, pxv = 800, selT = 1e9, scanned = 0, cand = 0, tLod = 0;
      const visible = (ev, sa) => { if (!sa || !cam || sa.c.dot(cam) <= 1.0) return 0; return ev.d * pxv / Math.hypot(cam.x - sa.c.x, cam.y - sa.c.y, cam.z - sa.c.z); };
      const select = T => { if (!cam) return; const D = cam.length(); if (D <= 1.01) return; const foc = cam.clone().normalize(), e1 = basisOf(foc, new THREE.Vector3(0, 1, 0).cross(foc)), e2 = foc.clone().cross(e1);
        const found = []; scanned = 0;
        for (const B of bands) { const dHi = dOf(B.hi); if (dHi * pxv / (D - 1) < 4) break;   // самая крупная петля полосы меньше 4 px даже под камерой — эта и мельче не видны
          const zMax = dHi * pxv / 4, cosT = Math.max(1 / D, (D * D + 1 - zMax * zMax) / (2 * D)), th = Math.acos(Math.min(1, cosT)) + B.da, R = Math.tan(Math.min(th, 1.3));
          let st = B.da / 2; while ((2 * R / st) * (2 * R / st) > 6000) st *= 1.5;
          const cells = new Map(), v = new THREE.Vector3();
          for (let a = -R; a <= R; a += st) for (let b = -R; b <= R; b += st) { if (a * a + b * b > R * R) continue; v.copy(foc).addScaledVector(e1, a).addScaledVector(e2, b).normalize();
            const [fc, i, j] = cellOf(B, v.x, v.y, v.z), key = fc * 1e6 + i * 1000 + j; if (!cells.has(key)) cells.set(key, [fc, i, j, a * a + b * b]); }
          const list = [...cells.values()].sort((x, y) => x[3] - y[3]).slice(0, 800); scanned += list.length;
          const ep = Math.floor(T / B.tauMax);
          for (const [fc, i, j] of list) for (const e of [ep - 1, ep]) for (const ev of cellEvents(B, fc, i, j, e)) { const sa = pairAt(ev, T); if (!sa) continue;
            const pxl = visible(ev, sa); if (pxl < 4) continue; found.push({ ev, pxl }); } }
        cand = found.length;
        // устойчивый выбор: квоты по полосам (крупные не вытесняют мелких и наоборот); внутри — уже показанные, потом по хэшу пары
        const byBand = new Map(); for (const o of found) { const k = o.ev.B.id; if (!byBand.has(k)) byBand.set(k, []); byBand.get(k).push(o); }
        const quota = Math.max(1, Math.ceil(p.lodPairs / Math.max(1, byBand.size))), keep = new Set();
        for (const list of byBand.values()) { list.sort((x, y) => (act.has(y.ev.id) ? 1 : 0) - (act.has(x.ev.id) ? 1 : 0) || x.ev.hs - y.ev.hs); list.slice(0, quota).forEach(o => keep.add(o.ev.id)); }
        // показанные, которых обход не встретил (ячейка за пределом обхода), — держим, пока видны
        for (const [id, pr] of act) if (!keep.has(id) && pr.tgt > 0 && keep.size < p.lodPairs * 1.25 && visible(pr.ev, pairAt(pr.ev, T)) >= 4) keep.add(id);
        for (const [id, pr] of act) pr.tgt = keep.has(id) ? 1 : 0;
        for (const o of found) if (keep.has(o.ev.id) && !act.has(o.ev.id)) act.set(o.ev.id, { ev: o.ev, alpha: 0, tgt: 1, S: [], old: [], sa: null, cNow: null }); };
      // нить мелкой пары: от «+» основания по полю (крупные + своя пара), шаг 0,02 d
      const traceSmall = (pr, k, sa) => { const ev = pr.ev, d = ev.d, hp = sa.sep / 2, kd = 1 - ev.h;
        const cp = sa.c.clone().addScaledVector(sa.ax, hp).normalize(), cn = sa.c.clone().addScaledVector(sa.ax, -hp).normalize();
        const Cs = new Float32Array(C.length + 8); Cs.set(C); Cs.dip = C.dip; Cs.dipU = C.dipU; Cs.dipM = C.dipM; const nCs = nC + 2, o2 = [0, 0, 0];
        Cs[nC * 4] = cp.x * kd; Cs[nC * 4 + 1] = cp.y * kd; Cs[nC * 4 + 2] = cp.z * kd; Cs[nC * 4 + 3] = sa.q; Cs[nC * 4 + 4] = cn.x * kd; Cs[nC * 4 + 5] = cn.y * kd; Cs[nC * 4 + 6] = cn.z * kd; Cs[nC * 4 + 7] = -sa.q;
        // затравки — на стороне «+» основания, обращённой к своей «−» (±60°): петли пары, а не линии в чужое поле
        const t1 = cn.clone().sub(cp); t1.addScaledVector(cp, -t1.dot(cp)).normalize(); const t2 = cp.clone().cross(t1), fr = (k * 0.618 + ev.hs) % 1;
        const a = (fr - 0.5) * 2.1, rr = Math.max(ev.h * 0.5, d * (0.03 + 0.07 * ((k * 0.382 + ev.hs * 3) % 1)));
        const x0 = cp.clone().addScaledVector(t1, rr * Math.cos(a)).addScaledVector(t2, rr * Math.sin(a)).setLength(1 + 0.02 * d);
        let x = x0.x, y = x0.y, z = x0.z; const X = [x, y, z], Bm = [], h = 0.02 * d; let len = 0, closed = false;
        fieldAt(x, y, z, Cs, nCs, e, p.open, o2); Bm.push(Math.hypot(o2[0], o2[1], o2[2]));
        if ((o2[0] * x + o2[1] * y + o2[2] * z) <= 0) { why.inward++; return null; }   // у основания поле должно выходить наружу
        for (let s2 = 0; s2 < 512; s2++) { fieldAt(x, y, z, Cs, nCs, e, p.open, o2); let bm = Math.hypot(o2[0], o2[1], o2[2]); if (bm < 1e-9) return null;
          const mx = x + o2[0] / bm * h / 2, my = y + o2[1] / bm * h / 2, mz = z + o2[2] / bm * h / 2; fieldAt(mx, my, mz, Cs, nCs, e, p.open, o2); bm = Math.hypot(o2[0], o2[1], o2[2]); if (bm < 1e-9) return null;
          x += o2[0] / bm * h; y += o2[1] / bm * h; z += o2[2] / bm * h; len += h; const r = Math.hypot(x, y, z);
          if (r < 1) { x /= r; y /= r; z /= r; closed = true; } X.push(x, y, z); Bm.push(bm);
          if (closed) break; if (len > 8 * d || r - 1 > 2 * d) { why[len > 8 * d ? 'long' : 'high']++; return null; } }
        if (!closed) { why.steps++; return null; } if (X.length < 18) { why.short++; return null; }
        // села не на свою «−» — связь с соседним потоком (как «магнитный ковёр»: у эфемерных областей около половины потока уходит к соседям);
        // короткая (≤ 6 d) — показываем, длинная — часть крупной структуры, не мелкой пары
        const own = Math.hypot(x - cn.x, y - cn.y, z - cn.z) <= 0.5 * d;
        let endKey = -1; if (!own) { let bd = 1e9; for (const Q of P) { if (Q.dead || !Q.q) continue; const dd = Math.hypot(Q.p.x - x, Q.p.y - y, Q.p.z - z); if (dd < bd) { bd = dd; endKey = Q.uid | 0; } } }   // чужой конец — ближайший крупный полюс
        if (!own) { if (len > 6 * d) { why.away++; return null; } why.near++; } else why.ok++;
        return { X: new Float32Array(X), B: Bm, closed: true, bad: false, iB: -1, genA: 0, genB: -1, own, endKey }; };
      // перетрассировка мелкой нити: плавный переход (Эрмит) в системе центра пары; смена связности или неудача — прежняя гаснет за 0,4 с,
      // новая проявляется (без морфинга через звезду)
      const sPer = 0.5; let gSeq = 0, Mref = 0;
      const retraceSmall = (pr, k, sa) => { const old = pr.S[k], has = old && old.X && !old.lost, tr2 = traceSmall(pr, k, sa);
        if (!tr2) { if (has) { old.lost = true; pr.old.push(old); } pr.S[k] = { lost: true, due: clk + sPer }; return; }
        const S = phys({ qi: -1, k, dir: (k + (pr.ev.hs * 7 | 0)) & 1 ? 1 : -1, sg: 1 }, tr2, 0, 5e8);
        Object.assign(S, { small: pr, k, d: pr.ev.d, rMin: 1 + 0.002 * pr.ev.d, own: tr2.own, endKey: tr2.endKey, aC: [sa.c.x, sa.c.y, sa.c.z], due: clk + sPer });
        const e3 = (NK - 1) * 3, flip = has && (old.own !== S.own || old.endKey !== S.endKey || Math.hypot(S.X[e3] - old.D[e3], S.X[e3 + 1] - old.D[e3 + 1], S.X[e3 + 2] - old.D[e3 + 2]) > 0.3 * pr.ev.d);
        if (!has || flip) { still(S); S.vis = 1; S.grow = 0; S.g = ++gSeq; if (flip) { old.lost = true; pr.old.push(old); } pr.S[k] = S; return; }   // новая — растёт от «+» основания
        // плавный переход — та же нить для частиц
        S.grow = old.grow; S.g = old.g; S.vis = old.vis; S.D = old.D; S.Dv = old.Dv; S.P0 = old.D.slice(); S.V0 = old.Dv.slice(); S.t0 = clk; S.Tseg = sPer; S.tTrace = clk; anch(S);
        const dtr = Math.max(0.1, clk - (old.tTrace || clk - sPer)), V1 = new Float32Array(NK * 3), lim = 0.2 * pr.ev.d / sPer, oc = [sa.c.x - old.aC[0], sa.c.y - old.aC[1], sa.c.z - old.aC[2]];
        for (let i = 0; i < NK * 3; i++) V1[i] = Math.max(-lim, Math.min(lim, (S.X[i] - old.X[i] - oc[i % 3]) / dtr)); S.V1 = V1;   // в системе центра пары
        for (const kk of PH) { S['d' + kk] = old['d' + kk]; S['p' + kk] = old['d' + kk].slice(); } pr.S[k] = S; };
      // частицы мелких: постоянная ссылка на нить; нить пропала — частица гаснет за 0,2 с и пересаживается на живую нить (поровну);
      // течение — как у крупных петель (поток один, предел звука); на паузе стоят, проявление и гашение — по реальному времени
      const sPr = new Array(NL).fill(null), sK = new Int8Array(NL), sG = new Int32Array(NL), sm = new Float32Array(NL), sa2 = new Float32Array(NL), sOut = new Uint8Array(NL), wl = [0, 0, 0, 0, 0, 0, 1], wl2 = [0, 0, 0, 0, 0, 0, 1];
      const flat = [], live = [];
      // нить частицы: текущая в слоте k пары того же поколения (плавные переходы сохраняют поколение) или гаснущая того же поколения
      const refOf = i => { const pr = sPr[i]; if (!pr || !act.has(pr.ev.id)) return null; const S = pr.S[sK[i]]; if (S && S.X && !S.lost && S.g === sG[i]) return S;
        for (const O of pr.old) if (O.g === sG[i]) return O; return null; };
      const step = (dt, realDt) => { const t0 = performance.now(), T = SF.clock;
        selT += realDt; if (selT >= 0.25) { selT = 0; select(T); }
        // пары: состояние и видимость; текущая форма нитей — до перенацеливания; очередь трасс по сроку
        const due = [];
        for (const [id, pr] of act) { const sa = pairAt(pr.ev, T); pr.sa = sa; if (sa) pr.cNow = sa.c; else pr.tgt = 0;
          pr.alpha = pr.tgt > pr.alpha ? Math.min(pr.tgt, pr.alpha + realDt / 0.25) : Math.max(pr.tgt, pr.alpha - realDt / 0.4);
          if (pr.alpha <= 0 && pr.tgt === 0) { act.delete(id); continue; }
          for (let k = 0; k < p.lodSeeds; k++) { const S = pr.S[k]; if (S && S.X && !S.lost) shape(S); if (sa && pr.tgt > 0 && (!S || clk >= (S.due || 0))) due.push([pr, k, S ? S.due || 0 : -1]); }
          for (const O of pr.old) shape(O); }
        due.sort((a, b) => a[2] - b[2]);
        let budget = Math.max(2, 12 - tracesUsed); tracesUsed = 0; for (const [pr, k] of due) { if (budget-- <= 0 || performance.now() - t0 > 2) break; retraceSmall(pr, k, pr.sa); const S = pr.S[k]; if (S && S.X && !S.lost) shape(S); }
        // видимость нитей — по реальному времени; гаснущие уходят при нуле
        flat.length = 0; live.length = 0;
        const vGs = p.growKms / vesc / p.tDyn * (p.flowBoost || 1);
        for (const pr of act.values()) { for (const S of pr.S) if (S && S.X && !S.lost) { S.vis = Math.min(1, S.vis + realDt / 0.25); if (S.grow < 1) S.grow = Math.min(1, S.grow + vGs * realDt / Math.max(0.01, S.Lt || 0.01)); flat.push(S); live.push(S); }
          pr.old = pr.old.filter(O => (O.vis -= realDt / 0.4) > 0); for (const O of pr.old) flat.push(O); }
        // частицы
        const kms = 1 / vesc / p.tDyn, fb = p.flowBoost || 1, v0 = p.flowKms * kms * fb, base = N + NB + NP, tau = p.pTrail;
        // число частиц на нити — для нормировки яркости (свет нити ∝ её массе, делится между её частицами)
        const cnt = new Map(); for (let i = 0; i < NL; i++) { const S = refOf(i); if (S) cnt.set(S, (cnt.get(S) || 0) + 1); }
        if (!Mref) for (const S of live) if (S.M > 0) { Mref = S.M; break; }   // эталон массы — первая мелкая нить (дальше не меняется)
        for (let i = 0; i < NL; i++) { const v = tr ? 2 * (base + i) : base + i; let S = refOf(i);
          if (!S || sOut[i]) { sa2[i] -= realDt / 0.2; if (sa2[i] <= 0 || !S) { const T2 = live.length ? live[(rnd() * live.length) | 0] : null; S = T2; sPr[i] = T2 ? T2.small : null; sK[i] = T2 ? T2.k : 0; sG[i] = T2 ? T2.g : 0; sm[i] = rnd(); sa2[i] = 0; sOut[i] = 0; } }
          else sa2[i] = Math.min(1, sa2[i] + realDt / 0.3);
          if (!S || !(S.M > 0)) { ga[v] = 0; if (tr) ga[v + 1] = 0; continue; }
          const pr = S.small, r1 = Math.min(v0 * S.nA[0] / S.M, p.csEta * S.csMin * kms * fb / S.M);
          let m = sm[i] + S.dir * r1 * dt; m -= Math.floor(m); sm[i] = m;
          look(S, S.grow < 1 ? Math.min(m, uToM(S, S.grow)) : m, v, wl); const edge = Math.min(1, Math.min(m, 1 - m) / 0.03), gzv = Math.min(1, 0.05 * pr.ev.d / p.pSize);
          // яркость: свет нити ∝ её массе (рассеянный свет ∝ n), делится между её частицами, относительно эталона Mref; уровень полосы;
          // мелкие точки: площадь ∝ gz² сама (шейдер делит яркость на aZ, умножаем на gz — на пиксель как у обычной точки)
          const gain = Math.max(0.4, 1 - 0.1 * pr.ev.B.id) * Math.min(3, Math.max(0.1, (S.M * NL / Math.max(1, live.length)) / (Mref * (cnt.get(S) || 1))));
          ga[v] = 0.5 * p.lodBright * gain * edge * S.vis * pr.alpha * Math.max(0, sa2[i]) * gzv; gt[v] = wl[1]; gf[v] = 0; gz[v] = gzv;
          if (tr) { look(S, Math.min(1, Math.max(0, m - S.dir * r1 * tau)), v + 1, wl2); ga[v + 1] = 0; gt[v + 1] = gt[v]; gf[v + 1] = 0; gz[v + 1] = gzv; } }
        // пересадка (по часам модели): ~0,3 частицы в секунду на частицу — на случайные живые нити
        if (dt > 0 && live.length) for (let i = 0; i < NL; i++) if (rnd() < dt * 0.3) sOut[i] = 1;
        geo.attributes.position.needsUpdate = true; geo.attributes.aA.needsUpdate = true; geo.attributes.aF.needsUpdate = true; geo.attributes.aT.needsUpdate = true; geo.attributes.aZ.needsUpdate = true;
        tLod = tLod * 0.9 + (performance.now() - t0) * 0.1; };
      const stats = () => ({ bands: bands.map(B => ({ lo: B.lo, d: +B.d.toFixed(4), tau: +B.tauMax.toFixed(1), N: Math.round(B.N), cells: 6 * B.n * B.n })), active: act.size, strands: live.length, fading: flat.length - live.length, why: Object.assign({}, why), cand, scanned, ms: +tLod.toFixed(2), cache: evCache.size });
      return { step, stats, setView: (c, px) => { cam = c ? c.clone() : null; pxv = px || pxv; } };
    })();
    // петли над жгутом при выбросе вытягиваются вверх вместе с ним (плазма вморожена)
    const fr = ph.frame || null; let cmeD = 0, sig2 = Math.pow(0.6 * p.flareSep + 0.05, 2);
    const place = (S, v3) => {
      if (!(S.over && cmeD > 0 && fr)) return; let x = gp[v3], y = gp[v3 + 1], z = gp[v3 + 2]; const m = fr.m, hz = x * m.x + y * m.y + z * m.z - 1, a = x * fr.ax.x + y * fr.ax.y + z * fr.ax.z, b = x * fr.side.x + y * fr.side.y + z * fr.side.z;
      const k = cmeD * Math.exp(-(a * a + b * b) / sig2) * Math.min(1, Math.max(0, hz / (S.top || 1))); gp[v3] = x + m.x * k; gp[v3 + 1] = y + m.y * k; gp[v3 + 2] = z + m.z * k;
    };
    // точка нити по массовой координате (показываемые форма и свойства): позиция в gp[v], яркость n·Λ и log T
    const look = (S, m, v, out) => {
      const cm = S.dcm; let lo = 0, hi = NK - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cm[mid] <= m) lo = mid; else hi = mid; }
      const d = cm[hi] - cm[lo], f = d > 0 ? Math.min(1, Math.max(0, (m - cm[lo]) / d)) : 0, a = lo * 3, b = hi * 3, v3 = v * 3, D = S.D;
      gp[v3] = D[a] + (D[b] - D[a]) * f; gp[v3 + 1] = D[a + 1] + (D[b + 1] - D[a + 1]) * f; gp[v3 + 2] = D[a + 2] + (D[b + 2] - D[a + 2]) * f;
      out[0] = S.dw[lo] + (S.dw[hi] - S.dw[lo]) * f; out[1] = S.dlt[lo] + (S.dlt[hi] - S.dlt[lo]) * f;
      place(S, v3);
    };
    // точка нити для частицы; растущая нить (новая — после пересоединения или у нового полюса) показывает плазму только до края роста:
    // частицы дальше края ждут у него — яркая головка растущей арки (автор: «новые растут от одного полюса к другому, и у них скорость есть»)
    const at = (S, m, v, out) => { out[6] = 1; look(S, S.grow < 1 ? Math.min(m, uToM(S, S.grow)) : m, v, out); };
    // массовая координата ↔ доля длины (узлы показываемой формы равномерны по длине, S.dcm — масса в узлах)
    const mToU = (S, m) => { const cm = S.dcm; let lo = 0, hi = NK - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cm[mid] <= m) lo = mid; else hi = mid; }
      const d = cm[hi] - cm[lo]; return (lo + (d > 0 ? Math.min(1, Math.max(0, (m - cm[lo]) / d)) : 0)) / (NK - 1); };
    const uToM = (S, u) => { const x = Math.min(NK - 1.0001, Math.max(0, u * (NK - 1))), k = x | 0, f = x - k; return S.dcm[k] + (S.dcm[k + 1] - S.dcm[k]) * f; };
    // точка нити по длине дуги s (узлы равномерны по длине): позиция в gp[v]; out[2] — dr/ds (для силы тяжести вдоль нити), out[3] — r
    const atS = (S, s, v, out) => {
      const x = Math.min(NK - 1.001, Math.max(0, s / (S.Lt || 1) * (NK - 1))), lo = x | 0, hi = lo + 1, f = x - lo, a = lo * 3, b = hi * 3, v3 = v * 3, D = S.D;
      gp[v3] = D[a] + (D[b] - D[a]) * f; gp[v3 + 1] = D[a + 1] + (D[b + 1] - D[a + 1]) * f; gp[v3 + 2] = D[a + 2] + (D[b + 2] - D[a + 2]) * f;
      const ds = S.Lt / (NK - 1); out[2] = ds > 0 ? (S.rad[hi] - S.rad[lo]) / ds : 0; out[3] = S.rad[lo] + (S.rad[hi] - S.rad[lo]) * f; place(S, v3);
    };
    // яркость: нормировка — 90-й процентиль n·Λ по частицам (в начале; потом не перенормируется — ослабление короны видно)
    const wv = [0, 0, 0, 0, 0, 0, 1], ws = [];
    for (let i = 0; i < N; i += 7) { const S = str[js[i]]; if (S && !S.pending) { at(S, ms[i], 0, wv); ws.push(wv[0]); } }
    ws.sort((a, b) => a - b); const wRef = ws.length ? ws[Math.floor(ws.length * 0.9)] || 1 : 1;
    let tracesUsed = 0, tfLast = 0, tick = 0, massK = 1, nTransfers = 0, cap = 420; const flipWhy = { closed: 0, genA: 0, end: 0 };   // причины смены связности (сводка стенда)
    const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    // ---- жизнь нитей при самостоятельных полюсах: затравки вслед за зарядами, перетрассировка по сроку, нагрев от уничтожения потока, пересадка частиц
    const period = () => { let n = 0; for (const S of str) if (!S.free && !S.pending && !S.dying) n++; return Math.min(4, Math.max(0.5, 1.1 * n / cap)); };
    const retrace = (j, Tp) => { const old = str[j], Q = P[old.sd.qi];
      if (!old.pending && (!Q || Q.dead || (Q.gen | 0) !== old.sd.gen)) { old.dying = true; old.due = Infinity; return; }   // полюс ушёл (слот мог занять новый) — не трассировать
      const S = phys(old.sd, trace(old.sd), old.pending ? 0 : (old.HxT || 0)); S.due = clk + Tp; S.tTrace = clk;
      if (old.pending) { still(S); S.vis = 0; S.HxT = 0; S.grow = 0; str[j] = S; return; }   // новая нить растёт от полюса
      S.vis = old.vis; S.dying = old.dying; S.HxT = old.HxT; S.wA = old.wA;
      // смена связности — только если нить закрылась/открылась или её конец ушёл далеко (> 0,25 R★). Конец, ушедший недалеко, — петля
      // плавно проскальзывает (как при скользящем пересоединении); узлы формы при переходе не уходят под поверхность (см. shape)
      const e3 = (NK - 1) * 3, endJump = Math.hypot(S.X[e3] - old.D[e3], S.X[e3 + 1] - old.D[e3 + 1], S.X[e3 + 2] - old.D[e3 + 2]);
      const reB = S.closed && old.closed && S.iB >= 0 && S.iB === old.iB && S.genB !== old.genB;   // тот же слот B, но другой полюс
      // смена связности (пересоединение) — без перетекания (автор): старая нить уходит в свой слот и распадается — её частицы стекают к основаниям;
      // новая растёт с нуля от полюса A к другому основанию
      const isFlip = old.closed !== S.closed || old.genA !== S.genA || reB || endJump > 0.25;
      // подтверждение: связь меняется, только если две трассы подряд показывают одну и ту же новую связь (у границы областей поля затравку
      // перекидывает туда-обратно — иначе арки мигали); пока не подтверждено — прежняя форма остаётся
      const fkey = S.closed + '|' + S.iB + '|' + S.genB + '|' + Math.round(S.X[e3] * 10) + ',' + Math.round(S.X[e3 + 1] * 10) + ',' + Math.round(S.X[e3 + 2] * 10);
      if (isFlip && old.genA === S.genA && old.flipKey !== fkey && (old.flipN | 0) < 2) { old.flipKey = fkey; old.flipN = (old.flipN | 0) + 1; old.due = clk + Tp; return; }   // третья подряд — меняем в любом случае
      if (!isFlip) { old.flipKey = null; old.flipN = 0; }
      if (isFlip) { flipWhy[old.closed !== S.closed ? 'closed' : old.genA !== S.genA ? 'genA' : 'end']++; still(S); S.grow = 0;
        let j2 = str.findIndex(x => x.free); if (j2 < 0) { j2 = str.length; str.push(old); } else str[j2] = old;
        old.dying = true; old.due = Infinity; old.ghost = null; old.refs = 0;
        for (let i = 0; i < N; i++) if (js[i] === j) { js[i] = j2; if (pfd[i] >= 0) { pfd[i] = -1; pdr[i] = 0; } }
        for (let b = 0; b < NB; b++) if (bj[b] === j) bt0[b] = -1;
        str[j] = S; return; }
      // длительность перетекания — не короче, чем нужно, чтобы узел шёл не быстрее vSlide R★/с (иначе конец «пролетает» 0,25 R★ за полсекунды)
      let jm = 0; for (let i = 0; i < NK * 3; i += 3) jm = Math.max(jm, Math.hypot(S.X[i] - old.D[i], S.X[i + 1] - old.D[i + 1], S.X[i + 2] - old.D[i + 2]));
      S.grow = old.grow; S.ver = old.ver;   // рост продолжается; та же показываемая нить
      S.D = old.D; S.Dv = old.Dv; S.P0 = old.D.slice(); S.V0 = old.Dv.slice(); S.t0 = clk; S.Tseg = Math.max(Tp, jm / 0.12); anch(S);   // форма — с показанной, основания — с этого момента
      // конечная скорость — по двум трассам в системе движущихся оснований (перенос полюсами уже учтён сдвигом), не больше 0,05 R★/с
      const dtr = Math.max(0.2, clk - (old.tTrace || clk - Tp)), V1 = new Float32Array(NK * 3), lim = 0.05; offs(old);
      for (let i = 0; i < NK; i++) { const w = i / (NK - 1); for (let c = 0; c < 3; c++) { const k = i * 3 + c; V1[k] = Math.max(-lim, Math.min(lim, (S.X[k] - old.X[k] - (1 - w) * oA[c] - w * oB[c]) / dtr)); } }
      S.V1 = V1; for (const k of PH) { S['d' + k] = old['d' + k]; S['p' + k] = old['d' + k].slice(); }
      str[j] = S; };
    const reseed = () => {
      // затравки: недостающие — новые (проявляются), лишние и у ушедших полюсов — гаснут
      // «−» полюс получает свои затравки на ту часть потока, что не покрыта нитями от «+» (иначе одинокий «−» — пустое пятно); с запасом 2,
      // чтобы число не дёргалось
      const qk = quota(), cov = new Map();
      for (const S of str) if (!S.free && !S.pending && !S.dying && S.closed && (S.sd.sg || 1) > 0 && S.iB >= 0 && P[S.iB] && S.genB === (P[S.iB].gen | 0)) cov.set(S.iB, (cov.get(S.iB) || 0) + 1);
      P.forEach((Q, qi) => { let list = perPole.get(qi) || []; list = list.filter(j => !str[j].free && str[j].sd.qi === qi);
        for (const j of list) if (str[j].sd.gen !== (Q.gen | 0) || !Q.q || Math.sign(Q.q) !== (str[j].sd.sg || 1)) str[j].dying = true;
        const want = Math.round(wantSeeds(Math.abs(Q.q)) * qk), live = list.filter(j => !str[j].dying), n = Q.q > 0 ? want : Math.max(0, want - (cov.get(qi) || 0)), slack = 2;   // запас 2 у всех: квота чуть качнулась — нить не гаснет (каждая гаснущая — стекающая арка)
        if (Q.q < 0) covF.set(qi, want > 0 ? Math.min(1, (cov.get(qi) || 0) / want) : 1);
        if (live.length < n) { const ks = new Set(live.map(j => str[j].sd.k)); for (let k = 0, added = 0; live.length + added < n && k < 64; k++) if (!ks.has(k)) { addSeed(qi, k, 0, false); added++; } list = perPole.get(qi); }
        else if (live.length > n + slack) live.map(j => str[j]).sort((a, b) => b.sd.k - a.sd.k).slice(0, live.length - n).forEach(S => { S.dying = true; });
        perPole.set(qi, list.filter(j => !str[j].free && str[j].sd.qi === qi)); });
      covPrev = cov; reweigh(); lists();
    };
    // нагрев от уничтожения потока (и от всплытия — ниже): у нитей, чьи основания у места встречи, добавка Hx (эрг/(см³·с)) = heatC·(скорость/5·10¹⁹ Мкс/ч)·вес,
    // вес — гаусс 0,04 R★ по расстоянию до ближайшего основания; Hx идёт к цели за 3,2 с показа (≈ 120 с короны) и входит в физику при
    // очередной трассе (раз в период обхода)
    const heat = (dt, contacts) => {
      const kx = 1 - Math.exp(-dt / 3.2);
      for (const S of str) { if (S.free || S.pending) continue; let tg = 0;
        if (contacts) for (const ct of contacts.values()) { const r = ct.rate * PHI0 / 5e19; if (r < 0.01) continue;
          const L = ct.loc, X = S.D, n = NK * 3, d1 = Math.hypot(X[0] - L.x, X[1] - L.y, X[2] - L.z), d2 = Math.hypot(X[n - 3] - L.x, X[n - 2] - L.y, X[n - 1] - L.z), dd = Math.min(d1, d2);
          tg += p.heatC * r * Math.exp(-dd * dd / (2 * 0.04 * 0.04)); }
        // всплытие: молодые петли горячее — добавка heatE на 5·10¹⁹ Мкс/ч скорости всплытия полюсов у её оснований
        const QA = P[S.sd.qi], QB = S.iB >= 0 ? P[S.iB] : null, eA = QA && !QA.dead && (QA.gen | 0) === S.genA ? QA.emR || 0 : 0, eB = QB && !QB.dead && (QB.gen | 0) === S.genB ? QB.emR || 0 : 0;   // только свои полюса (слот мог занять новый)
        tg += p.heatE * (eA + eB) * PHI0 / 5e19;
        S.HxT = (S.HxT || 0) + (tg - (S.HxT || 0)) * kx; }
    };
    const evolve = (dt, contacts) => {
      tick += dt; C = charges(P, p); nC = C.length / 4;
      heat(dt, contacts);
      if (tick >= 0.25) { tick = 0; reseed(); }
      // перетрассировка по сроку: сначала новые заготовки, потом нити с наступившим сроком (раньше — раньше); бюджет ≈ 7 на 1/60 с, ≤ 10 за кадр
      cap = cap * 0.95 + Math.min(420, 10 / Math.max(1e-3, dt)) * 0.05;
      let budget = Math.min(10, Math.max(1, Math.round(dt * 420))); const Tp = period(), b0 = budget;
      for (let j = 0; j < str.length && budget > 0; j++) if (str[j].pending && !str[j].free && !str[j].dying) { retrace(j, Tp); budget--; }
      while (budget > 0) { let jb = -1, db = Infinity; for (let j = 0; j < str.length; j++) { const S = str[j]; if (S.free || S.dying || S.pending) continue; if (S.due <= clk && S.due < db) { db = S.due; jb = j; } }
        if (jb < 0) break; retrace(jb, Tp); budget--; }
      tracesUsed = b0 - budget;   // остаток кадра — мелким (общий бюджет трасс)
      // проявление и гашение
      for (let j = 0; j < str.length; j++) { const S = str[j]; if (S.free) continue;
        S.vis = S.dying ? Math.max(0, S.vis - dt / 0.8) : Math.min(1, S.vis + dt / 0.8);
        if (S.dying && S.vis <= 0 && !S.refs) { S.free = true; S.ghost = null; const l = perPole.get(S.sd.qi); if (l) { const k = l.indexOf(j); if (k >= 0) l.splice(k, 1); } } }   // освобождая — сразу из списка владельца
    };
    // пересадка частиц: каждые 0,25 с — цели по массе нитей; ≤ 80 начатых пересадок на 1/60 с (не больше 160 за кадр), сначала с гаснущих;
    // частица гаснет за 0,2 с, садится на нить с недостатком (в случайную точку по массе) и проявляется за 0,3 с
    let tgt = null, cnt = null, deficit = [], live = [], tT = 0;
    const rebalance = dt => {
      tT += dt; if (!tgt || tT >= 0.25) { tT = 0; reweigh(); const tot = str.reduce((a, S) => a + massOf(S), 0) || 1; massK = massK + (tot / mass0 - massK) * 0.3;
        // цели сглажены (≈ 1 с) и с допуском 10%: перетрассировка чуть меняет массу нити — без допуска частицы пересаживались бы постоянно
        const totS = str.reduce((a, S) => a + shareOf(S), 0) || 1; bK = totS / tot; for (const S of str) S.lightK = lightOf(S);   // яркость точки нити — раз в 0,25 с
        const raw = str.map(S => N * shareOf(S) / totS); tgt = raw.map((t, j) => tgt && j < tgt.length ? tgt[j] + (t - tgt[j]) * 0.25 : t);
        cnt = new Float32Array(str.length); for (let i = 0; i < N; i++) cnt[js[i]]++;
        deficit = []; tgt.forEach((t, j) => { const d = t - cnt[j]; if (d > 0.1 * t + 1 || (t > 0.5 && cnt[j] === 0)) deficit.push([j, d]); });
        live = []; tgt.forEach((t, j) => { const S = str[j]; if (t > 0.5 && !S.free && !S.dying && !S.pending) live.push([j, t]); }); }
      const pick = list => { let u = rnd() * list.reduce((a, d) => a + Math.max(0, d[1]), 0), k = 0; while (k < list.length - 1 && u > list[k][1]) u -= list[k++][1]; return k; };
      let started = 0; const lim = Math.min(160, Math.max(1, Math.round(dt * 4800)));
      // уходящая нить — все её частицы стекают сразу; переполненная — понемногу (≤ lim за кадр)
      for (let i = 0; i < N; i++) { const j = js[i], S = str[j]; if (pfd[i]) continue;
        const gone = !S || S.free || S.dying || S.pending;
        if (gone) { pfd[i] = S && S.D && !S.free ? -1 : -2; pdr[i] = 0; cnt[j]--; }
        else if (started < lim && deficit.length && S.closed && cnt[j] > 1.1 * tgt[j] + 1 && pAge[i] > 2) { pfd[i] = -1; pdr[i] = 0; cnt[j]--; started++; } }   // только «осевшие» (≥ 2 с): без круговорота
      for (let i = 0; i < N; i++) { pAge[i] += dt; if (!pfd[i]) continue;
        if (pfd[i] === -2) {   // стекла — в нить с недостатком массы
          const list = deficit.length ? deficit : live; if (!list.length) continue;          // живой массы нет — частица ждёт скрытой
          const k = pick(list), d = list[k]; js[i] = d[0]; cnt[d[0]]++; if (list === deficit) { d[1] -= 1; if (d[1] <= 0) deficit.splice(k, 1); }
          // без испарения от основания (автор: «испарение убери — оно по-другому должно работать»): частица проявляется в случайном месте
          // выросшей части нити с недостатком массы
          const Sn = str[d[0]], mF = Sn && Sn.dcm && Sn.grow < 1 ? uToM(Sn, Sn.grow) : 1; ms[i] = 0.02 + 0.96 * mF * rnd(); pf[i] = 0; nTransfers++; pfd[i] = 1; pAge[i] = 0; }
        else if (pfd[i] > 0) { pf[i] += dt / 0.3; if (pf[i] >= 1) { pf[i] = 1; pfd[i] = 0; } } }
      for (const S of str) S.refs = 0; for (let i = 0; i < N; i++) if (str[js[i]] && pfd[i] !== -3) str[js[i]].refs++;   // свободной плазме нить уже не нужна for (let b = 0; b < NB; b++) if (bt0[b] >= 0 && str[bj[b]]) str[bj[b]].refs++;
    };
    // кадр: dt — шаг (с показа), tf — время цикла вспышки (с), flaring — вспышки включены, tt — часы симуляции
    const step = (dt, tf, flaring, tt) => {
      clk += dt;
      for (const S of str) { if (S.free || S.pending) continue; shape(S); if (S.ghost) shape(S.ghost); }   // текущая форма — до перенацеливания (P0, Dv — этого кадра)
      if (SF && dt > 0) { evolve(dt, SF.contacts); rebalance(dt); }
      for (const S of str) { if (S.free || S.pending) continue; if (S.tTrace === clk) shape(S); S.ghost = null; }
      // рост новых нитей от полюса A: край идёт со скоростью growKms (порядка скоростей заполнения петли испарением)
      { const vG = p.growKms / vesc / p.tDyn * (p.flowBoost || 1); for (const S of str) if (!S.free && !S.pending && S.grow < 1) S.grow = Math.min(1, S.grow + vG * dt / Math.max(0.05, S.Lt || 0.05)); }
      const kms = 1 / vesc / p.tDyn, fb = p.flowBoost || 1, v0 = p.flowKms * kms * fb, tau = p.pTrail, uv = p.colorMode > 0;
      const gDr = 1 / (2 * p.tDyn * p.tDyn), capD = p.rainCap * kms * fb;   // стекание петли: сила тяжести у поверхности (R★/с² показа), предел — скорость дождя   // км/с → R★ в секунду показа; скорость у основания
      const Rp = ph.rope; cmeD = Rp && ph.cme ? Math.max(0, Rp.at(tf) - h0()) * (Rp.esc ? 1 : 1 - Rp.fall(tf)) : 0;
      if (P.length >= 2) sig2 = Math.pow(0.6 * P[0].p.distanceTo(P[1].p) + 0.05, 2);
      // облако ветра: частица смещается поперёк радиуса — по своему месту в сечении раздувающейся трубки (радиус windSpread·h) и турбулентной
      // ряби (сумма синусов от положения и времени, амплитуда windTurb·h); яркость — освещённость звездой ∝ 1/r² (с 1,3 R★)
      const cloud = (v, i, two) => { const v3 = v * 3, x = gp[v3], y = gp[v3 + 1], z = gp[v3 + 2], r = Math.hypot(x, y, z), h = r - 1.02; if (h <= 0) return 1;
        const ux = x / r, uy = y / r, uz = z / r; let e1x = -uz, e1y = 0, e1z = ux, l = Math.hypot(e1x, e1z); if (l < 1e-3) { e1x = 1; e1z = 0; l = 1; } e1x /= l; e1z /= l;
        const e2x = uy * e1z - uz * e1y, e2y = uz * e1x - ux * e1z, e2z = ux * e1y - uy * e1x;
        const hs = Math.sin(i * 12.9898) * 43758.5453, f1 = hs - Math.floor(hs), hs2 = Math.sin(i * 78.233) * 12543.123, f2 = hs2 - Math.floor(hs2);
        const sp = p.windSpread * h * Math.sqrt(f2), ph = 6.2832 * f1, tq = clk * 0.6;
        const n1 = Math.sin(3.1 * x + 1.7 * tq + 2.3 * f1) + 0.6 * Math.sin(7.3 * y - 2.3 * tq + 1.1) + 0.4 * Math.sin(11.7 * z + 3.1 * tq + 6 * f2);
        const n2 = Math.sin(3.7 * z - 1.3 * tq + 0.7) + 0.6 * Math.sin(6.9 * x + 2.1 * tq + 4 * f1) + 0.4 * Math.sin(12.3 * y - 2.9 * tq + 2.0);
        const a = sp * Math.cos(ph) + p.windTurb * h * n1, c = sp * Math.sin(ph) + p.windTurb * h * n2;
        // смещение — по сфере радиуса r (поперёк, без радиальной составляющей): рябь не даёт ложного движения к звезде (автор: стрелки «из космоса»)
        const dx = e1x * a + e2x * c, dy = e1y * a + e2y * c, dz = e1z * a + e2z * c, nx = x + dx, ny = y + dy, nz = z + dz, kr = r / Math.hypot(nx, ny, nz);
        gp[v3] = nx * kr; gp[v3 + 1] = ny * kr; gp[v3 + 2] = nz * kr;
        if (two) { gp[v3 + 3] += dx; gp[v3 + 4] += dy; gp[v3 + 5] += dz; }
        gz[v] = 1 + p.windGrow * h; if (two) gz[v + 1] = gz[v];
        return Math.min(1, Math.pow(1.3 / r, p.windFade)); };   // освещённость: физически ∝ r^−2 (windFade 2), для показа мягче
      // течение с сохранением массы: v = F/(n·A), поток F один на всю нить. В петле F ограничен csEta·min(n·A·c_s) — течение дозвуковое
      // везде (местный предел у частицы менял бы поток вдоль нити, и частицы копились бы у вершины); на открытой линии — ветер, без предела.
      // Итог: у оснований плотно, медленно и ярко, у вершины — редко, быстрее и тускло
      for (let i = 0; i < N; i++) {
        const S0 = str[js[i]], S = S0;
        if (pfd[i] < 0) { const v = tr ? 2 * i : i, v3 = v * 3, i3 = i * 3;
          // освобождённая плазма (автор: «линия может начать движение, только когда оба полюса пропали; линии уже нет — её частицы движутся
          // в новом поле; если поле слабое — формируется облако; полюсов как таковых нет — всё плавно»). Частица стартует со своего места и
          // своей скорости и дальше идёт вдоль поля В СВОЕЙ ТОЧКЕ (силовая линия через неё — уже другая), сила тяжести тянет её вдоль поля;
          // где поле слабее orphBweak Гс, плазма не удерживается — плавно переходит в облако (блуждает, расплывается, остывает, гаснет);
          // у хромосферы (r < 1) или у поверхности источника — ушла
          if (pfd[i] === -2) { ga[v] = 0; if (tr) ga[v + 1] = 0; continue; }
          if (pfd[i] === -1) {   // освобождение: место и направление — из нити в момент освобождения
            if (!S0 || !S0.D || !S0.dcm) { pfd[i] = -2; ga[v] = 0; if (tr) ga[v + 1] = 0; continue; }
            look(S0, ms[i], v, wv); opos[i3] = gp[v3]; opos[i3 + 1] = gp[v3 + 1]; opos[i3 + 2] = gp[v3 + 2];
            const u = mToU(S0, ms[i]), k = Math.min(NK - 2, (u * (NK - 1)) | 0), sd = S0.closed ? S0.dir : 1, D = S0.D;
            let tx = (D[k * 3 + 3] - D[k * 3]) * sd, ty = (D[k * 3 + 4] - D[k * 3 + 1]) * sd, tz = (D[k * 3 + 5] - D[k * 3 + 2]) * sd; const tl = Math.hypot(tx, ty, tz) || 1;
            odir[i3] = tx / tl; odir[i3 + 1] = ty / tl; odir[i3 + 2] = tz / tl; pvs[i] = Math.max(0.03, v0); ptm[i] = 0;
            olk[i] = Math.max(0.3, S0.lightK || 1); olt[i] = wv[1];
            const h1 = Math.sin(i * 12.9898) * 43758.5453, h2 = Math.sin(i * 78.233) * 12543.123, ang = 6.2832 * (h1 - Math.floor(h1)), zz = 2 * (h2 - Math.floor(h2)) - 1, rq = Math.sqrt(1 - zz * zz);
            orw[i3] = rq * Math.cos(ang); orw[i3 + 1] = zz; orw[i3 + 2] = rq * Math.sin(ang); pfd[i] = -3; }
          ptm[i] += dt; const x = opos[i3], y = opos[i3 + 1], z = opos[i3 + 2], r = Math.hypot(x, y, z);
          fieldAt(x, y, z, C, nC, e, p.open, ob); const bm = Math.hypot(ob[0], ob[1], ob[2]) + 1e-12, bG = bm * gUnit;
          // вдоль поля: знак — чтобы продолжать прежнее движение; скорость — с силой тяжести вдоль поля, не быстрее дождя
          let bx = ob[0] / bm, by = ob[1] / bm, bz = ob[2] / bm; if (bx * odir[i3] + by * odir[i3 + 1] + bz * odir[i3 + 2] < 0) { bx = -bx; by = -by; bz = -bz; }
          const gpar = -gDr * (bx * x + by * y + bz * z) / (r * r * r); pvs[i] = Math.max(-capD, Math.min(capD, pvs[i] + gpar * dt));
          if (pvs[i] < 0) { bx = -bx; by = -by; bz = -bz; pvs[i] = -pvs[i]; }
          // слабое поле — облако: блуждание по своему медленно поворачивающему направлению, без удержания полем
          const wB = smooth01(bG / Math.max(0.1, p.orphBweak)), tq = clk * 0.5 + i * 0.37;
          const cx = orw[i3] + 0.6 * Math.sin(tq), cy = orw[i3 + 1] + 0.6 * Math.sin(tq * 1.3 + 2), cz = orw[i3 + 2] + 0.6 * Math.cos(tq * 0.9 + 4), cs = p.orphCloud;
          const vx = wB * bx * pvs[i] + (1 - wB) * cx * cs, vy = wB * by * pvs[i] + (1 - wB) * cy * cs, vz = wB * bz * pvs[i] + (1 - wB) * cz * cs;
          opos[i3] = x + vx * dt; opos[i3 + 1] = y + vy * dt; opos[i3 + 2] = z + vz * dt; const vl = Math.hypot(vx, vy, vz) || 1;
          odir[i3] = vx / vl; odir[i3 + 1] = vy / vl; odir[i3 + 2] = vz / vl;
          const r2 = Math.hypot(opos[i3], opos[i3 + 1], opos[i3 + 2]);
          if (r2 < 1.001 || r2 > rMax || ptm[i] > p.orphLife) { pfd[i] = -2; ga[v] = 0; if (tr) ga[v + 1] = 0; continue; }   // ушла в хромосферу или наружу; срок вышел
          gp[v3] = opos[i3]; gp[v3 + 1] = opos[i3 + 1]; gp[v3 + 2] = opos[i3 + 2];
          // яркость — как у прежней нити; в облаке (слабое поле) расплывается и гаснет; под конец срока — плавно; цвет — остывает
          ga[v] = (uv ? 1 : 0.5) * Math.min(1.5, massK) * olk[i] * (0.35 + 0.65 * wB) * smooth01((p.orphLife - ptm[i]) / 0.8);
          gt[v] = olt[i] + (4.6 - olt[i]) * smooth01(ptm[i] / 3); gf[v] = 0; gz[v] = 1 + (1 - wB) * 1.5;
          if (tr) { gp[v3 + 3] = gp[v3] - vx * p.pTrail; gp[v3 + 4] = gp[v3 + 1] - vy * p.pTrail; gp[v3 + 5] = gp[v3 + 2] - vz * p.pTrail; ga[v + 1] = 0; gt[v + 1] = gt[v]; gz[v + 1] = gz[v]; }
          continue; }
        if (!S || S0.pending || S0.free || !S.D || !(S.M > 0)) { const v = tr ? 2 * i : i; ga[v] = 0; if (tr) ga[v + 1] = 0; continue; }
        const rate = S.Fw ? S.Fw * kms * fb / S.M : v0 * S.nA[S.dir > 0 ? 0 : 1] / S.M, rc = S.closed ? p.csEta * S.csMin * kms * fb / S.M : 0;   // ветер — его поток F = n·A·v
        let m = ms[i] + S.dir * Math.min(rate, rc > 0 ? rc : rate) * dt; m -= Math.floor(m); ms[i] = m;
        const v = tr ? 2 * i : i, edge = Math.min(1, Math.min(m, 1 - m) / 0.02);   // у перехода через основание — гаснет
        at(S0, m, v, wv); ga[v] = (uv ? wv[0] / wRef : 0.5) * edge * wv[6] * pf[i] * Math.min(1.5, massK) * (S0.lightK != null ? S0.lightK : lightOf(S0)); gt[v] = wv[1]; gf[v] = S.f;   // без видимости нити: новая заполняется снизу, уходящая стекает
        if (tr) { at(S0, Math.min(1, Math.max(0, m - S.dir * Math.min(rate, rc > 0 ? rc : rate) * tau)), v + 1, wv); ga[v + 1] = 0; gt[v + 1] = gt[v]; gf[v + 1] = S.f; }
        gz[v] = 1; if (tr) gz[v + 1] = 1;
        if (!S.closed) ga[v] *= cloud(v, i, tr);
      }
      // баллистика: сила тяжести вдоль нити g·(dr/ds) — с весом остывания: горячую плазму держит давление (вязкое торможение за evDamp),
      // остывшая теряет опору и падает дождём (≈ rainF от силы тяжести, ≤ rainCap — Antolin & Rouppe van der Voort 2012). Испарение: в окне
      // вспышки 0,25–3,25 с из оснований петель между якорями со скоростью evKms (Milligan & Dennis 2009), evT МК, остывает за evCool с
      const g0 = 1 / (2 * p.tDyn * p.tDyn), capR = p.rainCap * kms, vEv = p.evKms * kms, newCycle = tf < tfLast; tfLast = tf;
      for (let b = 0; b < NB; b++) {
        const ev = b < NE, v = tr ? 2 * (N + b) : N + b;
        if (ev && newCycle) bt0[b] = -1;
        if (bt0[b] >= 0 && (!str[bj[b]] || str[bj[b]].free || str[bj[b]].dying || str[bj[b]].ghost)) bt0[b] = -1;   // смена связности — траектория заново
        if (bt0[b] < 0) {                                                      // рождение
          const pool = ev ? evS : rainS;
          if (!pool.length || (ev && !(flaring && tf > 0.25 && tf < 3.25 && rnd() < dt * 3))) { ga[v] = 0; if (tr) ga[v + 1] = 0; continue; }
          const j = pool[(rnd() * pool.length) | 0], S = str[j]; bj[b] = j;
          if (ev) { const up = rnd() < 0.5; bs[b] = up ? 0.002 : S.Lt - 0.002; bu[b] = (up ? 1 : -1) * vEv * (0.5 + rnd()); bt0[b] = tf; }
          else { let ka = 0; for (let k = 1; k < NK; k++) if (S.rad[k] > S.rad[ka]) ka = k; bs[b] = Math.min(S.Lt * 0.95, Math.max(S.Lt * 0.05, S.s[ka] + (rnd() - 0.5) * 0.3 * S.Lt)); bu[b] = 0; bt0[b] = tf; }
        }
        const S = str[bj[b]], T = ev ? Math.max(1e4, p.evT * 1e6 * Math.exp(-Math.max(0, tf - bt0[b]) / p.evCool)) : 1e4;
        if (!S || !S.D) { ga[v] = 0; if (tr) ga[v + 1] = 0; continue; }
        const hot = sm(1e5, 1e6, T), fall = p.rainF * (1 - hot);
        atS(S, bs[b], v, wv);
        let u = bu[b] + (-fall * g0 / (wv[3] * wv[3]) * wv[2] - hot * bu[b] / p.evDamp) * dt;
        if (hot < 0.5) u = Math.max(-capR, Math.min(capR, u));
        bu[b] = u; bs[b] += u * dt;
        if (bs[b] <= 0 || bs[b] >= S.Lt) { bt0[b] = -1; ga[v] = 0; if (tr) ga[v + 1] = 0; continue; }   // сел на поверхность
        atS(S, bs[b], v, wv);
        ga[v] = (ev ? p.evBright * (0.35 + 0.65 * hot) : p.rainBright) * S.vis * Math.min(1, Math.max(0, tf - bt0[b]) / 0.3 + (ev ? 0 : 1)); gt[v] = Math.log10(T); gf[v] = 0;
        if (tr) { atS(S, Math.min(S.Lt, Math.max(0, bs[b] - Math.max(-0.03, Math.min(0.03, u * tau)))), v + 1, wv); ga[v + 1] = 0; gt[v + 1] = gt[v]; gf[v + 1] = 0; }
      }
      // протуберанец — холодное плотное ядро жгута (≈ 10⁴ К, Hα): закрученная трубка между якорями вспышки (полюса 0 и 1), вершина — на
      // высоте жгута; запертое извержение — вещество стекает по ногам к основаниям, ушедшее — гаснет за 2,5–4 R★
      if (NP && Rp && fr) { const H = Rp.at(tf), hb = h0(), fl = Rp.esc ? 0 : Rp.fall(tf), u = Math.min(1, Math.max(0, (H - hb) / Math.max(0.3, Rp.hMax - hb))), A = P[0].p, B = P[1].p, m = fr.m, ax = fr.ax, side = fr.side;
        const w = A.distanceTo(B) * 0.5, fade = Rp.esc ? 1 - sm(2.5, 4, H) : 1 - sm(0.85, 1, fl);   // ноги жгута — в якорях
        for (let i = 0; i < NP; i++) {
          const s0 = prD[i * 3], tw0 = prD[i * 3 + 1], rn = prD[i * 3 + 2], s = s0 < 0.5 ? s0 * (1 - fl) : 1 - (1 - s0) * (1 - fl), ang = Math.PI * (0.06 + 0.88 * s);
          const sa = Math.sin(ang), ca = Math.cos(ang), cx = m.x * (1 + H * sa) + ax.x * w * ca, cy = m.y * (1 + H * sa) + ax.y * w * ca, cz = m.z * (1 + H * sa) + ax.z * w * ca;
          let tx = -ax.x * w * sa + m.x * H * ca, ty = -ax.y * w * sa + m.y * H * ca, tz = -ax.z * w * sa + m.z * H * ca; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
          let n1x = ty * side.z - tz * side.y, n1y = tz * side.x - tx * side.z, n1z = tx * side.y - ty * side.x; const nl = Math.hypot(n1x, n1y, n1z) || 1; n1x /= nl; n1y /= nl; n1z /= nl;
          const n2x = ty * n1z - tz * n1y, n2y = tz * n1x - tx * n1z, n2z = tx * n1y - ty * n1x;
          const tw = tw0 * 6.2832 + s * 9 * (1 + u) + tt * 0.6, rr2 = (0.004 + 0.012 * u) * (0.4 + 0.6 * rn) * (0.6 + 0.4 * sa), ct = Math.cos(tw) * rr2, st = Math.sin(tw) * rr2;   // толщина ≈ 500–2 000 км у Барнарда
          const v = tr ? 2 * (N + NB + i) : N + NB + i, v3 = v * 3;
          gp[v3] = cx + n1x * ct + n2x * st; gp[v3 + 1] = cy + n1y * ct + n2y * st; gp[v3 + 2] = cz + n1z * ct + n2z * st;
          ga[v] = p.promBright * fade * (0.6 + 0.4 * Math.sin(s0 * 30 + tt * 2 + rn * 6)); gt[v] = 4; gf[v] = 0;
          if (tr) { gp[v3 + 3] = gp[v3] - m.x * 0.004; gp[v3 + 4] = gp[v3 + 1] - m.y * 0.004; gp[v3 + 5] = gp[v3 + 2] - m.z * 0.004; ga[v + 1] = 0; gt[v + 1] = 4; gf[v + 1] = 0; }
        } }
      if (SF) puffStep(dt);
      geo.attributes.position.needsUpdate = true; geo.attributes.aA.needsUpdate = true; geo.attributes.aF.needsUpdate = true; geo.attributes.aT.needsUpdate = true; geo.attributes.aZ.needsUpdate = true;
    };
    // ---- облака, уходящие из короны вдоль открытого поля (автор: «облака прям как от атмосферы отрывается»; «нить не должна рваться и
    // улетать — плазма движется в том же магнитном поле, поле никуда не исчезло»). Плазма вморожена в поле: на Солнце «капли» стримеров
    // (Sheeley et al. 1997; Wang et al. 1998) рождаются пересоединением вершины высокой петли с соседним открытым полем у острия стримера —
    // её плазма оказывается на открытых силовых линиях и уходит ВДОЛЬ них с медленным ветром (у острия < 150 км/с, потом до ≈ 400 км/с);
    // петля не рвётся. Здесь: puffPerDay облаков в сутки поверхности; место — точка открытой линии, к которой вершина высокой петли
    // (верхние 30% по высоте) подходит ближе puffNear R★ (только у границы закрытого и открытого поля); облако — сгусток длиной puffLen
    // вдоль линии, едет по ней со скоростью ветра в этой точке, частицы держатся у линии, поперечник растёт вместе с сечением трубки
    // (≈ ∝ r); гаснет к концу линии. Отдельный пул puffN частиц; на паузе стоит
    const NCp = Math.max(0, Math.round(p.puffN || 0)), PCH = 250, puffs = [], pj = new Int16Array(NCp).fill(-1), po = new Float32Array(NCp * 4);
    for (let i = 0; i < NCp; i++) { const u1 = Math.max(1e-6, rnd()), u2 = rnd(), u3 = Math.max(1e-6, rnd()), u4 = rnd(), g1 = Math.sqrt(-2 * Math.log(u1)), g2 = Math.sqrt(-2 * Math.log(u3));
      po[i * 4] = g1 * Math.cos(6.2832 * u2) * 0.5; po[i * 4 + 1] = g1 * Math.sin(6.2832 * u2) * 0.5; po[i * 4 + 2] = g2 * Math.cos(6.2832 * u4) * 0.5; po[i * 4 + 3] = rnd(); }
    let puffAcc = 0, puffMade = 0;
    const wpf = [0, 0, 0, 0, 0, 0, 1];
    const puffStep = dt => { if (!NCp) return; const base = N + NB + NP + NL, kms = 1 / vesc / p.tDyn, fb = p.flowBoost || 1;
      // рождение: пуассоновски, по часам поверхности; место — острие стримера (вершина высокой петли у открытой линии)
      puffAcc += dt * p.puffPerDay * (p.surfH || 24) / 24;
      while (puffAcc >= 1) { puffAcc -= 1;
        const live = str.filter(S => !S.free && !S.pending && !S.dying && S.D && S.dcm), cl = live.filter(S => S.closed && S.vis > 0.6), op = live.filter(S => !S.closed && S.M > 0);
        if (cl.length < 3 || !op.length) break;
        const tops = cl.map(S => S.top).sort((a, b) => a - b), tq = tops[Math.floor(tops.length * 0.7)], hi = cl.filter(S => S.top >= tq);
        let best = null;
        for (let tries = 0; tries < 6 && !best; tries++) { const S = hi[(rnd() * hi.length) | 0]; let ka = 0; for (let k = 1; k < NK; k++) if (S.rad[k] > S.rad[ka]) ka = k;
          const ax = S.D[ka * 3], ay = S.D[ka * 3 + 1], az = S.D[ka * 3 + 2], ra = S.rad[ka]; let bd = p.puffNear, bo = null, bk = 0;
          for (const O of op) for (let k = 0; k < NK; k++) { if (O.rad[k] < ra - 0.05) continue; const dd = Math.hypot(O.D[k * 3] - ax, O.D[k * 3 + 1] - ay, O.D[k * 3 + 2] - az); if (dd < bd) { bd = dd; bo = O; bk = k; } }
          if (bo) best = { O: bo, u: bk / (NK - 1) }; }
        if (!best) continue;
        const free = []; for (let i = 0; i < NCp && free.length < PCH; i++) if (pj[i] < 0) free.push(i); if (free.length < PCH * 0.6) break;
        const r0 = best.O.rad[Math.round(best.u * (NK - 1))];
        puffs.push({ O: best.O, u: best.u, r0, t: 0, dead: false }); puffMade++;
        free.forEach(i => { pj[i] = puffs.length - 1; }); }
      // движение облаков — вдоль своей открытой линии со скоростью ветра в точке центра
      for (const pf of puffs) { if (pf.dead) continue; pf.t += dt; const O = pf.O, k = Math.min(NK - 1, Math.round(pf.u * (NK - 1))), r = O.rad[k];
        const vk = p.puffKms + (p.windKms - p.puffKms) * (1 - Math.exp(-Math.max(0, r - pf.r0) / Math.max(0.1, p.windAcc)));
        pf.u += Math.max(20, vk) * kms * fb * dt * smooth01(pf.t / 1.0 + 0.1) / Math.max(0.05, O.Lt || 0.05); if (pf.u >= 0.995) pf.dead = true; }
      const tq = clk * 0.7;
      for (let i = 0; i < NCp; i++) { const v = tr ? 2 * (base + i) : base + i, j = pj[i]; if (j < 0) { ga[v] = 0; if (tr) ga[v + 1] = 0; continue; }
        const pf = puffs[j]; if (!pf || pf.dead) { pj[i] = -1; ga[v] = 0; if (tr) ga[v + 1] = 0; continue; }
        const O = pf.O, Lt = Math.max(0.05, O.Lt || 0.05), ph2 = po[i * 4 + 3] * 6.2832;
        // место частицы вдоль линии: центр облака ± длина сгустка (растёт с расстоянием), лёгкая рябь вдоль
        const r0c = O.rad[Math.min(NK - 1, Math.round(pf.u * (NK - 1)))], grow = Math.max(1, r0c / pf.r0), Lc = p.puffLen * grow;
        const ui = Math.min(0.999, Math.max(0.001, pf.u + (po[i * 4 + 2] * Lc + 0.05 * Lc * Math.sin(tq * 1.3 + ph2)) / Lt));
        look(O, uToM(O, ui), v, wpf);
        // поперёк линии — в пределах сечения трубки (≈ ∝ r): частицы держатся у своей силовой линии
        const x = Math.min(NK - 2.0001, ui * (NK - 1)), k0 = x | 0, D = O.D, v3 = v * 3;
        let tx = D[k0 * 3 + 3] - D[k0 * 3], ty = D[k0 * 3 + 4] - D[k0 * 3 + 1], tz = D[k0 * 3 + 5] - D[k0 * 3 + 2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
        const px = gp[v3], py = gp[v3 + 1], pz = gp[v3 + 2], rr = Math.hypot(px, py, pz);
        let e1x = ty * pz - tz * py, e1y = tz * px - tx * pz, e1z = tx * py - ty * px; const el = Math.hypot(e1x, e1y, e1z) || 1; e1x /= el; e1y /= el; e1z /= el;
        const e2x = ty * e1z - tz * e1y, e2y = tz * e1x - tx * e1z, e2z = tx * e1y - ty * e1x;
        const W = p.puffLen / 3 * (rr / Math.max(1, pf.r0)), a1 = (po[i * 4] + 0.15 * Math.sin(tq + ph2)) * W, a2 = (po[i * 4 + 1] + 0.15 * Math.cos(tq * 1.1 + 2 * ph2)) * W;
        gp[v3] = px + e1x * a1 + e2x * a2; gp[v3 + 1] = py + e1y * a1 + e2y * a2; gp[v3 + 2] = pz + e1z * a1 + e2z * a2;
        ga[v] = 0.45 * p.puffBright * Math.min(1, Math.pow(pf.r0 / Math.max(pf.r0, rr), p.windFade)) * smooth01(pf.t / 0.6) * smooth01((0.995 - pf.u) / 0.08);
        gt[v] = wpf[1]; gf[v] = 0; gz[v] = 1 + p.windGrow * 0.5 * Math.max(0, rr - pf.r0);
        if (tr) { gp[v3 + 3] = gp[v3] - tx * 0.004; gp[v3 + 4] = gp[v3 + 1] - ty * 0.004; gp[v3 + 5] = gp[v3 + 2] - tz * 0.004; ga[v + 1] = 0; gt[v + 1] = gt[v]; gz[v + 1] = gz[v]; } }
      // ушедшие облака — из списка, когда все их частицы освобождены
      while (puffs.length && puffs[0].dead) { puffs.shift(); for (let i = 0; i < NCp; i++) if (pj[i] >= 0) pj[i]--; }
    };
    step(0, 0, false, 0);
    // сводка для стенда: нити закрытые и открытые, температуры, плотности, поля, длины; нагретые нити, пересадки, масса короны, период обхода
    const stats = () => { const lv = str.filter(S => !S.free && !S.dying && !S.pending), cl = lv.filter(S => S.closed);
      return { strands: lv.length, closed: cl.length, open: lv.length - cl.length, T: cl.map(S => S.Tm), n: cl.map(S => S.n[NK >> 1]), B: cl.map(S => S.Bbar),
        L: cl.map(S => S.L), top: cl.map(S => S.top), vesc, hR1, tReal: ph.rKm / vesc / p.tDyn, gUnit, evN: NE, rainN: NR, evStrands: evS.length, rainStrands: rainS.length,
        heated: cl.filter(S => S.Hx > 0.05 * (S.EH - S.Hx)).length, transfers: nTransfers, massK, period: period(), flipWhy: Object.assign({}, flipWhy), puffs: puffs.filter(x => !x.dead).length, puffMade, puffList: puffs.slice(-6).map(x => [+x.u.toFixed(3), +x.t.toFixed(2), x.dead, +(x.O.Lt || 0).toFixed(2), x.O.closed, +x.r0.toFixed(2)]) }; };
    // отладка стенда: показываемая форма нити j (64 узла) и её связность
    const debugStrand = j => { const S = str[j]; return S && S.D && !S.free ? { D: Array.from(S.D), closed: S.closed, iA: S.iA, iB: S.iB, ghost: !!S.ghost, ver: S.ver, grow: S.grow, genA: S.genA, genOk: !!P[S.sd.qi] && (P[S.sd.qi].gen | 0) === S.genA && !P[S.sd.qi].dead, dying: !!S.dying, vis: S.vis, n: Array.from(S.n), na: Array.from(S.na), T: Array.from(S.T), w: Array.from(S.w), rad: Array.from(S.rad), Tm: S.Tm, top: S.top, Lt: S.Lt } : null; };
    return { n: NT, geo, step, tr, stats, debugStrand, setView: (c, px) => { if (LOD) LOD.setView(c, px); }, lodStep: (dt, realDt) => { if (LOD) LOD.step(dt, realDt); }, lodStats: () => LOD ? LOD.stats() : null, debugParticles: () => ({ js, ms, dcm: str.map(S => S && S.dcm ? S.dcm : null) }) };
  }
  // построить звезду: группа в радиусах звезды. opts: seed; sp (спектр) и comp (компонент) — класс задаёт цвет, радиус и поправки;
  // rKm, mSun — радиус (км) и масса (масс Солнца), если известны (для силы тяжести и физики плазмы)
  // к DEFAULTS; colorHex — цвет вместо класса; params — свои параметры поверх; arches, flares, cme — показывать ли арки, вспышку,
  // выброс (выброс — опция; у звезды без активных областей нет ни арок, ни вспышки)
  // ---- плазма «частицы в поле и гравитации» (archMode 3; автор: «просто частица движется в магнитном поле и гравитации, мы с этого начинали»;
  // «трубки на самом деле существуют, но в этой модели мы их не рассматриваем»; «полюсов как таковых нет — всё плавно»). Петли — плазма в
  // силовых трубках, закреплённых обоими концами в фотосфере (Reale 2014); здесь трубки явно не строятся: частица — порция плазмы, вмороженная
  // в поле, — идёт вдоль поля В СВОЕЙ ТОЧКЕ (поле считается для каждой частицы каждый кадр), сила тяжести тянет её вдоль поля. Цикл —
  // тепловое неравновесие (Antolin 2020; Froment et al. 2018, 2019; Klimchuk & Luna 2019): нагрев у оснований → испарение наполняет петлю →
  // радиационное остывание → конденсация → корональный дождь; дождь падает медленнее свободного падения — его подпирает градиент давления
  // (Oliver et al. 2014; Martínez-Gómez et al. 2020): разгон, потом почти постоянная скорость ≈ 70 км/с (rainTerm).
  // Источник — испарение из хромосферы у оснований полюсов (вес ∝ |q|, у молодых — больше): частица стартует вверх вдоль поля со скоростью
  // испарения fpVinj (50–300 км/с — Milligan & Dennis 2009). Горячую плазму держит давление — через тепловой разброс скоростей (см. шаг:
  // барометрическое расслоение выходит само); частица остывает за fpCool с — теряет разброс и стекает дождём.
  // Где поле слабее orphBweak Гс — не удерживается: облако (блуждание orphCloud R★/с). Ушла в хромосферу (r < 1) или за поверхность
  // источника — рождается заново у основания; число частиц постоянное, плотность (яркость) выходит сама. Петли, их смена, рост, дождь, облака —
  // без отдельных правил
  function freePlasma(THREE, P, p, seed, ph, SF) {
    const rnd = mulberry(seed ^ 0x7f4a7c15), e = (p.falloff + 1) / 2, rMax = p.rSS > 1 ? p.rSS : 3, Rcm = ph.rKm * 1e5;
    const vesc = 617.7 * Math.sqrt(ph.mSun / ph.rSun), kms = 1 / vesc / p.tDyn, g0 = 1 / (2 * p.tDyn * p.tDyn);
    let C = charges(P, p), nC = C.length / 4; const gUnit = C.gUnit;
    const N = Math.max(0, Math.round(p.fpN)), tr = false;
    const pos = new Float32Array(N * 3), dir = new Float32Array(N * 3), vp = new Float32Array(N), hot = new Float32Array(N), age = new Float32Array(N), life = new Float32Array(N), cw = new Float32Array(N * 3);
    const gp = new Float32Array(N * 3), ga = new Float32Array(N), gf = new Float32Array(N), gt = new Float32Array(N), gz = new Float32Array(N).fill(1);
    const geo = new THREE.BufferGeometry();
    for (const [k, a, w] of [['position', gp, 3], ['aA', ga, 1], ['aF', gf, 1], ['aT', gt, 1], ['aZ', gz, 1]]) geo.setAttribute(k, new THREE.BufferAttribute(a, w).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), rMax + 0.5);
    const o = [0, 0, 0], e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    // веса оснований: |q|, у всплывающих — больше (нагрев всплытия)
    let wSum = 0, wT = 1e9;
    // точки вылета (автор: «если частицы будут вылетать не из разных точек поверхности, а из определённых, — образуется рисунок»; «не надо,
    // чтобы с полюсом двигались»): fpPts неподвижных точек на поверхности звезды (равномерная сетка Фибоначчи, шаг ≈ √(4π/fpPts) R★);
    // вес точки — нагрев ∝ полю в ней сверх фона fpBfloor Гс (Schrijver 2004), пересчёт 4 раза в секунду: полюс проплывает под точками,
    // и какие из них выпускают плазму, плавно меняется вместе с полем; частица вылетает ровно из точки — по той же силовой линии, что и
    // предыдущие из неё, — линии проступают рисунком
    const M = Math.max(100, Math.round(p.fpPts)), ex = new Float32Array(M * 3), ew = new Float64Array(M);
    for (let k = 0; k < M; k++) { const zz = 1 - 2 * (k + 0.5) / M, rq = Math.sqrt(1 - zz * zz), an = k * 2.3999632; ex[k * 3] = rq * Math.cos(an) * 1.004; ex[k * 3 + 1] = zz * 1.004; ex[k * 3 + 2] = rq * Math.sin(an) * 1.004; }
    const reweigh = () => { wSum = 0; for (let k = 0; k < M; k++) { fieldAt(ex[k * 3], ex[k * 3 + 1], ex[k * 3 + 2], C, nC, e, p.open, o); const bG = Math.hypot(o[0], o[1], o[2]) * gUnit;
        wSum += Math.pow(Math.max(0, bG - p.fpBfloor), p.fpBpow); ew[k] = wSum; } };
    const spawn = i => { if (!(wSum > 0)) { age[i] = 0; life[i] = 0; return; } const u = rnd() * wSum; let lo = 0, hi = M - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (ew[mid] < u) lo = mid + 1; else hi = mid; }
      let x = ex[lo * 3], y = ex[lo * 3 + 1], z = ex[lo * 3 + 2];
      const l = 1.004 / Math.hypot(x, y, z); x *= l; y *= l; z *= l;
      fieldAt(x, y, z, C, nC, e, p.open, o); const bm = Math.hypot(o[0], o[1], o[2]) || 1, s = (o[0] * x + o[1] * y + o[2] * z) >= 0 ? 1 : -1;   // вверх вдоль поля
      const i3 = i * 3; pos[i3] = x; pos[i3 + 1] = y; pos[i3 + 2] = z; dir[i3] = s * o[0] / bm; dir[i3 + 1] = s * o[1] / bm; dir[i3 + 2] = s * o[2] / bm;
      vp[i] = p.fpVinj * (0.5 + rnd()) * kms; hot[i] = 1; age[i] = 0; life[i] = p.fpLife * (0.6 + 0.8 * rnd());
      const zz = 2 * rnd() - 1, an = 6.2832 * rnd(), rq = Math.sqrt(1 - zz * zz); cw[i3] = rq * Math.cos(an); cw[i3 + 1] = zz; cw[i3 + 2] = rq * Math.sin(an); };
    reweigh(); for (let i = 0; i < N; i++) { spawn(i); age[i] = -rnd() * 2; }   // старт — вразнобой (рождение размазано по 2 с)
    let clk = 0, tMs = 0, nOpen = 0, nCloud = 0, nRain = 0, nSpawn = 0, spawnRate = 0;
    // шаг: порция плазмы вдоль поля в своей точке — тяжесть, трение и тепловой разброс скоростей (Ланжевен):
    //   dv = (−g∥ − γ·v)·dt + √(2γσ²·dt)·ξ,  σ = c_s(T) = 117·√(T/1 МК) км/с (изотермическая, μ = 0,6)
    // в равновесии распределение вдоль поля — барометрическое, шкала H = σ²/g (гидростатика петли: у Барнарда ≈ 0,083 R★ на 1 МК) — опору
    // давлением отдельно задавать не нужно; остывшая плазма теряет разброс — H сжимается — стекает; трение γ = g/v_дождя даёт предельную
    // скорость дождя rainTerm (Antolin & Rouppe van der Voort 2012; подпор давлением — Oliver et al. 2014). Ускорение показа — ходом времени
    // целиком (fpTime): скорости и тяжесть ускоряются вместе, шкала высот не искажается
    const step = dt => { if (!(dt > 0)) return; const t0 = performance.now(); clk += dt;
      C = charges(P, p); nC = C.length / 4; wT += dt; if (wT > 0.25) { wT = 0; reweigh(); }
      const ts = Math.max(1, p.fpTime), nsub = Math.max(1, Math.ceil(dt * ts / 0.25)), h = Math.min(dt, 0.1) * ts / nsub;   // модельное время шага (с показа без ускорения течений)
      const vTerm = Math.max(1, p.rainTerm) * kms, gam = g0 / vTerm, tc = Math.max(0.2, p.fpCool), lgTop = Math.log10(Math.max(2e4, p.fpTmax * 1e6)), cs1 = 117 * kms;
      let no = 0, ncl = 0, nr = 0, ns = 0;
      for (let i = 0; i < N; i++) { const i3 = i * 3;
        if (age[i] < 0) { age[i] += dt; ga[i] = 0; continue; }   // ещё не родилась (стартовый разнобой)
        let x = pos[i3], y = pos[i3 + 1], z = pos[i3 + 2], wB = 1, respawn = false;
        for (let k = 0; k < nsub; k++) {
          age[i] += h / ts; hot[i] = Math.max(0, hot[i] - h / ts / tc);
          const r = Math.hypot(x, y, z); fieldAt(x, y, z, C, nC, e, p.open, o); const bm = Math.hypot(o[0], o[1], o[2]) + 1e-12;
          let bx = o[0] / bm, by = o[1] / bm, bz = o[2] / bm; if (bx * dir[i3] + by * dir[i3 + 1] + bz * dir[i3 + 2] < 0) { bx = -bx; by = -by; bz = -bz; }   // ось движения — вдоль поля, как шла
          const T = 1e4 + (p.fpTmax * 1e6 - 1e4) * hot[i], sig = cs1 * Math.sqrt(T / 1e6), gpar = g0 * (bx * x + by * y + bz * z) / (r * r * r);
          const u1 = Math.max(1e-9, rnd()), xi = Math.sqrt(-2 * Math.log(u1)) * Math.cos(6.2832 * rnd());
          let v = vp[i] + (-gpar - gam * vp[i]) * h + Math.sqrt(2 * gam * sig * sig * h) * xi;
          if (v < 0) { v = -v; bx = -bx; by = -by; bz = -bz; }   // развернулась — дальше вдоль поля в другую сторону
          vp[i] = v; dir[i3] = bx; dir[i3 + 1] = by; dir[i3 + 2] = bz;
          // слабое поле — плазма не удерживается: облако (своё медленно поворачивающее направление блуждания)
          wB = smooth01(bm * gUnit / Math.max(0.1, p.orphBweak)); const tq = clk * 0.5 + i * 0.37, cs = p.orphCloud / ts;
          const cx = cw[i3] + 0.6 * Math.sin(tq), cy = cw[i3 + 1] + 0.6 * Math.sin(tq * 1.3 + 2), cz = cw[i3 + 2] + 0.6 * Math.cos(tq * 0.9 + 4);
          // шаг вдоль поля — по средней точке (RK2): направление берётся посередине шага, иначе частицу сносит с изогнутой линии
          { const xm = x + wB * bx * v * h / 2, ym = y + wB * by * v * h / 2, zm = z + wB * bz * v * h / 2; fieldAt(xm, ym, zm, C, nC, e, p.open, o);
            const b2 = Math.hypot(o[0], o[1], o[2]); if (b2 > 1e-12) { let mx = o[0] / b2, my = o[1] / b2, mz = o[2] / b2; if (mx * bx + my * by + mz * bz < 0) { mx = -mx; my = -my; mz = -mz; } bx = mx; by = my; bz = mz; dir[i3] = bx; dir[i3 + 1] = by; dir[i3 + 2] = bz; } }
          x += (wB * bx * v + (1 - wB) * cx * cs) * h; y += (wB * by * v + (1 - wB) * cy * cs) * h; z += (wB * bz * v + (1 - wB) * cz * cs) * h;
          // у переходного слоя горячая плазма отражается (плотная хромосфера её не принимает — тепловой разброс не «проваливает» её вниз);
          // уходит в хромосферу только остывшая (дождь); за поверхностью источника — ушла наружу
          let r2 = Math.hypot(x, y, z);
          if (r2 < 1.0005 && hot[i] > 0.3) { const k2 = 1.001 / r2; x *= k2; y *= k2; z *= k2; r2 = 1.001; dir[i3] = -dir[i3]; dir[i3 + 1] = -dir[i3 + 1]; dir[i3 + 2] = -dir[i3 + 2]; }
          if (r2 < 1.0005 || r2 > rMax || age[i] > life[i]) { respawn = true; break; } }
        if (respawn) { spawn(i); ns++; x = pos[i3]; y = pos[i3 + 1]; z = pos[i3 + 2]; } else { pos[i3] = x; pos[i3 + 1] = y; pos[i3 + 2] = z; }
        gp[i3] = x; gp[i3 + 1] = y; gp[i3 + 2] = z;
        ga[i] = 0.5 * smooth01(age[i] / 0.3) * smooth01((life[i] - age[i]) / 0.5) * (0.35 + 0.65 * wB);
        gt[i] = 4 + (lgTop - 4) * Math.pow(hot[i], 0.3); gf[i] = 0; gz[i] = 1 + (1 - wB) * 1.5;
        const rr = Math.hypot(x, y, z); if (wB < 0.5) ncl++; else if (hot[i] < 0.2) nr++; if (rr > 1.5 && wB >= 0.5) no++; }
      nOpen = no; nCloud = ncl; nRain = nr; nSpawn += ns; spawnRate = spawnRate * 0.95 + ns / dt * 0.05;
      geo.attributes.position.needsUpdate = true; geo.attributes.aA.needsUpdate = true; geo.attributes.aF.needsUpdate = true; geo.attributes.aT.needsUpdate = true; geo.attributes.aZ.needsUpdate = true;
      tMs = tMs * 0.9 + (performance.now() - t0) * 0.1; };
    const stats = () => ({ free: true, n: N, high: nOpen, cloud: nCloud, rain: nRain, spawnPerSec: Math.round(spawnRate), ms: +tMs.toFixed(1), vesc, tReal: ph.rKm / vesc / p.tDyn });
    const nil = () => null;
    return { n: N, geo, step, tr, stats, debugStrand: nil, debugParticles: nil, setView() {}, lodStep() {}, lodStats: nil };
  }
  // ---- то же «частицы в поле и гравитации» на видеокарте (archMode 3, если есть WebGL2 и текстуры с плавающей точкой; иначе — freePlasma
  // на процессоре). Состояние частиц — в трёх текстурах (положение+горячесть, направление вдоль поля+скорость, возраст+срок+удержание),
  // шаг — фрагментный шейдер (поле по массиву зарядов; струйкой — ровно по полю, без случайных толчков: тяжесть, у горячей ослабленная давлением,
  // у остывшей — трение до скорости дождя; шаг по средней точке; перерождение), ping-pong; точки вылета (вес ∝ полю сверх фона) выбирает процессор раз в 0,25 с — таблица 64×64.
  // Отрисовка — точки, вершинный шейдер читает положение из текстуры
  function gpuPlasma(THREE, P, p, seed, ph, SF, renderer) {
    const side = Math.max(16, Math.min(1024, Math.round(Math.sqrt(p.fpGpuN)))), N = side * side, MAXC = 160, rMax = p.rSS > 1 ? p.rSS : 3;
    const vesc = 617.7 * Math.sqrt(ph.mSun / ph.rSun), kms = 1 / vesc / p.tDyn, g0 = 1 / (2 * p.tDyn * p.tDyn), rnd = mulberry(seed ^ 0x2f6b9e17), e = (p.falloff + 1) / 2;
    const rtOpt = { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false };
    const mk = () => { const t = new THREE.WebGLMultipleRenderTargets(side, side, 3, rtOpt); t.texture.forEach(x => { x.type = THREE.FloatType; x.minFilter = x.magFilter = THREE.NearestFilter; }); return t; };
    let A = mk(), B = mk();
    // начальное состояние: все «ещё не родились» с разбросом 0…2 с
    const init = [new Float32Array(N * 4), new Float32Array(N * 4), new Float32Array(N * 4)];
    for (let i = 0; i < N; i++) { init[0][i * 4 + 1] = 1.5; init[1][i * 4 + 1] = 1; init[2][i * 4] = -rnd() * 2; init[2][i * 4 + 1] = 1; init[2][i * 4 + 2] = 1; }
    const initTex = init.map(a => { const t = new THREE.DataTexture(a, side, side, THREE.RGBAFormat, THREE.FloatType); t.needsUpdate = true; return t; });
    // таблица точек вылета
    const EW = 64, emit = new Float32Array(EW * EW * 4), emitTex = new THREE.DataTexture(emit, EW, EW, THREE.RGBAFormat, THREE.FloatType);
    const M = Math.max(100, Math.round(p.fpPts)), ex = new Float32Array(M * 3), ew = new Float64Array(M), o = [0, 0, 0];
    for (let k = 0; k < M; k++) { const zz = 1 - 2 * (k + 0.5) / M, rq = Math.sqrt(1 - zz * zz), an = k * 2.3999632; ex[k * 3] = rq * Math.cos(an) * 1.004; ex[k * 3 + 1] = zz * 1.004; ex[k * 3 + 2] = rq * Math.sin(an) * 1.004; }
    let C = charges(P, p), nC = C.length / 4; const gUnit = C.gUnit;
    // точки вылета движутся вместе с полем (автор: «попробуем точки эмиссии двигать с полями»): сдвиг точки — взвешенный перенос полюсов
    // с весом их вклада в поле в этой точке |q|/(d² + ε); у пятна точка едет с ним (и при расхождении пары), между полюсами — промежуточно,
    // вдали — почти стоит; положения таблицы вылета — каждый кадр
    const tabK = new Int32Array(EW * EW), prevP = new Map();
    const moveEmitters = () => { const act = []; for (const Q of P) { if (Q.dead || !Q.q) continue; const pv = prevP.get(Q.uid);
        if (pv) act.push([Q.p.x, Q.p.y, Q.p.z, Q.p.x - pv[0], Q.p.y - pv[1], Q.p.z - pv[2], Math.abs(Q.q)]); prevP.set(Q.uid, [Q.p.x, Q.p.y, Q.p.z]); }
      if (!act.length) return; let moved = false;
      for (let k = 0; k < M; k++) { const k3 = k * 3, x = ex[k3], y = ex[k3 + 1], z = ex[k3 + 2]; let ws = 0.5, dx = 0, dy = 0, dz = 0;   // 0,5 — «стоять» вдали от всех полюсов
        for (const a of act) { const ax = a[0] - x, ay = a[1] - y, az = a[2] - z, w = a[6] / (ax * ax + ay * ay + az * az + 4e-4); ws += w; dx += w * a[3]; dy += w * a[4]; dz += w * a[5]; }
        if (dx || dy || dz) { const nx = x + dx / ws, ny = y + dy / ws, nz = z + dz / ws, l = 1.004 / Math.hypot(nx, ny, nz); ex[k3] = nx * l; ex[k3 + 1] = ny * l; ex[k3 + 2] = nz * l; moved = true; } }
      if (moved) { for (let j = 0; j < EW * EW; j++) { const k = tabK[j]; emit[j * 4] = ex[k * 3]; emit[j * 4 + 1] = ex[k * 3 + 1]; emit[j * 4 + 2] = ex[k * 3 + 2]; } emitTex.needsUpdate = true; } };
    // вес точки вылета — нагрев у пятен (автор: «чёрные пятна без выброса»): у каждого пятна (|q| ≥ 0,01 — порог тени) своя доля потока ∝ |q|^fpQpow
    // (слабые тоже выпускают), раздаётся точкам вокруг по гауссу шириной fpSpotW теней; вдали от пятен — ноль (без дымки фона)
    const kSp = Math.sqrt(PHI0 / (Math.PI * p.spotBs)) / (ph.rKm * 1e5);
    const rebuildEmit = () => { let s = 0; const sp = []; for (const Q of P) { const a = Math.abs(Q.q); if (Q.dead || a < 0.01) continue; const sg = Math.max(0.008, p.fpSpotW * kSp * Math.sqrt(a));
        sp.push([Q.p.x * 1.004, Q.p.y * 1.004, Q.p.z * 1.004, Math.pow(a, p.fpQpow) / (sg * sg), 1 / (2 * sg * sg), 9 * sg * sg]); }
      for (let k = 0; k < M; k++) { const x = ex[k * 3], y = ex[k * 3 + 1], z = ex[k * 3 + 2]; let w = 0;
        for (const a of sp) { const dx = x - a[0], dy = y - a[1], dz = z - a[2], d2 = dx * dx + dy * dy + dz * dz; if (d2 < a[5]) w += a[3] * Math.exp(-d2 * a[4]); }
        s += w; ew[k] = s; }
      // по квантилям веса (без случайности): пока поле то же — каждая запись таблицы указывает на ту же точку, струйки не мигают
      for (let j = 0; j < EW * EW; j++) { let k = 0; if (s > 0) { const u = (j + 0.5) / (EW * EW) * s; let lo = 0, hi = M - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (ew[mid] < u) lo = mid + 1; else hi = mid; } k = lo; }
        tabK[j] = k; emit[j * 4] = ex[k * 3]; emit[j * 4 + 1] = ex[k * 3 + 1]; emit[j * 4 + 2] = ex[k * 3 + 2]; emit[j * 4 + 3] = s > 0 ? 1 : 0; }
      emitTex.needsUpdate = true;
      // сводка: пятна (|q| > 0,02) без единой точки вылета ближе 0,06 R★
      bare = 0; for (const Q of P) { if (Q.dead || Math.abs(Q.q) < 0.02) continue; let ok = false; for (let j = 0; j < EW * EW && !ok; j += 1) { const dx = emit[j * 4] - Q.p.x * 1.004, dy = emit[j * 4 + 1] - Q.p.y * 1.004, dz = emit[j * 4 + 2] - Q.p.z * 1.004; if (dx * dx + dy * dy + dz * dz < 0.0036) ok = true; } if (!ok) bare++; } };
    let bare = 0;
    const uC = Array.from({ length: MAXC }, () => new THREE.Vector4());
    const uniforms = { t0: { value: null }, t1: { value: null }, t2: { value: null }, i0: { value: initTex[0] }, i1: { value: initTex[1] }, i2: { value: initTex[2] }, uInit: { value: 1 },
      uEmit: { value: emitTex }, uC: { value: uC }, uNC: { value: 0 }, uDip: { value: 0 }, uDipU: { value: 0 }, uDipM: { value: new THREE.Vector3(0, 1, 0) }, uE: { value: e }, uFrame: { value: 0 },
      uH: { value: 0 }, uDtShow: { value: 0 }, uG0: { value: g0 }, uGam: { value: 1 }, uSup: { value: p.fpSupport }, uCool: { value: p.fpCool },
      uVinj: { value: p.fpVinj * kms }, uLife: { value: p.fpLife }, uWind: { value: p.fpWind }, uCloudRate: { value: p.fpCloudRate }, uCon: { value: p.fpCloudOn }, uTime: { value: 0 }, uClFloor: { value: 0 }, uClIn: { value: p.fpCloudIn }, uClInV: { value: 0 }, uWon: { value: p.fpWindOn }, uWtau: { value: p.fpWindTau }, uVP: { value: new Array(64).fill(0) }, uBweak: { value: p.orphBweak }, uGU: { value: gUnit }, uCloud: { value: p.orphCloud }, uRmax: { value: rMax }, uTs: { value: 1 } };
    // ветер Паркера (изотермический): c_s = 117·√T км/с (μ = 0,6), звуковая точка r_c = GM/(2c_s²) = (v_esc/2c_s)² R★; скорость u = v/c_s —
    // u² − ln u² = 4 ln(r/r_c) + 4 r_c/r − 3, дозвуковая ветвь ниже r_c, сверхзвуковая выше (Parker 1958); таблица 64 точки до поверхности источника
    let windT = null;
    const parker = () => { windT = p.fpWindT; const cs = 117 * Math.sqrt(Math.max(0.1, p.fpWindT)), rc = Math.pow(vesc / (2 * cs), 2), vp = uniforms.uVP.value;
      for (let k = 0; k < 64; k++) { const rr = 1 + (rMax - 1) * k / 63, xr = rr / rc, rhs = 4 * Math.log(xr) + 4 / xr - 3; let lo = xr < 1 ? 1e-4 : 1, hi = xr < 1 ? 1 : 20;
        for (let it = 0; it < 60; it++) { const u = 0.5 * (lo + hi), fv = u * u - Math.log(u * u) - rhs; if (xr < 1 ? fv > 0 : fv < 0) lo = u; else hi = u; }
        vp[k] = 0.5 * (lo + hi) * cs * kms; } };
    const SIM_VS = `out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
    const SIM_FS = `precision highp float; precision highp int;
      layout(location = 0) out vec4 o0; layout(location = 1) out vec4 o1; layout(location = 2) out vec4 o2;
      uniform sampler2D t0, t1, t2, i0, i1, i2, uEmit; uniform int uInit, uNC, uFrame; uniform vec4 uC[${MAXC}]; uniform vec3 uDipM;
      uniform float uDip, uDipU, uE, uH, uDtShow, uG0, uGam, uSup, uCool, uVinj, uLife, uBweak, uGU, uCloud, uRmax, uTs, uWind, uWon, uWtau, uCloudRate, uCon, uTime, uClFloor, uClIn, uClInV; uniform float uVP[64];
      float windAt(float r){ float t = clamp((r - 1.0) / max(0.01, uRmax - 1.0), 0.0, 1.0) * 63.0; int k = int(min(62.0, floor(t))); return mix(uVP[k], uVP[k + 1], t - float(k)); }
      uint hsh(uint x){ x ^= x >> 16; x *= 0x7feb352dU; x ^= x >> 15; x *= 0x846ca68bU; x ^= x >> 16; return x; }
      float rn(inout uint s){ s = hsh(s + 0x9e3779b9U); return float(s >> 8) * (1.0 / 16777216.0); }
      vec3 safeU(vec3 v, vec3 fb){ float q = dot(v, v); return q > 1e-20 ? v * inversesqrt(q) : fb; }
      vec3 field(vec3 x){ vec3 b = vec3(0.0); for (int i = 0; i < ${MAXC}; i++) { if (i >= uNC) break; vec3 d = x - uC[i].xyz; float r2 = dot(d, d) + 1e-6; b += uC[i].w * d / pow(r2, uE); }
        if (uDip != 0.0) { float r2 = dot(x, x), r3 = r2 * sqrt(r2), k3 = 3.0 * uDip * dot(uDipM, x) / (r3 * r2); b += k3 * x + uDipM * (-uDip / r3 + uDipU); } return b; }
      void main(){ ivec2 ij = ivec2(gl_FragCoord.xy);
        vec4 s0 = uInit == 1 ? texelFetch(i0, ij, 0) : texelFetch(t0, ij, 0), s1 = uInit == 1 ? texelFetch(i1, ij, 0) : texelFetch(t1, ij, 0), s2 = uInit == 1 ? texelFetch(i2, ij, 0) : texelFetch(t2, ij, 0);
        uint sd = hsh(uint(ij.x) * 7919U + uint(ij.y) * 104729U + uint(uFrame) * 2654435761U);
        vec3 x = s0.xyz, d = s1.xyz; float hot = s0.w, v = s1.w, age = s2.x, life = s2.y, wB = s2.z, cl = s2.w;   // cl — порция ушла облаком
        if (uInit == 0 && uH > 0.0) {
          bool born = false;
          if (age < 0.0) { age += uDtShow; if (age >= 0.0) born = true; }
          else {
            age += uDtShow;
            float r = length(x); vec3 bv = field(x); float bm = length(bv) + 1e-12; vec3 b = bv / bm; if (dot(b, d) < 0.0) b = -b; vec3 rh = x / r;
            if (cl > 0.5) {   // облако: уходит с медленным ветром (Паркер) вдоль открытых линий и расходится вместе с ними
              // у вершины петли поле поперёк радиуса — там сгусток пересекает линии вверх, на открытые (пересоединение задано параметрически:
              // потенциальное поле само его не делает); где поле уже смотрит наружу — строго вдоль поля; в слабом поле — расплыв
              uint cq = uint(ij.x) * 37U + uint(ij.y) * 11U; float qa = rn(cq) * 6.2831853, qz = rn(cq) * 2.0 - 1.0, qt = uTime * 0.4 + qa;
              vec3 qw = vec3(sqrt(max(0.0, 1.0 - qz * qz)) * cos(qa), qz, sqrt(max(0.0, 1.0 - qz * qz)) * sin(qa)) + 0.6 * vec3(sin(qt), sin(qt * 1.3 + 2.0), cos(qt * 0.9 + 4.0));
              float vC = max(windAt(r), uClFloor) * uWind, c0 = dot(b, rh); wB = smoothstep(0.0, 1.0, bm * uGU / max(0.1, uBweak));
              vec3 g1 = safeU(mix(rh, c0 >= 0.0 ? b : -b, smoothstep(0.5, 0.9, abs(c0)) * wB), rh);
              vec3 xq = x + g1 * vC * uH * 0.5, rq = safeU(xq, rh), bvq = field(xq), bq = safeU(bvq, rq); float c1 = dot(bq, rq), rqm = length(xq);
              float vCq = max(windAt(rqm), uClFloor) * uWind, wBq = smoothstep(0.0, 1.0, length(bvq) * uGU / max(0.1, uBweak));
              vec3 g2 = safeU(mix(rq, c1 >= 0.0 ? bq : -bq, smoothstep(0.5, 0.9, abs(c1)) * wBq), rq);
              x += (g2 * vCq + (1.0 - wBq) * qw * uCloud / uTs) * uH; d = g2; wB = wBq;
              float rc2 = length(x); if (rc2 < 1.0005 || rc2 > uRmax || age > life) born = true;
            } else {
            // ветер (Паркер): выше uWon открытое поле почти радиально (вершины петель — поперёк) — горячая плазма там, где поле смотрит наружу,
            // тянется к скорости ветра vP(r) за uWtau и не остывает в дождь
            float vP = windAt(r), cb = dot(b, rh), wo = uWind * smoothstep(uWon, uWon + 0.4, r) * cb * cb * hot;
            hot = max(0.0, hot - uDtShow / uCool * (1.0 - wo));
            // отрыв облака («капли» стримеров — Sheeley et al. 1997; Wang et al. 1998): у вершины высокой петли (поле поперёк радиуса), над
            // которой поле уже смотрит наружу, горячая плазма пересоединением уходит на открытые линии — пачками: вероятность модулирует
            // медленное пятно активности в пространстве и времени (художественно: периодичности в этом нет). Пересоединение даёт пару
            // (Sanchez-Diaz et al. 2017): доля uClIn порций — нижняя половина, сокращающаяся петля: толчок вниз по одной из ветвей, дальше
            // стекает и остывает в дождь. Проверка — в точке до шага; нулевое поле выше — не открытое
            if (uCloudRate > 0.0 && hot > 0.4 && r > uCon) {
              vec3 bvu = field(x + rh * 0.15); float bu2 = dot(bvu, bvu); float up = bu2 > 1e-20 ? abs(dot(bvu, rh)) * inversesqrt(bu2) : 0.0, top = 1.0 - abs(cb);
              float pv = 0.5 + 0.5 * sin(dot(x, vec3(5.1, 4.3, 6.7)) + uTime * 0.6) * sin(dot(x, vec3(-3.7, 6.1, 2.9)) - uTime * 0.45);
              float lam = uCloudRate * top * smoothstep(0.6, 0.9, up) * smoothstep(0.55, 0.85, pv);
              if (rn(sd) < 1.0 - exp(-lam * uDtShow)) { if (rn(sd) < uClIn) { v = uClInV * (0.6 + 0.8 * rn(sd)); if (rn(sd) < 0.5) b = -b; }
                else { cl = 1.0; life = age + uLife * 2.0; } } }
            // струйкой, без случайных толчков: тяжесть вдоль поля (горячую держит давление — доля uSup снята), остывшая — трение до предельной
            // скорости дождя
            float gpar = uG0 * (1.0 - uSup * hot) * dot(b, x) / (r * r * r);
            v += (-gpar - uGam * (1.0 - hot) * v + wo * ((cb >= 0.0 ? 1.0 : -1.0) * vP - v) / uWtau) * uH; if (v < 0.0) { v = -v; b = -b; }
            wB = smoothstep(0.0, 1.0, bm * uGU / max(0.1, uBweak));
            // облако: своё медленно поворачивающее направление (из номера частицы)
            uint cs = uint(ij.x) * 31U + uint(ij.y) * 17U; float a1 = rn(cs) * 6.2831853, z1 = rn(cs) * 2.0 - 1.0, tq = float(uFrame) * 0.01 + a1;
            vec3 cw = vec3(sqrt(1.0 - z1 * z1) * cos(a1), z1, sqrt(1.0 - z1 * z1) * sin(a1)) + 0.6 * vec3(sin(tq), sin(tq * 1.3 + 2.0), cos(tq * 0.9 + 4.0));
            // шаг по средней точке вдоль поля
            vec3 xm = x + wB * b * v * uH * 0.5, bm2 = field(xm); vec3 bn = normalize(bm2); if (dot(bn, b) < 0.0) bn = -bn;
            // слабое поле — плазма не удерживается: облако, ветер несёт его по радиусу
            x += (wB * bn * v + (1.0 - wB) * (cw * uCloud / uTs + rh * vP * uWind * hot)) * uH; d = bn;
            float r2 = length(x);
            if (r2 < 1.0005 || r2 > uRmax || age > life) born = true;
            }
          }
          if (born) {   // рождение у точки вылета: вверх вдоль поля, испарение
            vec4 em = texelFetch(uEmit, ivec2(int(rn(sd) * 64.0) & 63, int(rn(sd) * 64.0) & 63), 0);
            if (em.w > 0.0) { cl = 0.0; x = em.xyz; vec3 bv = field(x); vec3 b = normalize(bv); if (dot(b, x) < 0.0) b = -b; d = b; v = uVinj * (0.5 + rn(sd)); hot = 1.0; age = 0.0; life = uLife * (0.6 + 0.8 * rn(sd)); wB = 1.0; }
            else { age = -0.5; }
          }
        }
        o0 = vec4(x, hot); o1 = vec4(d, v); o2 = vec4(age, life, wB, cl); }`;
    const simMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: SIM_VS, fragmentShader: SIM_FS, uniforms, depthTest: false, depthWrite: false });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMat), qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); qs.add(quad); quad.frustumCulled = false;
    const pass = () => { const prev = renderer.getRenderTarget(); uniforms.t0.value = A.texture[0]; uniforms.t1.value = A.texture[1]; uniforms.t2.value = A.texture[2];
      renderer.setRenderTarget(B); renderer.render(qs, qc); renderer.setRenderTarget(prev); const t = A; A = B; B = t; uniforms.uFrame.value++; };
    // точки: вершинный шейдер читает положение из текстуры
    const geo = new THREE.BufferGeometry(), ref = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) { ref[i * 2] = ((i % side) + 0.5) / side; ref[i * 2 + 1] = (((i / side) | 0) + 0.5) / side; }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); geo.setAttribute('ref', new THREE.BufferAttribute(ref, 2));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), rMax + 0.5);
    const drawU = { s0: { value: null }, s2: { value: null }, uLgTop: { value: Math.log10(Math.max(2e4, p.fpTmax * 1e6)) }, uSplat: { value: p.fpSplat }, uNorm: { value: Math.sqrt(65536 / N) }, uClDbg: { value: 0 }, uClB: { value: p.fpCloudBright }, uClR: { value: p.fpCloudOn }, uRm: { value: rMax }, uClS: { value: p.fpCloudSize }, uBrVar: { value: p.fpBrVar } };
    let tMs = 0, wT = 1e9, inited = false;
    // вид (не счёт) — и на паузе: ползунки яркости и пятен видны сразу
    const look = () => { drawU.uLgTop.value = Math.log10(Math.max(2e4, p.fpTmax * 1e6)); drawU.uSplat.value = p.fpSplat; drawU.uClDbg.value = p.fpCloudDbg ? 1 : 0; drawU.uClB.value = p.fpCloudBright;
      drawU.uClR.value = Math.max(1.02, p.fpCloudOn); drawU.uClS.value = p.fpCloudSize; drawU.uBrVar.value = p.fpBrVar; };
    const step = dt => { look(); if (!(dt > 0) && inited) return; const t0 = performance.now();
      C = charges(P, p); nC = Math.min(MAXC, C.length / 4); for (let i = 0; i < nC; i++) uC[i].set(C[i * 4], C[i * 4 + 1], C[i * 4 + 2], C[i * 4 + 3]);
      uniforms.uNC.value = nC; uniforms.uDip.value = C.dip || 0; uniforms.uDipU.value = C.dipU || 0; if (C.dipM) uniforms.uDipM.value.fromArray(C.dipM);
      if (p.fpMoveEm > 0) moveEmitters();
      wT += dt; if (wT > 0.25 || !inited) { wT = 0; rebuildEmit(); }
      const ts = Math.max(1, p.fpTime), vTerm = Math.max(1, p.rainTerm) * kms;
      Object.assign(uniforms.uTs, { value: ts }); uniforms.uGam.value = g0 / vTerm; uniforms.uSup.value = p.fpSupport; uniforms.uCool.value = Math.max(0.2, p.fpCool);
      uniforms.uCloudRate.value = p.fpCloudRate; uniforms.uCon.value = p.fpCloudOn; uniforms.uTime.value += Math.min(dt, 0.25);
      uniforms.uClFloor.value = 5 * kms; uniforms.uClIn.value = p.fpCloudIn; uniforms.uClInV.value = p.fpCloudInV * kms;
      uniforms.uWind.value = p.fpWind; uniforms.uWon.value = p.fpWindOn; uniforms.uWtau.value = Math.max(0.05, p.fpWindTau); if (windT !== p.fpWindT) parker();
      uniforms.uVinj.value = p.fpVinj * kms; uniforms.uLife.value = p.fpLife; uniforms.uBweak.value = p.orphBweak; uniforms.uCloud.value = p.orphCloud;
      if (!inited) { uniforms.uInit.value = 1; uniforms.uH.value = 0; pass(); uniforms.uInit.value = 0; inited = true; }
      const nsub = Math.max(1, Math.ceil(Math.min(dt, 0.25) * ts / 0.2)), h = Math.min(dt, 0.25) * ts / nsub;
      uniforms.uH.value = h; uniforms.uDtShow.value = h / ts; for (let k = 0; k < nsub && dt > 0; k++) pass();
      drawU.s0.value = A.texture[0]; drawU.s2.value = A.texture[2];
      rbT += dt; if (rbT > 1) { rbT = 0; readBack(); }
      tMs = tMs * 0.9 + (performance.now() - t0) * 0.1; };
    // сводка раз в секунду: выборка 64×64 частиц из текстур состояния (положение и нагрев, возраст и признак облака)
    let rbT = 0, cnt = null; const RB = Math.min(32, side), rb0 = new Float32Array(RB * RB * 4), rb2 = new Float32Array(RB * RB * 4);
    const rbAt = [[0, 0], [side - RB, 0], [0, side - RB], [side - RB, side - RB], [(side - RB) >> 1, (side - RB) >> 1]];
    const readBack = () => { const gl = renderer.getContext(), prev = renderer.getRenderTarget(); let live = 0, hi = 0, cl = 0, weak = 0, rain = 0, n = 0;
      try { renderer.setRenderTarget(A);
        for (const [bx, by] of rbAt) { gl.readBuffer(gl.COLOR_ATTACHMENT0); gl.readPixels(bx, by, RB, RB, gl.RGBA, gl.FLOAT, rb0); gl.readBuffer(gl.COLOR_ATTACHMENT2); gl.readPixels(bx, by, RB, RB, gl.RGBA, gl.FLOAT, rb2);
          for (let i = 0; i < RB * RB; i++) { const j = i * 4; n++; if (rb2[j] < 0) continue; live++; const r = Math.hypot(rb0[j], rb0[j + 1], rb0[j + 2]);
            if (rb2[j + 3] > 0.5) cl++; else if (rb2[j + 2] < 0.5) weak++; else if (rb0[j + 3] < 0.2) rain++; if (r > 1.5 && rb2[j + 3] <= 0.5) hi++; } }
      } finally { gl.readBuffer(gl.COLOR_ATTACHMENT0); renderer.setRenderTarget(prev); }
      const k = N / Math.max(1, n); cnt = { live: Math.round(live * k), high: Math.round(hi * k), cloud: Math.round(cl * k), weak: Math.round(weak * k), rain: Math.round(rain * k) }; };
    step(0);
    const stats = () => ({ free: true, gpu: true, bareSpots: bare, n: N, high: cnt ? cnt.high : '—', cloud: cnt ? cnt.cloud : '—', weak: cnt ? cnt.weak : '—', rain: cnt ? cnt.rain : '—', live: cnt ? cnt.live : '—',
      spawnPerSec: '—', ms: +tMs.toFixed(1), vesc, tReal: ph.rKm / vesc / p.tDyn });
    const nil = () => null;
    const dispose = () => { A.dispose(); B.dispose(); initTex.forEach(t => t.dispose()); emitTex.dispose(); simMat.dispose(); quad.geometry.dispose(); if (field) field.dispose(); };
    // ---- плазма как среда (автор: «плазма — это не точки»; «будем думать, как трубки делать»): частицы на видеокарте копят плотность в
    // текстуре половинного разрешения — каждая кладёт свою порцию мягким гауссовым пятном (масса порции, размазанная по площади пятна на
    // экране), за звездой — отсекается (луч от камеры пересекает диск раньше); затем поле плотности рисуется поверх кадра: видимый свет ∝ n
    // (рассеяние электронами), ультрафиолет ∝ n² (оптически тонкое излучение), цвет — по средней температуре в пикселе, мягкое насыщение.
    // Струйки сливаются в сплошные трубки без зерна, слабое поле — мягкий расплыв
    const ACC_VS = `attribute vec2 ref; uniform sampler2D s0, s2; uniform float uPxH, uSplat, uLgTop; varying float vW; varying float vT;
      void main(){ vec4 a = texture2D(s0, ref), c = texture2D(s2, ref); float age = c.x, life = c.y, wB = c.z, hot = a.w;
        float w = age < 0.0 ? 0.0 : smoothstep(0.0, 0.3, age) * smoothstep(0.0, 0.5, life - age);
        vec3 P = a.xyz, dv = P - cameraPosition; float L = length(dv); vec3 dn = dv / max(L, 1e-6); float b = dot(cameraPosition, dn), cc = dot(cameraPosition, cameraPosition) - 1.0, disc = b * b - cc;
        if (disc > 0.0) { float t1 = -b - sqrt(disc); if (t1 > 0.0 && t1 < L) w = 0.0; }   // за звездой
        vT = 4.0 + (uLgTop - 4.0) * pow(max(hot, 0.0), 0.3);
        vec4 mv = modelViewMatrix * vec4(P, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uSplat * uPxH / -mv.z * (1.0 + (1.0 - wB) * 1.5), 1.0, 64.0);
        vW = w / (gl_PointSize * gl_PointSize); }`;
    const ACC_FS = `varying float vW; varying float vT;
      void main(){ vec2 q = gl_PointCoord - 0.5; float r2 = dot(q, q); if (r2 > 0.25 || vW <= 0.0) discard; float k = exp(-r2 * 18.0) * 5.76;
        gl_FragColor = vec4(vW * k, vW * k * vT, 0.0, 1.0); }`;
    const accMat = new THREE.ShaderMaterial({ vertexShader: ACC_VS, fragmentShader: ACC_FS, uniforms: { s0: drawU.s0, s2: drawU.s2, uLgTop: drawU.uLgTop, uSplat: drawU.uSplat, uPxH: { value: 400 } },
      depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
    const accPts = new THREE.Points(geo, accMat), accScene = new THREE.Scene(); accPts.frustumCulled = false; accScene.add(accPts);
    const densRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    const COMP_FS = `uniform sampler2D tD; uniform float uK, uMode, uLine, uBright; uniform vec3 uStar; varying vec2 vUv;
      vec3 lcol(float lt){ vec3 c = vec3(1.0, 0.3, 0.42); c = mix(c, vec3(1.0, 0.32, 0.12), smoothstep(5.6, 5.95, lt)); c = mix(c, vec3(0.45, 1.0, 0.3), smoothstep(6.1, 6.3, lt));
        c = mix(c, vec3(1.0, 0.95, 0.25), smoothstep(6.45, 6.65, lt)); return mix(c, vec3(1.0), smoothstep(6.9, 7.2, lt)); }
      vec3 tcol(float lt){ vec3 c = mix(vec3(1.0, 0.22, 0.3), vec3(1.0, 0.6, 0.2), smoothstep(4.6, 5.9, lt)); c = mix(c, vec3(1.0, 0.86, 0.62), smoothstep(5.9, 6.35, lt));
        c = mix(c, vec3(0.6, 0.8, 1.0), smoothstep(6.45, 6.85, lt)); return mix(c, vec3(0.82, 0.76, 1.0), smoothstep(7.0, 7.4, lt)); }
      void main(){ vec4 d = texture2D(tD, vUv); float n = d.r; if (n <= 1e-7) discard; float lt = d.g / n, cool = 1.0 - smoothstep(4.6, 5.2, lt);
        float I = uMode < 0.5 ? n * uK : (n * uK) * (n * uK) * 4.0; I = 1.0 - exp(-I);
        vec3 col = uMode < 0.5 ? mix(mix(uStar, lcol(lt), uLine), lcol(lt), cool) : tcol(lt);
        gl_FragColor = vec4(col * I * uBright, 1.0); }`;
    const compU = { tD: { value: densRT.texture }, uK: { value: p.fpFieldK }, uMode: { value: 0 }, uLine: { value: 0.3 }, uBright: { value: 1 }, uStar: { value: new THREE.Color(1, 0.6, 0.3) } };
    const compMat = new THREE.ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: COMP_FS, uniforms: compU,
      depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, toneMapped: false });
    const compQ = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compMat), compS = new THREE.Scene(), compC = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); compQ.frustumCulled = false; compS.add(compQ);
    const clr = new THREE.Color(), dsz = new THREE.Vector2();
    // отрисовка среды поверх кадра target (null — экран); look — униформы цвета частиц (режим, оттенок, яркость, цвет звезды)
    const field = { render(renderer, camera, target, look) {
      const W = target ? target.width : renderer.getDrawingBufferSize(dsz).x, H = target ? target.height : dsz.y, w2 = Math.max(1, W >> 1), h2 = Math.max(1, H >> 1);
      if (densRT.width !== w2 || densRT.height !== h2) densRT.setSize(w2, h2);
      accMat.uniforms.uPxH.value = h2 / (2 * Math.tan(camera.fov * Math.PI / 360));
      const prevT = renderer.getRenderTarget(), ac = renderer.autoClear; renderer.getClearColor(clr); const ca = renderer.getClearAlpha();
      renderer.setRenderTarget(densRT); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false); renderer.autoClear = false; renderer.render(accScene, camera);
      compU.uK.value = p.fpFieldK; if (look) { compU.uMode.value = look.uMode.value; compU.uLine.value = look.uLine.value; compU.uBright.value = look.uBright.value; compU.uStar.value.copy(look.uStar.value); }
      renderer.setRenderTarget(target); renderer.render(compS, compC);
      renderer.autoClear = ac; renderer.setClearColor(clr, ca); renderer.setRenderTarget(prevT); },
      dispose() { densRT.dispose(); accMat.dispose(); compMat.dispose(); compQ.geometry.dispose(); } };
    return { n: N, geo, step, look, tr: false, gpu: true, drawU, stats, field, dispose, debugStrand: nil, debugParticles: nil, setView() {}, lodStep() {}, lodStats: nil };
  }
  // вершинный шейдер частиц на видеокарте: положение, горячесть, возраст — из текстур состояния; цвет — как у частиц (PART_FS)
  const GPU_VS = `#include <common>
    #include <logdepthbuf_pars_vertex>
    attribute vec2 ref; uniform sampler2D s0, s2; uniform float uPx, uR, uSize, uVis, uLgTop, uSplat, uNorm, uClDbg, uClB, uClR, uRm, uClS, uBrVar; varying float vA; varying float vT;
    void main(){ vec4 a = texture2D(s0, ref), c = texture2D(s2, ref); float age = c.x, life = c.y, wB = c.z, hot = a.w, cl = c.w;
      vA = (cl > 0.5 ? uClB * pow(uClR / max(uClR, length(a.xyz)), 2.0) : 1.0) * (age < 0.0 ? 0.0 : 1.0) * 0.5 * uVis * uNorm * smoothstep(0.0, 0.3, age) * smoothstep(0.0, 0.5, life - age) * (0.35 + 0.65 * wB);   // uNorm — при большем числе частиц каждая тусклее (√)
      vT = 4.0 + (uLgTop - 4.0) * pow(max(hot, 0.0), 0.3);
      // разброс яркости порций (автор): плотность в тонкой структуре короны неоднородна — у каждой порции своя, излучение ∝ n²;
      // множитель логнормальный со средним 1 (общий свет не меняется), новый при каждом рождении порции (от её срока жизни)
      float h1 = fract(sin(dot(ref, vec2(12.9898, 78.233)) + life * 43.17) * 43758.5453), h2 = fract(sin(dot(ref, vec2(39.3468, 11.135)) + life * 17.31) * 24634.6345);
      vA *= exp(uBrVar * sqrt(-2.0 * log(max(h1, 1e-6))) * cos(6.2831853 * h2) - 0.5 * uBrVar * uBrVar);
      // граница счёта (поверхность источника) — не обрыв: последние 28 % пути порция плавно гаснет (разрежение уходящей плазмы)
      vA *= 1.0 - smoothstep(uRm * 0.72, uRm, length(a.xyz));
      if (uClDbg > 0.5) { vT = cl > 0.5 ? 7.6 : vT; vA *= cl > 0.5 ? 4.0 : 0.25; }   // проверка: облака — голубым, остальное приглушить
      vec4 mv = modelViewMatrix * vec4(a.xyz, 1.0); gl_Position = projectionMatrix * mv;
      // плазма — не точки (автор): порция рисуется мягким пятном размером с толщину трубки uSplat R★; свет порции сохраняется — чем пятно
      // больше на экране, тем тусклее на пиксель; перекрываясь, пятна сливаются в сплошное свечение (оптически тонкая плазма — сумма вдоль луча)
      // облако расходится вместе с открытыми линиями: пятно растёт с удалением (размер сгустка ∝ r); свет — рассеяние на электронах,
      // освещённость звездой падает ∝ 1/r² (выше — в vA)
      float sp = uSplat * uR * uPx / -mv.z * (1.0 + (1.0 - wB) * 1.5) * (cl > 0.5 ? max(1.0, length(a.xyz) / uClR) * uClS : 1.0), pd = max(1.0, uSize * uR * uPx / -mv.z);
      gl_PointSize = clamp(sp, 1.0, 96.0); vA *= min(1.0, (pd * pd) / max(1.0, gl_PointSize * gl_PointSize)) * 3.0;
      #include <logdepthbuf_vertex>
    }`;
  // фрагмент частиц на видеокарте: гауссово пятно (мягкое, без края), цвет — как у PART_FS
  const GPU_FS = PART_FS.replace('vec2 q = gl_PointCoord - 0.5; float r = length(q); if (r > 0.5 || vA < 0.002) discard;', 'vec2 q = gl_PointCoord - 0.5; float r = length(q); if (r > 0.5 || vA < 0.0005) discard;')
    .replace('gl_FragColor = vec4(col * min(vA, 4.0) * uBright * (1.0 - r * 2.0), 1.0);', 'gl_FragColor = vec4(col * min(vA, 4.0) * uBright * exp(-r * r * 18.0), 1.0);');
  function create(THREE, opts) {
    const cp = classParams(opts.sp, opts.comp), p = Object.assign({}, DEFAULTS, cp.overrides, opts.params || {}), seed = opts.seed | 0;
    // стенд, этапы 0–1 (labPhysics, только при labLOD): согласованная единица поля, карта поверхности (opts.SurfaceState), единые часы
    const labPhys = opts.labLOD === true && p.labPhysics === 1 && p.archMode === 3;
    // стенд: фотосфера «как видит глаз» (photosphere.js) — только в области таблицы PHOENIX; T_eff — измеренная (labTeff) или по классу
    const eyeR = (opts.rKm || cp.rSun * R_SUN_KM) / R_SUN_KM, eyeM = opts.mSun || cp.mSun, eyeT = p.labTeff > 0 ? p.labTeff : cp.teff, eyeG = 4.438 + Math.log10(eyeM / (eyeR * eyeR));
    const eye = labPhys && !!opts.SurfaceState && !!opts.Photosphere && p.labEye > 0 && opts.Photosphere.supported(eyeT, eyeG, p.labSpotDT);
    // нормировка Φ₀/4πR² верна для поля 1/r² без радиального фона — в физической ветке falloff = 2, open = 0 (не ползунками)
    if (labPhys) { const rc = (opts.rKm || cp.rSun * R_SUN_KM) * 1e5; p.labFluxUnitG = PHI0 / (4 * Math.PI * rc * rc); p.falloff = 2; p.open = 0; } else p.labFluxUnitG = 0;
    if (!(p.archMode >= 1)) p.dipoleG = 0;   // режим трубок — как в игре (шаг В5): без диполя звезды; физика плазмы и выброса — в режиме плазмы
    const P = poles(THREE, seed, p), L = P.length ? lines(THREE, P, p, mulberry(seed ^ 0x5f3759df)) : { lines: [], rejected: {} }, hsl = {};
    const show = { arches: opts.arches !== false && P.length > 0, flares: opts.flares !== false && P.length > 0, cme: opts.cme !== false && P.length > 0 };
    const col = new THREE.Color(opts.colorHex != null ? opts.colorHex : opts.sp ? cp.colorHex : 0xffb56c);
    // цвет поверхности: насыщеннее точки на карте — по классу (satBoost: M 0,25 — глубокий оранжевый, K меньше, G почти нет, горячие — как есть)
    col.getHSL(hsl); const kS = Math.min(1, p.satBoost * 4); col.setHSL(hsl.h * (1 - 0.4 * p.satBoost), Math.min(1, hsl.s * (1 + 0.4 * p.satBoost) + p.satBoost), hsl.l - (hsl.l - 0.5) * kS);
    const g = new THREE.Group();
    const uP = [], uQ = [], uS = new Array(64).fill(1), uB = new Array(64).fill(0); for (let i = 0; i < 64; i++) { const Q = P[i]; uP.push(Q ? Q.p.clone() : new THREE.Vector3(i === 1 ? -0.1 : 0.1, 1, 0).normalize()); uQ.push(Q ? Q.q : 0); }   // без полюсов — две разные точки: лента вспышки не делит на ноль
    const su = { uT: { value: 0 }, uFlash: { value: 0 }, uCol: { value: col.clone().multiplyScalar(p.bright) }, uP: { value: uP }, uQ: { value: uQ }, uS: { value: uS }, uB: { value: uB }, uN: { value: Math.min(64, P.length) },
      uGran: { value: p.granScale }, uGranC: { value: p.granContrast }, uSuper: { value: p.superScale }, uLimbA: { value: p.limbA }, uLimbB: { value: p.limbB }, uLimbRed: { value: p.limbRed },
      uSpot: { value: p.spotSize }, uSpotGrow: { value: p.spotGrow }, uSpotSq: { value: 0 }, uSpotQ: { value: 0 }, uBirth: { value: p.birthBright }, uRim: { value: p.rim }, uRimP: { value: p.rimPow }, uGP: { value: p.granPhys }, uGF: { value: 1 }, uGRms: { value: p.granRms }, uGTau: { value: p.granTau }, uPlage: { value: p.plage }, uPlageW: { value: p.plageWidth }, uRib: { value: p.ribbons }, uDim: { value: 0 } };
    // пятна в режиме плазмы с самостоятельными полюсами — по физике: площадь тени = Φ/B_s (B_s = spotG; Solanki 2003), r = √(Φ/(π·B_s));
    // B_s — поле тени (spotBs; модели пятен G–M0 — 3–4,5 кГс, Panja et al. 2020). Тёмные поры — от ≈ 2,5·10¹⁹ Мкс (q ≈ 0,005), полная тень
    // с полутенью — от ≈ 2,5–5·10²⁰ (Schrijver & Zwaan 2000); порог стенда — q 0,01. Иначе (игра) — прежние размер и рост
    const spotU = () => { const phys = p.archMode >= 1 && p.surface > 0;
      su.uSpot.value = phys ? 0 : p.spotSize; su.uSpotGrow.value = phys ? 0 : p.spotGrow;
      su.uSpotSq.value = phys ? Math.sqrt(PHI0 / (Math.PI * p.spotBs)) / (ph.rKm * 1e5) : 0; su.uSpotQ.value = phys ? 0.01 : 0; };
    su.uSMap = { value: null }; su.uSMapK = { value: p.labPlageK }; su.uSMapP = { value: p.labPulseK }; su.uSMapView = { value: p.labMapView };
    const surf = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 120), new THREE.ShaderMaterial({ vertexShader: STAR_VS, fragmentShader: STAR_FS, toneMapped: false, uniforms: su, extensions: { derivatives: true },
      defines: labPhys && opts.SurfaceState ? Object.assign({ LAB_SURFACE_MAP: '' }, eye ? { LAB_EYE: '' } : {}, eye && opts.renderer ? { LAB_SPOTMAP: '' } : {}) : {} }));
    g.add(surf);
    const au = { uT: { value: 0 }, uFlash: { value: 0 }, uLift: { value: 0 }, uA: { value: 1 }, uGone: { value: 0 }, uSway: { value: p.sway }, uBright: { value: p.archBright },
      uFlowS: { value: p.flowSpeed }, uFlowF: { value: p.flowFreq }, uCol: { value: col.clone().multiplyScalar(p.bright).lerp(new THREE.Color(1, 0.55, 0.35), 0.3) } };
    const archMat = new THREE.ShaderMaterial({ vertexShader: ARCH_VS, fragmentShader: ARCH_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: au });
    if (show.arches && (p.archMode === 0 || p.archMode === 2)) L.lines.forEach((l, i) => {
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(l.pts), Math.min(140, l.pts.length * 2), p.tubeR + p.tubeRq * Math.min(1, l.q), 6, false);
      const n = geo.attributes.position.count, ph = (i * 0.618) % 1;
      geo.setAttribute('aPh', new THREE.BufferAttribute(new Float32Array(n).fill(ph), 1));
      geo.setAttribute('aFl', new THREE.BufferAttribute(new Float32Array(n).fill(l.id === 0 ? 1 : 0), 1));
      g.add(new THREE.Mesh(geo, archMat));
    });
    // физика звезды: радиус (км) — из данных системы или по классу, масса — по классу или из opts.mSun
    const rKm = opts.rKm || cp.rSun * R_SUN_KM, ph = { rKm, rSun: rKm / R_SUN_KM, mSun: opts.mSun || cp.mSun, flares: show.flares, cme: show.cme };
    spotU(); su.uGF.value = ph.rKm / Math.max(1, p.granKm);
    // фотосфера «как видит глаз»: таблица по μ (половинная точность — линейная выборка есть всегда), экспозиция — у центра диска наибольший
    // канал 0,8 после кривой камеры (колено), дальше — ступени labExpEV; lg g — по массе и радиусу (Солнце — 4,438)
    let expo0 = 1, photTex = null;
    if (eye) { const L = opts.Photosphere.lut({ teff: eyeT, logg: eyeG, ubvri: p.labUBVRI, dTu: p.labSpotDT, dTp: p.labPenDT, N: 128 });
      const h = new Uint16Array(L.data.length); for (let i = 0; i < h.length; i++) h[i] = THREE.DataUtils.toHalfFloat(L.data[i]);
      photTex = new THREE.DataTexture(h, L.N, L.rows, THREE.RGBAFormat, THREE.HalfFloatType);
      Object.assign(photTex, { magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, generateMipmaps: false, flipY: false, needsUpdate: true });
      expo0 = opts.Photosphere.expoFor([L.data[(L.N - 1) * 4], L.data[(L.N - 1) * 4 + 1], L.data[(L.N - 1) * 4 + 2]], 0.8); ph.eyeXY = L.xy; }
    su.uPhot = { value: photTex }; su.uExpo = { value: expo0 * Math.pow(2, p.labExpEV || 0) }; su.uFacK = { value: p.labFacK }; su.uPenK = { value: p.labPenK }; su.uCurve = { value: p.labCurve };
    // карта теней (стенд): 4096×2048 (≈ 165 км на экваторе Проксимы), с уровнями детализации — вдали без мерцания
    let spotRT = null, spotRT2 = null, spotRT3 = null, spotSpare = null, spotMat = null, spotQuad = null, spotScene = null, spotDirty = true, spotWall = -1e9; const SMW = 4096, SMH = 2048;
    // две карты (стенд; автор: «давай и фотосферу так же»): показ — смесь прежней и текущей, новая рисуется полосами в запасную, без паузы
    // (прежде — не чаще раза в 0,25 с: контуры пятен прыгали 4 раза в секунду); уровни детализации — раз на готовую карту, не на каждую полосу
    const makeSpotRT = () => new THREE.WebGLRenderTarget(SMW, SMH, { depthBuffer: false, stencilBuffer: false, wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping,
        minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true });
    // показ — момент «сейчас − spotLag» между временами входов прежней и текущей карты (как у короны: смесь по промежутку между сменами
    // отскакивала назад, когда промежуток удлинялся); новая карта сменяет текущую, только когда текущая старше запаздывания
    let spotShow = null, spotPrev = null, spotSwapT = 0, spotLag = 180, spotFrame = 33, spotLastT = 0, spotPend = false; const spotIn = new Map();   // время входов каждой карты
    if (eye && opts.renderer) { spotRT = makeSpotRT(); spotRT2 = makeSpotRT(); spotRT3 = makeSpotRT(); spotShow = spotRT; spotPrev = spotRT2; spotSpare = spotRT3;
      spotMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: SPOTMAP_FS, depthTest: false, depthWrite: false,
        // свои копии входов — закрепляются на все четыре полосы перерисовки (разбор Codex: иначе полосы брали разные состояния пятен)
        uniforms: { uP: { value: Array.from({ length: 64 }, () => new THREE.Vector3()) }, uQ: { value: new Array(64).fill(0) }, uS: { value: new Array(64).fill(1) }, uN: { value: 0 }, uSpotSq: { value: 0 }, uSpotQ: { value: 0 },
          uIrr: { value: p.labSpotIrr }, uClk: { value: 0 }, uPenK: { value: p.labPenK }, uSpX: { value: Array.from({ length: 64 }, () => new THREE.Vector4()) }, uMW: { value: SMW }, uMH: { value: SMH } } });
      spotQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), spotMat); spotQuad.frustumCulled = false; spotScene = new THREE.Scene(); spotScene.add(spotQuad); }
    su.uSpotMap = { value: spotRT ? spotRT.texture : null }; su.uSpotMapB = { value: spotRT2 ? spotRT2.texture : null }; su.uSpotMix = { value: 1 }; su.uSpotMH = { value: SMH };
    let spotBand = -1;   // идущая перерисовка: номер полосы (0…3), −1 — нет
    // доля текущей карты в показе: время с её смены / промежуток между сменами (≤ 0,5 с)
    const spotMixNow = () => { if (!spotRT) return; const a = spotIn.get(spotPrev) || 0, b = spotIn.get(spotShow) || 0;
      su.uSpotMix.value = b > a ? Math.min(1, Math.max(0, (performance.now() - spotLag - a) / (b - a))) : 1; };
    const drawSpotMap = force => { if (!spotRT) return; const now = performance.now();
      const dS = spotLastT ? now - spotLastT : 0; if (dS > 0 && dS < 200) spotFrame += (dS - spotFrame) * 0.05; spotLastT = now;
      spotLag += Math.min(0.5 * Math.max(0, dS), (Math.min(600, Math.max(60, 1.25 * 4 * spotFrame)) - spotLag) * 0.05);   // рост — не быстрее половины кадра (время показа — только вперёд)
      // готовая карта ждёт, пока текущая не станет старше запаздывания (показываемое время не идёт назад)
      if (spotPend && !force && now - spotLag >= (spotIn.get(spotShow) || 0)) { spotPend = false; const t = spotSpare; spotSpare = spotPrev; spotPrev = spotShow; spotShow = t;
        su.uSpotMap.value = spotShow.texture; su.uSpotMapB.value = spotPrev.texture; }
      spotMixNow();
      if (force) { spotBand = -1; spotPend = false; }   // принудительно — заново, все четыре полосы
      if (spotBand < 0) { if (spotPend || !(spotDirty || force)) return; spotWall = now; spotDirty = false; spotBand = 0; spotIn.set(spotSpare, now);
        const U = spotMat.uniforms; for (let i = 0; i < 64; i++) { U.uP.value[i].copy(su.uP.value[i]); U.uQ.value[i] = su.uQ.value[i]; U.uS.value[i] = su.uS.value[i]; U.uSpX.value[i].copy(su.uSpX.value[i]); }
        U.uN.value = su.uN.value; U.uSpotSq.value = su.uSpotSq.value; U.uSpotQ.value = su.uSpotQ.value; U.uIrr.value = su.uIrr.value; U.uClk.value = su.uClk.value; U.uPenK.value = su.uPenK.value; }
      // рисуется в запасную (не участвует в смеси — разбор Codex: прежде рисовалась в прежнюю, из которой шла смена); последняя полоса — с уровнями
      // детализации, затем смена: запасная — показ, показ — прежняя, прежняя — запасная
      const R3s = opts.renderer, prev = R3s.getRenderTarget(), ac = R3s.autoClear, nb = force ? 4 : 1, tgt = spotSpare;
      for (let k = 0; k < nb && spotBand >= 0; k++) { const h = SMH / 4; tgt.viewport.set(0, spotBand * h, SMW, h); tgt.scissor.set(0, spotBand * h, SMW, h); tgt.scissorTest = true;
        tgt.texture.generateMipmaps = spotBand === 3; R3s.autoClear = false; R3s.setRenderTarget(tgt); R3s.render(spotScene, ortho1); R3s.setRenderTarget(prev);
        if (spotBand >= 3) { spotBand = -1; spotSwapT = now;
          if (force) { spotSpare = spotPrev; spotPrev = spotShow; spotShow = tgt; su.uSpotMap.value = spotShow.texture; su.uSpotMapB.value = spotPrev.texture; } else spotPend = true; }
        else spotBand++; }
      tgt.viewport.set(0, 0, SMW, SMH); tgt.scissor.set(0, 0, SMW, SMH); tgt.scissorTest = false; tgt.texture.generateMipmaps = true; R3s.autoClear = ac; R3s.setRenderTarget(prev);
      if (force) { spotIn.set(spotPrev, spotIn.get(spotShow) || now); su.uSpotMapB.value = spotShow.texture; su.uSpotMix.value = 1; } };   // принудительно — без смеси
    const ortho1 = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    su.uIrr = { value: p.labSpotIrr }; su.uClk = { value: 0 }; su.uSpX = { value: Array.from({ length: 64 }, () => new THREE.Vector4(1, 0, 0, 0)) };   // заполняет syncSpots()
    // путь жгута: по показателю спада поля над областью вспышки; уход — только по сценарию (opts.cmeEscape или параметр cmeEscape)
    const SF = (p.archMode === 1 || p.archMode === 3) && p.surface > 0 && P.length >= 2 ? surface(THREE, P, p, ph, seed) : null;   // самостоятельные полюса — только плазма; до decay: раскладка своя
    // пятна шейдера — по полюсам (после surface(): она меняет раскладку и число полюсов; потом — после каждого её шага)
    const dbg = { noSpots: false, noSurface: false }, tm = { surf: 0, tex: 0, plasma: 0 };   // стенд: выключатели и замер (панель «Компоненты»)
    const syncSpots = (PP, clk) => { PP = PP || P; for (let i = 0; i < 64; i++) { const Q = PP[i]; if (Q) su.uP.value[i].copy(Q.p); su.uQ.value[i] = Q ? Q.q : 0; su.uS.value[i] = Q && Q.sF != null ? Q.sF : 1; su.uB.value[i] = Q ? Q.bF || 0 : 0;
        if (eye && Q) { const pn = Q.p.clone().normalize(), e = (Q.e1 ? Q.e1.clone() : new THREE.Vector3(0, 1, 0).cross(pn)); e.addScaledVector(pn, -e.dot(pn));   // касательный — строго
          if (e.lengthSq() < 1e-8) basisOf(pn, e.set(0, 1, 0).cross(pn)); e.normalize(); su.uSpX.value[i].set(e.x, e.y, e.z, spotSeed(Q.uid != null ? Q.uid : i)); } }
      su.uN.value = dbg.noSpots ? 0 : Math.min(64, PP.length); if (su.uClk) su.uClk.value = clk != null ? clk : SF ? SF.clock : 0; spotDirty = true; };
    syncSpots();
    // ---- карта поверхности (стенд, этап 1): поле на поверхности из тех же зарядов, тени — из полюсов (площадь ∝ потоку), двигатель и
    // бюджет нагрева — в surface-state.js; единые часы: физические секунды = часы поверхности × 3600 (одна скорость показа — surfH)
    const SSL = labPhys && opts.SurfaceState ? opts.SurfaceState : null;
    let SS = null, smTex = null, tPhys = 0, smTexWall = -1e9;
    const smField = () => { const C = charges(P, p), nC = C.length / 4, e = (p.falloff + 1) / 2;
      SS.setField((x, y, z, out) => { fieldAt(x, y, z, C, nC, e, p.open, out); out[0] *= C.gUnit; out[1] *= C.gUnit; out[2] *= C.gUnit; });
      SS.setSpots(P.filter(Q => !Q.dead).map(Q => ({ x: Q.p.x, y: Q.p.y, z: Q.p.z, q: Q.q, sF: Q.sF != null ? Q.sF : 1 }))); };
    let STP = null, smSteps = -1;
    // показ между шагами (стенд; автор: «меня сейчас дергатня больше волнует»): поверхность шагает по 1 физ. ч — при 24 ч/с и 30 к/с шаг то
    // есть, то нет (4 кадра из 5), всё, что от неё зависит (корона), шло толчками ≈ 6 раз в секунду; перед каждым шагом — снимок полюсов,
    // показ — смесь прежнего и нового по доле накопленного до следующего шага времени (отставание — один шаг)
    const snap = new Map(), snapKey = (Q, i) => Q.uid != null ? Q.uid : 'i' + i;
    const frozenNow = () => p.labFreezeField > 0;   // заморозка поля: полюса стоят — показ без смеси, часы показа — часы поверхности (разбор Codex)
    let snapClock = 0, wasFrozen = false;   // часы снимка (часы поверхности перед шагом); заморозка в прошлом кадре
    const takeSnap = () => { snap.clear(); P.forEach((Q, i) => snap.set(snapKey(Q, i), { p: Q.p.clone(), q: Q.q, sF: Q.sF, bF: Q.bF, dep: Q.dep, dead: !!Q.dead })); snapClock = SF ? SF.clock : 0; };
    const beforeStep = () => { if (frozenNow()) return; takeSnap(); };
    // снятие заморозки: снимок — текущее состояние, часы снимка — текущие (показ продолжается с того же места, без отката)
    const freezeEdge = () => { const f = frozenNow(); if (wasFrozen && !f && STP) takeSnap(); wasFrozen = f; };
    const stepFrac = () => STP ? Math.min(1, Math.max(0, STP.backlog / 3600)) : 1;
    const star_clockView = () => !SF ? 0 : !STP || frozenNow() || !snap.size ? SF.clock : snapClock + stepFrac() * (SF.clock - snapClock);   // часы показа — между часами снимка и текущими
    const polesView = () => { if (!STP || !snap.size || frozenNow()) return P; const a = stepFrac(), lerp = (x, y) => x + (y - x) * a, opt = (x, y) => x != null && y != null ? lerp(x, y) : y,
        dEff = d => d > 0 ? d : p.poleDepth, seen = new Set();   // глубина — с подстановкой общей (разбор Codex: иначе первый шаг — скачком)
      const out = P.map((Q, i) => { const sn = snap.get(snapKey(Q, i)); seen.add(snapKey(Q, i));
        if (!sn) return Object.assign({}, Q, { q: Q.q * a, sF: (Q.sF != null ? Q.sF : 1) * a });   // родился на этом шаге — проявляется
        if (Q.dead && !sn.dead) return Object.assign({}, Q, { dead: false, p: sn.p.clone(), q: sn.q * (1 - a), sF: (sn.sF != null ? sn.sF : 1) * (1 - a), dep: sn.dep });   // ушёл — гаснет
        const pl = Q.p.length(); return Object.assign({}, Q, { p: sn.p.clone().lerp(Q.p, a).setLength(pl), q: lerp(sn.q, Q.q), sF: opt(sn.sF, Q.sF), bF: opt(sn.bF, Q.bF), dep: lerp(dEff(sn.dep), dEff(Q.dep)) }); });
      // ушедший полюс, чьё место в том же шаге занял новый (разбор Codex: 66 случаев за 3000 ч), — гаснет из снимка
      snap.forEach((sn, k) => { if (!seen.has(k) && !sn.dead && sn.q !== 0) out.push({ uid: k, p: sn.p.clone(), q: sn.q * (1 - a), sF: (sn.sF != null ? sn.sF : 1) * (1 - a), bF: (sn.bF || 0) * (1 - a), dep: sn.dep }); });
      return out; };
    if (SSL) { if (SF) SF.takeEvents();   // сбор событий — с первого шага
      SS = SSL.create({ R: ph.rKm * 1e5, LHtarget: p.labLH, carpetG: p.labCarpetG, vh: p.labVh * 1e5, tanTheta: p.labTanTh, steady: p.labSteady, tau: p.labTau, tauPulse: p.labTauPulse,
        etaH: p.labEtaH, PHI0, spotBs: p.spotBs, Bconc: p.spotBs });
      // тени — каждый физический шаг (дёшево: только диски), поле — раз в 6 ч; поле события — текущее, в его точке
      const smSpots = () => SS.setSpots(P.filter(Q => !Q.dead).map(Q => ({ x: Q.p.x, y: Q.p.y, z: Q.p.z, q: Q.q, sF: Q.sF != null ? Q.sF : 1 })));
      const fieldNow = () => { const C = charges(P, p), nC = C.length / 4; return (x, y, z, out) => { fieldAt(x, y, z, C, nC, 1.5, 0, out); out[0] *= C.gUnit; out[1] *= C.gUnit; out[2] *= C.gUnit; }; };
      STP = SSL.stepper({ SF, SS, onField: smField, onSpots: smSpots, fieldNow, beforeStep });
      smField(); SS.calibrate(); smTex = new THREE.DataTexture(SS.texture(), SS.W, SS.H, THREE.RGBAFormat, THREE.UnsignedByteType);
      smTex.wrapS = THREE.RepeatWrapping; smTex.wrapT = THREE.ClampToEdgeWrapping; smTex.magFilter = smTex.minFilter = THREE.LinearFilter; smTex.flipY = false; smTex.generateMipmaps = false; smTex.needsUpdate = true;
      su.uSMap.value = smTex; }
    const DI = P.length >= 2 ? decay(P, p) : null, rope = DI ? ropePath(DI, p, ph, opts.cmeEscape != null ? !!opts.cmeEscape : p.cmeEscape > 0, P[0].p.distanceTo(P[1].p)) : null;
    if (rope) { const m = P[0].p.clone().add(P[1].p).normalize(), ax = P[0].p.clone().sub(P[1].p).normalize(); ph.rope = rope; ph.frame = { m, ax, side: m.clone().cross(ax).normalize() }; }
    ph.labLOD = !!opts.labLOD;   // уровень детализации — только стенд
    // частицы в поле — на видеокарте, если есть WebGL2 и текстуры с плавающей точкой (стенд передаёт renderer); иначе — на процессоре
    const R3 = opts.renderer, useGpu = p.archMode === 3 && R3 && R3.capabilities && R3.capabilities.isWebGL2 && R3.extensions && R3.extensions.has('EXT_color_buffer_float');
    const PS = show.arches && p.archMode >= 1 ? (p.archMode === 3 ? (useGpu ? gpuPlasma(THREE, P, p, seed, ph, SF, R3) : freePlasma(THREE, P, p, seed, ph, SF)) : plasma(THREE, P, p, seed, ph, SF)) : null;
    const pu = { uPx: { value: 800 }, uR: { value: 1 }, uSize: { value: p.pSize }, uVis: { value: 1 }, uFlash: { value: 0 }, uGone: { value: 0 }, uBright: { value: p.pBright },
      uMode: { value: p.colorMode }, uLine: { value: p.lineMix }, uStar: { value: col.clone() } };
    if (PS) { const m = new THREE.ShaderMaterial({ vertexShader: PS.gpu ? GPU_VS : PART_VS, fragmentShader: PS.gpu ? GPU_FS : PART_FS, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false, uniforms: PS.gpu ? Object.assign({}, pu, PS.drawU) : pu, defines: PS.tr ? { STREAK: '' } : {} });
      const pts = PS.tr ? new THREE.LineSegments(PS.geo, m) : new THREE.Points(PS.geo, m); pts.frustumCulled = false; g.add(pts);
      if (PS.gpu && PS.field && p.fpField > 0) pts.visible = false; }   // плазма как среда — рисуется отдельным проходом (plasmaField), точки скрыты
    let lastTT = null, lastT = 0, perf = 0;
    const N = [p.ropeN, p.frontN, p.arcadeN].map(x => show.cme ? Math.max(0, Math.round(x)) : 0), cnt = N[0] + N[1] + N[2], D = new Float32Array(cnt * 4), rnd = mulberry(seed ^ 0x1234);
    let j = 0; N.forEach((k, kind) => { for (let i = 0; i < k; i++, j++) { D[j * 4] = kind; D[j * 4 + 1] = rnd(); D[j * 4 + 2] = rnd(); D[j * 4 + 3] = rnd(); } });
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cnt * 3), 3)); cg.setAttribute('aD', new THREE.BufferAttribute(D, 4));
    cg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 6);
    const P0 = P.length ? P[0].p.clone() : new THREE.Vector3(0.1, 1, 0).normalize(), P1 = P.length ? P[1].p.clone() : new THREE.Vector3(-0.1, 1, 0).normalize();
    const cu = { uT: { value: 99 }, uPx: { value: 800 }, uR: { value: 1 }, uA: { value: P0.clone() }, uB: { value: P1.clone() },
      uRopeH: { value: p.ropeH }, uRopeW: { value: p.ropeW }, uFrontR: { value: p.frontR }, uFrontB: { value: p.frontBright } };
    const cme = new THREE.Points(cg, new THREE.ShaderMaterial({ vertexShader: CME_VS, fragmentShader: CME_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: cu }));
    cme.frustumCulled = false; if (cnt && !PS) g.add(cme);   // прежний выброс (петля, фронт, аркада шейдером, по времени) — только у трубок; у плазмы — из её частиц
    const flareAt = P0.clone().add(P1).normalize();
    const S = {
      plasmaField: PS && PS.gpu && PS.field && p.fpField > 0 ? { render: (r, c, t) => PS.field.render(r, c, t, pu) } : null,
      group: g, params: p, flareAt, poles: P, lines: L.lines, rejected: L.rejected, cls: cp, show, surf, phys: ph, particles: PS ? PS.n : 0,
      perf: () => perf, plasma: () => PS ? PS.stats() : null, debugStrand: j => PS ? PS.debugStrand(j) : null, lod: () => PS ? PS.lodStats() : null, debugParticles: () => PS ? PS.debugParticles() : null, surface: () => SF ? SF.stats() : null, surfClock: () => SF ? SF.clock : 0, surfClockView: () => star_clockView(), polesView,
      debug(o) { Object.assign(dbg, o || {}); syncSpots(); drawSpotMap(true); return dbg; }, spotMap: () => spotRT, drawSpots: () => drawSpotMap(false), timing: () => ({ surf: tm.surf, tex: tm.tex, plasma: tm.plasma }), surfaceMap: () => SS ? Object.assign(SS.stats(), { tPhys, backlog: STP.backlog }) : null, surfaceState: () => SS, decay: DI, rope,
      // униформы — на лету (без пересборки): параметры поверхности, вида арок, выброса
      setLook(q) { Object.assign(p, q); su.uSMapK.value = p.labPlageK; su.uSMapP.value = p.labPulseK; su.uSMapView.value = p.labMapView;
        su.uExpo.value = expo0 * Math.pow(2, p.labExpEV || 0); su.uFacK.value = p.labFacK; su.uPenK.value = p.labPenK; su.uCurve.value = p.labCurve; su.uIrr.value = p.labSpotIrr; spotDirty = true;
        Object.assign(su.uGran, { value: p.granScale }); su.uGranC.value = p.granContrast; su.uSuper.value = p.superScale; su.uLimbA.value = p.limbA; su.uLimbB.value = p.limbB;
        su.uLimbRed.value = p.limbRed; spotU(); su.uBirth.value = p.birthBright; su.uRim.value = p.rim; su.uRimP.value = p.rimPow; su.uGP.value = p.granPhys; su.uGF.value = ph.rKm / Math.max(1, p.granKm); su.uGRms.value = p.granRms; su.uGTau.value = p.granTau; su.uPlage.value = p.plage; su.uPlageW.value = p.plageWidth; su.uRib.value = p.ribbons;
        su.uCol.value.copy(col).multiplyScalar(p.bright); au.uCol.value.copy(col).multiplyScalar(p.bright).lerp(new THREE.Color(1, 0.55, 0.35), 0.3);
        au.uSway.value = p.sway; au.uBright.value = p.archBright; au.uFlowS.value = p.flowSpeed; au.uFlowF.value = p.flowFreq;
        cu.uRopeH.value = p.ropeH; cu.uRopeW.value = p.ropeW; cu.uFrontR.value = p.frontR; cu.uFrontB.value = p.frontBright;
        pu.uSize.value = p.pSize; pu.uBright.value = p.pBright; pu.uMode.value = p.colorMode; pu.uLine.value = p.lineMix; },
      // кадр: t — секунды цикла вспышки, tt — общие часы (гранулы, сгустки), px — пикселей на единицу тангенса поля зрения,
      // rScale — размер звезды в единицах сцены (точки выброса — в долях радиуса), vis — видимость 0…1
      update(t, tt, px, rScale, vis, view) {
        if (PS && view) PS.setView(view.cam, px);   // камера в системе звезды — для уровня детализации
        const f = show.flares ? phase(t, p) : { flash: 0, lift: 0, gone: 0 };
        su.uT.value = tt; su.uFlash.value = f.flash; su.uDim.value = PS && show.cme ? f.gone * p.dimming : 0;
        au.uT.value = tt; au.uFlash.value = f.flash; au.uA.value = vis; au.uLift.value = f.lift; au.uGone.value = f.gone;
        cu.uT.value = t; cu.uR.value = rScale; cu.uPx.value = px;
        // плазма и поверхность: шаг по часам симуляции tt; новый цикл вспышки — путь жгута по текущему полю и якорям
        const dtAll = lastTT == null ? 0 : Math.min(2, Math.max(0, tt - lastTT)), dt = Math.min(0.25, dtAll); lastTT = tt;   // время не теряется при низкой частоте кадров
        if (SF && t < lastT && P.length >= 2) {
          S.decay = decay(P, p); S.rope = ropePath(S.decay, p, ph, opts.cmeEscape != null ? !!opts.cmeEscape : p.cmeEscape > 0, P[0].p.distanceTo(P[1].p)); ph.rope = S.rope;
        }
        lastT = t;
        // поверхность — на всё прошедшее время (подшаги внутри), и без арок тоже; базис выброса — вслед за якорями
        const t0 = performance.now();
        // стенд: заморозка поля — полюса и заряды стоят, часы и карта идут; выключатель «жизнь поверхности» (панель «Компоненты») — всё стоит
        const frozen = SS && p.labFreezeField > 0, surfOn = !dbg.noSurface;
        if (surfOn && SF && dtAll > 0 && (SS ? STP.advance(dtAll * p.surfH * 3600, frozen) > 0 : SF.step(dtAll))) { syncSpots();
          if (ph.frame) { const ax = P[0].p.clone().sub(P[1].p); if (ax.lengthSq() > 1e-10) { ph.frame.m.copy(P[0].p).add(P[1].p).normalize(); ph.frame.ax.copy(ax.normalize()); ph.frame.side.copy(ph.frame.m).cross(ph.frame.ax).normalize(); } } }
        // карта поверхности: физические секунды шага, события уничтожения потока, поле — не чаще раза в 0,5 с, изображение — в 0,25 с
        const t1 = performance.now(); if (opts.labLOD) tm.surf = tm.surf * 0.9 + (t1 - t0) * 0.1;
        if (SS && surfOn) { if (!SF) STP.advance(dtAll * p.surfH * 3600, frozen); tPhys = STP.t; const now = performance.now();
          // показ между шагами (автор: «давай и фотосферу так же»): пятна — по смеси двух последних шагов каждый кадр, пока время идёт;
          // карта поверхности (факелы) — на каждом шаге (прежде — не чаще раза в 0,25 с)
          if (SF && dtAll > 0 && STP.steps !== smSteps) { smSteps = STP.steps; SS.texture(); smTex.needsUpdate = true; smTexWall = now; }
          freezeEdge();
          if (SF && dtAll > 0) { let pv = polesView(); if (pv !== P) { pv = pv.filter(Q => !Q.dead && Q.q !== 0); if (pv.length > 64) pv = pv.sort((a, b) => Math.abs(b.q) - Math.abs(a.q)).slice(0, 64); }   // гаснущие — тоже (разбор Codex)
            syncSpots(pv, star_clockView()); } }
        const t2 = performance.now(); if (opts.labLOD) tm.tex = tm.tex * 0.9 + (t2 - t1) * 0.1;
        if (SS) su.uDim.value = 0;   // опустошение короны после выброса не затемняет фотосферу
        if (!opts.labDrawSpots) drawSpotMap(false);   // карта теней — если пятна изменились (не чаще 4 раз в секунду); стенд рисует сам — под таймером
        // вращение звезды (стенд, labProtD): поворот всей группы вокруг Y по часам поверхности; между часовыми шагами — по доле накопленного
        // времени (плавно); физика — в системе звезды. Игра: labProtD = 0 — не трогается
        if (SF && p.labProtD > 0) g.rotation.y = rotAngle(SF.clock + (SS && !(p.labFreezeField > 0) ? Math.min(1, STP.backlog / 3600) : 0), p.labProtD);
        // плазма — шагом не больше 0,25 с
        if (PS && vis > 0.01 && dt > 0) { PS.step(dt, t, show.flares, tt); perf = perf * 0.9 + (performance.now() - t0) * 0.1; } else if (PS && PS.look) PS.look();
        if (opts.labLOD) { const t3 = performance.now(); tm.plasma = tm.plasma * 0.9 + (PS ? t3 - t2 : 0) * 0.1; }   // частицы — отдельно от поверхности
        // уровень детализации — каждый кадр, и на паузе: отбор, трассы новых и проявление — по реальному времени, течение частиц — по часам модели
        if (PS && view && view.realDt != null) PS.lodStep(vis > 0.01 ? dt : 0, view.realDt);
        Object.assign(pu.uPx, { value: px }); pu.uR.value = rScale; pu.uVis.value = vis; pu.uFlash.value = f.flash; pu.uGone.value = f.gone * (S.rope && S.rope.esc ? 1 : 0.3);   // запертое — корона над областью частично остаётся
        return f;
      },
      dispose() { g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); if (PS && PS.dispose) PS.dispose(); if (smTex) smTex.dispose(); if (photTex) photTex.dispose(); if (spotRT) { spotRT.dispose(); spotRT2.dispose(); spotRT3.dispose(); spotMat.dispose(); spotQuad.geometry.dispose(); } }
    };
    return S;
  }
  // ---- вспышка сверхновой (автор 14.10: «а ещё вспышка сверхновой — притащить в игру»). Показ сжат во времени (цикл — секунды):
  // звезда пульсирует и ярчает, ядро коллапсирует (звезда схлопывается в точку), ударная волна выходит на поверхность тонкой
  // яркой оболочкой, затем расширяется выброс — оболочка с «пальцами» неустойчивости Рэлея — Тейлора; волокна светятся по
  // элементам (водород — красный, кислород — сине-зелёный, сера — тёмно-красный, железо внутри — бело-голубое) и остывают; в центре —
  // нейтронная звезда со струями пульсарного ветра. Частицы, без мягкого ореола; масштаб — радиусы исходной звезды
  const SN_DEFAULTS = { snCycle: 30, collapseAt: 3, ejectaR: 9, ejectaTau: 7, fingers: 0.38, fingerScale: 7, shockR: 14, ejectaN: 26000, shockN: 7000, pulsarN: 1800,
    snBright: 1.2, pulsar: 1 };
  const SN_VS = `#include <common>
    #include <logdepthbuf_pars_vertex>
    attribute vec4 aD; attribute vec3 aDir; uniform float uT, uPx, uR, uCol, uEjR, uEjTau, uFing, uFingS, uShockR, uBright, uPulsar;
    varying float vA; varying vec3 vC;
    float sm(float a, float b, float x){ return clamp((x - a) / (b - a), 0.0, 1.0); }
    float fing(vec3 d, float s){ return sin(d.x * s + 1.3) * sin(d.y * s * 1.17 + 0.4) * sin(d.z * s * 0.93 + 2.1) + 0.5 * sin(d.x * s * 2.3 + d.z * s * 1.9); }
    void main(){
      float kind = aD.x, f = aD.y, el = aD.z, rn = aD.w, t = uT - uCol; vec3 d = normalize(aDir); vec3 P = vec3(0.0); float a = 0.0, sz = 1.0;
      if (kind < 0.5) {                                                       // выброс: оболочка с пальцами, остывает
        float R = uEjR * (1.0 - exp(-max(t, 0.0) / uEjTau)), fg = fing(d, uFingS), r = R * f * (1.0 + uFing * fg * f);
        P = d * r;
        float age = max(t, 0.0), hot = exp(-age / 2.5);
        vec3 elc = el < 0.4 ? vec3(1.0, 0.28, 0.32) : el < 0.65 ? vec3(0.35, 1.0, 0.85) : el < 0.85 ? vec3(0.85, 0.18, 0.22) : vec3(0.75, 0.85, 1.0);
        vC = mix(elc, vec3(0.95, 0.97, 1.0), hot * 0.8) * uBright;
        a = 2.6 * sm(0.0, 0.25, t) * (0.2 + 0.8 * f * f * f) * (0.45 + 0.55 * smoothstep(-0.2, 0.8, fg)) * (0.45 + 0.55 * exp(-age / 20.0)); sz = 2.0 + 2.0 * f;
      } else if (kind < 1.5) {                                                // ударная волна: тонкая оболочка выходит наружу и гаснет
        float r = uShockR * sm(0.0, 3.0, t) * (0.97 + 0.03 * rn);
        P = d * max(r, 1.0);
        a = sm(0.0, 0.1, t) * (1.0 - sm(0.3, 3.0, t)) * 1.6; vC = vec3(0.85, 0.92, 1.0) * uBright; sz = 1.4;
      } else {                                                                // нейтронная звезда и струи пульсарного ветра
        float jet = step(0.5, f), side = el < 0.5 ? -1.0 : 1.0, len = 0.5 + 2.5 * rn;
        vec3 axis = normalize(vec3(0.3, 1.0, 0.15));
        P = jet > 0.5 ? axis * side * len * sm(2.0, 6.0, t) + d * 0.06 * len : d * 0.04 * rn;
        a = sm(1.0, 3.0, t) * uPulsar * (jet > 0.5 ? (1.0 - len / 3.2) * (0.6 + 0.4 * sin(uT * 18.0 + rn * 40.0)) : 1.0);
        vC = vec3(0.6, 0.8, 1.0) * 1.3; sz = jet > 0.5 ? 0.9 : 1.6;
      }
      vA = t < 0.0 ? 0.0 : a; vec4 mv = modelViewMatrix * vec4(P, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp(sz * 0.02 * uR * uPx / -mv.z, 1.6, 7.0);
      #include <logdepthbuf_vertex>
    }`;
  // стадии показа: до коллапса — пульсация и рост яркости, коллапс — звезда схлопывается; boost — яркость поверхности, flash — для блика
  function snPhase(t, q) {
    const c = q.collapseAt, pre = Math.min(1, t / c);
    if (t < c) return { starScale: 1 + 0.025 * Math.sin(t * 9) * pre + 0.04 * pre * pre, boost: 1 + 0.8 * pre * pre, flash: 0 };
    const k = t - c;
    return { starScale: Math.max(0, 1 - k / 0.35), boost: 1 + 4 * Math.exp(-k / 0.2), flash: k < 0.05 ? k / 0.05 : Math.exp(-(k - 0.05) / 1.2) };
  }
  function createSupernova(THREE, opts) {
    const q = Object.assign({}, SN_DEFAULTS, opts.params || {}), rnd = mulberry((opts.seed | 0) ^ 0x7f4a7c15);
    const N = [q.ejectaN, q.shockN, q.pulsarN].map(x => Math.max(0, Math.round(x))), cnt = N[0] + N[1] + N[2];
    const D = new Float32Array(cnt * 4), DIR = new Float32Array(cnt * 3); let j = 0;
    const sph = () => { const z = rnd() * 2 - 1, a = rnd() * 2 * Math.PI, r = Math.sqrt(1 - z * z); return [r * Math.cos(a), z, r * Math.sin(a)]; };
    // выброс — волокнами: у волокна своё направление и элемент; частицы — вдоль радиуса, гуще к кончику (как у остатков Кассиопеи A)
    const nFil = Math.max(1, Math.round(N[0] / 22)), fil = Array.from({ length: nFil }, () => ({ d: sph(), el: rnd(), w: 0.006 + 0.02 * rnd() }));
    N.forEach((k, kind) => { for (let i = 0; i < k; i++, j++) {
      let d = sph(), f = Math.sqrt(rnd()), el = rnd();
      if (kind === 0) { const F = fil[i % nFil], e = sph(); d = [F.d[0] + e[0] * F.w, F.d[1] + e[1] * F.w, F.d[2] + e[2] * F.w]; f = 0.7 + 0.3 * Math.pow(rnd(), 0.55); el = F.el; }   // оболочка: короткие волокна у края, внутри пусто
      DIR[j * 3] = d[0]; DIR[j * 3 + 1] = d[1]; DIR[j * 3 + 2] = d[2];
      D[j * 4] = kind; D[j * 4 + 1] = f; D[j * 4 + 2] = el; D[j * 4 + 3] = rnd(); } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cnt * 3), 3));
    geo.setAttribute('aD', new THREE.BufferAttribute(D, 4)); geo.setAttribute('aDir', new THREE.BufferAttribute(DIR, 3)); geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    const u = { uT: { value: 0 }, uPx: { value: 800 }, uR: { value: 1 }, uCol: { value: q.collapseAt }, uEjR: { value: q.ejectaR }, uEjTau: { value: q.ejectaTau }, uFing: { value: q.fingers },
      uFingS: { value: q.fingerScale }, uShockR: { value: q.shockR }, uBright: { value: q.snBright }, uPulsar: { value: q.pulsar } };
    const pts = new THREE.Points(geo, new THREE.ShaderMaterial({ vertexShader: SN_VS, fragmentShader: CME_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: u }));
    pts.frustumCulled = false;
    const g = new THREE.Group(); g.add(pts);
    return {
      group: g, params: q,
      setLook(o) { Object.assign(q, o); u.uCol.value = q.collapseAt; u.uEjR.value = q.ejectaR; u.uEjTau.value = q.ejectaTau; u.uFing.value = q.fingers; u.uFingS.value = q.fingerScale;
        u.uShockR.value = q.shockR; u.uBright.value = q.snBright; u.uPulsar.value = q.pulsar; },
      update(t, px, rScale) { u.uT.value = t; u.uPx.value = px; u.uR.value = rScale; return snPhase(t, q); },
      dispose() { geo.dispose(); pts.material.dispose(); }
    };
  }
  const SN_GEOM = ['ejectaN', 'shockN', 'pulsarN'];
  const api = { R_SUN_KM, DEFAULTS, GEOM, radiusKm, create, phase, classOf, classParams, teffColor, planckRGB, spotSeed, spotOutline, SPOT_W, bgVel, rotAngle, scaleHeight, SN_DEFAULTS, SN_GEOM, createSupernova, snPhase, charges, fieldAt, poles, surface, PHI0: 5e21 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.M31StarModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
