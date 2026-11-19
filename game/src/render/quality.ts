export type QualityName = 'low' | 'medium' | 'high';

export interface Quality {
  name: QualityName;
  pixelRatioCap: number;
  renderScale: number;
  shadows: boolean;
  shadowSize: number;
  eyeShadow: boolean;
  ao: boolean;
  bloom: boolean;
  dof: boolean;
  extraLights: boolean;
  paperCount: number;
  dustCount: number;
}

export const QUALITY: Record<QualityName, Quality> = {
  low: {
    name: 'low',
    pixelRatioCap: 1,
    renderScale: 0.75,
    shadows: false,
    shadowSize: 1024,
    eyeShadow: false,
    ao: false,
    bloom: true,
    dof: false,
    extraLights: false,
    paperCount: 60,
    dustCount: 500,
  },
  medium: {
    name: 'medium',
    pixelRatioCap: 1.25,
    renderScale: 1,
    shadows: true,
    shadowSize: 2048,
    eyeShadow: false,
    ao: false,
    bloom: true,
    dof: false,
    extraLights: true,
    paperCount: 120,
    dustCount: 1200,
  },
  high: {
    name: 'high',
    pixelRatioCap: 2,
    renderScale: 1,
    shadows: true,
    shadowSize: 2048,
    eyeShadow: true,
    ao: true,
    bloom: true,
    dof: true,
    extraLights: true,
    paperCount: 160,
    dustCount: 2000,
  },
};
