// SPDX-License-Identifier: AGPL-3.0-or-later

import {makePersistent} from '@app/features/platform/utils/MobXPersistence';
import {makeAutoObservable} from 'mobx';

// Per device. Name effects animate on hover unless this is on; reduced motion always wins.
class NameStylePrefs {
	alwaysAnimate = false;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		void makePersistent(this, 'NameStylePrefs', ['alwaysAnimate']);
	}

	setAlwaysAnimate(value: boolean): void {
		this.alwaysAnimate = value;
	}
}

export default new NameStylePrefs();
