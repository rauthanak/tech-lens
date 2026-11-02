/** How a website will be read, from the crawl settings: the server's rule
 *  (crawl.level_width) in words. Automatic shares the pages left across the
 *  levels left, never fewer than AUTO_MIN, so any budget is reached; a fixed
 *  number reaches at most 1 + levels × links pages. */
export const AUTO_MIN = 15;

export function readingLine(pages: number, depth: number, links: number | null): { text: string; short: boolean } {
  const needed = Math.ceil((pages - 1) / Math.max(1, depth));
  if (!links)
    return { text: `Reads up to ${pages} pages, up to ${depth} levels deep, about ${Math.max(AUTO_MIN, needed)} links per level.`, short: false };
  const reach = 1 + depth * links;
  if (reach >= pages)
    return { text: `Reads up to ${pages} pages, up to ${depth} levels deep, ${links} links per level.`, short: false };
  return {
    text: `With ${depth} levels and ${links} links per level, a website reaches at most ${reach} pages. ` +
      `Choose Automatic, or raise links per level to ${needed}, to reach ${pages}.`,
    short: true,
  };
}
