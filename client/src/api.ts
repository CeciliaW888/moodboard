export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_BASE = `${API_BASE_URL}/api`;

export interface TerminologyTag {
  id: number;
  imageId: number;
  term: string;
  createdAt: string;
}

export interface BoardImage {
  id: number;
  url: string;
  weekStr: string;
  dayOfWeek: number;
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt: string;
  tags: TerminologyTag[];
}

export interface WeekData {
  id: number;
  weekStr: string;
  notesHeight: number;
  notes: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  async getWeekData(weekStr: string): Promise<{ week: WeekData, images: BoardImage[] }> {
    const res = await fetch(`${API_BASE}/weeks/${weekStr}`);
    return handleResponse(res);
  },

  async updateNotesHeight(weekStr: string, height: number): Promise<void> {
    const res = await fetch(`${API_BASE}/weeks/${weekStr}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notesHeight: height }),
    });
    if (!res.ok) throw new Error('Failed to update notes height');
  },

  async updateNotes(weekStr: string, notes: string): Promise<void> {
    const res = await fetch(`${API_BASE}/weeks/${weekStr}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) throw new Error('Failed to update notes');
  },

  async uploadImage(
    weekStr: string,
    dayOfWeek: number,
    file: File,
    language: string = 'zh',
    position?: { x: number; y: number; width?: number; height?: number }
  ): Promise<{ image: BoardImage }> {
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 20MB.`);
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('weekStr', weekStr);
    formData.append('dayOfWeek', dayOfWeek.toString());
    formData.append('language', language);
    if (position) {
      formData.append('x', position.x.toString());
      formData.append('y', position.y.toString());
      if (position.width) formData.append('width', position.width.toString());
      if (position.height) formData.append('height', position.height.toString());
    }

    const res = await fetch(`${API_BASE}/images`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(res);
  },

  async updateImagePosition(
    id: number,
    pos: { x?: number; y?: number; width?: number; height?: number }
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/images/${id}/position`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pos),
    });
    if (!res.ok) throw new Error('Failed to update image position');
  },

  async retagImage(imageId: number, language: string): Promise<{ tags: TerminologyTag[] }> {
    const res = await fetch(`${API_BASE}/images/${imageId}/retag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language }),
    });
    return handleResponse(res);
  },

  async deleteTerm(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/terms/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete term');
  },

  async deleteImage(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/images/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete image');
  },

  async getImageDates(month: string): Promise<{ dates: string[] }> {
    const res = await fetch(`${API_BASE}/images/dates?month=${encodeURIComponent(month)}`);
    return handleResponse(res);
  },

  async clearWeek(weekStr: string): Promise<void> {
    const res = await fetch(`${API_BASE}/weeks/${weekStr}/images`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to clear week');
  },
};
