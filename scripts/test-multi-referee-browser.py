"""Two isolated Chromium clients against the local app and a shared fake backend.
No request in this test can mutate the production database. Realtime is disabled
deliberately to verify the polling recovery path as well as the rendered UI.
"""
import copy
import json
import os
import re
import faulthandler
from playwright.sync_api import sync_playwright, expect

faulthandler.dump_traceback_later(60, exit=True)

MATCH_ID = "b5e89444-1f8f-4d49-a823-94f579384967"
server = {
    "id": MATCH_ID, "revision": 1, "type": "padel", "format": "doubles",
    "createdAt": "2026-09-07T12:00:00Z", "isCompleted": False, "winner": None,
    "settings": {"sets": 3, "gamesPerSet": 6, "scoringSystem": "classic", "tiebreakEnabled": True},
    "teamA": {"name": "Judge A test", "players": [{"id": "a1", "name": "Alpha"}, {"id": "a2", "name": "Beta"}]},
    "teamB": {"name": "Judge B test", "players": [{"id": "b1", "name": "Gamma"}, {"id": "b2", "name": "Delta"}]},
    "score": {"teamA": 0, "teamB": 0, "sets": [], "currentSet": {
        "teamA": 0, "teamB": 0, "games": [], "currentGame": {"teamA": 0, "teamB": 0}, "isTiebreak": False}},
    "currentServer": {"team": "teamA", "playerIndex": 0},
    "courtSides": {"teamA": "left", "teamB": "right"}, "courtNumber": 1,
    "shouldChangeSides": False, "appliedOperationIds": [],
}
commands = []

def points(page, value):
    return page.locator("button.text-6xl").filter(has_text=re.compile("^" + str(value) + "$"))

def row():
    fields = {"createdAt": "created_at", "teamA": "team_a", "teamB": "team_b",
              "currentServer": "current_server", "courtSides": "court_sides",
              "courtNumber": "court_number", "shouldChangeSides": "should_change_sides",
              "isCompleted": "is_completed"}
    result = {fields.get(k, k): copy.deepcopy(v) for k, v in server.items() if k != "appliedOperationIds"}
    result["extras"] = {"appliedOperationIds": list(server["appliedOperationIds"])}
    return result

def respond(route, payload, status=200, headers=None):
    route.fulfill(status=status, content_type="application/json", body=json.dumps(payload), headers=headers or {})

def api(route):
    req = route.request
    if req.url.endswith("/command") and req.method == "POST":
        body = req.post_data_json
        operation = body["operationId"]
        if operation not in server["appliedOperationIds"]:
            if server["isCompleted"]:
                respond(route, {"code": "match_completed", "match": server}, 400)
                return
            assert body["command"] == "point", body
            team = body["args"]["team"]
            game = server["score"]["currentSet"]["currentGame"]
            points = [0, 15, 30, 40]
            game[team] = points[points.index(game[team]) + 1]
            server["revision"] += 1
            server["appliedOperationIds"].append(operation)
            commands.append(body)
        respond(route, {"status": "ok", "revision": server["revision"], "match": server})
    else:
        respond(route, {})

def rest(route):
    req = route.request
    if req.method not in ("GET", "HEAD", "OPTIONS"):
        # Browser must never bypass command transport with direct row updates.
        raise AssertionError("Unexpected direct database mutation: " + req.method + " " + req.url)
    if "/matches" in req.url:
        singular = "vnd.pgrst.object" in req.headers.get("accept", "")
        respond(route, row() if singular else [row()], headers={"content-range": "0-0/1"})
    else:
        respond(route, [], headers={"content-range": "*/0"})

with sync_playwright() as p:
    print("Launching Chromium", flush=True)
    browser = p.chromium.launch(headless=True)
    try:
        contexts = [browser.new_context(), browser.new_context()]
        pages = []
        for context in contexts:
            print("Opening referee client", flush=True)
            context.route("**/rest/v1/**", rest)
            context.route("**/api/**", api)
            context.route("**/auth/v1/**", lambda route: respond(route, {"user": None}))
            # Keep the intercepted connection inert: immediate close can cause
            # the client's reconnect loop to monopolize the mock driver.
            context.route_web_socket("**/realtime/**", lambda socket: None)
            page = context.new_page()
            page.goto(os.environ.get("SYNC_TEST_URL", "http://localhost:3107") + "/match/" + MATCH_ID)
            expect(points(page, 0)).to_have_count(2, timeout=15000)
            pages.append(page)
        a, b = pages
        print("Checking cross-client points", flush=True)
        points(a, 0).first.click()
        expect(points(a, 15)).to_have_count(1)
        expect(points(b, 15)).to_have_count(1, timeout=8000)
        points(b, 0).click()
        expect(points(a, 15)).to_have_count(2, timeout=8000)
        expect(points(b, 15)).to_have_count(2)

        contexts[1].set_offline(True)
        print("Checking offline recovery", flush=True)
        points(b, 15).last.click()
        expect(points(b, 30)).to_have_count(1)
        assert len(commands) == 2
        contexts[1].set_offline(False)
        expect(points(a, 30)).to_have_count(1, timeout=10000)
        assert len(commands) == 3

        # Reopen the second tab: its durable state must agree with the first.
        b.reload()
        expect(points(b, 30)).to_have_count(1)
        assert server["score"]["currentSet"]["currentGame"] == {"teamA": 15, "teamB": 30}
        print("Checking fullscreen scoring with unavailable snapshot cache", flush=True)
        fullscreen = contexts[0].new_page()
        fullscreen.goto(os.environ.get("SYNC_TEST_URL", "http://localhost:3107") + "/fullscreen-scoreboard/1")
        fullscreen.wait_for_function("document.body.innerText.includes('Alpha')")
        fullscreen.evaluate("""() => {
          const save = Storage.prototype.setItem;
          Storage.prototype.setItem = function(key, value) {
            if (key.startsWith('match_') && !key.startsWith('match_oplog_') && !key.startsWith('match_pending_command_'))
              throw new DOMException('Test cache quota exhausted', 'QuotaExceededError');
            return save.call(this, key, value);
          };
        }""")
        fullscreen.keyboard.press("a")
        expect(points(b, 30)).to_have_count(2, timeout=10000)
        assert len(commands) == 4
        server["isCompleted"] = True
        server["winner"] = "teamA"
        server["revision"] += 1
        for page in pages:
            expect(points(page, 30).first).to_be_disabled(timeout=8000)
        fullscreen.keyboard.press("a")
        expect(points(b, 30)).to_have_count(2)
        assert len(commands) == 4
        print("PASS: two independent clients; A->B and B->A scores; offline queue/reconnect; reload; fullscreen/cache failure; remote completion")
    finally:
        browser.close()
        faulthandler.cancel_dump_traceback_later()
