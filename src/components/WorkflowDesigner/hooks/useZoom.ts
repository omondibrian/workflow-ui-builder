import { useState, useCallback, RefObject } from 'react';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

interface UseZoomReturn {
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  attachWheelListener: (ref: RefObject<HTMLElement | null>) => (() => void) | undefined;
}

export const useZoom = (): UseZoomReturn => {
  const [zoom, setZoom] = useState<number>(1);

  const attachWheelListener = useCallback((ref: RefObject<HTMLElement | null>): (() => void) | undefined => {
    const element = ref.current;
    if (!element) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
      }
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
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
    attachWheelListener,
    zoomIn,
    zoomOut,
    zoomReset,
  };
};
