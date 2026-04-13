interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const getVisiblePages = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 32,
    }}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        style={{
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: currentPage === 1 ? '#f5f5f5' : '#fff',
          color: currentPage === 1 ? '#999' : 'var(--text)',
          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
          fontSize: 14,
          fontWeight: 600,
          transition: 'all 0.2s',
        }}>
        ← 이전
      </button>

      {visiblePages.map((page, idx) => (
        <button
          key={idx}
          onClick={() => typeof page === 'number' && onPageChange(page)}
          disabled={page === '...'}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: page === currentPage ? 'none' : '1px solid var(--border)',
            background: page === currentPage ? 'var(--primary)' : '#fff',
            color: page === currentPage ? '#fff' : 'var(--text)',
            cursor: page === '...' ? 'default' : 'pointer',
            fontSize: 13,
            fontWeight: page === currentPage ? 700 : 600,
            minWidth: 36,
            transition: 'all 0.2s',
          }}>
          {page}
        </button>
      ))}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        style={{
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: currentPage === totalPages ? '#f5f5f5' : '#fff',
          color: currentPage === totalPages ? '#999' : 'var(--text)',
          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
          fontSize: 14,
          fontWeight: 600,
          transition: 'all 0.2s',
        }}>
        다음 →
      </button>
    </div>
  );
}
