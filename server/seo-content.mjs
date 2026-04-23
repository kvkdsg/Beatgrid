// server/seo-content.mjs

/**
 * SERVER-SIDE SEO CONTENT DICTIONARY (BeatGrid)
 *
 * Este archivo centraliza el contenido semántico (H1, Párrafos, CTAs) que se inyecta
 * en el HTML inicial desde middleware.mjs.
 *
 * OBJETIVO: Permitir que Google indexe "Say the word on beat" y sus variantes
 * traducidas instantáneamente, sin esperar a la hidratación de React.
 *
 * UPDATES (Production Ready):
 * - Eliminadas referencias a "recording" (ahora "use your voice").
 * - Rebranding total: Powered by Nano Banana.
 * - Palabras clave optimizadas para el nicho de juegos rítmicos vocales.
 */

// Palabras clave base que aplican globalmente
const KEYWORDS_BASE = "beatgrid, rhythm game, vocal game, beat challenge, nano banana";

const SEO_CONTENT = {
  // --- INGLÉS (Default & Fallback Global) ---
  en: {
    title: "BeatGrid - Say the Word on Beat",
    description:
      "The viral rhythm game powered by Nano Banana. Use your voice, keep the tempo, and share your flow.",
    h1: "Say the Word on Beat",
    p: "BeatGrid is the ultimate rhythm challenge. Can you keep the beat? Join the viral trend, use your voice, and say the word on beat. Powered by Nano Banana.",
    cta: "Play Now",
    keywords: `say the word on beat, word on beat, keep the tempo, ${KEYWORDS_BASE}`,
  },

  // --- ESPAÑOL ---
  es: {
    title: "BeatGrid - Di la palabra al ritmo",
    description:
      "El juego de ritmo viral impulsado por Nano Banana. Usa tu voz, mantén el tempo y comparte tu flow.",
    h1: "Di la palabra al ritmo",
    p: "BeatGrid es el desafío rítmico definitivo. ¿Puedes mantener el beat? Usa tu voz para jugar al juego viral del momento. Di la palabra al ritmo. Impulsado por Nano Banana.",
    cta: "Jugar Ahora",
    keywords: `di la palabra al ritmo, palabra al ritmo, juego de voz, ${KEYWORDS_BASE}`,
  },

  // --- PORTUGUÉS (Brasil) ---
  "pt-BR": {
    title: "BeatGrid - Diga a palavra no ritmo",
    description:
      "O jogo de ritmo viral criado por Nano Banana. Use sua voz, mantenha o tempo e compartilhe seu flow.",
    h1: "Diga a palavra no ritmo",
    p: "BeatGrid é o desafio rítmico definitivo. Você consegue manter a batida? Use sua voz para entrar na trend viral. Diga a palavra no ritmo. Criado por Nano Banana.",
    cta: "Jogar Agora",
    keywords: `diga a palavra no ritmo, palavra no beat, jogo de ritmo, ${KEYWORDS_BASE}`,
  },

  // --- FRANCÉS ---
  fr: {
    title: "BeatGrid - Dites le mot en rythme",
    description:
      "Le jeu de rythme viral propulsé par Nano Banana. Utilisez votre voix, gardez le tempo et partagez votre flow.",
    h1: "Dites le mot en rythme",
    p: "BeatGrid est le défi rythmique ultime. Pouvez-vous garder le rythme ? Rejoignez la tendance virale et dites le mot en rythme. Propulsé par Nano Banana.",
    cta: "Jouer Maintenant",
    keywords: `dites le mot en rythme, mot en rythme, jeu musical, ${KEYWORDS_BASE}`,
  },

  // --- ALEMÁN ---
  de: {
    title: "BeatGrid - Sag das Wort im Takt",
    description:
      "Das virale Rhythmusspiel powered by Nano Banana. Nutze deine Stimme, halte das Tempo und teile deinen Flow.",
    h1: "Sag das Wort im Takt",
    p: "BeatGrid ist die ultimative Rhythmus-Challenge. Kannst du den Takt halten? Mach mit beim viralen Trend und sag das Wort im Takt. Powered by Nano Banana.",
    cta: "Jetzt Spielen",
    keywords: `sag das wort im takt, wort im takt, rhythmus spiel, ${KEYWORDS_BASE}`,
  },

  // --- ITALIANO ---
  it: {
    title: "BeatGrid - Dì la parola a tempo",
    description:
      "Il gioco ritmico virale powered by Nano Banana. Usa la tua voce, tieni il tempo e condividi il tuo flow.",
    h1: "Dì la parola a tempo",
    p: "BeatGrid è la sfida ritmica definitiva. Riesci a tenere il ritmo? Usa la tua voce per giocare al trend virale del momento. Powered by Nano Banana.",
    cta: "Gioca Ora",
    keywords: `dì la parola a tempo, parola a tempo, gioco ritmico, ${KEYWORDS_BASE}`,
  },

  // --- RUSO ---
  ru: {
    title: "BeatGrid - Скажи слово в ритм",
    description: "Вирусная ритм-игра от Nano Banana. Используй свой голос, держи темп и делись своим флоу.",
    h1: "Скажи слово в ритм",
    p: "BeatGrid — это главный ритмический челлендж. Сможешь удержать бит? Используй свой голос в новой вирусной игре. Разработано Nano Banana.",
    cta: "Играть Сейчас",
    keywords: `скажи слово в ритм, слово в бит, ритм игра, ${KEYWORDS_BASE}`,
  },

  // --- ÁRABE (RTL manejado en middleware) ---
  ar: {
    title: "BeatGrid - قل الكلمة على الإيقاع",
    description: "لعبة الإيقاع الفيروسية بدعم من Nano Banana. استخدم صوتك، حافظ على الإيقاع وشارك إبداعك.",
    h1: "قل الكلمة على الإيقاع",
    p: "BeatGrid هو تحدي الإيقاع الأقوى. هل يمكنك الحفاظ على الإيقاع؟ انضم إلى الترند واستخدم صوتك الآن. بدعم من Nano Banana.",
    cta: "العب الآن",
    keywords: `قل الكلمة على الإيقاع, لعبة إيقاع, ${KEYWORDS_BASE}`,
  },

  // --- JAPONÉS ---
  ja: {
    title: "BeatGrid - リズムに合わせて言葉を言おう",
    description:
      "Nano Bananaがお届けするバイラルリズムゲーム。声を使って、テンポをキープして、フローを共有しよう。",
    h1: "リズムに合わせて言葉を言おう",
    p: "BeatGridは究極のリズムチャレンジです。ビートを刻めますか？バイラルトレンドに参加して、リズムに合わせて言葉を言いましょう。Powered by Nano Banana.",
    cta: "今すぐプレイ",
    keywords: `リズムに合わせて言葉を言う, リズムゲーム, 音ゲー, ${KEYWORDS_BASE}`,
  },

  // --- COREANO ---
  ko: {
    title: "BeatGrid - 비트에 맞춰 말해봐",
    description: "Nano Banana가 제공하는 바이럴 리듬 게임. 목소리를 사용하여 템포를 맞추고 플로우를 공유하세요.",
    h1: "비트에 맞춰 말해봐",
    p: "BeatGrid는 최고의 리듬 챌린지입니다. 박자를 맞출 수 있나요? 바이럴 트렌드에 참여하여 비트에 맞춰 단어를 말해보세요. Powered by Nano Banana.",
    cta: "지금 플레이",
    keywords: `비트에 맞춰 말하기, 리듬 게임, ${KEYWORDS_BASE}`,
  },

  // --- CHINO SIMPLIFICADO ---
  "zh-Hans": {
    title: "BeatGrid - 跟着节拍说单词",
    description: "由 Nano Banana 驱动的病毒式节奏游戏。使用你的声音，保持节奏，分享你的Flow。",
    h1: "跟着节拍说单词",
    p: "BeatGrid 是终极节奏挑战。你能跟上节拍吗？加入这一病毒式潮流，跟着节拍说出单词。由 Nano Banana 呈现。",
    cta: "立即开始",
    keywords: `跟着节拍说单词, 节奏游戏, 音乐游戏, ${KEYWORDS_BASE}`,
  },

  // --- TURCO ---
  tr: {
    title: "BeatGrid - Kelimeyi Ritimle Söyle",
    description: "Nano Banana tarafından sunulan viral ritim oyunu. Sesini kullan, tempoyu tut ve akışını paylaş.",
    h1: "Kelimeyi Ritimle Söyle",
    p: "BeatGrid en büyük ritim meydan okumasıdır. Ritmi tutabilir misin? Viral akıma katıl ve kelimeyi ritimle söyle. Powered by Nano Banana.",
    cta: "Şimdi Oyna",
    keywords: `kelimeyi ritimle söyle, ritim oyunu, ${KEYWORDS_BASE}`,
  },

  // --- INDONESIO ---
  id: {
    title: "BeatGrid - Ucapkan Kata Sesuai Irama",
    description:
      "Game ritme viral dipersembahkan oleh Nano Banana. Gunakan suaramu, jaga tempo, dan bagikan alunanmu.",
    h1: "Ucapkan Kata Sesuai Irama",
    p: "BeatGrid adalah tantangan ritme pamungkas. Bisakah kamu menjaga ketukan? Bergabunglah dengan tren viral ini dan ucapkan kata sesuai irama. Dipersembahkan oleh Nano Banana.",
    cta: "Main Sekarang",
    keywords: `ucapkan kata sesuai irama, game ritme, ${KEYWORDS_BASE}`,
  },

  // --- TAILANDÉS ---
  th: {
    title: "BeatGrid - พูดคำให้ตรงจังหวะ",
    description: "เกมจังหวะไวรัลที่ขับเคลื่อนโดย Nano Banana ใช้เสียงของคุณ รักษาจังหวะ และแชร์โฟลว์ของคุณ",
    h1: "พูดคำให้ตรงจังหวะ",
    p: "BeatGrid คือความท้าทายด้านจังหวะขั้นสูงสุด คุณรักษาจังหวะได้ไหม? เข้าร่วมเทรนด์ไวรัลและพูดคำให้ตรงจังหวะ ขับเคลื่อนโดย Nano Banana",
    cta: "เล่นเลย",
    keywords: `พูดคำให้ตรงจังหวะ, เกมดนตรี, ${KEYWORDS_BASE}`,
  },

  // --- VIETNAMITA ---
  vi: {
    title: "BeatGrid - Nói từ theo nhịp",
    description:
      "Trò chơi nhịp điệu viral được phát triển bởi Nano Banana. Sử dụng giọng nói, giữ nhịp độ và chia sẻ flow của bạn.",
    h1: "Nói từ theo nhịp",
    p: "BeatGrid là thử thách nhịp điệu đỉnh cao. Bạn có thể giữ nhịp không? Tham gia xu hướng viral và nói từ theo nhịp ngay. Được phát triển bởi Nano Banana.",
    cta: "Chơi Ngay",
    keywords: `nói từ theo nhịp, trò chơi nhịp điệu, ${KEYWORDS_BASE}`,
  },
};

/**
 * Recupera los datos SEO para un idioma específico de manera segura.
 * Si el idioma no existe, retorna Inglés (Default) para garantizar
 * que siempre haya contenido indexable.
 *
 * STATE OF THE ART (NO FUNCTIONAL IMPACT):
 * - Normaliza variantes comunes: underscore, case, subtags (es-MX), y zh-Hans-CN.
 *
 * @param {string} lang - Código de idioma (ej: 'es', 'en', 'pt-BR')
 * @returns {object} Objeto con title, description, h1, p, cta, keywords
 */
export const getSeoData = (lang) => {
  const raw = String(lang || "").trim();
  if (!raw) return SEO_CONTENT["en"];

  // 1) Normalización suave (compat): underscore -> dash
  const normalized = raw.replace(/_/g, "-");

  // 2) Match directo
  if (SEO_CONTENT[normalized]) return SEO_CONTENT[normalized];

  // 3) Match case-insensitive, sin reescribir keys del diccionario
  const lowerToRealKey = Object.keys(SEO_CONTENT).reduce((acc, k) => {
    acc[k.toLowerCase()] = k;
    return acc;
  }, {});
  const hit = lowerToRealKey[normalized.toLowerCase()];
  if (hit) return SEO_CONTENT[hit];

  // 4) Base language fallback (es-MX -> es, en-US -> en)
  const base = normalized.split("-")[0].toLowerCase();
  if (SEO_CONTENT[base]) return SEO_CONTENT[base];

  // 5) zh special-case: zh-Hans-CN, zh-CN, etc.
  if (base === "zh") {
    const n = normalized.toLowerCase();
    const hasHans = n.includes("hans");
    const hasHant = n.includes("hant");

    if (hasHans && SEO_CONTENT["zh-Hans"]) return SEO_CONTENT["zh-Hans"];
    if (hasHant && SEO_CONTENT["zh-Hant"]) return SEO_CONTENT["zh-Hant"]; // preparado si lo agregas en el futuro
    if (SEO_CONTENT["zh-Hans"]) return SEO_CONTENT["zh-Hans"];
  }

  // 6) Fallback definitivo
  return SEO_CONTENT["en"];
};
