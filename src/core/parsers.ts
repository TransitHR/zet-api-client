import { DirectionEnum, RouteTypeEnum, TripStatusEnum, NewsTypeEnum, ScheduleRelationshipEnum, IncrementalityEnum } from './constants';
import { z } from 'zod';

export type Position = z.infer<typeof PositionSchema>;
export const PositionSchema = z.object({
	latitude: z.number(),
	longitude: z.number(),
});

export type ShapePoint = z.infer<typeof ShapePointSchema>;
export const ShapePointSchema = z.object({
	latitude: z.number(),
	longitude: z.number(),
	sequence: z.number(),
});

export type Shape = z.infer<typeof ShapeSchema>;
export const ShapeSchema = z.object({
	id: z.string(),
	points: z.array(ShapePointSchema),
});

export type ShapesResponse = z.infer<typeof ShapesResponseSchema>;
export const ShapesResponseSchema = z.record(z.string(), z.array(ShapePointSchema));

export type Vehicle = z.infer<typeof VehicleSchema>;
export const VehicleSchema = z.object({
	id: z.string(),
	isForDisabledPeople: z.boolean().nullable(),
	vehicleTypeId: z.number().nullable(),
	position: PositionSchema.optional(),
});

export type TripHeadsign = z.infer<typeof TripHeadsignSchema>;
export const TripHeadsignSchema = z.object({
	routeCode: z.string(),
	tripHeadsigns: z.array(z.string()),
});

export type Route = z.infer<typeof RouteSchema>;
export const RouteSchema = z.object({
	id: z.number(),
	shortName: z.string(),
	longName: z.string(),
	routeType: z.nativeEnum(RouteTypeEnum),
	departureHeadsign: z.string().nullable(),
	destinationHeadsign: z.string(),
	normalizedSearchName: z.string(),
});

export type Trip = z.infer<typeof TripSchema>;
export const TripSchema = z.object({
	id: z.string(),
	direction: z.nativeEnum(DirectionEnum),
	headsign: z.string(),
	departureDateTime: z.string(),
	arrivalDateTime: z.string(),
	hasLiveTracking: z.boolean(),
	tripStatus: z.nativeEnum(TripStatusEnum),
	vehicles: z.array(VehicleSchema),
	shapeId: z.string(),
});

export type Stop = z.infer<typeof StopSchema>;
export const StopSchema = z.object({
	id: z.string(),
	name: z.string(),
	routeType: z.nativeEnum(RouteTypeEnum),
	trips: z.array(TripHeadsignSchema),
	stopLat: z.number(),
	stopLong: z.number(),
	parentStopId: z.string(),
	normalizedSearchName: z.string(),
	isForDisabledPeople: z.boolean(),
	projectNo: z.string(),
});

export type TripStopTime = z.infer<typeof TripStopTimeSchema>;
export const TripStopTimeSchema = z.object({
	id: z.string(),
	stopName: z.string(),
	stopSequence: z.number(),
	expectedArrivalDateTime: z.string(),
	isArrived: z.boolean(),
	isArrivedPrediction: z.boolean(),
	stopLat: z.number(),
	stopLong: z.number(),
	trip: TripSchema,
});

export type News = z.infer<typeof NewsSchema>;
export const NewsSchema = z.object({
	title: z.string(),
	description: z.string(),
	link: z.string().url(),
	datePublished: z.string(),
	type: z.nativeEnum(NewsTypeEnum),
	lines: z.array(z.number()),
	stations: z.array(z.string()),
	validFrom: z.string(),
	validTo: z.string(),
});

export type GetRoutesInput = z.infer<typeof GetRoutesInputSchema>;
export const GetRoutesInputSchema = z.object({
	routeId: z.number().optional(),
	routeType: z.nativeEnum(RouteTypeEnum).optional(),
});

export const GetRouteTripsInputSchema = z.object({
	routeId: z.number(),
	daysFromToday: z.number().min(0).max(30).optional().default(0),
});
export type GetRouteTripsInput = z.input<typeof GetRouteTripsInputSchema>;

export type GetStopsInput = z.infer<typeof GetStopsInputSchema>;
export const GetStopsInputSchema = z.object({
	stopId: z.string().optional(),
	stopName: z.string().optional(),
	routeType: z.nativeEnum(RouteTypeEnum).optional(),
});

export type GetTripStopTimesInput = z.infer<typeof GetTripStopTimesInputSchema>;
export const GetTripStopTimesInputSchema = z.object({
	tripId: z.string(),
	daysFromToday: z.number().min(0).max(30).optional(),
});

export type RoutesResponse = z.infer<typeof RoutesResponseSchema>;
export const RoutesResponseSchema = z.array(RouteSchema);

export type RouteTripsResponse = z.infer<typeof RouteTripsResponseSchema>;
export const RouteTripsResponseSchema = z.array(TripSchema);

export type StopsResponse = z.infer<typeof StopsResponseSchema>;
export const StopsResponseSchema = z.array(StopSchema);

export type TripStopTimesResponse = z.infer<typeof TripStopTimesResponseSchema>;
export const TripStopTimesResponseSchema = z.array(TripStopTimeSchema);

export type NewsfeedResponse = z.infer<typeof NewsfeedResponseSchema>;
export const NewsfeedResponseSchema = z.array(NewsSchema);

export type TripWithDates = z.infer<typeof TripWithDatesSchema>;
export const TripWithDatesSchema = TripSchema.omit({
	departureDateTime: true,
	arrivalDateTime: true,
}).extend({
	departureDateTime: z.date(),
	arrivalDateTime: z.date(),
});

export type TripStopTimeWithDates = z.infer<typeof TripStopTimeWithDatesSchema>;
export const TripStopTimeWithDatesSchema = TripStopTimeSchema.omit({
	expectedArrivalDateTime: true,
	trip: true,
}).extend({
	expectedArrivalDateTime: z.date(),
	trip: TripWithDatesSchema,
});

export type NewsWithDates = z.infer<typeof NewsWithDatesSchema>;
export const NewsWithDatesSchema = NewsSchema.omit({
	datePublished: true,
	validFrom: true,
	validTo: true,
}).extend({
	datePublished: z.date(),
	validFrom: z.date(),
	validTo: z.date(),
});

export type SearchRoutesInput = z.input<typeof SearchRoutesInputSchema>;
export const SearchRoutesInputSchema = z.object({
	query: z.string().min(1),
	routeType: z.nativeEnum(RouteTypeEnum).optional(),
	limit: z.number().min(1).max(100).optional().default(10),
});

export type SearchStopsInput = z.input<typeof SearchStopsInputSchema>;
export const SearchStopsInputSchema = z.object({
	query: z.string().min(1),
	routeType: z.nativeEnum(RouteTypeEnum).optional(),
	limit: z.number().min(1).max(100).optional().default(10),
});

// GTFSRT Times.
const gtfsTime = z.number().transform((s) => new Date(s * 1000)); // seconds since epoch
const gtfsDate = z.string().transform((s) => { // YYYYMMDD
	const year = parseInt(s.slice(0, 4), 10);
	const month = parseInt(s.slice(4, 6), 10) - 1;
	const day = parseInt(s.slice(6, 8), 10);

	return new Date(Date.UTC(year, month, day));
});

// GTFSRT.
export type GTFSRTHeader = z.infer<typeof GTFSRTHeaderSchema>;
export const GTFSRTHeaderSchema = z.object({
	gtfsRealtimeVersion: z.string(),
	incrementality: z.nativeEnum(IncrementalityEnum),
	timestamp: gtfsTime,
});

export type GTFSRTTrip = z.infer<typeof GTFSRTTripSchema>;
export const GTFSRTTripSchema = z.object({
	tripId: z.string(),
	startDate: gtfsDate,
	scheduleRelationship: z.nativeEnum(ScheduleRelationshipEnum),
	routeId: z.string(),
});

export type GTFSRTStopTimeEvent = z.infer<typeof GTFSRTStopTimeEventSchema>;
export const GTFSRTStopTimeEventSchema = z.object({
	delay: z.number().optional(), // in seconds, negative = early, positive = late
	time: gtfsTime.optional(),
});

export type GTFSRTStopTimeUpdate = z.infer<typeof GTFSRTStopTimeUpdateSchema>;
export const GTFSRTStopTimeUpdateSchema = z.object({
	stopId: z.string(),
	stopSequence: z.number(),
	arrival: GTFSRTStopTimeEventSchema.optional(),
	departure: GTFSRTStopTimeEventSchema.optional(),
	scheduleRelationship: z.nativeEnum(ScheduleRelationshipEnum).optional(),
});

export type GTFSRTTripUpdate = z.infer<typeof GTFSRTTripUpdateSchema>;
export const GTFSRTTripUpdateSchema = z.object({
	trip: GTFSRTTripSchema,
	stopTimeUpdate: z.array(GTFSRTStopTimeUpdateSchema),
	timestamp: gtfsTime.optional(),
});

export type GTFSRTPosition = z.infer<typeof GTFSRTPositionSchema>;
export const GTFSRTPositionSchema = z.object({
	latitude: z.number(),
	longitude: z.number(),
});

export type GTFSRTVehicleDescriptor = z.infer<typeof GTFSRTVehicleDescriptorSchema>;
export const GTFSRTVehicleDescriptorSchema = z.object({
	id: z.string(),
});

export type GTFSRTVehiclePosition = z.infer<typeof GTFSRTVehiclePositionSchema>;
export const GTFSRTVehiclePositionSchema = z.object({
	trip: GTFSRTTripSchema,
	position: GTFSRTPositionSchema,
	timestamp: gtfsTime,
	vehicle: GTFSRTVehicleDescriptorSchema,
});

export type GTFSRTFeedEntity = z.infer<typeof GTFSRTFeedEntitySchema>;
export const GTFSRTFeedEntitySchema = z.object({
	id: z.string(),
	vehicle: GTFSRTVehiclePositionSchema.optional(),
	tripUpdate: GTFSRTTripUpdateSchema.optional(),
});

export type GTFSRTFeedMessage = z.infer<typeof GTFSRTFeedMessageSchema>;
export const GTFSRTFeedMessageSchema = z.object({
	header: GTFSRTHeaderSchema,
	entity: z.array(GTFSRTFeedEntitySchema),
});
