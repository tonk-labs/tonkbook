export interface ApiService {
  prefix: string; // The route prefix (e.g., "weather")
  baseUrl: string; // The actual API base URL
  requiresAuth?: boolean; // Whether authentication is needed
  authType?: "bearer" | "apikey" | "basic" | "query"; // Authentication type
  authHeaderName?: string; // Header name for auth (e.g., "Authorization" or "X-API-Key")
  authEnvVar?: string; // API key or auth secret
  authQueryParamName?: string; // If using query auth type, the corresponding query param
}

// Register all your services here
export const apiServices: ApiService[] = [
  {
    prefix: "brave-search",
    baseUrl: "https://api.search.brave.com",
    requiresAuth: true,
    authType: "apikey",
    authHeaderName: "X-Subscription-Token",
    authEnvVar: "BRAVE_SEARCH_API_KEY",
  },
];
