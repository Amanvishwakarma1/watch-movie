// Shimmering placeholders shaped like the real content, shown while the API answers.

export function BillboardSkeleton({ children }) {
  return (
    <section className="billboard billboard-skeleton" aria-busy="true">
      <div className="billboard-content">
        <div className="skeleton skeleton-line" style={{ width: '22%', height: 12 }} />
        <div className="skeleton skeleton-line" style={{ width: '70%', height: 52, marginTop: 18 }} />
        <div className="skeleton skeleton-line" style={{ width: '92%', marginTop: 22 }} />
        <div className="skeleton skeleton-line" style={{ width: '80%' }} />
        <div className="skeleton skeleton-line" style={{ width: '56%' }} />
        <div className="skeleton skeleton-button" />
        {children}
      </div>
    </section>
  );
}

export function RowSkeleton({ count = 7 }) {
  return (
    <section className="row" aria-hidden="true">
      <div className="skeleton skeleton-line row-title-skeleton" />
      <div className="row-track row-track-static">
        {Array.from({ length: count }, (_, i) => <CardSkeleton key={i} />)}
      </div>
    </section>
  );
}

export function GridSkeleton({ count = 12 }) {
  return (
    <div className="card-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}

function CardSkeleton() {
  return <div className="movie-card"><div className="card-media skeleton" /></div>;
}
