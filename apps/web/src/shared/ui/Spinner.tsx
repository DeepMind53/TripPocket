export function Spinner({ label = '처리 중' }: { label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className="inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}
