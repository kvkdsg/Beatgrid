/**
 * Servicio Cliente para generación de Spritesheets.
 * Delega la petición al servidor seguro, el cual consulta Cloud Storage o Gemini.
 */

// Ahora la respuesta es simple: una URL y un flag informativo
interface SpritesheetResponse {
  url: string; 
  cached: boolean;
}

interface ErrorResponse {
  error: string;
}

export const generateGameSpritesheet = async (words: string[]): Promise<string> => {
  // Validación preventiva
  if (!words || words.length !== 4) {
    console.warn("Validación fallida: Se requieren exactamente 4 palabras.");
    // Fallback de emergencia
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
      } catch {}
      throw new Error(errorMessage);
    }

    const data = await response.json() as SpritesheetResponse;

    if (!data.url) {
      throw new Error("La respuesta del servidor no contiene una URL válida.");
    }

    // Retornamos directamente la URL (ya sea de GCS o de preset)
    return data.url;

  } catch (error) {
    console.error("Error obteniendo spritesheet:", error);
    // En caso de error total, lanzamos la excepción para que la UI la maneje (reset state)
    throw error;
  }
};