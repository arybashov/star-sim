// М31 · стенд модели звезды (PROTOTYPE/star-lab): правка общей модели slice/star-model.js — той же, что в игре (space3d.js).
// Звезда любого класса каталога, арки, вспышка и выброс (выброс — опция), режим «Сверхновая». Параметры — ползунками; то, что
// меняет геометрию (полюса, линии, число частиц), — пересборкой. Состояние — в localStorage; «Скопировать параметры» — JSON
// для переноса в DEFAULTS модуля
(() => {
  'use strict';
  const SM = window.M31StarModel, STARS = (globalThis.M31_STARS || []).filter(s => s.sp && s.sp !== '?');
  const LS = 'm31.starlab.v1', $ = id => document.getElementById(id);
  // готовые примеры: [имя, спектр, радиус R☉, масса M☉] — для красных карликов по обзору (Pineda 2021 и др.), остальные — ориентиры;
  // без радиуса и массы — по классу
  // Солнце: нагрев короны ≈ 2·10²⁸ эрг/с — спокойное Солнце ≈ 3·10⁵ эрг/см²/с (Withbroe & Noyes 1977) × площадь 6·10²² см² (автор: «надо от неё плясать»;
  // при прежних 3·10²⁷ петли ковра — 0,4 МК, тёмный диск)
  // движение пятен Солнца — настоящее (автор: «движение пятен надо вернуть настоящее — как было — не надо такого плавания»): вращение — сидерический
  // период экватора 25,38 сут, дифференциальное ΔΩ = 2,40°/сут·sin²φ = 0,0418 рад/сут (Snodgrass & Ulrich 1990; член sin⁴φ опущен), меридиональное
  // течение к полюсам ≈ 15 м/с (Hathaway & Rightmire 2010); условного вихревого течения нет
  // полюса Солнца — только активные области: поток пары 10²¹–3·10²² Мкс (q 0,2–6), наклон N(Φ) ∝ Φ^−2 (появление активных областей —
  // Harvey & Zwaan 1993); мельче — эфемерные области, их изображает ковёр (прежде 4·10²⁰–7,5·10²¹ Мкс, наклон −2,7: площадки ≈ 0,16 % поверхности)
  // активные области Солнца (автор: «давай активные области», «давай активные области доводи»): диполь — 7 Гс (полярное поле Солнца ≈ 5–10 Гс;
  // 25 Гс — значение Барнарда — грело спокойную поверхность сильнее ковра), полюса мельче — 0,015 R (пик поля площадок ≈ 450 Гс; прежде 0,025 R (у M-карликов 0,06: на Солнце поле расплывалось до 33 Гс,
  // в активной области 100–300 Гс), ковёр — 10 Гс беззнакового поля (среднее спокойного Солнца по HMI ≈ 10 Гс; доля концентраций спокойной поверхности < 1 %; 500 Гс — 17 %: спокойная
  // поверхность грелась почти как активная область)
  const PRESETS = [['Солнце', 'G2V', 1, 1, { labLH: 2e28, poleDepth: 0.015, labCarpetG: 10, dipoleG: 7, pairQLo: 0.5, pairQHi: 10, fluxSlope: 2, labProtD: 25.38, labDOm: 0.0418, labVmer: 15, labPlageF: 0.3, labPlageD: 0.02, labXNu: 1, cycle: 60, cmeEscape: 1 }], ['Барнард', 'M4V', 0.187, 0.162, { dipoleG: 25, labUBVRI: [12.497, 11.24, 9.511, 8.298, 6.741], labProtD: 145 }], ['Проксима', 'M5.5Ve', 0.154, 0.122, { dipoleG: 135, dipoleTilt: 51, labUBVRI: [14.21, 12.95, 11.13, 9.45, 7.41], labTeff: 3050, labProtD: 83.1 }], ['ε Индейца', 'K5V', 0.71, 0.76],
    ['Лакайль 9352', 'M1V', 0.474, 0.479], ['Росс 128', 'M4V', 0.198, 0.176], ['Gl 338', 'M0V'], ['Сириус', 'A1V', 1.71, 2.06], ['Арктур', 'K1.5III', 25.4, 1.08],
    ['Бетельгейзе', 'M2Iab', 760, 17], ['Ригель', 'B8Ia', 79, 21], ['Белый карлик', 'DA2']];
  // ползунки: [ключ, подпись, мин, макс, шаг]
  const STAR_GROUPS = [
    // этапы 0–1 плана (DOC «План работ — газодинамика короны и поверхность звезды»): поверхность — запас энергии и источник нагрева короны
    ['Поверхность — физика (этапы 0–1)', [['labFreezeField', 'заморозить поле (полюса стоят, часы идут)', 0, 1, 1], ['labLH', 'мощность нагрева короны (цель), эрг/с (Солнце ≈ 2·10²⁸)', 3e26, 1e29, 1e26],
      ['labCarpetG', 'магнитный ковёр спокойной поверхности, Гс', 0, 1000, 10], ['labVh', 'перемешивание оснований, км/с', 0.05, 1, 0.01], ['labTanTh', 'наклон поля tgθ', 0.02, 0.5, 0.01],
      ['labSteady', 'доля выпуска сразу', 0, 1, 0.05], ['labTau', 'утечка запаса, с', 100, 20000, 100], ['labTauPulse', 'импульс после уничтожения потока, с', 10, 1000, 10],
      ['labEtaH', 'доля выпуска в корону', 0, 1, 0.05], ['labPlageK', 'факелы из карты — яркость', 0, 2, 0.05], ['labPulseK', 'импульсы из карты — яркость', 0, 3, 0.05], ['labMapView', 'показать карту нагрева (проверка)', 0, 1, 1]]],
    // край короны в 17,1 нм (автор: «по порядку все» — шаг 1): поглощение холодным веществом хромосферы и спикул (Alissandrakis & Valentino 2019)
    ['Корона — край в 17,1 нм', [['labChE', 'плотная хромосфера: край в 17,1 нм выше видимого, тыс. км у Солнца (AIA 171 — 3,7–4,2; 0 — без неё)', 0, 10, 0.1],
      ['labChH', 'плотная хромосфера: шкала высот, тыс. км у Солнца (≈ 1; у звезды — × g☉/g★)', 0.2, 4, 0.05],
      ['labChSE', 'лес спикул: высота, где он непрозрачен по касательной, тыс. км у Солнца (подгонка по SDO — 12; 0 — без него)', 0, 20, 0.5],
      ['labChSH', 'лес спикул: шкала высот, тыс. км у Солнца (подгонка — 5)', 0.5, 10, 0.1],
      ['labXNu', 'протяжённая спокойная корона: плотность × RTV (Солнце 1 — по снимку SDO; по умолчанию 1,5)', 0.3, 3, 0.05],
      ['labFanF', 'веера петель активных областей (≈ 1 МК на краях областей): доля (0 — без вееров, как решил автор; при 0,5 — засветка)', 0, 2, 0.05],
      ['labCarpBlur', 'магнитный ковёр: размытие света вдоль петель, доля длины петли (0,17 — по виду; 0,5 — как на SDO, но сеть бледнее)', 0, 1, 0.01]]],
    // выброс частицами (автор: «давай как в ультрафиолете — нити и брызги»; ориентиры — снимки AIA 31.08.2012 и 07.06.2011)
    ['Выброс — нити и брызги (17,1 нм)', [['labCmeTau', 'нити: средняя оптическая толщина волокна в 17,1 нм — тёмность (≈ 1–3 по моделям; 0 — не поглощают)', 0, 5, 0.1],
      ['labCmeE', 'нити: свечение краёв — переходный слой (доля по виду; 0,1 — на диске тёмные, над краем видны; 0 — только тёмные)', 0, 1, 0.01],
      ['labCmeFall', 'доля вещества, которое отрывается: стекает по ногам и падает брызгами (у запертого — всё)', 0, 1, 0.05],
      ['labCmeN', 'частиц — подробность рисунка (масса та же)', 1000, 30000, 500]]],
    ['Плавание пятен', [['labProtD', 'вращение звезды: период, сут (0 — стоит; Проксима 83,1)', 0, 200, 0.1], ['labOmEq', 'экватор быстрее системы, рад/сут', -0.02, 0.02, 0.001],
      ['labDOm', 'дифференциальное вращение ΔΩ экв.−полюс, рад/сут (Солнце 0,042; у M-карликов не измерено)', -0.06, 0.06, 0.001], ['labVmer', 'меридиональное течение к полюсам, м/с (не измерено)', -20, 20, 0.5],
      ['labDspot', 'случайное блуждание пятен, км²/с (не измерено)', 0, 10, 0.1], ['labOuH', 'блуждание: время памяти скорости, ч', 2, 96, 1], ['pairRigid', 'пара после расхождения — целиком', 0, 1, 1]]],
    ['Фотосфера — как видит глаз', [['labEye', 'фотосфера по физике: PHOENIX, фотометрия, камера (0 — прежняя)', 0, 1, 1], ['labExpEV', 'экспозиция камеры, ступени', -4, 4, 0.1], ['labCurve', 'кривая камеры: 1 — как плёнка (пересвет через жёлтый), 0 — цвет звезды без сдвига', 0, 1, 1],
      ['labSpotDT', 'тень холоднее фотосферы, K', 100, 700, 10], ['labSpotIrr', 'тени: неровность края (СКО радиуса; 0 — круг)', 0, 0.3, 0.01], ['labPenK', 'полутень: радиус в радиусах тени (1 — нет)', 1, 2.5, 0.05], ['labPenDT', 'полутень холоднее, K', 0, 400, 10],
      ['labFacK', 'факелы: сила (центр темнее, край светлее)', 0, 5, 0.1]]],
    ['Поверхность', [['granPhys', 'грануляция по расчётам M-карликов (0 — прежняя)', 0, 1, 1], ['granKm', 'гранула (по расчётам), км', 30, 600, 5], ['granRms', 'контраст гранул (СКО)', 0, 0.06, 0.001], ['granTau', 'смена рисунка гранул, с показа', 0.5, 30, 0.5], ['granScale', 'гранулы — частота', 2, 220, 1], ['granContrast', 'контраст гранул', 0, 0.8, 0.01], ['superScale', 'супергранулы — частота', 1, 40, 0.5],
      ['limbA', 'потемнение к краю, a', 0, 1, 0.01], ['limbB', 'потемнение к краю, b', 0, 0.6, 0.01], ['limbRed', 'покраснение к краю', 0.1, 2, 0.01],
      ['rim', 'кромка по Френелю — сила', 0, 3, 0.05], ['rimPow', 'кромка — резкость', 0.5, 16, 0.5], ['spotSize', 'пятна — размер', 0.002, 0.08, 0.001], ['spotGrow', 'пятна — рост с силой', 0, 0.05, 0.001], ['plage', 'факелы — яркость', 0, 1.5, 0.01],
      ['plageWidth', 'факелы — ширина', 0.001, 0.03, 0.0005], ['bright', 'яркость', 0.3, 2.5, 0.01], ['satBoost', 'насыщенность', 0, 0.6, 0.01]]],
    ['Области и полюса', [['labPlageF', 'активные области в короне: доля потока в пятне (Солнце ≈ 0,3; 1 — весь поток в пятне)', 0.05, 1, 0.05],
      ['labPlageD', 'активные области в короне: глубина источника площадки, R★ (Солнце 0,03; 0 — без площадки)', 0, 0.08, 0.005], ['regions', 'областей', 0, 24, 1], ['limbShare', 'доля у края диска', 0, 1, 0.01], ['sepMin', 'разнос полюсов — мин, R★', 0.02, 0.6, 0.005],
      ['sepMax', 'разнос полюсов — макс, R★', 0.02, 0.6, 0.005], ['qMin', 'сила — мин', 0.1, 2.5, 0.01], ['qMax', 'сила — макс', 0.1, 2.5, 0.01],
      ['flareSep', 'область вспышки — разнос', 0.05, 0.6, 0.005], ['flareQ', 'область вспышки — сила', 0.2, 3, 0.01], ['poleDepth', 'глубина источников, R★ (Солнце 0,025)', 0.005, 0.3, 0.005],
      ['rSS', 'поверхность источника, R★ (дальше поле открыто)', 1.5, 5, 0.1]]],
    ['Поверхность (полюса)', [['surface', 'полюса самостоятельные: 0 — нет, 1 — да', 0, 1, 1], ['surfH', 'часов поверхности на 1 с показа', 0.5, 96, 0.5],
      ['sepKms', 'расхождение новой пары: пик, км/с', 0, 2, 0.01], ['emergeH', 'всплытие потока, ч', 1, 120, 1],
      ['sepStopH', 'расхождение до, ч', 6, 200, 1], ['lifeDays', 'срок жизни пары q ≥ 1, сут (∝ потоку, распад линейный)', 1, 400, 1],
      ['spreadKm2s', 'расплывание распадающихся областей, км²/с (Солнце 250–600; 0 — нет)', 0, 1000, 10], ['spreadDMax', 'расплывание: предел глубины источника, R★', 0.1, 0.8, 0.01], ['birthH', 'новая пара — раз в, ч', 2, 1000, 1],
      ['clusterFrac', 'рождения рядом с полюсами — доля', 0, 1, 0.01], ['polesTarget', 'полюсов держать', 2, 64, 2], ['fluxSlope', 'рождения пар — наклон N(Φ) ∝ Φ^−s', 1.2, 3.5, 0.05], ['spotBs', 'поле тени пятна, Гс (площадь = Φ/B)', 1500, 6000, 100], ['pairQLo', 'поток пар — мин., |q| (Солнце 0,5)', 0.01, 1, 0.01], ['pairQHi', 'поток пар — макс., |q| (Солнце 10)', 0.3, 12, 0.05], ['latBias', 'перевес к экватору (0 — равномерно)', 0, 6, 0.1], ['cancRate', 'уничтожение потока, доля в час', 0, 0.05, 0.0005],
      ['heatC', 'нагрев от уничтожения, эрг/(см³·с)', 0, 0.3, 0.005], ['heatE', 'нагрев от всплытия, эрг/(см³·с)', 0, 0.1, 0.001], ['birthBright', 'яркость рождения (точки, факел)', 0, 4, 0.05]]],
    ['Вспышка и выброс', [['cycle', 'цикл события, с показа (Солнце 60 ≈ 3 ч; поверхность на время события стоит)', 6, 120, 0.5], ['flashDecay', 'спад вспышки, с', 0.3, 5, 0.05], ['ribbons', 'ленты — яркость', 0, 6, 0.05],
      ['dipoleG', 'диполь звезды, Гс (запирает выброс)', 0, 1000, 5], ['dipoleTilt', 'диполь — наклон к оси вращения, °', 0, 90, 1], ['ncr', 'срыв: порог показателя спада', 0.5, 3, 0.05], ['ropeDrive', 'разгон жгута, в g', 0, 10, 0.1],
      ['slowKms', 'медленный подъём, км/с', 1, 150, 1], ['cmeEscape', 'уходящий выброс (сценарий): 0 — нет, 1 — да', 0, 1, 1], ['dimming', 'потемнение после выброса', 0, 0.8, 0.01],
      ['ropeW', 'жгут — раздув', 0, 10, 0.1], ['ropeH', 'трубки: петля — подъём, R★', 0.1, 3, 0.01], ['frontR', 'трубки: фронт — радиус, R★', 0.1, 3, 0.01],
      ['frontBright', 'фронт — яркость', 0.2, 3, 0.01], ['ropeN', 'петля — частиц', 0, 20000, 100], ['frontN', 'фронт — частиц', 0, 30000, 100], ['arcadeN', 'аркада — частиц', 0, 10000, 100]]]];
  const SN_GROUPS = [['Сверхновая', [['snCycle', 'цикл, с', 8, 80, 1], ['collapseAt', 'коллапс на, с', 0.5, 10, 0.1], ['ejectaR', 'выброс — радиус, R★', 2, 40, 0.5],
    ['ejectaTau', 'выброс — торможение, с', 1, 30, 0.5], ['fingers', 'пальцы Рэлея — Тейлора', 0, 1, 0.01], ['fingerScale', 'пальцы — частота', 1, 24, 0.5],
    ['shockR', 'ударная волна — радиус, R★', 2, 60, 0.5], ['snBright', 'яркость', 0.2, 3, 0.01], ['pulsar', 'пульсар', 0, 1, 0.01],
    ['ejectaN', 'выброс — частиц', 0, 80000, 500], ['shockN', 'волна — частиц', 0, 30000, 500], ['pulsarN', 'пульсар — частиц', 0, 8000, 100]]]];

  // ---- состояние
  // физика по литературе: плазма частицами по нитям поля 1/r² (погружённые заряды), поверхность источника 2,5 R★, слабый фон
  // открытого поля, полюса дрейфуют, как в сцене автора (DOC «Вспышки…», «Сравнение с литературой»)
  const PHYS = { archMode: 3, falloff: 2, open: 0, rSS: 2.5, surface: 1, pTrail: 0, pSize: 0.008, pBright: 2.5, pN: 30000, heat: 0.2, dipoleG: 25,
    bright: 0.6, rim: 0, rimPow: 4, granPhys: 1, labPhysics: 1, spreadKm2s: 250, labEye: 1, pairRigid: 1, driftKms: 0, labChH: 1, labChE: 4, labChSH: 5, labChSE: 12, labPlageF: 1, labPlageD: 0, labXNu: 1.5, labFanF: 0, labCarpBlur: 0.17, labCmeTau: 2, labCmeE: 0.1, labCmeFall: 0.5, labCmeN: 8000 };   // диполь 25 Гс — Барнард: продольное поле 6,9 Гс скв. (Donati et al. 2023, SPIRou) → полюс ≈ 20–25 Гс; нагрев 0,2 — средняя T короны ≈ 1,9 МК (Барнард: L_X ≈ 10²⁶ → T̄ ≈ 1,8 МК, Johnstone & Güdel 2015); точки без хвостов (автор: хвосты портят картину)   // open 0 — суммарный поток звезды нулевой (полюса уничтожают друг друга)
  const st = Object.assign({ mode: 'star', sp: 'M4V', comp: 0, name: 'Барнард', R: 0.187, M: 0.162, seed: 101, star: {}, sn: {}, arches: true, flares: true, cme: true, earth: false, speed: 1, glow: true, glowK: 0.9, glowT: 0.95, glowR: 0.5 },
    (() => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { return {}; } })());
  if ((st.hou | 0) < 9) { delete st.star.poleDrift; delete st.star.surfH; delete st.star.corrH; st.star = Object.assign({}, st.star, PHYS); st.hou = 9; }   // один раз: плазма, самостоятельные полюса, 1 с = сутки
  // сценарный цикл вспышки и выброса на якорях — старая механика; при самостоятельных полюсах выключен (вспышки — потом из движения полюсов)
  if ((st.hou | 0) < 10) { st.flares = false; st.cme = false; st.hou = 10; }
  if ((st.hou | 0) < 11) { for (const k of Object.keys(st.star)) if (k.startsWith('carpet')) delete st.star[k]; st.hou = 11; }   // ковёр снят (автор: «мы его не видим»); мелкие полюса — уровнем детализации
  if ((st.hou | 0) < 12) { st.star.heat = PHYS.heat; delete st.star.aMax; delete st.star.csEta; st.hou = 12; }   // петли почти постоянного сечения, нагрев по T короны
  if ((st.hou | 0) < 13) { for (const k of ['clusterFrac', 'polesTarget', 'lifeDays', 'fluxSlope', 'pairQLo', 'pairQHi', 'latBias']) delete st.star[k]; st.hou = 13; }   // полюса: закон потока, широты, 48 штук
  if ((st.hou | 0) < 14) { for (const k of ['fluxSlope', 'spotBs', 'birthH']) delete st.star[k]; st.hou = 14; }   // рождения −2,7, частота — от срока жизни
  if ((st.hou | 0) < 15) { for (const k of ['pairQLo', 'heatE']) delete st.star[k]; st.hou = 15; }   // мельче q 0,08 — уровнем детализации; нагрев всплытия
  if ((st.hou | 0) < 16) { st.star.dipoleG = PHYS.dipoleG; st.hou = 16; }   // диполь Барнарда слабый: петли — над своими пятнами
  if ((st.hou | 0) < 17) { for (const k of ['heatE', 'birthBright']) delete st.star[k]; st.hou = 17; }   // рождение ярче (автор)
  if ((st.hou | 0) < 18) { st.glow = true; st.glowT = 0.95; st.hou = 18; }   // глоу (автор): порог выше фотосферы
  if ((st.hou | 0) < 19) { for (const k of Object.keys(st.star)) if (k.startsWith('wind')) delete st.star[k]; st.hou = 19; }   // ветер до 3,5 R★ (автор: дальше — лишние ресурсы)
  if ((st.hou | 0) < 20) { for (const k of Object.keys(st.star)) if (k.startsWith('puff')) delete st.star[k]; st.hou = 20; }   // облака отрыва (автор)
  if ((st.hou | 0) < 21) { delete st.star.seedQuota; delete st.star.pMassPow; st.hou = 21; }   // арок больше (автор)
  if ((st.hou | 0) < 22) { delete st.star.lifeDays; st.hou = 22; }
  if ((st.hou | 0) < 23) { delete st.star.windR; delete st.star.windFade; st.hou = 23; }   // ветер — до поверхности источника 2,5 R★ (автор: «утягиваются на 3 радиуса»)
  if ((st.hou | 0) < 24) { st.star.archMode = 3; st.hou = 24; }   // частицы в поле и гравитации (автор: «мы с этого начинали»)
  if ((st.hou | 0) < 25) { for (const k of ['fpPts', 'fpBfloor', 'fpPtsBase', 'fpPtsQ']) delete st.star[k]; st.hou = 25; }   // струйки из сильного поля у пятен — проступает рисунок   // пятна M-карлика живут долго (GJ 1243: 100–500 сут) — 150 сут при q ≥ 1
  if ((st.hou | 0) < 26) { delete st.star.fpBfloor; delete st.star.fpBpow; st.hou = 26; }   // каждое пятно выпускает плазму (автор: «чёрные пятна без выброса»)
  if ((st.hou | 0) < 27) { for (const k of ['fpPts', 'fpBfloor', 'fpBpow', 'fpQpow', 'fpSpotW']) delete st.star[k]; st.hou = 27; }   // выброс — у каждого пятна
  if ((st.hou | 0) < 28) { for (const k of ['fpSplat', 'fpField', 'fpFieldK']) delete st.star[k]; st.hou = 28; }   // плазма как среда (автор: «не точки»)
  if ((st.hou | 0) < 29) { for (const k of ['fpSplat', 'fpField', 'fpFieldK']) delete st.star[k]; st.hou = 29; }   // назад к мягким точкам (автор: «было лучше»)
  if ((st.hou | 0) < 30) { delete st.star.polesTarget; st.hou = 30; }   // больше полей (автор): 64 полюса
  if ((st.hou | 0) < 31) { delete st.star.fpGpuN; st.star.bright = 0.6; st.hou = 31; }   // точек больше, поверхность тусклее (автор)
  if ((st.hou | 0) < 32) { st.star.rim = 0.9; st.star.rimPow = 4; st.hou = 32; }   // кромка ярче по Френелю (автор)
  if ((st.hou | 0) < 33) { st.star.granPhys = 1; st.hou = 33; }   // грануляция M-карлика по расчётам конвекции (Ludwig 2002; Beeck 2013)
  if ((st.hou | 0) < 35) { st.star.fpCloudBright = Math.max(10, st.star.fpCloudBright || 0); st.hou = 35; }   // облака ярче, мягкими пятнами (автор)
  // переезд на Проксиму (автор: «давай что-то поактивнее»): у Барнарда L_X ≈ 2·10²⁵ эрг/с (France et al. 2020) — корона тусклая;
  // Проксима — L_X ≈ (0,4–1,6)·10²⁷, частые вспышки, измеренный диполь 135 Гс под 51° (Klein et al. 2021)
  if ((st.hou | 0) < 36) { st.sp = 'M5.5Ve'; st.name = 'Проксима'; st.comp = 0; st.R = 0.154; st.M = 0.122;
    st.star = Object.assign({}, PHYS, { dipoleG: 135, dipoleTilt: 51 }); st.hou = 36; }
  if ((st.hou | 0) < 37) { st.star.labPhysics = 1; st.hou = 37; }   // этапы 0–1: карта поверхности, нагрев, согласованное поле
  // корону показывает объём в ультрафиолете (вблизи); вдали глаз её не видит — частицы по умолчанию выключены, галочка «арки» — для сравнения
  if ((st.hou | 0) < 38) { st.arches = false; st.hou = 38; }
  if ((st.hou | 0) < 39) { st.euvN = 128; st.hou = 39; }
  // светлый ободок по краю убран (автор, 15.10: «да, убираем ободок») — у фотосферы в видимом свете край темнее (реестр, п. 28); ползунок — для сравнения
  if ((st.hou | 0) < 40) { st.star.rim = 0; st.hou = 40; }
  // расплывание стареющих пар (автор, 15.10): поток распадающейся области растекается (η как у Солнца — нижняя граница), пара после
  // расхождения плывёт целиком — без разлёта на ползвезды
  if ((st.hou | 0) < 41) { st.star.spreadKm2s = 250; st.hou = 41; }
  // фотосфера «как видит глаз» (автор, 15.10: «давай текстуру»): потемнение по PHOENIX, цвет по фотометрии звезды, постоянная экспозиция камеры
  if ((st.hou | 0) < 42) { st.star.labEye = 1; const ph = { 'Проксима': [14.21, 12.95, 11.13, 9.45, 7.41], 'Барнард': [12.497, 11.24, 9.511, 8.298, 6.741] }[st.name];
    if (ph) st.star.labUBVRI = ph; st.hou = 42; }
  // T_eff Проксимы — измеренная, 3050 K (Ribas et al. 2017; Boyajian et al. 2012 — 3054 ± 79 K): потемнение к краю от неё заметно зависит
  if ((st.hou | 0) < 43) { if (st.name === 'Проксима') st.star.labTeff = 3050; st.hou = 43; }
  // плавание пятен (автор: «а плавание то пятен мы будем делать реальное?»): звезда вращается — Проксима 83,1 сут (Wargelin et al. 2017),
  // Барнард ≈ 145 сут (Toledo-Padrón et al. 2019); дифференциальное вращение, меридиональное течение и блуждание — ползунки, по умолчанию 0
  if ((st.hou | 0) < 44) { st.star.pairRigid = 1; const pr = { 'Проксима': 83.1, 'Барнард': 145 }[st.name]; if (pr) st.star.labProtD = pr; st.hou = 44; }   // сетка ультрафиолета грубее: 128×64×43 вместо 192×96×64 (автор), ползунок — рядом с галочкой
  // корона: нижний слой — текстура на поверхности, объём — грубый (автор: «газ очень низкого разрешения можно сделать — а там прямо текстуру на
  // поверхность»): объём 96×48×32 по умолчанию
  if ((st.hou | 0) < 45) { st.euvN = 96; st.hou = 45; }
  if ((st.hou | 0) < 46) { st.euvS = 8; st.hou = 46; }
  if ((st.hou | 0) < 47) { st.euvS = 9; st.hou = 47; }   // 512×256: форма — плитками, яркость — каждый кадр (автор: «давай 1 и 2 к 512»)   // текстура нижнего слоя 256×128 (автор: «надо понижать разрешение текстуры — нет плавности»)
  if ((st.hou | 0) < 48) { st.euvS = 10; st.hou = 48; }
  if ((st.hou | 0) < 49) { st.euvTubes = false; st.euvSurf = false; st.hou = 49; }
  if ((st.hou | 0) < 50) { st.euvFurDisk = true; st.hou = 50; }   // мех и на диске (автор: «а текстуры нет на переднем волуме?»)
  if ((st.hou | 0) < 51) { st.euvSurf = true; st.hou = 51; }   // текстура нижнего слоя снова включена (автор: «и нашу текстуру нижнюю включи»)
  if ((st.hou | 0) < 52) { st.euvTubes = true; st.hou = 52; }
  if ((st.hou | 0) < 53) { st.euvCarpet = true; st.hou = 53; }
  // интерфейс почищен (автор: «в интерфейсе всё ненужное выкинь — то, что мы раньше делали, нам многое не понадобится»): старая корона частицами,
  // глоу, Земля, трубки и газодинамика, подробный слой — выключены, их выключателей больше нет; поле — 1/r² без старого фона
  if ((st.hou | 0) < 54) { st.arches = false; st.glow = false; st.earth = false; st.euvTubes = false; st.star.falloff = 2; st.star.open = 0; st.star.labPhysics = 1; st.hou = 54; }   // магнитный ковёр — слой коротких петель спокойной поверхности (автор: «попробуй подобрать ковёр»)   // трубки в середине диска снова включены (автор: «пока мы что-то не то делаем — трубки опять центральные включи»)   // трубки пока убраны, в середине — газ одним слоем до поверхности (автор: «убираем пока трубки — делаем в 1 слой волум в центре»)   // 1024×512: один отсчёт формы на ячейку, кадр нижнего слоя ≈ 6–8 мс (автор: «давай к 1024»)
  if ((st.hou | 0) < 55) { st.star.driftKms = 0; if (st.name === 'Солнце') Object.assign(st.star, { labProtD: 25.38, labDOm: 0.0418, labVmer: 15 }); st.hou = 55; }   // без вихревого «плавания»; у Солнца — его вращение
  if ((st.hou | 0) < 56) { if (st.name === 'Солнце') st.star.labCarpetG = 10; st.hou = 56; }
  if ((st.hou | 0) < 57) { if (st.name === 'Солнце') Object.assign(st.star, { poleDepth: 0.015, dipoleG: 7 }); st.hou = 57; }
  if ((st.hou | 0) < 58) { if (st.name === 'Солнце') Object.assign(st.star, { pairQLo: 0.2, pairQHi: 6, fluxSlope: 2 }); st.hou = 58; }   // полюса Солнца — активные области   // активные области Солнца компактнее, диполь — солнечный   // ковёр Солнца — 10 Гс (активные области ярче спокойной поверхности)
  // живая текстура нижнего слоя — выключена (автор: «эта сложная текстура под поверхностью похоже дребезжит — а она нам там нужна — глаз её не
  // видит»): замер на Солнце — ≈ 5,5 из ≈ 17,7 мс видеокарты на кадр, а свет диска на 93 % дают ковёр, протяжённая корона и мох; без неё тон
  // середины диска меняется на 0,001 (p90 — 0,03), газ идёт одним слоем до поверхности; выключатель остался
  if ((st.hou | 0) < 59) { st.euvSurf = false; st.hou = 59; }
  // край короны: поглощение хромосферой (ползунки «Корона — край в 17,1 нм»)
  if ((st.hou | 0) < 61) { Object.assign(st.star, { labChH: 1, labChE: 4, labChSH: 5, labChSE: 12 }); st.hou = 61; }
  // активные области в короне — пятно и площадка (пресет «Солнце»; у других звёзд — прежнее: весь поток в пятне)
  if ((st.hou | 0) < 62) { Object.assign(st.star, st.name === 'Солнце' ? { labPlageF: 0.3, labPlageD: 0.02 } : { labPlageF: 1, labPlageD: 0 }); st.hou = 62; }
  // Солнце — активное (2026: сразу после максимума 25-го цикла): поток областей 2,5·10²¹–5·10²² Мкс на полярность (мельче — эфемерные области,
  // они в ковре); прежде 10²¹–3·10²² — у полюсов было 1,1·10²³ Мкс, у Солнца в эти годы ≈ 3·10²³
  if ((st.hou | 0) < 63) { if (st.name === 'Солнце') Object.assign(st.star, { pairQLo: 0.5, pairQHi: 10 }); st.hou = 63; }
  // протяжённая спокойная корона: у Солнца ν = 1 (сверка с SDO в линейной яркости), у других звёзд — прежние 1,5
  if ((st.hou | 0) < 64) { st.star.labXNu = st.name === 'Солнце' ? 1 : 1.5; st.hou = 64; }
  if ((st.hou | 0) < 65) { st.star.labFanF = 0.5; st.hou = 65; }   // веера петель активных областей
  // автор: «было без вееров лучше — и текстура поверхности контраст потеряла — и прямо огромные области засветки»: веера выключены, сеть резче
  if ((st.hou | 0) < 66) { st.star.labFanF = 0; st.star.labCarpBlur = 0.17; st.hou = 66; }
  // событие Солнца — 60 с показа ≈ 3 ч (аркада остывает до 1 МК за ≈ 45 мин, затемнение — часы)
  if ((st.hou | 0) < 67) { if (st.name === 'Солнце') st.star.cycle = 60; st.hou = 67; }
  // выброс Солнца уходит (автор: «давай выброс пусть летит»); у M-карликов извержения по умолчанию запертые — как прежде
  if ((st.hou | 0) < 68) { if (st.name === 'Солнце') st.star.cmeEscape = 1; st.hou = 68; }
  // выброс частицами (автор: «давай как в ультрафиолете — нити и брызги»): тёмность нитей, свечение краёв, доля отрыва, частиц
  if ((st.hou | 0) < 70) { for (const k of ['labCmeTau', 'labCmeE', 'labCmeFall', 'labCmeN']) st.star[k] = PHYS[k]; st.hou = 70; }
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) { /* без хранилища */ } };
  function applyChrom() { if (corona && corona.setChrom) { const e = effStar(); corona.setChrom({ H: e.labChH != null ? e.labChH : 1, he: e.labChE != null ? e.labChE : 4, sH: e.labChSH != null ? e.labChSH : 5, se: e.labChSE != null ? e.labChSE : 12 });
      const cL = corona.carpet ? corona.carpet().L : 0.03;
      if (corona.setCarpet) corona.setCarpet({ xNu: e.labXNu != null ? e.labXNu : 1.5, blur: (e.labCarpBlur != null ? e.labCarpBlur : 0.17) * cL }); if (corona.setFans) corona.setFans({ fanF: e.labFanF != null ? e.labFanF : 0 });
      if (corona.setCmeParts) corona.setCmeParts({ on: st.cmeParts !== false, dome: st.cmeDome === true, tau0: e.labCmeTau != null ? e.labCmeTau : 2, e0: e.labCmeE != null ? e.labCmeE : 0.1, fFall: e.labCmeFall != null ? e.labCmeFall : 0.5, N: e.labCmeN || 8000 }); } }

  // ---- сцена
  const view = $('view'), renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.outputEncoding = THREE.sRGBEncoding; renderer.setClearColor(0x020407, 1);
  view.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, 1, 0.002, 1e5);
  // фон и Земля — «сырой» цвет экрана, как у шейдеров звезды: одинаково с глоу и без (кадр в текстуре — линейный, r149)
  const rawMat = (hex, pt) => { const c = new THREE.Color(hex).convertLinearToSRGB(); return new THREE.ShaderMaterial({ uniforms: { uC: { value: c } },
    vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = ${(pt || 1).toFixed(2)};
#include <logdepthbuf_vertex>
}`,
    fragmentShader: `#include <logdepthbuf_pars_fragment>
uniform vec3 uC; void main(){
#include <logdepthbuf_fragment>
gl_FragColor = vec4(uC, 1.0); }`, toneMapped: false }); };
  let bgStars = null;
  { const n = 2500, P = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const z = Math.random() * 2 - 1, a = Math.random() * 6.283, r = Math.sqrt(1 - z * z);
      P[i * 3] = 4000 * r * Math.cos(a); P[i * 3 + 1] = 4000 * z; P[i * 3 + 2] = 4000 * r * Math.sin(a); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    bgStars = new THREE.Points(g, rawMat(0x9aa8b8, 1.2)); scene.add(bgStars); }
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), rawMat(0x4f86c6, 0)); scene.add(earth);
  // камера: вращение мышью вокруг точки взгляда, правая кнопка или Shift — сдвиг точки (рассмотреть край диска), колесо — дистанция
  // (в радиусах звезды); выброс — вверх (+Y)
  const orbit = { yaw: 0.35, pitch: 0.12, dist: 6.2, T: new THREE.Vector3() };
  let drag = null;
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
  // полёт к событию (автор: «где его искать то?»): по «▶ начать» камера плавно (2 с) поворачивается к якорной области и подходит — только
  // углы и дистанция, точка вращения — центр звезды (автор: «кто такое уродское управление вью сделал — было же нормально?»: прежде полёт
  // переносил точку вращения на область — камера крутилась вокруг точки в пространстве); тянуть или колесо — полёт прерывается
  let camFly = null;
  const orbitDir = (y, p) => new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p));   // направление от цели к камере — как в кадре
  // полёт (разбор Codex): положение камеры C — углами от центра звезды (рыскание по кратчайшему пути, наклон линейно — через полюс не идёт),
  // радиус по логарифму — не ближе 3 R★; направление взгляда D = C − T — так же углами от начального к конечному (наклон между начальным и
  // конечным — вертикаль не пересекает, lookAt не переворачивает кадр), длина D — по логарифму; точка вращения T = C − D — к центру. Без
  // панорамы (T = 0) C и D совпадают — чистый поворот вокруг центра
  function flyTo(w, dist) { cam.updateMatrixWorld(); const C0 = cam.position.clone(), D0 = C0.clone().sub(orbit.T), r0 = Math.max(C0.length(), 1e-3), L0 = Math.max(D0.length(), 1e-3), n1 = w.clone().normalize();
    const ang = v => [Math.atan2(v.x, v.z), Math.asin(Math.max(-1, Math.min(1, v.y / Math.max(v.length(), 1e-9))))], [cy0, cp0] = ang(C0), [dy0, dp0] = ang(D0), [y1, p1r] = ang(n1), p1 = Math.max(-1.4, Math.min(1.4, p1r));
    const wrap = d => d - 2 * Math.PI * Math.round(d / (2 * Math.PI)); camFly = { k: 0, dur: 2000, cy0, cp0, cdy: wrap(y1 - cy0), dy0, dp0, ddy: wrap(y1 - dy0), p1, r0, L0, r1: dist }; }
  renderer.domElement.addEventListener('pointerdown', e => { camFly = null; drag = { x: e.clientX, y: e.clientY, yaw: orbit.yaw, pitch: orbit.pitch, pan: e.button === 2 || e.shiftKey, T: orbit.T.clone() }; renderer.domElement.setPointerCapture(e.pointerId); });
  renderer.domElement.addEventListener('pointermove', e => { if (!drag) return;
    if (drag.pan) { const k = orbit.dist * 2 * Math.tan(cam.fov * Math.PI / 360) / view.clientHeight, rt = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      orbit.T.copy(drag.T).addScaledVector(rt, -(e.clientX - drag.x) * k).addScaledVector(up, (e.clientY - drag.y) * k); return; }
    orbit.yaw = drag.yaw - (e.clientX - drag.x) * 0.006; const pl = Math.max(1.5, Math.abs(drag.pitch)); orbit.pitch = Math.max(-pl, Math.min(pl, drag.pitch + (e.clientY - drag.y) * 0.006)); });   // предел — не меньше текущего наклона (прерванный полёт со сдвинутой целью — без скачка)
  renderer.domElement.addEventListener('pointerup', () => { drag = null; });
  // ближе 3 R★ от центра звезды не подлетаем (автор, 15.10: «не надо подлетать к звезде слишком близко — все детали не прорисуем»;
  // реестр интерфейса, п. 29): диск — около 80 % высоты кадра, кромка с мехом в кадре
  const STAR_DMIN = 3;
  renderer.domElement.addEventListener('wheel', e => { e.preventDefault(); camFly = null; orbit.dist = Math.max(Math.min(st.mode === 'sn' ? 0.05 : STAR_DMIN, orbit.dist), Math.min(400, orbit.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });   // нижний предел — не больше текущей дистанции (прерванный полёт — без скачка)
  renderer.domElement.addEventListener('dblclick', () => { camFly = null; Object.assign(orbit, { yaw: 0.35, pitch: 0.12, dist: st.mode === 'sn' ? 45 : 6.2 }); orbit.T.set(0, 0, 0); });
  // ---- глоу (решение автора 14.10.2026 — на стенде; в игре по реестру интерфейса п. 22 его нет): кадр — в текстуру с плавающей точкой,
  // яркое выше порога — вниз по четырём масштабам (½…1/16) с размытием Гаусса на каждом, сумма — поверх кадра
  const glow = (() => {
    const opt = { type: THREE.HalfFloatType, depthBuffer: false }, rtS = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    const lv = [0, 1, 2, 3].map(() => [new THREE.WebGLRenderTarget(4, 4, opt), new THREE.WebGLRenderTarget(4, 4, opt)]);
    rtS.texture.encoding = THREE.sRGBEncoding;   // встроенные материалы (фон, Земля) пишут в кадр так же, как на экран
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); qs.add(quad); quad.frustumCulled = false;
    const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    const mat = (fs, u) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false, toneMapped: false });
    const T4 = (o) => `texture2D(tS, vUv + uTx * vec2(${o}))`;
    const bright = mat(`uniform sampler2D tS; uniform vec2 uTx; uniform float uThr; varying vec2 vUv;
      void main(){ vec3 c = 0.25 * (${T4('-0.5, -0.5')}.rgb + ${T4('0.5, -0.5')}.rgb + ${T4('-0.5, 0.5')}.rgb + ${T4('0.5, 0.5')}.rgb);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); gl_FragColor = vec4(c * smoothstep(uThr, uThr + 0.25, l), 1.0); }`,
      { tS: { value: null }, uTx: { value: new THREE.Vector2() }, uThr: { value: 0.55 } });
    const down = mat(`uniform sampler2D tS; uniform vec2 uTx; varying vec2 vUv;
      void main(){ gl_FragColor = vec4(0.25 * (${T4('-1.0, -1.0')}.rgb + ${T4('1.0, -1.0')}.rgb + ${T4('-1.0, 1.0')}.rgb + ${T4('1.0, 1.0')}.rgb), 1.0); }`,
      { tS: { value: null }, uTx: { value: new THREE.Vector2() } });
    const blur = mat(`uniform sampler2D tS; uniform vec2 uDir; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tS, vUv).rgb * 0.2270270270;
        c += (texture2D(tS, vUv + uDir * 1.3846153846).rgb + texture2D(tS, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
        c += (texture2D(tS, vUv + uDir * 3.2307692308).rgb + texture2D(tS, vUv - uDir * 3.2307692308).rgb) * 0.0702702703; gl_FragColor = vec4(c, 1.0); }`,
      { tS: { value: null }, uDir: { value: new THREE.Vector2() } });
    const comp = mat(`uniform sampler2D tS, t0, t1, t2, t3; uniform float uK, uR; varying vec2 vUv;
      void main(){ vec3 b = texture2D(t0, vUv).rgb * (1.0 - 0.5 * uR) + texture2D(t1, vUv).rgb * 0.8 + texture2D(t2, vUv).rgb * (0.4 + 0.6 * uR) + texture2D(t3, vUv).rgb * (0.15 + 0.85 * uR);
        gl_FragColor = vec4(texture2D(tS, vUv).rgb + uK * b, 1.0); }`, { tS: { value: null }, t0: { value: null }, t1: { value: null }, t2: { value: null }, t3: { value: null }, uK: { value: 0.9 }, uR: { value: 0.5 } });   // без перевода в sRGB: шейдеры звезды и так отдают цвет экрана
    const pass = (m, rt) => { quad.material = m; renderer.setRenderTarget(rt); renderer.render(qs, qc); };
    const size = (w, h) => { const pr = renderer.getPixelRatio(); rtS.setSize(w * pr, h * pr);
      lv.forEach((p, i) => { const k = 2 << i, W = Math.max(1, (w * pr / k) | 0), H = Math.max(1, (h * pr / k) | 0); p[0].setSize(W, H); p[1].setSize(W, H); }); };
    const render = () => {
      renderer.setRenderTarget(rtS); renderer.render(scene, cam); if (star && star.plasmaField) star.plasmaField.render(renderer, cam, rtS);   // плазма как среда — до глоу
      bright.uniforms.tS.value = rtS.texture; bright.uniforms.uTx.value.set(1 / rtS.width, 1 / rtS.height); bright.uniforms.uThr.value = st.glowT; pass(bright, lv[0][0]);
      for (let i = 0; i < 4; i++) { const [a, b] = lv[i];
        if (i) { const s = lv[i - 1][0]; down.uniforms.tS.value = s.texture; down.uniforms.uTx.value.set(0.5 / s.width, 0.5 / s.height); pass(down, a); }
        blur.uniforms.tS.value = a.texture; blur.uniforms.uDir.value.set(1 / a.width, 0); pass(blur, b);
        blur.uniforms.tS.value = b.texture; blur.uniforms.uDir.value.set(0, 1 / a.height); pass(blur, a); }
      comp.uniforms.tS.value = rtS.texture; lv.forEach((p, i) => { comp.uniforms['t' + i].value = p[0].texture; });
      comp.uniforms.uK.value = st.glowK; comp.uniforms.uR.value = st.glowR; pass(comp, null);
    };
    return { size, render };
  })();
  function resize() { const w = view.clientWidth, h = view.clientHeight; renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); glow.size(w, h); }
  new ResizeObserver(resize).observe(view); resize();

  // ---- модель
  let star = null, sn = null, t = 0, simT = 0, lastStats = 0, playing = true, last = performance.now(), corona = null, coronaCal = false, coronaCalT = 0;   // simT — часы симуляции (пауза их останавливает)
  const cls = () => SM.classParams(st.sp, st.comp);
  const rSunEff = () => st.R || cls().rSun, mSunEff = () => st.M || cls().mSun;   // радиус и масса: примера или по классу
  const effStar = () => Object.assign({}, SM.DEFAULTS, cls().overrides, st.star);
  const effSn = () => Object.assign({}, SM.SN_DEFAULTS, st.sn);
  function build() {
    if (star) { scene.remove(star.group); star.dispose(); }
    star = SM.create(THREE, { seed: st.seed, sp: st.sp, comp: st.comp, rKm: st.R ? st.R * SM.R_SUN_KM : 0, mSun: st.M || 0, params: st.star, arches: st.arches, flares: st.flares, cme: st.cme, labLOD: true, renderer,
      SurfaceState: window.M31SurfaceState, Photosphere: window.M31Photosphere, labDrawSpots: true });
    scene.add(star.group);
    buildCorona();
    if (sn) { scene.remove(sn.group); sn.dispose(); sn = null; }
    if (st.mode === 'sn') { sn = SM.createSupernova(THREE, { seed: st.seed, params: st.sn }); scene.add(sn.group); }
    const rE = 6371 / (rSunEff() * SM.R_SUN_KM); earth.scale.setScalar(rE); earth.position.set(1.06 + rE, -0.45, 0.6); earth.visible = st.earth;
    stats(); info(); save(); if ($('comps').childElementCount) { compSync(); applyDbg(); }
  }
  let compKeep = null;   // выключатели модели звезды переживают пересборку
  // газодинамика в трубках (этап 3, второй шаг): только на сеанс (не сохраняется); пока включена при трубках — поле снимок: жизнь поверхности стоит
  let hydroOn = false;
  // удержание — пока газ действительно на снимке поля (и во время угасания трубок — разбор Codex: прежде по желанию, поверхность оживала раньше)
  const hydroHold = () => hydroOn && !!corona && (corona.hydroFrozen ? corona.hydroFrozen() : st.euvTubes === true); let holdWas = false;
  function applyDbg() { if (!star || !star.debug) return; const o = Object.assign({ noSpots: false, noSurface: false }, compKeep || {}); if (hydroHold()) o.noSurface = true; star.debug(o); }
  let rebuildT = null; const rebuild = () => { clearTimeout(rebuildT); rebuildT = setTimeout(build, 140); };
  // корона в ультрафиолете (реестр интерфейса, пп. 28–29): объём, размеченный силовыми линиями — запекается по текущему полю и
  // установившемуся нагреву карты поверхности (выпуск = двигатель: F_H = η_H·P_drive/площадь); границы яркости — в первом кадре.
  // Сетка — st.euvN ячеек по долготе, по широте вдвое меньше, по высоте (ln r) втрое (автор: «уменьшаем разрешение сетки — выведи в настройку»)
  // текстура нижнего слоя на поверхности — 2^st.euvS по долготе, вдвое меньше по широте (автор: «надо понижать разрешение текстуры — нет плавности»)
  const euvGrid = () => { const Np = st.euvN | 0 || 128, sw = 1 << Math.min(11, Math.max(7, st.euvS | 0 || 10)); return { Np, Nt: Np >> 1, Nr: Math.max(8, Math.round(Np / 3)), surfW: sw, surfH: sw >> 1 }; };
  function euvLabel() { const g = euvGrid(), R = star ? star.phys.rKm : 0, rMax = star && star.params.rSS > 1 ? star.params.rSS : 2.5;
    const kmH = R * 2 * Math.PI / g.Np, kmR = R * (Math.pow(rMax, 1 / g.Nr) - 1), S = corona && corona.stats();
    $('euvNO').textContent = `${g.Np}×${g.Nt}×${g.Nr} · ячейка ${(kmH / 1000).toFixed(1)}×${(kmR / 1000).toFixed(1)} тыс. км` + (S && S.baked ? ` · ${S.ms.toFixed(0)} мс` : '');
    $('euvSO').textContent = `${g.surfW}×${g.surfH} · ячейка ${(R * 2 * Math.PI / g.surfW / 1000).toFixed(1)} тыс. км`; }
  function buildCorona() {
    if (corona) { corona.dispose(); corona = null; }
    const SSo = star && star.surfaceState && star.surfaceState();
    // граница объёма — поверхность источника поля (заряды-изображения построены на ней); без изображений — 2,5 R★
    if (st.euv !== false && window.M31Corona && SSo && st.mode !== 'sn') {
      if (!M31Corona.supported(renderer)) console.warn('корона: нужен WebGL2 с EXT_color_buffer_float — ультрафиолет выключен');
      else corona = M31Corona.create(THREE, renderer, Object.assign({ R: star.phys.rKm * 1e5, M: star.phys.mSun * 1.989e33, rMax: star.params.rSS > 1 ? star.params.rSS : 2.5, gas: st.euvGas === false ? 0 : 1 }, euvGrid())); }
    if (corona) { if (corona.setCarpet) corona.setCarpet(st.euvCarpet === true); applyChrom(); if (corona.setTone) corona.setTone(st.euvTone !== 'log'); corona.uniforms.uSurfOn.value = st.euvSurf === true ? 1 : 0; corona.uniforms.uFurDisk.value = st.euvFurDisk === true ? 1 : 0; if (corona.setHydro) corona.setHydro(false); if (corona.setTubes) corona.setTubes(st.euvTubes === true); if (corona.setPoles) corona.setPoles(star.polesView ? star.polesView() : star.poles); const [C, fh] = coronaInputs(); corona.bake(C, fh); if (corona.setHydro) corona.setHydro(hydroOn); applyDbg(); coronaCal = true; coronaCalT = 0; coronaClk = coronaLiveClk = star.surfClockView ? star.surfClockView() : star.surfClock ? star.surfClock() : 0; }   // часы показа (разбор Codex)
    applyDbg();   // без короны (ультрафиолет выключен) поверхность не держится (разбор Codex)
    euvLabel();
  }
  let euvT = null, coronaClk = 0, coronaLiveClk = 0;
  // снимок для короны: заряды полюсов и описание нагрева — карта нагрева считается на видеокарте в точке (1024×512) по тем же формулам, что
  // карта поверхности (тени — диски площадью |q|·Φ₀·фаза/B_s, двигатель, калибровка ε — её); прежде — массив карты 128×64 (квадраты)
  function coronaInputs() { const SSo = star.surfaceState(), o = SSo.opts, eps = SSo.stats().eps || 0;
    const sFo = Q => Q.sF != null ? Q.sF : 1;   // как в карте поверхности: нет фазы (неподвижные полюса) — 1
    // радиус тени — угловой, по площади на сфере: 2πR²(1 − cos r) = |q|·Φ₀·фаза/B_s
    const PV = star.polesView ? star.polesView() : star.poles;   // полюса показа — смесь двух последних шагов поверхности (без толчков)
    // активные области — пятно и факельная площадка (автор: «по порядку все», шаг 2 — области как на Солнце). У Солнца в пятнах ≈ 30 % потока
    // области, остальное — площадка 100–300 Гс на 50–100 тыс. км вокруг; было — весь поток в пятне (заряд на глубине 0,015 R★): поле ≥ 280 Гс
    // (нагрев ≈ 10⁷) — лишь в 20 тыс. км, нагрев выше 10⁶ — на 0,8 % поверхности, нигде не 10⁷. Площадка — тот же полюс глубже (полуширина
    // поля ≈ 0,77·глубины; на 0,02 R★ половина потока — в 24 тыс. км, среднее поле там 100–400 Гс у областей 0,5–2·10²² Мкс). Пятно — на такой
    // глубине, что в середине тени поле B_s (3 кГс; поле над зарядом q на глубине d — gUnit·q/d², единица модели — разбор Codex), его доля — × фаза тени (распадается пятно — поток остаётся
    // в площадке); площадка — не мельче источника полюса (расплывание уводит его глубже). Только корона стенда (её поле и нагрев); модель
    // звезды, фотосфера и игра — прежние
    const e = effStar(), fs0 = e.labPlageF != null ? e.labPlageF : 1, dP = e.labPlageD || 0, d00 = star.params.poleDepth, gU = SM.charges([], star.params).gUnit;
    const split = dP > 0 && fs0 < 1 && !(corona && corona.maxCharges && corona.maxCharges() < 256);   // видеокарта с малым пределом — без площадок
    const PS = []; for (const Q of PV) { if (Q.q === 0) continue; if (!split) { PS.push(Q); continue; }
      // пятно с потоком меньше 10²¹ Мкс (пора) — без своего заряда, его поток — в площадке (зарядов вдвое меньше: дешевле снимки поля)
      const fs = Math.abs(Q.q) * fs0 * sFo(Q) * o.PHI0 >= 1e21 ? fs0 * sFo(Q) : 0, d0 = Q.dep > 0 ? Q.dep : d00, ds = Math.min(d0, Math.sqrt(gU * Math.abs(Q.q) * fs / o.spotBs));
      if (fs > 0) PS.push({ p: Q.p, q: Q.q * fs, dep: Math.max(1e-3, ds), uid: Q.uid }); PS.push({ p: Q.p, q: Q.q * (1 - fs), dep: Math.max(dP, d0), uid: -1 - Q.uid }); }
    // предел зарядов видеокарты (разбор Codex): с изображениями заряд — два места; не влезает — остаются сильнейшие полюса целиком (иначе
    // обрезались бы изображения последних и поле менялось)
    { const cap = corona && corona.maxCharges ? corona.maxCharges() : 256, per = star.params.rSS > 1 ? 2 : 1, nz = PS.filter(Q => Q.q !== 0);
      if (nz.length * per > cap) { nz.sort((a, b) => Math.abs(b.q) - Math.abs(a.q)); PS.length = 0; PS.push(...nz.slice(0, Math.floor(cap / per))); } }
    const spots = PV.filter(Q => !Q.dead && Math.abs(Q.q) >= o.qPore && sFo(Q) > 0 && (!split || Math.abs(Q.q) * fs0 * sFo(Q) * o.PHI0 >= 1e21)).map(Q => { const n = Q.p.clone().normalize(), A = Math.abs(Q.q) * (split ? fs0 : 1) * o.PHI0 * sFo(Q) / o.spotBs;
      return [n.x, n.y, n.z, Math.acos(Math.max(-1, 1 - A / (2 * Math.PI * o.R * o.R)))]; });
    // заряды — с uid полюсов в их порядке и признаком изображений: корона по ним переносит основания трубок (разбор Codex)
    const C = SM.charges(PS, star.params); C.uids = PS.filter(Q => Q.q !== 0).map(Q => Q.uid); C.img = star.params.rSS > 1;
    return [C, { spots, Bconc: o.Bconc, carpetG: o.carpetG, vh: o.vh, tanTheta: o.tanTheta, su: o.su, etaEps: o.etaH * eps }]; }

  // ---- панель
  function info() {
    const c = cls(), k = c.info, rS = rSunEff(), rKm = rS * SM.R_SUN_KM, hex = '#' + c.colorHex.toString(16).padStart(6, '0');
    const lum = { V: 'главная последовательность', IV: 'субгигант', III: 'гигант', I: 'сверхгигант', D: 'белый карлик' }[k.lum];
    $('info').innerHTML = `<span class="sw" style="background:${hex}"></span><b>${k.cls}${k.cls === 'D' ? '' : k.sub} ${k.lum === 'D' ? '' : k.lum}</b> · ${lum} · <b>${k.teff.toLocaleString('ru')} K</b><br>`
      + `R★ = <b>${rS < 0.1 ? rS.toFixed(3) : rS.toFixed(2)} R☉</b> ≈ ${Math.round(rKm).toLocaleString('ru')} км, M★ ≈ ${mSunEff().toFixed(2)} M☉${st.R ? '' : ' (по классу)'} · активность ${c.activity.toFixed(2)} · ${c.convective ? 'конвекция: пятна, арки, вспышки' : 'без конвективной оболочки: поверхность гладкая'}`;
    const comp = $('comp'); comp.innerHTML = k.parts.map((p, i) => `<option value="${i}"${i === (st.comp | 0) ? ' selected' : ''}>${i + 1}: ${p}</option>`).join(''); comp.classList.toggle('hidden', k.parts.length < 2);
  }
  function slider(key, label, min, max, step, eff, which) {
    const v = eff[key], id = `p_${which}_${key}`;
    return `<div class="sl"><label for="${id}" title="${label}">${label}</label><input type="range" id="${id}" data-k="${key}" data-w="${which}" min="${min}" max="${max}" step="${step}" value="${v}"><output id="${id}o">${fmt(v)}</output></div>`;
  }
  const fmt = v => Math.abs(v) >= 100 ? Math.round(v) : Math.abs(v) >= 10 ? v.toFixed(1) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  function groups() {
    const e = effStar(), s = effSn(), open = new Set([...document.querySelectorAll('#groups details[open]')].map(d => d.dataset.g));
    const G = (st.mode === 'sn' ? SN_GROUPS.map(g => [...g, 'sn', s]) : []).concat(STAR_GROUPS.map(g => [...g, 'star', e]));
    $('groups').innerHTML = G.map(([name, list, which, eff]) => `<details data-g="${name}"${open.has(name) || (!open.size && (name === 'Арки' || name === 'Сверхновая')) ? ' open' : ''}><summary>${name}</summary>${list.map(x => slider(...x, eff, which)).join('')}</details>`).join('');
  }
  $('groups').addEventListener('input', e => {
    const el = e.target; if (!el.dataset.k) return;
    const k = el.dataset.k, w = el.dataset.w, v = +el.value; (w === 'sn' ? st.sn : st.star)[k] = v; $(el.id + 'o').textContent = fmt(v);
    if (w === 'sn') { if (SM.SN_GEOM.includes(k)) rebuild(); else if (sn) sn.setLook({ [k]: v }); }
    else if (/^labCh/.test(k) || /^labCme/.test(k)) applyChrom(); else if (k === 'labPlageF' || k === 'labPlageD') { if (corona) corona.inputs(...coronaInputs()); } else if (k === 'labXNu' || k === 'labFanF' || k === 'labCarpBlur') applyChrom(); else if (SM.GEOM.includes(k)) rebuild(); else star.setLook({ [k]: v });
    if (k === 'cycle' || k === 'snCycle') $('scrub').max = v;
    save();
  });
  $('presets').innerHTML = PRESETS.map(([n, sp], i) => `<button data-i="${i}" title="${sp}">${n}</button>`).join('');
  $('presets').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (!b) return; const [n, sp, R, M, ov] = PRESETS[+b.dataset.i]; setStar(sp, n, 0, R, M, ov); });
  $('starList').innerHTML = STARS.map(s => `<option value="${s.name.replace(/"/g, '&quot;')}">${s.sp}</option>`).join('');
  $('starName').addEventListener('change', e => { const s = STARS.find(x => x.name === e.target.value); if (s) setStar(s.sp, s.name, s.sp.split('+').length - 1); });
  $('spec').addEventListener('change', e => setStar(e.target.value.trim() || 'G2V', '', 0));   // свой спектр — радиус и масса по классу
  $('comp').addEventListener('change', e => { st.comp = +e.target.value; groups(); build(); });
  // смена звезды: параметры — к основе стенда PHYS (+ известное о звезде: диполь), а не к старой модели нитей
  function setStar(sp, name, comp, R, M, ov) { st.sp = sp; st.name = name; st.comp = comp; st.R = R || 0; st.M = M || 0; st.star = Object.assign({}, PHYS, ov || {}); $('spec').value = sp;
    $('starName').value = STARS.some(s => s.name === name) ? name : ''; groups(); build(); }
  for (const [id, key] of [['optFlares', 'flares'], ['optCme', 'cme']]) { $(id).checked = st[key]; $(id).addEventListener('change', e => { st[key] = e.target.checked; build(); }); }
  // глоу: переключатель и ползунки (сила, порог яркости, радиус)
  $('optEuv').checked = st.euv !== false; $('optEuv').addEventListener('change', e => { st.euv = e.target.checked; buildCorona(); save(); });
  $('euvN').value = euvGrid().Np; $('euvN').addEventListener('input', e => { st.euvN = +e.target.value; euvLabel(); save(); clearTimeout(euvT); euvT = setTimeout(() => { buildCorona(); }, 250); });
  $('euvS').value = Math.log2(euvGrid().surfW); $('euvS').addEventListener('input', e => { st.euvS = +e.target.value; euvLabel(); save(); clearTimeout(euvT); euvT = setTimeout(() => { buildCorona(); }, 250); });
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
    st.mode = b.dataset.mode; document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    camFly = null; orbit.dist = st.mode === 'sn' ? 45 : 6.2; t = 0; evActive = false; evBtn(); groups(); build(); }));   // смена режима — событие кончилось (разбор Codex)
  $('play').addEventListener('click', () => { playing = !playing; $('play').textContent = playing ? 'Пауза' : 'Пуск'; });
  // событие — по кнопке (автор: «надо кнопку, по которой начинается»): идёт с нуля один раз, на это время поверхность стоит; выключатели
  // «вспышка» и «выброс» — что показать в событии (ни одного — кнопка включает оба); ещё раз — остановить
  let evActive = false;
  const evBtn = () => { $('evStart').textContent = evActive ? '■ остановить' : '▶ начать'; $('evStart').disabled = st.mode === 'sn'; };   // у сверхновой — нет
  evBtn();
  $('evStart').addEventListener('click', () => {
    if (evActive) { evActive = false; t = 0; evBtn(); return; }
    if (!st.flares && !st.cme) { $('optFlares').click(); $('optCme').click(); }
    evActive = true; t = 0; if (!playing) $('play').click(); evBtn();
    if (star && star.poles && star.poles.length >= 2) { star.group.updateMatrixWorld(); const P0 = star.poles[0].p.clone().normalize(), P1 = star.poles[1].p.clone().normalize(), m = P0.clone().add(P1).normalize(),
      side = m.clone().cross(P0.clone().sub(P1)).normalize(), rot = new THREE.Matrix4().extractRotation(star.group.matrixWorld);
      // с выбросом — сбоку (автор: «давай выброс пусть летит»): область у края диска (80° от направления на камеру), камера в 5,5 R★ от центра —
      // в кадре край звезды и путь выброса; взгляд поперёк линии раздела — дуга нитей в плоскости кадра, как на снимке 31.08.2012 (разбор
      // Codex); только вспышка — область почти по центру (25°), камера в 3,4 R★
      const ang = st.cme ? 1.4 : 0.44, ax = P0.clone().sub(P1).normalize(), loc = m.clone().multiplyScalar(Math.cos(ang)).addScaledVector(st.cme ? ax : side, Math.sin(ang)).normalize();
      flyTo(loc.applyMatrix4(rot).normalize(), st.cme ? 5.5 : 3.4); } });
  $('speed').value = st.speed; $('speedO').textContent = st.speed; $('speed').addEventListener('input', e => { st.speed = +e.target.value; $('speedO').textContent = st.speed; save(); });
  $('scrub').addEventListener('input', e => { t = +e.target.value; });
  $('reseed').addEventListener('click', () => { st.seed = (Math.random() * 1e9) | 0; build(); });
  $('reset').addEventListener('click', () => { if (st.mode === 'sn') st.sn = {}; else st.star = {}; groups(); build(); });
  $('copy').addEventListener('click', () => {
    const out = { sp: st.sp, comp: st.comp, seed: st.seed, star: st.star, sn: st.mode === 'sn' ? st.sn : undefined };
    const txt = JSON.stringify(out, null, 2), done = s => { $('copy').textContent = s; setTimeout(() => { $('copy').textContent = 'Скопировать параметры'; }, 1800); };
    try { navigator.clipboard.writeText(txt).then(() => done('Скопировано'), () => { $('json').value = txt; $('json').hidden = false; $('json').select(); done('Выделено — скопируйте вручную'); }); }
    catch (e) { $('json').value = txt; $('json').hidden = false; $('json').select(); done('Выделено — скопируйте вручную'); }
  });
  // сводка: число арок, почему отброшены линии, высоты и хорды — в радиусах звезды и километрах
  function stats() {
    const rKm = rSunEff() * SM.R_SUN_KM, L = star.lines, q = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? [s[0], s[s.length >> 1], s[s.length - 1]] : [0, 0, 0]; };
    const km = x => `${Math.round(x * rKm).toLocaleString('ru')} км`, row = (name, a) => { const [mn, md, mx] = q(a); return `${name}: ${mn.toFixed(3)} / ${md.toFixed(3)} / ${mx.toFixed(3)} R★  ≈  ${km(mn)} / ${km(md)} / ${km(mx)}`; };
    const rej = star.rejected || {}, rejS = Object.entries(rej).filter(([, n]) => n).map(([k, n]) => `${{ open: 'не вернулись', high: 'выше макс.', low: 'ниже мин.', long: 'хорда длиннее', short: 'хорда короче', flat: 'плоские', self: 'в свой полюс' }[k]} — ${n}`).join(', ');
    $('stats').textContent = `полюсов ${star.poles.length}, арок ${L.length}${rejS ? `\nотброшено: ${rejS}` : ''}\nмин / медиана / макс:\n${row('высота', L.map(l => l.top))}\n${row('хорда', L.map(l => l.chord))}\n${row('длина', L.map(l => l.len))}`
      + `\nгранула ≈ ${effStar().granPhys ? effStar().granKm + ' км (по расчётам конвекции)' : km(Math.PI / effStar().granScale) + ' (масштаб шума)'}, Земля — ${(6371 / rKm).toFixed(4)} R★`
      + `\ng★ ≈ ${(mSunEff() / (rSunEff() * rSunEff())).toFixed(1)} g☉; шкала высот на 1 МК — ${(0.0722 * rSunEff() / mSunEff()).toFixed(3)} R★ ≈ ${km(0.0722 * rSunEff() / mSunEff())}`
      + plasmaStats() + surfStats() + mapStats() + ropeStats();
  }

  // сводка плазмы: нити, температура, плотность, поле и длина петель (мин / медиана / макс), скорость убегания, сжатие времени
  function plasmaStats() {
    const s = star.plasma(); if (!s) return '';
    if (s.free && s.gpu) return `
плазма — частицы в поле и гравитации (видеокарта): ${s.n.toLocaleString('ru')} частиц (в деле ${(+s.live || 0).toLocaleString('ru')}): выше 1,5 R★ ${(+s.high || 0).toLocaleString('ru')}, облаками ушло ${(+s.cloud || 0).toLocaleString('ru')}, в слабом поле ${(+s.weak || 0).toLocaleString('ru')}, остывших (дождь) ${(+s.rain || 0).toLocaleString('ru')}; ${s.ms} мс процессора на кадр`;
    if (s.free) return `
плазма — частицы в поле и гравитации: ${s.n.toLocaleString('ru')} частиц; выше 1,5 R★ в поле — ${s.high}, в облаке (слабое поле) — ${s.cloud}, остывших (дождь) — ${s.rain}; рождений ${s.spawnPerSec}/с; ${s.ms} мс`
      + `
v_esc ${Math.round(s.vesc)} км/с; 1 с показа ≈ ${Math.round(s.tReal)} с реального времени`;
    const q = a => { const v = a.slice().sort((x, y) => x - y); return v.length ? [v[0], v[v.length >> 1], v[v.length - 1]] : [0, 0, 0]; };
    const f = (a, k, d) => q(a).map(x => (x * k).toLocaleString('ru', { maximumFractionDigits: d })).join(' / ');
    const e = a => q(a).map(x => x.toExponential(1).replace('e+', '·10^')).join(' / ');
    return `\nплазма: нитей ${s.strands} — закрытых ${s.closed}, открытых ${s.open}; частиц ${star.particles.toLocaleString('ru')}`
      + `\nT вершин, МК: ${f(s.T, 1e-6, 2)}\nn у вершины, см⁻³: ${e(s.n)}\nB̄ петли, Гс: ${f(s.B, 1, 0)}\nполудлина, тыс. км: ${f(s.L, 1e-3, 1)}`
      + `\nv_esc ${Math.round(s.vesc)} км/с; 1 с показа ≈ ${Math.round(s.tReal)} с реального времени`
      + `\nиспарение: ${s.evN} частиц на ${s.evStrands} петлях области вспышки; дождь: ${s.rainN} на ${s.rainStrands} длинных петлях`;
  }
  // сводка поверхности: часы, живые полюса, рождения, уничтоженный поток, нагретые нити, пересадки частиц, накопители жгута
  function surfStats() {
    const s = star.surface && star.surface(), pl = star.plasma(); if (!s) return '';
    const e = x => x.toExponential(1).replace('e+', '·10^');
    return `\nповерхность: сутки ${(s.clock / 24).toFixed(1)}; полюсов ${s.alive}, новых пар ${s.births}; уничтожено ${e(s.cancMx)} Мкс`
      + (s.dep && effStar().spreadKm2s > 0 ? `; глубина источников (расплывание): средняя ${s.dep.mean.toFixed(3)}, наибольшая ${s.dep.max.toFixed(3)} R★` : '')
      + (pl && !pl.free ? `; нагретых нитей ${pl.heated}, пересадок ${pl.transfers}, масса короны ×${pl.massK.toFixed(2)}` : '')
      + (s.contacts.length ? '\nвстречи полюсов (уничтожено / жгут / скорость): ' + s.contacts.map(c => `${Math.round(c.frac * 100)}% / ${Math.round(c.rope * 100)}% / ${e(c.rateMx)} Мкс/ч`).join('; ') : '');
  }
  // сводка карты поверхности (этапы 0–1): физическое время, поле, нагрев, бюджет
  function mapStats() {
    const m = star.surfaceMap && star.surfaceMap(); if (!m) return '';
    const e = x => x.toExponential(2).replace('e+', '·10^');
    return `
карта поверхности: физическое время ${(m.tPhys / 86400).toFixed(2)} сут${m.backlog > 7200 ? ` (отстаёт на ${(m.backlog / 3600).toFixed(0)} ч)` : ''}; ⟨|Br|⟩ ${m.meanAbsBr.toFixed(1)} Гс, ⟨|B|⟩ ${m.meanB.toFixed(1)} Гс; ⟨|Br|⟩ с ковром ${m.meanAbsBrCarpet.toFixed(0)} Гс (Зееман: 450–750)`
      + `; тени ${(m.fUmbra * 100).toFixed(2)} % площади; нагрев короны (среднее за шаг) ${e(m.LH)} эрг/с (ε ${m.eps.toExponential(2)}); событий уничтожения ${m.events}, в импульсы ${e(m.Eevents)} эрг;`
      + ` бюджет: невязка ${m.budget.rel.toExponential(1)}${m.overflow ? `; переполнение заполнения в ${m.overflow} ячейках` : ''}${m.calibErr ? `; ВНИМАНИЕ: ${m.calibErr}` : ''}`;
  }
  // сводка выброса: показатель спада поля над областью вспышки, высота срыва и устойчивая полоса, итог — заперт или ушёл
  function ropeStats() {
    const D = star.decay, R = star.rope; if (!D || !R) return '';
    const km = x => `${Math.round(x * rSunEff() * SM.R_SUN_KM).toLocaleString('ru')} км`, nAt = h => D.nAt(h).toFixed(2);
    return `\nвыброс: показатель спада n при h = 0,05 / 0,2 / 0,5 / 1 / 2 R★ — ${nAt(0.05)} / ${nAt(0.2)} / ${nAt(0.5)} / ${nAt(1)} / ${nAt(2)}`
      + `\nсрыв с ${D.hCr ? D.hCr.toFixed(3) + ' R★ (' + km(D.hCr) + ')' : '— (n нигде не выше порога)'}; устойчивая полоса с ${D.hStall ? D.hStall.toFixed(2) + ' R★' : '— нет'}`
      + `\nжгут: макс. высота ${R.hMax.toFixed(2)} R★ (${km(R.hMax)}), макс. скорость ${Math.round(R.vMaxKms)} км/с — ${R.esc ? 'ушёл (сценарий)' : R.tStall >= 0 ? 'заперт, вещество стекает' : 'поднимается'}`;
  }

  // ---- кадр
  function frame(now) {
    requestAnimationFrame(frame);
    // время кадра: вид (цикл, детализация) — не больше 0,1 с; физика (часы модели) — всё прошедшее время, иначе на редких кадрах
    // терялись бы физические часы (разбор Codex: 5 FPS — половина времени); перерыв дольше секунды (скрытая вкладка) — пауза
    const dtW = (now - last) / 1000; last = now; const dtPh = dtW > 1 ? 0 : dtW, dt = Math.min(0.1, dtPh);
    const cyc = st.mode === 'sn' ? effSn().snCycle : effStar().cycle;
    // событие — вспышка или выброс (разбор Codex): поле на время события — снимок, поверхность стоит (звезда не поворачивается), идут часы события
    if (playing) { if (evActive) { t += dt * st.speed; if (t >= cyc) { evActive = false; t = 0; evBtn(); } } else t = (t + dt * st.speed) % cyc; }   // событие — один раз
    const evOn = st.mode !== 'sn' && evActive && (st.flares || st.cme);   // после проверки конца события (разбор Codex: иначе лишний кадр с t = 0)
    if (playing) { if (!evOn) simT += dtPh * st.speed; $('scrub').value = t; }
    $('scrubO').textContent = t.toFixed(1); $('scrub').max = cyc;
    const px = view.clientHeight / (2 * Math.tan(cam.fov * Math.PI / 360));
    // камера — до обновления звезды (уровень детализации берёт её положение); полёт к событию — плавно (smoothstep), дистанция — по логарифму
    // полёт — по времени кадров (шаг ≤ 0,1 с): после свёрнутой вкладки — не перескок
    if (camFly) { camFly.k = Math.min(1, camFly.k + dt * 1000 / camFly.dur); const k = camFly.k, s2 = k * k * (3 - 2 * k), F = camFly;
      const C = orbitDir(F.cy0 + F.cdy * s2, F.cp0 + (F.p1 - F.cp0) * s2).multiplyScalar(F.r0 * Math.pow(F.r1 / F.r0, s2));
      orbit.yaw = F.dy0 + F.ddy * s2; orbit.pitch = F.dp0 + (F.p1 - F.dp0) * s2; orbit.dist = F.L0 * Math.pow(F.r1 / F.L0, s2);
      orbit.T.copy(C).addScaledVector(orbitDir(orbit.yaw, orbit.pitch), -orbit.dist); if (k >= 1) { orbit.T.set(0, 0, 0); camFly = null; } }
    { const cp = Math.cos(orbit.pitch); cam.position.set(Math.sin(orbit.yaw) * cp * orbit.dist, Math.sin(orbit.pitch) * orbit.dist, Math.cos(orbit.yaw) * cp * orbit.dist).add(orbit.T);
      if (st.mode !== 'sn' && cam.position.length() < STAR_DMIN) cam.position.setLength(STAR_DMIN);   // и при сдвиге цели — не ближе 3 R★ к центру
      cam.lookAt(orbit.T); cam.updateMatrixWorld(); }
    const tu0 = performance.now();
    const f = star.update(st.mode === 'sn' ? 99 : t, simT, px, 1, 1, { cam: star.group.worldToLocal(cam.position.clone()), realDt: dt });
    const ev = corona && corona.setEvent ? corona.setEvent(evOn && star.poles.length >= 2 ? { t, cyc, tDyn: effStar().tDyn, flare: !!st.flares, cme: !!st.cme, P0: star.poles[0].p, P1: star.poles[1].p, rope: star.rope } : null) : null;
    cpu.update = cpu.update * 0.9 + (performance.now() - tu0) * 0.1; cpu.frame = cpu.frame * 0.95 + dtW * 1000 * 0.05;   // камера — в системе звезды (вращение)   // камера — в системе звезды (группа в начале координат); реальное время кадра — для детализации на паузе
    if (now - lastStats > 1000) { lastStats = now; stats(); }
    let ph = 'спокойно';   // прежний сценарный цикл модели звезды в строке не показывается: событие — по кнопке
    if (ev) ph = (st.flares && st.cme ? 'вспышка и выброс' : st.flares ? 'вспышка' : 'выброс') + ` · ${Math.floor(ev.tau / 60)} мин после начала (поверхность стоит)`;
    if (sn) { const s = sn.update(t, px, 1); star.group.scale.setScalar(Math.max(1e-4, s.starScale)); star.group.visible = s.starScale > 0.002; star.setLook({ bright: effStar().bright * s.boost });
      ph = t < effSn().collapseAt ? 'перед коллапсом' : t < effSn().collapseAt + 3 ? 'коллапс, ударная волна' : 'расширение выброса'; }
    else { star.group.scale.setScalar(1); star.group.visible = true; }
    const sf = star.surface && star.surface(), day = sf ? ` · поверхность: сутки ${Math.floor(sf.clock / 24) + 1}, ${Math.floor(sf.clock % 24)} ч` : '';
    // газодинамика в трубках (разбор Codex: «Поле: снимок · Газ: 30× / фактически 28× · возраст 00:42:00 · отставание 3 с»)
    const hs = corona && corona.hydroStatus && corona.hydroStatus(), hms = x => { x = Math.max(0, Math.floor(x)); return [Math.floor(x / 3600), Math.floor(x / 60) % 60, x % 60].map(v => String(v).padStart(2, '0')).join(':'); };
    const gas = hs && hs.on ? ` · <b>поле: снимок · газ: ${hs.rate}× / фактически ${Math.round(hs.eff)}× · возраст ${hms(hs.age)} · отставание ${hs.lagReal.toFixed(1).replace('.', ',')} с · петель ${hs.n}/${hs.K}</b>${hs.err ? ` · ошибок ${hs.err}` : ''}` : '';
    $('hud').innerHTML = `<b>${st.name || st.sp}</b> · ${st.mode === 'sn' ? 'сверхновая' : 'звезда'} · t = ${t.toFixed(1)} с · ${ph}${day}${gas} · камера ${orbit.dist.toFixed(1)} R★${star.particles ? ` · частицы ${star.perf().toFixed(1)} мс/кадр` : ''} · тянуть — вращать, правая кнопка или Shift — сдвиг, колесо — дистанция, двойной щелчок — сброс`;
    profPoll(); if (star.drawSpots) timed('spotmap', () => star.drawSpots()); drawScene();
    if (corona) {
      // перестройка по ходу жизни поля (автор: «в газодинамической пятна не соответствуют?», «перескакивает одно в другое и стоит»):
      // пока идёт время — снимки полюсов и нагрева подряд, каждый считается по слою за кадр, корона непрерывно перетекает к последнему
      // готовому; время стоит — дотекает за 1 с и замирает; границы яркости — прежние
      const clk = star.surfClockView ? star.surfClockView() : star.surfClock ? star.surfClock() : 0, tc0 = performance.now();   // часы показа — между шагами поверхности
      // живая текстура нижнего слоя — каждый кадр по полюсам сейчас (автор: «можно переходы убрать с текстуры? … генерить её в риалтайме»);
      // поле стоит — дописывает круг сдвигов внутри ячейки и замирает. Объём выше — снимками с перетеканием (входы — копия живых в момент снимка)
      // входы (заряды, нагрев) — по смене часов при любых выключателях (разбор Codex: без живой текстуры нагрев объёма замирал); без текстуры — без сетки
      corona.setFrame(star.group.matrixWorld); corona.look(cam); if (corona.setPoles) corona.setPoles(star.polesView ? star.polesView() : star.poles);   // полюса показа — для оснований трубок   // система звезды и камера — до выбора плиток (видимое — чаще)
      const ch = clk !== coronaLiveClk; coronaLiveClk = clk;
      if (st.euvSurf === true || (corona.tubesOn && corona.tubesOn())) timed('surface', () => ch ? corona.live(...coronaInputs()) : corona.live(null, null));
      else if (ch) timed('heat', () => corona.inputs(...coronaInputs(), true));
      if (corona.hydroTick) corona.hydroTick(dtPh, playing);
      { const hh = hydroHold(); if (hh !== holdWas) { holdWas = hh; applyDbg(); } }   // удержание поверхности — по фактическому снимку   // газодинамика в трубках: часы газа, обмен с фоновыми потоками, смешение
      const volOn = st.euvGas !== false || corona.uniforms.uFur.value > 0;   // объём нужен газу или меху (и при трубках — для края)
      if (comp.rebake && volOn) { if (!corona.building() && clk > coronaClk && corona.beginBake()) coronaClk = clk;
        timed('rebake', () => corona.stepBake(1)); corona.stepFade(dtW, 1); }
      if (volOn) timed('emit', () => corona.emitLive(comp.emit));   // яркость короны над краем — по живому нагреву (автор: «корону живой»); выключено — только по новой форме
      cpu.snap = cpu.snap * 0.9 + (performance.now() - tc0) * 0.1;
      corona.setFrame(star.group.matrixWorld);   // звезда может вращаться: луч — в системе звезды
      if (coronaCal && view.clientWidth > 0 && now - coronaCalT > 500) { coronaCalT = now; if (corona.calibrate(cam)) coronaCal = false; }   // повтор — не чаще 2 раз в секунду
      timed('euv', () => corona.render(cam, undefined, undefined, now / 1000)); }
  }
  $('spec').value = st.sp; $('starName').value = st.name || '';
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x.dataset.mode === st.mode));
  if (st.mode === 'sn') orbit.dist = 45;
  // ---- панель «Компоненты звезды» (автор, 15.10: «выведи мне все компоненты, из которых звезда состоит, — чтоб я мог их отключать и подумать над
  // оптимизацией»): выключатели и цена — процессор (живой замер, мс на кадр) и видеокарта (по кнопке: каждая часть рисуется отдельно
  // 10 раз с ожиданием видеокарты)
  const comp = { rebake: true, emit: true }, cpu = { update: 0, snap: 0, frame: 16 }, gpuT = {};
  const COMP = [
    ['stars', 'фон звёзд', () => bgStars.visible, v => { bgStars.visible = v; }],
    ['photo', 'фотосфера (шар)', () => !star.surf || star.surf.visible, v => { if (star.surf) star.surf.visible = v; }],
    ['spots', 'пятна на фотосфере', () => !(star.debug && star.debug().noSpots), v => { compKeep = Object.assign(compKeep || {}, { noSpots: !v }); applyDbg(); }, true],
    ['gran', 'грануляция (фотосфера «как видит глаз»)', () => effStar().granPhys > 0, v => { if (!(star.phys && star.phys.eyeXY)) return; st.star.granPhys = v ? 1 : 0; star.setLook({ granPhys: st.star.granPhys }); save(); }, true],
    ['life', 'жизнь поверхности: полюса, карта (процессор)', () => !(star.debug && star.debug().noSurface), v => { compKeep = Object.assign(compKeep || {}, { noSurface: !v }); applyDbg(); }],
    ['euv', 'корона в ультрафиолете', () => st.euv !== false, v => { if ($('optEuv').checked !== v) $('optEuv').click(); }],
    ['gas', 'газ — объём над диском и краем (без него — только мех над кромкой)', () => st.euvGas !== false, v => { st.euvGas = v; if (corona) corona.uniforms.uGas.value = v ? 1 : 0; save(); }, true],
    ['fur', 'мех над краем', () => !corona || corona.uniforms.uFur.value > 0, v => { if (corona) corona.uniforms.uFur.value = v ? 1 : 0; }, true],
    ['carpet', 'магнитный ковёр — короткие петли спокойной поверхности (сеть ячеек)', () => st.euvCarpet === true, v => { st.euvCarpet = !!v; if (corona && corona.setCarpet) corona.setCarpet(v); save(); }, true],
    ['furdisk', 'мех и на диске (рисунок газа без текстуры)', () => st.euvFurDisk === true, v => { st.euvFurDisk = !!v; if (corona) corona.uniforms.uFurDisk.value = v ? 1 : 0; save(); }, true],
    ['surface', 'живая текстура нижнего слоя (каждый кадр; выключена — газ одним слоем до поверхности)', () => st.euvSurf === true, v => { st.euvSurf = !!v; if (corona) corona.uniforms.uSurfOn.value = v ? 1 : 0; save(); }, true],
    ['tone', 'тон как у снимков AIA 171 — √ яркости (выключено — логарифм: перепады сжаты)', () => st.euvTone !== 'log', v => { st.euvTone = v ? 'aia' : 'log'; if (corona && corona.setTone) corona.setTone(v); save(); }, true],
    ['emit', 'яркость объёма по живому нагреву (каждый кадр)', () => comp.emit, v => { comp.emit = v; }, true],
    ['rebake', 'форма петель объёма — снимками по ходу поля', () => comp.rebake, v => { comp.rebake = v; }, true],
    ['flares', 'вспышка (сценарная)', () => st.flares, v => { if ($('optFlares').checked !== v) $('optFlares').click(); }],
    ['cme', 'выброс (сценарный)', () => st.cme, v => { if ($('optCme').checked !== v) $('optCme').click(); }],
    ['parts', 'выброс частицами — нити волокна и брызги (как на снимках AIA)', () => st.cmeParts !== false, v => { st.cmeParts = !!v; applyChrom(); save(); }, true],
    ['dome', 'выброс — прежний светлый купол (для сравнения; свечение по закону 17,1 нм)', () => st.cmeDome === true, v => { st.cmeDome = !!v; applyChrom(); save(); }, true]];
  function compRender() {
    $('comps').innerHTML = '<span class="h">часть</span><span class="h n">процессор</span><span class="h n">видеокарта</span>' + COMP.map(([k, name, get, , sub]) =>
      `<label class="${sub ? 'sub' : ''}"><input type="checkbox" data-c="${k}"${get() ? ' checked' : ''}> ${name}</label><span class="n" id="cc_${k}"></span><span class="n" id="cg_${k}"></span>`).join(''); }
  $('comps').addEventListener('change', e => { const k = e.target.dataset.c, c = COMP.find(x => x[0] === k); if (c) { c[3](e.target.checked); setTimeout(compSync, 50); } });
  function compSync() { for (const [k, , get] of COMP) { const el = document.querySelector(`#comps input[data-c="${k}"]`); if (el) el.checked = !!get(); } }
  document.addEventListener('change', e => { if (!(e.target.closest && e.target.closest('#comps'))) setTimeout(compSync, 50); });   // флажки вне панели (ультрафиолет, глоу, …) — панель следом
  // живой процессор: жизнь поверхности (шаги полюсов и карты; текстура карты), частицы, снимок и перестройка короны (вызовы; работа — на видеокарте)
  function compCpu() { const tmg = star.timing ? star.timing() : null, f = x => x == null ? '' : x < 0.05 ? '<0,1 мс' : `${x.toFixed(1).replace('.', ',')} мс`;
    if (!$('cc_life')) return; $('cc_life').textContent = tmg ? f(tmg.surf + tmg.tex) : ''; if ($('cc_arches')) $('cc_arches').textContent = st.arches && tmg ? f(tmg.plasma) : '';
    $('cc_rebake').textContent = corona ? f(cpu.snap) : ''; $('compFps').textContent = `кадр ${f(cpu.frame)} (${(1000 / Math.max(1, cpu.frame)).toFixed(0)} к/с) · обновление звезды ${f(cpu.update)}`;
    if (prof.ext && prof.on) { const E = prof.ema, live = { stars: E.stars, photo: E.photo, spots: E.spotmap, euv: E.euv, rebake: E.rebake, surface: E.surface, emit: E.emit, arches: (E.arches || 0) + (E.field || 0), glow: E.glow, earth: E.other };
      for (const [k] of COMP) if ($('cg_' + k)) $('cg_' + k).textContent = live[k] != null ? f(live[k]) : (k === 'gran' ? 'в фотосфере' : k === 'fur' ? 'в короне' : '');
      const tot = ['stars', 'photo', 'spotmap', 'arches', 'field', 'other', 'glow', 'euv', 'rebake', 'heat', 'surface', 'emit'].reduce((a, k) => a + (E[k] || 0), 0);
      $('compFps').title = `видеокарта, всего ≈ ${tot.toFixed(1)} мс на кадр; снимок нагрева короны (раз на снимок) — ${E.heat != null ? E.heat.toFixed(2) : '—'} мс`;
      $('compFps').textContent += ` · видеокарта ≈ ${f(tot)}`; return; }
    for (const [k] of COMP) if (gpuT[k] != null && $('cg_' + k)) $('cg_' + k).textContent = f(gpuT[k]); }
  // ---- живой замер видеокарты (разбор Codex: performance.now + gl.finish — это процессор и видеокарта вместе, шумно): таймеры видеокарты
  // EXT_disjoint_timer_query_webgl2 — каждая часть рисуется отдельным проходом под своим таймером, результат читается через кадр-два
  // (без ожидания), замеры при сбое таймера (disjoint) отбрасываются; среднее — скользящее по кадрам. Нет расширения — кнопка (попарная разница)
  const prof = { gl: renderer.getContext(), ext: null, pend: [], ema: {}, on: true };
  try { prof.ext = prof.gl.getExtension('EXT_disjoint_timer_query_webgl2'); } catch (e) { prof.ext = null; }
  function timed(label, fn) { if (!prof.on || !prof.ext) return fn(); const gl = prof.gl, q = gl.createQuery(); gl.beginQuery(prof.ext.TIME_ELAPSED_EXT, q);
    try { return fn(); } finally { gl.endQuery(prof.ext.TIME_ELAPSED_EXT); prof.pend.push([label, q]); } }
  function profPoll() { if (!prof.ext) return; const gl = prof.gl, dis = gl.getParameter(prof.ext.GPU_DISJOINT_EXT), keep = [], sum = {};
    if (dis) { for (const [, q] of prof.pend) gl.deleteQuery(q); prof.pend = []; return; }   // сбой таймера — все ожидающие замеры недостоверны
    for (const [l, q] of prof.pend) { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) { if (!dis) sum[l] = (sum[l] || 0) + gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; gl.deleteQuery(q); } else keep.push([l, q]); }
    prof.pend = keep.length > 200 ? keep.slice(-200) : keep; for (const l in sum) prof.ema[l] = prof.ema[l] == null ? sum[l] : prof.ema[l] * 0.9 + sum[l] * 0.1; }
  // сцена: при замере — по частям (фон, фотосфера, прочее звезды — частицы и выброс, Земля, остальное) одним кадром без очистки между
  // проходами — картинка та же; без замера — одним проходом
  function drawScene() {
    if (st.glow) { timed('glow', () => glow.render()); return; }
    renderer.setRenderTarget(null);
    if (!prof.on || !prof.ext) { renderer.render(scene, cam); if (star.plasmaField) star.plasmaField.render(renderer, cam, null); return; }
    const vis = scene.children.map(o => o.visible), gvis = star.group.children.map(o => o.visible), ac = renderer.autoClear;
    const pass = (label, pick) => { scene.children.forEach((o, i) => { o.visible = vis[i] && pick(o, false); }); star.group.children.forEach((o, i) => { o.visible = gvis[i] && pick(o, true); });
      timed(label, () => renderer.render(scene, cam)); renderer.autoClear = false; };
    try {
      pass('stars', (o, g) => !g && o === bgStars);
      pass('photo', (o, g) => g ? o === star.surf : o === star.group);
      pass('arches', (o, g) => g ? o !== star.surf : o === star.group);
      pass('other', (o, g) => !g && o !== bgStars && o !== star.group);
    } finally { scene.children.forEach((o, i) => { o.visible = vis[i]; }); star.group.children.forEach((o, i) => { o.visible = gvis[i]; }); renderer.autoClear = ac; }
    if (star.plasmaField) timed('field', () => star.plasmaField.render(renderer, cam, null)); }
  // видеокарта без таймеров (кнопка): цена части — попарная разница: настоящий кадр целиком (тот же путь, что в frame: глоу или прямой, плотность
  // плазмы, ультрафиолет) против кадра без неё; время — с ожиданием видеокарты (gl.finish и чтение пикселя) после прогрева, 10 повторов —
  // это время процессора и видеокарты вместе, не чистое время видеокарты; перестройка короны — отдельный замер одного слоя
  function drawFrame() { if (st.glow) glow.render(); else { renderer.setRenderTarget(null); renderer.render(scene, cam); if (star.plasmaField) star.plasmaField.render(renderer, cam, null); }
    if (corona) corona.render(cam); }
  function compMeasure() {
    const gl = renderer.getContext(), px = new Uint8Array(4), T = fn => { for (let i = 0; i < 3; i++) fn(); gl.finish(); const t0 = performance.now(); for (let i = 0; i < 10; i++) fn(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return (performance.now() - t0) / 10; };
    const vis = scene.children.map(o => o.visible), gvis = star.group.children.map(o => o.visible), dbg0 = star.debug ? Object.assign({}, star.debug()) : null, g0 = effStar().granPhys,
      fur0 = corona ? corona.uniforms.uFur.value : 0, glow0 = st.glow, euv0 = corona ? corona.uniforms.uW.value : 0;
    const restore = () => { scene.children.forEach((o, i) => { o.visible = vis[i]; }); star.group.children.forEach((o, i) => { o.visible = gvis[i]; });
      if (dbg0) star.debug(dbg0); if (effStar().granPhys !== g0 || star.params.granPhys !== g0) star.setLook({ granPhys: g0 }); if (corona) corona.uniforms.uFur.value = fur0; st.glow = glow0; };
    const without = (off, on) => { off(); try { return T(drawFrame); } finally { on(); } };
    try {
      const full = gpuT.frame = T(drawFrame), d = t => Math.max(0, full - t);
      gpuT.stars = d(without(() => { bgStars.visible = false; }, restore));
      if (star.surf) gpuT.photo = d(without(() => { star.surf.visible = false; }, restore));
      if (star.debug) gpuT.spots = d(without(() => star.debug({ noSpots: true }), restore));
      if (g0 > 0 && star.phys && star.phys.eyeXY) gpuT.gran = d(without(() => star.setLook({ granPhys: 0 }), restore));
      if (corona) { const r0 = corona.render; gpuT.euv = d(without(() => { corona.render = () => 0; }, () => { corona.render = r0; restore(); }));
        gpuT.fur = d(without(() => { corona.uniforms.uFur.value = 0; }, restore)); gpuT.rebake = T(() => corona.measureLayer()); corona.prepMeasure(); gpuT.surface = T(() => corona.measureSurf()); gpuT.emit = T(() => corona.measureEmit()); }
      if (st.arches && star.particles) gpuT.arches = d(without(() => { star.group.children.forEach(o => { if (o !== star.surf) o.visible = false; }); }, restore));
      if (glow0) gpuT.glow = d(without(() => { st.glow = false; }, restore));
    } finally { restore(); }
    $('compFps').title = `весь кадр (как в обычном кадре): ${gpuT.frame.toFixed(1)} мс; цена части — разница с кадром без неё (время процессора и видеокарты вместе)`; compCpu(); }
  $('compMeasure').addEventListener('click', compMeasure);
  setInterval(() => { compCpu(); }, 500);
  window.M31Lab = { orbit, st, renderer, scene, cam, build, glow, get star() { return star; }, get corona() { return corona; } };   // для отладки из консоли
  groups(); build(); compRender(); requestAnimationFrame(frame);
})();
