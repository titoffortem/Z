'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from './auth-provider';
import { useToast } from '@/hooks/use-toast';
import { useTransition, useState } from 'react';
import { ImageIcon, Loader2, Plus } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

const formSchema = z.object({
    caption: z.string().optional(),
    image: z.instanceof(File).optional(),
  }).refine(
      (data) => !!data.caption || !!data.image,
      {
          message: "Запись должна содержать подпись или медиафайл.",
          path: ["caption"],
      }
  );

async function uploadToImgBB(file: File): Promise<string | null> {
  const apiKey = '806efc635481539064a3411065214009';
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
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const router = useRouter();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      caption: '',
      image: undefined,
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue('image', file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!user || !userProfile) {
        toast({ title: 'Вы должны быть авторизованы, чтобы создать запись.', variant: 'destructive' });
        return;
    };
    
    startTransition(async () => {
      try {
        let imageUrl: string | undefined = undefined;
        let mediaType: string | undefined = undefined;

        if (values.image) {
          const uploadedUrl = await uploadToImgBB(values.image);
          if (uploadedUrl) {
            imageUrl = uploadedUrl;
            mediaType = 'image';
          } else {
            toast({
              title: 'Ошибка загрузки изображения',
              description: 'При загрузке изображения произошла ошибка. Пожалуйста, попробуйте еще раз.',
              variant: 'destructive',
            });
            return; // Stop the submission
          }
        }

        const postId = doc(collection(db, 'posts')).id;
        
        const postData: any = {
          id: postId,
          userId: userProfile.id,
          caption: values.caption,
          mediaUrls: imageUrl ? [imageUrl] : [],
          mediaTypes: mediaType ? [mediaType] : [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          likesCount: 0,
        };

        await setDoc(doc(db, 'posts', postId), postData);

        toast({ title: 'Запись создана!' });
        setOpen(false);
        form.reset();
        setPreview(null);
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
    <Dialog open={open} onOpenChange={setOpen}>
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
              name="image"
              render={() => (
                <FormItem>
                  <FormLabel htmlFor="image-upload" className={cn("flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-primary", preview && "hidden")}>
                    <ImageIcon className="h-5 w-5" /> Добавить изображение
                  </FormLabel>
                  <FormControl>
                    <Input id="image-upload" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  </FormControl>
                  {preview && (
                     <div className="relative w-full aspect-video">
                        <Image src={preview} alt="Preview" fill objectFit='cover' className="rounded-md" />
                        <Button type="button" size="icon" variant="destructive" className="absolute top-2 right-2 h-7 w-7" onClick={() => {form.setValue('image', undefined); setPreview(null)}}>
                            <Plus className="h-4 w-4 rotate-45" />
                        </Button>
                     </div>
                  )}
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
