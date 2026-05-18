#!/usr/bin/env python3
import argparse
import json
import os
import random
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

DEFAULT_BASE_URL = 'http://localhost:3000'
DEFAULT_INTERVAL = 5
DEFAULT_CONFIG_FILENAME = 'bot_config.json'


class BotError(Exception):
    pass


def load_config_file(path):
    if not os.path.exists(path):
        return {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError as exc:
        raise BotError(f'Invalid JSON in {path}: {exc}')


def save_config_file(path, config):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2)
    print(f'Wrote bot config to {path}')


def get_default_config_path():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(script_dir, DEFAULT_CONFIG_FILENAME)


def parse_args():
    parser = argparse.ArgumentParser(
        description='Python bot for circular chess API with local bot_config.json support.'
    )
    parser.add_argument('--once', action='store_true',
                        help='Execute one polling cycle and exit')
    parser.add_argument('--verbose', action='store_true',
                        help='Print detailed request and response info')
    args = parser.parse_args()

    config_path = get_default_config_path()
    config = load_config_file(config_path)

    if not config.get('bot_id') or not config.get('bot_key'):
        raise BotError(f'bot_config.json is missing or incomplete at {config_path}. Requires bot_id and bot_key.')

    args.base_url = config.get('base_url', DEFAULT_BASE_URL)
    args.bot_id = config.get('bot_id')
    args.bot_key = config.get('bot_key')
    args.interval = config.get('interval', DEFAULT_INTERVAL)
    args.interval = max(1, args.interval)

    return args


def build_url(base_url, path, params=None):
    if params:
        return f'{base_url}{path}?{urlencode(params)}'
    return f'{base_url}{path}'


def json_request(method, url, data=None, headers=None):
    headers = headers or {}
    body = None
    if data is not None:
        body = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
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
                    print(f'Game {game_id}: played move {move_body}')
                except BotError as exc:
                    print(f'Game {game_id}: move failed: {exc}')
                    if '409' in str(exc) or '400' in str(exc):
                        print(f'Game {game_id}: refreshing and retrying once')
                        try:
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
