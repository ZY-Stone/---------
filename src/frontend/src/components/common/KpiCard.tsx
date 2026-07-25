export default function KpiCard({ label, value, sub, color = 'k-blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return <div className={`kpi-card ${color}`}><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div>{sub && <div className="kpi-sub" dangerouslySetInnerHTML={{ __html: sub }} />}</div>;
}
