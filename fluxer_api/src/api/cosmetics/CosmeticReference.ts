// SPDX-License-Identifier: AGPL-3.0-or-later

import {getCosmeticRegistry} from '@app/api/middleware/ServiceSingletons';
import {type CosmeticKind, isBuiltinCosmeticId, isUploadedCosmeticId} from '@fluxer/constants/src/CosmeticConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';

// A cosmetic reference is a built-in id of the right kind or an uploaded cosmetic of the right kind.
export async function resolveCosmeticReference(
	field: string,
	kind: CosmeticKind,
	value: string | null,
): Promise<string | null> {
	if (value === null) return null;
	if (isBuiltinCosmeticId(kind, value)) return value;
	if (isUploadedCosmeticId(value)) {
		const cosmetic = await getCosmeticRegistry().get(BigInt(value));
		if (cosmetic?.kind === kind) return value;
	}
	throw InputValidationError.fromCode(field, ValidationErrorCodes.INVALID_FORMAT);
}
