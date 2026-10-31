// Motion-only index buffers. Full source buffers stay unchanged and return at rest.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';
await MeshoptSimplifier.ready;
const dir = 'public/assets/robot/';
const manifest = JSON.parse(fs.readFileSync(dir + 'manifest.json', 'utf8'));
let full = 0, motion = 0;
for (const batch of manifest.batches) {
  const bytes = zlib.gunzipSync(fs.readFileSync(dir + batch.file));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const positions = new Float32Array(buffer, 0, batch.vertices * 3);
  const indices = new Uint32Array(buffer, batch.vertices * 24, batch.indices);
  // 0.15 mm maximum geometric error; retain all source vertices/normals/materials.
  const [reduced, error] = MeshoptSimplifier.simplify(indices, positions, 3,
    Math.max(3, Math.floor(indices.length * .1 / 3) * 3), .00015, ['ErrorAbsolute', 'Permissive']);
  batch.motionFile = batch.file.replace('.bin.gz', '.motion.gz');
  batch.motionIndices = reduced.length;
  batch.motionError = error;
  fs.writeFileSync(dir + batch.motionFile, zlib.gzipSync(new Uint8Array(reduced.buffer, reduced.byteOffset, reduced.byteLength)));
  full += indices.length * batch.instances.length / 3;
  motion += reduced.length * batch.instances.length / 3;
}
fs.writeFileSync(dir + 'manifest.json', JSON.stringify(manifest));
console.log({ fullTriangles: full, motionTriangles: motion });
