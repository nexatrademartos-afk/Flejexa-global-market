from pathlib import Path
import re

target = Path("src/routes/admin.tsx")
if not target.is_file():
    raise SystemExit(
        "Run this script from the repository root; src/routes/admin.tsx was not found."
    )

source = target.read_text(encoding="utf-8")

def replace_once(old: str, new: str, label: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise SystemExit(
            f"Stopped safely: expected one match for {label}, found {count}. "
            "Your admin.tsx may differ from the inspected version."
        )
    source = source.replace(old, new, 1)

replace_once(
    'import { supabase } from "@/integrations/supabase/client";\n',
    'import { supabase } from "@/integrations/supabase/client";\n'
    'import { compressProductImage } from "@/lib/product-image";\n',
    "Supabase import",
)

compressor_pattern = re.compile(
    r'const MAX_PRODUCT_IMAGES = 5;\n'
    r'const MAX_ORIGINAL_IMAGE_BYTES = 20 \* 1024 \* 1024;\n'
    r'const TARGET_IMAGE_BYTES = 90 \* 1024;\n'
    r'const MAX_IMAGE_DIMENSION = 1400;\n\n'
    r'async function compressProductImage\(file: File\): Promise<Blob> \{.*?\n\}\n\n'
    r'(?=function getProductImageUrl)',
    re.DOTALL,
)
source, count = compressor_pattern.subn(
    'const MAX_PRODUCT_IMAGES = 5;\n\n',
    source,
    count=1,
)
if count != 1:
    raise SystemExit(
        "Stopped safely: the existing image-compression function did not match "
        "the inspected version."
    )

replace_once(
    '  const [uploadingImages, setUploadingImages] = useState(false);\n',
    '  const [uploadingImages, setUploadingImages] = useState(false);\n'
    '  const [imageUploadError, setImageUploadError] = useState("");\n',
    "image upload state",
)

replace_once(
    '    setEditingId(null);\n    setForm(emptyForm);\n',
    '    setEditingId(null);\n    setForm(emptyForm);\n    setImageUploadError("");\n',
    "product form reset",
)

replace_once(
    '    setEditingId(product.id);\n    const gallery =',
    '    setEditingId(product.id);\n    setImageUploadError("");\n    const gallery =',
    "edit product reset",
)

replace_once(
    '    setUploadingImages(true);\n    setErrorMessage("");\n',
    '    setUploadingImages(true);\n    setImageUploadError("");\n    setErrorMessage("");\n',
    "start image upload",
)

replace_once(
    '      setMessage("Image upload complete. Save the product to keep the changes.");\n'
    '    } catch (error) {\n'
    '      setErrorMessage(error instanceof Error ? error.message : "Could not upload the image.");\n',
    '      setImageUploadError("");\n'
    '      setMessage("Image upload complete. Save the product to keep the changes.");\n'
    '    } catch (error) {\n'
    '      const uploadMessage = error instanceof Error ? error.message : "Could not upload the image.";\n'
    '      setImageUploadError(uploadMessage);\n'
    '      setErrorMessage(uploadMessage);\n',
    "image upload result handling",
)

replace_once(
    '    if (uploadingImages) { setErrorMessage("Please wait for the image upload to finish."); return; }\n'
    '    setSaving(true);\n',
    '    if (uploadingImages) { setErrorMessage("Please wait for the image upload to finish."); return; }\n'
    '    if (imageUploadError) {\n'
    '      setErrorMessage("An image upload failed. Retry the upload successfully before saving this product.");\n'
    '      return;\n'
    '    }\n'
    '    setSaving(true);\n',
    "save-after-upload-failure guard",
)

target.write_text(source, encoding="utf-8")
print("Updated src/routes/admin.tsx successfully.")
