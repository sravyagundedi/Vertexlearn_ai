export function Badge({
  label,
  variant = 'blue',
  icon,
}: {
  label: string;
  variant?: 'blue' | 'teal' | 'amber' | 'purple' | 'rose' | 'slate';
  icon?: React.ReactNode;
}) {
  return (
    <span className={`badge badge-${variant}`}>
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      {label}
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const d = (difficulty || 'beginner').toLowerCase();
  const variant =
    d === 'beginner' ? 'teal' : d === 'intermediate' ? 'blue' : 'purple';
  return <Badge label={difficulty || 'Beginner'} variant={variant} />;
}
