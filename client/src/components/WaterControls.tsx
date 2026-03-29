import React, { useState, useCallback, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, Settings2, Eye, Wind, Boxes } from 'lucide-react';

interface WaterControlsProps {
  onParameterChange: (key: string, value: number) => void;
  onCameraChange: (x: number, y: number, z: number) => void;
  onTopDownView: () => void;
}

type ControlValues = {
  waveAmplitude: number;
  waveFrequency: number;
  windDirection: number;
  windSpeed: number;
  foamIntensity: number;
  foamWidth: number;
  foamNoiseFactor: number;
  causticIntensity: number;
  depthFadeDistance: number;
  depthFadeExponent: number;
  boatScale: number;
  boatYOffset: number;
  islandScale: number;
  islandYOffset: number;
  collisionMode: number;
  showProxySpheres: number;
  cameraDistance: number;
  cameraHeight: number;
};

const STORAGE_KEY = 'sigma-water-controls-v1';

const DEFAULT_VALUES: ControlValues = {
  waveAmplitude: 1.8,
  waveFrequency: 1.2,
  windDirection: 45,
  windSpeed: 0.6,
  foamIntensity: 0.7,
  foamWidth: 1.0,
  foamNoiseFactor: 0.45,
  causticIntensity: 0.85,
  depthFadeDistance: 1.15,
  depthFadeExponent: 1.65,
  boatScale: 1,
  boatYOffset: 0.4,
  islandScale: 1,
  islandYOffset: 0,
  collisionMode: 0,
  showProxySpheres: 1,
  cameraDistance: 100,
  cameraHeight: 50,
};

const PARAM_KEYS: Record<keyof ControlValues, string> = {
  waveAmplitude: 'wa',
  waveFrequency: 'wf',
  windDirection: 'wd',
  windSpeed: 'ws',
  foamIntensity: 'fi',
  foamWidth: 'fw',
  foamNoiseFactor: 'fn',
  causticIntensity: 'ci',
  depthFadeDistance: 'dfd',
  depthFadeExponent: 'dfe',
  boatScale: 'bs',
  boatYOffset: 'by',
  islandScale: 'is',
  islandYOffset: 'iy',
  collisionMode: 'cm',
  showProxySpheres: 'ps',
  cameraDistance: 'cd',
  cameraHeight: 'ch',
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
    const sourceVal = paramVal ?? (stored[key] as number | undefined);
    if (sourceVal === undefined || sourceVal === null) return;

    const parsed = Number(sourceVal);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      next[key] = parsed;
    }
  });

  return next;
}

export function WaterControls({ onParameterChange, onCameraChange, onTopDownView }: WaterControlsProps) {
  const initialValues = useState<ControlValues>(() => getInitialValues())[0];

  // Wave parameters
  const [waveAmplitude, setWaveAmplitude] = useState(initialValues.waveAmplitude);
  const [waveFrequency, setWaveFrequency] = useState(initialValues.waveFrequency);
  const [windDirection, setWindDirection] = useState(initialValues.windDirection);
  const [windSpeed, setWindSpeed] = useState(initialValues.windSpeed);

  // Visual effects
  const [foamIntensity, setFoamIntensity] = useState(initialValues.foamIntensity);
  const [foamWidth, setFoamWidth] = useState(initialValues.foamWidth);
  const [foamNoiseFactor, setFoamNoiseFactor] = useState(initialValues.foamNoiseFactor);
  const [causticIntensity, setCausticIntensity] = useState(initialValues.causticIntensity);
  const [depthFadeDistance, setDepthFadeDistance] = useState(initialValues.depthFadeDistance);
  const [depthFadeExponent, setDepthFadeExponent] = useState(initialValues.depthFadeExponent);

  // Objects
  const [boatScale, setBoatScale] = useState(initialValues.boatScale);
  const [boatYOffset, setBoatYOffset] = useState(initialValues.boatYOffset);
  const [islandScale, setIslandScale] = useState(initialValues.islandScale);
  const [islandYOffset, setIslandYOffset] = useState(initialValues.islandYOffset);
  const [collisionMode, setCollisionMode] = useState(initialValues.collisionMode);
  const [showProxySpheres, setShowProxySpheres] = useState(initialValues.showProxySpheres);

  // Camera
  const [cameraDistance, setCameraDistance] = useState(initialValues.cameraDistance);
  const [cameraHeight, setCameraHeight] = useState(initialValues.cameraHeight);

  // UI state
  const [expandedSection, setExpandedSection] = useState<'waves' | 'effects' | 'objects' | 'camera' | null>('waves');

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
    onParameterChange('foamIntensity', initialValues.foamIntensity);
    onParameterChange('foamWidth', initialValues.foamWidth);
    onParameterChange('foamNoiseFactor', initialValues.foamNoiseFactor);
    onParameterChange('causticIntensity', initialValues.causticIntensity);
    onParameterChange('depthFadeDistance', initialValues.depthFadeDistance);
    onParameterChange('depthFadeExponent', initialValues.depthFadeExponent);
    onParameterChange('boatScale', initialValues.boatScale);
    onParameterChange('boatYOffset', initialValues.boatYOffset);
    onParameterChange('islandScale', initialValues.islandScale);
    onParameterChange('islandYOffset', initialValues.islandYOffset);
    onParameterChange('collisionMode', initialValues.collisionMode);
    onParameterChange('showProxySpheres', initialValues.showProxySpheres);

    const angle = (initialValues.windDirection * Math.PI) / 180;
    const x = ISLAND_X + Math.cos(angle) * initialValues.cameraDistance;
    const z = ISLAND_Z + Math.sin(angle) * initialValues.cameraDistance;
    onCameraChange(x, initialValues.cameraHeight, z);
  }, [initialValues, onParameterChange, onCameraChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const values: ControlValues = {
      waveAmplitude,
      waveFrequency,
      windDirection,
      windSpeed,
      foamIntensity,
      foamWidth,
      foamNoiseFactor,
      causticIntensity,
      depthFadeDistance,
      depthFadeExponent,
      boatScale,
      boatYOffset,
      islandScale,
      islandYOffset,
      collisionMode,
      showProxySpheres,
      cameraDistance,
      cameraHeight,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));

    const params = new URLSearchParams(window.location.search);
    (Object.keys(values) as Array<keyof ControlValues>).forEach((key) => {
      params.set(PARAM_KEYS[key], String(values[key]));
    });

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
  }, [
    waveAmplitude,
    waveFrequency,
    windDirection,
    windSpeed,
    foamIntensity,
    foamWidth,
    foamNoiseFactor,
    causticIntensity,
    depthFadeDistance,
    depthFadeExponent,
    boatScale,
    boatYOffset,
    islandScale,
    islandYOffset,
    collisionMode,
    showProxySpheres,
    cameraDistance,
    cameraHeight,
  ]);

  const handleWindDirectionChange = useCallback((value: number[]) => {
    const val = value[0];
    setWindDirection(val);
    onParameterChange('windDirection', val);
    // Update camera to follow wind direction
    const angle = (val * Math.PI) / 180;
    const x = ISLAND_X + Math.cos(angle) * cameraDistance;
    const z = ISLAND_Z + Math.sin(angle) * cameraDistance;
    onCameraChange(x, cameraHeight, z);
  }, [onParameterChange, onCameraChange, cameraDistance, cameraHeight]);

  const handleWindSpeedChange = useCallback((value: number[]) => {
    const val = value[0];
    setWindSpeed(val);
    onParameterChange('windSpeed', val);
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

  const handleCausticIntensityChange = useCallback((value: number[]) => {
    const val = value[0];
    setCausticIntensity(val);
    onParameterChange('causticIntensity', val);
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

  const handleCameraDistanceChange = useCallback((value: number[]) => {
    const val = value[0];
    setCameraDistance(val);
    const angle = (windDirection * Math.PI) / 180;
    const x = ISLAND_X + Math.cos(angle) * val;
    const z = ISLAND_Z + Math.sin(angle) * val;
    onCameraChange(x, cameraHeight, z);
  }, [onCameraChange, windDirection, cameraHeight]);

  const handleCameraHeightChange = useCallback((value: number[]) => {
    const val = value[0];
    setCameraHeight(val);
    const angle = (windDirection * Math.PI) / 180;
    const x = ISLAND_X + Math.cos(angle) * cameraDistance;
    const z = ISLAND_Z + Math.sin(angle) * cameraDistance;
    onCameraChange(x, val, z);
  }, [onCameraChange, windDirection, cameraDistance]);

  const handleReset = useCallback(() => {
    setWaveAmplitude(1.8);
    setWaveFrequency(1.2);
    setWindDirection(45);
    setWindSpeed(0.6);
    setFoamIntensity(0.7);
    setFoamWidth(1.0);
    setFoamNoiseFactor(0.45);
    setCausticIntensity(0.85);
    setDepthFadeDistance(1.15);
    setDepthFadeExponent(1.65);
    setBoatScale(1);
    setBoatYOffset(0.4);
    setIslandScale(1);
    setIslandYOffset(0);
    setCollisionMode(0);
    setShowProxySpheres(1);
    setCameraDistance(100);
    setCameraHeight(50);

    onParameterChange('waveAmplitude', 1.8);
    onParameterChange('waveFrequency', 1.2);
    onParameterChange('windDirection', 45);
    onParameterChange('windSpeed', 0.6);
    onParameterChange('foamIntensity', 0.7);
    onParameterChange('foamWidth', 1.0);
    onParameterChange('foamNoiseFactor', 0.45);
    onParameterChange('causticIntensity', 0.85);
    onParameterChange('depthFadeDistance', 1.15);
    onParameterChange('depthFadeExponent', 1.65);
    onParameterChange('boatScale', 1);
    onParameterChange('boatYOffset', 0.4);
    onParameterChange('islandScale', 1);
    onParameterChange('islandYOffset', 0);
    onParameterChange('collisionMode', 0);
    onParameterChange('showProxySpheres', 1);
    onCameraChange(70.7, 50, 70.7);
  }, [onParameterChange, onCameraChange]);

  const toggleSection = (section: 'waves' | 'effects' | 'objects' | 'camera') => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-[600px] overflow-y-auto bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl z-50">
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
                      Sibling Spheres
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Proxy Sphere Visibility</label>
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
                  Log GLB to Sphere Offsets
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
