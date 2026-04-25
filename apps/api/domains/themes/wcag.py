"""WCAG AA contrast validator for OKLCH/RGB theme palettes (T4.1).

Mirrors the rules in packages/themes/src/lib/validate.ts.
No external color library required — color math is ported directly from
packages/themes/src/lib/color.ts (Ottosson's OKLAB reference).
"""

from __future__ import annotations

import math
import re

from .schemas import PersonaSchema, WcagReport

# ── Contrast thresholds ───────────────────────────────────────────────────────
_TEXT_MIN = 4.5     # WCAG AA normal text
_UI_MIN = 3.0       # WCAG 2.2 SC 1.4.11 UI components / focus rings
_MAX_FALLBACK_DRIFT = 12.0

_TEXT_PAIRS: list[tuple[str, str]] = [
    ("background", "foreground"),
    ("card", "cardForeground"),
    ("primary", "primaryForeground"),
    ("secondary", "secondaryForeground"),
    ("muted", "mutedForeground"),
    ("accent", "accentForeground"),
    ("destructive", "destructiveForeground"),
]

# ring vs background per WCAG 2.2 SC 1.4.11 — see validate.ts UI_COMPONENT_PAIRS
_UI_PAIRS: list[tuple[str, str]] = [
    ("ring", "background"),
]


# ── Colour math (ported from color.ts) ───────────────────────────────────────

def _parse_hex(hex_str: str) -> tuple[int, int, int]:
    """Parse #RRGGBB → (r, g, b) in [0, 255]."""
    h = hex_str.lstrip("#")
    if len(h) != 6:
        raise ValueError(f"Expected #RRGGBB, got '{hex_str}'")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _parse_oklch(input_str: str) -> tuple[float, float, float]:
    """Parse 'oklch(L C H)' → (lightness, chroma, hue). Supports L as % or decimal."""
    m = re.match(
        r"^oklch\(\s*([^\s)]+)\s+([^\s)]+)\s+([^\s)]+)\s*\)$",
        input_str.strip(),
        re.IGNORECASE,
    )
    if not m:
        raise ValueError(f"Expected 'oklch(L C H)', got '{input_str}'")
    l_raw, c_raw, h_raw = m.group(1), m.group(2), m.group(3)
    lightness = float(l_raw.rstrip("%")) / 100.0 if l_raw.endswith("%") else float(l_raw)
    return lightness, float(c_raw), float(h_raw)


def _oklch_to_rgb(
    lightness: float, chroma: float, hue: float
) -> tuple[tuple[int, int, int], bool]:
    """OKLCH → sRGB (0-255 each). Returns (rgb, in_gamut)."""
    rad = math.radians(hue)
    a_lab = chroma * math.cos(rad)
    b_lab = chroma * math.sin(rad)

    lp = lightness + 0.3963377774 * a_lab + 0.2158037573 * b_lab
    mp = lightness - 0.1055613458 * a_lab - 0.0638541728 * b_lab
    sp = lightness - 0.0894841775 * a_lab - 1.291485548  * b_lab

    ll = lp ** 3
    mm = mp ** 3
    ss = sp ** 3

    r_lin =  4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss
    g_lin = -1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss
    b_lin = -0.0041960863 * ll - 0.7034186147 * mm + 1.707614701  * ss

    tol = 0.001
    in_gamut = (
        -tol <= r_lin <= 1 + tol
        and -tol <= g_lin <= 1 + tol
        and -tol <= b_lin <= 1 + tol
    )

    def _to_srgb(x: float) -> int:
        x = max(0.0, min(1.0, x))
        y = 12.92 * x if x <= 0.0031308 else 1.055 * (x ** (1.0 / 2.4)) - 0.055
        return round(y * 255)

    return (_to_srgb(r_lin), _to_srgb(g_lin), _to_srgb(b_lin)), in_gamut


def _relative_luminance(r: int, g: int, b: int) -> float:
    def _linear(c: int) -> float:
        x = c / 255.0
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4

    return 0.2126 * _linear(r) + 0.7152 * _linear(g) + 0.0722 * _linear(b)


def _contrast_ratio(
    fg: tuple[int, int, int], bg: tuple[int, int, int]
) -> float:
    lf = _relative_luminance(*fg)
    lb = _relative_luminance(*bg)
    lighter, darker = (lf, lb) if lf > lb else (lb, lf)
    return (lighter + 0.05) / (darker + 0.05)


def _rgb_distance(
    a: tuple[int, int, int], b: tuple[int, int, int]
) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b, strict=True)))


# ── Public API ────────────────────────────────────────────────────────────────

def run_wcag_checks(persona: PersonaSchema) -> WcagReport:
    """Validate contrast + fallback drift for both light and dark palettes."""
    errors: list[str] = []
    warnings: list[str] = []

    for scheme in ("light", "dark"):
        _check_palette(scheme, persona, errors, warnings)

    return WcagReport(passes=len(errors) == 0, warnings=warnings, errors=errors)


def _check_palette(
    scheme: str,
    persona: PersonaSchema,
    errors: list[str],
    warnings: list[str],
) -> None:
    palette = persona.light if scheme == "light" else persona.dark
    oklch_map = palette.oklch.model_dump()
    rgb_map = palette.rgb.model_dump()

    # Parse all OKLCH tokens → rendered RGB + gamut flag
    oklch_rgb: dict[str, tuple[int, int, int]] = {}
    for slot, val in oklch_map.items():
        try:
            lightness, chroma, hue = _parse_oklch(val)
            rgb, in_gamut = _oklch_to_rgb(lightness, chroma, hue)
            oklch_rgb[slot] = rgb
            if not in_gamut:
                warnings.append(
                    f"OUT_OF_GAMUT: {scheme}.oklch.{slot} ({val}) sits outside sRGB — iOS 15 uses the rgb fallback"
                )
        except ValueError as exc:
            errors.append(f"PARSE_OKLCH: {scheme}.oklch.{slot}: {exc}")

    # Parse all RGB hex fallbacks
    hex_rgb: dict[str, tuple[int, int, int]] = {}
    for slot, val in rgb_map.items():
        try:
            hex_rgb[slot] = _parse_hex(val)
        except ValueError as exc:
            errors.append(f"PARSE_HEX: {scheme}.rgb.{slot}: {exc}")

    # Fallback drift — Euclidean RGB distance must not exceed MAX_FALLBACK_DRIFT
    for slot in oklch_map:
        a = oklch_rgb.get(slot)
        b = hex_rgb.get(slot)
        if a is None or b is None:
            continue
        drift = _rgb_distance(a, b)
        if drift > _MAX_FALLBACK_DRIFT:
            warnings.append(
                f"FALLBACK_DRIFT: {scheme}.{slot}: "
                f"drift {drift:.1f} exceeds {_MAX_FALLBACK_DRIFT}"
            )

    # Contrast checks against both colour spaces
    _check_pairs(scheme, _TEXT_PAIRS, _TEXT_MIN, oklch_rgb, "oklch", errors)
    _check_pairs(scheme, _TEXT_PAIRS, _TEXT_MIN, hex_rgb, "rgb", errors)
    _check_pairs(scheme, _UI_PAIRS, _UI_MIN, oklch_rgb, "oklch", errors)
    _check_pairs(scheme, _UI_PAIRS, _UI_MIN, hex_rgb, "rgb", errors)


def _check_pairs(
    scheme: str,
    pairs: list[tuple[str, str]],
    minimum: float,
    color_map: dict[str, tuple[int, int, int]],
    space: str,
    errors: list[str],
) -> None:
    for bg_slot, fg_slot in pairs:
        bg = color_map.get(bg_slot)
        fg = color_map.get(fg_slot)
        if bg is None or fg is None:
            continue
        ratio = _contrast_ratio(fg, bg)
        if ratio + 0.005 < minimum:
            errors.append(
                f"CONTRAST_FAIL: {scheme}.{space}: "
                f"{bg_slot}/{fg_slot} = {ratio:.2f}:1 (need \u2265 {minimum}:1)"
            )
