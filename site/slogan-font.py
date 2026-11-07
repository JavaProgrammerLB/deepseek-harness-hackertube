# /// script
# requires-python = ">=3.10"
# dependencies = ["fonttools==4.68.0", "brotli==1.2.1"]
# ///
"""Regenerate the landing faces: python3 site/slogan-font.py

Fraunces (soft) takes the Latin wordmark. Ma Shan Zheng takes the
Chinese mission, including its punctuation. Body text stays on the
system sans and is not subset. A second run with the same strings
changes nothing.
"""
import hashlib
import io
import pathlib
import re
import sys
import urllib.request
from urllib.parse import quote

import brotli
import fontTools
from fontTools import subset, unicodedata
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

PINS = {"fonttools": (fontTools.version, "4.68.0"), "brotli": (brotli.__version__, "1.2.1")}
SUBSET_NAMES = [0, 1, 2, 3, 4, 5, 6, 13, 14]

SITE = pathlib.Path(__file__).resolve().parent
PUBLIC = SITE / "public"


def latn_letters(text):
    return sorted(
        {
            ord(c)
            for c in text
            if unicodedata.script(c) == "Latn" and unicodedata.category(c).startswith("L")
        }
    )


def mission_marks(text):
    # Han plus the punctuation that belongs to the mission line.
    return sorted({ord(c) for c in text if not c.isspace()})


FACES = (
    {
        "family": "Fraunces",
        "upstream": "https://raw.githubusercontent.com/google/fonts/4024282d9b0cffcdb8e3024560862746178d741f/ofl/fraunces/",
        "ttf": "Fraunces[SOFT,WONK,opsz,wght].ttf",
        "ttf_sha256": "177ff6c0f14e5550a3c624247cd1189611d4eb65d000b14944c63d967958abbb",
        "ofl_sha256": "bdf4c22802eaf804f998195871c6b8938aac2ac14b2d78a8bd66a6f1eced833b",
        "ofl_out": "OFL-Fraunces.txt",
        "woff2": "fraunces-wordmark.woff2",
        "glyphs": latn_letters,
        "source": "wordmark",
        "instance": {"SOFT": 100, "wght": 560, "opsz": 36, "WONK": 1},
    },
    {
        "family": "Ma Shan Zheng",
        "upstream": "https://raw.githubusercontent.com/google/fonts/406197b91ff39a93061c2c2eeaee67ddf2ae1f0d/ofl/mashanzheng/",
        "ttf": "MaShanZheng-Regular.ttf",
        "ttf_sha256": "6d2546bb189c732a8ca29af9e22457b152387d158aa459e4ac2ce1e51788b7fb",
        "ofl_sha256": "d7bdb1cee215b689e23c2f95672a6084c790542170648267a55114103d756a08",
        "ofl_out": "OFL-MaShanZheng.txt",
        "woff2": "mashan-mission.woff2",
        "glyphs": mission_marks,
        "source": "mission",
        "instance": None,
    },
)


def fetch(upstream, name, sha256):
    data = urllib.request.urlopen(upstream + quote(name, safe=",")).read()
    got = hashlib.sha256(data).hexdigest()
    if got != sha256:
        sys.exit(f"{name}: sha256 {got}, want {sha256}")
    return data


def class_text(html, class_name):
    found = re.search(rf'class="{re.escape(class_name)}"[^>]*>(.*?)</', html, re.S)
    if not found:
        sys.exit(f"index.html has no .{class_name}")
    return re.sub(r"<[^>]*>", "", found.group(1)).strip()


def replace_if_changed(path, data):
    if path.is_file() and path.read_bytes() == data:
        return
    path.parent.mkdir(exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(path)


def load_face(face, raw):
    options = subset.Options(flavor="woff2", name_IDs=SUBSET_NAMES)
    if not face["instance"]:
        return subset.load_font(io.BytesIO(raw), options, dontLoadGlyphNames=True), options
    font = TTFont(io.BytesIO(raw), recalcTimestamp=False, recalcBBoxes=False)
    instantiateVariableFont(font, face["instance"], inplace=True, updateFontNames=False)
    want = int(face["instance"]["wght"])
    got = font["OS/2"].usWeightClass
    if got != want:
        sys.exit(f"{face['family']}: usWeightClass {got}, want {want}")
    return font, options


def subset_face(font, options, codepoints):
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    buf = io.BytesIO()
    subset.save_font(font, buf, options)
    return buf.getvalue()


def rewrite_range(css, family, codepoints):
    pattern = re.compile(
        r'(@font-face\s*\{[^}]*font-family:\s*"' + re.escape(family) + r'"[^}]*?unicode-range:\s*)[^;]*(;)',
        re.S,
    )
    found = list(pattern.finditer(css))
    if len(found) != 1:
        sys.exit(f"site.css: want exactly one unicode-range for {family}, found {len(found)}")
    value = ", ".join(f"U+{c:04X}" for c in codepoints)
    return pattern.sub(r"\g<1>" + value + r"\2", css, count=1)


def main():
    for pkg, (have, want) in PINS.items():
        if have != want:
            sys.exit(f"{pkg} {have}, want {want}. The committed subset bytes depend on it.")

    html = (PUBLIC / "index.html").read_text()
    texts = {"wordmark": class_text(html, "wordmark"), "mission": class_text(html, "mission")}
    fonts = PUBLIC / "fonts"
    fonts.mkdir(exist_ok=True)
    css_path = PUBLIC / "site.css"
    css = css_path.read_text()

    for face in FACES:
        codepoints = face["glyphs"](texts[face["source"]])
        if not codepoints:
            sys.exit(f"{face['family']}: no glyphs in .{face['source']}")
        raw = fetch(face["upstream"], face["ttf"], face["ttf_sha256"])
        font, options = load_face(face, raw)
        data = subset_face(font, options, codepoints)
        got = sorted(TTFont(io.BytesIO(data)).getBestCmap())
        if got != codepoints:
            sys.exit(f"{face['family']}: cmap {got} != source {codepoints}")
        replace_if_changed(fonts / face["woff2"], data)
        replace_if_changed(fonts / face["ofl_out"], fetch(face["upstream"], "OFL.txt", face["ofl_sha256"]))
        css = rewrite_range(css, face["family"], codepoints)
        href = "/fonts/" + face["woff2"]
        if css.count(href) != 1 or html.count(href) != 1:
            sys.exit(f"want exactly one {href} in site.css and index.html")
        chars = "".join(map(chr, codepoints))
        print(f"{face['woff2']} {len(data)} bytes, {len(codepoints)} codepoints: {chars}")

    keep = {face["woff2"] for face in FACES}
    for old in fonts.glob("*.woff2"):
        if old.name not in keep:
            old.unlink()

    if css != css_path.read_text():
        css_path.write_text(css)


if __name__ == "__main__":
    main()
