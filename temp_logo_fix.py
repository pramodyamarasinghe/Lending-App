from PIL import Image
import os
path = os.path.join("assets","images","LendingApplogo.png")
img = Image.open(path).convert("RGBA")
pixels = img.load()
width, height = img.size
for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        if a == 0:
            continue
        if r > 240 and g > 240 and b > 240:
            pixels[x, y] = (r, g, b, 0)
img.save(path)
print("Saved transparent logo:", path)
