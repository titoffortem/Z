'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { useTransition, useState, useEffect } from 'react';
import { ImageIcon, Loader2, Plus, ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { firebaseConfig } from '@/firebase/config';

const formSchema = z.object({
    caption: z.string().optional(),
    images: z.array(z.instanceof(File)).optional(),
  }).refine(
      (data) => !!data.caption || (data.images && data.images.length > 0),
      {
          message: "Запись должна содержать подпись или хотя бы один медиафайл.",
          path: ["caption"],
      }
  );

async function uploadToImgBB(file: File): Promise<string | null> {
  const apiKey = firebaseConfig.imgbbKey;

  if (!apiKey) {
    console.error('ImgBB API key is not configured in firebase/config.ts');
    return null;
  }
  
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ImgBB upload failed with status:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    if (data.success) {
      return data.data.url;
    } else {
      console.error('ImgBB API returned an error:', data);
      return null;
    }
  } catch (error) {
    console.error('Error during ImgBB upload:', error);
    return null;
  }
}

export function CreatePost() {
  const { user, userProfile } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  
  const router = useRouter();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      caption: '',
      images: [],
    },
  });

  useEffect(() => {
    form.setValue('images', files);
  }, [files, form]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
        const newFiles = Array.from(selectedFiles);
        const allFiles = [...files, ...newFiles];
        setFiles(allFiles);

        const newPreviews = newFiles.map(file => URL.createObjectURL(file));
        setPreviews(prev => [...prev, ...newPreviews]);
    }
    // Reset file input to allow selecting the same file again
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]); // Clean up memory
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
      const newFiles = [...files];
      const newPreviews = [...previews];
      const targetIndex = direction === 'left' ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= files.length) return;

      [newFiles[index], newFiles[targetIndex]] = [newFiles[targetIndex], newFiles[index]];
      [newPreviews[index], newPreviews[targetIndex]] = [newPreviews[targetIndex], newPreviews[index]];
      
      setFiles(newFiles);
      setPreviews(newPreviews);
  };
  
  const resetForm = () => {
    form.reset();
    previews.forEach(URL.revokeObjectURL);
    setFiles([]);
    setPreviews([]);
    setOpen(false);
  }

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!user || !userProfile || !firestore) {
        toast({ title: 'Вы должны быть авторизованы, чтобы создать запись.', variant: 'destructive' });
        return;
    };
    
    startTransition(async () => {
      try {
        let imageUrls: string[] = [];
        let mediaTypes: string[] = [];

        if (values.images && values.images.length > 0) {
          const uploadPromises = values.images.map(image => uploadToImgBB(image));
          const urls = await Promise.all(uploadPromises);
          
          if (urls.some(url => url === null)) {
              toast({
                  title: 'Ошибка загрузки некоторых изображений',
                  description: 'Не все изображения удалось загрузить. Пожалуйста, попробуйте еще раз.',
                  variant: 'destructive',
              });
              return;
          }
          
          imageUrls = urls.filter((url): url is string => url !== null);
          mediaTypes = imageUrls.map(() => 'image');
        }

        const postId = doc(collection(firestore, 'posts')).id;
        
        const postData = {
          id: postId,
          userId: userProfile.id,
          caption: values.caption || "",
          mediaUrls: imageUrls,
          mediaTypes: mediaTypes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          likedBy: [],
        };

        await setDoc(doc(firestore, 'posts', postId), postData);

        toast({ title: 'Запись создана!' });
        resetForm();
        router.refresh();
      } catch (error: any) {
        toast({
          title: 'Ошибка создания записи',
          description: error.message,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        else setOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button size="icon" className="h-12 w-12 rounded-full">
          <Plus className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Создать новую запись</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="caption"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea placeholder="Что происходит?" {...field} rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="images"
              render={() => (
                <FormItem>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {previews.map((previewUrl, index) => (
                          <div key={previewUrl} className="relative group aspect-square">
                              <Image src={previewUrl} alt={`Preview ${index + 1}`} fill className="object-cover rounded-md" />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-white hover:bg-white/20" onClick={() => moveImage(index, 'left')} disabled={index === 0}>
                                      <ArrowLeft className="h-4 w-4" />
                                  </Button>
                                  <Button type="button" size="icon" variant="destructive" className="h-7 w-7" onClick={() => removeImage(index)}>
                                      <Trash2 className="h-4 w-4" />
                                  </Button>
                                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-white hover:bg-white/20" onClick={() => moveImage(index, 'right')} disabled={index === previews.length - 1}>
                                      <ArrowRight className="h-4 w-4" />
                                  </Button>
                              </div>
                          </div>
                      ))}
                      <FormLabel htmlFor="image-upload" className="flex flex-col items-center justify-center gap-1 cursor-pointer text-muted-foreground hover:text-primary border-2 border-dashed border-border rounded-md aspect-square transition-colors">
                          <Plus className="h-6 w-6" />
                          <span className="text-xs text-center">Добавить</span>
                      </FormLabel>
                  </div>
                  <FormControl>
                    <Input id="image-upload" type="file" accept="image/*" onChange={handleFileChange} className="hidden" multiple />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Опубликовать
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
