-- Las fotos siguen visibles por su URL pública. Solo administración lista los archivos.
begin;
alter policy beauty_images_read on storage.objects to authenticated
 using(bucket_id='beauty-images' and (select beauty_private.is_admin()));
notify pgrst,'reload schema';
commit;
