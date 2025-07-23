export function getKey(
  ratelimiterType: string,
  ratelimiterName: string,
  id: string,
  extra?: string
) {
  return `${ratelimiterType}:${ratelimiterName}:${id}${
    extra ? `:${extra}` : ""
  }`;
}
