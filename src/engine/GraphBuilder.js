import { vec } from '../math/VectorMath.js';
import rbush3d from 'rbush-3d';

export function buildConnectivityGraph(dataTable, config) {
  const tolerance = Number(config?.smartFixer?.connectionTolerance ?? 25.0);

  // Step 1: Classify connection points per component
  const components = dataTable
    .filter(row => row.type && !["ISOGEN-FILES","UNITS-BORE","UNITS-CO-ORDS",
      "UNITS-WEIGHT","UNITS-BOLT-DIA","UNITS-BOLT-LENGTH",
      "PIPELINE-REFERENCE","MESSAGE-SQUARE"].includes(row.type.toUpperCase()))
    .map(row => ({
      ...row,
      entryPoint: getEntryPoint(row),
      exitPoint: getExitPoint(row),
      branchExitPoint: getBranchExitPoint(row), // null except for TEE
    }));

  // Step 2: Build entry-point spatial index (k-d tree / rbush-3d)
  const tree = new rbush3d();
  const entryItems = [];

  for (const comp of components) {
    if (comp.entryPoint && !vec.isZero(comp.entryPoint)) {
      entryItems.push({
        minX: comp.entryPoint.x, minY: comp.entryPoint.y, minZ: comp.entryPoint.z,
        maxX: comp.entryPoint.x, maxY: comp.entryPoint.y, maxZ: comp.entryPoint.z,
        comp
      });
    }
  }
  tree.load(entryItems);

  // Step 3: Match exits to entries (build edges)
  const edges = new Map();      // comp._rowIndex → next comp
  const branchEdges = new Map(); // comp._rowIndex → branch start comp (TEE only)
  const hasIncoming = new Set(); // row indices that have an incoming connection

  for (const comp of components) {
    if (!comp.exitPoint || vec.isZero(comp.exitPoint)) continue;

    const match = findNearestEntry(comp.exitPoint, tree, tolerance, comp._rowIndex);
    if (match) {
      edges.set(comp._rowIndex, match);
      hasIncoming.add(match._rowIndex);
    }

    // Branch edge for TEE
    if (comp.branchExitPoint && !vec.isZero(comp.branchExitPoint)) {
      const brMatch = findNearestEntry(comp.branchExitPoint, tree, tolerance, comp._rowIndex);
      if (brMatch) {
        branchEdges.set(comp._rowIndex, brMatch);
        hasIncoming.add(brMatch._rowIndex);
      }
    }
  }

  // Step 4: Find chain terminals (no incoming connection)
  const terminals = components.filter(c =>
    !hasIncoming.has(c._rowIndex) && (c.type || "").toUpperCase() !== "SUPPORT"
  );

  return { components, edges, branchEdges, terminals, entryIndex: tree, hasIncoming };
}

export function getEntryPoint(row) {
  const t = (row.type || "").toUpperCase();
  if (t === "SUPPORT") return row.supportCoor || null;
  if (t === "OLET")    return row.cp || null;  // OLET enters at CP
  return row.ep1 || null;
}

export function getExitPoint(row) {
  const t = (row.type || "").toUpperCase();
  if (t === "SUPPORT") return null;            // SUPPORT has no exit
  if (t === "OLET")    return row.bp || null;  // OLET exits at BP
  return row.ep2 || null;
}

export function getBranchExitPoint(row) {
  const t = (row.type || "").toUpperCase();
  if (t === "TEE") return row.bp || null;      // TEE branches at BP
  return null;
}

export function findNearestEntry(exitCoord, tree, tolerance, excludeRowIndex) {
  const searchBox = {
    minX: exitCoord.x - tolerance,
    minY: exitCoord.y - tolerance,
    minZ: exitCoord.z - tolerance,
    maxX: exitCoord.x + tolerance,
    maxY: exitCoord.y + tolerance,
    maxZ: exitCoord.z + tolerance
  };

  const candidates = tree.search(searchBox);

  let best = null;
  let bestDist = tolerance + 1;

  for (const result of candidates) {
    const cand = result.comp;
    if (cand._rowIndex === excludeRowIndex) continue;
    const d = vec.dist(exitCoord, cand.entryPoint);
    if (d <= tolerance && d < bestDist) {
      bestDist = d;
      best = cand;
    }
  }

  return best;
}
