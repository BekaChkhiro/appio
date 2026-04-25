"""Tests for the auto-generated PWA icon."""

from __future__ import annotations

import pytest

from appio_builder.icon import generate_icon_svg, icon_filename


def test_initial_uppercased() -> None:
    svg = generate_icon_svg("todoist", theme_color="#3366CC")
    assert ">T<" in svg


def test_non_alphanumeric_name_falls_back_to_a() -> None:
    svg = generate_icon_svg("!!!", theme_color="#3366CC")
    assert ">A<" in svg


def test_dark_theme_picks_white_text() -> None:
    svg = generate_icon_svg("Test", theme_color="#000000")
    assert "#FFFFFF" in svg


def test_light_theme_picks_black_text() -> None:
    svg = generate_icon_svg("Test", theme_color="#FFFFFF")
    assert "#000000" in svg


def test_invalid_color_falls_back_to_white_text() -> None:
    svg = generate_icon_svg("Test", theme_color="not-a-color")
    assert "#FFFFFF" in svg


def test_size_validation() -> None:
    with pytest.raises(ValueError):
        generate_icon_svg("X", theme_color="#3366CC", size=0)


def test_filename_convention() -> None:
    assert icon_filename(192) == "icon-192.svg"
    assert icon_filename(512) == "icon-512.svg"


def test_xml_escaping() -> None:
    svg = generate_icon_svg("<script>", theme_color="#3366CC")
    assert "<script>" not in svg.replace("<svg", "")
    # The first letter is "s" → should be escaped as text content but "s"
    # itself doesn't need escaping; this test really guards future changes
    # that allow multi-char initials.
    assert ">S<" in svg
