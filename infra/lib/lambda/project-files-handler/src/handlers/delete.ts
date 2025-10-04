import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { createResponse, getUserTenantFromClaims, logger } from '../utils/common'
import { deleteProjectFile } from '../services/ProjectFiles'


export const handleDeleteRequest = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

    logger.info(`Handle Delete Request: ${JSON.stringify(event, null, 2)}`)


    const pathParameters = event.pathParameters || {}
    if (!('id' in pathParameters)) {
        logger.warn('Project file ID is missing in delete request')
        return createResponse(event, 400, { message: 'Project file ID is required' })
    }
    
    const { tenantId } = getUserTenantFromClaims(event) // Throws if claims are missing
    const id = decodeURIComponent(pathParameters.id || '')
    
    await deleteProjectFile(tenantId, id)
    
    return createResponse(event, 204, '')

}