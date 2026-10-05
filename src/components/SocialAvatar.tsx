import {SocialAuthor} from '@/lib/social';
import ProfileAvatar from '@/components/ProfileAvatar';
export default function SocialAvatar({author}:{author:SocialAuthor|null}) {
  return <ProfileAvatar value={author?.avatar_url} name={author?.display_name || author?.username || 'B'} decorative />;
}
