import { GTFSRTVehiclePosition, GTFSRTFeedMessageSchema, GTFSRTFeedEntity } from './parsers';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { ZodError, ZodIssue } from 'zod';

export function parseZodError(error: ZodError) {
	const errors: string[] = [];

	const formatSchemaPath = (path: (string | number)[]) => {
		return !path.length ? 'Schema' : `Schema.${path.join('.')}`;
	};

	const firstLetterToLowerCase = (str: string) => {
		return str.charAt(0).toLowerCase() + str.slice(1);
	};

	const makeSureItsString = (value: unknown) => {
		return typeof value === 'string' ? value : JSON.stringify(value);
	};

	const parseZodIssue = (issue: ZodIssue) => {
		switch (issue.code) {
			case 'invalid_type': return `${formatSchemaPath(issue.path)} must be a ${issue.expected} (invalid_type)`;
			case 'invalid_literal': return `${formatSchemaPath(issue.path)} must be a ${makeSureItsString(issue.expected)} (invalid_literal)`;
			case 'custom': return `${formatSchemaPath(issue.path)} ${firstLetterToLowerCase(issue.message)} (custom)`;
			case 'invalid_union': return `${formatSchemaPath(issue.path)} ${firstLetterToLowerCase(issue.message)} (invalid_union)`;
			case 'invalid_union_discriminator': return `${formatSchemaPath(issue.path)} ${firstLetterToLowerCase(issue.message)} (invalid_union_discriminator)`;
			case 'invalid_enum_value': return `${formatSchemaPath(issue.path)} ${firstLetterToLowerCase(issue.message)} (invalid_enum_value)`;
			case 'unrecognized_keys': return `${formatSchemaPath(issue.path)} ${firstLetterToLowerCase(issue.message)} (unrecognized_keys)`;
			case 'invalid_arguments': return `${formatSchemaPath(issue.path)} ${firstLetterToLowerCase(issue.message)} (invalid_arguments)`;
			case 'invalid_return_type': return `${formatSchemaPath(issue.path)} ${firstLetterToLowerCase(issue.message)} (invalid_return_type)`;
			case 'invalid_date': return `${formatSchemaPath(issue.path)} ${firstLetterToLowerCase(issue.message)} (invalid_date)`;
			case 'invalid_string': return `${formatSchemaPath(issue.path)} ${firstLetterToLowerCase(issue.message)} (invalid_string)`;
			case 'too_small': return `${formatSchemaPath(issue.path)} ${firstLetterToLowerCase(issue.message)} (too_small)`;
			case 'too_big': return `${formatSchemaPath(issue.path)} ${firstLetterToLowerCase(issue.message)} (too_big)`;
			case 'invalid_intersection_types': return `${formatSchemaPath(issue.path)} ${firstLetterToLowerCase(issue.message)} (invalid_intersection_types)`;
			case 'not_multiple_of': return `${formatSchemaPath(issue.path)} ${firstLetterToLowerCase(issue.message)} (not_multiple_of)`;
			case 'not_finite': return `${formatSchemaPath(issue.path)} ${firstLetterToLowerCase(issue.message)} (not_finite)`;
			default: return `Schema has an unknown error (JSON: ${JSON.stringify(issue)})`;
		}
	};

	for (const issue of error.issues) {
		const parsedIssue = parseZodIssue(issue) + '.';
		if (parsedIssue) errors.push(parsedIssue);
	}

	return errors;
}

export function toDate<T extends string | Date | null>(date: T): T extends null ? null : Date {
	return (date === null ? null : (typeof date === 'string' ? new Date(date) : date as Date)) as T extends null ? null : Date;
}

export function normalizeString(str: string): string {
	return str
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/đ/g, 'd')
		.replace(/č/g, 'c')
		.replace(/ć/g, 'c')
		.replace(/š/g, 's')
		.replace(/ž/g, 'z')
		.trim();
}

function mergeGtfsRtEntities(entities: GTFSRTFeedEntity[]): GTFSRTFeedEntity[] {
	const entityMap = new Map<string, GTFSRTFeedEntity>();

	for (const entity of entities) {
		const baseId = entity.id.split('_')[0]!;

		if (!entityMap.has(baseId)) {
			entityMap.set(baseId, {
				id: baseId,
				vehicle: entity.vehicle,
				tripUpdate: entity.tripUpdate,
			});
		} else {
			const existing = entityMap.get(baseId)!;
			entityMap.set(baseId, {
				id: baseId,
				vehicle: entity.vehicle || existing.vehicle,
				tripUpdate: entity.tripUpdate || existing.tripUpdate,
			});
		}
	}

	return Array.from(entityMap.values());
}

export function parseGtfsRtVehicles(buffer: ArrayBuffer): GTFSRTVehiclePosition[] {
	try {
		const decodedFeed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
		const feedJson = GtfsRealtimeBindings.transit_realtime.FeedMessage.toObject(decodedFeed, {
			enums: String,
			longs: Number,
			bytes: String,
			defaults: false,
			arrays: true,
			objects: true,
			oneofs: true,
		});

		const parsed = GTFSRTFeedMessageSchema.safeParse(feedJson);
		if (!parsed.success) {
			const errorMsgs = parseZodError(parsed.error);

			for (const msg of errorMsgs) {
				const match = msg.match(/entity\.(\d+)\./);
				if (match && match[1]) {
					const index = parseInt(match[1]);
					console.error(`Raw entity ${index}:`, feedJson.entity[index]);
				}
			}

			throw new Error(errorMsgs.join(', '));
		}

		const mergedEntities = mergeGtfsRtEntities(parsed.data.entity);

		const vehicles: GTFSRTVehiclePosition[] = [];
		for (const entity of mergedEntities) {
			if (entity.vehicle) vehicles.push(entity.vehicle);
		}

		return vehicles;
	} catch (error) {
		throw new Error(`Failed to parse GTFS-RT protobuf: ${error instanceof Error ? error.message : String(error)}`);
	}
}
