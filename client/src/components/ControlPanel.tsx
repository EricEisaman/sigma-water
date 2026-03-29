import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ControlPanelProps {
  onParameterChange: (key: string, value: number) => void;
  onColorChange: (key: string, value: string) => void;
  onFoamQualityChange?: (quality: "high" | "medium" | "low") => void;
}

export function ControlPanel({
  onParameterChange,
  onColorChange,
  onFoamQualityChange,
}: ControlPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [waterColor, setWaterColor] = useState("#1E90FF");
  const [deepColor, setDeepColor] = useState("#001F3F");
  const [foamQuality, setFoamQuality] = useState<"high" | "medium" | "low">("high");

  const handleColorChange = (key: string, value: string) => {
    if (key === "waterColor") {
      setWaterColor(value);
    } else {
      setDeepColor(value);
    }
    onColorChange(key, value);
  };

  return (
    <div className="absolute bottom-4 right-4 bg-black bg-opacity-80 text-white rounded-lg border border-blue-500 border-opacity-30 overflow-hidden max-w-sm">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-blue-900 hover:bg-opacity-20 transition"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="text-lg font-bold text-blue-400">Water Controls</h2>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5" />
        ) : (
          <ChevronDown className="w-5 h-5" />
        )}
      </div>

      {/* Controls */}
      {isExpanded && (
        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
          {/* Wave Amplitude */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300 flex justify-between">
              <span>Wave Amplitude</span>
              <span className="text-blue-400" id="waveAmplitude-value">1.5</span>
            </label>
            <input
              type="range"
              min="0.1"
              max="5.0"
              step="0.1"
              defaultValue="1.5"
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('waveAmplitude-value')!.textContent = value.toFixed(1);
                onParameterChange("waveAmplitude", value);
              }}
              className="w-full"
            />
          </div>

          {/* Wave Frequency */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300 flex justify-between">
              <span>Wave Frequency</span>
              <span className="text-blue-400" id="waveFrequency-value">1.0</span>
            </label>
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.1"
              defaultValue="1.0"
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('waveFrequency-value')!.textContent = value.toFixed(1);
                onParameterChange("waveFrequency", value);
              }}
              className="w-full"
            />
          </div>

          {/* Wind Direction */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300 flex justify-between">
              <span>Wind Direction</span>
              <span className="text-blue-400" id="windDirection-value">45°</span>
            </label>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              defaultValue="45"
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('windDirection-value')!.textContent = value + '°';
                onParameterChange("windDirection", value);
              }}
              className="w-full"
            />
          </div>

          {/* Foam Intensity */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300 flex justify-between">
              <span>Foam Intensity</span>
              <span className="text-blue-400" id="foamIntensity-value">0.6</span>
            </label>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.1"
              defaultValue="0.6"
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('foamIntensity-value')!.textContent = value.toFixed(1);
                onParameterChange("foamIntensity", value);
              }}
              className="w-full"
            />
          </div>

          {/* Caustics Intensity */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300 flex justify-between">
              <span>Caustics Intensity</span>
              <span className="text-blue-400" id="causticsIntensity-value">0.5</span>
            </label>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.1"
              defaultValue="0.5"
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('causticsIntensity-value')!.textContent = value.toFixed(1);
                onParameterChange("causticsIntensity", value);
              }}
              className="w-full"
            />
          </div>

          {/* Sun Intensity */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300 flex justify-between">
              <span>Sun Intensity</span>
              <span className="text-blue-400" id="sunIntensity-value">1.0</span>
            </label>
            <input
              type="range"
              min="0.0"
              max="2.0"
              step="0.1"
              defaultValue="1.0"
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('sunIntensity-value')!.textContent = value.toFixed(1);
                onParameterChange("sunIntensity", value);
              }}
              className="w-full"
            />
          </div>

          {/* Camera Speed */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300 flex justify-between">
              <span>Camera Speed</span>
              <span className="text-blue-400" id="cameraSpeed-value">1.0</span>
            </label>
            <input
              type="range"
              min="0.1"
              max="5.0"
              step="0.1"
              defaultValue="1.0"
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('cameraSpeed-value')!.textContent = value.toFixed(1);
                onParameterChange("cameraSpeed", value);
              }}
              className="w-full"
            />
          </div>

          {/* Water Color */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Water Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={waterColor}
                onChange={(e) =>
                  handleColorChange("waterColor", e.target.value)
                }
                className="w-12 h-10 rounded cursor-pointer"
              />
              <span className="text-xs text-gray-400">{waterColor}</span>
            </div>
          </div>

          {/* Deep Color */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Deep Water Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={deepColor}
                onChange={(e) =>
                  handleColorChange("deepColor", e.target.value)
                }
                className="w-12 h-10 rounded cursor-pointer"
              />
              <span className="text-xs text-gray-400">{deepColor}</span>
            </div>
          </div>

          {/* Foam Quality */}
          <div className="space-y-2 pb-2 border-b border-gray-700">
            <label className="block text-sm font-medium text-gray-300">
              Foam Quality
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setFoamQuality('low');
                  onFoamQualityChange?.('low');
                }}
                className={`flex-1 py-2 px-2 rounded text-xs font-medium transition ${
                  foamQuality === 'low'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Low
              </button>
              <button
                onClick={() => {
                  setFoamQuality('medium');
                  onFoamQualityChange?.('medium');
                }}
                className={`flex-1 py-2 px-2 rounded text-xs font-medium transition ${
                  foamQuality === 'medium'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Medium
              </button>
              <button
                onClick={() => {
                  setFoamQuality('high');
                  onFoamQualityChange?.('high');
                }}
                className={`flex-1 py-2 px-2 rounded text-xs font-medium transition ${
                  foamQuality === 'high'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                High
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
            <p>Use mouse to rotate camera</p>
            <p>Scroll to zoom in/out</p>
          </div>
        </div>
      )}
    </div>
  );
}
