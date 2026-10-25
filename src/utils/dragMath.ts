export interface DragSnapResult {
  day: number;
  laneId: string;
  slotIndex: number;
}

export interface LaneBoundary {
  id: string;
  top: number;
  bottom: number;
}

/**
 * Calculates snapped day, target lane, and vertical slotIndex from mouse coordinates, accounting for grab offset.
 */
export function calculateDragSnap(
  mouseX: number,
  mouseY: number,
  grabOffsetX: number,
  containerLeft: number,
  containerTop: number,
  scrollLeft: number,
  scrollTop: number,
  dayWidth: number,
  totalDays: number,
  duration: number,
  laneBoundaries: LaneBoundary[],
  gridStartX: number = 256,
  trackHeight: number = 88
): DragSnapResult {
  // 1. Calculate intended left edge of card in canvas coordinates
  const canvasMouseX = mouseX - containerLeft + scrollLeft;
  const intendedCardLeft = canvasMouseX - grabOffsetX;

  // 2. Snap to day (1-indexed)
  const relativeX = intendedCardLeft - gridStartX;
  let day = Math.round(relativeX / dayWidth) + 1;
  const maxDay = Math.max(1, totalDays - duration + 1);
  day = Math.max(1, Math.min(maxDay, day));

  // 3. Determine lane and slotIndex from vertical position
  const canvasMouseY = mouseY - containerTop + scrollTop;
  let laneId = laneBoundaries[0]?.id || 'LANE-1';
  let matchedBoundary: LaneBoundary | undefined = laneBoundaries[0];

  for (const boundary of laneBoundaries) {
    if (canvasMouseY >= boundary.top && canvasMouseY <= boundary.bottom) {
      laneId = boundary.id;
      matchedBoundary = boundary;
      break;
    }
  }

  // If above all lanes, first lane; if below all, last lane
  if (laneBoundaries.length > 0) {
    if (canvasMouseY < laneBoundaries[0].top) {
      laneId = laneBoundaries[0].id;
      matchedBoundary = laneBoundaries[0];
    } else if (canvasMouseY > laneBoundaries[laneBoundaries.length - 1].bottom) {
      laneId = laneBoundaries[laneBoundaries.length - 1].id;
      matchedBoundary = laneBoundaries[laneBoundaries.length - 1];
    }
  }

  const laneTop = matchedBoundary ? matchedBoundary.top : 0;
  const relativeY = Math.max(0, canvasMouseY - laneTop - 8);
  const slotHeight = trackHeight + 8;
  const slotIndex = Math.max(0, Math.floor(relativeY / slotHeight));

  return { day, laneId, slotIndex };
}
