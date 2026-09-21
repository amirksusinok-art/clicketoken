export interface VideoCardTier {
  level: number;
  name: string;
  icon: string;
  earnPerHour: number;
  storageHours: number;
  cost: number;
  description: string;
}

export const VIDEO_CARDS: VideoCardTier[] = [
  {
    level: 1,
    name: 'GTX 1060 6GB',
    icon: '⚡',
    earnPerHour: 0.05,
    storageHours: 3,
    cost: 1.0,
    description: 'Надёжная классика для старта оффлайн-добычи.',
  },
  {
    level: 2,
    name: 'RTX 2060 Super',
    icon: '🔥',
    earnPerHour: 0.2,
    storageHours: 4,
    cost: 5.0,
    description: 'Тензорные ядра ускоряют майнинг в 4 раза.',
  },
  {
    level: 3,
    name: 'RTX 3070 Ti Turbo',
    icon: '🌪️',
    earnPerHour: 0.75,
    storageHours: 5,
    cost: 20.0,
    description: 'Мощная система охлаждения и стабильный пассивный поток.',
  },
  {
    level: 4,
    name: 'RTX 4090 OC Liquid',
    icon: '💎',
    earnPerHour: 2.5,
    storageHours: 6,
    cost: 75.0,
    description: 'Флагман на водяном охлаждении для солидной криптофермы.',
  },
  {
    level: 5,
    name: 'H100 AI Cluster',
    icon: '🚀',
    earnPerHour: 8.0,
    storageHours: 7,
    cost: 250.0,
    description: 'Промышленный серверный кластер для взрывной добычи.',
  },
  {
    level: 6,
    name: 'Quantum Rig 9000',
    icon: '🪐',
    earnPerHour: 25.0,
    storageHours: 8,
    cost: 800.0,
    description: 'Квантовый суперкомпьютер. Максимальный доход и 8 часов оффлайна.',
  },
];

export function getCardByLevel(level: number): VideoCardTier | undefined {
  return VIDEO_CARDS.find((c) => c.level === level);
}
