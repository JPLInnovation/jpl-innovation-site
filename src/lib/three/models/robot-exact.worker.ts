// Decompression and attribute allocation stay off the scrolling/main thread.
self.onmessage = async (event: MessageEvent<{ url: string; features: number[]; batches: Array<{ file: string; vertices: number; indices: number; instances: Array<{ part: number }> }> }>) => {
	try {
		const { url, features, batches } = event.data;
		let next = 0;
		await Promise.all(Array.from({ length: 6 }, async () => {
			while (next < batches.length) {
				const id = next++, batch = batches[id];
				const response = await fetch(new URL(batch.file, url));
				if (!response.ok || !response.body) throw new Error(`Robot geometry: ${response.status}`);
				const downloaded = await response.arrayBuffer();
				const header = new Uint8Array(downloaded, 0, 2);
				// Some hosts send Content-Encoding:gzip and fetch already decodes it.
				const buffer = header[0] === 0x1f && header[1] === 0x8b
					? await new Response(new Blob([downloaded]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
					: downloaded;
				if (buffer.byteLength !== batch.vertices * 24 + batch.indices * 4) throw new Error('Invalid robot buffer');
				const feature = new Float32Array(batch.instances.map(i => features[i.part] ?? 0));
				self.postMessage({ id, buffer, feature }, { transfer: [buffer, feature.buffer] });
			}
		}));
		self.postMessage({ done: true });
	} catch (error) {
		self.postMessage({ error: String(error) });
	}
};
