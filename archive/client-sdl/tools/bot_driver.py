#!/usr/bin/env python3
"""Play one contract of the OLD game (C++ server + 4 SDL clients) with 4 bots, taking screenshots.

Everything runs inside a nested X server (Xephyr) so the real mouse is never touched.
Each bot reads its client's stdout (the client prints every server message), picks its
lowest legal card and drags it onto the table with synthetic mouse events (XTEST), exactly
as a person would. The picker always chooses the given contract.

Requirements: Xephyr, python-xlib, Pillow. Build the old server first:
    g++ -std=c++11 archive/server-cpp/final.cpp -o archive/server-cpp/server
Usage:
    bot_driver.py OUT_DIR [--contract dineri] [--display :5]
"""

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

from PIL import ImageGrab
from Xlib import X, display as xdisplay
from Xlib.ext import xtest

REPO = Path(__file__).resolve().parents[3]
SERVER_DIR = REPO / "archive/server-cpp"
CLIENT_DIR = REPO / "archive/client-sdl"
NAMES = ["lam3i", "bochra", "ldhaw", "klafez"]  # hardcoded by the old server, seat order
WIN_W, WIN_H = 800, 600
GRID = [(0, 0), (WIN_W, 0), (0, WIN_H + 20), (WIN_W, WIN_H + 20)]
RANKS = ["7", "8", "9", "j", "q", "k", "10", "a"]
# Old client layout (archive/client-sdl/src/graphics.h): hand cards at x = 160 + 50*i, y = 460,
# 79x123, overlapping; the drop zone is {160,150,450,300}; contract tiles are 160x150 cells.
CONTRACT_TILE = {"damet": (80, 75), "ray": (240, 75), "dineri": (400, 75), "pli": (560, 75),
                 "farcha": (720, 75), "trix": (320, 225), "general": (480, 225)}


def suit(card):
    return card.split("_")[1]


def rank(card):
    return RANKS.index(card.split("_")[0])


class Bot:
    def __init__(self, seat, log_path):
        self.seat = seat
        self.log_path = log_path
        self.offset = 0
        self.hand = []
        self.played = set()
        self.strong = None
        self.pending = None
        self.lines = []
        self.hands_seen = 0
        self.tricks_ended = 0

    def read(self):
        """Consume new lines from the client's stdout log."""
        with open(self.log_path, "r", errors="replace") as f:
            f.seek(self.offset)
            data = f.read()
            self.offset = f.tell()
        for line in data.splitlines():
            self.lines.append(line)
            self.handle(line.strip())

    def handle(self, line):
        if line.startswith("new_hand,"):
            self.hand = line.split(",", 1)[1].split(";")
            self.played, self.strong, self.pending = set(), None, None
            self.hands_seen += 1
        elif line == "ekhtar":
            self.pending = "pick"
        elif line == "your_turn":
            self.pending = "play"
        elif line.startswith("strong_suit,"):
            self.strong = suit(line.split(",")[1])
        elif line == "end_of_pli":
            self.strong = None
            self.tricks_ended += 1

    def choose(self):
        """Lowest legal card: follow the led suit if possible (same rule as the old client)."""
        legal = [c for c in self.hand if c not in self.played]
        following = [c for c in legal if self.strong and suit(c) == self.strong]
        pool = following or legal
        return min(pool, key=lambda c: (rank(c), "hcds".index(suit(c))))


class Desk:
    def __init__(self, display_name):
        self.name = display_name
        self.d = xdisplay.Display(display_name)
        self.root = self.d.screen().root

    def windows(self):
        found = {}
        for w in self.root.query_tree().children:
            try:
                title = w.get_wm_name()
            except Exception:
                continue
            if title in NAMES:
                found[title] = w
        return found

    def place(self, wins):
        for name, w in wins.items():
            x, y = GRID[NAMES.index(name)]
            w.configure(x=x, y=y)
        self.d.sync()

    def move(self, x, y):
        xtest.fake_input(self.d, X.MotionNotify, x=int(x), y=int(y))
        self.d.sync()

    def click(self, x, y):
        self.move(x, y)
        time.sleep(0.08)
        xtest.fake_input(self.d, X.ButtonPress, 1)
        self.d.sync()
        time.sleep(0.08)
        xtest.fake_input(self.d, X.ButtonRelease, 1)
        self.d.sync()

    def drag(self, x0, y0, x1, y1, steps=12):
        self.move(x0, y0)
        time.sleep(0.08)
        xtest.fake_input(self.d, X.ButtonPress, 1)
        self.d.sync()
        for i in range(1, steps + 1):
            time.sleep(0.02)
            self.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps)
        time.sleep(0.08)
        xtest.fake_input(self.d, X.ButtonRelease, 1)
        self.d.sync()

    def shot(self, path):
        ImageGrab.grab(xdisplay=self.name).save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out", type=Path)
    ap.add_argument("--contract", default="dineri")
    ap.add_argument("--display", default=":5")
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    procs = []
    env = dict(os.environ, DISPLAY=args.display, SDL_VIDEODRIVER="x11")

    def spawn(cmd, cwd, log, **kw):
        p = subprocess.Popen(cmd, cwd=cwd, stdout=open(log, "w"), stderr=subprocess.STDOUT, **kw)
        procs.append(p)
        return p

    try:
        spawn(["Xephyr", args.display, "-screen", f"{2 * WIN_W}x{2 * WIN_H + 40}", "-ac", "-nolisten", "tcp",
               "-title", "trix: 4 bots on the old client"], REPO, args.out / "xephyr.log")
        time.sleep(1.5)
        desk = Desk(args.display)
        spawn(["stdbuf", "-oL", "./server"], SERVER_DIR, args.out / "server.log")
        time.sleep(0.8)
        bots = []
        for seat in range(4):
            log = args.out / f"client{seat}.log"
            spawn(["stdbuf", "-oL", "./prog"], CLIENT_DIR, log, env=env)
            bots.append(Bot(seat, log))
            time.sleep(0.4)  # connection order decides the seat

        deadline = time.time() + 20
        while len(desk.windows()) < 4:
            if time.time() > deadline:
                sys.exit("SDL windows did not appear")
            time.sleep(0.2)
        desk.place(desk.windows())
        time.sleep(1.0)

        n = 0
        def snap(label):
            nonlocal n
            n += 1
            time.sleep(0.35)  # let the clients render
            desk.shot(args.out / f"{n:02d}-{label}.png")

        cards_played = 0
        tricks_shot = 0
        deadline = time.time() + 240
        while time.time() < deadline:
            for p in procs[1:]:
                if p.poll() is not None:
                    sys.exit(f"process exited early: {p.args} (code {p.returncode})")
            for b in bots:
                b.read()
            if bots[0].tricks_ended > tricks_shot:
                tricks_shot = bots[0].tricks_ended
                snap(f"trick{tricks_shot}-cleared")
            # Stop at the start of the second contract, once its picker is being asked.
            if all(b.hands_seen >= 2 for b in bots) and any(b.pending == "pick" for b in bots):
                snap("next-contract-deal")
                break
            actor = next((b for b in bots if b.pending), None)
            if actor is None:
                time.sleep(0.1)
                continue
            wx, wy = GRID[actor.seat]
            if actor.pending == "pick":
                snap(f"pick-screen-{NAMES[actor.seat]}")
                tx, ty = CONTRACT_TILE[args.contract]
                desk.click(wx + tx, wy + ty)
                actor.pending = None
                snap("contract-chosen")
            else:
                card = actor.choose()
                i = actor.hand.index(card)
                # Grab the part of card i not covered by card i-1 (earlier cards win the hit test).
                desk.drag(wx + 160 + 50 * i + 40, wy + 520, wx + 385, wy + 300)
                actor.played.add(card)
                actor.pending = None
                cards_played += 1
                trick, pos = divmod(cards_played - 1, 4)
                snap(f"trick{trick + 1}-card{pos + 1}-{NAMES[actor.seat]}-{card}")
        else:
            sys.exit("timed out")
        print(f"done: {cards_played} cards played, screenshots in {args.out}")
    finally:
        for p in reversed(procs):
            p.terminate()
        for p in procs:
            try:
                p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                p.kill()


if __name__ == "__main__":
    main()
