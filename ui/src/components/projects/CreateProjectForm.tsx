'use client'

import React, { FormEvent, useEffect, useState } from 'react'
import styles from './Projects.module.css'
import apiClient from '@/utils/api'
import { Project, ProjectData } from '@/types'
import { toast } from 'react-toastify'
import TagField from './TagField'
import Link from 'next/link'
import moment from 'moment'


const CreateProjectForm = () => {

    const [projects, setProjects] = useState<Project[]>([]);
    const [newProject, setNewProject] = useState<ProjectData>({ name: '', tags: '' });
    const [checkedProjects, setCheckedProjects] = useState({});
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    // const [actionsMenuAnchorEl, setActionsMenuAnchorEl] = useState(null);

    // const router = useRouter();


    useEffect(() => {
        loadProjects();
    }, []);


    const loadProjects = async () => {
        try {
            setIsRefreshing(true);
            const data = await apiClient.getProjects();
            setProjects(data);
            // Reset checked projects when loading new projects
            setCheckedProjects({});
        } catch (error) {
            console.error('Error loading projects:', error);
            toast.error(`Something went wrong: ${JSON.stringify(error, null, 2)}`)
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleAddTag = (tag: string) => {
        let tagsArray: string[] = []
        if(newProject.tags) tagsArray = newProject.tags.split(', ')
        tagsArray.push(tag)

        setNewProject((prev) => ({
            ...prev,
            tags: tagsArray.join(', '),
        }));
    };

    const handleRemoveTag = (tagToRemove: string) => {
        let tagsArray: string[] = []
        if(newProject.tags){ 
            tagsArray = newProject.tags
                .split(',')
                .map(tag => tag.trim())
                .filter((tag) => tag !== tagToRemove);
            
            setNewProject((prev) => ({
                ...prev,
                tags: tagsArray.join(', '),
            }));
        }        
    };

    const handleCreateProject = async(event: FormEvent<HTMLFormElement>) => {

        event.preventDefault();

        try {

            if(!newProject.tags){
                console.log('Tags are empty.')
                setErrorMessage('Tags are empty.')
                return
            }

            const tagsArray = newProject.tags
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0);

            const createdProject = await apiClient.createProject({
                name: newProject.name,
                tags: tagsArray.join(', ')
            });

            setProjects([...projects, createdProject]);
            setShowCreateModal(false);
            setNewProject({ name: '', tags: '' });

            toast.success(`Create Project "${createdProject.name}" successful`)
            
        } catch (error: unknown) {

            console.error('Error creating project:', error);
            setErrorMessage(`Something went wrong: ${JSON.stringify(error, null, 2)}`)
            toast.error(`Something went wrong: ${JSON.stringify(error, null, 2)}`)
            
        }

    }


    return (
        <>

            {!showCreateModal && (
                <button
                    type='button'
                    className={styles.btnPrimary}
                    onClick={() => setShowCreateModal(true)}
                >
                    Create Project
                </button>
            )}

            {showCreateModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h2>Create Project</h2>
                        <form onSubmit={handleCreateProject}>
                            <div className={styles.formGroup}>
                                <label htmlFor="projectName">Project Name:</label>
                                <input
                                    type="text"
                                    id="projectName"
                                    value={newProject.name}
                                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Tag(s):</label>
                                <TagField
                                    tagStr={newProject.tags || ''}
                                    addTag={handleAddTag}
                                    removeTag={handleRemoveTag}
                                    maxTags={5} // Example: Limit to 5 tags
                                />
                            </div>

                            {errorMessage && (
                                <div style={{ color: 'red', border: '1px solid red', padding: '10px', borderRadius: '5px' }}>
                                    <p>{errorMessage}</p>
                                    <button onClick={() => setErrorMessage(null)}>Dismiss</button>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2 mb-2">
                                <button
                                    type="button"
                                    className={styles.btnPrimaryDelete}
                                    onClick={() => setShowCreateModal(false)}
                                >
                                    Cancel
                                </button>
                                
                                <button 
                                    type="submit" 
                                    className={styles.btnPrimary}>
                                        Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                
            )}



            <hr/>


            <nav className="breadcrumb">
                <Link href="#">Sample</Link> &gt; <Link href="/">Projects</Link>
            </nav>

            <div className="projects-header">
                <h2>Projects ({projects.length})</h2>
            </div>

            <div className=''>
                {projects.map(project => (
                    <div key={project.id}>
                        <div>
                            <input
                                type="checkbox"
                            />
                        </div>
                        <div>
                            <Link
                                href={`/projects/${project.id}`}
                                style={{ cursor: 'pointer', color: '#0066cc' }}
                            >
                                {project.name}
                            </Link>
                        </div>
                        <div>{moment.utc(project.createdAt).local().format('h:mm a')}</div>
                    </div>
                ))}
            </div>


        </>
        
    )
}

export default CreateProjectForm