// Decompression and attribute allocation stay off the scrolling/main thread.
async function decode(url: URL) {
 const response = await fetch(url);
 if (!response.ok) throw new Error(`Robot geometry: ${response.status}`);
 const downloaded = await response.arrayBuffer();
 if (downloaded.byteLength < 2) return downloaded;
 const header = new Uint8Array(downloaded, 0, 2);
 return header[0] === 0x1f && header[1] === 0x8b
  ? new Response(new Blob([downloaded]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
  : downloaded;
}
self.onmessage = async (event: MessageEvent<{ url: string; features: number[]; batches: Array<{ file: string; motionFile?: string; vertices: number; indices: number; instances: Array<{ part: number }> }> }>) => {
	try {
		const { url, features, batches } = event.data;
		let next = 0;
		await Promise.all(Array.from({ length: 6 }, async () => {
			while (next < batches.length) {
				const id = next++, batch = batches[id];
				const [buffer, motion] = await Promise.all([
					decode(new URL(batch.file, url)),
					batch.motionFile ? decode(new URL(batch.motionFile, url)) : Promise.resolve(new ArrayBuffer(0)),
				]);
				if (buffer.byteLength !== batch.vertices * 24 + batch.indices * 4) throw new Error('Invalid robot buffer');
				const feature = new Float32Array(batch.instances.map(i => features[i.part] ?? 0));
				self.postMessage({ id, buffer, motion, feature }, { transfer: [buffer, motion, feature.buffer] });
			}
		}));
		self.postMessage({ done: true });
	} catch (error) {
		self.postMessage({ error: String(error) });
	}
};
