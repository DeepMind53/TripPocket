import { api } from './client';

/** 개선 제안 (서버 routes/suggestions.ts) */
export interface Suggestion {
  id: string;
  body: string;
  hasImage: boolean;
  status: 'new' | 'read' | 'done';
  reply: string | null;
  createdAt: string;
  repliedAt: string | null;
  /** 관리자 목록에서만 */
  author?: string;
}

export const SUGGESTION_IMAGE_MAX = 10 * 1024 * 1024;

export const suggestionsApi = {
  mine: () => api<{ suggestions: Suggestion[] }>('/api/suggestions/mine'),
  async send(body: string, image?: File): Promise<'ok' | 'too_large' | 'bad_type' | 'failed'> {
    if (image && image.size > SUGGESTION_IMAGE_MAX) return 'too_large';
    if (image && !image.type.startsWith('image/')) return 'bad_type';
    const res = await api<{ id: string }>('/api/suggestions', {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    if (!res.ok) return 'failed';
    if (image) {
      const up = await api(`/api/suggestions/${res.data.id}/image`, {
        method: 'POST',
        body: image,
        headers: { 'content-type': image.type },
      });
      if (!up.ok) return 'failed';
    }
    return 'ok';
  },
  remove: (id: string) => api(`/api/suggestions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  adminList: () => api<{ suggestions: Suggestion[] }>('/api/admin/suggestions'),
  adminUpdate: (id: string, patch: { status?: Suggestion['status']; reply?: string }) =>
    api(`/api/admin/suggestions/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify(patch),
    }),
};
