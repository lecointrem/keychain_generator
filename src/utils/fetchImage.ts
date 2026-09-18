/**
 * Fetches an image (PNG/JPG/SVG...) from a URL and converts it to a data URL, so it can
 * feed the same rasterization pipeline as an uploaded file (a data: URL never taints the
 * canvas, unlike drawing a remote image directly). Only works for URLs whose server sends
 * CORS headers allowing cross-origin fetches (e.g. upload.wikimedia.org) — this is a static
 * site with no backend proxy, so a site that blocks CORS can't be fetched this way.
 */
export async function fetchImageAsDataUrl(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, { mode: 'cors' });
  } catch {
    throw new Error(
      "Impossible de récupérer cette image : le site ne l'autorise pas en cross-origin (CORS), ou l'URL est injoignable.",
    );
  }
  if (!response.ok) {
    throw new Error(`Le serveur a répondu ${response.status} pour cette URL.`);
  }
  const blob = await response.blob();
  if (blob.type.includes('html')) {
    throw new Error("Le contenu récupéré n'est pas une image (le site a probablement bloqué la requête).");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Impossible de lire l'image téléchargée."));
    reader.readAsDataURL(blob);
  });
}
