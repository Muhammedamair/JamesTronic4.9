# App Icons Guide

To properly set up your JamesTronic app icons for the PWA, you need to create PNG images of the following sizes:

1. `icon-192x192.png` - 192x192 pixels
2. `icon-512x512.png` - 512x512 pixels

## Steps to create proper app icons:

1. Design your app icon in a graphics editor (Figma, Adobe Illustrator, etc.)
2. Export it as a square image with a minimum size of 512x512 pixels
3. Save it as PNG format
4. Create a smaller 192x192 version from the same design
5. Place both files in the `/james-tronic/public/icons/` directory

## Recommended design tips:
- Use a simple, recognizable design that works at small sizes
- Consider using colors that match your brand
- Ensure good contrast so it's visible on various backgrounds
- Avoid too much detail that might be lost at small sizes

## Alternative approach using online tools:
1. Use an online PWA icon generator
2. Upload your main logo
3. It will generate all required sizes
4. Download the package and extract the required files to the icons directory

Once you've added the proper PNG icons to the directory, your PWA will display the correct app icon when added to the home screen.