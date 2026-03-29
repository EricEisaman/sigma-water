interface PerformanceMonitorProps {
  stats: {
    fps: number;
    frameTime: number;
    drawCalls: number;
    triangles: number;
    renderer: string;
  };
}

export function PerformanceMonitor({ stats }: PerformanceMonitorProps) {
  return (
    <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white p-4 rounded-lg font-mono text-sm space-y-1 border border-blue-500 border-opacity-30">
      <div className="text-blue-400 font-bold mb-2">Performance</div>
      <div>FPS: <span className="text-green-400">{stats.fps}</span></div>
      <div>Frame Time: <span className="text-green-400">{stats.frameTime.toFixed(2)}ms</span></div>
      <div>Draw Calls: <span className="text-green-400">{stats.drawCalls}</span></div>
      <div>Triangles: <span className="text-green-400">{stats.triangles}</span></div>
      <div>Renderer: <span className="text-green-400">{stats.renderer}</span></div>
    </div>
  );
}
