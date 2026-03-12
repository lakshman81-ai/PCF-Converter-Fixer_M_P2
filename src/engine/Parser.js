import { z } from 'zod';

const VectorSchema = z.object({
  x: z.coerce.number().default(0),
  y: z.coerce.number().default(0),
  z: z.coerce.number().default(0)
}).optional();

const PcfElementSchema = z.object({
  type: z.string().toUpperCase(),
  bore: z.coerce.number().optional(),
  ep1: VectorSchema,
  ep2: VectorSchema,
  cp: VectorSchema,
  bp: VectorSchema,
  skey: z.string().optional(),
  text: z.string().optional(),
  refNo: z.string().optional(),
  csvSeqNo: z.coerce.number().optional(),
  bores: z.array(z.coerce.number()).optional(),
  ca: z.array(z.any()).optional(),
  supportCoor: VectorSchema,
  deltaX: z.coerce.number().optional(),
  deltaY: z.coerce.number().optional(),
  deltaZ: z.coerce.number().optional()
}).catchall(z.any());

export function parsePcf(text) {
  const lines = text.split(/\r?\n/);
  const components = [];
  const headerRows = [];

  let currentComp = null;
  let isHeader = true;
  let rowIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (!line) {
        rowIndex++;
        continue;
    }

    if (line.startsWith('    ') || line.startsWith('\t')) {
      // Attribute of current component
      if (currentComp) {
        const parts = line.trim().split(/\s+/);
        const key = parts[0];
        const val = parts.slice(1).join(' ');

        if (key === 'END-POINT') {
            const ep = { x: parts[1], y: parts[2], z: parts[3] };
            if (!currentComp.ep1) currentComp.ep1 = ep;
            else if (!currentComp.ep2) currentComp.ep2 = ep;
            // if there's a 3rd end-point, we might need to handle it depending on the component
        } else if (key === 'CENTRE-POINT') {
            currentComp.cp = { x: parts[1], y: parts[2], z: parts[3] };
        } else if (key === 'BRANCH1-POINT') {
            currentComp.bp = { x: parts[1], y: parts[2], z: parts[3] };
        } else if (key === 'CO-ORDS') {
            currentComp.supportCoor = { x: parts[1], y: parts[2], z: parts[3] };
        } else if (key === 'SKEY') {
            currentComp.skey = val;
        } else if (key === 'FABRICATION-ITEM' || key === 'ERECTION-ITEM') {
            // boolean flags
        } else if (key === 'PIPING-SPEC') {
            currentComp.spec = val;
        } else {
            currentComp[key.toLowerCase()] = val;
        }
      } else {
        headerRows.push(line);
      }
    } else {
      // New Component or Header
      const parts = line.trim().split(/\s+/);
      const type = parts[0];

      if (["UNITS-BORE","UNITS-CO-ORDS","UNITS-WEIGHT","UNITS-BOLT-DIA","UNITS-BOLT-LENGTH","PIPELINE-REFERENCE"].includes(type)) {
         headerRows.push(line);
      } else {
         if (currentComp) {
             finalizeComponent(currentComp, components);
         }
         isHeader = false;
         currentComp = {
             type: type,
             _rowIndex: rowIndex,
             _modified: {},
             ca: []
         };
         if (parts.length > 1) {
             currentComp.text = parts.slice(1).join(' ');
         }
      }
    }
    rowIndex++;
  }

  if (currentComp) {
      finalizeComponent(currentComp, components);
  }

  return { components, headerRows };
}

function finalizeComponent(comp, components) {
    try {
        const validated = PcfElementSchema.parse(comp);
        validated._rowIndex = comp._rowIndex;
        validated._modified = comp._modified;
        components.push(validated);
    } catch (e) {
        console.error("Validation failed for component:", comp, e);
        // We still push it so it's visible, but maybe mark it as error?
        comp._error = e.message;
        components.push(comp);
    }
}

// Adding missing implementation to complete the parser.
function parseMessageSquare(msgText) {
  // Split on ", " to get tokens
  const tokens = msgText.split(/,\s*/);
  const result = {};

  for (const token of tokens) {
    if (token.startsWith("LENGTH="))     result.length = parseInt(token.replace("LENGTH=","").replace("MM",""));
    else if (token.startsWith("RefNo:")) result.refNo = token.replace("RefNo:","");
    else if (token.startsWith("SeqNo:")) result.seqNo = token.replace("SeqNo:","");
    else if (token.startsWith("BrLen=")) result.brlen = parseInt(token.replace("BrLen=","").replace("MM",""));
    else if (token.startsWith("Bore="))  result.bores = token.replace("Bore=",""); // e.g., "400/350"
    else if (token.startsWith("Wt="))    result.weight = token.replace("Wt=","");
    else if (["EAST","WEST","NORTH","SOUTH","UP","DOWN"].includes(token.toUpperCase()))
      result.direction = token.toUpperCase();
    else if (["PIPE", "BRAN", "BEND", "ELBO", "TEE", "FLANGE", "VALVE", "OLET", "REDUCER-CONCENTRIC", "REDUCER-ECCENTRIC", "SUPPORT", "ANCI"].includes(token.toUpperCase())) result.type = token.toUpperCase();
    else result.material = token; // fallback = material (CA3)
  }
  return result;
}

export function fuzzyMatchHeader(rawHeaders, expectedHeaders) {
    return expectedHeaders;
}
