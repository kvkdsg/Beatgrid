interface SpritesheetResponse {
  url: string; 
  cached: boolean;
}

interface ErrorResponse {
  error: string;
}

export const generateGameSpritesheet = async (words: string[]): Promise<string> => {
  if (!words || words.length !== 4) {
    console.warn("Validación fallida: Se requieren exactamente 4 palabras.");
    return "/presets/copa-ropa-sopa-loca.webp"; 
  }

  try {
    const response = await fetch('/api/spritesheet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ words }),
    });

    if (!response.ok) {
      let errorMessage = `Server Error (${response.status})`;
      try {
        const errorBody = await response.json() as ErrorResponse;
        if (errorBody.error) errorMessage = errorBody.error;
      } catch { /* ignore */ }
      throw new Error(errorMessage);
    }

    const data = await response.json() as SpritesheetResponse;

    if (!data.url) {
      throw new Error("La respuesta del servidor no contiene una URL válida.");
    }

    return data.url;

  } catch (error) {
    console.error("Error obteniendo spritesheet:", error);
    throw error;
  }
};