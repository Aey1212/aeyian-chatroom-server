// SPDX-License-Identifier: AGPL-3.0-or-later

import type {GuildID, SoundboardSoundID} from '@app/api/BrandedTypes';
import {deleteOneOrMany, fetchMany, fetchOne, upsertOne} from '@app/api/database/CassandraQueryExecution';
import type {GuildSoundboardSoundRow} from '@app/api/database/types/GuildTypes';
import {GuildSoundboardSound} from '@app/api/models/GuildSoundboardSound';
import {GuildSoundboardSounds} from '@app/api/Tables';

const LIST_SOUNDS_CQL = GuildSoundboardSounds.select({
	where: GuildSoundboardSounds.where.eq('guild_id'),
});
const FETCH_SOUND_CQL = GuildSoundboardSounds.select({
	where: [GuildSoundboardSounds.where.eq('guild_id'), GuildSoundboardSounds.where.eq('sound_id')],
	limit: 1,
});

export class SoundboardRepository {
	async listSounds(guildId: GuildID): Promise<Array<GuildSoundboardSound>> {
		const rows = await fetchMany<GuildSoundboardSoundRow>(LIST_SOUNDS_CQL.bind({guild_id: guildId}));
		return rows.map((row) => new GuildSoundboardSound(row));
	}

	async getSound(guildId: GuildID, soundId: SoundboardSoundID): Promise<GuildSoundboardSound | null> {
		const row = await fetchOne<GuildSoundboardSoundRow>(FETCH_SOUND_CQL.bind({guild_id: guildId, sound_id: soundId}));
		return row ? new GuildSoundboardSound(row) : null;
	}

	async upsertSound(sound: GuildSoundboardSound): Promise<GuildSoundboardSound> {
		await upsertOne(GuildSoundboardSounds.upsertAll(sound.toRow()));
		return sound;
	}

	async deleteSound(guildId: GuildID, soundId: SoundboardSoundID): Promise<void> {
		await deleteOneOrMany(GuildSoundboardSounds.deleteByPk({guild_id: guildId, sound_id: soundId}));
	}
}
