"use client";

import { useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

interface WorkspaceLayoutProps {
  children?: React.ReactNode;
}

export function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  const [panelSizes, setPanelSizes] = useState<number[]>([25, 25, 25, 25]);

  const handlePanelResize = (sizes: number[]) => {
    setPanelSizes(sizes);
    // TODO: Persist panel sizes to localStorage (after Task 3 persistence is implemented)
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <PanelGroup direction="horizontal" onLayout={handlePanelResize}>
        {/* Left column - Transcript panel */}
        <Panel defaultSize={panelSizes[0]} minSize={15}>
          <div className="h-full border-r border-gray-200 bg-white overflow-auto">
            <div className="p-4">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
                Transcript
              </h2>
              <PlaceholderPanel name="Transcript" />
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-400 transition-colors cursor-col-resize" />

        {/* Center-left column - Scribbles panel */}
        <Panel defaultSize={panelSizes[1]} minSize={15}>
          <div className="h-full border-r border-gray-200 bg-white overflow-auto">
            <div className="p-4">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
                Scribbles
              </h2>
              <PlaceholderPanel name="Scribbles" />
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-400 transition-colors cursor-col-resize" />

        {/* Center-right column - Living Document panel */}
        <Panel defaultSize={panelSizes[2]} minSize={15}>
          <div className="h-full border-r border-gray-200 bg-white overflow-auto">
            <div className="p-4">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
                Living Document
              </h2>
              <PlaceholderPanel name="Living Document" />
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-400 transition-colors cursor-col-resize" />

        {/* Right column - Video Player panel */}
        <Panel defaultSize={panelSizes[3]} minSize={15}>
          <div className="h-full bg-white overflow-auto">
            <div className="p-4">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
                Video Player
              </h2>
              <PlaceholderPanel name="Video Player" />
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

function PlaceholderPanel({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
      <span className="text-lg font-medium">{name}</span>
      <span className="text-sm mt-1">Placeholder</span>
    </div>
  );
}