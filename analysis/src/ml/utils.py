from __future__ import annotations


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def safe_clamp(value: object, minimum: float = 0.0, maximum: float = 1.0) -> float:
    try:
        return clamp(float(value), minimum, maximum)
    except (TypeError, ValueError):
        return (minimum + maximum) / 2


def safe_count(value: object, default: int = 0) -> int:
    if isinstance(value, (list, tuple, set)):
        return max(0, len(value))

    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return default
