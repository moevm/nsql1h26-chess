import argparse
import json
import os
import random
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DEFAULT_BASE_URL = os.environ.get('BASE_URL', 'http://localhost:3000')
DEFAULT_INTERVAL = int(os.environ.get('INTERVAL', '5'))


class BotError(Exception):
    pass


def parse_args():
    parser = argparse.ArgumentParser(
        description='Python bot for circular chess API that plays random legal moves.'
    )
    parser.add_argument('--base-url', default=DEFAULT_BASE_URL,
                        help='API base URL, e.g. http://backend:3000 (env BASE_URL)')
    parser.add_argument('--bot-id', required=False,
                        help='Bot player ID. Optional: resolved from the key via /api/bots/me if omitted')
    parser.add_argument('--bot-key', required=False,
                        help='Bot API key for X-Bot-Key header')
    parser.add_argument('--interval', type=int, default=DEFAULT_INTERVAL,
                        help='Polling interval in seconds')
    parser.add_argument('--once', action='store_true',
                        help='Execute one polling cycle and exit')
    parser.add_argument('--verbose', action='store_true',
                        help='Print detailed request and response info')
    args = parser.parse_args()

    args.base_url = args.base_url.rstrip('/')
    args.bot_id = args.bot_id or os.environ.get('BOT_ID')
    args.bot_key = args.bot_key or os.environ.get('BOT_KEY')
    args.interval = max(1, args.interval)

    if not args.bot_key:
        raise BotError('Bot API key is required. Use --bot-key or set BOT_KEY environment variable.')

    return args


def build_url(base_url, path, params=None):
    if params:
        return f'{base_url}{path}?{urlencode(params)}'
    return f'{base_url}{path}'


def json_request(method, url, data=None, headers=None):
    headers = headers or {}
    if data is not None:
        body = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    else:
        body = None
    request = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=15) as resp:
            raw = resp.read().decode('utf-8')
            if not raw:
                return None
            return json.loads(raw)
    except HTTPError as e:
        payload = e.read().decode('utf-8')
        try:
            error_body = json.loads(payload)
        except Exception:
            error_body = payload or e.reason
        raise BotError(f'HTTP {e.code} {e.reason}: {error_body}')
    except URLError as e:
        raise BotError(f'Network error: {e.reason}')


def resolve_bot_id(base_url, headers):
    url = build_url(base_url, '/api/bots/me')
    me = json_request('GET', url, headers=headers)
    bot_id = (me or {}).get('_id') if isinstance(me, dict) else None
    if not bot_id:
        raise BotError(f'Could not resolve bot id from /api/bots/me: {me}')
    return str(bot_id)


def get_active_games(base_url, bot_id, headers):
    url = build_url(base_url, '/api/cc/games', {'player_id': bot_id, 'active': 1, 'limit': 100})
    response = json_request('GET', url, headers=headers) or []
    if isinstance(response, dict) and 'data' in response:
        return response['data']
    return response


def get_legal_moves(base_url, game_id, headers):
    url = build_url(base_url, f'/api/cc/games/{game_id}/legal-moves')
    return json_request('GET', url, headers=headers) or {'moves': []}


def make_move(base_url, game_id, move_body, headers):
    url = build_url(base_url, f'/api/cc/games/{game_id}/moves')
    return json_request('POST', url, data=move_body, headers=headers)


def select_random_move(moves):
    if not moves:
        return None
    return random.choice(moves)


def log(message, verbose=False):
    if verbose:
        print(message)


def run_bot(base_url, bot_id, bot_key, interval, once=False, verbose=False):
    headers = {'X-Bot-Key': bot_key}

    if not bot_id:
        bot_id = resolve_bot_id(base_url, headers)
        print(f'Resolved bot id from API key: {bot_id}')

    while True:
        try:
            games = get_active_games(base_url, bot_id, headers)
            if not isinstance(games, list):
                raise BotError(f'Unexpected games response: {games}')

            if games:
                print(f'Found {len(games)} active game(s) for bot {bot_id}')
            else:
                print('No active games found')

            for game in games:
                game_id = game.get('_id') or game.get('id')
                if not game_id:
                    print('Skipping game without _id')
                    continue

                turn = game.get('turn')
                white_id = str(game.get('white_id') or '')
                black_id = str(game.get('black_id') or '')
                bot_as_white = str(bot_id) == white_id
                bot_as_black = str(bot_id) == black_id
                if not bot_as_white and not bot_as_black:
                    print(f'Bot is not a participant in game {game_id}, skipping')
                    continue

                if (turn == 'w' and not bot_as_white) or (turn == 'b' and not bot_as_black):
                    print(f'Game {game_id}: not bot turn ({turn}), skipping')
                    continue

                moves_payload = get_legal_moves(base_url, game_id, headers)
                moves = moves_payload.get('moves') if isinstance(moves_payload, dict) else None
                if not moves:
                    print(f'Game {game_id}: no legal moves available')
                    continue

                move = select_random_move(moves)
                if not move:
                    print(f'Game {game_id}: failed to select random move')
                    continue

                move_body = {'notation': move.get('notation')} if move.get('notation') else {
                    'from': move.get('from'),
                    'to': move.get('to'),
                    'promotion': move.get('promotion')
                }
                log(f'Posting move for game {game_id}: {move_body}', verbose)
                try:
                    result = make_move(base_url, game_id, move_body, headers)
                    print(f'Game {game_id}: played move {move_body} -> status {result.get("game", {}).get("status") if isinstance(result, dict) else "ok"}')
                except BotError as exc:
                    print(f'Game {game_id}: move failed: {exc}')
                    if '409' in str(exc) or '400' in str(exc):
                        print(f'Game {game_id}: refreshing and retrying once')
                        try:
                            get_legal_moves(base_url, game_id, headers)
                            move = select_random_move(moves)
                            if move and move.get('notation'):
                                result = make_move(base_url, game_id, {'notation': move.get('notation')}, headers)
                                print(f'Game {game_id}: retry move succeeded')
                            else:
                                print(f'Game {game_id}: retry skipped, invalid move payload')
                        except BotError as exc2:
                            print(f'Game {game_id}: retry failed: {exc2}')

            if once:
                break

        except BotError as e:
            print(f'Error: {e}')

        if once:
            break

        time.sleep(interval)


if __name__ == '__main__':
    import os

    try:
        args = parse_args()
    except BotError as err:
        print(f'Configuration error: {err}', file=sys.stderr)
        sys.exit(1)

    try:
        run_bot(
            args.base_url,
            args.bot_id,
            args.bot_key,
            args.interval,
            once=args.once,
            verbose=args.verbose
        )
    except BotError as err:
        print(f'Bot execution error: {err}', file=sys.stderr)
        sys.exit(1)
