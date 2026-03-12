import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Line, Box, Sphere, Cylinder, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { vec } from '../math/VectorMath.js';

export function Viewer3D({ dataTable, smartFix, dispatch }) {
  const [selectedComp, setSelectedComp] = useState(null);

  const { components, lines, fixes } = useMemo(() => {
    const compMeshes = [];
    const connectLines = [];
    const fixMarkers = [];

    // Parse valid geometry from datatable
    dataTable.forEach(comp => {
      let color = 'gray';
      if (comp.type === 'PIPE') color = 'silver';
      else if (comp.type === 'TEE') color = 'blue';
      else if (comp.type === 'BEND') color = 'orange';
      else if (comp.type === 'FLANGE') color = 'green';
      else if (comp.type === 'VALVE') color = 'red';

      let pos = comp.ep1 || comp.cp || comp.supportCoor;
      let pos2 = comp.ep2 || comp.bp;

      if (pos) {
          compMeshes.push({ pos, type: comp.type, color, comp });
      }

      if (pos && pos2 && comp.type === 'PIPE') {
          connectLines.push({ start: pos, end: pos2 });
      }
    });

    // Parse fixes from smart fix output
    if (smartFix && smartFix.chains) {
        smartFix.chains.forEach((chain, cIdx) => {
            if (chain.fixes) {
                chain.fixes.forEach((f, fIdx) => {
                    if (f.element && (f.element.ep1 || f.element.cp)) {
                        fixMarkers.push({
                            pos: f.element.ep1 || f.element.cp,
                            fix: f,
                            chainIdx: cIdx,
                            fixIdx: fIdx
                        });
                    }
                });
            }
        });
    }

    return { components: compMeshes, lines: connectLines, fixes: fixMarkers };
  }, [dataTable, smartFix]);

  return (
    <div className="w-full h-full bg-[#1e1e1e]">
        <Canvas camera={{ position: [5000, 5000, 5000], fov: 60, up: [0, 0, 1] }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10000, 10000, 10000]} intensity={1} />

          <OrbitControls makeDefault />

          {/* Gizmo Viewport on the bottom right */}
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport axisColors={['red', 'green', 'blue']} labelColor="white" />
          </GizmoHelper>

          {/* Lines for Pipes */}
          {lines.map((l, i) => (
             <Line key={i} points={[[l.start.x, l.start.y, l.start.z], [l.end.x, l.end.y, l.end.z]]} color="silver" lineWidth={2} />
          ))}

          {/* Spheres for components */}
          {components.map((c, i) => (
             <mesh key={i} position={[c.pos.x, c.pos.y, c.pos.z]} onClick={() => setSelectedComp(c.comp)}>
                <sphereGeometry args={[50, 16, 16]} />
                <meshStandardMaterial color={c.color} />
             </mesh>
          ))}

          {/* HTML Overlay for Selected Component */}
          {selectedComp && (
              <Html position={[selectedComp.ep1?.x || 0, selectedComp.ep1?.y || 0, selectedComp.ep1?.z || 0]}>
                  <div className="bg-black text-white p-2 text-xs rounded border border-gray-600 shadow-xl pointer-events-none whitespace-pre">
                      {`Type: ${selectedComp.type}\nRef: ${selectedComp.refNo}\nSize: ${selectedComp.bore}`}
                  </div>
              </Html>
          )}

          {/* HTML Overlay for Fixes */}
          {fixes.map((f, i) => (
              <Html key={i} position={[f.pos.x, f.pos.y, f.pos.z]}>
                  <div className={`p-2 text-xs rounded border shadow-xl ${f.fix.approved === true ? 'bg-green-100 border-green-500 text-green-900' : f.fix.approved === false ? 'bg-red-100 border-red-500 text-red-900' : 'bg-yellow-100 border-yellow-500 text-yellow-900'}`}>
                      <div className="font-bold mb-1">{f.fix.message}</div>
                      {f.fix.approved === undefined && dispatch && (
                          <div className="flex gap-1 pointer-events-auto">
                               <button onClick={() => dispatch({ type: 'TOGGLE_FIX_APPROVAL', payload: { chainIdx: f.chainIdx, fixIdx: f.fixIdx, approved: true } })} className="bg-green-600 text-white px-2 py-0.5 rounded shadow cursor-pointer pointer-events-auto">Approve</button>
                               <button onClick={() => dispatch({ type: 'TOGGLE_FIX_APPROVAL', payload: { chainIdx: f.chainIdx, fixIdx: f.fixIdx, approved: false } })} className="bg-red-600 text-white px-2 py-0.5 rounded shadow cursor-pointer pointer-events-auto">Reject</button>
                          </div>
                      )}
                      {f.fix.approved !== undefined && (
                          <span className="font-bold">{f.fix.approved === true ? 'APPROVED' : 'REJECTED'}</span>
                      )}
                  </div>
              </Html>
          ))}

        </Canvas>
    </div>
  );
}
