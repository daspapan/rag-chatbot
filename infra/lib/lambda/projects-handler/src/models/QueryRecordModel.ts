// DynamoDB Query Rate Limit item structure
export interface QueryRecord {
    tenantId: string;
    timestamp: number;
    ttl: number;
}