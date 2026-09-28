export function StatTile({
  value,
  label,
  highlight = false,
}: {
  value: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-card ${
        highlight
          ? "border-transparent bg-gradient-to-br from-brand-pink to-brand-pinkDark text-white"
          : "border-line bg-white text-ink"
      }`}
    >
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className={`mt-1 text-xs font-medium ${highlight ? "text-white/85" : "text-muted"}`}>{label}</div>
    </div>
  );
}
