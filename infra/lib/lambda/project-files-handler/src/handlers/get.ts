import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { createResponse, getUserTenantFromClaims, logger } from '../utils/common'
import { getProjectFile, listProjectFilesByProjectId } from '../services/ProjectFiles'
import { generatePresignedUrlForDownload } from '../services/S3Service'


export const handleGetRequest = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

    logger.info(`Handle Get Request: ${JSON.stringify(event, null, 2)}`)

    const pathParameters = event.pathParameters || {}
    
    const { tenantId } = getUserTenantFromClaims(event)

    const id = decodeURIComponent(pathParameters.id || '')

    if ('id' in pathParameters) {
        // GET /files/{id} - Get single file
        const item = await getProjectFile(tenantId, id)
        if (!item) {
            return createResponse(event, 404, { error: 'Project file not found' })
        }
        return createResponse(event, 200, item)

    } else if ('projectId' in pathParameters) {
        // GET /files/project/{projectId} - List files by project
        const projectId = decodeURIComponent(pathParameters.projectId || '')
        const files = await listProjectFilesByProjectId(tenantId, projectId)
        return createResponse(event, 200, files)
        
    } else if ('downloadId' in pathParameters) {
        // GET /files/download/{downloadId} - Handle download request
        const id = decodeURIComponent(pathParameters.downloadId || '')
        const item = await getProjectFile(tenantId, id)
        
        if (!item) {
            return createResponse(event, 404, { error: 'Project file not found' })
        }
        
        const downloadUrl = await generatePresignedUrlForDownload(item.bucket, item.s3Key, item.filename)
        
        return createResponse(event, 200, { downloadUrl })
    }
    
    return createResponse(event, 404, { error: 'Method not found.' })


}