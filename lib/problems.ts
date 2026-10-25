// A source that couldn't finish, in words: the same on a collection's page and on Operations.

const RETRIES = "Nothing to do: the pages read before it were kept, and the next collection tries again.";

/** Why a source failed, in words, and what to do about it. `nothingToDo`: the
 *  next collection retries on its own, so the problem offers no button. */
export function sourceProblem(error: string): { why: string; fix: string; nothingToDo?: boolean } {
  if (/401 Unauthorized/.test(error) && /openalex/i.test(error))
    return { why: "OpenAlex refused its searches: it now needs its free key",
      fix: "Ask whoever runs the server to add OPENALEX_API_KEY to its settings file (.env)." };
  if (/40[13]/.test(error)) return { why: "the site refused the radar's requests", fix: "Check it in Setup › Sources, or switch it off." };
  if (/Invalid IPv6 URL/i.test(error))
    return { why: "a link on its pages has a malformed address, and reading stopped there", fix: RETRIES, nothingToDo: true };
  if (/codec|surrogates/i.test(error))
    return { why: "a page had characters the radar couldn't store", fix: RETRIES, nothingToDo: true };
  if (/time(d)? ?out/i.test(error))
    return { why: "the site took too long to answer", fix: "Nothing to do: the next collection tries again.", nothingToDo: true };
  return { why: error.length > 200 ? `${error.slice(0, 200)}…` : error, fix: "" };
}
