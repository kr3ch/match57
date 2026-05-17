"""Regression: iPhone photos must NOT come out rotated/mirrored.

iPhone (and most modern cameras) store images in the sensor's native
orientation and tag the intended display rotation in EXIF. Our upload
pipeline ran ``Image.thumbnail`` and re-saved without preserving EXIF
\u2014 which meant the rotation hint was lost and the resulting file was
served sideways (and, for orientation values that include a mirror,
mirrored too).

The fix bakes the rotation into the actual pixels via
``ImageOps.exif_transpose`` before saving. These tests build a tiny JPEG
with each non-trivial EXIF orientation and assert the served bytes
decode to the canonical upright pixel layout.
"""

from __future__ import annotations

import io

import pytest
from httpx import AsyncClient
from PIL import Image

from tests.conftest import register_user


EXIF_ORIENTATION_TAG = 0x0112


def _make_jpeg_with_orientation(orientation: int) -> bytes:
    """Build an 8x12 (W x H) red/blue JPEG whose EXIF Orientation tag
    is ``orientation``. ``ImageOps.exif_transpose`` should rotate it
    back to an 8x12 upright frame whose top half is RED. We use a
    bigger frame than strictly necessary because JPEG quantization can
    bleed single-pixel test patterns into mush at the corners.
    """
    upright = Image.new("RGB", (8, 12))
    for y in range(12):
        for x in range(8):
            upright.putpixel((x, y), (255, 0, 0) if y < 6 else (0, 0, 255))

    # Apply the INVERSE of the orientation so the resulting file claims
    # ``orientation`` but its raw pixels are pre-rotated. When the
    # backend applies exif_transpose it should end up upright again.
    inverse = {
        1: lambda im: im,
        3: lambda im: im.rotate(180, expand=True),
        6: lambda im: im.rotate(90, expand=True),  # camera rotated 90 CW
        8: lambda im: im.rotate(-90, expand=True),  # camera rotated 90 CCW
    }
    raw = inverse[orientation](upright)

    exif = raw.getexif()
    exif[EXIF_ORIENTATION_TAG] = orientation
    buf = io.BytesIO()
    raw.save(buf, format="JPEG", exif=exif.tobytes(), quality=95)
    return buf.getvalue()


@pytest.mark.parametrize("orientation", [1, 3, 6, 8])
@pytest.mark.asyncio
async def test_exif_orientation_baked_into_pixels(client: AsyncClient, orientation: int) -> None:
    await register_user(client, email=f"o{orientation}@test.com", username=f"orient{orientation}")
    body = _make_jpeg_with_orientation(orientation)
    resp = await client.post(
        "/api/media/upload",
        files={"file": (f"photo-{orientation}.jpg", body, "image/jpeg")},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()

    from app.services.uploads import upload_path

    served = upload_path(int(data["user_id"]), data["filename"]).read_bytes()
    with Image.open(io.BytesIO(served)) as out:
        out = out.convert("RGB")
        # Upright frame is 8 wide x 12 tall.
        assert out.size == (8, 12), f"orientation={orientation} ended up {out.size}"
        # Top center red, bottom center blue — i.e. the orientation tag
        # was applied to the pixels before saving. We pick center pixels
        # rather than corners to avoid JPEG chroma subsampling bleed.
        r_top, g_top, b_top = out.getpixel((4, 1))
        r_bot, g_bot, b_bot = out.getpixel((4, 10))
        assert r_top > 200 and b_top < 60, (
            f"orientation={orientation}: top half should be red, got ({r_top},{g_top},{b_top})"
        )
        assert b_bot > 200 and r_bot < 60, (
            f"orientation={orientation}: bottom half should be blue, got ({r_bot},{g_bot},{b_bot})"
        )
