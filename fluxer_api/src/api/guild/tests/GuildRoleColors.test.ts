// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createGuild, getRoles} from '@app/api/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import type {GuildRoleResponse} from '@fluxer/schema/src/domains/guild/GuildRoleSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

const HOLOGRAPHIC = {primary_color: 0xa9c9ff, secondary_color: 0xffbbec, tertiary_color: 0xffc3a0};

describe('Role colors', () => {
	let harness: ApiTestHarness;
	let owner: TestAccount;
	let guild: GuildResponse;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	beforeEach(async () => {
		await harness.reset();
		owner = await createTestAccount(harness);
		guild = await createGuild(harness, owner.token, 'Role Colors Guild');
	});

	function createRole(body: Record<string, unknown>) {
		return createBuilder<GuildRoleResponse>(harness, owner.token)
			.post(`/guilds/${guild.id}/roles`)
			.body(body)
			.expect(HTTP_STATUS.OK)
			.execute();
	}

	function updateRole(roleId: string, body: Record<string, unknown>) {
		return createBuilder<GuildRoleResponse>(harness, owner.token)
			.patch(`/guilds/${guild.id}/roles/${roleId}`)
			.body(body)
			.expect(HTTP_STATUS.OK)
			.execute();
	}

	test('a plain color is reported as a solid colors object', async () => {
		const role = await createRole({name: 'Solid', color: 0x3498db});
		expect(role.color).toBe(0x3498db);
		expect(role.colors).toEqual({primary_color: 0x3498db, secondary_color: null, tertiary_color: null});
	});

	test('gradient and holographic colors are stored and listed', async () => {
		const gradient = await createRole({
			name: 'Gradient',
			colors: {primary_color: 0xff0000, secondary_color: 0x00ff00},
		});
		expect(gradient.color).toBe(0xff0000);
		expect(gradient.colors).toEqual({primary_color: 0xff0000, secondary_color: 0x00ff00, tertiary_color: null});

		const holo = await updateRole(gradient.id, {colors: HOLOGRAPHIC});
		expect(holo.color).toBe(HOLOGRAPHIC.primary_color);
		expect(holo.colors).toEqual(HOLOGRAPHIC);

		const listed = (await getRoles(harness, owner.token, guild.id)).find((role) => role.id === gradient.id);
		expect(listed?.colors).toEqual(HOLOGRAPHIC);
	});

	test('a tertiary color without a secondary color is ignored', async () => {
		const role = await createRole({name: 'Odd', colors: {primary_color: 0x123456, tertiary_color: 0x654321}});
		expect(role.colors).toEqual({primary_color: 0x123456, secondary_color: null, tertiary_color: null});
	});

	test('sending only color turns a gradient role solid again', async () => {
		const role = await createRole({name: 'Back', colors: HOLOGRAPHIC});
		const solid = await updateRole(role.id, {color: 0x00ff00});
		expect(solid.colors).toEqual({primary_color: 0x00ff00, secondary_color: null, tertiary_color: null});
	});

	test('updating other fields keeps the colors', async () => {
		const role = await createRole({name: 'Keep', colors: HOLOGRAPHIC});
		const renamed = await updateRole(role.id, {name: 'Kept'});
		expect(renamed.colors).toEqual(HOLOGRAPHIC);
	});
});
