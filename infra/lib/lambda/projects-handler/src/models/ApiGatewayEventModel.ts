// Simplified API Gateway event structure for HTTP requests
export interface ApiGatewayEvent {
    httpMethod: 'GET' | 'POST' | 'DELETE' | 'OPTIONS';
    body: string | null;
    pathParameters?: { id?: string };
    headers: { [key: string]: string | undefined };
    requestContext: {
        authorizer?: {
            claims?: {
                'cognito:username'?: string;
                'custom:tenantId'?: string;
            };
        };
    };
}