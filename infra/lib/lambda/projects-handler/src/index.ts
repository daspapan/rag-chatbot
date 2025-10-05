import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { v4 as uuidv4 } from 'uuid'
import { createResponse } from './utils/common'
import { ProjectService } from './services/projectService'


const service = new ProjectService()

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {

    console.log('[Received event]', JSON.stringify(event, null, 2))

    try {

        const id = uuidv4()
        const method = event.httpMethod
        const tenantId = 'tenant1' // extract from claims in real app
        const userId = 'user1' // `demo-user-${id}`
        const createdAt = Date.now() as number

        if (method === 'GET') {
            if (event.pathParameters?.id) {
                const item = await service.getProject(tenantId, event.pathParameters.id)
                if (!item) return createResponse(event, 404, { error: 'Project not found' })
                return createResponse(event, 200, item)
            }
            const items = await service.listProjects(tenantId)
            return createResponse(event, 200, items)
        }

        if (method === 'POST') {
            const body = JSON.parse(event.body ?? '{}')
            const newProject = {
                ...body,
                id,
                userId,
                tenantId,
                createdAt,
            }
            const created = await service.createProject(newProject)
            return createResponse(event, 201, created)
        }

        if (method === 'DELETE') {
            if (!event.pathParameters?.id) {
                return createResponse(event, 400, { message: 'Project ID required', error: 'Project ID required' })
            }
            // await service.deleteProject(tenantId, event.pathParameters.id)
            return createResponse(event, 204, { message: 'No Content'})
        }

        return createResponse(event, 404, { message: 'Method Not Found' })
        
        
    } catch (error) {
        console.error('Users Crud Ops Handler Lambda Error:', error)
        return createResponse(event, 500, { message: 'Internal Server Error', error })
    }
    
}





