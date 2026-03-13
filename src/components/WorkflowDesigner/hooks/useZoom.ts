import { useState, useCallback } from 'react';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

interface UseZoomReturn {
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  handleWheel: (e: WheelEvent) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
}

export const useZoom = (): UseZoomReturn => {
  const [zoom, setZoom] = useState<number>(1);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  }, []);

  const zoomReset = useCallback(() => {
    setZoom(1);
  }, []);

  return {
    zoom,
    setZoom,
    handleWheel,
    zoomIn,
    zoomOut,
    zoomReset,
  };
};
