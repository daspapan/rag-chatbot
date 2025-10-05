'use client';

import React, { useState } from 'react'
import styles from "./navbar.module.css"
import Link from 'next/link'
// import AuthLinks from '@/components/authLinks/AuthLinks'
// import ThemeToggle from '@/components/themeToggle/ThemeToggle'

const Navbar = () => {

    const [tenantId, setTenantId] = useState<string>('');
    const [tokens, setTokens] = useState<string | null>(null);

    const handleLogout = async () => {
        setTenantId('');
        setTokens(null);
    }

    return (
        <header className={styles.header}>
            <div className={styles.logo}>
                <h1 className={styles.LogoHeader}> Sample Just In Time Knowledge Base {tenantId && `- ${tenantId}`}</h1>
            </div>
            {tokens && (
                <button className={styles.btnPrimary} onClick={handleLogout}>
                    Logout
                </button>
            )}
        </header>
    )
}

export default Navbar
