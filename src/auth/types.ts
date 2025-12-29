import { z } from 'zod';

export type LoginCredentials = z.infer<typeof LoginCredentialsSchema>;
export const LoginCredentialsSchema = z.object({
	username: z.string().email().optional(),
	password: z.string().optional(),
	revokeOtherTokens: z.boolean().optional(),
	fcmToken: z.string().optional(),
	refreshToken: z.string().optional(),
	accessToken: z.string().optional(),
}).refine((data) => {
	return (data.accessToken && data.refreshToken) || data.refreshToken || (data.username && data.password);
}, {
	message: 'Either (accessToken + refreshToken), refreshToken alone, or both username and password must be provided',
});

export type RegisterCredentials = z.infer<typeof RegisterCredentialsSchema>;
export const RegisterCredentialsSchema = z.object({
	email: z.string().email(),
	password: z.string(),
	confirmPassword: z.string(),
});

export type AuthTokens = z.infer<typeof AuthTokensSchema>;
export type AuthTokensLogin = AuthTokens & { expiresIn: number; viaTokenRefresh: boolean; viaAccessToken: boolean; };
export const AuthTokensSchema = z.object({
	accessToken: z.string(),
	refreshToken: z.string(),
});

export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;
export const RefreshTokenRequestSchema = z.object({
	refreshToken: z.string(),
});

export type Account = z.infer<typeof AccountSchema>;
export const AccountSchema = z.object({
	id: z.number(),
	uid: z.string(),
	email: z.string().email(),
	firstName: z.string(),
	lastName: z.string(),
	ePurseAmount: z.number(),
	clientId: z.number().nullable(),
	language: z.number(),
	isFullProfileActivationInProgress: z.boolean(),
	messages: z.array(z.unknown()),
	processes: z.unknown().nullable(),
});

export type StopIncomingTrip = z.infer<typeof StopIncomingTripSchema>;
export const StopIncomingTripSchema = z.object({
	tripId: z.string(),
	routeShortName: z.string(),
	headsign: z.string(),
	expectedArrivalDateTime: z.string(),
	hasLiveTracking: z.boolean(),
	daysFromToday: z.number(),
	shapeId: z.string(),
	vehicles: z.array(z.object({
		id: z.string(),
		isForDisabledPeople: z.boolean().nullable(),
		vehicleTypeId: z.number().nullable(),
		position: z.object({
			latitude: z.number(),
			longitude: z.number(),
		}).optional(),
	})),
});

export type StopIncomingTripWithDates = Omit<StopIncomingTrip, 'expectedArrivalDateTime'> & {
	expectedArrivalDateTime: Date;
};

export type GetStopIncomingTripsInput = z.infer<typeof GetStopIncomingTripsInputSchema>;
export const GetStopIncomingTripsInputSchema = z.object({
	stopId: z.string(),
	isMapView: z.boolean().optional().default(false),
});

export const StopIncomingTripsResponseSchema = z.array(StopIncomingTripSchema);
