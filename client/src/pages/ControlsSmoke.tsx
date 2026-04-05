import { WaterControls } from "@/components/WaterControls";
import { type WaterType, type BoatModelId, type IslandModelId } from "@sigma-water/core";

export default function ControlsSmoke() {
  const handleParameterChange = (_key: string, _value: number) => {};
  const handleCameraChange = (_x: number, _y: number, _z: number) => {};
  const handleTopDownView = () => {};
  const handleShaderChange = (_waterType: WaterType) => {};
  const handleBoatModelChange = (_modelId: BoatModelId) => {};
  const handleIslandModelChange = (_modelId: IslandModelId) => {};
  const handleCollisionModeChange = (_mode: number) => {};

  return (
    <div className="w-full h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <WaterControls
        onParameterChange={handleParameterChange}
        onCameraChange={handleCameraChange}
        onTopDownView={handleTopDownView}
        onShaderChange={handleShaderChange}
        onBoatModelChange={handleBoatModelChange}
        onIslandModelChange={handleIslandModelChange}
        onCollisionModeChange={handleCollisionModeChange}
      />
    </div>
  );
}
