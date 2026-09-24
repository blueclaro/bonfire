export function forumCreationHref(categoryId: string) {
  return `/foruns?novo=1&categoria=${encodeURIComponent(categoryId)}#novo-topico`;
}

export function initialForumCategory(categories: { id: string }[], current: string, requested: string | null) {
  return [current, requested].find(id => id && categories.some(category => category.id === id)) || categories[0]?.id || "";
}
