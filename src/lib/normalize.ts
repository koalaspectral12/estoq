import type { Car, DuplicateCandidate, DuplicateLevel } from '@/types/car';

export const initialForm = {
  id: '',
  name: '',
  series: '',
  color: '',
  year: '',
  notes: '',
  isFavorite: false,
  photoData: '',
  photoUrl: '',
};

export function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `car_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeText(value: string) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function similarity(a: string, b: string) {
  const first = normalizeText(a);
  const second = normalizeText(b);
  if (!first || !second) return 0;
  if (first === second) return 1;

  const aWords = new Set(first.split(' '));
  const bWords = new Set(second.split(' '));
  const intersection = [...aWords].filter((word) => bWords.has(word)).length;
  const union = new Set([...aWords, ...bWords]).size || 1;

  return intersection / union;
}

export function detectDuplicates(candidate: Pick<Car, 'id' | 'name' | 'series'>, cars: Car[], excludeId = ''): DuplicateCandidate[] {
  const name = normalizeText(candidate.name);
  const series = normalizeText(candidate.series);

  return cars
    .filter((car) => car.id !== excludeId)
    .map((car) => {
      const existingName = car.nameNormalized || normalizeText(car.name);
      const existingSeries = car.seriesNormalized || normalizeText(car.series);
      const nameScore = similarity(name, existingName);
      const sameName = !!name && name === existingName;
      const sameSeries = !!series && series === existingSeries;

      let level: DuplicateLevel = 'low';
      let score = nameScore;

      if (sameName && sameSeries) {
        level = 'high';
        score = 1;
      } else if (sameName || nameScore >= 0.85) {
        level = 'medium';
      } else if (nameScore >= 0.65) {
        level = 'low';
      } else {
        level = 'none';
      }

      return {
        id: car.id,
        name: car.name,
        series: car.series,
        color: car.color,
        level,
        score,
      };
    })
    .filter((item) => item.level !== 'none')
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export function buildCarPayload(
  form: typeof initialForm & Partial<Car>,
  existingCars: Car[],
  userId: string,
  online: boolean,
): Car {
  const now = new Date().toISOString();
  const duplicateCandidates = detectDuplicates({ id: form.id || '', name: form.name, series: form.series }, existingCars, form.id || '');

  return {
    id: form.id || createId(),
    userId,
    name: form.name,
    nameNormalized: normalizeText(form.name),
    series: form.series,
    seriesNormalized: normalizeText(form.series),
    color: form.color,
    year: form.year,
    notes: form.notes,
    isFavorite: form.isFavorite,
    photoData: form.photoData || '',
    photoUrl: form.photoUrl || '',
    syncStatus: online && userId !== 'local-user' ? 'synced' : userId === 'local-user' ? 'local' : 'pending',
    duplicateStatus: duplicateCandidates[0]?.level || 'none',
    duplicateCandidates,
    createdAt: form.createdAt || now,
    updatedAt: now,
  };
}

export async function readFileAsDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const demoCars: Car[] = [
  {
    id: 'demo-bone-shaker',
    userId: 'local-user',
    name: 'Bone Shaker',
    nameNormalized: 'bone shaker',
    series: 'HW Dream Garage',
    seriesNormalized: 'hw dream garage',
    color: 'Preto fosco com chamas',
    year: '2026',
    notes: 'Favorito da coleção',
    isFavorite: true,
    syncStatus: 'local',
    duplicateStatus: 'none',
    duplicateCandidates: [],
    photoData: '',
    photoUrl: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-twin-mill',
    userId: 'local-user',
    name: 'Twin Mill',
    nameNormalized: 'twin mill',
    series: 'HW Legends',
    seriesNormalized: 'hw legends',
    color: 'Azul metálico',
    year: '2025',
    notes: 'Comprado no shopping',
    isFavorite: false,
    syncStatus: 'local',
    duplicateStatus: 'none',
    duplicateCandidates: [],
    photoData: '',
    photoUrl: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function duplicateLabel(level: DuplicateLevel) {
  if (level === 'high') return 'Duplicado forte';
  if (level === 'medium') return 'Duplicado provável';
  if (level === 'low') return 'Parecido';
  return 'Sem risco';
}