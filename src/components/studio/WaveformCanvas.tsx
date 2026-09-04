"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Document, Region } from "@/shared/schema";
import { drawFrame, CanvasViewState, CanvasAssets } from "@/lib/render/canvas";

interface WaveformCanvasProps {
  document: Document;
  currentTimeSec: number;
  durationSec: number;
  waveformPeaks: Float32Array | null;
  selectedRegionId: string | null;
  onSelectRegion: (regionId: string | null) => void;
  onSeek: (timeSec: number) => void;
  onSoloRegion: (region: Region) => void;
  onNudgeBoundary: (regionId: string, boundary: "start" | "end", newTimeSec: number) => void;
  viewRange: { start: number; end: number };
  onViewRangeChange: (range: { start: number; end: number }) => void;
  loopRegion: { start: number; end: number } | null;
  isLooping: boolean;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  document,
  currentTimeSec,
  durationSec,
  waveformPeaks,
  selectedRegionId,
  onSelectRegion,
  onSeek,
  onSoloRegion,
  onNudgeBoundary,
  viewRange,
  onViewRangeChange,
  loopRegion,
  isLooping,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [hoverHandle, setHoverHandle] = useState<"start" | "end" | null>(null);
  const [isDraggingHandle, setIsDraggingHandle] = useState<{
    regionId: string;
    handle: "start" | "end";
    initialTime: number;
  } | null>(null);

  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panInitialRange, setPanInitialRange] = useState<{ start: number; end: number }>({ start: 0, end: 30 });

  // Coordinate transformation helpers
  const timeToX = useCallback(
    (t: number, width: number) => {
      const visible = Math.max(0.001, viewRange.end - viewRange.start);
      return ((t - viewRange.start) / visible) * width;
    },
    [viewRange]
  );

  const xToTime = useCallback(
    (x: number, width: number) => {
      const visible = Math.max(0.001, viewRange.end - viewRange.start);
      return viewRange.start + (x / width) * visible;
    },
    [viewRange]
  );

  // Redraw Canvas on changes
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const view: CanvasViewState = {
      width,
      height,
      startTimeSec: viewRange.start,
      endTimeSec: viewRange.end,
      selectedRegionId,
      hoveredRegionId,
      hoverHandle,
      loopStartSec: loopRegion?.start,
      loopEndSec: loopRegion?.end,
      isLooping,
    };

    const assets: CanvasAssets = {
      waveformPeaks,
      durationSec: durationSec || 30,
    };

    drawFrame(ctx, currentTimeSec, document, view, assets);
  }, [
    viewRange,
    selectedRegionId,
    hoveredRegionId,
    hoverHandle,
    loopRegion,
    isLooping,
    waveformPeaks,
    durationSec,
    currentTimeSec,
    document,
  ]);

  // Handle Canvas Resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = rect.height;
        render();
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [render]);

  useEffect(() => {
    render();
  }, [render]);

  // Mouse Move: handle hover detection & dragging
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const width = canvas.width;
    const mouseTime = xToTime(mouseX, width);

    // 1. If actively dragging a handle
    if (isDraggingHandle) {
      const clampedTime = Math.max(0, Math.min(durationSec || 60, mouseTime));
      onNudgeBoundary(isDraggingHandle.regionId, isDraggingHandle.handle, clampedTime);
      return;
    }

    // 2. If actively panning
    if (isPanning) {
      const dx = mouseX - panStartX;
      const visibleDur = panInitialRange.end - panInitialRange.start;
      const timeShift = -(dx / width) * visibleDur;
      let newStart = panInitialRange.start + timeShift;
      let newEnd = panInitialRange.end + timeShift;

      if (newStart < 0) {
        newEnd -= newStart;
        newStart = 0;
      }
      if (newEnd > (durationSec || 60)) {
        const diff = newEnd - (durationSec || 60);
        newStart = Math.max(0, newStart - diff);
        newEnd = durationSec || 60;
      }

      onViewRangeChange({ start: newStart, end: newEnd });
      return;
    }

    // 3. Hover detection for handles or regions
    let foundRegion: Region | null = null;
    let foundHandle: "start" | "end" | null = null;

    const handleThresholdPx = 8;

    for (const region of document.regions) {
      const xStart = timeToX(region.start, width);
      const xEnd = timeToX(region.end, width);

      // Check handle proximity if selected
      if (region.id === selectedRegionId) {
        if (Math.abs(mouseX - xStart) <= handleThresholdPx) {
          foundRegion = region;
          foundHandle = "start";
          break;
        } else if (Math.abs(mouseX - xEnd) <= handleThresholdPx) {
          foundRegion = region;
          foundHandle = "end";
          break;
        }
      }

      // Inside region body
      if (mouseX >= xStart && mouseX <= xEnd) {
        foundRegion = region;
      }
    }

    setHoveredRegionId(foundRegion ? foundRegion.id : null);
    setHoverHandle(foundHandle);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const width = canvas.width;
    const clickTime = xToTime(mouseX, width);

    // Middle click or Space+click for panning
    if (e.button === 1 || e.altKey) {
      setIsPanning(true);
      setPanStartX(mouseX);
      setPanInitialRange({ ...viewRange });
      return;
    }

    // If clicking on an active in/out handle
    if (hoverHandle && selectedRegionId) {
      setIsDraggingHandle({
        regionId: selectedRegionId,
        handle: hoverHandle,
        initialTime: clickTime,
      });
      return;
    }

    // Check if clicked inside a region
    const clickedRegion = document.regions.find((r) => clickTime >= r.start && clickTime <= r.end);

    if (clickedRegion) {
      onSelectRegion(clickedRegion.id);
    } else {
      onSelectRegion(null);
    }

    // Seek playhead to click position
    onSeek(clickTime);
  };

  const handleMouseUp = () => {
    setIsDraggingHandle(null);
    setIsPanning(false);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const width = canvas.width;
    const clickTime = xToTime(mouseX, width);

    const region = document.regions.find((r) => clickTime >= r.start && clickTime <= r.end);
    if (region) {
      onSoloRegion(region);
    }
  };

  // Horizontal wheel zoom & pan
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const width = canvas.width;
    const mouseTime = xToTime(mouseX, width);

    const isZoom = e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX);
    const visibleDur = viewRange.end - viewRange.start;

    if (isZoom) {
      // Zoom centered at mouse position
      const zoomFactor = e.deltaY < 0 ? 0.8 : 1.25;
      const newVisibleDur = Math.max(1.0, Math.min(durationSec || 60, visibleDur * zoomFactor));

      const ratio = (mouseTime - viewRange.start) / visibleDur;
      let newStart = mouseTime - ratio * newVisibleDur;
      let newEnd = newStart + newVisibleDur;

      if (newStart < 0) {
        newEnd -= newStart;
        newStart = 0;
      }
      if (newEnd > (durationSec || 60)) {
        const diff = newEnd - (durationSec || 60);
        newStart = Math.max(0, newStart - diff);
        newEnd = durationSec || 60;
      }

      onViewRangeChange({ start: newStart, end: newEnd });
    } else {
      // Horizontal scroll
      const shift = (e.deltaX / width) * visibleDur;
      let newStart = Math.max(0, viewRange.start + shift);
      let newEnd = Math.min(durationSec || 60, viewRange.end + shift);
      onViewRangeChange({ start: newStart, end: newEnd });
    }
  };

  const getCursor = () => {
    if (isDraggingHandle || hoverHandle) return "ew-resize";
    if (isPanning) return "grabbing";
    return "crosshair";
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[220px] bg-slate-950 select-none overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        style={{ cursor: getCursor() }}
        className="w-full h-full block"
      />
    </div>
  );
};
