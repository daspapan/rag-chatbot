import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { 
    createResponse, 
    handleOptionsRequest,
    getUserTenantFromClaims,
    logger,
    handleClientError,
    handleGeneralException
} from './utils/common'
import { handleQuery } from './handles/query'
import { handleDeleteSession } from './handles/deleteSession'
import { handleGetSession } from './handles/getSession'

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {

    console.log('[Received event]', JSON.stringify(event, null, 2))

    try {

        const optionsResponse = handleOptionsRequest(event)
        if (optionsResponse) {
            return optionsResponse
        }

        const { userId, tenantId } = getUserTenantFromClaims(event)
        
        const path = event.path
        const httpMethod = event.httpMethod
        
        // Extract project_id from path parameters if available
        const path_params = event.pathParameters || {}
        const project_id = path_params.id || ''
        
        if (path.endsWith('/knowledge-base/query') && httpMethod === 'POST') {
            return await handleQuery(event, userId, tenantId)
        } else if (path.includes('/knowledge-base/history/') && httpMethod === 'GET' && project_id) {
            return await handleGetSession(event, userId, tenantId, project_id)
        } else if (path.includes('/knowledge-base/history/') && httpMethod === 'DELETE' && project_id) {
            return await handleDeleteSession(event, userId, tenantId, project_id)
        } else {
            logger.warn(`Unsupported path or method: ${path}, ${httpMethod}`)
            return createResponse(event, 400, { error: 'Unsupported operation' })
        }
        
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // Handle common errors and AWS ClientErrors
        if (error.message.includes('ID missing from claims')) {
            return createResponse(event, 403, { error: 'Authentication claims missing or invalid' })
        }
        if (error.name && error.name.endsWith('Exception')) {
            return handleClientError(error, event)
        }
        return handleGeneralException(error, event, 'ProcessingError')
    }
    
}





