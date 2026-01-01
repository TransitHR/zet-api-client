export default {
	baseUrl: 'https://api.zet.hr',
	gtfsRtUrl: 'https://www.zet.hr/gtfs-rt-protobuf',
	authServiceUrl: 'https://api.zet.hr/AuthService.Api/api/auth',
	timetableServiceUrl: 'https://api.zet.hr/TimetableService.Api/api/gtfs',
	gtfsServiceUrl: 'https://api.zet.hr/TimetableService.Api/api/gtfs',
	newsProxyServiceUrl: 'https://api.zet.hr/NewsProxyService.Api/api/newsfeed',
	accountServiceUrl: 'https://api.zet.hr/AccountService.Api/api/account',
	ticketServiceUrl: 'https://api.zet.hr/TicketService.Api/api/v1/open/tickets',
};

export const headers = {
	'accept': 'application/json, text/plain, */*',
	'appuid': 'ZET.Mobile',
	'Content-Type': 'application/json',
	'language': 'hr',
	'User-Agent': 'okhttp/4.9.2',
	'x-tenant': 'KingICT_ZET_Public',
};
