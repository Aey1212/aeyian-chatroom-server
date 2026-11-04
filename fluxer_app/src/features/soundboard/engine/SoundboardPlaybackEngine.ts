// SPDX-License-Identifier: AGPL-3.0-or-later

import {Logger} from '@app/features/platform/utils/AppLogger';
import SoundboardSettings from '@app/features/soundboard/state/SoundboardSettings';
import StreamerMode from '@app/features/streamer_mode/state/StreamerMode';
import Sound from '@app/features/ui/state/Sound';
import {getEffectiveAudioState} from '@app/features/voice/engine/VoiceEffectiveAudioState';
import VoiceSettings from '@app/features/voice/state/VoiceSettings';
import {makeAutoObservable} from 'mobx';

const logger = new Logger('SoundboardPlaybackEngine');

const BUFFER_CACHE_LIMIT = 32;
const MAX_MASTER_VOLUME_PERCENT = 200;
const PREVIEW_ID = 'preview';

export interface SoundboardPlay {
	playId: string;
	userId: string;
	channelId: string;
	guildId: string;
	soundId: string;
	name: string;
	emojiId: string | null;
	emojiName: string | null;
	durationMs: number;
	startedAt: number;
}

interface PlayParams extends Omit<SoundboardPlay, 'startedAt'> {
	hash: string;
	url: string;
	volume: number;
}

class SoundboardPlaybackEngine {
	activePlays: Record<string, SoundboardPlay> = {};
	previewSoundId: string | null = null;
	private audioContext: AudioContext | null = null;
	private bufferCache = new Map<string, AudioBuffer>();
	private sources = new Map<string, AudioBufferSourceNode>();
	private lastAppliedSinkId: string | null = null;

	constructor() {
		makeAutoObservable<this, 'audioContext' | 'bufferCache' | 'sources' | 'lastAppliedSinkId'>(
			this,
			{audioContext: false, bufferCache: false, sources: false, lastAppliedSinkId: false},
			{autoBind: true},
		);
	}

	get plays(): Array<SoundboardPlay> {
		return Object.values(this.activePlays).sort((a, b) => a.startedAt - b.startedAt);
	}

	isSoundPlaying(soundId: string): boolean {
		return this.plays.some((play) => play.soundId === soundId);
	}

	private ensureContext(): AudioContext | null {
		if (typeof window === 'undefined') return null;
		if (this.audioContext && this.audioContext.state !== 'closed') {
			if (this.audioContext.state === 'suspended') {
				void this.audioContext.resume().catch(() => {});
			}
			return this.audioContext;
		}
		const Ctor =
			window.AudioContext || (window as typeof window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
		if (!Ctor) return null;
		try {
			this.audioContext = new Ctor({latencyHint: 'interactive'});
			this.lastAppliedSinkId = null;
			return this.audioContext;
		} catch (error) {
			logger.warn('Failed to create AudioContext', {error});
			return null;
		}
	}

	private applyOutputDevice(ctx: AudioContext): void {
		const deviceId = VoiceSettings.getOutputDeviceId();
		const sinkId = !deviceId || deviceId === 'default' ? '' : deviceId;
		if (sinkId === this.lastAppliedSinkId) return;
		if (sinkId === '' && this.lastAppliedSinkId === null) return;
		const sinkable = ctx as AudioContext & {setSinkId?: (sinkId: string) => Promise<void>};
		if (typeof sinkable.setSinkId !== 'function') return;
		const previous = this.lastAppliedSinkId;
		this.lastAppliedSinkId = sinkId;
		void sinkable.setSinkId(sinkId).catch((error) => {
			this.lastAppliedSinkId = previous;
			logger.debug('Failed to apply output device to soundboard context', {sinkId, error});
		});
	}

	async fetchBuffer(url: string, hash: string): Promise<AudioBuffer | null> {
		const cached = this.bufferCache.get(hash);
		if (cached) {
			this.bufferCache.delete(hash);
			this.bufferCache.set(hash, cached);
			return cached;
		}
		const ctx = this.ensureContext();
		if (!ctx) return null;
		try {
			const response = await fetch(url, {cache: 'force-cache'});
			if (!response.ok) {
				logger.warn('Soundboard sound fetch failed', {url, status: response.status});
				return null;
			}
			const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
			this.bufferCache.set(hash, buffer);
			while (this.bufferCache.size > BUFFER_CACHE_LIMIT) {
				const oldest = this.bufferCache.keys().next().value;
				if (!oldest) break;
				this.bufferCache.delete(oldest);
			}
			return buffer;
		} catch (error) {
			logger.warn('Soundboard sound decode failed', {url, error});
			return null;
		}
	}

	private gainFor(soundVolume: number, includeSoundboardVolume: boolean): number {
		const master = Math.max(0, Math.min(MAX_MASTER_VOLUME_PERCENT, Sound.getMasterVolume())) / 100;
		const output = VoiceSettings.getOutputVolume() / 100;
		const board = includeSoundboardVolume ? SoundboardSettings.volume / 100 : 1;
		return Math.max(0, Math.min(3, (soundVolume / 100) * output * board * master));
	}

	private startSource(id: string, buffer: AudioBuffer, gainValue: number, onEnded: () => void): boolean {
		const ctx = this.ensureContext();
		if (!ctx) return false;
		this.applyOutputDevice(ctx);
		try {
			const source = ctx.createBufferSource();
			source.buffer = buffer;
			const gain = ctx.createGain();
			gain.gain.value = gainValue;
			source.connect(gain).connect(ctx.destination);
			source.onended = () => {
				if (this.sources.get(id) === source) this.sources.delete(id);
				onEnded();
			};
			this.sources.get(id)?.stop();
			this.sources.set(id, source);
			source.start();
			return true;
		} catch (error) {
			logger.warn('Failed to start soundboard source', {id, error});
			return false;
		}
	}

	async play(params: PlayParams): Promise<void> {
		if (SoundboardSettings.volume <= 0) return;
		if (getEffectiveAudioState().effectiveDeaf) return;
		if (StreamerMode.shouldDisableSounds) return;
		if (!Sound.getSoundEnabled()) return;
		const buffer = await this.fetchBuffer(params.url, params.hash);
		if (!buffer) return;
		const {hash: _hash, url: _url, volume, ...play} = params;
		const started = this.startSource(params.playId, buffer, this.gainFor(volume, true), () =>
			this.removePlay(params.playId),
		);
		if (started) {
			this.activePlays = {...this.activePlays, [params.playId]: {...play, startedAt: Date.now()}};
		}
	}

	private removePlay(playId: string): void {
		if (!(playId in this.activePlays)) return;
		const next = {...this.activePlays};
		delete next[playId];
		this.activePlays = next;
	}

	stopLocal(playId: string): void {
		const source = this.sources.get(playId);
		this.sources.delete(playId);
		try {
			source?.stop();
		} catch {}
		this.removePlay(playId);
	}

	stopFromUser(playId: string, userId: string): void {
		const play = this.activePlays[playId];
		if (!play || play.userId !== userId) return;
		this.stopLocal(playId);
	}

	stopAll(): void {
		for (const playId of [...this.sources.keys()]) this.stopLocal(playId);
		this.activePlays = {};
	}

	async preview(sound: {id: string; hash: string; url: string; volume: number}): Promise<void> {
		const buffer = await this.fetchBuffer(sound.url, sound.hash);
		if (!buffer) return;
		this.previewSoundId = sound.id;
		this.startSource(PREVIEW_ID, buffer, this.gainFor(sound.volume, false), () => {
			if (this.previewSoundId === sound.id) this.previewSoundId = null;
		});
	}

	stopPreview(): void {
		const source = this.sources.get(PREVIEW_ID);
		this.sources.delete(PREVIEW_ID);
		try {
			source?.stop();
		} catch {}
		this.previewSoundId = null;
	}
}

export default new SoundboardPlaybackEngine();
