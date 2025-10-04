import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { createResponse, handleOptionsRequest, logger } from './utils/common'
import { handleGetRequest } from './handlers/get'
import { handlePostRequest } from './handlers/post'
import { handleDeleteRequest } from './handlers/delete'


export const handler = async (
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
    try {
        // Handle OPTIONS
        const optionsResponse = handleOptionsRequest(event)
        if (optionsResponse) {
            return optionsResponse
        }

        const httpMethod = event.httpMethod
        logger.info(`Processing ${httpMethod} request`)

        switch (httpMethod) {
        case 'GET':
            return await handleGetRequest(event)
        case 'POST':
            return await handlePostRequest(event)
        case 'DELETE':
            return await handleDeleteRequest(event)
        default:
            logger.warn(`Unsupported method: ${httpMethod}`)
            return createResponse(event, 400, { error: 'Unsupported method' })
        }
        
    } catch (e: unknown ) {
        // ClientError and general Exception handling combined for simplicity in porting
        logger.exception('ProjectFilesError: Unexpected error processing request.', e)
        // metrics.addMetric('GeneralError', 'Count', 1)
        
        let statusCode = 500
        let errorMessage = 'Internal server error'

        if (e.message.includes('file not found')) {
            statusCode = 404
            errorMessage = 'Project file not found'
        } else if (e.message.includes('ID missing from claims')) {
            statusCode = 403 // Unauthorized/Forbidden
            errorMessage = 'Authentication claims missing or invalid'
        } else if (e.message.includes('limit exceeded')) {
            statusCode = 400
            errorMessage = e.message
        }

        return createResponse(event, statusCode, { error: errorMessage, details: e.message })
    }
}





