// Petits utilitaires de téléchargement/ouverture partagés entre écrans
// consommant des réponses binaires (apiFetchBlob) : tickets (011),
// rapports (014). Isolés ici dès leur deuxième usage concret.
export function ouvrirBlobDansNouvelOnglet(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function declencherTelechargement(blob: Blob, nomFichier: string): void {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}
