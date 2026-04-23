export type Preset = {
  id: string;
  words: [string, string, string, string];
  spritesheetUrl: string;
};

export const PRESETS: Preset[] = [
  {
    id: "copa-ropa-sopa-loca",
    words: ["copa", "ropa", "sopa", "loca"],
    spritesheetUrl: "/presets/copa-ropa-sopa-loca.webp",
  },
  {
    id: "oso-pozo-gozo-lobo",
    words: ["oso", "pozo", "gozo", "lobo"],
    spritesheetUrl: "/presets/oso-pozo-gozo-lobo.webp",
  },
  {
    id: "puerro-perro-furro-curro",
    words: ["puerro", "perro", "furro", "curro"],
    spritesheetUrl: "/presets/puerro-perro-furro-curro.webp",
  },
  {
    id: "globo-lobo-cloro-loro",
    words: ["globo", "lobo", "cloro", "loro"],
    spritesheetUrl: "/presets/globo-lobo-cloro-loro.webp",
  },
  {
    id: "cabra-cobre-cobra-carro",
    words: ["cabra", "cobre", "cobra", "carro"],
    spritesheetUrl: "/presets/cabra-cobre-cobra-carro.webp",
  },
  {
    id: "caja-faja-paja-zanja",
    words: ["caja", "faja", "paja", "zanja"],
    spritesheetUrl: "/presets/caja-faja-paja-zanja.webp",
  },
];

/**
 * Normalización de Palabras (Frontend).
 * Sincronizada 100% con la lógica del backend para garantizar coincidencia de Hashes/Presets.
 * 
 * Cambios Clave:
 * 1. Usa `normalize("NFC")` en lugar de NFD+Replace. Esto preserva acentos y caracteres 
 *    complejos (ej: Vietnamita, Turco) necesarios para el significado, y mantiene
 *    la integridad de logogramas CJK.
 * 2. Mantiene `toLowerCase()` para case-insensitivity.
 */
export const normalizeWord = (s: string) =>
  s.trim().toLowerCase().normalize("NFC");

/** Genera la clave única para un set de palabras */
export const wordsKey = (words: string[]) =>
  words.map(normalizeWord).join("|");

// Mapa optimizado para búsqueda O(1)
const PRESET_BY_KEY = new Map(PRESETS.map((p) => [wordsKey(p.words), p]));

export const findPreset = (words: string[]) => PRESET_BY_KEY.get(wordsKey(words));

export const pickRandomPreset = () => PRESETS[Math.floor(Math.random() * PRESETS.length)];

// --- LÓGICA DE NAVEGACIÓN ---

/** Obtiene el índice actual o -1 si son palabras custom */
const getCurrentIndex = (words: string[]) => {
  const currentKey = wordsKey(words);
  return PRESETS.findIndex(p => wordsKey(p.words) === currentKey);
};

export const getNextPreset = (currentWords: string[]): string[] => {
  const index = getCurrentIndex(currentWords);
  // Si no encuentra (index -1), va al 0. Si encuentra, suma 1 y hace ciclo (módulo)
  const nextIndex = (index + 1) % PRESETS.length;
  return [...PRESETS[nextIndex].words];
};

export const getPrevPreset = (currentWords: string[]): string[] => {
  const index = getCurrentIndex(currentWords);
  // Fórmula matemática para módulo negativo correcto en JS
  const prevIndex = (index - 1 + PRESETS.length) % PRESETS.length; 
  // Si estaba en custom (-1), vamos al último elemento automáticamente.
  const safeIndex = index === -1 ? PRESETS.length - 1 : prevIndex;
  return [...PRESETS[safeIndex].words];
};