import React from 'react'
import ProjectFiles from '@/components/projectFiles/ProjectFiles'

interface ProjectFilesPageProps {
    params: {
        projectId: string
    }
}

const ProjectFilesPage = ({params}:ProjectFilesPageProps) => {

    const {projectId} = params

    return <ProjectFiles projectId={projectId} />
    
}

export default ProjectFilesPage