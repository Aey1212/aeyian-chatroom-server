// SPDX-License-Identifier: AGPL-3.0-or-later

import {Endpoints} from '@app/features/app/constants/Endpoints';
import {http} from '@app/features/platform/transport/RestTransport';
import {Logger} from '@app/features/platform/utils/AppLogger';
import {makeAutoObservable, runInAction} from 'mobx';

const logger = new Logger('GuildSoundboardSounds');

export interface SoundboardSound {
	id: string;
	guildId: string;
	name: string;
	emojiId: string | null;
	emojiName: string | null;
	volume: number;
	creatorId: string;
	hash: string;
	extension: string;
	contentType: string;
	durationMs: number;
	sizeBytes: number;
	url: string;
	createdAt: string;
}

export interface ApiSoundboardSound {
	id: string;
	guild_id: string;
	name: string;
	emoji_id: string | null;
	emoji_name: string | null;
	volume: number;
	creator_id: string;
	hash: string;
	extension: string;
	content_type: string;
	duration_ms: number;
	size_bytes: number;
	url: string;
	created_at: string;
}

export interface SoundboardSoundEdit {
	name?: string;
	volume?: number;
	emojiId?: string | null;
	emojiName?: string | null;
}

export function soundFromApi(row: ApiSoundboardSound): SoundboardSound {
	return {
		id: row.id,
		guildId: row.guild_id,
		name: row.name,
		emojiId: row.emoji_id,
		emojiName: row.emoji_name,
		volume: row.volume,
		creatorId: row.creator_id,
		hash: row.hash,
		extension: row.extension,
		contentType: row.content_type,
		durationMs: row.duration_ms,
		sizeBytes: row.size_bytes,
		url: row.url,
		createdAt: row.created_at,
	};
}

function editBody(edit: SoundboardSoundEdit): Record<string, unknown> {
	const body: Record<string, unknown> = {};
	if (edit.name !== undefined) body.name = edit.name;
	if (edit.volume !== undefined) body.volume = edit.volume;
	if (edit.emojiId !== undefined || edit.emojiName !== undefined) {
		body.emoji_id = edit.emojiId ?? null;
		body.emoji_name = edit.emojiName ?? null;
	}
	return body;
}

class GuildSoundboardSounds {
	soundsByGuild: Record<string, ReadonlyArray<SoundboardSound>> = {};
	loading: Record<string, boolean> = {};
	failed: Record<string, boolean> = {};
	private pending = new Map<string, Promise<void>>();

	constructor() {
		makeAutoObservable<this, 'pending'>(this, {pending: false}, {autoBind: true});
	}

	getSounds(guildId: string): ReadonlyArray<SoundboardSound> {
		return this.soundsByGuild[guildId] ?? [];
	}

	hasLoaded(guildId: string): boolean {
		return this.soundsByGuild[guildId] !== undefined;
	}

	getSound(guildId: string, soundId: string): SoundboardSound | null {
		return this.getSounds(guildId).find((sound) => sound.id === soundId) ?? null;
	}

	setSounds(guildId: string, rows: ReadonlyArray<ApiSoundboardSound>): void {
		this.soundsByGuild = {
			...this.soundsByGuild,
			[guildId]: Object.freeze(
				rows.map(soundFromApi).sort((a, b) => a.name.localeCompare(b.name, undefined, {sensitivity: 'base'})),
			),
		};
		this.failed = {...this.failed, [guildId]: false};
	}

	async load(guildId: string, force = false): Promise<void> {
		if (!force && this.hasLoaded(guildId)) return;
		const existing = this.pending.get(guildId);
		if (existing) return existing;
		const request = (async () => {
			runInAction(() => {
				this.loading = {...this.loading, [guildId]: true};
			});
			try {
				const response = await http.get<Array<ApiSoundboardSound>>(Endpoints.GUILD_SOUNDBOARD_SOUNDS(guildId));
				runInAction(() => this.setSounds(guildId, response.body));
			} catch (error) {
				logger.warn('Failed to load soundboard sounds', {guildId, error});
				runInAction(() => {
					this.failed = {...this.failed, [guildId]: true};
				});
			} finally {
				runInAction(() => {
					this.loading = {...this.loading, [guildId]: false};
				});
				this.pending.delete(guildId);
			}
		})();
		this.pending.set(guildId, request);
		return request;
	}

	async create(
		guildId: string,
		params: {name: string; base64Audio: string} & Omit<SoundboardSoundEdit, 'name'>,
	): Promise<SoundboardSound> {
		const response = await http.post<ApiSoundboardSound>(Endpoints.GUILD_SOUNDBOARD_SOUNDS(guildId), {
			body: {...editBody(params), name: params.name, audio: params.base64Audio},
		});
		const sound = soundFromApi(response.body);
		runInAction(() => {
			const others = this.getSounds(guildId).filter((entry) => entry.id !== sound.id);
			this.soundsByGuild = {...this.soundsByGuild, [guildId]: Object.freeze([...others, sound])};
		});
		return sound;
	}

	async update(guildId: string, soundId: string, edit: SoundboardSoundEdit): Promise<SoundboardSound> {
		const response = await http.patch<ApiSoundboardSound>(Endpoints.GUILD_SOUNDBOARD_SOUND(guildId, soundId), {
			body: editBody(edit),
		});
		const sound = soundFromApi(response.body);
		runInAction(() => {
			this.soundsByGuild = {
				...this.soundsByGuild,
				[guildId]: Object.freeze(this.getSounds(guildId).map((entry) => (entry.id === sound.id ? sound : entry))),
			};
		});
		return sound;
	}

	async remove(guildId: string, soundId: string): Promise<void> {
		await http.delete(Endpoints.GUILD_SOUNDBOARD_SOUND(guildId, soundId));
		runInAction(() => {
			this.soundsByGuild = {
				...this.soundsByGuild,
				[guildId]: Object.freeze(this.getSounds(guildId).filter((entry) => entry.id !== soundId)),
			};
		});
	}

	async play(channelId: string, guildId: string, soundId: string): Promise<string | null> {
		const response = await http.post<{play_id: string}>(Endpoints.VOICE_CHANNEL_SOUNDBOARD_PLAY(channelId), {
			body: {guild_id: guildId, sound_id: soundId},
		});
		return response.body?.play_id ?? null;
	}

	async stop(channelId: string, playId: string): Promise<void> {
		await http.post(Endpoints.VOICE_CHANNEL_SOUNDBOARD_STOP(channelId), {body: {play_id: playId}});
	}
}

export default new GuildSoundboardSounds();
