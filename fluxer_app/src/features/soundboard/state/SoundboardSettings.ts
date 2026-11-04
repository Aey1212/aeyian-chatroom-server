// SPDX-License-Identifier: AGPL-3.0-or-later

import {makePersistent} from '@app/features/platform/utils/MobXPersistence';
import {makeAutoObservable} from 'mobx';

class SoundboardSettings {
	volume = 100;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		void makePersistent(this, 'SoundboardSettings', ['volume']);
	}

	setVolume(volume: number): void {
		this.volume = Math.max(0, Math.min(100, Math.round(volume)));
	}
}

export default new SoundboardSettings();
