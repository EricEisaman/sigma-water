import React, { useState, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, Settings2, Eye, Wind, Boxes } from 'lucide-react';

interface WaterControlsProps {
  onParameterChange: (key: string, value: number) => void;
  onCameraChange: (x: number, y: number, z: number) => void;
}

export function WaterControls({ onParameterChange, onCameraChange }: WaterControlsProps) {
  // Wave parameters
  const [waveAmplitude, setWaveAmplitude] = useState(1.8);
  const [waveFrequency, setWaveFrequency] = useState(1.2);
  const [windDirection, setWindDirection] = useState(45);
  const [windSpeed, setWindSpeed] = useState(0.6);

  // Visual effects
  const [foamIntensity, setFoamIntensity] = useState(0.7);
  const [causticIntensity, setCausticIntensity] = useState(0.85);
  const [depthFadeDistance, setDepthFadeDistance] = useState(1.15);
  const [depthFadeExponent, setDepthFadeExponent] = useState(1.65);

  // Objects
  const [boatScale, setBoatScale] = useState(1);
  const [boatYOffset, setBoatYOffset] = useState(0.4);
  const [islandScale, setIslandScale] = useState(1);
  const [islandYOffset, setIslandYOffset] = useState(0);

  // Camera
  const [cameraDistance, setCameraDistance] = useState(100);
  const [cameraHeight, setCameraHeight] = useState(50);

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
    setCausticIntensity(0.85);
    setDepthFadeDistance(1.15);
    setDepthFadeExponent(1.65);
    setBoatScale(1);
    setBoatYOffset(0.4);
    setIslandScale(1);
    setIslandYOffset(0);
    setCameraDistance(100);
    setCameraHeight(50);

    onParameterChange('waveAmplitude', 1.8);
    onParameterChange('waveFrequency', 1.2);
    onParameterChange('windDirection', 45);
    onParameterChange('windSpeed', 0.6);
    onParameterChange('foamIntensity', 0.7);
    onParameterChange('causticIntensity', 0.85);
    onParameterChange('depthFadeDistance', 1.15);
    onParameterChange('depthFadeExponent', 1.65);
    onParameterChange('boatScale', 1);
    onParameterChange('boatYOffset', 0.4);
    onParameterChange('islandScale', 1);
    onParameterChange('islandYOffset', 0);
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
                    min={-1.0}
                    max={3.0}
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
                    min={-8.0}
                    max={12.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>
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
                    max={200}
                    step={5}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="border-t border-slate-700/30 pt-3 mt-3 text-xs text-slate-400 space-y-1">
            <p>🖱️ <span className="text-slate-300">Mouse</span> to rotate camera</p>
            <p>⌨️ <span className="text-slate-300">WASD</span> to move | <span className="text-slate-300">Scroll</span> to zoom</p>
            <p>✨ <span className="text-slate-300">512×512 mesh</span> for SIGGRAPH quality</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
