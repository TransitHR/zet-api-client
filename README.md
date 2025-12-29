# 🚊 ZET API - Zagreb Electric Tram API Client

> TypeScript/Node.js client for **ZET (Zagreb Electric Tram)** public transportation API.
> Access real-time data for routes, trips, stops, vehicles, and service updates.

---

## ✨ Features

- 🚋 Get all **tram and bus routes**
- 🚌 Fetch **real-time trip information**
- ⏱️ Get **trip stop times** with live tracking
- 📰 Access **ZET newsfeed** for service updates
- 🚗 Track **live vehicle positions** with GPS coordinates
- 💾 Built-in **TTL-based caching** for optimal performance
- ✅ **Zod schema validation** for type-safe data
- ⚡ Written in **TypeScript**, ready for Node.js (≥20.2.0)

---

## 📦 Installation

```bash
npm install zet-api
# or
pnpm add zet-api
```

---

## 🚀 Quick Start

```typescript
import { ZetManager } from "zet-api";

// Create manager with infinite cache (default)
const zet = new ZetManager();

// Get all routes (cached)
const routes = await zet.getRoutes();
console.log("Total routes:", routes.length);

// Search for a specific route
const results = await zet.searchRoutes({ query: "Borongaj", limit: 5 });

// Get real-time trips for route 1
const trips = await zet.getRouteTrips({ routeId: 1, daysFromToday: 0 });

// Get stop times with parsed dates
const stopTimes = await zet.getTripStopTimes({
  tripId: "0_5_105_1_10687",
});
console.log("Next stop:", stopTimes.find((s) => !s.isArrived)?.stopName);

// Get live vehicles for route 1
const vehicles = await zet.getLiveVehicles({ routeId: 1 });
console.log("Active vehicles:", vehicles.length);
```

---

## 🎯 Caching Strategy

The `ZetManager` caches static data (routes, stops, news) for performance while always fetching fresh real-time data (trips, vehicles).

### Constructor Options

```typescript
// Infinite cache (never expires) - default
const zet = new ZetManager();

// 5 minute cache
const zet = new ZetManager(5 * 60 * 1000);

// No cache (always fetch fresh)
const zet = new ZetManager(0);
```

### What Gets Cached?

| Data Type  | Cached? | Reason               |
| ---------- | ------- | -------------------- |
| Routes     | ✅ Yes  | Rarely changes       |
| Stops      | ✅ Yes  | Rarely changes       |
| News       | ✅ Yes  | Changes occasionally |
| Trips      | ❌ No   | Real-time data       |
| Stop Times | ❌ No   | Real-time data       |
| Vehicles   | ❌ No   | Real-time positions  |

## 🔐 Authentication

The `ZetManager` includes an integrated `authManager` that handles authentication automatically. Use it to access user-specific features like account information and ePurse balance.

### Basic Usage

```typescript
import { ZetManager } from "zet-api";

const zet = new ZetManager();

// Login once
await zet.authManager.login({
  username: "your-email@example.com",
  password: "your-password",
});

// Access user data (tokens refresh automatically)
const account = await zet.authManager.getAccount();
console.log(`Welcome, ${account.firstName}!`);
console.log(`Balance: ${account.ePurseAmount}€`);

// Check authentication status
if (zet.authManager.isAuthenticated()) {
  console.log("User is logged in");
}

// Logout when done
await zet.authManager.logout();
```

### Register New Account

```typescript
await zet.authManager.register({
  email: "your-email@example.com",
  password: "your-secure-password",
  confirmPassword: "your-secure-password",
});

console.log("✅ Registration successful! Check your email to confirm.");
```

### Long-Running Service Example

```typescript
import { ZetManager } from "zet-api";

const zet = new ZetManager();

// Login once at startup
await zet.authManager.login({
  username: process.env.ZET_EMAIL!,
  password: process.env.ZET_PASSWORD!,
});

console.log("🚀 Service started with automatic auth");

// Poll live data every 30 seconds
setInterval(async () => {
  try {
    // Tokens refresh automatically - no manual management needed
    const trips = await zet.getStopIncomingTrips({ stopId: "317_1" });
    console.log(
      `[${new Date().toLocaleTimeString()}] ${trips.length} incoming trips`
    );
  } catch (error) {
    console.error("Error:", error.message);
  }
}, 30000);
```

---

## 💡 Usage Examples

### Real-Time Trip Tracking

```typescript
const zet = new ZetManager();

// Get route info
const route = await zet.getRouteById(1);
console.log(`Tracking: ${route?.longName}`);

// Get active trips
const trips = await zet.getRouteTrips({ routeId: 1 });
const activeTrips = trips.filter((t) => t.tripStatus === 2);

// Track first active trip
if (activeTrips[0]) {
  const stopTimes = await zet.getTripStopTimes({
    tripId: activeTrips[0].id,
  });

  const nextStops = stopTimes.filter((st) => !st.isArrived);
  console.log("Upcoming stops:");
  nextStops.forEach((stop) => {
    const time = stop.expectedArrivalDateTime.toLocaleTimeString();
    console.log(`  ${stop.stopName} - ${time}`);
  });
}
```

### Live Data Polling

```typescript
const zet = new ZetManager(60000); // 1-minute cache for static data

// Poll route 6 every 10 seconds
setInterval(async () => {
  const liveData = await zet.getLiveTripsForRoute(6);
  console.log(
    `[${new Date().toLocaleTimeString()}] ${liveData.size} active trips`
  );

  for (const [tripId, stopTimes] of liveData.entries()) {
    const nextStop = stopTimes.find((st) => !st.isArrived);
    if (nextStop) {
      console.log(`  Trip ${tripId}: Next stop ${nextStop.stopName}`);
    }
  }
}, 10000);
```

### Search and Filter

```typescript
const zet = new ZetManager();

// Search stops
const stops = await zet.searchStops({
  query: "Glavni kolodvor",
  limit: 5,
});

stops.forEach((stop) => {
  console.log(`${stop.name}`);
  console.log(`  Routes: ${stop.trips.map((t) => t.routeCode).join(", ")}`);
});
```

### Service Updates

```typescript
const zet = new ZetManager();

// Get active news
const newsWithDates = await zet.getNewsfeed();
const now = new Date();

const activeNews = newsWithDates.filter(
  (n) => n.validFrom <= now && n.validTo >= now
);

console.log(`${activeNews.length} active service updates`);
activeNews.forEach((item) => {
  console.log(`📰 ${item.title}`);
  console.log(`   Lines: ${item.lines.join(", ") || "All"}`);
});
```

---

## 📄 License

This project is licensed under the GPL-v3 License. See the [LICENSE](LICENSE) file for details.
