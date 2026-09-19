// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {BadRequestError} from '@fluxer/errors/src/domains/core/BadRequestError';

export class NoUserWithUsernameError extends BadRequestError {
	constructor() {
		super({
			code: APIErrorCodes.NO_USER_WITH_USERNAME_EXISTS,
		});
	}
}
