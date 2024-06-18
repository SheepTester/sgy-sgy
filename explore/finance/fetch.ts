/**
 * There are two `fetch`s required because most HTTP clients that do redirects
 * (including cURL and Deno and Node's `fetch`) do not preserve cookies set in
 * the redirect response. However, here, `/Home/UpdateTerm` sets a cookie
 * (`ASP.NET_SessionId`) that is immediately used for getting
 * `/Home/ListFunded`, so I need to manually handle preserving that cookie for
 * the second request.
 *
 * `/Home/UpdateTerm` also requires the `Referer` header for some reason.
 *
 * @param termId - The value in the term select dropdown in
 * https://finance.ucsd.edu/Home/ListFunded. I think I could scrape the values
 * in the future, but it's relatively easy so for now I'll just hard-code it.
 */
export async function fetchTerm (termId: string): Promise<string> {
  return fetch('https://finance.ucsd.edu/Home/ListFunded', {
    headers: {
      cookie: await fetch('https://finance.ucsd.edu/Home/UpdateTerm', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          referer: 'https://finance.ucsd.edu/Home/ListFunded'
        },
        redirect: 'manual',
        body: `FinanceTerm=${termId}`
      }).then(r =>
        r.headers
          .getSetCookie()
          .map(cookie => cookie.split('; path=')[0])
          .join('; ')
      )
    }
  }).then(r => r.text())
}
