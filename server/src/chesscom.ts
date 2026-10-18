/**
 * Chess.com public API game sync.
 *
 * Uses the published, no-auth endpoints:
 *   GET /pub/player/{username}                 -> verifies the account exists
 *   GET /pub/player/{username}/games/archives  -> monthly archive URLs
 *   GET {archive}                              -> { games: [{ pgn, url, ... }] }
 * Docs: https://www.chess.com/news/view/published-data-api
 */

const API_BASE = 'https://api.chess.com/pub';
const USER_AGENT = 'ai-chess-tutor/0.1.0 (+https://github.com/vicky4u-art/ai-chess-tutor)';

export interface ChesscomFetchedGame {
  pgn: string;
  url: string;
}

function httpError(statusCode: number, message: string): Error {
  return Object.assign(new Error(message), { statusCode });
}

/** Normalize + validate a Chess.com username (3-25 chars, letters/digits/_/-). */
export function normalizeUsername(username: string): string {
  const u = (username ?? '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,25}$/.test(u)) {
    throw httpError(400, 'Invalid Chess.com username (3-25 characters: letters, digits, _ or -)');
  }
  return u;
}

async function getJson(url: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  } catch (e) {
    throw httpError(502, `Could not reach chess.com: ${(e as Error).message}`);
  }
  if (res.status === 404) throw httpError(404, 'Chess.com user not found');
  if (res.status === 429) throw httpError(429, 'Chess.com rate limit hit — try again in a minute');
  if (!res.ok) throw httpError(502, `Chess.com API error (HTTP ${res.status})`);
  return res.json();
}

/**
 * Fetch up to maxGames recent games (PGN + game URL), most recent first.
 * Iterates monthly archives from newest to oldest.
 */
export async function fetchChesscomGames(username: string, maxGames: number): Promise<ChesscomFetchedGame[]> {
  const u = normalizeUsername(username);
  await getJson(`${API_BASE}/player/${u}`); // 404 if the account does not exist
  const archivesData = await getJson(`${API_BASE}/player/${u}/games/archives`);
  const archives: string[] = archivesData.archives ?? [];
  const out: ChesscomFetchedGame[] = [];
  for (const archiveUrl of archives.reverse()) {
    if (out.length >= maxGames) break;
    const data = await getJson(archiveUrl);
    const games: any[] = data.games ?? [];
    for (const g of games.reverse()) {
      if (out.length >= maxGames) break;
      if (typeof g.pgn === 'string' && g.pgn.trim()) {
        out.push({ pgn: g.pgn, url: typeof g.url === 'string' ? g.url : '' });
      }
    }
  }
  return out;
}

/** Extract the [Link "..."] header chess.com embeds in every exported PGN. Used for dedup. */
export function extractGameLink(pgn: string): string | null {
  const m = pgn.match(/\[Link "([^"]+)"\]/);
  return m ? m[1] : null;
}
