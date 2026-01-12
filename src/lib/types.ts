

export type Asset = {
  id: string;
  name: string;
  url: string;
  createdAt: any;
  brandId?: string;
  size?: number;
  contentType?: string;
  width?: number;
  height?: number;
  isFavorite?: boolean;
};

export type Brand = {
  id: string;
  name: string;
  createdAt: any;
  userId: string;
  memories?: Memory[];
};

export type Memory = {
  id: string;
  content: string;
  type: 'manual_entry' | 'learned_fact' | 'user_feedback' | 'document_summary';
  source?: string;
  createdAt: any;
  updatedAt: any;
};

    