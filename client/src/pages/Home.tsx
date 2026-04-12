import { useEffect, useRef, useState } from "react";
import { WaterControls } from "@/components/WaterControls";
import { VisualOcean, type BoatModelId, type IslandModelId, WaterType, serializeWaterType, BOAT_MODEL_OPTIONS, ISLAND_MODEL_OPTIONS } from "@sigma-water/core";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const oceanRef = useRef<VisualOcean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [boatModel, setBoatModel] = useState<BoatModelId>('divingBoat');
  const [islandModel, setIslandModel] = useState<IslandModelId>('boathouseIsland');
  const [collisionMode, setCollisionMode] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let oceanInstance: VisualOcean | null = null;

    const initializeScene = async () => {
      try {
        console.log("🎬 SIGGRAPH Ocean Renderer - Initializing...");

        // Create and initialize ocean
        const ocean = new VisualOcean(canvas, {
          assetBaseUrl: '/assets',
          // React owns listener lifecycle in this integration layer.
          enableGlobalListeners: false,
        });
        await ocean.initialize();

        if (disposed) {
          ocean.dispose();
          return;
        }

        oceanInstance = ocean;
        oceanRef.current = ocean;

        setInitialized(true);
        setLoading(false);
        console.log("✅ Ocean scene initialized successfully");

        // Babylon blessed pattern: canvas host owns resize subscription and cleanup.
        const handleResize = () => {
          ocean.resize();
        };
        const handleHostKeyDown = (event: KeyboardEvent) => {
          if (event.key === 'Shift') {
            ocean.setSpeedBoostActive(true);
          }
        };
        const handleHostKeyUp = (event: KeyboardEvent) => {
          if (event.key === 'Shift') {
            ocean.setSpeedBoostActive(false);
          }
        };
        const handleWindowBlur = () => {
          ocean.setSpeedBoostActive(false);
        };

        handleResize();
        window.addEventListener("resize", handleResize);
        window.addEventListener("keydown", handleHostKeyDown);
        window.addEventListener("keyup", handleHostKeyUp);
        window.addEventListener("blur", handleWindowBlur);
        return () => {
          window.removeEventListener("resize", handleResize);
          window.removeEventListener("keydown", handleHostKeyDown);
          window.removeEventListener("keyup", handleHostKeyUp);
          window.removeEventListener("blur", handleWindowBlur);
          ocean.setSpeedBoostActive(false);
        };
      } catch (err) {
        if (disposed) return;
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error("❌ Initialization error:", err);
        setError(errorMsg);
        setLoading(false);
        return () => {};
      }
    };

    let removeResizeListener: (() => void) | undefined;
    void initializeScene().then((cleanup) => {
      removeResizeListener = cleanup;
    });

    return () => {
      disposed = true;
      removeResizeListener?.();
      oceanInstance?.dispose();
      oceanRef.current = null;
    };
  }, []);

  const handleParameterChange = (key: string, value: number) => {
    if (oceanRef.current) {
      oceanRef.current.updateParameter(key, value);
    }
  };

  const handleCameraChange = (x: number, y: number, z: number) => {
    if (oceanRef.current) {
      oceanRef.current.updateCamera(x, y, z);
    }
  };

  const handleTopDownView = () => {
    if (oceanRef.current) {
      oceanRef.current.setTopDownView(260);
    }
  };

  const handleShaderChange = (waterType: WaterType) => {
    if (oceanRef.current) {
      oceanRef.current.switchShader(serializeWaterType(waterType));
    }
  };

  const handleBoatModelChange = (modelId: BoatModelId) => {
    if (oceanRef.current) {
      void oceanRef.current.setBoatModel(modelId);
    }
    setBoatModel(modelId);
  };

  const handleIslandModelChange = (modelId: IslandModelId) => {
    if (oceanRef.current) {
      void oceanRef.current.setIslandModel(modelId);
    }
    setIslandModel(modelId);
  };

  return (
    <div className="w-full h-screen bg-gradient-to-b from-sky-200 via-sky-300 to-blue-400 overflow-hidden flex flex-col relative">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full absolute inset-0"
        style={{ display: "block" }}
      />

      {/* Error display */}
      {error && (
        <div className="absolute top-4 left-4 bg-red-900/95 backdrop-blur-sm text-white p-5 rounded-xl shadow-2xl z-50 max-w-md border border-red-700/50">
          <p className="font-bold text-lg mb-2">⚠️ Initialization Error</p>
          <p className="text-sm mb-3">{error}</p>
          <p className="text-xs text-red-200">
            💡 <strong>Troubleshooting:</strong>
            <br />• Ensure WebGPU is supported (Chrome 113+, Edge 113+)
            <br />• Check browser console for detailed errors
            <br />• Try refreshing the page
          </p>
        </div>
      )}

      {/* Loading indicator */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-40">
          <div className="bg-white/98 backdrop-blur-md rounded-2xl p-8 shadow-2xl text-center border border-white/20">
            <div className="mb-6 flex justify-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
                <div className="absolute inset-2 rounded-full border-2 border-transparent border-r-blue-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
              </div>
            </div>
            <p className="text-xl font-bold text-gray-800 mb-2">🌊 Ocean Renderer</p>
            <p className="text-sm text-gray-600 mb-4">Initializing WebGPU Engine...</p>
            <div className="w-48 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 animate-pulse"></div>
            </div>
          </div>
        </div>
      )}

      {/* Header info */}
      {initialized && !error && (
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md text-gray-900 p-5 rounded-xl shadow-xl z-40 border border-white/30 max-w-sm">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            🌊 Sigma Water
          </h1>
          <p className="text-sm text-gray-600 mt-1 font-medium">SIGGRAPH-Grade Ocean Renderer</p>
        </div>
      )}

      {/* Performance stats (optional) */}
      {initialized && !error && (
        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white p-3 rounded-lg z-40 font-mono text-xs border border-white/10">
          <p className="text-green-400">✓ WebGPU Active</p>
          <p className="text-cyan-400">✓ WGSL Shaders</p>
          <p className="text-yellow-400">✓ 512×512 Grid</p>
        </div>
      )}

      {/* Water Controls */}
      {initialized && !error && (
        <WaterControls
          onParameterChange={handleParameterChange}
          onCameraChange={handleCameraChange}
          onTopDownView={handleTopDownView}
          onShaderChange={handleShaderChange}
          onBoatModelChange={handleBoatModelChange}
          onIslandModelChange={handleIslandModelChange}
          onCollisionModeChange={setCollisionMode}
        />
      )}

      {/* Status line */}
      {initialized && !error && (
        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md text-white p-3 rounded-lg z-40 text-xs border border-white/10 font-mono space-y-1">
          <p className="text-amber-400">⚓ {BOAT_MODEL_OPTIONS.find(o => o.id === boatModel)?.label ?? boatModel}</p>
          <p className="text-emerald-400">🏝 {ISLAND_MODEL_OPTIONS.find(o => o.id === islandModel)?.label ?? islandModel}</p>
          <p className="text-slate-300">🔵 {collisionMode === 0 ? 'GLB Geometry' : 'Physics Proxies'}</p>
        </div>
      )}
    </div>
  );
}
