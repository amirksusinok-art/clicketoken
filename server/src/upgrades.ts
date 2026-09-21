export interface UpgradeConfig {
  level: number;
  earnPerClick: number;
  cost: number;
  title: string;
}

export const UPGRADES: UpgradeConfig[] = [
  { level: 1, earnPerClick: 0.00001, cost: 0, title: 'Микро-клик' },
  { level: 2, earnPerClick: 0.00002, cost: 0.0003, title: 'Медный контакт' },
  { level: 3, earnPerClick: 0.00003, cost: 0.0010, title: 'Бронзовый молот' },
  { level: 4, earnPerClick: 0.00005, cost: 0.0030, title: 'Серебряный импульс' },
  { level: 5, earnPerClick: 0.00008, cost: 0.0080, title: 'Золотая искра' },
  { level: 6, earnPerClick: 0.00012, cost: 0.0200, title: 'Платиновый резонанс' },
  { level: 7, earnPerClick: 0.00018, cost: 0.0500, title: 'Титановый пресс' },
  { level: 8, earnPerClick: 0.00028, cost: 0.1200, title: 'Неоновый разряд' },
  { level: 9, earnPerClick: 0.00042, cost: 0.2800, title: 'Квантовый датчик' },
  { level: 10, earnPerClick: 0.00065, cost: 0.6000, title: 'Плазменный генератор' },
  { level: 11, earnPerClick: 0.00100, cost: 1.3000, title: 'Кибернетический усилитель' },
  { level: 12, earnPerClick: 0.00150, cost: 2.8000, title: 'Сингулярный наноматрикс' },
  { level: 13, earnPerClick: 0.00220, cost: 5.5000, title: 'Магнитный катализатор' },
  { level: 14, earnPerClick: 0.00320, cost: 10.0000, title: 'Фотонный модулятор' },
  { level: 15, earnPerClick: 0.00450, cost: 18.0000, title: 'Термоядерная матрица' },
  { level: 16, earnPerClick: 0.00620, cost: 30.0000, title: 'Ионный конвертер' },
  { level: 17, earnPerClick: 0.00850, cost: 45.0000, title: 'Хроно-резонатор' },
  { level: 18, earnPerClick: 0.01150, cost: 65.0000, title: 'Антигравитационный бур' },
  { level: 19, earnPerClick: 0.01550, cost: 90.0000, title: 'Тахионный ускоритель' },
  { level: 20, earnPerClick: 0.02050, cost: 125.0000, title: 'Звёздный реактор' },
  { level: 21, earnPerClick: 0.02650, cost: 170.0000, title: 'Гравитационная линза' },
  { level: 22, earnPerClick: 0.03350, cost: 220.0000, title: 'Темная материя' },
  { level: 23, earnPerClick: 0.04100, cost: 280.0000, title: 'Нейросетевое ядро' },
  { level: 24, earnPerClick: 0.04600, cost: 350.0000, title: 'Абсолютный кристалл' },
  { level: 25, earnPerClick: 0.05000, cost: 450.0000, title: 'Властелин Токенов' },
];

export function getNextUpgrade(currentLevel: number): UpgradeConfig | null {
  return UPGRADES.find((u) => u.level === currentLevel + 1) || null;
}
