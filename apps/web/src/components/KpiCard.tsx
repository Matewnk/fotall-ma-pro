export function KpiCard({
  label,
  value,
  icon,
  alerte,
}: {
  label: string;
  value: string | number;
  icon: string;
  alerte?: boolean;
}) {
  return (
    <div className="bg-surface border border-outline-variant rounded-xl p-4 flex flex-col justify-between shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
          {label}
        </span>
        <span
          className={`material-symbols-outlined ${alerte ? 'text-alert-critical' : 'text-on-surface-variant'}`}
        >
          {icon}
        </span>
      </div>
      <span className="text-3xl font-bold text-on-background">{value}</span>
    </div>
  );
}
