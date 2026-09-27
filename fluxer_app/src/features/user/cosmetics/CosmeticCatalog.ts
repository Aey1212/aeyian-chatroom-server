// SPDX-License-Identifier: AGPL-3.0-or-later

import {Endpoints} from '@app/features/app/constants/Endpoints';
import {mediaUrl, setUrlQueryParams} from '@app/features/messaging/utils/MessagingUrlUtils';
import {http} from '@app/features/platform/transport/RestTransport';
import {Logger} from '@app/features/platform/utils/AppLogger';
import {type CosmeticKind, isUploadedCosmeticId} from '@fluxer/constants/src/CosmeticConstants';
import type {CosmeticListResponse, CosmeticResponse} from '@fluxer/schema/src/domains/cosmetics/CosmeticSchemas';
import {makeAutoObservable, runInAction} from 'mobx';

const logger = new Logger('CosmeticCatalog');

// The avatar frames and nameplates admins uploaded. Loaded the first time something needs one.
class CosmeticCatalog {
	uploaded: ReadonlyArray<CosmeticResponse> = [];
	loaded = false;
	private inFlight: Promise<void> | null = null;

	constructor() {
		makeAutoObservable<this, 'inFlight'>(this, {inFlight: false}, {autoBind: true});
	}

	ensureLoaded(force = false): Promise<void> {
		if (this.loaded && !force) return Promise.resolve();
		if (this.inFlight) return this.inFlight;
		this.inFlight = http
			.get<CosmeticListResponse>(Endpoints.COSMETICS)
			.then((response) => {
				runInAction(() => {
					this.uploaded = response.body.cosmetics;
					this.loaded = true;
				});
			})
			.catch((error: unknown) => {
				logger.warn('Failed to load cosmetics:', error);
			})
			.finally(() => {
				this.inFlight = null;
			});
		return this.inFlight;
	}

	get(id: string | null | undefined): CosmeticResponse | undefined {
		if (!isUploadedCosmeticId(id)) return undefined;
		const found = this.uploaded.find((cosmetic) => cosmetic.id === id);
		if (!found && !this.loaded) void this.ensureLoaded();
		return found;
	}

	list(kind: CosmeticKind): ReadonlyArray<CosmeticResponse> {
		return this.uploaded.filter((cosmetic) => cosmetic.kind === kind);
	}
}

export function cosmeticImageUrl(id: string, options: {animated: boolean; size: number}): string {
	return setUrlQueryParams(mediaUrl(`cosmetics/${id}.webp`, {animated: options.animated}), {size: options.size});
}

export default new CosmeticCatalog();
