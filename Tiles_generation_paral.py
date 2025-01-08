from PIL import Image
import os
import math
import numpy as np
from multiprocessing import Pool
import time


Image.MAX_IMAGE_PIXELS = 450000000
labels = {"front":'f', "back":'b', "left":'l', "right":'r', "top":'u', "bottom":'d'}



def direction_to_spherical(x_coords, y_coords, face):
    """Convert normalized cube face coordinates to spherical coordinates."""
    # Normalize coordinates to range [-1, 1]
    u = x_coords * 2 - 1
    v = y_coords * 2 - 1

    if face == "front":
        x = u
        y = v
        z = -1
    elif face == "back":
        x = -u
        y = v
        z = 1
    elif face == "left":
        x = -1
        y = v
        z = -u
    elif face == "right":
        x = 1
        y = v
        z = u
    elif face == "top":
        x = u
        y = -1
        z = -v
    elif face == "bottom":
        x = u
        y = 1
        z = v
    else:
        raise ValueError(f"Invalid face: {face}")

    # Convert Cartesian coordinates to spherical
    theta = np.arctan2(x, -z)
    phi = np.arctan2(y, np.sqrt(x**2 + z**2))
    return theta, phi

def generate_face(face, zoom, img, shape, output_dir, face_size, tile_size, max_zoom_levels):
    """
    Generate a single face of the cubemap for a given zoom level.
    """
    
    width, height = shape

    zoom_scale = 1 / (2 ** (max_zoom_levels - zoom - 1))
    scaled_face_size = int(face_size * zoom_scale)
    scaled_tile_size = min(tile_size, scaled_face_size)
    
    # Precompute grid of normalized coordinates
    x_coords, y_coords = np.meshgrid(
        np.linspace(0, 1, scaled_face_size, endpoint=False),
        np.linspace(0, 1, scaled_face_size, endpoint=False)
    )
    
    # Compute spherical coordinates
    theta, phi = direction_to_spherical(x_coords, y_coords, face)
    start_time = time.time()
    # Map spherical coordinates to equirectangular image coordinates
    img_x = ((theta / (2 * math.pi)) + 0.5) * width
    img_y = ((phi / math.pi) + 0.5) * height
    img_x = np.clip(img_x, 0, width - 1).astype(int)
    img_y = np.clip(img_y, 0, height - 1).astype(int)
    end_time = time.time()
    print(end_time - start_time)
    # Extract pixel values from the equirectangular image
    img_np = np.array(img)
    face_img = img_np[img_y, img_x]

    # Save the face as tiles
    face_dir = os.path.join(output_dir, f"{zoom - 1}/{labels[face]}")
    os.makedirs(face_dir, exist_ok=True)
    
    
    
    for ty in range(0, scaled_face_size, scaled_tile_size):
        for tx in range(0, scaled_face_size, scaled_tile_size):
            tile = face_img[ty:ty + scaled_tile_size, tx:tx + scaled_tile_size]
            tile_img = Image.fromarray(tile)
            
            tile_img.save(os.path.join(face_dir, f"{ty // scaled_tile_size}_{tx // scaled_tile_size}.jpg"), quality=60)
            
def equirect_to_cubemap_multires(img, shape, output_dir, face_size=2048, tile_size=512, max_zoom_levels=4):
    """
    Convert an equirectangular image into a multi-resolution cubemap.
    Args:
        input_image_path (str): Path to the equirectangular image.
        output_dir (str): Directory to save the cubemap tiles.
        face_size (int): Size of each cube face at the highest resolution (default: 2048x2048).
        tile_size (int): Size of each tile (default: 512x512).
        max_zoom_levels (int): Maximum number of zoom levels (default: 4).
    """
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)

    # Define cube face names
    faces = ["front", "back", "left", "right", "top", "bottom"]

    # Prepare tasks for multiprocessing
    tasks = [
        (face, zoom, img, shape, output_dir, face_size, tile_size, max_zoom_levels)
        for zoom in range(1, max_zoom_levels)
        for face in faces
    ]

    # Use multiprocessing to parallelize the face generation
    with Pool() as pool:
        pool.starmap(generate_face, tasks)

    print("Multi-resolution cubemap tiles generated successfully!")

# Example usage
if __name__ == "__main__":
    # Path to your equirectangular image
    images_dir = "./Images"
    out_dir_base = "./assets"

    for filename in os.listdir(images_dir):
        name = 'DJI_0162'
        input_image = os.path.join(images_dir, filename)
        if not os.path.isfile(input_image):
            continue
        name_no_ext = os.path.splitext(filename)[0]

        output_dir = os.path.join(out_dir_base, name_no_ext)

        img = Image.open(input_image).convert("RGB")
        width, height = img.size
        
        start_time = time.time()

        # Convert the equirectangular image to a multi-resolution cubemap
        equirect_to_cubemap_multires(img, (width, height), output_dir, face_size=4096, tile_size=512, max_zoom_levels=5)

        end_time = time.time()
        
        print('all takes {}'.format(end_time-start_time))