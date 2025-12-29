export enum RouteTypeEnum {
	Tram = 0,
	// 1: Subway (not used)
	// 2: Rail (not used)
	Bus = 3,
}

export enum DirectionEnum {
	Outbound = 0, // towards destinationHeadsign
	Inbound = 1, // towards departureHeadsign
}

export enum TripStatusEnum {
	Unknown = 0,
	Scheduled = 1,
	InProgress = 2,
	Finished = 3,
}

export enum NewsTypeEnum {
	General = 0,
	StationClosure = 1,
	RouteChange = 2,
	ScheduleChange = 3,
	ServiceChange = 4,
}

export enum ScheduleRelationshipEnum {
	Scheduled = 'SCHEDULED',
	Added = 'ADDED',
	Unscheduled = 'UNSCHEDULED',
	Canceled = 'CANCELED',
	Replacement = 'REPLACEMENT',
	Duplicated = 'DUPLICATED',
}

export enum IncrementalityEnum {
	FullDataSet = 'FULL_DATASET',
	Differential = 'DIFFERENTIAL',
}

export const routeTypeMap: Record<RouteTypeEnum, string> = {
	[RouteTypeEnum.Tram]: 'Tram',
	[RouteTypeEnum.Bus]: 'Bus',
};

export const directionMap: Record<DirectionEnum, string> = {
	[DirectionEnum.Outbound]: 'Outbound',
	[DirectionEnum.Inbound]: 'Inbound',
};

export const tripStatusMap: Record<TripStatusEnum, string> = {
	[TripStatusEnum.Unknown]: 'Unknown',
	[TripStatusEnum.Scheduled]: 'Scheduled',
	[TripStatusEnum.InProgress]: 'In Progress',
	[TripStatusEnum.Finished]: 'Finished',
};

export const newsTypeMap: Record<NewsTypeEnum, string> = {
	[NewsTypeEnum.General]: 'General',
	[NewsTypeEnum.StationClosure]: 'Station Closure',
	[NewsTypeEnum.RouteChange]: 'Route Change',
	[NewsTypeEnum.ScheduleChange]: 'Schedule Change',
	[NewsTypeEnum.ServiceChange]: 'Service Change',
};

export const scheduleRelationshipMap: Record<ScheduleRelationshipEnum, string> = {
	[ScheduleRelationshipEnum.Scheduled]: 'Scheduled',
	[ScheduleRelationshipEnum.Added]: 'Added',
	[ScheduleRelationshipEnum.Unscheduled]: 'Unscheduled',
	[ScheduleRelationshipEnum.Canceled]: 'Canceled',
	[ScheduleRelationshipEnum.Replacement]: 'Replacement',
	[ScheduleRelationshipEnum.Duplicated]: 'Duplicated',
};

export const incrementalityMap: Record<IncrementalityEnum, string> = {
	[IncrementalityEnum.FullDataSet]: 'Full Dataset',
	[IncrementalityEnum.Differential]: 'Differential',
};
