import React, { useState, useCallback, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, Settings2, Eye, Wind, Boxes } from 'lucide-react';
import { orbitCameraPosition } from '@/lib/cameraOrbit';
import { 
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
}

type ControlValues = {
  waveAmplitude: number;
  waveFrequency: number;
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
  causticIntensity: number;
  skyReflectionMix: number;
  normalDetailStrength: number;
  normalDistanceFalloff: number;
  depthFadeDistance: number;
  depthFadeExponent: number;
  specularIntensity: number;
  boatScale: number;
  boatYOffset: number;
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
  waveAmplitude: 1.8,
  waveFrequency: 1.2,
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
  causticIntensity: 0.85,
  skyReflectionMix: 0.72,
  normalDetailStrength: 0.55,
  normalDistanceFalloff: 0.03,
  depthFadeDistance: 1.15,
  depthFadeExponent: 1.65,
  specularIntensity: 1.0,
  boatScale: 1,
  boatYOffset: 0.4,
  islandScale: 1,
  islandYOffset: 0,
  islandShorelineBandWidth: 0.28,
  islandShorelineFoamGain: 1.0,
  collisionMode: 0,
  showProxySpheres: 1,
  cameraDistance: 100,
  cameraHeight: 50,
  cameraAngle: 0,
  waterType: { type: 'gerstnerWaves' },
};

const PARAM_KEYS: Record<keyof ControlValues, string> = {
  waveAmplitude: 'wa',
  waveFrequency: 'wf',
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
  causticIntensity: 'ci',
  skyReflectionMix: 'srm',
  normalDetailStrength: 'nds',
  normalDistanceFalloff: 'ndf',
  depthFadeDistance: 'dfd',
  depthFadeExponent: 'dfe',
  specularIntensity: 'si',
  boatScale: 'bs',
  boatYOffset: 'by',
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



function getInitialValues(): ControlValues {
  if (typeof window === 'undefined') return DEFAULT_VALUES;

  let stored: Partial<ControlValues> = {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) stored = JSON.parse(raw) as Partial<ControlValues>;
  } catch {
    stored = {};
  }

  const params = new URLSearchParams(window.location.search);
  const next: ControlValues = { ...DEFAULT_VALUES };

  (Object.keys(DEFAULT_VALUES) as Array<keyof ControlValues>).forEach((key) => {
    const shortKey = PARAM_KEYS[key];
    const paramVal = params.get(shortKey);
    const sourceVal = paramVal ?? (stored[key] as any);
    if (sourceVal === undefined || sourceVal === null) return;

    if (key === 'waterType') {
      next[key] = parseWaterType(String(sourceVal));
    } else {
      const parsed = Number(sourceVal);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        (next as any)[key] = parsed;
      }
    }
  });

  return next;
}

export function WaterControls({ onParameterChange, onCameraChange, onTopDownView, onShaderChange }: WaterControlsProps) {
  const initialValues = useState<ControlValues>(() => getInitialValues())[0];

  // Wave parameters
  const [waveAmplitude, setWaveAmplitude] = useState(initialValues.waveAmplitude);
  const [waveFrequency, setWaveFrequency] = useState(initialValues.waveFrequency);
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
  const [causticIntensity, setCausticIntensity] = useState(initialValues.causticIntensity);
  const [skyReflectionMix, setSkyReflectionMix] = useState(initialValues.skyReflectionMix);
  const [normalDetailStrength, setNormalDetailStrength] = useState(initialValues.normalDetailStrength);
  const [normalDistanceFalloff, setNormalDistanceFalloff] = useState(initialValues.normalDistanceFalloff);
  const [depthFadeDistance, setDepthFadeDistance] = useState(initialValues.depthFadeDistance);
  const [depthFadeExponent, setDepthFadeExponent] = useState(initialValues.depthFadeExponent);
  const [specularIntensity, setSpecularIntensity] = useState(initialValues.specularIntensity);

  // Objects
  const [boatScale, setBoatScale] = useState(initialValues.boatScale);
  const [boatYOffset, setBoatYOffset] = useState(initialValues.boatYOffset);
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

  // Water type (shader selection)
  const [waterType, setWaterType] = useState(initialValues.waterType);

  // UI state
  const [expandedSection, setExpandedSection] = useState<'waves' | 'effects' | 'objects' | 'camera' | 'waterType' | null>('waves');

  const handleWaveAmplitudeChange = useCallback((value: number[]) => {
    const val = value[0];
    setWaveAmplitude(val);
    onParameterChange('waveAmplitude', val);
  }, [onParameterChange]);

  const handleWaveFrequencyChange = useCallback((value: number[]) => {
    const val = value[0];
    setWaveFrequency(val);
    onParameterChange('waveFrequency', val);
  }, [onParameterChange]);

  const ISLAND_X = 22;
  const ISLAND_Z = 10;

  useEffect(() => {
    // Ensure renderer state matches restored controls on first mount.
    onParameterChange('waveAmplitude', initialValues.waveAmplitude);
    onParameterChange('waveFrequency', initialValues.waveFrequency);
    onParameterChange('windDirection', initialValues.windDirection);
    onParameterChange('windSpeed', initialValues.windSpeed);
    onParameterChange('crestFoamEnabled', initialValues.crestFoamEnabled);
    onParameterChange('crestFoamThreshold', initialValues.crestFoamThreshold);
    onParameterChange('foamIntensity', initialValues.foamIntensity);
    onParameterChange('foamWidth', initialValues.foamWidth);
    onParameterChange('foamNoiseFactor', initialValues.foamNoiseFactor);
    onParameterChange('foamCellScale', initialValues.foamCellScale);
    onParameterChange('foamShredSlope', initialValues.foamShredSlope);
    onParameterChange('foamFizzWeight', initialValues.foamFizzWeight);
    onParameterChange('intersectionFoamEnabled', initialValues.intersectionFoamEnabled);
    onParameterChange('intersectionFoamIntensity', initialValues.intersectionFoamIntensity);
    onParameterChange('intersectionFoamWidth', initialValues.intersectionFoamWidth);
    onParameterChange('intersectionFoamFalloff', initialValues.intersectionFoamFalloff);
    onParameterChange('intersectionFoamNoise', initialValues.intersectionFoamNoise);
    onParameterChange('intersectionFoamVerticalRange', initialValues.intersectionFoamVerticalRange);
    onParameterChange('underwaterEnabled', initialValues.underwaterEnabled);
    onParameterChange('underwaterTransitionDepth', initialValues.underwaterTransitionDepth);
    onParameterChange('underwaterFogDensity', initialValues.underwaterFogDensity);
    onParameterChange('underwaterHorizonMix', initialValues.underwaterHorizonMix);
    onParameterChange('underwaterColorR', initialValues.underwaterColorR);
    onParameterChange('underwaterColorG', initialValues.underwaterColorG);
    onParameterChange('underwaterColorB', initialValues.underwaterColorB);
    onParameterChange('causticIntensity', initialValues.causticIntensity);
    onParameterChange('skyReflectionMix', initialValues.skyReflectionMix);
    onParameterChange('normalDetailStrength', initialValues.normalDetailStrength);
    onParameterChange('normalDistanceFalloff', initialValues.normalDistanceFalloff);
    onParameterChange('depthFadeDistance', initialValues.depthFadeDistance);
    onParameterChange('depthFadeExponent', initialValues.depthFadeExponent);
    onParameterChange('specularIntensity', initialValues.specularIntensity);
    onParameterChange('boatScale', initialValues.boatScale);
    onParameterChange('boatYOffset', initialValues.boatYOffset);
    onParameterChange('islandScale', initialValues.islandScale);
    onParameterChange('islandYOffset', initialValues.islandYOffset);
    onParameterChange('islandShorelineBandWidth', initialValues.islandShorelineBandWidth);
    onParameterChange('islandShorelineFoamGain', initialValues.islandShorelineFoamGain);
    onParameterChange('collisionMode', initialValues.collisionMode);
    onParameterChange('showProxySpheres', initialValues.showProxySpheres);

    const position = orbitCameraPosition(
      { x: ISLAND_X, z: ISLAND_Z },
      initialValues.cameraAngle,
      initialValues.cameraDistance,
      initialValues.cameraHeight
    );
    onCameraChange(position.x, position.y, position.z);
  }, [initialValues, onParameterChange, onCameraChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const values: ControlValues = {
      waveAmplitude,
      waveFrequency,
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
      causticIntensity,
      skyReflectionMix,
      normalDetailStrength,
      normalDistanceFalloff,
      depthFadeDistance,
      depthFadeExponent,
      specularIntensity,
      boatScale,
      boatYOffset,
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
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));

    const params = new URLSearchParams(window.location.search);
    (Object.keys(values) as Array<keyof ControlValues>).forEach((key) => {
      if (key === 'waterType') {
        params.set(PARAM_KEYS[key], serializeWaterType(values[key]));
      } else {
        params.set(PARAM_KEYS[key], String(values[key]));
      }
    });

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
  }, [
    waveAmplitude,
    waveFrequency,
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
    causticIntensity,
    skyReflectionMix,
    normalDetailStrength,
    normalDistanceFalloff,
    depthFadeDistance,
    depthFadeExponent,
    specularIntensity,
    boatScale,
    boatYOffset,
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
  }, [onParameterChange]);

  const handleProxyVisibilityChange = useCallback((enabled: number) => {
    setShowProxySpheres(enabled);
    onParameterChange('showProxySpheres', enabled);
  }, [onParameterChange]);

  const handleLogOffsets = useCallback(() => {
    onParameterChange('logSiblingOffsets', 1);
  }, [onParameterChange]);

  const handleMoveGlbsToSpheres = useCallback(() => {
    onParameterChange('moveGlbsToSpheres', 1);
  }, [onParameterChange]);

  const handleCameraDistanceChange = useCallback((value: number[]) => {
    const val = value[0];
    setCameraDistance(val);
    const position = orbitCameraPosition({ x: ISLAND_X, z: ISLAND_Z }, cameraAngle, val, cameraHeight);
    onCameraChange(position.x, position.y, position.z);
  }, [onCameraChange, cameraAngle, cameraHeight]);

  const handleCameraHeightChange = useCallback((value: number[]) => {
    const val = value[0];
    setCameraHeight(val);
    const position = orbitCameraPosition({ x: ISLAND_X, z: ISLAND_Z }, cameraAngle, cameraDistance, val);
    onCameraChange(position.x, position.y, position.z);
  }, [onCameraChange, cameraAngle, cameraDistance]);

  const handleCameraAngleChange = useCallback((value: number[]) => {
    const val = value[0];
    setCameraAngle(val);
    const position = orbitCameraPosition({ x: ISLAND_X, z: ISLAND_Z }, val, cameraDistance, cameraHeight);
    onCameraChange(position.x, position.y, position.z);
  }, [onCameraChange, cameraDistance, cameraHeight]);

  const handleReset = useCallback(() => {
    setWaveAmplitude(1.8);
    setWaveFrequency(1.2);
    setWindDirection(45);
    setWindSpeed(0.6);
    setFoamIntensity(0.7);
    setFoamWidth(1.0);
    setFoamNoiseFactor(0.45);
    setFoamCellScale(0.115);
    setFoamShredSlope(0.56);
    setFoamFizzWeight(0.28);
    setCausticIntensity(0.85);
    setSkyReflectionMix(0.72);
    setNormalDetailStrength(0.55);
    setNormalDistanceFalloff(0.03);
    setDepthFadeDistance(1.15);
    setDepthFadeExponent(1.65);
    setSpecularIntensity(1.0);
    setBoatScale(1);
    setBoatYOffset(0.4);
    setIslandScale(1);
    setIslandYOffset(0);
    setIslandShorelineBandWidth(0.28);
    setIslandShorelineFoamGain(1.0);
    setCollisionMode(0);
    setShowProxySpheres(1);
    setCameraDistance(100);
    setCameraHeight(50);
    setCameraAngle(0);
    const defaultWaterType = { type: 'gerstnerWaves' as const };
    setWaterType(defaultWaterType);

    onParameterChange('waveAmplitude', 1.8);
    onParameterChange('waveFrequency', 1.2);
    onParameterChange('windDirection', 45);
    onParameterChange('windSpeed', 0.6);
    onParameterChange('foamIntensity', 0.7);
    onParameterChange('foamWidth', 1.0);
    onParameterChange('foamNoiseFactor', 0.45);
    onParameterChange('foamCellScale', 0.115);
    onParameterChange('foamShredSlope', 0.56);
    onParameterChange('foamFizzWeight', 0.28);
    onParameterChange('causticIntensity', 0.85);
    onParameterChange('skyReflectionMix', 0.72);
    onParameterChange('normalDetailStrength', 0.55);
    onParameterChange('normalDistanceFalloff', 0.03);
    onParameterChange('depthFadeDistance', 1.15);
    onParameterChange('depthFadeExponent', 1.65);
    onParameterChange('specularIntensity', 1.0);
    onParameterChange('boatScale', 1);
    onParameterChange('boatYOffset', 0.4);
    onParameterChange('islandScale', 1);
    onParameterChange('islandYOffset', 0);
    onParameterChange('islandShorelineBandWidth', 0.28);
    onParameterChange('islandShorelineFoamGain', 1.0);
    onParameterChange('collisionMode', 0);
    onParameterChange('showProxySpheres', 1);
    
    // Reset shader
    if (onShaderChange) {
      onShaderChange(defaultWaterType);
    }
    
    const position = orbitCameraPosition({ x: ISLAND_X, z: ISLAND_Z }, 0, 100, 50);
    onCameraChange(position.x, position.y, position.z);
  }, [onParameterChange, onCameraChange, onShaderChange]);

  const handleShaderChange = useCallback((shaderName: string) => {
    const newWaterType = parseWaterType(shaderName);
    setWaterType(newWaterType);
    if (onShaderChange) {
      onShaderChange(newWaterType);
    }
  }, [onShaderChange]);

  const toggleSection = (section: 'waves' | 'effects' | 'objects' | 'camera' | 'waterType') => {
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
    'specularIntensity',
  ].some((key) => supportsShaderControl(key as ShaderControlKey));

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-[600px] overflow-y-auto bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl z-50 select-none">
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="pb-3 border-b border-slate-700/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold text-white">🌊 Controls</CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-1">SIGGRAPH-Grade Rendering</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              title="Reset to defaults"
              className="h-8 w-8 p-0 hover:bg-slate-700/50"
            >
              <RotateCcw className="h-4 w-4 text-slate-300" />
            </Button>
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
                  <label className="text-sm font-medium text-slate-300">
                    Boat Scale: <span className="text-amber-400 font-bold">{boatScale.toFixed(2)}</span>
                  </label>
                  <Slider
                    value={[boatScale]}
                    onValueChange={(v) => handleBoatScaleChange(v)}
                    min={0.5}
                    max={2.0}
                    step={0.05}
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

                <Button
                  type="button"
                  onClick={handleMoveGlbsToSpheres}
                  className="w-full bg-emerald-700 hover:bg-emerald-600 text-white"
                >
                  Move GLBs To Physics Proxies
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
                    min={10}
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
                  onClick={onTopDownView}
                  className="w-full bg-green-600 hover:bg-green-500 text-white"
                >
                  Top-Down View
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
  );
}
