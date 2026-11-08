import {z} from 'zod';

export interface EnumEntry {
	name: string;
	value: string | number;
	description?: string;
}

export interface BitflagEntry {
	name: string;
	value: string;
	description?: string;
}

interface SchemaMetadata {
	name?: string;
	enumEntries?: Array<EnumEntry>;
	openEnum?: boolean;
	bitflagValues?: Array<BitflagEntry>;
	format?: string;
	preserveEmptyValues?: boolean;
	// Upstream Fluxer c77978327 (#3863): a request field holding base64 file bytes, which the content
	// filter skips by path.
	base64Binary?: boolean;
}

export const schemaMetadata = z.registry<SchemaMetadata>();

export function withSchemaMetadata<T extends z.ZodType>(schema: T, metadata: SchemaMetadata): T {
	const registeredSchema: z.ZodType = schema;
	schemaMetadata.add(registeredSchema, metadata);
	return schema;
}
