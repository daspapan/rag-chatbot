import React from 'react';

const Preloader = () => {

    return (
        <div className="flex items-center justify-center h-screen bg-gray-50">
            <div className="flex flex-col items-center space-y-4">
                <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-600 text-lg">Loading Chat Dashboard...</p>
            </div>
        </div>
    )
}

export default Preloader