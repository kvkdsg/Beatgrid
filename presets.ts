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

export const normalizeWord = (s: string) =>
  s.trim().toLowerCase().normalize("NFC");

export const wordsKey = (words: string[]) =>
  words.map(normalizeWord).join("|");

const PRESET_BY_KEY = new Map(PRESETS.map((p) => [wordsKey(p.words), p]));

export const findPreset = (words: string[]) => PRESET_BY_KEY.get(wordsKey(words));

export const pickRandomPreset = () => PRESETS[Math.floor(Math.random() * PRESETS.length)];

const getCurrentIndex = (words: string[]) => {
  const currentKey = wordsKey(words);
  return PRESETS.findIndex(p => wordsKey(p.words) === currentKey);
};

export const getNextPreset = (currentWords: string[]): string[] => {
  const index = getCurrentIndex(currentWords);
  const nextIndex = (index + 1) % PRESETS.length;
  return [...PRESETS[nextIndex].words];
};

export const getPrevPreset = (currentWords: string[]): string[] => {
  const index = getCurrentIndex(currentWords);
  const prevIndex = (index - 1 + PRESETS.length) % PRESETS.length; 
  const safeIndex = index === -1 ? PRESETS.length - 1 : prevIndex;
  return [...PRESETS[safeIndex].words];
};