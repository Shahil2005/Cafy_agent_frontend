import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User } from "../../types";

interface UserAvatarProps {
    user: User | null;
    className?: string;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ user, className = "" }) => {
    const [imgError, setImgError] = useState(false);

    const photoURL = user?.photoURL?.trim() || null;

    useEffect(() => {
        setImgError(false);
    }, [photoURL]);

    const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        user?.displayName || "Student"
    )}&background=random&color=fff`;

    const src = photoURL && !imgError ? photoURL : fallbackUrl;

    return (
        <motion.img
            key={photoURL ?? "fallback"}
            src={src}
            alt={user?.displayName || "User Avatar"}
            className={`object-cover rounded-full ${className}`}
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
        />
    );
};

export default UserAvatar;
