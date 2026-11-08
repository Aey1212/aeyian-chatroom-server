// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {FluxerError} from '@fluxer/errors/src/FluxerError';

export class RequestBodyTooLargeError extends FluxerError {
	constructor(maxSize: number) {
		super({code: APIErrorCodes.FILE_SIZE_TOO_LARGE, status: 413, messageVariables: {maxSize}});
	}
}
