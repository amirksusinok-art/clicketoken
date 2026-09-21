export interface UpgradeConfig {
  level: number;
  earnPerClick: number;
  cost: number;
  title: string;
}

export const UPGRADES: UpgradeConfig[] = [
  { level: 1, earnPerClick: 0.001, cost: 0, title: 'Базовый клик' },
  { level: 2, earnPerClick: 0.002, cost: 0.015, title: 'Медный контакт' },
  { level: 3, earnPerClick: 0.004, cost: 0.050, title: 'Бронзовый молот' },
  { level: 4, earnPerClick: 0.008, cost: 0.150, title: 'Серебряный импульс' },
  { level: 5, earnPerClick: 0.016, cost: 0.400, title: 'Золотая искра' },
  { level: 6, earnPerClick: 0.032, cost: 1.000, title: 'Платиновый резонанс' },
  { level: 7, earnPerClick: 0.064, cost: 2.500, title: 'Титановый пресс' },
  { level: 8, earnPerClick: 0.128, cost: 6.000, title: 'Неоновый разряд' },
  { level: 9, earnPerClick: 0.256, cost: 15.000, title: 'Квантовый датчик' },
  { level: 10, earnPerClick: 0.500, cost: 35.000, title: 'Плазменный генератор' },
  { level: 11, earnPerClick: 1.000, cost: 80.000, title: 'Кибернетический усилитель' },
  { level: 12, earnPerClick: 2.000, cost: 180.000, title: 'Сингулярный наноматрикс' },
  { level: 13, earnPerClick: 5.000, cost: 400.000, title: 'Антигравитационный бур' },
  { level: 14, earnPerClick: 10.000, cost: 1000.000, title: 'Звёздный реактор' },
  { level: 15, earnPerClick: 25.000, cost: 2500.000, title: 'Властелин Токенов' },
];

export function getNextUpgrade(currentLevel: number): UpgradeConfig | null {
  return UPGRADES.find((u) => u.level === currentLevel + 1) || null;
}
