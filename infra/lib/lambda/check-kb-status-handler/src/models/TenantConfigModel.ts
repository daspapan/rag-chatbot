

// Tenant configuration structure
export interface TenantConfig {
    Id: string;
    QueryRate: number;
    MaxFiles: number;
    FilesTTLHours: number;
    // Add other tenant properties as needed
}