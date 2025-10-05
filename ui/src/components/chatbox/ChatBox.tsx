"use client"

import React, { useEffect, useState } from 'react';
import Preloader from '../preloader/Preloader';
import Dashboard from './Dashboard';

const ChatBox = () => {

    const [loading, setLoading] = useState<boolean>(true);
    

    useEffect(() => {
        // Simulate loading time (e.g., fetching data or assets)
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1500); // 1.5 seconds

        return () => clearTimeout(timer);
    }, []);



    if (loading) {
        return <Preloader />;
    }

    /* 

    import {toast} from 'react-toastify';
    
    const [showChat, setShowChat] = useState<boolean>(true);

    const showToast = () => {
        setShowChat(true)
        toast.success("This is a success message!");
    };

    return (
        <div className='background'>
            <div className="shadow">
                hello
            </div>
            <button onClick={showToast}>Show Toast</button>
        </div>
    ) 
    
    */

    return <Dashboard />
}

export default ChatBox