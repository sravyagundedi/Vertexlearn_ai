export function Skeleton({
  width = '100%',
  height = '20px',
  borderRadius = '8px',
  className = '',
  style = {},
}: {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: '#e2e8f0',
        backgroundImage: 'linear-gradient(90deg, #e2e8f0 0px, #f1f5f9 40px, #e2e8f0 80px)',
        backgroundSize: '300%',
        animation: 'skeleton-shimmer 1.5s infinite linear',
        ...style,
      }}
    />
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="course-card" style={{ padding: '0', overflow: 'hidden' }}>
      <Skeleton height="160px" borderRadius="0" />
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Skeleton width="60px" height="18px" />
        <Skeleton width="85%" height="22px" />
        <Skeleton width="100%" height="40px" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
          <Skeleton width="70px" height="16px" />
          <Skeleton width="90px" height="16px" />
        </div>
        <Skeleton width="100%" height="38px" borderRadius="10px" style={{ marginTop: '12px' }} />
      </div>
    </div>
  );
}
