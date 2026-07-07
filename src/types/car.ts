export type DuplicateLevel = 'none' | 'low' | 'medium' | 'high';

export interface DuplicateCandidate {
  id: string;
  name: string;
  series: string;
  color: string;
  level: DuplicateLevel;
  score: number;
}

export interface Car {
  id: string;
  userId: string;
  name: string;
  nameNormalized: string;
  series: string;
  seriesNormalized: string;
  color: string;
  year: string;
  notes: string;
  isFavorite: boolean;
  photoData?: string;
  photoUrl?: string;
  syncStatus: 'pending' | 'synced' | 'local';
  duplicateStatus: DuplicateLevel;
  duplicateCandidates: DuplicateCandidate[];
  createdAt: string;
  updatedAt: string;
}