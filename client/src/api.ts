const API_BASE = 'http://localhost:8000/api';

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
  createdAt: string;
  tags: TerminologyTag[];
}

export interface WeekData {
  id: number;
  weekStr: string;
  notesHeight: number;
}

export const api = {
  async getWeekData(weekStr: string): Promise<{ week: WeekData, images: BoardImage[] }> {
    const res = await fetch(`${API_BASE}/weeks/${weekStr}`);
    if (!res.ok) throw new Error('Failed to fetch week data');
    return res.json();
  },

  async updateNotesHeight(weekStr: string, height: number): Promise<void> {
    const res = await fetch(`${API_BASE}/weeks/${weekStr}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notesHeight: height }),
    });
    if (!res.ok) throw new Error('Failed to update notes height');
  },

  async uploadImage(weekStr: string, dayOfWeek: number, file: File, language: string = 'zh'): Promise<{ image: BoardImage }> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('weekStr', weekStr);
    formData.append('dayOfWeek', dayOfWeek.toString());
    formData.append('language', language);

    const res = await fetch(`${API_BASE}/images`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload image');
    return res.json();
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
  }
};
