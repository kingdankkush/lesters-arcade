"""Deterministic, horizontally periodic noise for geometry.

Every scenery strip tiles, so any function of x must repeat exactly every
`period` units. These are sums of sinusoids with integer x-frequencies, so
f(x) == f(x + period) to float precision, seeded for reproducible builds.
"""
import math, random


class Periodic1D:
    def __init__(self, seed, period, k_min=1, k_max=24, beta=1.15):
        rng = random.Random(seed)
        self.period = period
        self.terms = []
        total = 0.0
        for k in range(k_min, k_max + 1):
            amp = k ** -beta * (0.6 + 0.8 * rng.random())
            self.terms.append((k, amp, rng.random() * math.tau))
            total += amp
        self.norm = 1.0 / total

    def __call__(self, x):
        t = math.tau * x / self.period
        return sum(a * math.sin(k * t + p) for k, a, p in self.terms) * self.norm


class Periodic2D:
    """f(x, y), periodic in x only; y is free (depth)."""

    def __init__(self, seed, period, depth_scale=400.0, count=48, k_max=20, beta=1.1):
        rng = random.Random(seed)
        self.period = period
        self.terms = []
        total = 0.0
        for _ in range(count):
            k = rng.randint(1, k_max)
            m = (rng.random() * 2 - 1) * k * period / depth_scale / 4
            amp = k ** -beta
            self.terms.append((k, m / period, amp, rng.random() * math.tau))
            total += amp
        self.norm = 1.0 / total

    def __call__(self, x, y):
        t = math.tau * x / self.period
        return sum(a * math.sin(k * t + math.tau * m * y + p) for k, m, a, p in self.terms) * self.norm


def ridged(v):
    return 1.0 - abs(v)


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def wrap(x, period):
    return x % period


class Scatter:
    """Seeded placement helper: jittered slots across one period."""

    def __init__(self, seed):
        self.rng = random.Random(seed)

    def uniform(self, a, b):
        return self.rng.uniform(a, b)

    def choice(self, seq):
        return self.rng.choice(seq)

    def chance(self, p):
        return self.rng.random() < p

    def slots(self, period, spacing, jitter=0.4, start=0.0):
        n = max(1, int(round(period / spacing)))
        step = period / n
        return [(start + (i + 0.5 + self.rng.uniform(-jitter, jitter)) * step) % period for i in range(n)]
