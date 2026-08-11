"use client";

import { useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { UserProfile } from "../types";
import { uploadAvatarAction } from "../actions";

interface AvatarManagerProps {
  user: UserProfile;
}

export function AvatarManager({ user }: AvatarManagerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarImageUrl || null);

  const initials = user.name?.substring(0, 2).toUpperCase() || "US";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
      // Create local preview
      const objectUrl = URL.createObjectURL(file);
      setAvatarUrl(objectUrl);
      
      // Real upload to Server Action
      const formData = new FormData();
      formData.append("avatar", file);
      
      const result = await uploadAvatarAction(formData);
      if (!result.success) {
        console.error("Failed to upload avatar");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center text-center space-y-4">
      <div className="relative group cursor-pointer">
        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 bg-black/50 flex items-center justify-center transition-transform duration-300 group-hover:scale-105 group-hover:border-[var(--primary)]/50">
          {avatarUrl ? (
             <img 
               src={avatarUrl} 
               alt="Avatar" 
               className={`w-full h-full object-cover ${isUploading ? 'opacity-50 blur-sm' : ''} transition-all duration-300`} 
             />
          ) : (
            <span className="text-2xl font-bold text-zinc-300 tracking-wider">
              {isUploading ? '' : initials}
            </span>
          )}
        </div>
        
        <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 rounded-full transition-opacity cursor-pointer">
          {isUploading ? (
            <Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" />
          ) : (
            <Camera className="w-6 h-6 text-white" />
          )}
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      </div>

      <div>
        <h3 className="font-medium text-lg">{user.name}</h3>
        <p className="text-sm text-zinc-400 capitalize">{user.role.toLowerCase()}</p>
      </div>
    </div>
  );
}
