import type { ImageSourcePropType } from 'react-native';

/**
 * Gallery photos for the home-screen carousel.
 *
 * To add a new photo:
 *   1. Drop the image file (.jpg / .png / .webp) into this folder.
 *      Keep it under ~500KB and ~1600px wide for fast loading.
 *   2. Add a require() entry to the GALLERY array below.
 *   3. Optionally add a `caption` — it renders as a soft overlay.
 *   4. From the project root run:
 *        cd mobile
 *        eas update --branch production --message "added gallery photo"
 *      The new image is bundled into the OTA update and reaches devices
 *      next time the app opens — no native rebuild needed.
 *
 * The gallery card auto-hides on the home screen when this array is empty,
 * so the app stays clean until you've added at least one photo.
 */

export interface GalleryPhoto {
  source: ImageSourcePropType;
  caption?: string;
}

export const GALLERY: GalleryPhoto[] = [
  // { source: require('./photo-01.jpg'), caption: 'בוקר ראשון בבית' },
  // { source: require('./photo-02.jpg'), caption: 'אחרי הנקה' },
  // { source: require('./photo-03.jpg') },
];
