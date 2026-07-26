# Themes and presets

Theme presets contain appearance settings only. They never contain profile
text, projects, anime, music, people, places, or other personal content.

The included `presets/aero-glass.json` uses CSS-generated sky, hills, glass and
bubbles. It contains no personal text and no third-party artwork.

## Import

Open **Customize → Import & export → Import theme** and select a MyHome theme
JSON file. Review the result, then save.

## Export

Open **Customize → Import & export → Export theme**. The downloaded file can be
shared independently from the site content.

## Preset format

```json
{
  "format": "myhome-theme",
  "version": 1,
  "name": "Aero Glass",
  "description": "A short description",
  "appearance": {
    "themeId": "aero-glass",
    "accent": "#24c8c0",
    "background": {
      "src": "",
      "alt": "",
      "credit": "",
      "sourceUrl": ""
    },
    "backgroundMode": "cover",
    "backgroundPosition": "center",
    "animationsEnabled": true,
    "animationIntensity": 55
  }
}
```

Themes or add-ons made specifically for MyHome may be shared under the MyHome
license, but may not be sold.
