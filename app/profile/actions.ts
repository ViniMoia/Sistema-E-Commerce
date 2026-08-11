"use server";

import { revalidatePath } from "next/cache";

export async function uploadAvatarAction(formData: FormData) {
  // 1. Extract session & authenticate user
  // 2. Validate file size and mime type with Zod
  // 3. Upload file to Supabase Storage Bucket
  // 4. Update 'avatarImageUrl' in Prisma User model
  
  // Simulating Server Action process for architecture completion
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  revalidatePath("/profile");
  return { success: true };
}
