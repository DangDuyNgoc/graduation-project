import os
import requests


def download_file(url):
    assets_dir = os.path.join(os.path.dirname(__file__), "..", "assets")
    assets_dir = os.path.abspath(assets_dir)
    os.makedirs(assets_dir, exist_ok=True)

    # take name file from url
    filename = os.path.basename(url)
    if not filename:
        # create name random
        import uuid

        filename = str(uuid.uuid4()) + os.path.splitext(url)[-1]

    file_path = os.path.join(assets_dir, filename)

    # download file
    resp = requests.get(url)
    if resp.status_code != 200:
        raise Exception(f"Failed to download file: {resp.status_code}")

    # write file
    with open(file_path, "wb") as f:
        f.write(resp.content)

    return file_path
