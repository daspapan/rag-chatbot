'use client'

import React, { ChangeEvent, FormEvent, MouseEvent, useEffect, useRef, useState } from 'react'
import { ChatType, CheckedFiles, Project, ProjectFile, QueryData, QueryResult, Response } from '@/types';
import apiClient from '@/utils/api';
import Link from 'next/link';
import { 
    Box,
    Button,
    CircularProgress, 
    Drawer, 
    IconButton, 
    ListItemText, 
    Menu, 
    MenuItem, 
    Paper, 
    Table, 
    TableBody, 
    TableCell, 
    TableContainer, 
    TableHead, 
    TableRow, 
    TableSortLabel, 
    TextField, 
    Typography
} from '@mui/material';
import { toast } from 'react-toastify';


interface ProjectFilesCompProps {
    projectId: string
}

const ProjectFiles = ({projectId}:ProjectFilesCompProps) => {

    const [project, setProject] = useState<Project | null>(null);
    const [isRefreshingFiles, setIsRefreshingFiles] = useState<boolean>(false);
    const [files, setFiles] = useState<ProjectFile[]>([]);
    const [checkedFiles, setCheckedFiles] = useState<CheckedFiles>({});
    const [actionsMenuAnchorEl, setActionsMenuAnchorEl] = useState<HTMLElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const refreshIntervalRef = useRef<number | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [filesOrderBy, setFilesOrderBy] = useState<string>('lastUpdated');
    const [filesOrder, setFilesOrder] = useState<string>('desc');
    const [uploadProgress, setUploadProgress] = useState<number>(0)
    const [fileSearchTerm, setFileSearchTerm] = useState<string>('');

    const handleFileSearch = (e:ChangeEvent<HTMLInputElement>) => {
        setFileSearchTerm(e.target.value);
    };

    const filterFiles = (data) => {
        if (!fileSearchTerm) return data;

        return data.filter(file => {
            const filenameMatch = file.filename.toLowerCase().includes(fileSearchTerm.toLowerCase());
            const fileExtension = file.filename.split('.').pop().toLowerCase();
            const typeMatch = fileExtension.toLowerCase().includes(fileSearchTerm.toLowerCase());

            return filenameMatch || typeMatch;
        });
    };

    useEffect(() => {
        // Load project details and files when component mounts or projectId changes
        const loadData = async () => {
            await loadProjectDetails();
            await loadProjectFiles();
        };

        loadData();

        return () => {
            /* if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            } */
            if (refreshIntervalRef.current !== null) {
                window.clearInterval(refreshIntervalRef.current);
            }
        };
    }, [projectId]);

    const startInterval = () => {
        if (refreshIntervalRef.current !== null) return; // Prevent multiple intervals
        refreshIntervalRef.current = window.setInterval(() => {
            // Your interval logic here
            console.log('Interval running');
        }, 1000);
    };

    const stopInterval = () => {
        if (refreshIntervalRef.current) {
            window.clearInterval(refreshIntervalRef.current);
            refreshIntervalRef.current = null;
        }
    };


    const loadProjectDetails = async () => {
        try {
            const projectData = await apiClient.getProject(projectId);
            setProject(projectData);
            return projectData;
        } catch (error) {
            console.error('Error loading project details:', error);
            return null;
        }
    };

    const loadProjectFiles = async () => {
        try {
            setIsRefreshingFiles(true);
            const filesData = await apiClient.getProjectFiles(projectId);
            setFiles(filesData);

            // Reset checked files when loading new files
            setCheckedFiles({});
            return filesData;
        } catch (error) {
            console.error('Error loading project files:', error);
            return [];
        } finally {
            setIsRefreshingFiles(false);
        }
    };


    const handleBulkFileDelete = async () => {
        const selectedFileIds = Object.keys(checkedFiles).filter(id => checkedFiles[id]);

        if (selectedFileIds.length === 0) {
            toast.warn('Please select at least one file to delete.')
            return;
        }

        const isConfirmed = window.confirm('Are you sure you want to delete {0} files.'.replace('{0}', selectedFileIds.length.toString()));

        if (!isConfirmed) {
            return;
        }

        try {
            // Delete each selected file one by one
            for (const fileId of selectedFileIds) {
                await apiClient.deleteProjectFile(projectId, fileId);
            }

            // Reset checked files and reload
            setCheckedFiles({});
            await loadProjectFiles();
        } catch (error) {
            console.error('Error deleting files:', error);
            toast.error(`Error: ${JSON.stringify(error)}`)
        }
    };


    const handleDownload = async (fileId:string, filename:string): Promise<void> => {
        try {
            const data = await apiClient.getFileDownloadUrl(projectId, fileId);

            // Create a link element and trigger download directly from the presigned URL
            const link = document.createElement('a');
            link.href = data.downloadUrl;
            link.download = filename; // The Content-Disposition header will handle the actual filename
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();

            // Clean up
            setTimeout(() => {
                document.body.removeChild(link);
            }, 100);

        } catch (err) {
            console.error('Download error:', err);
            toast.error('Failed to download file')
        }
    };


    const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = (event.target.files && event.target.files.length > 0) ? Array.from(event.target.files) : []
        if (selectedFiles.length === 0) return;

        try {
            // Filter out files that already exist
            const existingFilenames = new Set(files.map(file => file.filename.toLowerCase()));
            const newFiles = selectedFiles.filter(file => !existingFilenames.has(file.name.toLowerCase()));

            // If all files were duplicates, show message and return
            if (newFiles.length === 0) {
                toast.warning('All selected files already exist in the data sources. No files were uploaded.')
                event.target.value = ''; // Reset the file input
                return;
            }

            // If some files were duplicates, show message about skipped files
            if (newFiles.length < selectedFiles.length) {
                const skippedCount = selectedFiles.length - newFiles.length;
                toast.info(`${skippedCount} file(s) were skipped because they already exist in the data sources.`)
            }

            setIsUploading(true);
            setUploadProgress(0);

            // Store the current file count before upload
            let totalUploaded = 0;

            // Upload each file sequentially
            for (let i = 0; i < newFiles.length; i++) {
                const file = newFiles[i];

                // First request to get upload URL
                const response = await apiClient.uploadProjectFile(projectId, {
                    filename: file.name,
                    filesize: file.size,
                    filetype: file.type
                });
                // console.log(`[RESPONSE] ${JSON.stringify(response, null, 2)}`)
                const { uploadUrl, fileId } = response;
                console.log(`uploadUrl: ${uploadUrl} | fileId: ${fileId}`)

                // Use XMLHttpRequest for upload with progress tracking
                await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();

                    xhr.upload.addEventListener('progress', (event) => {
                        if (event.lengthComputable) {
                            // Calculate overall progress across all files
                            const fileProgress = (event.loaded / event.total);
                            const overallProgress = ((totalUploaded + fileProgress) / newFiles.length) * 100;
                            setUploadProgress(overallProgress);
                        }
                    });

                    xhr.addEventListener('load', () => {
                        if (xhr.status === 200) {
                            totalUploaded++;
                            // Update progress for completed file
                            const overallProgress = (totalUploaded / newFiles.length) * 100;
                            setUploadProgress(overallProgress);
                            resolve(true);
                        } else {
                            reject(new Error(`Upload failed for ${file.name}`));
                        }
                    });

                    xhr.addEventListener('error', () => {
                        reject(new Error(`Upload failed for ${file.name}`));
                    });

                    xhr.open('PUT', uploadUrl);
                    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
                    xhr.send(file);

                });
            }

            await loadProjectFiles();
            setIsUploading(false);
            setUploadProgress(0);

        } catch (error: any) {

            console.error('Error uploading files:', error);

            // Generic error handler for unexpected errors
            let errorMessage = 'Error uploading files. Please try again.';

            if (error.message) {
                errorMessage = error.message;

                // Try to extract JSON error from message
                const match = error.message.match(/API request failed: \d+ \s*-\s*(\{.*\})/);
                if (match && match[1]) {
                    try {
                        const parsedError = JSON.parse(match[1]);
                        if (parsedError.error) {
                        errorMessage = parsedError.error;
                        }
                    } catch (e) {
                        // Keep original message if parsing fails
                    }
                }
            }

            toast.error(errorMessage)

            setUploadProgress(0);
            setIsUploading(false);
        } finally {
            event.target.value = ''; // Reset the file input
        }
    };


    const handleBulkFileDownload = async () => {
        const selectedFileIds = Object.keys(checkedFiles).filter(id => checkedFiles[id]);

        if (selectedFileIds.length === 0) {
            toast.warn('Please select at least one file to download.')
            return;
        }

        try {
            // Download each selected file
            for (const fileId of selectedFileIds) {
                const file = files.find(f => f.id === fileId);
                if (file) {
                    await handleDownload(fileId, file.filename);
                    // Small delay between downloads to prevent browser issues
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
        } catch (error) {
            console.error('Error downloading files:', error);
            toast.error(`Error: ${JSON.stringify(error, null, 2)}`)
        }
    };


    const handleFileCheckboxChange = (fileId:string) => {
        setCheckedFiles(prev => ({
            ...prev,
            [fileId]: !prev[fileId]
        }));
    };


    const handleSelectAllFiles = (event: ChangeEvent<HTMLInputElement>) => {
        const isChecked = event.target.checked;
        const newCheckedState: CheckedFiles = {};

        files.forEach(file => {
            newCheckedState[file.id] = isChecked;
        });

        setCheckedFiles(newCheckedState);
    };


    const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
    const [query, setQuery] = useState<string>('');
    const [chatMessages, setChatMessages] = useState<ChatType[]>([]);
    const [isQuerying, setIsQuerying] = useState<boolean>(false);
    const chatEndRef = useRef(null);
    const [sessionId, setSessionId] = useState<string | null>(null)

    // Scroll to bottom of chat when new messages are added
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages]);

    // Function to fetch chat history for a specific project
    const fetchChatHistory = async () => {
        try {
            const response: Response = await apiClient.getChatHistory(projectId);
            console.log('[Chat History:]', JSON.stringify(response));
            const data = JSON.parse(response.body)

            let existingSessionId = null;
            if (data && Array.isArray(data.messages) && data.messages.length > 0) {
                const firstMessageWithSessionId = data?.messages?.find(message => message?.sessionId);
                existingSessionId = firstMessageWithSessionId?.sessionId || null;

                // Convert the API message format to our chat message format
                const formattedMessages = data.messages.map(msg => {
                    // Process sources if they exist
                    let formattedSources = [];
                    if (msg.sources && Array.isArray(msg.sources)) {
                        formattedSources = msg.sources.map(source => {
                            const fileId = source.fileId || 'Unknown source';
                            // Find the actual file info from files
                            const fileInfo = files.find(file => file.id === fileId);
                            const displayName = fileInfo ? fileInfo.filename : (source.filename || fileId);

                            return {
                                fileId: fileId,
                                filename: displayName,
                                content: source.content?.substring(0, 150) + '...',
                                fullContent: source.content,
                                fileInfo: fileInfo,
                                expanded: false
                            };
                        });
                    }

                    return {
                        type: msg.type,
                        content: msg.content,
                        timestamp: new Date(msg.timestamp * 1000).toISOString(),
                        // Store the original timestamp for sorting
                        originalTimestamp: msg.timestamp,
                        // Add sources if available
                        ...(msg.sources && {
                            sources: formattedSources,
                            showSources: false
                        })
                    };
                });

                // Sort messages by timestamp from earliest to latest
                formattedMessages.sort((a, b) => a.originalTimestamp - b.originalTimestamp);

                console.log('Formatted messages:', formattedMessages);

                // Add a system message at the beginning
                const systemMessage = {
                    type: 'system',
                    content: "Continuing your previous conversation. You can start a new chat using the 'New Chat' button.",
                    timestamp: new Date().toISOString()
                };

                setChatMessages([systemMessage, ...formattedMessages]);
            }
            // check if existingSessionId is not null and then assign
            if (existingSessionId) {
                console.log('Found existing session:', existingSessionId);
                setSessionId(existingSessionId);
            }

            return existingSessionId;
        } catch (error) {
            console.error('Error fetching chat history:', error);
            return null;
        }
    };

    const toggleChatPanel = () => {
            // Check knowledge base status when opening the chat panel
        if (!isChatOpen) {
            setIsQuerying(true);

            // First load chat history, then check document status
            fetchChatHistory()
                .then(existingSession => {
                    // After loading history, add a system message about checking documents
                    setChatMessages(prev => {
                        // If we have history, append the checking message
                        if (prev.length > 0) {
                            return [...prev, {
                                type: 'system',
                                content: "I'm checking that all project documents are prepared for chat...",
                                timestamp: new Date().toISOString()
                            }];
                        } else {
                            // If no history, just show the checking message
                            return [{
                                type: 'system',
                                content: "I'm checking that all project documents are prepared for chat. This may take a few minutes before you can ask questions.",
                                timestamp: new Date().toISOString()
                            }];
                        }
                    });

                    // Now check knowledge base status
                    return checkKnowledgeBaseStatus().then(statusResponse => {
                        return {
                            ...statusResponse,
                            existingSession: existingSession !== null,
                            hasHistory: existingSession !== null
                        };
                    });
                })
                .then(response => {
                    // Update only the last message based on document status
                    setChatMessages(prev => {
                        const updatedMessages = [...prev];
                        const lastIndex = updatedMessages.length - 1;

                        // Replace only the last system message (the checking message)
                        if (response.itemStatus === 'ingesting') {
                            updatedMessages[lastIndex] = {
                                type: 'system',
                                content: "I'm preparing your documents for chat. This may take a few minutes before you can ask questions.",
                                timestamp: new Date().toISOString()
                            };
                        } else if (response.itemStatus === 'not_ingested' || response.itemStatus === 'no_files') {
                            updatedMessages[lastIndex] = {
                                type: 'system',
                                content: "I'll need to prepare your documents before you can chat with them. This will start automatically when you ask your first question.",
                                timestamp: new Date().toISOString()
                            };
                        } else if (response.itemStatus === 'ready') {
                            if (response.hasHistory) {
                                updatedMessages[lastIndex] = {
                                    type: 'system',
                                    content: "Your documents are ready. You can continue your conversation.",
                                    timestamp: new Date().toISOString()
                                };
                            } else {
                                updatedMessages[lastIndex] = {
                                    type: 'system',
                                    content: "Your documents are ready. What would you like to know about this project?",
                                    timestamp: new Date().toISOString()
                                };
                            }
                        }

                        return updatedMessages;
                    });
                })
                .catch(error => {
                    setChatMessages(prev => {
                        // If we have existing messages, replace only the last system message with an error
                        if (prev.length > 1) {
                            // Find the last system message that's about checking documents
                            const lastSystemMsgIndex = prev.map(msg =>
                                    msg.type === 'system' &&
                                    (msg.content.includes('checking') || msg.content.includes('preparing'))
                                ).lastIndexOf(true);

                            if (lastSystemMsgIndex !== -1) {
                                // Replace only that message
                                const updatedMessages = [...prev];
                                updatedMessages[lastSystemMsgIndex] = {
                                    type: 'error',
                                    content: `Error checking knowledge base status: ${error.message}`,
                                    timestamp: new Date().toISOString()
                                };
                                return updatedMessages;
                            } else {
                                // If no system message found, append the error
                                return [...prev, {
                                    type: 'error',
                                    content: `Error checking knowledge base status: ${error.message}`,
                                    timestamp: new Date().toISOString()
                                }];
                            }
                        } else {
                            // If only one message (the system message we added), replace it
                            return [{
                                type: 'error',
                                content: `Error checking knowledge base status: ${error.message}`,
                                timestamp: new Date().toISOString()
                            }];
                        }
                    });
                })
                .finally(() => {
                    setIsQuerying(false);
                });
        }
        setIsChatOpen(!isChatOpen);
    };

    // Check knowledge base status before querying
    const checkKnowledgeBaseStatus = async () => {
        try {
            const data = await apiClient.checkKnowledgeBaseStatus({
                projectId: projectId
            });
            console.log('Knowledge base status:', data);
            return data;
        } catch (error) {
            console.error('Error checking knowledge base status:', error);
            throw error;
        }
    };


    // Handle chat query submission
    const handleQuerySubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!query.trim()) return;

        // Add user message to chat
        const userMessage:ChatType = {
            type: 'user',
            content: query,
            timestamp: new Date().toISOString()
        };

        setChatMessages(prev => [...prev, userMessage]);
        setIsQuerying(true);

        const payload : QueryData = {
            projectId: projectId,
            query: query,
            sessionId: sessionId || '' // Include sessionId if available
        }

        try {
            const data: QueryResult = await apiClient.queryKnowledgeBase(payload);

            console.log('Knowledge base response:', JSON.stringify(data, null, 2));

            // Check if response contains a sessionId and store it
            if (data?.results?.sessionId) {
                console.log('Setting session ID:', data.results.sessionId);
                setSessionId(data.results.sessionId);
            }

            // Extract sources from citations if available
            let sources: any[] = [];
            if (data?.results?.citations) {
                sources = data.results.citations.flatMap(citation =>
                    citation.retrievedReferences.map(reference => {
                        // Extract metadata
                        const metadata = reference.metadata || {};
                        const fileId = metadata.fileId || 'Unknown source';

                        // Find the actual file info from files
                        const fileInfo = files.find(file => file.id === fileId);
                        const displayName = fileInfo ? fileInfo.filename : fileId;

                        return {
                            fileId: fileId,
                            filename: displayName,
                            // Include additional metadata that might be useful
                            userId: metadata.userId,
                            projectId: metadata.projectId,
                            content: reference.content?.text?.substring(0, 150) + '...', // First 150 chars of content
                            fullContent: reference.content?.text, // Store the full content
                            // Store file info for download link
                            fileInfo: fileInfo,
                            expanded: false // Default to collapsed state
                        };
                    })
                );
            }

            // Add AI response to chat
            const aiMessage = {
                type: 'ai',
                content: (data?.results?.output?.text) || 'No response from knowledge base',
                timestamp: new Date().toISOString(),
                sources: sources,
                showSources: false // Default to collapsed sources
            };

            setChatMessages(prev => [...prev, aiMessage]);
            setQuery('');
        } catch (error) {
            console.error('Error querying knowledge base:', error);

            // Check for rate limit error (429)
            let errorContent = `Error: ${JSON.stringify(error, null, 2)}`;
        
            // Try to extract JSON error from message
            const match = error.message.match(/API request failed: 429\s*-\s*(\{.*\})/);
            if (match && match[1]) {
                try {
                    const parsedError = JSON.parse(match[1]);
                    if (parsedError.error === "Rate limit exceeded") {
                        // Special handling for rate limit error
                        errorContent = (
                            <div className="rate-limit-error">
                                <h4 style={{ margin: '0 0 8px 0', color: '#d32f2f' }}>Rate Limit Exceeded</h4>
                                <p style={{ margin: '0 0 8px 0' }}>
                                You have reached your maximum number of queries allowed per minute.
                                </p>
                                <p style={{ margin: '0', fontSize: '0.9em' }}>
                                Please wait a moment before trying again.
                                </p>
                            </div>
                        );
                    }
                } catch (e) {
                    // Keep original message if parsing fails
                    console.error('Error parsing error message:', e);
                }
            }

            // Add error message to chat
            const errorMessage = {
                type: 'error',
                content: errorContent,
                timestamp: new Date().toISOString()
            };

            setChatMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsQuerying(false);
        }
    };

    // Function to handle starting a new chat session with confirmation
    const handleNewChatClick = () => {
        // Show confirmation dialog
        const isConfirmed = window.confirm(
            'Are you sure you want to start a new chat? This will clear all current conversation history.'
        );

        // If user confirms, start new chat session
        if (isConfirmed) {
            startNewChatSession();
        }
    };

    // Function to start a new chat session
    const startNewChatSession = async () => {
        try {
            // Delete chat history if we have a session ID
            if (sessionId) {
                await apiClient.deleteChatHistory(sessionId);
                console.log('Chat history deleted successfully');
            }

            // Reset session ID and chat messages
            setSessionId(null);
            setChatMessages([{
                type: 'system',
                content: 'Started a new conversation. Previous context has been cleared.',
                timestamp: new Date().toISOString()
            }]);
        } catch (error) {
            console.error('Error deleting chat history:', error);

            // Still reset the UI even if the API call fails
            setSessionId(null);

            setChatMessages([{
                type: 'system',
                content: 'Started a new conversation. Previous context has been cleared.',
                timestamp: new Date().toISOString()
            }, {
                type: 'error',
                content: `Error clearing previous chat history: ${JSON.stringify(error, null, 2)}`,
                timestamp: new Date().toISOString()
            }]);
        }
    };

    // Function to download chat history as markdown
    const handleDownloadChat = () => {
        try {
            // Generate markdown content
            let markdownContent = `# Chat History for ${project?.name || 'Project'}\n\n`;
            markdownContent += `Generated on ${new Date().toLocaleString()}\n\n`;

            // Add each message to the markdown
            chatMessages.forEach((message, index) => {
                // Skip system messages in the download
                if (message.type === 'system') return;

                const timestamp = new Date(message.timestamp).toLocaleString();

                if (message.type === 'user') {
                    markdownContent += `## User (${timestamp})\n\n${message.content}\n\n`;
                } else if (message.type === 'ai') {
                    markdownContent += `## Assistant (${timestamp})\n\n${message.content}\n\n`;

                    // Add sources if available
                    if (message.sources && message.sources.length > 0) {
                        markdownContent += `### Sources\n\n`;
                        message.sources.forEach((source, idx) => {
                            markdownContent += `${idx + 1}. **Document**: ${source.filename}\n`;
                            if (source.fullContent) {
                                markdownContent += `   **Content**: ${source.fullContent}\n\n`;
                            }
                        });
                        markdownContent += '\n';
                    }
                } else if (message.type === 'error') {
                    markdownContent += `## Error (${timestamp})\n\n${message.content}\n\n`;
                }
            });

            // Create a blob and download
            const blob = new Blob([markdownContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${project?.name || 'chat-history'}-chat.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading chat history:', error);
            toast.error('Failed to download chat history')
        }
    };

    function getTimeElapsed(epochSeconds:number) {
        const now = new Date();
        // Convert seconds to milliseconds by multiplying by 1000
        const givenDate = new Date(Number(epochSeconds) * 1000);

        // Calculate the time difference in milliseconds
        const timeDiff = now.getTime() - givenDate.getTime();

        // Convert to minutes, hours, and days
        const minutes = Math.floor(timeDiff / (1000 * 60));
        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

        // Format the output based on elapsed time
        if (days > 0) {
            // Show days if more than 24 hours have passed
            return `${days} day${days !== 1 ? 's' : ''} ago`;
        } else if (hours > 0) {
            // Show hours if more than 59 minutes have passed
            return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        } else if (minutes > 0) {
            // Show minutes if less than 60 minutes
            return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        } else {
            return 'Just now';
        }
    }

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    if (!project) {
        return <div>{'Loading...'}</div>;
    }

    const handleFilesRequestSort = (property: string) => {
        const isAsc = filesOrderBy === property && filesOrder === 'asc';
        setFilesOrder(isAsc ? 'desc' : 'asc');
        setFilesOrderBy(property);
    };

    const sortFilesData = (data:ProjectFile[], orderBy:string, order:string) => {
        return [...data].sort((a, b) => {
            if (orderBy === 'lastUpdated') {
                return order === 'asc'
                ? a[orderBy] - b[orderBy]
                : b[orderBy] - a[orderBy];
            }
            if (orderBy === 'fileSize') {
                // Compare the raw numeric size values
                return order === 'asc'
                ? a.fileSize - b.fileSize
                : b.fileSize - a.fileSize;
            }
            if (orderBy === 'fileType') {
                // Get file types for comparison
                const getFileType = (filename:string) => {
                    return filename.split('.').pop().toLowerCase();
                };

                const typeA = getFileType(a.filename);
                const typeB = getFileType(b.filename);

                return order === 'asc'
                ? typeA.localeCompare(typeB)
                : typeB.localeCompare(typeA);
            }
            return order === 'asc'
                ? a[orderBy].localeCompare(b[orderBy])
                : b[orderBy].localeCompare(a[orderBy]);
        });
    };

    const sortedFiles = sortFilesData(files, filesOrderBy, filesOrder);


    return (
        <div className="p-20">
            <div className="mx-auto">
                <nav className="mb-[20px] text-[14px]">
                    <Link className='text-[#0066cc] no-underline hover:underline' href="/">Sample</Link> 
                    &gt; 
                    <Link className='text-[#0066cc] no-underline hover:underline' href="/">Projects</Link> &gt; {project?.name}
                </nav>

                <div className="mt-0 border-[1px] border-[solid] border-[#ddd] rounded-[8px] p-[20px] [box-shadow:0_2px_4px_rgba(0,_0,_0,_0.1)]">
                    <div className="flex justify-between items-center mb-[5px]">
                        <h3>{project?.name} - Files ({files.length})</h3>
                        <div className="flex items-center gap-[10px]">
                            <button
                                onClick={toggleChatPanel}
                                className="h-4 flex justify-center align-middle m-5"
                                title={'Ask questions about this project'}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="white" />
                                </svg>
                                {'Chat'}
                            </button>
                            <button
                                onClick={loadProjectFiles}
                                disabled={isUploading || isRefreshingFiles}
                                className='flex h-[36px] items-center justify-center px-[10px] py-[0] mr-[5px] relative'
                            >
                                {isRefreshingFiles ? (
                                    <CircularProgress size={20} thickness={5} style={{ color: '#0066cc' }} />
                                ) : (
                                    <CircularProgress size={15} style={{ color: '#FF0000' }}/>
                                )}
                            </button>
                            <button
                                className="flex items-center gap-[5px] text-[white] border-[none] px-4 py-2 rounded-[4px] cursor-pointer text-[1rem] [transition:background-color_0.2s] mr-[5px] h-[36px]"
                                onClick={(e: MouseEvent<HTMLButtonElement>) => setActionsMenuAnchorEl(e.currentTarget.textContent)}
                                disabled={isUploading || isRefreshingFiles || Object.keys(checkedFiles).filter(id => checkedFiles[id]).length === 0}
                            >
                                {'File Actions'}
                                <span style={{ fontSize: '10px', marginTop: '2px' }}>
                                    {Boolean(actionsMenuAnchorEl) ? '▲' : '▼'}
                                </span>
                            </button>
                            <Menu
                                anchorEl={actionsMenuAnchorEl}
                                open={Boolean(actionsMenuAnchorEl)}
                                onClose={() => setActionsMenuAnchorEl(null)}
                            >
                                <MenuItem onClick={() => {
                                    handleBulkFileDownload();
                                    setActionsMenuAnchorEl(null);
                                }}>
                                    <ListItemText primary="Download" />
                                </MenuItem>
                                <MenuItem onClick={() => {
                                    handleBulkFileDelete();
                                    setActionsMenuAnchorEl(null);
                                }}>
                                    <ListItemText primary="Remove" />
                                </MenuItem>
                            </Menu>

                            <input
                                type="file"
                                multiple
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={handleFileUpload}
                                disabled={isUploading || isRefreshingFiles}
                            />

                            <button
                                // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                                onClick={() => {fileInputRef.current && fileInputRef.current.click()}}
                                className="btn-primary"
                                disabled={isUploading || isRefreshingFiles}
                                style={{
                                cursor: (isUploading || isRefreshingFiles) ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {isUploading ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </div>

                    {isUploading && (
                        <div className="w-full h-[5px] bg-[#eee] rounded-[3px] mb-[15px]">
                            <div
                                className="h-full bg-[#4caf50] rounded-[3px] [transition:width_0.3s_ease]"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                    )}


                    <div className="mt-[5px 0] mb-[0px 0] w-2/5 border-[1px] border-[solid] border-[#ddd] rounded-[8px]">
                        <input
                            type="text"
                            placeholder={'Find files'}
                            value={fileSearchTerm}
                            onChange={handleFileSearch}
                        />
                    </div>


                    <TableContainer component={Paper}>
                        <Table sx={{
                            '& .MuiTableCell-root': {
                                borderLeft: 'none',
                                borderRight: 'none'
                            }
                        }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell padding="checkbox">
                                        <input
                                            type="checkbox"
                                            onChange={handleSelectAllFiles}
                                            checked={files.length > 0 && Object.keys(checkedFiles).length === files.length &&
                                                Object.values(checkedFiles).every(Boolean)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={filesOrderBy === 'filename'}
                                            direction={filesOrderBy === 'filename' ? filesOrder : 'asc'}
                                            onClick={() => handleFilesRequestSort('filename')}
                                        >
                                            {'File Name'}
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={filesOrderBy === 'fileSize'}
                                            direction={filesOrderBy === 'fileSize' ? filesOrder : 'asc'}
                                            onClick={() => handleFilesRequestSort('fileSize')}
                                        >
                                            {'Size'}
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={filesOrderBy === 'lastUpdated'}
                                            direction={filesOrderBy === 'lastUpdated' ? filesOrder : 'asc'}
                                            onClick={() => handleFilesRequestSort('lastUpdated')}
                                        >
                                        {'Update Date'}
                                        </TableSortLabel>
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filterFiles(sortedFiles).map((file:ProjectFile) => (
                                    <TableRow key={file.id}>

                                        <TableCell padding="checkbox">
                                            <input
                                                type="checkbox"
                                                checked={!!checkedFiles[file.id]}
                                                onChange={() => handleFileCheckboxChange(file.id)}
                                            />
                                        </TableCell>

                                        <TableCell>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span>{file.filename}</span>
                                                <button
                                                    onClick={() => handleDownload(file.id, file.filename)}
                                                    className="download-button"
                                                    title="Download file"
                                                >

                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M12 16L7 11H17L12 16Z" fill="#0066cc" />
                                                        <path d="M12 4V12" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" />
                                                        <path d="M4 20H20" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" />
                                                        <path d="M4 20V16" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" />
                                                        <path d="M20 20V16" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" />
                                                    </svg>

                                                </button>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            {formatFileSize(file.filesize)}
                                        </TableCell>

                                        <TableCell>
                                            {getTimeElapsed(file.createdAt)}
                                        </TableCell>

                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </div>
            </div>


            {/* Chat Panel Drawer */}
            <Drawer
                anchor="right"
                open={isChatOpen}
                onClose={toggleChatPanel}
                sx={{
                    '& .MuiDrawer-paper': {
                        width: { xs: '100%', sm: '45%' },
                        maxWidth: '100%',
                        display: 'flex',
                        flexDirection: 'column'
                    },
                }}
            >
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    width: '100%'
                }}>

                    {/* Chat Header */}
                    <Box sx={{
                        p: 2,
                        borderBottom: '1px solid #e0e0e0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        bgcolor: '#f5f5f5'
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="h6">
                                {'Ask questions about this project'}
                            </Typography>

                            {chatMessages.length > 0 && (
                                <IconButton
                                    color="primary"
                                    onClick={handleDownloadChat}
                                    title={'Download chat history'}
                                    size="small"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 16L7 11H17L12 16Z" fill="#0066cc" />
                                        <path d="M12 4V12" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" />
                                        <path d="M4 20H20" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" />
                                        <path d="M4 20V16" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" />
                                        <path d="M20 20V16" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                </IconButton>
                            )}
                            {sessionId && (
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={handleNewChatClick}
                                    title="Start a new conversation"
                                >
                                    {'New Chat'}
                                </Button>
                            )}
                        </Box>
                        <IconButton onClick={toggleChatPanel}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="#000000" />
                            </svg>
                        </IconButton>
                    </Box>

                    {/* Chat Messages */}
                    <Box sx={{
                        flexGrow: 1,
                        p: 2,
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        maxHeight: 'calc(100vh - 180px)', // Limit height to prevent overflow
                        minHeight: '300px' // Ensure minimum height for better UX
                    }}>
                        {chatMessages.length === 0 ? (
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                color: 'text.secondary',
                                textAlign: 'center',
                                p: 3
                            }}>
                                <Typography variant="body1" gutterBottom>
                                    {'Ask questions about this files'}
                                </Typography>
                                <Typography variant="body2">
                                    {'For example: "What are the key topics in these documents?" or "Summarize the content of these files"'}
                                </Typography>
                            </Box>
                        ) : (
                            <Box sx={{ width: '100%' }}>
                                {chatMessages.map((message, index) => (
                                    <Paper
                                        key={index}
                                        elevation={0}
                                        sx={{
                                            p: 2,
                                            maxWidth: '90%',
                                            marginLeft: message.type === 'user' ? 'auto' : '0',
                                            marginRight: message.type === 'user' ? '0' : 'auto',
                                            marginBottom: 2,
                                            bgcolor: message.type === 'user' ? '#e3f2fd' :
                                                message.type === 'error' ? '#ffebee' :
                                                message.type === 'system' ? '#f0f4c3' : '#f5f5f5',
                                            borderRadius: 2,
                                            wordBreak: 'break-word' // Ensure long words don't overflow
                                        }}
                                    >
                                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                            {message.content}
                                        </Typography>

                                        {/* Show sources if available */}
                                        {message.sources && message.sources.length > 0 && (

                                            <Box sx={{ mt: 1, fontSize: '0.85rem', color: 'text.secondary' }}>
                                                <Box
                                                    onClick={() => {
                                                        const updatedMessages = [...chatMessages];
                                                        const messageToUpdate = updatedMessages[index];
                                                        messageToUpdate.showSources = !messageToUpdate.showSources;
                                                        setChatMessages(updatedMessages);
                                                    }}
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        cursor: 'pointer',
                                                        userSelect: 'none',
                                                        '&:hover': { color: 'primary.main' }
                                                    }}
                                                >
                                                    <Typography variant="caption" sx={{ fontWeight: 'bold', mr: 0.5 }}>
                                                        {'Sources'} ({message.sources.length})
                                                    </Typography>

                                                    {message.showSources ? '▼' : '►'}
                                                    
                                                </Box>

                                                {message.showSources && (
                                                    <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                                                        {message.sources.map((source, idx) => (
                                                            <li key={idx}>
                                                                <Typography variant="caption" sx={{ display: 'block' }}>
                                                                    {/* Display filename */}
                                                                    <strong>{'Document'}:</strong>{' '}
                                                                    {source.filename}

                                                                    {/* Show preview of content if available */}
                                                                    {source.content && (
                                                                        <Box component="span" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic', color: 'text.disabled' }}>
                                                                            {source.expanded ? source.fullContent : source.content}
                                                                            {source.fullContent && source.fullContent.length > 150 && (
                                                                                <Button
                                                                                    size="small"
                                                                                    sx={{ ml: 1, minWidth: 'auto', p: '2px 5px', fontSize: '0.7rem' }}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        const updatedMessages = [...chatMessages];
                                                                                        const messageToUpdate = updatedMessages[index];
                                                                                        const sourceToUpdate = messageToUpdate.sources[idx];
                                                                                        sourceToUpdate.expanded = !sourceToUpdate.expanded;
                                                                                        setChatMessages(updatedMessages);
                                                                                    }}
                                                                                >
                                                                                    {source.expanded ? 'Show Less' : 'Show More'}
                                                                                </Button>
                                                                            )}
                                                                        </Box>
                                                                    )}
                                                                </Typography>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </Box>
                                        )}
                                    </Paper>
                                ))}
                                <div ref={chatEndRef} />
                            </Box>
                        )}
                    </Box>

                    {/* Chat Input */}
                    <Box sx={{
                        p: 2,
                        borderTop: '1px solid #e0e0e0',
                        bgcolor: '#f5f5f5'
                    }}>
                        <form onSubmit={handleQuerySubmit} style={{ display: 'flex', gap: '8px' }}>
                            <TextField
                                fullWidth
                                variant="outlined"
                                placeholder={'Ask a question about this project...'}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                disabled={isQuerying}
                                size="small"
                                sx={{ bgcolor: '#ffffff' }}
                            />
                            <Button
                                type="submit"
                                variant="contained"
                                color="primary"
                                disabled={isQuerying || !query.trim()}
                                endIcon={isQuerying ? (
                                        <CircularProgress size={20} color="inherit" /> 
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" fill="white" />
                                        </svg>
                                    )
                                }
                            >
                                {isQuerying ? 'Asking' : 'Ask'}
                            </Button>
                        </form>
                    </Box>
                </Box>
            </Drawer>
        </div>
    )
}

export default ProjectFiles