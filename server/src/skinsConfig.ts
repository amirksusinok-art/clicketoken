export interface SkinItem {
  id: string;
  type: 'coin' | 'plane';
  name: string;
  cost: number; // 0 = default
  description: string;
  accentColor: string;
  glowColor: string;
}

export const SKINS_CATALOG: SkinItem[] = [
  // Coin Skins
  {
    id: 'default',
    type: 'coin',
    name: 'Золотой Токен',
    cost: 0,
    description: 'Стандартная чеканная золотая монета с зеркальным блеском.',
    accentColor: '#eab308',
    glowColor: '#ca8a04',
  },
  {
    id: 'cyberpunk',
    type: 'coin',
    name: 'Киберпанк Неон',
    cost: 15.0,
    description: 'Неоновая монета с импульсными разрядами и цифровым ядром.',
    accentColor: '#06b6d4',
    glowColor: '#a855f7',
  },
  {
    id: 'bitcoin',
    type: 'coin',
    name: 'Золотой Биткоин',
    cost: 40.0,
    description: 'Премиальная монета с символом BTC и золотым фонтаном искр.',
    accentColor: '#f59e0b',
    glowColor: '#ea580c',
  },
  {
    id: 'meteorite',
    type: 'coin',
    name: 'Космический метеорит',
    cost: 100.0,
    description: 'Редчайший астероид с раскалёнными лавовыми трещинами.',
    accentColor: '#ef4444',
    glowColor: '#b91c1c',
  },

  // Airplane 3D Skins
  {
    id: 'default',
    type: 'plane',
    name: 'Синий Сокол',
    cost: 0,
    description: 'Базовый скоростной истребитель небесно-голубого цвета.',
    accentColor: '#0284c7',
    glowColor: '#38bdf8',
  },
  {
    id: 'stealth',
    type: 'plane',
    name: 'Стелс Невидимка',
    cost: 30.0,
    description: 'Матовое карбоновое покрытие и фиолетовые инверсионные следы.',
    accentColor: '#18181b',
    glowColor: '#a855f7',
  },
  {
    id: 'dragon',
    type: 'plane',
    name: 'Огненный дракон',
    cost: 80.0,
    description: 'Кроваво-красный корпус и пламенные следы сверхзвука.',
    accentColor: '#dc2626',
    glowColor: '#f97316',
  },
];

export function getSkinById(id: string, type: 'coin' | 'plane'): SkinItem | undefined {
  return SKINS_CATALOG.find((s) => s.id === id && s.type === type);
}
