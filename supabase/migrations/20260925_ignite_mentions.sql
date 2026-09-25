-- Mantem uma unica entrada por faisca no feed. O Ignite apenas destaca a
-- publicacao existente e identifica quem a trouxe de volta para a conversa.
begin;

create or replace function public.social_feed(page_offset integer default 0, hashtag text default '')
returns jsonb language sql stable security invoker set search_path='' as $$
  with events as (
    select
      coalesce(p.id::text||':'||latest_ignite.user_id::text,p.id::text) event_id,
      p.id post_id,
      coalesce(latest_ignite.created_at,p.created_at) event_at,
      latest_ignite.user_id igniter
    from public.posts p
    left join lateral (
      select r.user_id,r.created_at
      from public.post_reactions r
      where r.post_id=p.id and r.kind='ignite' and (
        r.user_id=auth.uid() or exists(
          select 1 from public.profile_follows f
          where f.follower_id=auth.uid() and f.followed_id=r.user_id
        )
      )
      order by r.created_at desc,r.user_id desc
      limit 1
    ) latest_ignite on true
  ), visible as (
    select e.*,p.title,p.content,p.image_path,p.created_at,p.author_id,p.is_locked,
      c.visibility='everyone' can_ignite
    from events e join public.posts p on p.id=e.post_id
    join public.forum_categories c on c.id=p.category_id
    where coalesce(hashtag,'')='' or exists (
      select 1 from regexp_matches(p.content,'(^|[[:space:]])#([[:alnum:]_]{1,40})(?![[:alnum:]_])','g') as tag
      where lower(tag[2])=lower(hashtag)
    )
    order by event_at desc,event_id desc limit 20 offset greatest(0,least(page_offset,10000))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'event_id',v.event_id,'id',v.post_id,'title',v.title,'content',v.content,
    'image_path',v.image_path,'created_at',v.created_at,'event_at',v.event_at,
    'author_id',v.author_id,'is_locked',v.is_locked,'can_ignite',v.can_ignite,
    'author',(select jsonb_build_object('id',a.id,'username',a.username,'display_name',a.display_name,'temporary_tag',a.temporary_tag,'avatar_url',a.avatar_url) from public.profiles a where a.id=v.author_id),
    'igniter',(select jsonb_build_object('id',a.id,'username',a.username,'display_name',a.display_name,'temporary_tag',a.temporary_tag) from public.profiles a where a.id=v.igniter),
    'likes',(select count(*) from public.post_reactions r where r.post_id=v.post_id and r.kind='like'),
    'ignites',(select count(*) from public.post_reactions r where r.post_id=v.post_id and r.kind='ignite'),
    'comments',(select count(*) from public.comments c where c.post_id=v.post_id),
    'liked',exists(select 1 from public.post_reactions r where r.post_id=v.post_id and r.kind='like' and r.user_id=auth.uid()),
    'ignited',exists(select 1 from public.post_reactions r where r.post_id=v.post_id and r.kind='ignite' and r.user_id=auth.uid())
  ) order by v.event_at desc,v.event_id desc),'[]'::jsonb) from visible v;
$$;

revoke all on function public.social_feed(integer,text) from public,anon;
grant execute on function public.social_feed(integer,text) to authenticated;

commit;
