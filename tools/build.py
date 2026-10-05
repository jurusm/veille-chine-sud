"""Build the two published versions from src/page.html + assets/.
- index.html (GitHub Pages): full document, linked CSS/JS, local fonts and basemap.
- dist/artifact.html (claude.ai page): body-only markup with CSS (fonts as data URIs), basemap and JS inlined.
Usage: python3 tools/build.py
"""
import base64, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(ROOT, p), encoding="utf-8").read()
page, css, js, geo = rd("src/page.html"), rd("assets/app.css"), rd("assets/app.js"), rd("assets/geo/china.js")
SHIM = '<script>window.echarts={registerMap:function(n,g){window.__chinaGeo=g;}};</script>'

title, rest = page.split("\n", 1)
head = ('<!doctype html>\n<html lang="fr"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="robots" content="noindex,nofollow">\n' + title + "\n"
        '<link rel="preload" href="assets/fonts/schibsted-grotesk-v7-latin_latin-ext-regular.woff2" as="font" type="font/woff2" crossorigin>\n'
        '<link rel="stylesheet" href="assets/app.css">\n')
meta_desc = re.search(r'<meta name="description"[^>]*>', rest).group(0)
body = rest.replace(meta_desc, "").replace("<!--CSS-->", "")
gh = (head + meta_desc + "\n</head><body>\n" + body.replace("<!--JS-->",
      SHIM + '\n<script src="assets/geo/china.js" onerror="window.__chinaGeoError=true"></script>\n<script src="assets/app.js"></script>')
      + "\n</body></html>\n")
open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8").write(gh)

def inline_font(m):
    path = os.path.join(ROOT, "assets", m.group(1))
    return 'url("data:font/woff2;base64,' + base64.b64encode(open(path, "rb").read()).decode() + '")'
css_inline = re.sub(r'url\("(fonts/[^"]+)"\)', inline_font, css)
art = page.replace("<!--CSS-->", "<style>\n" + css_inline + "\n</style>").replace("<!--JS-->",
      SHIM + "\n<script>\n" + geo + "\n</script>\n<script>\n" + js + "\n</script>")
os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
open(os.path.join(ROOT, "dist", "artifact.html"), "w", encoding="utf-8").write(art)
print("index.html", len(gh), "| dist/artifact.html", len(art))
