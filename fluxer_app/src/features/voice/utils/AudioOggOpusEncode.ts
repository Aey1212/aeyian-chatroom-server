// SPDX-License-Identifier: AGPL-3.0-or-later

import {encodeAudioBufferSliceToWav} from '@app/features/voice/utils/AudioWavEncode';

const OPUS_SAMPLE_RATE = 48_000;
const OPUS_BITRATE = 128_000;
const OPUS_PRE_SKIP = 312;
const OPUS_FRAME_SAMPLES = 960;
const OGG_MAX_SEGMENTS_PER_PAGE = 255;
const OGG_SERIAL = 0x46_4c_58_52;
const OGG_VENDOR = 'Fluxer';
const RECORDER_MIME_TYPES = ['audio/ogg;codecs=opus', 'audio/mp4'] as const;

export interface AudioSlice {
	startSeconds: number;
	endSeconds: number;
}

interface OpusPacket {
	data: Uint8Array;
	samples: number;
}

const OGG_CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let index = 0; index < 256; index += 1) {
		let value = index << 24;
		for (let bit = 0; bit < 8; bit += 1) {
			value = value & 0x80000000 ? (value << 1) ^ 0x04c11db7 : value << 1;
		}
		table[index] = value >>> 0;
	}
	return table;
})();

function oggCrc(bytes: Uint8Array): number {
	let crc = 0;
	for (const byte of bytes) {
		crc = ((crc << 8) ^ OGG_CRC_TABLE[((crc >>> 24) ^ byte) & 0xff]!) >>> 0;
	}
	return crc;
}

function lacingFor(length: number): Array<number> {
	const values: Array<number> = [];
	let remaining = length;
	while (remaining >= 255) {
		values.push(255);
		remaining -= 255;
	}
	values.push(remaining);
	return values;
}

function oggPage(params: {
	headerType: number;
	granule: bigint;
	sequence: number;
	packets: ReadonlyArray<Uint8Array>;
}): Uint8Array<ArrayBuffer> {
	const lacing = params.packets.flatMap((packet) => lacingFor(packet.length));
	const bodyLength = params.packets.reduce((sum, packet) => sum + packet.length, 0);
	const page = new Uint8Array(27 + lacing.length + bodyLength);
	const view = new DataView(page.buffer);
	page.set([0x4f, 0x67, 0x67, 0x53], 0);
	page[4] = 0;
	page[5] = params.headerType;
	view.setBigUint64(6, params.granule, true);
	view.setUint32(14, OGG_SERIAL, true);
	view.setUint32(18, params.sequence, true);
	view.setUint32(22, 0, true);
	page[26] = lacing.length;
	page.set(lacing, 27);
	let offset = 27 + lacing.length;
	for (const packet of params.packets) {
		page.set(packet, offset);
		offset += packet.length;
	}
	view.setUint32(22, oggCrc(page), true);
	return page;
}

function opusHead(): Uint8Array {
	const head = new Uint8Array(19);
	const view = new DataView(head.buffer);
	head.set(new TextEncoder().encode('OpusHead'), 0);
	head[8] = 1;
	head[9] = 1;
	view.setUint16(10, OPUS_PRE_SKIP, true);
	view.setUint32(12, OPUS_SAMPLE_RATE, true);
	view.setInt16(16, 0, true);
	head[18] = 0;
	return head;
}

function opusTags(): Uint8Array {
	const vendor = new TextEncoder().encode(OGG_VENDOR);
	const tags = new Uint8Array(8 + 4 + vendor.length + 4);
	const view = new DataView(tags.buffer);
	tags.set(new TextEncoder().encode('OpusTags'), 0);
	view.setUint32(8, vendor.length, true);
	tags.set(vendor, 12);
	view.setUint32(12 + vendor.length, 0, true);
	return tags;
}

export function muxOggOpus(packets: ReadonlyArray<OpusPacket>, totalSamples: number): Blob {
	const pages: Array<Uint8Array<ArrayBuffer>> = [];
	let sequence = 0;
	pages.push(oggPage({headerType: 0x02, granule: 0n, sequence: sequence++, packets: [opusHead()]}));
	pages.push(oggPage({headerType: 0x00, granule: 0n, sequence: sequence++, packets: [opusTags()]}));
	const lastGranule = BigInt(OPUS_PRE_SKIP + totalSamples);
	let samplesSoFar = 0;
	let index = 0;
	while (index < packets.length) {
		const pagePackets: Array<Uint8Array> = [];
		let segments = 0;
		while (index < packets.length) {
			const packet = packets[index]!;
			const needed = lacingFor(packet.data.length).length;
			if (pagePackets.length > 0 && segments + needed > OGG_MAX_SEGMENTS_PER_PAGE) break;
			pagePackets.push(packet.data);
			segments += needed;
			samplesSoFar += packet.samples;
			index += 1;
		}
		const isLast = index >= packets.length;
		const granule = isLast ? lastGranule : BigInt(Math.min(OPUS_PRE_SKIP + samplesSoFar, Number(lastGranule)));
		pages.push(oggPage({headerType: isLast ? 0x04 : 0x00, granule, sequence: sequence++, packets: pagePackets}));
	}
	return new Blob(pages, {type: 'audio/ogg'});
}

async function renderMono48k(buffer: AudioBuffer, slice: AudioSlice): Promise<Float32Array> {
	const durationSeconds = Math.max(0, slice.endSeconds - slice.startSeconds);
	const frames = Math.max(1, Math.round(durationSeconds * OPUS_SAMPLE_RATE));
	const context = new OfflineAudioContext(1, frames, OPUS_SAMPLE_RATE);
	const source = context.createBufferSource();
	source.buffer = buffer;
	source.connect(context.destination);
	source.start(0, slice.startSeconds, durationSeconds);
	const rendered = await context.startRendering();
	return rendered.getChannelData(0);
}

export function canEncodeOggOpus(): boolean {
	return (
		typeof AudioEncoder !== 'undefined' &&
		typeof AudioData !== 'undefined' &&
		typeof OfflineAudioContext !== 'undefined'
	);
}

export async function encodeAudioBufferSliceToOggOpus(buffer: AudioBuffer, slice: AudioSlice): Promise<Blob> {
	const config: AudioEncoderConfig = {
		codec: 'opus',
		sampleRate: OPUS_SAMPLE_RATE,
		numberOfChannels: 1,
		bitrate: OPUS_BITRATE,
	};
	const support = await AudioEncoder.isConfigSupported(config);
	if (!support.supported) {
		throw new Error('Opus encoding is not supported in this browser');
	}
	const samples = await renderMono48k(buffer, slice);
	const packets: Array<OpusPacket> = [];
	let failure: unknown = null;
	const encoder = new AudioEncoder({
		output: (chunk) => {
			const data = new Uint8Array(chunk.byteLength);
			chunk.copyTo(data);
			const durationMicros = chunk.duration ?? (OPUS_FRAME_SAMPLES / OPUS_SAMPLE_RATE) * 1_000_000;
			packets.push({data, samples: Math.round((durationMicros * OPUS_SAMPLE_RATE) / 1_000_000)});
		},
		error: (error) => {
			failure = error;
		},
	});
	try {
		encoder.configure(config);
		for (let offset = 0; offset < samples.length; offset += OPUS_FRAME_SAMPLES) {
			const frame = samples.slice(offset, Math.min(offset + OPUS_FRAME_SAMPLES, samples.length));
			const audioData = new AudioData({
				format: 'f32-planar',
				sampleRate: OPUS_SAMPLE_RATE,
				numberOfFrames: frame.length,
				numberOfChannels: 1,
				timestamp: Math.round((offset / OPUS_SAMPLE_RATE) * 1_000_000),
				data: frame,
			});
			encoder.encode(audioData);
			audioData.close();
		}
		await encoder.flush();
	} finally {
		if (encoder.state !== 'closed') encoder.close();
	}
	if (failure) throw failure;
	if (packets.length === 0) throw new Error('Opus encoder produced no audio');
	return muxOggOpus(packets, samples.length);
}

function pickRecorderMimeType(): string | null {
	if (typeof MediaRecorder === 'undefined') return null;
	for (const candidate of RECORDER_MIME_TYPES) {
		if (MediaRecorder.isTypeSupported(candidate)) return candidate;
	}
	return null;
}

export function canRecordCompressedAudio(): boolean {
	return pickRecorderMimeType() !== null && typeof AudioContext !== 'undefined';
}

export async function recordAudioBufferSlice(buffer: AudioBuffer, slice: AudioSlice): Promise<Blob> {
	const mimeType = pickRecorderMimeType();
	if (!mimeType) throw new Error('No compressed recording format is available');
	const context = new AudioContext();
	try {
		const destination = context.createMediaStreamDestination();
		const source = context.createBufferSource();
		source.buffer = buffer;
		source.connect(destination);
		const recorder = new MediaRecorder(destination.stream, {mimeType, audioBitsPerSecond: OPUS_BITRATE});
		const chunks: Array<Blob> = [];
		recorder.ondataavailable = (event) => {
			if (event.data.size > 0) chunks.push(event.data);
		};
		const stopped = new Promise<void>((resolve, reject) => {
			recorder.onstop = () => resolve();
			recorder.onerror = (event) => reject(event);
		});
		source.onended = () => {
			if (recorder.state !== 'inactive') recorder.stop();
		};
		recorder.start();
		source.start(0, slice.startSeconds, Math.max(0, slice.endSeconds - slice.startSeconds));
		await stopped;
		return new Blob(chunks, {type: mimeType.split(';')[0]});
	} finally {
		void context.close().catch(() => {});
	}
}

export async function encodeTrimmedAudio(buffer: AudioBuffer, slice: AudioSlice): Promise<Blob> {
	if (canEncodeOggOpus()) {
		try {
			return await encodeAudioBufferSliceToOggOpus(buffer, slice);
		} catch {}
	}
	if (canRecordCompressedAudio()) {
		try {
			return await recordAudioBufferSlice(buffer, slice);
		} catch {}
	}
	return encodeAudioBufferSliceToWav(buffer, {...slice, downmixToMono: true});
}
