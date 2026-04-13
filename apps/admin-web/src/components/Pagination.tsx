export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    range.forEach(i => {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    });

    return rangeWithDots;
  };

  const pages = getPageNumbers();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: '12px 0',
    }}>
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        style={{
          padding: '6px 12px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: currentPage === 1 ? '#f1f5f9' : '#fff',
          color: currentPage === 1 ? 'var(--text-sub)' : 'var(--text)',
          cursor: currentPage === 1 ? 'default' : 'pointer',
          fontSize: 12,
          fontWeight: 600,
          transition: 'all 0.12s',
        }}
      >
        ←
      </button>

      {pages.map((page, idx) => (
        <button
          key={idx}
          onClick={() => typeof page === 'number' && onPageChange(page)}
          disabled={page === '...'}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: page === currentPage ? `1px solid var(--primary)` : '1px solid var(--border)',
            background: page === currentPage ? 'var(--primary)' : '#fff',
            color: page === currentPage ? '#fff' : 'var(--text)',
            cursor: page === '...' ? 'default' : 'pointer',
            fontSize: 12,
            fontWeight: page === currentPage ? 700 : 600,
            transition: 'all 0.12s',
            minWidth: 32,
            textAlign: 'center',
          }}
        >
          {page}
        </button>
      ))}

      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        style={{
          padding: '6px 12px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: currentPage === totalPages ? '#f1f5f9' : '#fff',
          color: currentPage === totalPages ? 'var(--text-sub)' : 'var(--text)',
          cursor: currentPage === totalPages ? 'default' : 'pointer',
          fontSize: 12,
          fontWeight: 600,
          transition: 'all 0.12s',
        }}
      >
        →
      </button>
    </div>
  );
}
