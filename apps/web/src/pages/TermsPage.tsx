import { Link } from 'react-router-dom';

// Contenu juridique provisoire — à remplacer par le texte définitif validé
// par le porteur du produit avant toute mise en production réelle.
export function TermsPage() {
  return (
    <div className="min-h-screen bg-surface-container-low px-4 py-12">
      <div className="mx-auto max-w-2xl bg-surface border border-outline-variant rounded-2xl p-8 shadow-sm">
        <Link to="/inscription" className="text-sm text-primary underline">
          ← Retour à l'inscription
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-on-surface">
          Conditions générales d'utilisation
        </h1>
        <p className="mt-4 text-sm text-on-surface-variant">
          Ce contenu est en cours de rédaction. Fotall-Ma Pro est un logiciel de gestion
          professionnelle destiné aux pressings, laveries et activités de nettoyage. En créant un
          compte, vous acceptez d'utiliser le service conformément à sa destination, dans le respect
          des lois applicables et des droits des autres tenants de la plateforme.
        </p>
      </div>
    </div>
  );
}
