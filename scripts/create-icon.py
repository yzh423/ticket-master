"""Generate the Windows icon from a simple, reproducible vector-like drawing."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "build" / "icon.ico"
SIZE = 1024

image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((24, 24, 1000, 1000), radius=220, fill="#086DD1")
draw.rounded_rectangle((94, 94, 930, 930), radius=175, outline="#76B9FA", width=15)

# A ticket silhouette with the side notches cut out of its white surface.
draw.rounded_rectangle((214, 350, 810, 674), radius=59, fill="white")
draw.ellipse((152, 450, 276, 574), fill="#086DD1")
draw.ellipse((748, 450, 872, 574), fill="#086DD1")
draw.line((550, 388, 550, 638), fill="#086DD1", width=26)
draw.rounded_rectangle((318, 455, 455, 569), radius=23, fill="#086DD1")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
image.save(OUTPUT, format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print(OUTPUT)
