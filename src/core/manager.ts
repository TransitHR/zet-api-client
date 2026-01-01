import { Route, Stop, News, Shape, RoutesResponseSchema, RouteTripsResponseSchema, StopsResponseSchema, TripStopTimesResponseSchema, NewsfeedResponseSchema, ShapesResponseSchema, GetRoutesInput, GetRouteTripsInput, GetStopsInput, GetTripStopTimesInput, SearchRoutesInput, SearchStopsInput, TripWithDates, TripStopTimeWithDates, NewsWithDates, GTFSRTVehiclePosition, PlatformDirection, StopDirectionMap, GetPlatformDirectionsInput } from './parsers';
import { StopIncomingTripsResponseSchema, GetStopIncomingTripsInput, StopIncomingTripWithDates, AccountSchema, Account } from '../auth/types';
import { parseZodError, normalizeString, parseGtfsRtVehicles } from './utils';
import { RouteTypeEnum, DirectionEnum } from './constants';
import { ZetAuthManager } from '../auth/manager';
import config, { headers } from './config';
import axios, { AxiosError } from 'axios';

export class ZetManager {
	private cachedRoutes: Route[] | null = null;
	private cachedStops: Stop[] | null = null;
	private cachedShapes: Shape[] | null = null;
	private cachedNews: News[] | null = null;

	private shapeToRouteTypeMap: Map<string, RouteTypeEnum> = new Map();

	private routesCachedAt: number | null = null;
	private stopsCachedAt: number | null = null;
	private shapesCachedAt: number | null = null;
	private newsCachedAt: number | null = null;

	public authManager = new ZetAuthManager();
	private timeoutMs: number = 10000;
	private cacheTTL: number = -1;

	constructor (cacheTTL: number = -1, timeoutMs: number = 10000) {
		if (cacheTTL < -1) throw new Error('cacheTTL must be -1 (no expiry) or a non-negative number in milliseconds.');
		if (timeoutMs <= 0) throw new Error('timeoutMs must be a positive number in milliseconds.');

		this.timeoutMs = timeoutMs;
		this.cacheTTL = cacheTTL;
	}

	// Routes.
	public async getRoutes(routeType?: RouteTypeEnum): Promise<Route[]> {
		const now = Date.now();
		const needsRefresh = !this.cachedRoutes || (this.cacheTTL >= 0 && this.routesCachedAt && now - this.routesCachedAt > this.cacheTTL);

		if (needsRefresh) await this.fetchAndCacheRoutes();
		if (!this.cachedRoutes) throw new Error('Failed to fetch routes.');

		if (routeType !== undefined) return this.cachedRoutes.filter((route) => route.routeType === routeType);
		return this.cachedRoutes;
	}

	private async getRoutesInternal(options: GetRoutesInput): Promise<Route[]> {
		let routes = await this.getRoutes();

		if (options.routeId !== undefined) routes = routes.filter((route) => route.id === options.routeId);
		if (options.routeType !== undefined) routes = routes.filter((route) => route.routeType === options.routeType);

		return routes;
	}

	public async getRouteById(routeId: number): Promise<Route | null> {
		const routes = await this.getRoutesInternal({ routeId });
		return routes[0] || null;
	}

	public async searchRoutes(options: SearchRoutesInput): Promise<Route[]> {
		const routes = await this.getRoutesInternal({ routeType: options.routeType });
		const normalizedQuery = normalizeString(options.query);

		const filtered = routes.filter((route) => {
			const normalizedName = normalizeString(route.normalizedSearchName);
			return normalizedName.includes(normalizedQuery) || route.shortName.toLowerCase().includes(options.query.toLowerCase());
		});

		return filtered.slice(0, options.limit || 10);
	}

	// Trips.
	public async getRouteTrips(options: GetRouteTripsInput): Promise<TripWithDates[]> {
		const url = `${config.timetableServiceUrl}/routeTrips`;
		const params = {
			routeId: options.routeId.toString(),
			daysFromToday: (options.daysFromToday || 0).toString(),
		};

		const response = await axios.get(url, { params, headers, timeout: this.timeoutMs }).catch((err: AxiosError) => err.response);
		if (!response || response.status !== 200) throw new Error(`Failed to fetch route trips: ${response?.statusText || 'Unknown error'}`);

		const parsed = RouteTripsResponseSchema.safeParse(response.data);
		if (!parsed.success) throw new Error(`Failed to parse route trips data: ${parseZodError(parsed.error).join(', ')}.`);

		return parsed.data.map((trip) => ({
			...trip,
			departureDateTime: new Date(trip.departureDateTime),
			arrivalDateTime: new Date(trip.arrivalDateTime),
		}));
	}

	public async getTripStopTimes(options: GetTripStopTimesInput): Promise<TripStopTimeWithDates[]> {
		const url = `${config.timetableServiceUrl}/tripStopTimes`;
		const params = {
			tripId: options.tripId,
			daysFromToday: (options.daysFromToday || 0).toString(),
		};

		const response = await axios.get(url, { params, headers, timeout: this.timeoutMs }).catch((err: AxiosError) => err.response);
		if (!response || response.status !== 200) throw new Error(`Failed to fetch trip stop times: ${response?.statusText || 'Unknown error'}`);

		const parsed = TripStopTimesResponseSchema.safeParse(response.data);
		if (!parsed.success) throw new Error(`Failed to parse trip stop times data: ${parseZodError(parsed.error).join(', ')}.`);

		return parsed.data.map((stopTime) => ({
			...stopTime,
			expectedArrivalDateTime: new Date(stopTime.expectedArrivalDateTime),
			trip: {
				...stopTime.trip,
				departureDateTime: new Date(stopTime.trip.departureDateTime),
				arrivalDateTime: new Date(stopTime.trip.arrivalDateTime),
			},
		}));
	}

	public async getLiveTripsForRoute(routeId: number, daysFromToday: number = 0): Promise<Map<string, TripStopTimeWithDates[]>> {
		const trips = await this.getRouteTrips({ routeId, daysFromToday });
		const liveData = new Map<string, TripStopTimeWithDates[]>();

		const now = new Date();
		const activeTrips = trips.filter((trip) => {
			const isActive = trip.departureDateTime <= now && trip.arrivalDateTime >= now;
			return isActive && trip.vehicles.some((v) => v.position);
		});

		const stopTimesPromises = activeTrips.map(async (trip) => {
			try {
				const stopTimes = await this.getTripStopTimes({ tripId: trip.id, daysFromToday });
				return { tripId: trip.id, stopTimes };
			} catch (error) {
				return { tripId: trip.id, stopTimes: [] };
			}
		});

		const results = await Promise.all(stopTimesPromises);
		for (const result of results) {
			if (result.stopTimes.length > 0) {
				liveData.set(result.tripId, result.stopTimes);
			}
		}

		return liveData;
	}

	public async getActiveTripIds(routeId: number, daysFromToday: number = 0, tripsOverride?: TripWithDates[]): Promise<string[]> {
		const trips = tripsOverride || await this.getRouteTrips({ routeId, daysFromToday });
		const now = new Date();

		return trips
			.filter((trip) => trip.departureDateTime <= now && trip.arrivalDateTime >= now && trip.vehicles.some((v) => v.position))
			.map((trip) => trip.id);
	}

	// Account,
	public async getAccountInfo(): Promise<Account> {
		if (!this.authManager.isAuthenticated()) throw new Error('Authentication required. Please login using getAuthManager().login() first.');

		const token = await this.authManager.getAccessToken();
		if (!token) throw new Error('Failed to get access token. Please login again.');

		const response = await axios.get(config.accountServiceUrl, {
			headers: {
				...headers,
				Authorization: `Bearer ${token}`,
			},
		}).catch((err: AxiosError) => err.response);

		if (!response || response.status !== 200) throw new Error(`Failed to fetch account info: ${response?.statusText || 'Unknown error'}`);
		const parsed = AccountSchema.safeParse(response.data);
		if (!parsed.success) throw new Error(`Failed to parse account info data: ${parseZodError(parsed.error).join(', ')}.`);

		return parsed.data;
	}

	// Stops.
	public async getStops(routeType?: RouteTypeEnum): Promise<Stop[]> {
		const now = Date.now();
		const needsRefresh = !this.cachedStops || (this.cacheTTL >= 0 && this.stopsCachedAt && now - this.stopsCachedAt > this.cacheTTL);

		if (needsRefresh) await this.fetchAndCacheStops();
		if (!this.cachedStops) throw new Error('Failed to fetch stops.');

		if (routeType !== undefined) return this.cachedStops.filter((stop) => stop.routeType === routeType);
		return this.cachedStops;
	}

	public async getStopIncomingTrips(options: GetStopIncomingTripsInput): Promise<StopIncomingTripWithDates[]> {
		if (!this.authManager.isAuthenticated()) throw new Error('Authentication required. Please login using getAuthManager().login() first.');

		const token = await this.authManager.getAccessToken();
		if (!token) throw new Error('Failed to get access token. Please login again.');

		const url = `${config.timetableServiceUrl}/stopIncomingTrips`;
		const params = {
			stopId: options.stopId,
			isMapView: (options.isMapView || false).toString(),
		};

		const response = await axios.get(url, {
			params, timeout: this.timeoutMs,
			headers: {
				...headers,
				Authorization: `Bearer ${token}`,
			},
		}).catch((err: AxiosError) => err.response);

		if (!response || response.status !== 200) throw new Error(`Failed to fetch stop incoming trips: ${response?.statusText || 'Unknown error'}`);
		const parsed = StopIncomingTripsResponseSchema.safeParse(response.data);
		if (!parsed.success) throw new Error(`Failed to parse stop incoming trips data: ${parseZodError(parsed.error).join(', ')}.`);

		return parsed.data.map((trip) => ({
			...trip,
			expectedArrivalDateTime: new Date(trip.expectedArrivalDateTime),
		}));
	}

	private async getStopsInternal(options: GetStopsInput): Promise<Stop[]> {
		let stops = await this.getStops();

		if (options.stopId) stops = stops.filter((stop) => stop.id === options.stopId);

		if (options.stopName) {
			const normalizedName = normalizeString(options.stopName);
			stops = stops.filter((stop) => {
				const normalizedStopName = normalizeString(stop.normalizedSearchName);
				return normalizedStopName.includes(normalizedName);
			});
		}

		if (options.routeType !== undefined) stops = stops.filter((stop) => stop.routeType === options.routeType);
		return stops;
	}

	public async getStopById(stopId: string, routeType?: RouteTypeEnum): Promise<Stop | null> {
		const stops = await this.getStopsInternal({ stopId, routeType });
		return stops[0] || null;
	}

	public async searchStops(options: SearchStopsInput): Promise<Stop[]> {
		const stops = await this.getStopsInternal({ routeType: options.routeType });
		const normalizedQuery = normalizeString(options.query);

		const filtered = stops.filter((stop) => {
			const normalizedName = normalizeString(stop.normalizedSearchName);
			return normalizedName.includes(normalizedQuery);
		});

		return filtered.slice(0, options.limit || 10);
	}

	// News.
	private async getNewsfeedInternal(): Promise<News[]> {
		const now = Date.now();
		const needsRefresh = !this.cachedNews || (this.cacheTTL >= 0 && this.newsCachedAt && now - this.newsCachedAt > this.cacheTTL);
		if (!needsRefresh && this.cachedNews) return this.cachedNews;

		const url = config.newsProxyServiceUrl;
		const response = await axios.get(url, { headers, timeout: this.timeoutMs }).catch((err: AxiosError) => err.response);
		if (!response || response.status !== 200) throw new Error(`Failed to fetch newsfeed: ${response?.statusText || 'Unknown error'}`);

		const parsed = NewsfeedResponseSchema.safeParse(response.data);
		if (!parsed.success) throw new Error(`Failed to parse newsfeed data: ${parseZodError(parsed.error).join(', ')}.`);

		this.cachedNews = parsed.data;
		this.newsCachedAt = now;
		return parsed.data;
	}

	public async getNewsfeed(): Promise<NewsWithDates[]> {
		const news = await this.getNewsfeedInternal();
		return news.map((item) => ({
			...item,
			datePublished: new Date(item.datePublished),
			validFrom: new Date(item.validFrom),
			validTo: new Date(item.validTo),
		}));
	}

	public async getNewsByRoute(routeId: number): Promise<News[]> {
		const news = await this.getNewsfeedInternal();
		return news.filter((item) => item.lines.includes(routeId));
	}

	// Shapes.
	public async getShapes(routeType?: RouteTypeEnum): Promise<Shape[]> {
		const now = Date.now();
		const needsRefresh = !this.cachedShapes || (this.cacheTTL >= 0 && this.shapesCachedAt && now - this.shapesCachedAt > this.cacheTTL);

		if (needsRefresh) await this.fetchAndCacheShapes();
		if (!this.cachedShapes) throw new Error('Failed to fetch shapes.');

		if (routeType !== undefined) return this.cachedShapes.filter((shape) => this.shapeToRouteTypeMap.get(shape.id) === routeType);
		return this.cachedShapes;
	}

	public async getShapesByRouteId(routeId: number): Promise<Shape[]> {
		const trips = await this.getRouteTrips({ routeId, daysFromToday: 0 });
		const uniqueShapeIds = new Set(trips.map((trip) => trip.shapeId));
		const shapes = await this.getShapes();

		return shapes.filter((shape) => uniqueShapeIds.has(shape.id));
	}

	// Platform Directions.
	public async getPlatformDirections(options: GetPlatformDirectionsInput): Promise<StopDirectionMap> {
		const directionsMap = new Map<string, PlatformDirection>();

		let stops = options.stops;
		if (!stops) {
			stops = await this.getStops();
			if (options.parentStopId) stops = stops.filter((stop) => stop.parentStopId === options.parentStopId || stop.id === options.parentStopId);
		}

		let trips = options.trips;
		if (!trips && options.routeId) trips = await this.getRouteTrips({ routeId: options.routeId, daysFromToday: 0 });
		if (!trips) throw new Error('Either provide trips data or specify a routeId to fetch trips.');

		const outboundTrips = trips.filter((trip) => trip.direction === DirectionEnum.Outbound);
		const inboundTrips = trips.filter((trip) => trip.direction === DirectionEnum.Inbound);

		for (const trip of outboundTrips) {
			try {
				const stopTimes = await this.getTripStopTimes({ tripId: trip.id });
				for (const stopTime of stopTimes) {
					const stop = stops.find((s) => s.id === stopTime.id);
					if (stop && !directionsMap.has(stopTime.id)) {
						const routeIds = stop.trips.map((t) => parseInt(t.routeCode)).filter((id) => !isNaN(id));
						directionsMap.set(stopTime.id, {
							stopId: stopTime.id,
							parentStopId: stop.parentStopId,
							projectNo: stop.projectNo,
							direction: DirectionEnum.Outbound,
							headsign: trip.headsign,
							routeIds,
							position: {
								lat: stop.stopLat,
								lng: stop.stopLong,
							},
						});
					}
				}
			} catch (error) {
				continue;
			}
		}

		for (const trip of inboundTrips) {
			try {
				const stopTimes = await this.getTripStopTimes({ tripId: trip.id });
				for (const stopTime of stopTimes) {
					const stop = stops.find((s) => s.id === stopTime.id);
					if (stop && !directionsMap.has(stopTime.id)) {
						const routeIds = stop.trips.map((t) => parseInt(t.routeCode)).filter((id) => !isNaN(id));
						directionsMap.set(stopTime.id, {
							stopId: stopTime.id,
							parentStopId: stop.parentStopId,
							projectNo: stop.projectNo,
							direction: DirectionEnum.Inbound,
							headsign: trip.headsign,
							routeIds,
							position: {
								lat: stop.stopLat,
								lng: stop.stopLong,
							},
						});
					}
				}
			} catch (error) {
				continue;
			}
		}

		return directionsMap;
	}

	public async getPlatformDirectionsForParentStop(parentStopId: string): Promise<PlatformDirection[]> {
		const directions = await this.getPlatformDirections({ parentStopId });
		return Array.from(directions.values()).filter((dir) => dir.parentStopId === parentStopId);
	}

	public async getPlatformDirectionsForRoute(routeId: number): Promise<StopDirectionMap> {
		return this.getPlatformDirections({ routeId });
	}

	// Vehicles.
	public async getLiveVehicles(routeId?: number): Promise<GTFSRTVehiclePosition[]> {
		const response = await axios.get(config.gtfsRtUrl, { headers, timeout: this.timeoutMs, responseType: 'arraybuffer' }).catch((err: AxiosError) => err.response);
		if (!response || response.status !== 200) throw new Error(`Failed to fetch GTFS-RT feed: ${response?.statusText || 'Unknown error'}`);

		const allVehicles = parseGtfsRtVehicles(response.data);

		if (routeId !== undefined) {
			const routeIdStr = routeId.toString();
			return allVehicles.filter((vehicle) => vehicle.trip.routeId === routeIdStr);
		}

		return allVehicles;
	}

	// Cache.
	public async refreshCache(): Promise<void> {
		this.cachedRoutes = null;
		this.cachedStops = null;
		this.cachedShapes = null;
		this.cachedNews = null;
		this.routesCachedAt = null;
		this.stopsCachedAt = null;
		this.shapesCachedAt = null;
		this.newsCachedAt = null;

		await Promise.all([
			this.fetchAndCacheRoutes(),
			this.fetchAndCacheStops(),
			this.fetchAndCacheShapes(),
			this.getNewsfeed(),
		]);
	}

	public clearCache(): void {
		this.cachedRoutes = null;
		this.cachedStops = null;
		this.cachedShapes = null;
		this.cachedNews = null;
		this.shapeToRouteTypeMap.clear();
		this.routesCachedAt = null;
		this.stopsCachedAt = null;
		this.shapesCachedAt = null;
		this.newsCachedAt = null;
	}

	// Private.
	private async fetchAndCacheRoutes(): Promise<void> {
		const url = `${config.timetableServiceUrl}/routes`;
		const response = await axios.get(url, { headers, timeout: this.timeoutMs }).catch((err: AxiosError) => err.response);
		if (!response || response.status !== 200) throw new Error(`Failed to fetch routes: ${response?.statusText || 'Unknown error'}`);

		const parsed = RoutesResponseSchema.safeParse(response.data);
		if (!parsed.success) throw new Error(`Failed to parse routes data: ${parseZodError(parsed.error).join(', ')}.`);

		this.cachedRoutes = parsed.data;
		this.routesCachedAt = Date.now();
	}

	private async fetchAndCacheStops(): Promise<void> {
		const url = `${config.timetableServiceUrl}/stops`;
		const response = await axios.get(url, { headers, timeout: this.timeoutMs }).catch((err: AxiosError) => err.response);
		if (!response || response.status !== 200) throw new Error(`Failed to fetch stops: ${response?.statusText || 'Unknown error'}`);

		const parsed = StopsResponseSchema.safeParse(response.data);
		if (!parsed.success) throw new Error(`Failed to parse stops data: ${parseZodError(parsed.error).join(', ')}.`);

		this.cachedStops = parsed.data;
		this.stopsCachedAt = Date.now();
	}

	private async fetchAndCacheShapes(): Promise<void> {
		const url = `${config.gtfsServiceUrl}/shapes`;
		const response = await axios.get(url, { headers, timeout: this.timeoutMs }).catch((err: AxiosError) => err.response);
		if (!response || response.status !== 200) throw new Error(`Failed to fetch shapes: ${response?.statusText || 'Unknown error'}`);

		const parsed = ShapesResponseSchema.safeParse(response.data);
		if (!parsed.success) throw new Error(`Failed to parse shapes data: ${parseZodError(parsed.error).join(', ')}.`);

		this.cachedShapes = Object.entries(parsed.data).map(([id, points]) => ({ id, points }));
		this.shapesCachedAt = Date.now();

		await this.buildShapeToRouteTypeMap();
	}

	private async buildShapeToRouteTypeMap(): Promise<void> {
		this.shapeToRouteTypeMap.clear();
		const routes = await this.getRoutes();

		for (const route of routes) {
			const trips = await this.getRouteTrips({ routeId: route.id, daysFromToday: 0 });
			for (const trip of trips) {
				this.shapeToRouteTypeMap.set(trip.shapeId, route.routeType);
			}
		}
	}
}
