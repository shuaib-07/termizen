import { Pane, PaneNode, GridPreset } from "@/types";

let splitCounter = 0;
export function genSplitId(): string {
  splitCounter += 1;
  return `split_${Date.now()}_${splitCounter}`;
}

/**
 * Traverses the tree and collects all Pane objects in document order.
 */
export function collectPanes(node: PaneNode): Pane[] {
  if (node.kind === "leaf") {
    return [node.pane];
  }
  return [...collectPanes(node.children[0]), ...collectPanes(node.children[1])];
}

/**
 * Counts total leaf panes in the tree.
 */
export function countPanes(node: PaneNode): number {
  if (node.kind === "leaf") return 1;
  return countPanes(node.children[0]) + countPanes(node.children[1]);
}

/**
 * Finds a Pane by ID in the tree.
 */
export function findPane(node: PaneNode, paneId: string): Pane | null {
  if (node.kind === "leaf") {
    return node.pane.id === paneId ? node.pane : null;
  }
  return findPane(node.children[0], paneId) || findPane(node.children[1], paneId);
}

/**
 * Immutably updates a specific Pane by ID.
 */
export function updatePaneInTree(
  node: PaneNode,
  paneId: string,
  updater: (p: Pane) => Pane
): PaneNode {
  if (node.kind === "leaf") {
    if (node.pane.id === paneId) {
      return { kind: "leaf", pane: updater(node.pane) };
    }
    return node;
  }
  return {
    ...node,
    children: [
      updatePaneInTree(node.children[0], paneId, updater),
      updatePaneInTree(node.children[1], paneId, updater),
    ],
  };
}

/**
 * Removes a pane from the tree.
 * When a child of a split is removed, the remaining sibling collapses into the parent's position.
 * Returns null if the root leaf itself is removed.
 */
export function removePaneFromTree(node: PaneNode, paneId: string): PaneNode | null {
  if (node.kind === "leaf") {
    return node.pane.id === paneId ? null : node;
  }

  const left = removePaneFromTree(node.children[0], paneId);
  const right = removePaneFromTree(node.children[1], paneId);

  // If left was removed, right replaces this split
  if (!left && right) return right;
  // If right was removed, left replaces this split
  if (left && !right) return left;
  // If both were removed (should not happen in binary split)
  if (!left && !right) return null;

  return {
    ...node,
    children: [left!, right!],
  };
}

/**
 * Splits a target pane by inserting a new pane next to it.
 * position: "after" (default, e.g. right/bottom) or "before" (e.g. left/top).
 */
export function splitPaneInTree(
  node: PaneNode,
  targetPaneId: string,
  newPane: Pane,
  direction: "row" | "column",
  position: "before" | "after" = "after"
): PaneNode {
  if (node.kind === "leaf") {
    if (node.pane.id === targetPaneId) {
      const targetLeaf: PaneNode = { kind: "leaf", pane: node.pane };
      const newLeaf: PaneNode = { kind: "leaf", pane: newPane };
      return {
        kind: "split",
        id: genSplitId(),
        direction,
        sizes: [50, 50],
        children: position === "before" ? [newLeaf, targetLeaf] : [targetLeaf, newLeaf],
      };
    }
    return node;
  }

  return {
    ...node,
    children: [
      splitPaneInTree(node.children[0], targetPaneId, newPane, direction, position),
      splitPaneInTree(node.children[1], targetPaneId, newPane, direction, position),
    ],
  };
}

/**
 * Swaps two panes in the tree by their IDs.
 */
export function swapPanesInTree(node: PaneNode, paneIdA: string, paneIdB: string): PaneNode {
  const paneA = findPane(node, paneIdA);
  const paneB = findPane(node, paneIdB);
  if (!paneA || !paneB || paneIdA === paneIdB) return node;

  function swap(n: PaneNode): PaneNode {
    if (n.kind === "leaf") {
      if (n.pane.id === paneIdA) {
        return { kind: "leaf", pane: { ...paneB!, id: paneIdA } };
      }
      if (n.pane.id === paneIdB) {
        return { kind: "leaf", pane: { ...paneA!, id: paneIdB } };
      }
      return n;
    }
    return {
      ...n,
      children: [swap(n.children[0]), swap(n.children[1])],
    };
  }

  return swap(node);
}

/**
 * Updates the split size ratios of a specific split node.
 */
export function resizeSplitInTree(
  node: PaneNode,
  splitId: string,
  sizes: [number, number]
): PaneNode {
  if (node.kind === "leaf") return node;

  if (node.id === splitId) {
    return {
      ...node,
      sizes,
    };
  }

  return {
    ...node,
    children: [
      resizeSplitInTree(node.children[0], splitId, sizes),
      resizeSplitInTree(node.children[1], splitId, sizes),
    ],
  };
}

/**
 * Helper to create a leaf node.
 */
function leaf(pane: Pane): PaneNode {
  return { kind: "leaf", pane };
}

/**
 * Helper to create a split node.
 */
function split(
  direction: "row" | "column",
  children: [PaneNode, PaneNode],
  sizes: [number, number] = [50, 50]
): PaneNode {
  return {
    kind: "split",
    id: genSplitId(),
    direction,
    sizes,
    children,
  };
}

/**
 * Builds an optimal balanced PaneNode tree for 1 to 6 panes based on preset or terminal count.
 */
export function buildGridTree(panes: Pane[], preset: GridPreset = "auto"): PaneNode {
  if (panes.length === 0) {
    throw new Error("Cannot build grid tree with 0 panes");
  }

  if (panes.length === 1) {
    return leaf(panes[0]);
  }

  // Handle explicit 2-pane preset or 2-pane auto
  if (panes.length === 2) {
    if (preset === "2x1") {
      return split("column", [leaf(panes[0]), leaf(panes[1])]);
    }
    return split("row", [leaf(panes[0]), leaf(panes[1])]);
  }

  // 3 Panes
  if (panes.length === 3) {
    if (preset === "3x1") {
      // 3 columns: Left 33%, Right 67% (split 50/50)
      return split(
        "row",
        [leaf(panes[0]), split("row", [leaf(panes[1]), leaf(panes[2])], [50, 50])],
        [33.33, 66.67]
      );
    }
    // Default 1+2: Left (Main 50%), Right (two stacked 50/50 rows)
    return split(
      "row",
      [leaf(panes[0]), split("column", [leaf(panes[1]), leaf(panes[2])], [50, 50])],
      [50, 50]
    );
  }

  // 4 Panes
  if (panes.length === 4) {
    // 2x2 Quad Grid: Top row (2 columns) and Bottom row (2 columns)
    const topRow = split("row", [leaf(panes[0]), leaf(panes[1])], [50, 50]);
    const bottomRow = split("row", [leaf(panes[2]), leaf(panes[3])], [50, 50]);
    return split("column", [topRow, bottomRow], [50, 50]);
  }

  // 5 Panes
  if (panes.length === 5) {
    // Top row (2 panes: 50/50)
    const topRow = split("row", [leaf(panes[0]), leaf(panes[1])], [50, 50]);
    // Bottom row (3 panes: 33/67 -> 50/50)
    const bottomRow = split(
      "row",
      [leaf(panes[2]), split("row", [leaf(panes[3]), leaf(panes[4])], [50, 50])],
      [33.33, 66.67]
    );
    return split("column", [topRow, bottomRow], [50, 50]);
  }

  // 6 Panes
  if (panes.length >= 6) {
    const p = panes.slice(0, 6);

    if (preset === "3x2") {
      // 3 rows of 2 columns
      const row1 = split("row", [leaf(p[0]), leaf(p[1])], [50, 50]);
      const row2 = split("row", [leaf(p[2]), leaf(p[3])], [50, 50]);
      const row3 = split("row", [leaf(p[4]), leaf(p[5])], [50, 50]);
      const bottomRows = split("column", [row2, row3], [50, 50]);
      return split("column", [row1, bottomRows], [33.33, 66.67]);
    }

    // Default 2x3 Grid: 2 rows of 3 columns
    const topRow = split(
      "row",
      [leaf(p[0]), split("row", [leaf(p[1]), leaf(p[2])], [50, 50])],
      [33.33, 66.67]
    );
    const bottomRow = split(
      "row",
      [leaf(p[3]), split("row", [leaf(p[4]), leaf(p[5])], [50, 50])],
      [33.33, 66.67]
    );
    return split("column", [topRow, bottomRow], [50, 50]);
  }

  return leaf(panes[0]);
}

export interface PaneBounds {
  left: number; // percentage (0 - 100)
  top: number; // percentage (0 - 100)
  width: number; // percentage (0 - 100)
  height: number; // percentage (0 - 100)
}

export interface SplitDividerInfo {
  id: string;
  direction: "row" | "column";
  sizes: [number, number];
  splitBox: PaneBounds;
  linePos: number; // percentage of container (left for row, top for column)
}

/**
 * Calculates absolute normalized (0-100%) bounding boxes for all leaf panes
 * and positions for all split dividers in a single pass.
 */
export function collectLayout(
  node: PaneNode,
  box: PaneBounds = { left: 0, top: 0, width: 100, height: 100 },
  panesMap: Map<string, PaneBounds> = new Map(),
  dividers: SplitDividerInfo[] = []
): { panes: Map<string, PaneBounds>; dividers: SplitDividerInfo[] } {
  if (node.kind === "leaf") {
    panesMap.set(node.pane.id, box);
    return { panes: panesMap, dividers };
  }

  const [leftRatio, rightRatio] = node.sizes;
  const total = (leftRatio + rightRatio) || 100;
  const factor1 = leftRatio / total;
  const factor2 = rightRatio / total;

  if (node.direction === "row") {
    const w1 = box.width * factor1;
    const w2 = box.width * factor2;
    const dividerLeft = box.left + w1;

    dividers.push({
      id: node.id,
      direction: "row",
      sizes: node.sizes,
      splitBox: box,
      linePos: dividerLeft,
    });

    collectLayout(
      node.children[0],
      { left: box.left, top: box.top, width: w1, height: box.height },
      panesMap,
      dividers
    );

    collectLayout(
      node.children[1],
      { left: box.left + w1, top: box.top, width: w2, height: box.height },
      panesMap,
      dividers
    );
  } else {
    const h1 = box.height * factor1;
    const h2 = box.height * factor2;
    const dividerTop = box.top + h1;

    dividers.push({
      id: node.id,
      direction: "column",
      sizes: node.sizes,
      splitBox: box,
      linePos: dividerTop,
    });

    collectLayout(
      node.children[0],
      { left: box.left, top: box.top, width: box.width, height: h1 },
      panesMap,
      dividers
    );

    collectLayout(
      node.children[1],
      { left: box.left, top: box.top + h1, width: box.width, height: h2 },
      panesMap,
      dividers
    );
  }

  return { panes: panesMap, dividers };
}
