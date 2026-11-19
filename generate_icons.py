import zlib
import struct
import math
import os

def create_png(width, height, get_pixel_fn):
    """
    Generate a valid PNG binary with RGBA colors.
    get_pixel_fn(x, y) returns (r, g, b, a) where r,g,b,a are 0-255.
    """
    raw_scanlines = bytearray()
    for y in range(height):
        raw_scanlines.append(0) # Filter type 0 (None)
        for x in range(width):
            r, g, b, a = get_pixel_fn(x, y)
            raw_scanlines.extend((int(r) & 0xFF, int(g) & 0xFF, int(b) & 0xFF, int(a) & 0xFF))
    
    def make_chunk(chunk_type, data):
        length = struct.pack(">I", len(data))
        type_and_data = chunk_type + data
        crc = struct.pack(">I", zlib.crc32(type_and_data) & 0xffffffff)
        return length + type_and_data + crc

    png_header = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    ihdr_chunk = make_chunk(b"IHDR", ihdr_data)
    
    compressed_data = zlib.compress(bytes(raw_scanlines), 9)
    idat_chunk = make_chunk(b"IDAT", compressed_data)
    iend_chunk = make_chunk(b"IEND", b"")
    
    return png_header + ihdr_chunk + idat_chunk + iend_chunk

def lerp(a, b, t):
    return a + (b - a) * t

def color_lerp(c1, c2, t):
    return (
        lerp(c1[0], c2[0], t),
        lerp(c1[1], c2[1], t),
        lerp(c1[2], c2[2], t),
        lerp(c1[3], c2[3], t),
    )

def point_in_shield(x, y, cx, cy, scale):
    # Normalized coords relative to center
    nx = (x - cx) / scale
    ny = (y - cy) / scale
    
    # Shield shape: Top line, curved sides meeting at bottom point
    # Top width ~ 1.0, height ~ 1.2
    # In normalized coords: x in [-0.55, 0.55], y in [-0.65, 0.65]
    if ny < -0.65 or ny > 0.65 or abs(nx) > 0.55:
        return False, 0.0
    
    # Top angled slope
    if ny < -0.45:
        max_y_slope = -0.65 + abs(nx) * 0.35
        if ny < max_y_slope:
            return False, 0.0
            
    # Bottom taper towards (0, 0.65)
    if ny >= -0.2:
        factor = (ny - (-0.2)) / 0.85
        max_x = 0.55 * (1.0 - (factor ** 1.35))
        if abs(nx) > max_x:
            return False, 0.0
            
    return True, 1.0

def point_in_rounded_rect(x, y, rx, ry, rw, rh, rad):
    if x < rx or x > rx + rw or y < ry or y > ry + rh:
        return False
    # Check 4 corners
    cx = rx + rad if x < rx + rad else (rx + rw - rad if x > rx + rw - rad else x)
    cy = ry + rad if y < ry + rad else (ry + rh - rad if y > ry + rh - rad else y)
    dx = x - cx
    dy = y - cy
    return (dx*dx + dy*dy) <= rad*rad

def render_medical_icon(size, is_maskable=False, is_favicon=False):
    # Colors
    bg_color = (9, 9, 11, 255) # #09090b
    emerald = (16, 185, 129, 255) # #10b981
    cyan = (6, 182, 212, 255) # #06b6d4
    white = (255, 255, 255, 255)
    
    # Supersampling 2x for smooth edges
    SS = 2
    sw = size * SS
    sh = size * SS
    
    # Scale parameters
    if is_maskable:
        # Safe zone: keep within 65% of size
        content_scale = sw * 0.58
        corner_rad = 0 # full bleed background for maskable
    elif is_favicon:
        content_scale = sw * 0.85
        corner_rad = sw * 0.15
    else:
        content_scale = sw * 0.72
        corner_rad = sw * 0.18

    cx, cy = sw / 2.0, sw / 2.0
    
    def sample_pixel(x, y):
        # Background rounded rect check
        if not is_maskable:
            if not point_in_rounded_rect(x, y, 0, 0, sw, sh, corner_rad):
                return (0, 0, 0, 0)
        
        # Base background
        r, g, b, a = bg_color
        
        # Shield geometry
        in_shield, _ = point_in_shield(x, y, cx, cy, content_scale)
        
        # Gradient ratio along diagonal
        t_grad = max(0.0, min(1.0, (x + y) / (sw + sh)))
        grad_color = color_lerp(emerald, cyan, t_grad)
        
        # Shield border vs fill
        if in_shield:
            # Shield inner fill (15% opacity gradient over dark bg)
            r = int(lerp(r, grad_color[0], 0.15))
            g = int(lerp(g, grad_color[1], 0.15))
            b = int(lerp(b, grad_color[2], 0.15))
            
            # Check if outer border
            in_inner_shield, _ = point_in_shield(x, y, cx, cy, content_scale * 0.90)
            if not in_inner_shield:
                # Border outline
                r = int(lerp(r, grad_color[0], 0.95))
                g = int(lerp(g, grad_color[1], 0.95))
                b = int(lerp(b, grad_color[2], 0.95))
        
        # Medical Cross Dimensions
        cross_w = content_scale * 0.48
        cross_t = content_scale * 0.155
        c_rad = cross_t * 0.35
        
        # Vertical bar
        vx = cx - cross_t / 2
        vy = cy - cross_w / 2 + (content_scale * 0.02)
        in_v = point_in_rounded_rect(x, y, vx, vy, cross_t, cross_w, c_rad)
        
        # Horizontal bar
        hx = cx - cross_w / 2
        hy = cy - cross_t / 2 + (content_scale * 0.02)
        in_h = point_in_rounded_rect(x, y, hx, hy, cross_w, cross_t, c_rad)
        
        # Glow around cross
        dist_v = min(abs(x - cx), abs(y - (cy + content_scale * 0.02)))
        dist_center = math.sqrt((x - cx)**2 + (y - (cy + content_scale * 0.02))**2)
        if dist_center < content_scale * 0.35:
            glow_intensity = max(0.0, 1.0 - (dist_center / (content_scale * 0.35))) * 0.25
            r = int(lerp(r, grad_color[0], glow_intensity))
            g = int(lerp(g, grad_color[1], glow_intensity))
            b = int(lerp(b, grad_color[2], glow_intensity))

        if in_v or in_h:
            r = int(grad_color[0])
            g = int(grad_color[1])
            b = int(grad_color[2])
            
        # Center Pulse / Telemetry Core Indicator circle
        dot_rad = max(2.0, content_scale * 0.045)
        core_cy = cy + (content_scale * 0.02)
        dist_core = math.sqrt((x - cx)**2 + (y - core_cy)**2)
        if dist_core <= dot_rad:
            # Center bright white core
            r, g, b = 255, 255, 255
        elif dist_core <= dot_rad * 1.8:
            core_glow = (1.0 - (dist_core - dot_rad) / (dot_rad * 0.8)) * 0.8
            r = int(lerp(r, 255, core_glow))
            g = int(lerp(g, 255, core_glow))
            b = int(lerp(b, 255, core_glow))

        return (r, g, b, a)
        
    def get_pixel_downsampled(out_x, out_y):
        acc_r, acc_g, acc_b, acc_a = 0, 0, 0, 0
        for dy in range(SS):
            for dx in range(SS):
                pr, pg, pb, pa = sample_pixel(out_x * SS + dx, out_y * SS + dy)
                acc_r += pr
                acc_g += pg
                acc_b += pb
                acc_a += pa
        count = SS * SS
        return (acc_r // count, acc_g // count, acc_b // count, acc_a // count)

    return create_png(size, size, get_pixel_downsampled)

out_dir = r"C:\Users\Univlab\Documents\PROJECT-SUB_CCP\ccp-subscription-server\portal\public"

icons = [
    ("icon-192.png", 192, False, False),
    ("icon-512.png", 512, False, False),
    ("icon-maskable-512.png", 512, True, False),
    ("apple-touch-icon.png", 180, False, False),
    ("favicon.png", 32, False, True),
]

for filename, size, maskable, favicon in icons:
    path = os.path.join(out_dir, filename)
    print(f"Generating {filename} ({size}x{size})...")
    png_bytes = render_medical_icon(size, is_maskable=maskable, is_favicon=favicon)
    with open(path, "wb") as f:
        f.write(png_bytes)
    print(f"Wrote {len(png_bytes)} bytes to {filename}")

print("All PNG icons generated successfully.")
