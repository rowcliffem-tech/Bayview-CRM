# Built-in front-of-licence reader

The phone reader now uses self-hosted PaddleOCR.js 0.4.2 with official PP-OCRv5 mobile detection and English recognition models. A CPU Web Worker runs ONNX Runtime Web 1.24.3 with one WASM thread. No BlinkID account, scanner key or cloud OCR service is required. The user explicitly declined scanner registration. Do not reintroduce that requirement.

## Implemented capture features

- The complete photo is selected initially. Finger-controlled rectangular crop, rotation, and optional four-corner projective correction remain available.
- Advisory checks for resolution, contrast, darkness, focus and possible overexposure. These are image heuristics, not document verification or a guarantee of readability.
- Neural detection and recognition use the colour photo, a 2200-pixel maximum input side and 1536-pixel detection side limit. The earlier Tesseract passes are no longer used by the mobile scanner.
- Detected fragments are grouped by baseline and ordered left to right before labelled fields are parsed. NAME/NOM label formatting and fixed postal digit positions are normalized without rewriting names. Uncertain fields are flagged for review. Missing labels do not justify guessing a birthday from another date or from the licence number.
- Re-read one field by selecting its printed value from the existing image. This preserves the saved front-photo selection and unrelated form fields.
- Optional fields and partial private-file saving remain supported. Customer permission and review are still required.

Images stay in browser memory during recognition. They are uploaded to the existing private CRM file endpoint only when the user saves. The service worker caches static shell assets only; customer API responses and licence images are excluded. Temporary diagnostics must stay outside tracked/public files and be removed after testing.

The build bundles a CPU-only worker and verifies SHA-256 hashes of the official models. Model URLs, versions and hashes are in public/vendor/neural-models/manifest.json, with third-party notices beside it. The pinned SDK's supported cv.Mat input avoids its DOM-dependent ImageData adapter; the worker deletes the matrix after inference. Cancellation terminates the worker while retaining the selected photo for manual entry.

Professional scanner documentation informed the workflow, not the use of proprietary recognition models. This implementation does not claim the same accuracy as a commercial ID SDK, and no OCR system guarantees every field on the first attempt. Test against real phones, licence layouts, lighting and blur; always review names, dates and numbers.

## Verification on 2026-10-21

The integrated local CRM screen read an existing authorized, uncropped Ontario licence photo and correctly populated nine checked fields: first, middle and last name, birth date, expiry, licence number, street, city and postal code. The isolated engine benchmark took about 3.5 seconds after initialization. Several fields were conservatively flagged for review. Cancellation retained the photo and allowed manual entry; the 430-pixel phone layout did not overflow. This is one saved-photo test, not a measured accuracy rate or a physical-phone camera test. The latest failed phone frame was not available; its results screenshot cannot establish why that photograph failed. Private test images and diagnostics are removed after checking; no real identity values belong in fixtures or source control.

Geometry and parser checks cover crossed corners, projective mapping, image-quality warnings, name-row grouping, date validity, separation of birth and expiry, and OCR disagreements. The private-file workflow also verifies partial saving, editing, authorization and exclusion of birth dates and full licence numbers from the general workspace.

## References

- https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/README.md
- https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/inference_deployment/cross_platform/browser.en.md
- https://onnxruntime.ai/docs/tutorials/web/
