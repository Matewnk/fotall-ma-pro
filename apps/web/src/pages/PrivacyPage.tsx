import { Link } from 'react-router-dom';

// Contenu juridique provisoire — à remplacer par le texte définitif validé
// par le porteur du produit avant toute mise en production réelle.
export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface-container-low px-4 py-12">
      <div className="mx-auto max-w-2xl bg-surface border border-outline-variant rounded-2xl p-8 shadow-sm">
        <Link to="/inscription" className="text-sm text-primary underline">
          ← Retour à l'inscription
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-on-surface">Politique de confidentialité</h1>
        <p className="mt-4 text-sm text-on-surface-variant">
          Ce contenu est en cours de rédaction. Les données de votre pressing (clients, commandes,
          caisse) sont isolées par tenant et ne sont jamais partagées avec un autre client de la
          plateforme. Lorsque vous vous inscrivez avec Google, votre mot de passe Google n'est
          jamais transmis ni stocké par Fotall-Ma Pro — seuls votre email, prénom et nom nous sont
          communiqués.
        </p>
      </div>
    </div>
  );
}
