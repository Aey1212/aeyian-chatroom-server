// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createDmChannel, createFriendship} from '@app/api/channel/tests/ChannelTestUtils';
import {createGuild} from '@app/api/guild/tests/GuildTestUtils';
import {sendMessage} from '@app/api/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

const FLAG = '<:aeyian_flag:1>';

describe('Built-in emojis', () => {
	let harness: ApiTestHarness;
	let owner: TestAccount;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	beforeEach(async () => {
		await harness.reset();
		owner = await createTestAccount(harness);
	});

	test('stay intact in a server message', async () => {
		const guild = await createGuild(harness, owner.token, 'Builtin Emoji Guild');
		const message = await sendMessage(harness, owner.token, guild.system_channel_id!, `hi ${FLAG}`);
		expect(message.content).toBe(`hi ${FLAG}`);
	});

	test('stay intact in a DM', async () => {
		const friend = await createTestAccount(harness);
		await createFriendship(harness, owner, friend);
		const dm = await createDmChannel(harness, owner.token, friend.userId);
		const message = await sendMessage(harness, owner.token, dm.id, FLAG);
		expect(message.content).toBe(FLAG);
	});

	test('an unknown small id is still stripped to its name', async () => {
		const guild = await createGuild(harness, owner.token, 'Builtin Emoji Guild');
		const message = await sendMessage(harness, owner.token, guild.system_channel_id!, '<:not_real:2>');
		expect(message.content).toBe(':not_real:');
	});

	test('can be used as a reaction anywhere', async () => {
		const guild = await createGuild(harness, owner.token, 'Builtin Emoji Guild');
		const channelId = guild.system_channel_id!;
		const message = await sendMessage(harness, owner.token, channelId, 'react to me');
		await createBuilder(harness, owner.token)
			.put(`/channels/${channelId}/messages/${message.id}/reactions/${encodeURIComponent('aeyian_flag:1')}/@me`)
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();
		const reactors = await createBuilder<Array<{id: string}>>(harness, owner.token)
			.get(`/channels/${channelId}/messages/${message.id}/reactions/${encodeURIComponent('aeyian_flag:1')}`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(reactors.map((user) => user.id)).toEqual([owner.userId]);
	});
});
