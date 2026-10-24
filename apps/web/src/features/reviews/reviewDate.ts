/** "2026.10.24" */
export const reviewDate = (iso: string) => iso.slice(0, 10).replaceAll('-', '.');
