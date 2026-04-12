import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RotateCcw, Settings2, Eye, Wind, Boxes, Menu, X, Share2, Link2 } from 'lucide-react';
import { orbitCameraPosition } from '@/lib/cameraOrbit';
import { 
  BOAT_MODEL_OPTIONS,
  ISLAND_MODEL_OPTIONS,
  type BoatModelId,
  type IslandModelId,
  normalizeBoatModelId,
  ShaderControlKey,
  WaterType, 
  WATER_TYPES, 
  parseWaterType, 
  serializeWaterType,
  getWaterTypeById 
} from '@sigma-water/core';

interface WaterControlsProps {
  onParameterChange: (key: string, value: number) => void;
  onCameraChange: (x: number, y: number, z: number) => void;
  onTopDownView: () => void;
  onShaderChange?: (waterType: WaterType) => void;
  onSkyPresetChange?: (skyPresetFile: string) => void;
  onBoatModelChange?: (modelId: BoatModelId) => void;
  onIslandModelChange?: (modelId: IslandModelId) => void;
  onCollisionModeChange?: (mode: number) => void;
}

const SKY_PRESET_OPTIONS = [
  { file: 'citrus_orchard_road_puresky_1k.exr', label: 'Citrus Orchard - Pure Sky (EXR)' },
  { file: 'citrus_orchard_road_puresky_1k.hdr', label: 'Citrus Orchard - Pure Sky (HDR)' },
  { file: 'golden_gate_hills_1k.hdr', label: 'Golden Gate Hills (HDR)' },
  { file: 'kiara_1_dawn_1k.exr', label: 'Kiara Dawn (EXR)' },
  { file: 'overcast_soil_puresky_1k.hdr', label: 'Overcast Soil - Pure Sky (HDR)' },
] as const;

type SkyPresetFile = (typeof SKY_PRESET_OPTIONS)[number]['file'];

const SKY_PRESET_FILE_SET = new Set<string>(SKY_PRESET_OPTIONS.map((preset) => preset.file));

function isSkyPresetFile(value: unknown): value is SkyPresetFile {
  return typeof value === 'string' && SKY_PRESET_FILE_SET.has(value);
}

type ControlValues = {
  waterMeshScale: number;
  waveAmplitude: number;
  waveFrequency: number;
  rippleRadius: number;
  rippleStrength: number;
  rippleDamping: number;
  ripplePropagation: number;
  boatWakeStrength: number;
  boatWakeRadius: number;
  windDirection: number;
  windSpeed: number;
  crestFoamEnabled: number;
  crestFoamThreshold: number;
  foamIntensity: number;
  foamWidth: number;
  foamNoiseFactor: number;
  foamCellScale: number;
  foamShredSlope: number;
  foamFizzWeight: number;
  intersectionFoamEnabled: number;
  intersectionFoamIntensity: number;
  intersectionFoamWidth: number;
  intersectionFoamFalloff: number;
  intersectionFoamNoise: number;
  intersectionFoamVerticalRange: number;
  underwaterEnabled: number;
  underwaterTransitionDepth: number;
  underwaterFogDensity: number;
  underwaterHorizonMix: number;
  underwaterColorR: number;
  underwaterColorG: number;
  underwaterColorB: number;
    toonShadowColorR: number;
    toonShadowColorG: number;
    toonShadowColorB: number;
    toonMidColorR: number;
    toonMidColorG: number;
    toonMidColorB: number;
    toonLightColorR: number;
    toonLightColorG: number;
    toonLightColorB: number;
    causticIntensity: number;
  skyReflectionMix: number;
  normalDetailStrength: number;
  normalDistanceFalloff: number;
  depthFadeDistance: number;
  depthFadeExponent: number;
  specularIntensity: number;
  skyPresetFile: SkyPresetFile;
  boatModel: BoatModelId;
  boatX: number;
  boatZ: number;
  boatScale: number;
  boatYOffset: number;
  islandModel: IslandModelId;
  islandX: number;
  islandZ: number;
  islandScale: number;
  islandYOffset: number;
  islandShorelineBandWidth: number;
  islandShorelineFoamGain: number;
  collisionMode: number;
  showProxySpheres: number;
  cameraDistance: number;
  cameraHeight: number;
  cameraAngle: number;
  waterType: WaterType;
};

const STORAGE_KEY = 'sigma-water-controls-v1';

const DEFAULT_VALUES: ControlValues = {
  waterMeshScale: 1.0,
  waveAmplitude: 1.8,
  waveFrequency: 1.2,
  rippleRadius: 3.2,
  rippleStrength: 0.35,
  rippleDamping: 0.965,
  ripplePropagation: 0.9,
  boatWakeStrength: 0.24,
  boatWakeRadius: 2.4,
  windDirection: 45,
  windSpeed: 0.6,
  crestFoamEnabled: 1,
  crestFoamThreshold: 0.45,
  foamIntensity: 0.7,
  foamWidth: 1.0,
  foamNoiseFactor: 0.45,
  foamCellScale: 0.115,
  foamShredSlope: 0.56,
  foamFizzWeight: 0.28,
  intersectionFoamEnabled: 1,
  intersectionFoamIntensity: 1,
  intersectionFoamWidth: 1,
  intersectionFoamFalloff: 1,
  intersectionFoamNoise: 0.45,
  intersectionFoamVerticalRange: 1.8,
  underwaterEnabled: 1,
  underwaterTransitionDepth: 8,
  underwaterFogDensity: 0.32,
  underwaterHorizonMix: 0.38,
  underwaterColorR: 0.03,
  underwaterColorG: 0.16,
  underwaterColorB: 0.24,
    toonShadowColorR: 0.04,
    toonShadowColorG: 0.18,
    toonShadowColorB: 0.32,
    toonMidColorR: 0.10,
    toonMidColorG: 0.42,
    toonMidColorB: 0.62,
    toonLightColorR: 0.40,
    toonLightColorG: 0.82,
    toonLightColorB: 0.95,
    causticIntensity: 0.85,
  skyReflectionMix: 0.72,
  normalDetailStrength: 0.55,
  normalDistanceFalloff: 0.03,
  depthFadeDistance: 1.15,
  depthFadeExponent: 1.65,
  specularIntensity: 1.0,
  skyPresetFile: 'citrus_orchard_road_puresky_1k.exr',
  boatModel: 'divingBoat',
  boatX: -12,
  boatZ: -24,
  boatScale: 1,
  boatYOffset: 0.4,
  islandModel: 'boathouseIsland',
  islandX: 22,
  islandZ: 10,
  islandScale: 1,
  islandYOffset: 0,
  islandShorelineBandWidth: 0.28,
  islandShorelineFoamGain: 1.0,
  collisionMode: 0,
  showProxySpheres: 0,
  cameraDistance: 100,
  cameraHeight: 50,
  cameraAngle: 0,
  waterType: { type: 'gerstnerWaves' },
};

const PARAM_KEYS: Record<keyof ControlValues, string> = {
  waterMeshScale: 'wms',
  waveAmplitude: 'wa',
  waveFrequency: 'wf',
  rippleRadius: 'rr',
  rippleStrength: 'rs',
  rippleDamping: 'rd',
  ripplePropagation: 'rp',
  boatWakeStrength: 'bws',
  boatWakeRadius: 'bwr',
  windDirection: 'wd',
  windSpeed: 'ws',
  crestFoamEnabled: 'cfe',
  crestFoamThreshold: 'cft',
  foamIntensity: 'fi',
  foamWidth: 'fw',
  foamNoiseFactor: 'fn',
  foamCellScale: 'fcs',
  foamShredSlope: 'fss',
  foamFizzWeight: 'ffz',
  intersectionFoamEnabled: 'ife',
  intersectionFoamIntensity: 'ifi',
  intersectionFoamWidth: 'ifw',
  intersectionFoamFalloff: 'iff',
  intersectionFoamNoise: 'ifn',
  intersectionFoamVerticalRange: 'ifv',
  underwaterEnabled: 'uwe',
  underwaterTransitionDepth: 'utd',
  underwaterFogDensity: 'ufd',
  underwaterHorizonMix: 'uhm',
  underwaterColorR: 'ucr',
  underwaterColorG: 'ucg',
  underwaterColorB: 'ucb',
    toonShadowColorR: 'tsr',
    toonShadowColorG: 'tsg',
    toonShadowColorB: 'tsb',
    toonMidColorR: 'tmr',
    toonMidColorG: 'tmg',
    toonMidColorB: 'tmb',
    toonLightColorR: 'tlr',
    toonLightColorG: 'tlg',
    toonLightColorB: 'tlb',
    causticIntensity: 'ci',
  skyReflectionMix: 'srm',
  normalDetailStrength: 'nds',
  normalDistanceFalloff: 'ndf',
  depthFadeDistance: 'dfd',
  depthFadeExponent: 'dfe',
  specularIntensity: 'si',
  skyPresetFile: 'spf',
  boatModel: 'bm',
  boatX: 'bx',
  boatZ: 'bz',
  boatScale: 'bs',
  boatYOffset: 'by',
  islandModel: 'im',
  islandX: 'ix',
  islandZ: 'iz',
  islandScale: 'is',
  islandYOffset: 'iy',
  islandShorelineBandWidth: 'isb',
  islandShorelineFoamGain: 'isg',
  collisionMode: 'cm',
  showProxySpheres: 'ps',
  cameraDistance: 'cd',
  cameraHeight: 'ch',
  cameraAngle: 'ca',
  waterType: 'wt',
};

const CONTROL_KEYS = Object.keys(DEFAULT_VALUES) as Array<keyof ControlValues>;

type StartupSettingsConflict = {
  savedValues: ControlValues;
  linkValues: ControlValues;
};

type StartupSettingsResolution = {
  initialValues: ControlValues;
  conflict: StartupSettingsConflict | null;
};

function parseControlValue(key: keyof ControlValues, sourceVal: unknown): ControlValues[keyof ControlValues] | undefined {
  if (sourceVal === undefined || sourceVal === null) return undefined;

  if (key === 'waterType') {
    const typeStr =
      typeof sourceVal === 'object' && sourceVal !== null && 'type' in sourceVal
        ? String((sourceVal as { type: unknown }).type)
        : String(sourceVal);
    return parseWaterType(typeStr);
  }

  if (key === 'boatModel') {
    if (typeof sourceVal === 'string') {
      return normalizeBoatModelId(sourceVal) ?? 'divingBoat';
    }
    return 'divingBoat';
  }

  if (key === 'islandModel') {
    return sourceVal === 'lighthouseIsland' ? 'lighthouseIsland' : 'boathouseIsland';
  }

  if (key === 'skyPresetFile') {
    return isSkyPresetFile(sourceVal) ? sourceVal : DEFAULT_VALUES.skyPresetFile;
  }

  const parsed = Number(sourceVal);
  if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
    return parsed;
  }

  return undefined;
}

function buildControlValues(
  stored: Partial<ControlValues>,
  params: URLSearchParams,
  preferUrlParams: boolean
): ControlValues {
  const next: ControlValues = { ...DEFAULT_VALUES };

  CONTROL_KEYS.forEach((key) => {
    const shortKey = PARAM_KEYS[key];
    const paramVal = params.get(shortKey);
    const storedVal = stored[key] as unknown;
    const sourceVal = preferUrlParams ? (paramVal ?? storedVal) : (storedVal ?? paramVal);
    const parsed = parseControlValue(key, sourceVal);
    if (parsed !== undefined) {
      (next as Record<keyof ControlValues, unknown>)[key] = parsed;
    }
  });

  return next;
}

function hasRecognizedUrlParams(params: URLSearchParams): boolean {
  return CONTROL_KEYS.some((key) => {
    const shortKey = PARAM_KEYS[key];
    return params.has(shortKey);
  });
}

function buildSearchParamsFromValues(values: ControlValues, cleanOnly = false): URLSearchParams {
  const params = new URLSearchParams();
  CONTROL_KEYS.forEach((key) => {
    if (cleanOnly) {
      if (key === 'waterType') {
        if (serializeWaterType(values[key]) === serializeWaterType(DEFAULT_VALUES[key])) {
          return;
        }
      } else if (values[key] === DEFAULT_VALUES[key]) {
        return;
      }
    }

    if (key === 'waterType') {
      params.set(PARAM_KEYS[key], serializeWaterType(values[key]));
      return;
    }
    params.set(PARAM_KEYS[key], String(values[key]));
  });
  return params;
}

function areControlValuesEqual(a: ControlValues, b: ControlValues): boolean {
  return CONTROL_KEYS.every((key) => {
    if (key === 'waterType') {
      return serializeWaterType(a[key]) === serializeWaterType(b[key]);
    }
    return a[key] === b[key];
  });
}

function getStartupSettingsResolution(): StartupSettingsResolution {
  if (typeof window === 'undefined') {
    return {
      initialValues: DEFAULT_VALUES,
      conflict: null,
    };
  }

  let stored: Partial<ControlValues> = {};
  let hasStoredValues = false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      stored = JSON.parse(raw) as Partial<ControlValues>;
      hasStoredValues = true;
    }
  } catch {
    stored = {};
    hasStoredValues = false;
  }

  const params = new URLSearchParams(window.location.search);
  const urlHasSettings = hasRecognizedUrlParams(params);
  const savedValues = buildControlValues(stored, params, false);
  const linkValues = buildControlValues(stored, params, true);

  if (!hasStoredValues) {
    if (urlHasSettings && !areControlValuesEqual(DEFAULT_VALUES, linkValues)) {
      return {
        initialValues: DEFAULT_VALUES,
        conflict: { savedValues: DEFAULT_VALUES, linkValues },
      };
    }

    return {
      initialValues: DEFAULT_VALUES,
      conflict: null,
    };
  }

  if (urlHasSettings && !areControlValuesEqual(savedValues, linkValues)) {
    return {
      initialValues: savedValues,
      conflict: { savedValues, linkValues },
    };
  }

  return {
    initialValues: savedValues,
    conflict: null,
  };
}

export function WaterControls({ onParameterChange, onCameraChange, onTopDownView, onShaderChange, onSkyPresetChange, onBoatModelChange, onIslandModelChange, onCollisionModeChange }: WaterControlsProps) {
  const startupResolution = useState<StartupSettingsResolution>(() => getStartupSettingsResolution())[0];
  const initialValues = startupResolution.initialValues;

  const [waterMeshScale, setWaterMeshScale] = useState(initialValues.waterMeshScale);

  // Wave parameters
  const [waveAmplitude, setWaveAmplitude] = useState(initialValues.waveAmplitude);
  const [waveFrequency, setWaveFrequency] = useState(initialValues.waveFrequency);
  const [rippleRadius, setRippleRadius] = useState(initialValues.rippleRadius);
  const [rippleStrength, setRippleStrength] = useState(initialValues.rippleStrength);
  const [rippleDamping, setRippleDamping] = useState(initialValues.rippleDamping);
  const [ripplePropagation, setRipplePropagation] = useState(initialValues.ripplePropagation);
  const [boatWakeStrength, setBoatWakeStrength] = useState(initialValues.boatWakeStrength);
  const [boatWakeRadius, setBoatWakeRadius] = useState(initialValues.boatWakeRadius);
  const [windDirection, setWindDirection] = useState(initialValues.windDirection);
  const [windSpeed, setWindSpeed] = useState(initialValues.windSpeed);
  const [crestFoamEnabled, setCrestFoamEnabled] = useState(initialValues.crestFoamEnabled);
  const [crestFoamThreshold, setCrestFoamThreshold] = useState(initialValues.crestFoamThreshold);

  // Visual effects
  const [foamIntensity, setFoamIntensity] = useState(initialValues.foamIntensity);
  const [foamWidth, setFoamWidth] = useState(initialValues.foamWidth);
  const [foamNoiseFactor, setFoamNoiseFactor] = useState(initialValues.foamNoiseFactor);
  const [foamCellScale, setFoamCellScale] = useState(initialValues.foamCellScale);
  const [foamShredSlope, setFoamShredSlope] = useState(initialValues.foamShredSlope);
  const [foamFizzWeight, setFoamFizzWeight] = useState(initialValues.foamFizzWeight);
  const [intersectionFoamEnabled, setIntersectionFoamEnabled] = useState(initialValues.intersectionFoamEnabled);
  const [intersectionFoamIntensity, setIntersectionFoamIntensity] = useState(initialValues.intersectionFoamIntensity);
  const [intersectionFoamWidth, setIntersectionFoamWidth] = useState(initialValues.intersectionFoamWidth);
  const [intersectionFoamFalloff, setIntersectionFoamFalloff] = useState(initialValues.intersectionFoamFalloff);
  const [intersectionFoamNoise, setIntersectionFoamNoise] = useState(initialValues.intersectionFoamNoise);
  const [intersectionFoamVerticalRange, setIntersectionFoamVerticalRange] = useState(initialValues.intersectionFoamVerticalRange);
  const [underwaterEnabled, setUnderwaterEnabled] = useState(initialValues.underwaterEnabled);
  const [underwaterTransitionDepth, setUnderwaterTransitionDepth] = useState(initialValues.underwaterTransitionDepth);
  const [underwaterFogDensity, setUnderwaterFogDensity] = useState(initialValues.underwaterFogDensity);
  const [underwaterHorizonMix, setUnderwaterHorizonMix] = useState(initialValues.underwaterHorizonMix);
  const [underwaterColorR, setUnderwaterColorR] = useState(initialValues.underwaterColorR);
  const [underwaterColorG, setUnderwaterColorG] = useState(initialValues.underwaterColorG);
  const [underwaterColorB, setUnderwaterColorB] = useState(initialValues.underwaterColorB);
    const [toonShadowColorR, setToonShadowColorR] = useState(initialValues.toonShadowColorR);
    const [toonShadowColorG, setToonShadowColorG] = useState(initialValues.toonShadowColorG);
    const [toonShadowColorB, setToonShadowColorB] = useState(initialValues.toonShadowColorB);
    const [toonMidColorR, setToonMidColorR] = useState(initialValues.toonMidColorR);
    const [toonMidColorG, setToonMidColorG] = useState(initialValues.toonMidColorG);
    const [toonMidColorB, setToonMidColorB] = useState(initialValues.toonMidColorB);
    const [toonLightColorR, setToonLightColorR] = useState(initialValues.toonLightColorR);
    const [toonLightColorG, setToonLightColorG] = useState(initialValues.toonLightColorG);
    const [toonLightColorB, setToonLightColorB] = useState(initialValues.toonLightColorB);
    const [causticIntensity, setCausticIntensity] = useState(initialValues.causticIntensity);
  const [skyReflectionMix, setSkyReflectionMix] = useState(initialValues.skyReflectionMix);
  const [normalDetailStrength, setNormalDetailStrength] = useState(initialValues.normalDetailStrength);
  const [normalDistanceFalloff, setNormalDistanceFalloff] = useState(initialValues.normalDistanceFalloff);
  const [depthFadeDistance, setDepthFadeDistance] = useState(initialValues.depthFadeDistance);
  const [depthFadeExponent, setDepthFadeExponent] = useState(initialValues.depthFadeExponent);
  const [specularIntensity, setSpecularIntensity] = useState(initialValues.specularIntensity);
  const [skyPresetFile, setSkyPresetFile] = useState<SkyPresetFile>(initialValues.skyPresetFile);

  // Objects
  const [boatModel, setBoatModel] = useState(initialValues.boatModel);
  const [boatX, setBoatX] = useState(initialValues.boatX);
  const [boatZ, setBoatZ] = useState(initialValues.boatZ);
  const [boatScale, setBoatScale] = useState(initialValues.boatScale);
  const [boatYOffset, setBoatYOffset] = useState(initialValues.boatYOffset);
  const [islandModel, setIslandModel] = useState(initialValues.islandModel);
  const [islandX, setIslandX] = useState(initialValues.islandX);
  const [islandZ, setIslandZ] = useState(initialValues.islandZ);
  const [islandScale, setIslandScale] = useState(initialValues.islandScale);
  const [islandYOffset, setIslandYOffset] = useState(initialValues.islandYOffset);
  const [islandShorelineBandWidth, setIslandShorelineBandWidth] = useState(initialValues.islandShorelineBandWidth);
  const [islandShorelineFoamGain, setIslandShorelineFoamGain] = useState(initialValues.islandShorelineFoamGain);
  const [collisionMode, setCollisionMode] = useState(initialValues.collisionMode);
  const [showProxySpheres, setShowProxySpheres] = useState(initialValues.showProxySpheres);

  // Camera
  const [cameraDistance, setCameraDistance] = useState(initialValues.cameraDistance);
  const [cameraHeight, setCameraHeight] = useState(initialValues.cameraHeight);
  const [cameraAngle, setCameraAngle] = useState(initialValues.cameraAngle);
  const [isTopDownView, setIsTopDownView] = useState(false);
  const previousCameraTransformRef = useRef<{ distance: number; height: number; angle: number } | null>(null);

  // Water type (shader selection)
  const [waterType, setWaterType] = useState(initialValues.waterType);

  // UI state
  const [expandedSection, setExpandedSection] = useState<'waves' | 'effects' | 'objects' | 'camera' | 'waterType' | 'waterMesh' | null>('waves');
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [pendingStartupConflict, setPendingStartupConflict] = useState<StartupSettingsConflict | null>(startupResolution.conflict);
  const [isStartupResolved, setIsStartupResolved] = useState(startupResolution.conflict === null);
  const skipNextLocalStorageWriteRef = useRef(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const missingParamKeys = CONTROL_KEYS.filter((key) => !(key in PARAM_KEYS));
    if (missingParamKeys.length > 0) {
      console.warn('Missing PARAM_KEYS entries for controls:', missingParamKeys);
    }
  }, []);

  const setControlStateFromValues = useCallback((values: ControlValues) => {
    setWaterMeshScale(values.waterMeshScale);
    setWaveAmplitude(values.waveAmplitude);
    setWaveFrequency(values.waveFrequency);
    setRippleRadius(values.rippleRadius);
    setRippleStrength(values.rippleStrength);
    setRippleDamping(values.rippleDamping);
    setRipplePropagation(values.ripplePropagation);
    setBoatWakeStrength(values.boatWakeStrength);
    setBoatWakeRadius(values.boatWakeRadius);
    setWindDirection(values.windDirection);
    setWindSpeed(values.windSpeed);
    setCrestFoamEnabled(values.crestFoamEnabled);
    setCrestFoamThreshold(values.crestFoamThreshold);
    setFoamIntensity(values.foamIntensity);
    setFoamWidth(values.foamWidth);
    setFoamNoiseFactor(values.foamNoiseFactor);
    setFoamCellScale(values.foamCellScale);
    setFoamShredSlope(values.foamShredSlope);
    setFoamFizzWeight(values.foamFizzWeight);
    setIntersectionFoamEnabled(values.intersectionFoamEnabled);
    setIntersectionFoamIntensity(values.intersectionFoamIntensity);
    setIntersectionFoamWidth(values.intersectionFoamWidth);
    setIntersectionFoamFalloff(values.intersectionFoamFalloff);
    setIntersectionFoamNoise(values.intersectionFoamNoise);
    setIntersectionFoamVerticalRange(values.intersectionFoamVerticalRange);
    setUnderwaterEnabled(values.underwaterEnabled);
    setUnderwaterTransitionDepth(values.underwaterTransitionDepth);
    setUnderwaterFogDensity(values.underwaterFogDensity);
    setUnderwaterHorizonMix(values.underwaterHorizonMix);
    setUnderwaterColorR(values.underwaterColorR);
    setUnderwaterColorG(values.underwaterColorG);
    setUnderwaterColorB(values.underwaterColorB);
    setToonShadowColorR(values.toonShadowColorR);
    setToonShadowColorG(values.toonShadowColorG);
    setToonShadowColorB(values.toonShadowColorB);
    setToonMidColorR(values.toonMidColorR);
    setToonMidColorG(values.toonMidColorG);
    setToonMidColorB(values.toonMidColorB);
    setToonLightColorR(values.toonLightColorR);
    setToonLightColorG(values.toonLightColorG);
    setToonLightColorB(values.toonLightColorB);
    setCausticIntensity(values.causticIntensity);
    setSkyReflectionMix(values.skyReflectionMix);
    setNormalDetailStrength(values.normalDetailStrength);
    setNormalDistanceFalloff(values.normalDistanceFalloff);
    setDepthFadeDistance(values.depthFadeDistance);
    setDepthFadeExponent(values.depthFadeExponent);
    setSpecularIntensity(values.specularIntensity);
    setSkyPresetFile(values.skyPresetFile);
    setBoatModel(values.boatModel);
    setBoatX(values.boatX);
    setBoatZ(values.boatZ);
    setBoatScale(values.boatScale);
    setBoatYOffset(values.boatYOffset);
    setIslandModel(values.islandModel);
    setIslandX(values.islandX);
    setIslandZ(values.islandZ);
    setIslandScale(values.islandScale);
    setIslandYOffset(values.islandYOffset);
    setIslandShorelineBandWidth(values.islandShorelineBandWidth);
    setIslandShorelineFoamGain(values.islandShorelineFoamGain);
    setCollisionMode(values.collisionMode);
    setShowProxySpheres(values.showProxySpheres);
    setCameraDistance(values.cameraDistance);
    setCameraHeight(values.cameraHeight);
    setCameraAngle(values.cameraAngle);
    setWaterType(values.waterType);
  }, []);

  const handleWaveAmplitudeChange = useCallback((value: number[]) => {
    const val = value[0];
    setWaveAmplitude(val);
    onParameterChange('waveAmplitude', val);
  }, [onParameterChange]);

  const handleWaterMeshScaleChange = useCallback((value: number[]) => {
    const val = value[0];
    setWaterMeshScale(val);
    onParameterChange('waterMeshScale', val);
  }, [onParameterChange]);

  const handleWaveFrequencyChange = useCallback((value: number[]) => {
    const val = value[0];
    setWaveFrequency(val);
    onParameterChange('waveFrequency', val);
  }, [onParameterChange]);

  const handleRippleRadiusChange = useCallback((value: number[]) => {
    const val = value[0];
    setRippleRadius(val);
    onParameterChange('rippleRadius', val);
  }, [onParameterChange]);

  const handleRippleStrengthChange = useCallback((value: number[]) => {
    const val = value[0];
    setRippleStrength(val);
    onParameterChange('rippleStrength', val);
  }, [onParameterChange]);

  const handleRippleDampingChange = useCallback((value: number[]) => {
    const val = value[0];
    setRippleDamping(val);
    onParameterChange('rippleDamping', val);
  }, [onParameterChange]);

  const handleRipplePropagationChange = useCallback((value: number[]) => {
    const val = value[0];
    setRipplePropagation(val);
    onParameterChange('ripplePropagation', val);
  }, [onParameterChange]);

  const handleBoatWakeStrengthChange = useCallback((value: number[]) => {
    const val = value[0];
    setBoatWakeStrength(val);
    onParameterChange('boatWakeStrength', val);
  }, [onParameterChange]);

  const handleBoatWakeRadiusChange = useCallback((value: number[]) => {
    const val = value[0];
    setBoatWakeRadius(val);
    onParameterChange('boatWakeRadius', val);
  }, [onParameterChange]);

  const ISLAND_X = 22;
  const ISLAND_Z = 10;

  const pushValuesToRuntime = useCallback((values: ControlValues) => {
    onParameterChange('waterMeshScale', values.waterMeshScale);
    onParameterChange('waveAmplitude', values.waveAmplitude);
    onParameterChange('waveFrequency', values.waveFrequency);
    onParameterChange('rippleRadius', values.rippleRadius);
    onParameterChange('rippleStrength', values.rippleStrength);
    onParameterChange('rippleDamping', values.rippleDamping);
    onParameterChange('ripplePropagation', values.ripplePropagation);
    onParameterChange('boatWakeStrength', values.boatWakeStrength);
    onParameterChange('boatWakeRadius', values.boatWakeRadius);
    onParameterChange('windDirection', values.windDirection);
    onParameterChange('windSpeed', values.windSpeed);
    onParameterChange('crestFoamEnabled', values.crestFoamEnabled);
    onParameterChange('crestFoamThreshold', values.crestFoamThreshold);
    onParameterChange('foamIntensity', values.foamIntensity);
    onParameterChange('foamWidth', values.foamWidth);
    onParameterChange('foamNoiseFactor', values.foamNoiseFactor);
    onParameterChange('foamCellScale', values.foamCellScale);
    onParameterChange('foamShredSlope', values.foamShredSlope);
    onParameterChange('foamFizzWeight', values.foamFizzWeight);
    onParameterChange('intersectionFoamEnabled', values.intersectionFoamEnabled);
    onParameterChange('intersectionFoamIntensity', values.intersectionFoamIntensity);
    onParameterChange('intersectionFoamWidth', values.intersectionFoamWidth);
    onParameterChange('intersectionFoamFalloff', values.intersectionFoamFalloff);
    onParameterChange('intersectionFoamNoise', values.intersectionFoamNoise);
    onParameterChange('intersectionFoamVerticalRange', values.intersectionFoamVerticalRange);
    onParameterChange('underwaterEnabled', values.underwaterEnabled);
    onParameterChange('underwaterTransitionDepth', values.underwaterTransitionDepth);
    onParameterChange('underwaterFogDensity', values.underwaterFogDensity);
    onParameterChange('underwaterHorizonMix', values.underwaterHorizonMix);
    onParameterChange('underwaterColorR', values.underwaterColorR);
    onParameterChange('underwaterColorG', values.underwaterColorG);
    onParameterChange('underwaterColorB', values.underwaterColorB);
    onParameterChange('toonShadowColorR', values.toonShadowColorR);
    onParameterChange('toonShadowColorG', values.toonShadowColorG);
    onParameterChange('toonShadowColorB', values.toonShadowColorB);
    onParameterChange('toonMidColorR', values.toonMidColorR);
    onParameterChange('toonMidColorG', values.toonMidColorG);
    onParameterChange('toonMidColorB', values.toonMidColorB);
    onParameterChange('toonLightColorR', values.toonLightColorR);
    onParameterChange('toonLightColorG', values.toonLightColorG);
    onParameterChange('toonLightColorB', values.toonLightColorB);
    onParameterChange('causticIntensity', values.causticIntensity);
    onParameterChange('skyReflectionMix', values.skyReflectionMix);
    onParameterChange('normalDetailStrength', values.normalDetailStrength);
    onParameterChange('normalDistanceFalloff', values.normalDistanceFalloff);
    onParameterChange('depthFadeDistance', values.depthFadeDistance);
    onParameterChange('depthFadeExponent', values.depthFadeExponent);
    onParameterChange('specularIntensity', values.specularIntensity);
    onSkyPresetChange?.(values.skyPresetFile);
    onBoatModelChange?.(values.boatModel);
    onParameterChange('boatX', values.boatX);
    onParameterChange('boatZ', values.boatZ);
    onParameterChange('boatScale', values.boatScale);
    onParameterChange('boatYOffset', values.boatYOffset);
    onIslandModelChange?.(values.islandModel);
    onParameterChange('islandX', values.islandX);
    onParameterChange('islandZ', values.islandZ);
    onParameterChange('islandScale', values.islandScale);
    onParameterChange('islandYOffset', values.islandYOffset);
    onParameterChange('islandShorelineBandWidth', values.islandShorelineBandWidth);
    onParameterChange('islandShorelineFoamGain', values.islandShorelineFoamGain);
    onParameterChange('collisionMode', values.collisionMode);
    onCollisionModeChange?.(values.collisionMode);
    onParameterChange('showProxySpheres', values.showProxySpheres);
    onShaderChange?.(values.waterType);

    const position = orbitCameraPosition(
      { x: ISLAND_X, z: ISLAND_Z },
      values.cameraAngle,
      values.cameraDistance,
      values.cameraHeight
    );
    onCameraChange(position.x, position.y, position.z);
  }, [onParameterChange, onSkyPresetChange, onBoatModelChange, onIslandModelChange, onCollisionModeChange, onShaderChange, onCameraChange]);

  const handleKeepSavedSettings = useCallback(() => {
    if (pendingStartupConflict) {
      setControlStateFromValues(pendingStartupConflict.savedValues);
      pushValuesToRuntime(pendingStartupConflict.savedValues);
    }
    setPendingStartupConflict(null);
    setIsStartupResolved(true);
  }, [pendingStartupConflict, pushValuesToRuntime, setControlStateFromValues]);

  const handleUseLinkSettings = useCallback(() => {
    if (!pendingStartupConflict) {
      return;
    }
    setControlStateFromValues(pendingStartupConflict.linkValues);
    pushValuesToRuntime(pendingStartupConflict.linkValues);
    setPendingStartupConflict(null);
    setIsStartupResolved(true);
  }, [pendingStartupConflict, setControlStateFromValues, pushValuesToRuntime]);

  const buildCurrentControlValues = useCallback((): ControlValues => ({
    waterMeshScale,
    waveAmplitude,
    waveFrequency,
    rippleRadius,
    rippleStrength,
    rippleDamping,
    ripplePropagation,
    boatWakeStrength,
    boatWakeRadius,
    windDirection,
    windSpeed,
    crestFoamEnabled,
    crestFoamThreshold,
    foamIntensity,
    foamWidth,
    foamNoiseFactor,
    foamCellScale,
    foamShredSlope,
    foamFizzWeight,
    intersectionFoamEnabled,
    intersectionFoamIntensity,
    intersectionFoamWidth,
    intersectionFoamFalloff,
    intersectionFoamNoise,
    intersectionFoamVerticalRange,
    underwaterEnabled,
    underwaterTransitionDepth,
    underwaterFogDensity,
    underwaterHorizonMix,
    underwaterColorR,
    underwaterColorG,
    underwaterColorB,
    toonShadowColorR,
    toonShadowColorG,
    toonShadowColorB,
    toonMidColorR,
    toonMidColorG,
    toonMidColorB,
    toonLightColorR,
    toonLightColorG,
    toonLightColorB,
    causticIntensity,
    skyReflectionMix,
    normalDetailStrength,
    normalDistanceFalloff,
    depthFadeDistance,
    depthFadeExponent,
    specularIntensity,
    boatModel,
    boatX,
    boatZ,
    boatScale,
    boatYOffset,
    islandModel,
    islandX,
    islandZ,
    islandScale,
    islandYOffset,
    islandShorelineBandWidth,
    islandShorelineFoamGain,
    collisionMode,
    showProxySpheres,
    cameraDistance,
    cameraHeight,
    cameraAngle,
    waterType,
    skyPresetFile,
  }), [
    waterMeshScale,
    waveAmplitude,
    waveFrequency,
    rippleRadius,
    rippleStrength,
    rippleDamping,
    ripplePropagation,
    boatWakeStrength,
    boatWakeRadius,
    windDirection,
    windSpeed,
    crestFoamEnabled,
    crestFoamThreshold,
    foamIntensity,
    foamWidth,
    foamNoiseFactor,
    foamCellScale,
    foamShredSlope,
    foamFizzWeight,
    intersectionFoamEnabled,
    intersectionFoamIntensity,
    intersectionFoamWidth,
    intersectionFoamFalloff,
    intersectionFoamNoise,
    intersectionFoamVerticalRange,
    underwaterEnabled,
    underwaterTransitionDepth,
    underwaterFogDensity,
    underwaterHorizonMix,
    underwaterColorR,
    underwaterColorG,
    underwaterColorB,
    toonShadowColorR,
    toonShadowColorG,
    toonShadowColorB,
    toonMidColorR,
    toonMidColorG,
    toonMidColorB,
    toonLightColorR,
    toonLightColorG,
    toonLightColorB,
    causticIntensity,
    skyReflectionMix,
    normalDetailStrength,
    normalDistanceFalloff,
    depthFadeDistance,
    depthFadeExponent,
    specularIntensity,
    boatModel,
    boatX,
    boatZ,
    boatScale,
    boatYOffset,
    islandModel,
    islandX,
    islandZ,
    islandScale,
    islandYOffset,
    islandShorelineBandWidth,
    islandShorelineFoamGain,
    collisionMode,
    showProxySpheres,
    cameraDistance,
    cameraHeight,
    cameraAngle,
    waterType,
    skyPresetFile,
  ]);

  const handleShare = useCallback(async (cleanOnly = false) => {
    if (typeof window === 'undefined') return;

    let valuesForShare: ControlValues | null = null;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<ControlValues>;
        valuesForShare = buildControlValues(stored, new URLSearchParams(), false);
      }
    } catch {
      valuesForShare = null;
    }

    if (!valuesForShare) {
      valuesForShare = buildCurrentControlValues();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(valuesForShare));
    }

    const params = buildSearchParamsFromValues(valuesForShare, cleanOnly);
    const query = params.toString();
    const shareUrl = `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(cleanOnly ? 'Clean share URL copied to clipboard' : 'Share URL copied to clipboard');
    } catch {
      toast.error('Unable to copy share URL');
    }
  }, [buildCurrentControlValues]);

  useEffect(() => {
    // Sync runtime to startup source. If URL conflicts with saved settings,
    // we keep saved values until the user chooses in the conflict modal.
    pushValuesToRuntime(initialValues);
  }, [initialValues, pushValuesToRuntime]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageSync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const incoming = JSON.parse(event.newValue) as Partial<ControlValues>;
        const nextValues = buildControlValues(incoming, new URLSearchParams(), false);
        skipNextLocalStorageWriteRef.current = true;
        setControlStateFromValues(nextValues);
        pushValuesToRuntime(nextValues);
      } catch {
        // Ignore malformed external payloads.
      }
    };

    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, [isStartupResolved, setControlStateFromValues, pushValuesToRuntime]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isStartupResolved) return;

    const values = buildCurrentControlValues();

    const skipLocalStorageWrite = skipNextLocalStorageWriteRef.current;
    if (skipLocalStorageWrite) {
      skipNextLocalStorageWriteRef.current = false;
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    }
  }, [
    waterMeshScale,
    waveAmplitude,
    waveFrequency,
    rippleRadius,
    rippleStrength,
    rippleDamping,
    ripplePropagation,
    boatWakeStrength,
    boatWakeRadius,
    windDirection,
    windSpeed,
    crestFoamEnabled,
    crestFoamThreshold,
    foamIntensity,
    foamWidth,
    foamNoiseFactor,
    foamCellScale,
    foamShredSlope,
    foamFizzWeight,
    intersectionFoamEnabled,
    intersectionFoamIntensity,
    intersectionFoamWidth,
    intersectionFoamFalloff,
    intersectionFoamNoise,
    intersectionFoamVerticalRange,
    underwaterEnabled,
    underwaterTransitionDepth,
    underwaterFogDensity,
    underwaterHorizonMix,
    underwaterColorR,
    underwaterColorG,
    underwaterColorB,
      toonShadowColorR,
      toonShadowColorG,
      toonShadowColorB,
      toonMidColorR,
      toonMidColorG,
      toonMidColorB,
      toonLightColorR,
      toonLightColorG,
      toonLightColorB,
      causticIntensity,
    skyReflectionMix,
    normalDetailStrength,
    normalDistanceFalloff,
    depthFadeDistance,
    depthFadeExponent,
    specularIntensity,
    boatModel,
    boatX,
    boatZ,
    boatScale,
    boatYOffset,
    islandModel,
    islandX,
    islandZ,
    islandScale,
    islandYOffset,
    islandShorelineBandWidth,
    islandShorelineFoamGain,
    collisionMode,
    showProxySpheres,
    cameraDistance,
    cameraHeight,
    cameraAngle,
    waterType,
    skyPresetFile,
    isStartupResolved,
    buildCurrentControlValues,
  ]);

  const handleWindDirectionChange = useCallback((value: number[]) => {
    const val = value[0];
    setWindDirection(val);
    onParameterChange('windDirection', val);
  }, [onParameterChange]);

  const handleWindSpeedChange = useCallback((value: number[]) => {
    const val = value[0];
    setWindSpeed(val);
    onParameterChange('windSpeed', val);
  }, [onParameterChange]);

  const handleCrestFoamEnabledChange = useCallback((enabled: number) => {
    setCrestFoamEnabled(enabled);
    onParameterChange('crestFoamEnabled', enabled);
  }, [onParameterChange]);

  const handleCrestFoamThresholdChange = useCallback((value: number[]) => {
    const val = value[0];
    setCrestFoamThreshold(val);
    onParameterChange('crestFoamThreshold', val);
  }, [onParameterChange]);

  const handleFoamIntensityChange = useCallback((value: number[]) => {
    const val = value[0];
    setFoamIntensity(val);
    onParameterChange('foamIntensity', val);
  }, [onParameterChange]);

  const handleFoamWidthChange = useCallback((value: number[]) => {
    const val = value[0];
    setFoamWidth(val);
    onParameterChange('foamWidth', val);
  }, [onParameterChange]);

  const handleFoamNoiseFactorChange = useCallback((value: number[]) => {
    const val = value[0];
    setFoamNoiseFactor(val);
    onParameterChange('foamNoiseFactor', val);
  }, [onParameterChange]);

  const handleFoamCellScaleChange = useCallback((value: number[]) => {
    const val = value[0];
    setFoamCellScale(val);
    onParameterChange('foamCellScale', val);
  }, [onParameterChange]);

  const handleFoamShredSlopeChange = useCallback((value: number[]) => {
    const val = value[0];
    setFoamShredSlope(val);
    onParameterChange('foamShredSlope', val);
  }, [onParameterChange]);

  const handleFoamFizzWeightChange = useCallback((value: number[]) => {
    const val = value[0];
    setFoamFizzWeight(val);
    onParameterChange('foamFizzWeight', val);
  }, [onParameterChange]);

  const handleIntersectionFoamEnabledChange = useCallback((enabled: number) => {
    setIntersectionFoamEnabled(enabled);
    onParameterChange('intersectionFoamEnabled', enabled);
  }, [onParameterChange]);

  const handleIntersectionFoamIntensityChange = useCallback((value: number[]) => {
    const val = value[0];
    setIntersectionFoamIntensity(val);
    onParameterChange('intersectionFoamIntensity', val);
  }, [onParameterChange]);

  const handleIntersectionFoamWidthChange = useCallback((value: number[]) => {
    const val = value[0];
    setIntersectionFoamWidth(val);
    onParameterChange('intersectionFoamWidth', val);
  }, [onParameterChange]);

  const handleIntersectionFoamFalloffChange = useCallback((value: number[]) => {
    const val = value[0];
    setIntersectionFoamFalloff(val);
    onParameterChange('intersectionFoamFalloff', val);
  }, [onParameterChange]);

  const handleIntersectionFoamNoiseChange = useCallback((value: number[]) => {
    const val = value[0];
    setIntersectionFoamNoise(val);
    onParameterChange('intersectionFoamNoise', val);
  }, [onParameterChange]);

  const handleIntersectionFoamVerticalRangeChange = useCallback((value: number[]) => {
    const val = value[0];
    setIntersectionFoamVerticalRange(val);
    onParameterChange('intersectionFoamVerticalRange', val);
  }, [onParameterChange]);

  const handleUnderwaterEnabledChange = useCallback((enabled: number) => {
    setUnderwaterEnabled(enabled);
    onParameterChange('underwaterEnabled', enabled);
  }, [onParameterChange]);

  const handleUnderwaterTransitionDepthChange = useCallback((value: number[]) => {
    const val = value[0];
    setUnderwaterTransitionDepth(val);
    onParameterChange('underwaterTransitionDepth', val);
  }, [onParameterChange]);

  const handleUnderwaterFogDensityChange = useCallback((value: number[]) => {
    const val = value[0];
    setUnderwaterFogDensity(val);
    onParameterChange('underwaterFogDensity', val);
  }, [onParameterChange]);

  const handleUnderwaterHorizonMixChange = useCallback((value: number[]) => {
    const val = value[0];
    setUnderwaterHorizonMix(val);
    onParameterChange('underwaterHorizonMix', val);
  }, [onParameterChange]);

  const handleUnderwaterColorRChange = useCallback((value: number[]) => {
    const val = value[0];
    setUnderwaterColorR(val);
    onParameterChange('underwaterColorR', val);
  }, [onParameterChange]);

  const handleUnderwaterColorGChange = useCallback((value: number[]) => {
    const val = value[0];
    setUnderwaterColorG(val);
    onParameterChange('underwaterColorG', val);
  }, [onParameterChange]);

  const handleUnderwaterColorBChange = useCallback((value: number[]) => {
    const val = value[0];
    setUnderwaterColorB(val);
    onParameterChange('underwaterColorB', val);
  }, [onParameterChange]);

    const handleToonShadowColorRChange = useCallback((value: number[]) => {
      const val = value[0];
      setToonShadowColorR(val);
      onParameterChange('toonShadowColorR', val);
    }, [onParameterChange]);

    const handleToonShadowColorGChange = useCallback((value: number[]) => {
      const val = value[0];
      setToonShadowColorG(val);
      onParameterChange('toonShadowColorG', val);
    }, [onParameterChange]);

    const handleToonShadowColorBChange = useCallback((value: number[]) => {
      const val = value[0];
      setToonShadowColorB(val);
      onParameterChange('toonShadowColorB', val);
    }, [onParameterChange]);

    const handleToonMidColorRChange = useCallback((value: number[]) => {
      const val = value[0];
      setToonMidColorR(val);
      onParameterChange('toonMidColorR', val);
    }, [onParameterChange]);

    const handleToonMidColorGChange = useCallback((value: number[]) => {
      const val = value[0];
      setToonMidColorG(val);
      onParameterChange('toonMidColorG', val);
    }, [onParameterChange]);

    const handleToonMidColorBChange = useCallback((value: number[]) => {
      const val = value[0];
      setToonMidColorB(val);
      onParameterChange('toonMidColorB', val);
    }, [onParameterChange]);

    const handleToonLightColorRChange = useCallback((value: number[]) => {
      const val = value[0];
      setToonLightColorR(val);
      onParameterChange('toonLightColorR', val);
    }, [onParameterChange]);

    const handleToonLightColorGChange = useCallback((value: number[]) => {
      const val = value[0];
      setToonLightColorG(val);
      onParameterChange('toonLightColorG', val);
    }, [onParameterChange]);

    const handleToonLightColorBChange = useCallback((value: number[]) => {
      const val = value[0];
      setToonLightColorB(val);
      onParameterChange('toonLightColorB', val);
    }, [onParameterChange]);

  const handleCausticIntensityChange = useCallback((value: number[]) => {
    const val = value[0];
    setCausticIntensity(val);
    onParameterChange('causticIntensity', val);
  }, [onParameterChange]);

  const handleSkyReflectionMixChange = useCallback((value: number[]) => {
    const val = value[0];
    setSkyReflectionMix(val);
    onParameterChange('skyReflectionMix', val);
  }, [onParameterChange]);

  const handleNormalDetailStrengthChange = useCallback((value: number[]) => {
    const val = value[0];
    setNormalDetailStrength(val);
    onParameterChange('normalDetailStrength', val);
  }, [onParameterChange]);

  const handleNormalDistanceFalloffChange = useCallback((value: number[]) => {
    const val = value[0];
    setNormalDistanceFalloff(val);
    onParameterChange('normalDistanceFalloff', val);
  }, [onParameterChange]);

  const handleDepthFadeDistanceChange = useCallback((value: number[]) => {
    const val = value[0];
    setDepthFadeDistance(val);
    onParameterChange('depthFadeDistance', val);
  }, [onParameterChange]);

  const handleDepthFadeExponentChange = useCallback((value: number[]) => {
    const val = value[0];
    setDepthFadeExponent(val);
    onParameterChange('depthFadeExponent', val);
  }, [onParameterChange]);

  const handleSpecularIntensityChange = useCallback((value: number[]) => {
    const val = value[0];
    setSpecularIntensity(val);
    onParameterChange('specularIntensity', val);
  }, [onParameterChange]);

  const handleBoatScaleChange = useCallback((value: number[]) => {
    const val = value[0];
    setBoatScale(val);
    onParameterChange('boatScale', val);
  }, [onParameterChange]);

  const handleBoatModelChange = useCallback((modelId: BoatModelId) => {
    setBoatModel(modelId);
    onBoatModelChange?.(modelId);
  }, [onBoatModelChange]);

  const handleBoatXChange = useCallback((value: number[]) => {
    const val = value[0];
    setBoatX(val);
    onParameterChange('boatX', val);
  }, [onParameterChange]);

  const handleBoatZChange = useCallback((value: number[]) => {
    const val = value[0];
    setBoatZ(val);
    onParameterChange('boatZ', val);
  }, [onParameterChange]);

  const handleBoatYOffsetChange = useCallback((value: number[]) => {
    const val = value[0];
    setBoatYOffset(val);
    onParameterChange('boatYOffset', val);
  }, [onParameterChange]);

  const handleIslandScaleChange = useCallback((value: number[]) => {
    const val = value[0];
    setIslandScale(val);
    onParameterChange('islandScale', val);
  }, [onParameterChange]);

  const handleIslandModelChange = useCallback((modelId: IslandModelId) => {
    setIslandModel(modelId);
    onIslandModelChange?.(modelId);
  }, [onIslandModelChange]);

  const handleIslandXChange = useCallback((value: number[]) => {
    const val = value[0];
    setIslandX(val);
    onParameterChange('islandX', val);
  }, [onParameterChange]);

  const handleIslandZChange = useCallback((value: number[]) => {
    const val = value[0];
    setIslandZ(val);
    onParameterChange('islandZ', val);
  }, [onParameterChange]);

  const handleIslandYOffsetChange = useCallback((value: number[]) => {
    const val = value[0];
    setIslandYOffset(val);
    onParameterChange('islandYOffset', val);
  }, [onParameterChange]);

  const handleIslandShorelineBandWidthChange = useCallback((value: number[]) => {
    const val = value[0];
    setIslandShorelineBandWidth(val);
    onParameterChange('islandShorelineBandWidth', val);
  }, [onParameterChange]);

  const handleIslandShorelineFoamGainChange = useCallback((value: number[]) => {
    const val = value[0];
    setIslandShorelineFoamGain(val);
    onParameterChange('islandShorelineFoamGain', val);
  }, [onParameterChange]);

  const handleCollisionModeChange = useCallback((mode: number) => {
    setCollisionMode(mode);
    onParameterChange('collisionMode', mode);
    onCollisionModeChange?.(mode);
  }, [onParameterChange, onCollisionModeChange]);

  const handleProxyVisibilityChange = useCallback((enabled: number) => {
    setShowProxySpheres(enabled);
    onParameterChange('showProxySpheres', enabled);
  }, [onParameterChange]);

  const handleLogOffsets = useCallback(() => {
    onParameterChange('logSiblingOffsets', 1);
  }, [onParameterChange]);

  const handleCameraDistanceChange = useCallback((value: number[]) => {
    const val = value[0];
    setCameraDistance(val);
    setIsTopDownView(false);
    previousCameraTransformRef.current = null;
    const position = orbitCameraPosition({ x: ISLAND_X, z: ISLAND_Z }, cameraAngle, val, cameraHeight);
    onCameraChange(position.x, position.y, position.z);
  }, [onCameraChange, cameraAngle, cameraHeight]);

  const handleCameraHeightChange = useCallback((value: number[]) => {
    const val = value[0];
    setCameraHeight(val);
    setIsTopDownView(false);
    previousCameraTransformRef.current = null;
    const position = orbitCameraPosition({ x: ISLAND_X, z: ISLAND_Z }, cameraAngle, cameraDistance, val);
    onCameraChange(position.x, position.y, position.z);
  }, [onCameraChange, cameraAngle, cameraDistance]);

  const handleCameraAngleChange = useCallback((value: number[]) => {
    const val = value[0];
    setCameraAngle(val);
    setIsTopDownView(false);
    previousCameraTransformRef.current = null;
    const position = orbitCameraPosition({ x: ISLAND_X, z: ISLAND_Z }, val, cameraDistance, cameraHeight);
    onCameraChange(position.x, position.y, position.z);
  }, [onCameraChange, cameraDistance, cameraHeight]);

  const handleToggleTopDownView = useCallback(() => {
    if (isTopDownView) {
      const previous = previousCameraTransformRef.current;
      if (previous) {
        setCameraDistance(previous.distance);
        setCameraHeight(previous.height);
        setCameraAngle(previous.angle);
        const position = orbitCameraPosition({ x: ISLAND_X, z: ISLAND_Z }, previous.angle, previous.distance, previous.height);
        onCameraChange(position.x, position.y, position.z);
      }
      previousCameraTransformRef.current = null;
      setIsTopDownView(false);
      return;
    }

    previousCameraTransformRef.current = {
      distance: cameraDistance,
      height: cameraHeight,
      angle: cameraAngle,
    };
    onTopDownView();
    setIsTopDownView(true);
  }, [isTopDownView, cameraDistance, cameraHeight, cameraAngle, onCameraChange, onTopDownView]);

  const handleReset = useCallback(() => {
    setIsTopDownView(false);
    previousCameraTransformRef.current = null;
    setControlStateFromValues(DEFAULT_VALUES);
    pushValuesToRuntime(DEFAULT_VALUES);
  }, [setControlStateFromValues, pushValuesToRuntime]);

  const handleShaderChange = useCallback((shaderName: string) => {
    const newWaterType = parseWaterType(shaderName);
    setWaterType(newWaterType);
    if (onShaderChange) {
      onShaderChange(newWaterType);
    }
  }, [onShaderChange]);

  const handleSkyPresetChange = useCallback((presetFile: string) => {
    if (!isSkyPresetFile(presetFile)) {
      return;
    }
    setSkyPresetFile(presetFile);
    onSkyPresetChange?.(presetFile);
  }, [onSkyPresetChange]);

  const toggleSection = (section: 'waves' | 'effects' | 'objects' | 'camera' | 'waterType' | 'waterMesh') => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const activeWater = getWaterTypeById(serializeWaterType(waterType));
  const activeShaderControls = new Set<ShaderControlKey>(activeWater.shaderControlKeys);
  const supportsShaderControl = (key: ShaderControlKey): boolean => activeShaderControls.has(key);
  const hasEffectControls = [
    'foamIntensity',
    'foamWidth',
    'foamNoiseFactor',
    'foamCellScale',
    'foamShredSlope',
    'foamFizzWeight',
    'causticIntensity',
    'skyReflectionMix',
    'normalDetailStrength',
    'normalDistanceFalloff',
    'depthFadeDistance',
    'depthFadeExponent',
      'toonShadowColorR',
      'toonMidColorR',
      'toonLightColorR',
    'specularIntensity',
  ].some((key) => supportsShaderControl(key as ShaderControlKey));

  const startupConflictDialog = (
    <AlertDialog open={pendingStartupConflict !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>URL Parameters Detected</AlertDialogTitle>
          <AlertDialogDescription>
            Do you want the current URL parameters to overwrite your previous session data?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleKeepSavedSettings}>NO</AlertDialogCancel>
          <AlertDialogAction onClick={handleUseLinkSettings}>YES</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const panelTransitionClasses = isPanelCollapsed
    ? 'opacity-0 translate-y-2 scale-95 pointer-events-none'
    : 'opacity-100 translate-y-0 scale-100 pointer-events-auto';

  const chipTransitionClasses = isPanelCollapsed
    ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
    : 'opacity-0 translate-y-2 scale-95 pointer-events-none';

  return (
    <>
    <div
      className={`fixed bottom-4 right-4 w-96 max-h-[600px] overflow-y-auto bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl z-50 select-none transform-gpu transition-all duration-200 ease-out ${panelTransitionClasses}`}
    >
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="pb-3 border-b border-slate-700/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold text-white">🌊 Controls</CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-1">SIGGRAPH-Grade Rendering</CardDescription>
              <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  Clean link
                </span>
                <span className="inline-flex items-center gap-1">
                  <Share2 className="h-3 w-3" />
                  Full link
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { void handleShare(true); }}
                title="Share clean link (non-default controls)"
                className="h-8 w-8 p-0 hover:bg-slate-700/50"
              >
                <Link2 className="h-4 w-4 text-slate-300" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { void handleShare(false); }}
                title="Share current controls"
                className="h-8 w-8 p-0 hover:bg-slate-700/50"
              >
                <Share2 className="h-4 w-4 text-slate-300" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                title="Reset to defaults"
                className="h-8 w-8 p-0 hover:bg-slate-700/50"
              >
                <RotateCcw className="h-4 w-4 text-slate-300" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPanelCollapsed(true)}
                title="Close controls"
                className="h-8 w-8 p-0 hover:bg-slate-700/50"
              >
                <X className="h-4 w-4 text-slate-300" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pb-4 pt-4">
          {/* Water Type Section */}
          <div className="space-y-2">
            <button
              onClick={() => toggleSection('waterType')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Wind className="h-4 w-4 text-cyan-400" />
                <span className="text-sm font-semibold text-white">Water Type</span>
              </div>
              <span className="text-xs text-slate-400">{expandedSection === 'waterType' ? '▼' : '▶'}</span>
            </button>

            {expandedSection === 'waterType' && (
              <div className="space-y-2 pl-2">
                <label className="text-sm font-medium text-slate-300">Shader Material</label>
                <select
                  value={serializeWaterType(waterType)}
                  onChange={(e) => handleShaderChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-white text-sm focus:outline-none focus:border-cyan-400/50 transition-colors"
                >
                  {WATER_TYPES.map((wt) => (
                    <option key={wt.id} value={wt.id}>
                      {wt.displayName}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  {activeWater.description}
                </p>
                <div className="text-xs text-slate-500 mt-2 space-y-1 bg-slate-800/30 rounded px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span>Foam Support:</span>
                    <span className={activeWater.supportsFoam ? 'text-green-400' : 'text-slate-500'}>
                      {activeWater.supportsFoam ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Caustics Support:</span>
                    <span className={activeWater.supportsCaustics ? 'text-green-400' : 'text-slate-500'}>
                      {activeWater.supportsCaustics ? '✓' : '✗'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Water Mesh Section */}
          <div className="space-y-2">
            <button
              onClick={() => toggleSection('waterMesh')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Boxes className="h-4 w-4 text-teal-400" />
                <span className="text-sm font-semibold text-white">Water Mesh</span>
              </div>
              <span className="text-xs text-slate-400">{expandedSection === 'waterMesh' ? '▼' : '▶'}</span>
            </button>

            {expandedSection === 'waterMesh' && (
              <div className="space-y-3 pl-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Mesh Scale: <span className="text-teal-400 font-bold">{waterMeshScale.toFixed(2)}x</span>
                  </label>
                  <Slider
                    value={[waterMeshScale]}
                    onValueChange={(v) => handleWaterMeshScaleChange(v)}
                    min={0.1}
                    max={2.0}
                    step={0.01}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500">Scales overall water mesh dimensions while preserving each water type mesh profile.</p>
                </div>
              </div>
            )}
          </div>

          {/* Wave Parameters Section */}
          <div className="space-y-2">
            <button
              onClick={() => toggleSection('waves')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-semibold text-white">Wave Parameters</span>
              </div>
              <span className="text-xs text-slate-400">{expandedSection === 'waves' ? '▼' : '▶'}</span>
            </button>

            {expandedSection === 'waves' && (
              <div className="space-y-3 pl-2">
                {supportsShaderControl('waveAmplitude') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Wave Amplitude: <span className="text-blue-400 font-bold">{waveAmplitude.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[waveAmplitude]}
                    onValueChange={(v) => handleWaveAmplitudeChange(v)}
                    min={0.5}
                    max={4.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                )}

                {supportsShaderControl('waveFrequency') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Wave Frequency: <span className="text-blue-400 font-bold">{waveFrequency.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[waveFrequency]}
                    onValueChange={(v) => handleWaveFrequencyChange(v)}
                    min={0.5}
                    max={3.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                )}

                {supportsShaderControl('rippleRadius') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Disturbance Radius: <span className="text-blue-400 font-bold">{rippleRadius.toFixed(2)}m</span>
                  </label>
                  <Slider
                    value={[rippleRadius]}
                    onValueChange={(v) => handleRippleRadiusChange(v)}
                    min={0.5}
                    max={8.0}
                    step={0.1}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500">Sets the footprint of user-driven ripple impulses on the RippleFlux surface.</p>
                </div>
                )}

                {supportsShaderControl('rippleStrength') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Disturbance Strength: <span className="text-blue-400 font-bold">{rippleStrength.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[rippleStrength]}
                    onValueChange={(v) => handleRippleStrengthChange(v)}
                    min={0.05}
                    max={1.0}
                    step={0.01}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500">Controls how much vertical energy each pointer interaction injects into the height field.</p>
                </div>
                )}

                {supportsShaderControl('rippleDamping') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Energy Damping: <span className="text-blue-400 font-bold">{rippleDamping.toFixed(3)}</span>
                  </label>
                  <Slider
                    value={[rippleDamping]}
                    onValueChange={(v) => handleRippleDampingChange(v)}
                    min={0.85}
                    max={0.999}
                    step={0.001}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500">Higher values preserve ripples longer; lower values settle the field faster.</p>
                </div>
                )}

                {supportsShaderControl('ripplePropagation') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Propagation Rate: <span className="text-blue-400 font-bold">{ripplePropagation.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[ripplePropagation]}
                    onValueChange={(v) => handleRipplePropagationChange(v)}
                    min={0.1}
                    max={1.3}
                    step={0.01}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500">Adjusts how quickly disturbance energy travels outward through the solver grid.</p>
                </div>
                )}

                {supportsShaderControl('boatWakeStrength') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Boat Wake Strength: <span className="text-blue-400 font-bold">{boatWakeStrength.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[boatWakeStrength]}
                    onValueChange={(v) => handleBoatWakeStrengthChange(v)}
                    min={0.0}
                    max={1.0}
                    step={0.01}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500">Controls how strongly the floating boat feeds wake energy back into RippleFlux.</p>
                </div>
                )}

                {supportsShaderControl('boatWakeRadius') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Boat Wake Radius: <span className="text-blue-400 font-bold">{boatWakeRadius.toFixed(2)}m</span>
                  </label>
                  <Slider
                    value={[boatWakeRadius]}
                    onValueChange={(v) => handleBoatWakeRadiusChange(v)}
                    min={0.4}
                    max={6.0}
                    step={0.1}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500">Sets the wake footprint around the hull when the boat is riding the RippleFlux surface.</p>
                </div>
                )}

                {supportsShaderControl('windDirection') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Wind className="h-4 w-4 text-cyan-400" />
                    Wind Direction: <span className="text-cyan-400 font-bold">{windDirection.toFixed(0)}°</span>
                  </label>
                  <Slider
                    value={[windDirection]}
                    onValueChange={(v) => handleWindDirectionChange(v)}
                    min={0}
                    max={360}
                    step={5}
                    className="w-full"
                  />
                </div>
                )}

                {supportsShaderControl('windSpeed') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Wind Speed: <span className="text-cyan-400 font-bold">{windSpeed.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[windSpeed]}
                    onValueChange={(v) => handleWindSpeedChange(v)}
                    min={0.1}
                    max={2.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                )}
              </div>
            )}
          </div>

          {/* Visual Effects Section */}
          <div className="space-y-2">
            <button
              onClick={() => toggleSection('effects')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-semibold text-white">Visual Effects</span>
              </div>
              <span className="text-xs text-slate-400">{expandedSection === 'effects' ? '▼' : '▶'}</span>
            </button>

            {expandedSection === 'effects' && (
              <div className="space-y-3 pl-2">
                {supportsShaderControl('foamIntensity') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Foam Intensity: <span className="text-purple-400 font-bold">{foamIntensity.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[foamIntensity]}
                    onValueChange={(v) => handleFoamIntensityChange(v)}
                    min={0.0}
                    max={1.5}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                )}

                {supportsShaderControl('foamWidth') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Foam Width: <span className="text-purple-400 font-bold">{foamWidth.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[foamWidth]}
                    onValueChange={(v) => handleFoamWidthChange(v)}
                    min={0.2}
                    max={3.0}
                    step={0.05}
                    className="w-full"
                  />
                </div>
                )}

                {supportsShaderControl('foamNoiseFactor') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Foam Noise Blend: <span className="text-purple-400 font-bold">{foamNoiseFactor.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[foamNoiseFactor]}
                    onValueChange={(v) => handleFoamNoiseFactorChange(v)}
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    className="w-full"
                  />
                </div>
                )}

                {supportsShaderControl('foamCellScale') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Cell Size: <span className="text-purple-400 font-bold">{foamCellScale.toFixed(3)}</span>
                  </label>
                  <Slider
                    value={[foamCellScale]}
                    onValueChange={(v) => handleFoamCellScaleChange(v)}
                    min={0.02}
                    max={0.5}
                    step={0.005}
                    className="w-full"
                  />
                </div>
                )}

                {supportsShaderControl('foamShredSlope') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Foam Shred: <span className="text-purple-400 font-bold">{foamShredSlope.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[foamShredSlope]}
                    onValueChange={(v) => handleFoamShredSlopeChange(v)}
                    min={0.0}
                    max={1.2}
                    step={0.05}
                    className="w-full"
                  />
                </div>
                )}

                {supportsShaderControl('foamFizzWeight') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Foam Fizz: <span className="text-purple-400 font-bold">{foamFizzWeight.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[foamFizzWeight]}
                    onValueChange={(v) => handleFoamFizzWeightChange(v)}
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    className="w-full"
                  />
                </div>
                )}

                {supportsShaderControl('causticIntensity') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Caustic Intensity: <span className="text-purple-400 font-bold">{causticIntensity.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[causticIntensity]}
                    onValueChange={(v) => handleCausticIntensityChange(v)}
                    min={0.0}
                    max={1.5}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Sky Preset</label>
                  <select
                    value={skyPresetFile}
                    onChange={(e) => handleSkyPresetChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-white text-sm focus:outline-none focus:border-purple-400/50 transition-colors"
                  >
                    {SKY_PRESET_OPTIONS.map((preset) => (
                      <option key={preset.file} value={preset.file}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>

                {supportsShaderControl('skyReflectionMix') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Sky Reflection Mix: <span className="text-purple-400 font-bold">{skyReflectionMix.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[skyReflectionMix]}
                    onValueChange={(v) => handleSkyReflectionMixChange(v)}
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500">Higher values pull more color and brightness from sky reflections.</p>
                </div>
                )}

                {supportsShaderControl('normalDetailStrength') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Normal Detail: <span className="text-purple-400 font-bold">{normalDetailStrength.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[normalDetailStrength]}
                    onValueChange={(v) => handleNormalDetailStrengthChange(v)}
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500">Controls micro-wave sharpness and fine highlight breakup.</p>
                </div>
                )}

                {supportsShaderControl('normalDistanceFalloff') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Normal Distance Falloff: <span className="text-purple-400 font-bold">{normalDistanceFalloff.toFixed(3)}</span>
                  </label>
                  <Slider
                    value={[normalDistanceFalloff]}
                    onValueChange={(v) => handleNormalDistanceFalloffChange(v)}
                    min={0.005}
                    max={0.08}
                    step={0.0025}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500">Sets how quickly fine normal detail fades with camera distance.</p>
                </div>
                )}

                {supportsShaderControl('depthFadeDistance') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Depth Fade Width: <span className="text-purple-400 font-bold">{depthFadeDistance.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[depthFadeDistance]}
                    onValueChange={(v) => handleDepthFadeDistanceChange(v)}
                    min={0.35}
                    max={3.0}
                    step={0.05}
                    className="w-full"
                  />
                </div>
                )}

                {supportsShaderControl('depthFadeExponent') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Depth Fade Curve: <span className="text-purple-400 font-bold">{depthFadeExponent.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[depthFadeExponent]}
                    onValueChange={(v) => handleDepthFadeExponentChange(v)}
                    min={0.7}
                    max={3.0}
                    step={0.05}
                    className="w-full"
                  />
                </div>
                )}

                {supportsShaderControl('specularIntensity') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Specular Intensity: <span className="text-purple-400 font-bold">{specularIntensity.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[specularIntensity]}
                    onValueChange={(v) => handleSpecularIntensityChange(v)}
                    min={0.0}
                    max={2.0}
                    step={0.05}
                    className="w-full"
                  />
                </div>
                )}

                {supportsShaderControl('toonShadowColorR') && (
                <div className="space-y-3 border-t border-slate-700/30 pt-3 mt-3">
                  <label className="text-sm font-medium text-slate-300">Toon Shadow Color</label>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">
                      Red: <span className="text-red-400 font-bold">{toonShadowColorR.toFixed(2)}</span>
                    </label>
                    <Slider
                      value={[toonShadowColorR]}
                      onValueChange={(v) => handleToonShadowColorRChange(v)}
                      min={0.0}
                      max={1.0}
                      step={0.01}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">
                      Green: <span className="text-green-400 font-bold">{toonShadowColorG.toFixed(2)}</span>
                    </label>
                    <Slider
                      value={[toonShadowColorG]}
                      onValueChange={(v) => handleToonShadowColorGChange(v)}
                      min={0.0}
                      max={1.0}
                      step={0.01}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">
                      Blue: <span className="text-blue-400 font-bold">{toonShadowColorB.toFixed(2)}</span>
                    </label>
                    <Slider
                      value={[toonShadowColorB]}
                      onValueChange={(v) => handleToonShadowColorBChange(v)}
                      min={0.0}
                      max={1.0}
                      step={0.01}
                      className="w-full"
                    />
                  </div>
                </div>
                )}

                {supportsShaderControl('toonMidColorR') && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-300">Toon Mid Color</label>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">
                      Red: <span className="text-red-400 font-bold">{toonMidColorR.toFixed(2)}</span>
                    </label>
                    <Slider
                      value={[toonMidColorR]}
                      onValueChange={(v) => handleToonMidColorRChange(v)}
                      min={0.0}
                      max={1.0}
                      step={0.01}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">
                      Green: <span className="text-green-400 font-bold">{toonMidColorG.toFixed(2)}</span>
                    </label>
                    <Slider
                      value={[toonMidColorG]}
                      onValueChange={(v) => handleToonMidColorGChange(v)}
                      min={0.0}
                      max={1.0}
                      step={0.01}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">
                      Blue: <span className="text-blue-400 font-bold">{toonMidColorB.toFixed(2)}</span>
                    </label>
                    <Slider
                      value={[toonMidColorB]}
                      onValueChange={(v) => handleToonMidColorBChange(v)}
                      min={0.0}
                      max={1.0}
                      step={0.01}
                      className="w-full"
                    />
                  </div>
                </div>
                )}

                {supportsShaderControl('toonLightColorR') && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-300">Toon Light Color</label>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">
                      Red: <span className="text-red-400 font-bold">{toonLightColorR.toFixed(2)}</span>
                    </label>
                    <Slider
                      value={[toonLightColorR]}
                      onValueChange={(v) => handleToonLightColorRChange(v)}
                      min={0.0}
                      max={1.0}
                      step={0.01}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">
                      Green: <span className="text-green-400 font-bold">{toonLightColorG.toFixed(2)}</span>
                    </label>
                    <Slider
                      value={[toonLightColorG]}
                      onValueChange={(v) => handleToonLightColorGChange(v)}
                      min={0.0}
                      max={1.0}
                      step={0.01}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">
                      Blue: <span className="text-blue-400 font-bold">{toonLightColorB.toFixed(2)}</span>
                    </label>
                    <Slider
                      value={[toonLightColorB]}
                      onValueChange={(v) => handleToonLightColorBChange(v)}
                      min={0.0}
                      max={1.0}
                      step={0.01}
                      className="w-full"
                    />
                  </div>
                </div>
                )}

                {!hasEffectControls && (
                  <p className="text-xs text-slate-500">This shader does not expose effect controls.</p>
                )}
              </div>
            )}
          </div>

          {/* Objects Section */}
          <div className="space-y-2">
            <button
              onClick={() => toggleSection('objects')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Boxes className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-semibold text-white">Objects</span>
              </div>
              <span className="text-xs text-slate-400">{expandedSection === 'objects' ? '▼' : '▶'}</span>
            </button>

            {expandedSection === 'objects' && (
              <div className="space-y-3 pl-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Boat Model</label>
                  <select
                    value={boatModel}
                    onChange={(e) => handleBoatModelChange(e.target.value as BoatModelId)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-white text-sm focus:outline-none focus:border-amber-400/50 transition-colors"
                  >
                    {BOAT_MODEL_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Boat Scale: <span className="text-amber-400 font-bold">{boatScale.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[boatScale]}
                    onValueChange={(v) => handleBoatScaleChange(v)}
                    min={0.01}
                    max={2.0}
                    step={0.01}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Boat X Position: <span className="text-amber-400 font-bold">{boatX.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[boatX]}
                    onValueChange={(v) => handleBoatXChange(v)}
                    min={-200.0}
                    max={200.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Boat Z Position: <span className="text-amber-400 font-bold">{boatZ.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[boatZ]}
                    onValueChange={(v) => handleBoatZChange(v)}
                    min={-200.0}
                    max={200.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Boat Y Position: <span className="text-amber-400 font-bold">{boatYOffset.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[boatYOffset]}
                    onValueChange={(v) => handleBoatYOffsetChange(v)}
                    min={-10.0}
                    max={10.0}
                    step={0.05}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Island Model</label>
                  <select
                    value={islandModel}
                    onChange={(e) => handleIslandModelChange(e.target.value as IslandModelId)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-white text-sm focus:outline-none focus:border-amber-400/50 transition-colors"
                  >
                    {ISLAND_MODEL_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Island Scale: <span className="text-amber-400 font-bold">{islandScale.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[islandScale]}
                    onValueChange={(v) => handleIslandScaleChange(v)}
                    min={0.5}
                    max={2.0}
                    step={0.05}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Island X Position: <span className="text-amber-400 font-bold">{islandX.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[islandX]}
                    onValueChange={(v) => handleIslandXChange(v)}
                    min={-200.0}
                    max={200.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Island Z Position: <span className="text-amber-400 font-bold">{islandZ.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[islandZ]}
                    onValueChange={(v) => handleIslandZChange(v)}
                    min={-200.0}
                    max={200.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Island Y Position: <span className="text-amber-400 font-bold">{islandYOffset.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[islandYOffset]}
                    onValueChange={(v) => handleIslandYOffsetChange(v)}
                    min={-20.0}
                    max={20.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Island Shoreline Band: <span className="text-amber-400 font-bold">{islandShorelineBandWidth.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[islandShorelineBandWidth]}
                    onValueChange={(v) => handleIslandShorelineBandWidthChange(v)}
                    min={0.08}
                    max={0.8}
                    step={0.01}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Island Shoreline Foam Gain: <span className="text-amber-400 font-bold">{islandShorelineFoamGain.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[islandShorelineFoamGain]}
                    onValueChange={(v) => handleIslandShorelineFoamGainChange(v)}
                    min={0.0}
                    max={3.0}
                    step={0.05}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2 pt-1">
                  <label className="text-sm font-medium text-slate-300">Collision Source</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={collisionMode === 0 ? 'default' : 'outline'}
                      className={collisionMode === 0 ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'text-slate-300 border-slate-600'}
                      onClick={() => handleCollisionModeChange(0)}
                    >
                      GLB Geometry
                    </Button>
                    <Button
                      type="button"
                      variant={collisionMode === 1 ? 'default' : 'outline'}
                      className={collisionMode === 1 ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'text-slate-300 border-slate-600'}
                      onClick={() => handleCollisionModeChange(1)}
                    >
                      Physics Proxies
                    </Button>
                  </div>
                </div>

                {supportsShaderControl('intersectionFoamEnabled') && (
                <div className="space-y-2 border-t border-slate-700/30 pt-3 mt-3">
                  <label className="text-sm font-medium text-slate-300">Mesh-Water Intersection Foam</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={intersectionFoamEnabled === 1 ? 'default' : 'outline'}
                      className={intersectionFoamEnabled === 1 ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'text-slate-300 border-slate-600'}
                      onClick={() => handleIntersectionFoamEnabledChange(1)}
                    >
                      Enabled
                    </Button>
                    <Button
                      type="button"
                      variant={intersectionFoamEnabled === 0 ? 'default' : 'outline'}
                      className={intersectionFoamEnabled === 0 ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'text-slate-300 border-slate-600'}
                      onClick={() => handleIntersectionFoamEnabledChange(0)}
                    >
                      Disabled
                    </Button>
                  </div>
                </div>
                )}

                {supportsShaderControl('intersectionFoamIntensity') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Intersection Intensity: <span className="text-amber-400 font-bold">{intersectionFoamIntensity.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[intersectionFoamIntensity]}
                    onValueChange={(v) => handleIntersectionFoamIntensityChange(v)}
                    min={0.0}
                    max={2.0}
                    step={0.05}
                    className="w-full"
                  />
                </div>
                )}

                {supportsShaderControl('intersectionFoamWidth') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Intersection Width: <span className="text-amber-400 font-bold">{intersectionFoamWidth.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[intersectionFoamWidth]}
                    onValueChange={(v) => handleIntersectionFoamWidthChange(v)}
                    min={0.1}
                    max={3.0}
                    step={0.05}
                    className="w-full"
                  />
                </div>
                )}

                {supportsShaderControl('intersectionFoamFalloff') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Intersection Falloff: <span className="text-amber-400 font-bold">{intersectionFoamFalloff.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[intersectionFoamFalloff]}
                    onValueChange={(v) => handleIntersectionFoamFalloffChange(v)}
                    min={0.1}
                    max={3.0}
                    step={0.05}
                    className="w-full"
                  />
                </div>
                )}

                {supportsShaderControl('intersectionFoamNoise') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Intersection Noise: <span className="text-amber-400 font-bold">{intersectionFoamNoise.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[intersectionFoamNoise]}
                    onValueChange={(v) => handleIntersectionFoamNoiseChange(v)}
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    className="w-full"
                  />
                </div>
                )}

                {supportsShaderControl('intersectionFoamVerticalRange') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Vertical Range: <span className="text-amber-400 font-bold">{intersectionFoamVerticalRange.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[intersectionFoamVerticalRange]}
                    onValueChange={(v) => handleIntersectionFoamVerticalRangeChange(v)}
                    min={0.2}
                    max={4.0}
                    step={0.05}
                    className="w-full"
                  />
                </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Physics Proxy Visibility</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={showProxySpheres === 1 ? 'default' : 'outline'}
                      className={showProxySpheres === 1 ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'text-slate-300 border-slate-600'}
                      onClick={() => handleProxyVisibilityChange(1)}
                    >
                      Show
                    </Button>
                    <Button
                      type="button"
                      variant={showProxySpheres === 0 ? 'default' : 'outline'}
                      className={showProxySpheres === 0 ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'text-slate-300 border-slate-600'}
                      onClick={() => handleProxyVisibilityChange(0)}
                    >
                      Hide
                    </Button>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleLogOffsets}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white"
                >
                  Log GLB to Proxy Offsets
                </Button>
              </div>
            )}
          </div>

          {/* Camera Section */}
          <div className="space-y-2">
            <button
              onClick={() => toggleSection('camera')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-green-400" />
                <span className="text-sm font-semibold text-white">Camera</span>
              </div>
              <span className="text-xs text-slate-400">{expandedSection === 'camera' ? '▼' : '▶'}</span>
            </button>

            {expandedSection === 'camera' && (
              <div className="space-y-3 pl-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Distance: <span className="text-green-400 font-bold">{cameraDistance.toFixed(0)}</span>
                  </label>
                  <Slider
                    value={[cameraDistance]}
                    onValueChange={(v) => handleCameraDistanceChange(v)}
                    min={30}
                    max={300}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Height: <span className="text-green-400 font-bold">{cameraHeight.toFixed(0)}</span>
                  </label>
                  <Slider
                    value={[cameraHeight]}
                    onValueChange={(v) => handleCameraHeightChange(v)}
                    min={0}
                    max={600}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Angle: <span className="text-green-400 font-bold">{cameraAngle.toFixed(0)}°</span>
                  </label>
                  <Slider
                    value={[cameraAngle]}
                    onValueChange={(v) => handleCameraAngleChange(v)}
                    min={0}
                    max={360}
                    step={5}
                    className="w-full"
                  />
                </div>

                <Button
                  type="button"
                  onClick={handleToggleTopDownView}
                  className="w-full bg-green-600 hover:bg-green-500 text-white"
                >
                  {isTopDownView ? 'Normal View' : 'Top Down View'}
                </Button>
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="border-t border-slate-700/30 pt-3 mt-3 text-xs text-slate-400 space-y-1">
            <p>🖱️ <span className="text-slate-300">Mouse drag</span> to look around</p>
            <p>⌨️ <span className="text-slate-300">Arrow keys</span> to move | <span className="text-slate-300">Q/E</span> down/up | <span className="text-slate-300">Shift</span> for boost</p>
            <p>✨ <span className="text-slate-300">512×512 mesh</span> for SIGGRAPH quality</p>
          </div>
        </CardContent>
      </Card>
    </div>
    <button
      type="button"
      onClick={() => setIsPanelCollapsed(false)}
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-2xl border border-slate-600/60 bg-slate-900/90 px-3 py-2 text-slate-100 shadow-xl backdrop-blur-md hover:bg-slate-800/90 transform-gpu transition-all duration-200 ease-out ${chipTransitionClasses}`}
      aria-label="Open controls"
    >
      <Menu className="h-4 w-4" />
      <span className="text-xs font-semibold">Controls</span>
    </button>
    {startupConflictDialog}
    </>
  );
}
