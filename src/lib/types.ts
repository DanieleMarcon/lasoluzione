export type Event = {
  id: string; title: string; slug?: string;
  startsAt?: string; endsAt?: string; description?: string;
  cover?: string; venue?: { name?: string; address?: string };
  tags?: string[]; ticketUrl?: string;
}
