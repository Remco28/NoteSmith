"use client";

import { useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

interface WorkspaceLayoutProps {
  children?: React.ReactNode;
}

export function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  const [topRowSizes, setTopRowSizes] = useState<number[]>([50, 50]);
  const [bottomRowSizes, setBottomRowSizes] = useState<number[]>([50, 50]);

  const handleTopRowResize = (sizes: number[]) => {
    setTopRowSizes(sizes);
  };

  const handleBottomRowResize = (sizes: number[]) => {
    setBottomRowSizes(sizes);
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Outer vertical PanelGroup for top/bottom row split */}
      <PanelGroup direction="vertical">
        {/* Top row: YouTube Player | Transcript */}
        <Panel defaultSize={50} minSize={15}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={topRowSizes[0]} minSize={15}>
              <div className="h-full border-r border-gray-200 bg-white overflow-auto">
                <div className="p-4">
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
                    YouTube Player
                  </h2>
                  <PlaceholderPanel name="YouTube Player" />
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-400 transition-colors cursor-col-resize" />

            <Panel defaultSize={topRowSizes[1]} minSize={15}>
              <div className="h-full bg-white overflow-auto">
                <div className="p-4">
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
                    Transcript
                  </h2>
                  <PlaceholderPanel name="Transcript" />
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="h-1 bg-gray-200 hover:bg-blue-400 transition-colors cursor-row-resize" />

        {/* Bottom row: Raw Scribbles | Living Document */}
        <Panel defaultSize={50} minSize={15}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={bottomRowSizes[0]} minSize={15}>
              <div className="h-full border-r border-gray-200 bg-white overflow-auto">
                <div className="p-4">
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
                    Raw Scribbles
                  </h2>
                  <PlaceholderPanel name="Raw Scribbles" />
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-400 transition-colors cursor-col-resize" />

            <Panel defaultSize={bottomRowSizes[1]} minSize={15}>
              <div className="h-full bg-white overflow-auto">
                <div className="p-4">
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
                    Living Document
                  </h2>
                  <PlaceholderPanel name="Living Document" />
                </div>
              </div>
            </Panel>
          </PanelGroup>
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