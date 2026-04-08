export const STORAGE_KEYS = {
  SELECTED_DOCTOR: 'star_dental_selected_doctor',
  CONFIG: 'star_dental_config_v5_0',
  WEEKDAY_PREFIX: 'star_dental_weekday_',
} as const;

export const weekdayKey = (empId: string): string =>
  `${STORAGE_KEYS.WEEKDAY_PREFIX}${empId}`;
